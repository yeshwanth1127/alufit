import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user, require_project_access
from app.db.session import get_db
from app.models.entities import Attachment, ChangeOrder, ChangeOrderStatus, Project, User, utcnow
from app.schemas.design import ChangeOrderOut, DirectChangeOrderCreate
from app.schemas.documents import AttachmentOut
from app.services.audit import log_transition
from app.services.change_order_notify import (
    notify_n8n_change_request_submitted,
    send_change_request_submitted_email,
)
from app.services.storage import make_storage_key, presigned_get_url, resolve_local_storage_key, upload_fileobj


router = APIRouter(prefix="/projects/{project_id}/change-orders", tags=["change_orders"])


def _next_reference(db: Session, project: Project) -> str:
    safe = re.sub(r"[^\w-]", "", (project.code or "")).upper() or "PRJ"
    prefix = f"CO-{safe}-"
    rows = db.query(ChangeOrder.reference).filter(ChangeOrder.project_id == project.id).all()
    max_n = 0
    for (ref,) in rows:
        if not isinstance(ref, str):
            continue
        if not ref.upper().startswith(prefix):
            continue
        tail = ref[len(prefix) :]
        if tail.isdigit():
            max_n = max(max_n, int(tail))
    return f"{prefix}{max_n + 1:03d}"


@router.get("", response_model=list[ChangeOrderOut])
def list_change_orders(
    project_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[ChangeOrder]:
    require_project_access(user, db, project_id, None)
    return db.query(ChangeOrder).filter(ChangeOrder.project_id == project_id).order_by(ChangeOrder.created_at.desc()).all()


@router.post("", response_model=ChangeOrderOut)
def create_direct_change_order(
    project_id: uuid.UUID,
    body: DirectChangeOrderCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ChangeOrder:
    require_project_access(user, db, project_id, None)
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    ref = (body.reference or "").strip()
    if not ref:
        ref = _next_reference(db, project)

    co = ChangeOrder(
        project_id=project_id,
        reference=ref,
        request_kind=body.request_kind,
        boq_version_id=body.boq_version_id,
        status=ChangeOrderStatus.issued,
        contracts_approval_status="pending",
        contracts_submitted_for_approval_at=utcnow(),
        work_order_no=(body.work_order_no or "").strip() or None,
        description=(body.description or "").strip() or None,
    )
    db.add(co)
    db.flush()
    log_transition(
        db,
        project_id=project_id,
        entity_type="change_order",
        entity_id=co.id,
        from_status=None,
        to_status=co.status.value,
        actor_id=user.id,
        reason="direct_change_request_submitted_to_contracts",
        metadata={
            "reference": co.reference,
            "request_kind": co.request_kind.value if co.request_kind else None,
            "work_order_no": co.work_order_no,
            "contracts_approval_status": co.contracts_approval_status,
            "client_name": (body.client_name or "").strip() or None,
            "cluster_head": (body.cluster_head or "").strip() or None,
        },
    )
    send_change_request_submitted_email(co, project)
    notify_n8n_change_request_submitted(co, project)
    db.commit()
    db.refresh(co)
    return co


@router.get("/{co_id}/attachments", response_model=list[AttachmentOut])
def list_change_order_attachments(
    project_id: uuid.UUID,
    co_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[Attachment]:
    require_project_access(user, db, project_id, None)
    co = db.get(ChangeOrder, co_id)
    if not co or co.project_id != project_id:
        raise HTTPException(404)
    return (
        db.query(Attachment)
        .filter(
            Attachment.project_id == project_id,
            Attachment.entity_type == "change_order",
            Attachment.entity_id == co_id,
        )
        .order_by(Attachment.created_at.desc())
        .all()
    )


@router.post("/{co_id}/attachments", response_model=AttachmentOut)
async def upload_change_order_attachment(
    project_id: uuid.UUID,
    co_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
) -> Attachment:
    require_project_access(user, db, project_id, None)
    co = db.get(ChangeOrder, co_id)
    if not co or co.project_id != project_id:
        raise HTTPException(404)

    key = make_storage_key(project_id, file.filename or "file")
    data = await file.read()
    from io import BytesIO

    content_type = (file.content_type or "").strip() or "application/octet-stream"
    upload_fileobj(BytesIO(data), key, content_type)
    att = Attachment(
        project_id=project_id,
        filename=file.filename or "file",
        storage_key=key,
        content_type=content_type,
        size_bytes=len(data),
        uploaded_by_id=user.id,
        entity_type="change_order",
        entity_id=co_id,
        attachment_slot=None,
    )
    db.add(att)
    db.flush()
    log_transition(
        db,
        project_id=project_id,
        entity_type="attachment",
        entity_id=att.id,
        from_status=None,
        to_status="uploaded",
        actor_id=user.id,
        metadata={
            "filename": att.filename,
            "change_order_id": str(co_id),
        },
    )
    db.commit()
    db.refresh(att)
    return att


@router.get("/{co_id}/attachments/{attachment_id}/download")
def download_change_order_attachment(
    project_id: uuid.UUID,
    co_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    require_project_access(user, db, project_id, None)
    co = db.get(ChangeOrder, co_id)
    if not co or co.project_id != project_id:
        raise HTTPException(404)
    att = db.get(Attachment, attachment_id)
    if (
        not att
        or att.project_id != project_id
        or att.entity_type != "change_order"
        or att.entity_id != co_id
    ):
        raise HTTPException(404)

    s = get_settings()
    if s.storage_backend == "local":
        path = resolve_local_storage_key(att.storage_key)
        if not path.exists():
            raise HTTPException(404, "Attachment file missing in storage")
        media_type = att.content_type or "application/octet-stream"
        return FileResponse(path, media_type=media_type, filename=att.filename)

    url = presigned_get_url(att.storage_key)
    return RedirectResponse(url)

