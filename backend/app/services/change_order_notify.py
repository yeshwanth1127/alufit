import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import get_settings
from app.models.entities import ChangeOrder, Project

logger = logging.getLogger(__name__)


def _resolved_change_order_callback_url() -> str:
    s = get_settings()
    base = (s.public_app_url or "").strip().rstrip("/")
    if not base:
        return ""
    return f"{base}/api/change-order-approval"


def notify_n8n_change_request_submitted(co: ChangeOrder, project: Project) -> None:
    s = get_settings()
    url = (s.n8n_change_request_webhook_url or "").strip()
    if not url:
        return
    callback_url = _resolved_change_order_callback_url()
    if not callback_url:
        logger.warning(
            "Skipping n8n change-request notify: set PUBLIC_APP_URL so callback URL can be resolved"
        )
        return
    payload = {
        "event": "direct_change_request_submitted",
        "change_order_id": str(co.id),
        "project_id": str(project.id),
        "project_name": project.name,
        "project_code": project.code,
        "reference": co.reference,
        "request_kind": co.request_kind.value if co.request_kind else None,
        "work_order_no": co.work_order_no,
        "description": co.description,
        "callback": {
            "url": callback_url,
            "secret_header_name": "X-Webhook-Secret",
        },
    }
    try:
        r = httpx.post(url, json=payload, timeout=30.0)
        r.raise_for_status()
    except Exception as e:
        logger.warning("n8n notify failed for change order %s: %s", co.id, e)


def send_change_request_submitted_email(co: ChangeOrder, project: Project) -> None:
    s = get_settings()
    notify_to = (
        (s.change_request_notify_email or "").strip()
        or (s.boq_line_additions_notify_email or "").strip()
        or (s.boq_submit_notify_email or "").strip()
    )
    if not notify_to:
        logger.warning("CHANGE_REQUEST_NOTIFY_EMAIL is empty; skipping change request email")
        return
    if not s.smtp_host:
        logger.warning("SMTP not configured; skipping change request email")
        return
    from_addr = s.smtp_from_email or s.smtp_user
    if not from_addr:
        logger.warning("Set SMTP_USER or SMTP_FROM_EMAIL; skipping change request email")
        return

    callback = _resolved_change_order_callback_url() or (
        "(not configured — set PUBLIC_APP_URL to enable callback URL)"
    )
    subject = f"[Alufit] Change request submitted — {project.name} | ref:{co.id}"
    body = (
        "A direct change request was submitted and is awaiting Contracts approval.\n\n"
        f"ALUFIT_CHANGE_ORDER_ID={co.id}\n"
        f"Project: {project.name} ({project.code})\n"
        f"Reference: {co.reference}\n"
        f"Type: {(co.request_kind.value if co.request_kind else '—')}\n"
        f"Work order no: {co.work_order_no or '—'}\n"
        f"Description: {co.description or '—'}\n\n"
        "--- Approval callback URL (n8n/Gmail automation) ---\n"
        f"{callback}\n"
        "Header: X-Webhook-Secret must match CUSTOMER_APPROVAL_WEBHOOK_SECRET.\n"
        f"Example JSON: {{\"change_order_id\": \"{co.id}\", \"status\": \"approved\"}}\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = notify_to
    msg.set_content(body)
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=30) as smtp:
            if s.smtp_use_tls:
                smtp.starttls()
            if s.smtp_user and s.smtp_password:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
        logger.info("Change request email sent to %s", notify_to)
    except Exception as e:
        logger.warning("Failed to send change request email: %s", e)

