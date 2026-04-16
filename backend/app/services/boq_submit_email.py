import logging
import mimetypes
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings, resolved_n8n_boq_callback_url
from app.models.entities import BoqVersion, Project
from app.services.storage import read_storage_bytes

logger = logging.getLogger(__name__)

# Most SMTP providers reject very large messages; skip attachment above this size.
MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024


def send_boq_submitted_for_approval_email(boq: BoqVersion, project: Project) -> None:
    """Notify configured inbox when a BOQ is submitted for client approval. Requires SMTP_* in settings."""
    settings = get_settings()
    notify_to = (settings.boq_submit_notify_email or "").strip()
    if not notify_to:
        logger.warning("BOQ_SUBMIT_NOTIFY_EMAIL is empty; skipping notify email")
        return

    if not settings.smtp_host:
        logger.warning(
            "SMTP not configured (set SMTP_HOST); skipping notify email to %s",
            notify_to,
        )
        return

    from_addr = settings.smtp_from_email or settings.smtp_user
    if not from_addr:
        logger.warning(
            "Set SMTP_USER or SMTP_FROM_EMAIL; skipping notify email to %s",
            notify_to,
        )
        return

    callback = (resolved_n8n_boq_callback_url() or "").strip()
    if not callback:
        logger.warning(
            "N8N_BOQ_CALLBACK_URL / PUBLIC_APP_URL not set; approval callback URL in email will be empty"
        )
    callback_line = callback or (
        "(not configured — set N8N_BOQ_CALLBACK_URL or PUBLIC_APP_URL in server env)"
    )

    # Include ref in subject so Gmail / n8n always see the UUID (body lines are often omitted from `snippet`).
    subject = f"[Alufit] BOQ submitted for approval — {project.name} | ref:{boq.id}"
    # Line n8n/Gmail automation can parse (see ALUFIT_BOQ_VERSION_ID=…)
    body = (
        f"A BOQ was submitted and is awaiting customer approval.\n\n"
        f"ALUFIT_BOQ_VERSION_ID={boq.id}\n"
        f"(Use this value as JSON field boq_version_id when POSTing to the approval URL below.)\n\n"
        f"Project: {project.name} ({project.code})\n"
        f"BOQ label: {boq.label}\n"
        f"BOQ version ID: {boq.id}\n"
        f"Form project: {boq.form_project_name or '—'}\n"
        f"Client: {boq.client_name or '—'}\n"
        f"Cluster head: {boq.cluster_head or '—'}\n"
        f"Rows: {boq.row_count_snapshot}\n\n"
        f"--- Customer approval callback (POST this URL from n8n when the client decides) ---\n"
        f"{callback_line}\n"
        f"Header: X-Webhook-Secret must match CUSTOMER_APPROVAL_WEBHOOK_SECRET on the API.\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = notify_to
    msg.set_content(body)

    attach_name = (boq.source_filename or "boq-upload").strip() or "boq-upload"
    if boq.source_storage_key:
        try:
            raw = read_storage_bytes(boq.source_storage_key)
            if len(raw) > MAX_ATTACHMENT_BYTES:
                logger.warning(
                    "BOQ file too large to attach (%s bytes, max %s); email sent without attachment",
                    len(raw),
                    MAX_ATTACHMENT_BYTES,
                )
            else:
                mime = mimetypes.guess_type(attach_name)[0] or "application/octet-stream"
                if "/" in mime:
                    maintype, subtype = mime.split("/", 1)
                else:
                    maintype, subtype = "application", "octet-stream"
                msg.add_attachment(
                    raw,
                    maintype=maintype,
                    subtype=subtype,
                    filename=attach_name,
                )
                logger.info(
                    "Attached BOQ file %s (%s bytes) for version %s",
                    attach_name,
                    len(raw),
                    boq.id,
                )
        except Exception as e:
            logger.warning(
                "Could not read or attach BOQ file for version %s (key=%s): %s",
                boq.id,
                boq.source_storage_key,
                e,
            )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        logger.info(
            "BOQ submit notification email sent to %s (from %s)",
            notify_to,
            from_addr,
        )
    except Exception as e:
        logger.warning("Failed to send BOQ submit email to %s: %s", notify_to, e)


def send_boq_new_upload_notification_email(boq: BoqVersion, project: Project) -> None:
    """Notify inbox when Contracts uploads a new BOQ via create-with-upload (draft; client approval not requested yet)."""
    settings = get_settings()
    notify_to = (settings.boq_submit_notify_email or "").strip() or "yeshwanthsh128@gmail.com"
    if not settings.smtp_host:
        logger.warning(
            "SMTP not configured (set SMTP_HOST); skipping new-BOQ upload notify email to %s",
            notify_to,
        )
        return
    from_addr = settings.smtp_from_email or settings.smtp_user
    if not from_addr:
        logger.warning(
            "Set SMTP_USER or SMTP_FROM_EMAIL; skipping new-BOQ upload notify email to %s",
            notify_to,
        )
        return

    callback = (resolved_n8n_boq_callback_url() or "").strip()
    callback_line = callback or (
        "(not configured — set N8N_BOQ_CALLBACK_URL or PUBLIC_APP_URL in server env)"
    )

    subject = f"[Alufit] New BOQ uploaded (draft) — {project.name} | ref:{boq.id}"
    body = (
        f"A new BOQ was created from an uploaded spreadsheet. It is in Draft until Contracts submits it for client approval.\n\n"
        f"ALUFIT_BOQ_VERSION_ID={boq.id}\n\n"
        f"Project: {project.name} ({project.code})\n"
        f"BOQ label: {boq.label}\n"
        f"BOQ version ID: {boq.id}\n"
        f"Form project: {boq.form_project_name or '—'}\n"
        f"Client: {boq.client_name or '—'}\n"
        f"Cluster head: {boq.cluster_head or '—'}\n"
        f"Rows: {boq.row_count_snapshot}\n\n"
        f"When ready, use \"Submit for client approval\" in the Contracts workspace to move this to pending approval "
        f"(that step sends the full approval email and can notify n8n).\n\n"
        f"--- Approval callback URL (for reference after submit-for-approval) ---\n"
        f"{callback_line}\n"
        f"Header: X-Webhook-Secret must match CUSTOMER_APPROVAL_WEBHOOK_SECRET on the API.\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = notify_to
    msg.set_content(body)

    attach_name = (boq.source_filename or "boq-upload").strip() or "boq-upload"
    if boq.source_storage_key:
        try:
            raw = read_storage_bytes(boq.source_storage_key)
            if len(raw) > MAX_ATTACHMENT_BYTES:
                logger.warning(
                    "BOQ file too large to attach (%s bytes, max %s); new-upload email sent without attachment",
                    len(raw),
                    MAX_ATTACHMENT_BYTES,
                )
            else:
                mime = mimetypes.guess_type(attach_name)[0] or "application/octet-stream"
                if "/" in mime:
                    maintype, subtype = mime.split("/", 1)
                else:
                    maintype, subtype = "application", "octet-stream"
                msg.add_attachment(
                    raw,
                    maintype=maintype,
                    subtype=subtype,
                    filename=attach_name,
                )
        except Exception as e:
            logger.warning(
                "Could not read or attach BOQ file for new-upload email (version %s): %s",
                boq.id,
                e,
            )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        logger.info("New BOQ upload notification email sent to %s (from %s)", notify_to, from_addr)
    except Exception as e:
        logger.warning("Failed to send new BOQ upload email to %s: %s", notify_to, e)


def send_line_additions_submitted_email(boq: BoqVersion, project: Project) -> None:
    """After main BOQ is approved, notify when lines are edited/saved and addition review is pending."""
    settings = get_settings()
    notify_to = (
        (settings.boq_line_additions_notify_email or "").strip()
        or (settings.boq_submit_notify_email or "").strip()
        or "yeshwanthsh128@gmail.com"
    )
    if not settings.smtp_host:
        logger.warning("SMTP not configured; skipping line-additions notify email")
        return
    from_addr = settings.smtp_from_email or settings.smtp_user
    if not from_addr:
        logger.warning("Set SMTP_USER or SMTP_FROM_EMAIL; skipping line-additions email")
        return

    callback = (resolved_n8n_boq_callback_url() or "").strip()
    callback_line = callback or (
        "(not configured — set N8N_BOQ_CALLBACK_URL or PUBLIC_APP_URL in server env)"
    )

    subject = f"[Alufit] BOQ line additions — pending approval — {project.name} | ref:{boq.id} | scope:additions"
    body = (
        f"The BOQ was already customer-approved; lines were edited or new rows were imported and need addition approval.\n\n"
        f"APPROVAL_SCOPE=line_additions\n"
        f"ALUFIT_BOQ_VERSION_ID={boq.id}\n"
        f"(POST to the callback URL with JSON approval_scope: \"line_additions\" and the same boq_version_id.)\n\n"
        f"Project: {project.name} ({project.code})\n"
        f"BOQ label: {boq.label}\n"
        f"Rows: {boq.row_count_snapshot}\n\n"
        f"--- Same approval callback as main BOQ ---\n"
        f"{callback_line}\n"
        f"Header: X-Webhook-Secret must match CUSTOMER_APPROVAL_WEBHOOK_SECRET.\n"
        f"Example JSON: {{\"boq_version_id\": \"{boq.id}\", \"status\": \"approved\", \"approval_scope\": \"line_additions\"}}\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = notify_to
    msg.set_content(body)

    attach_name = (boq.source_filename or "boq-upload").strip() or "boq-upload"
    if boq.source_storage_key:
        try:
            raw = read_storage_bytes(boq.source_storage_key)
            if len(raw) <= MAX_ATTACHMENT_BYTES:
                mime = mimetypes.guess_type(attach_name)[0] or "application/octet-stream"
                maintype, subtype = mime.split("/", 1) if "/" in mime else ("application", "octet-stream")
                msg.add_attachment(raw, maintype=maintype, subtype=subtype, filename=attach_name)
        except Exception as e:
            logger.warning("Could not attach file for line-additions email: %s", e)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        logger.info("Line-additions notification email sent to %s", notify_to)
    except Exception as e:
        logger.warning("Failed to send line-additions email: %s", e)
