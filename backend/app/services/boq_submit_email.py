import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings, resolved_n8n_boq_callback_url
from app.models.entities import BoqVersion, Project

logger = logging.getLogger(__name__)

# Fixed recipient for BOQ “submitted for customer approval” notifications
BOQ_SUBMIT_NOTIFY_TO = "yeshwanthsh128@gmail.com"


def send_boq_submitted_for_approval_email(boq: BoqVersion, project: Project) -> None:
    """Notify hardcoded inbox when a BOQ is submitted for client approval. Requires SMTP_* in settings."""
    settings = get_settings()
    if not settings.smtp_host:
        logger.warning(
            "SMTP not configured (set SMTP_HOST); skipping notify email to %s",
            BOQ_SUBMIT_NOTIFY_TO,
        )
        return

    from_addr = settings.smtp_from_email or settings.smtp_user
    if not from_addr:
        logger.warning(
            "Set SMTP_USER or SMTP_FROM_EMAIL; skipping notify email to %s",
            BOQ_SUBMIT_NOTIFY_TO,
        )
        return

    callback = resolved_n8n_boq_callback_url()
    subject = f"[Alufit] BOQ submitted for approval — {project.name}"
    body = (
        f"A BOQ was submitted and is awaiting customer approval.\n\n"
        f"Project: {project.name} ({project.code})\n"
        f"BOQ label: {boq.label}\n"
        f"BOQ version ID: {boq.id}\n"
        f"Form project: {boq.form_project_name or '—'}\n"
        f"Client: {boq.client_name or '—'}\n"
        f"Cluster head: {boq.cluster_head or '—'}\n"
        f"Rows: {boq.row_count_snapshot}\n\n"
        f"n8n / approval callback URL: {callback}\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = BOQ_SUBMIT_NOTIFY_TO
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except Exception as e:
        logger.warning("Failed to send BOQ submit email to %s: %s", BOQ_SUBMIT_NOTIFY_TO, e)
