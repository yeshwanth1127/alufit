import mimetypes
import uuid
from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import (
    get_current_user,
    require_project_access,
    require_superuser,
    role_contracts,
)
from app.db.session import get_db
from app.models.entities import (
    BoqLineItem,
    BoqSource,
    BoqVersion,
    ChangeOrder,
    ChangeOrderRequestKind,
    CustomerApprovalStatus,
    DepartmentRole,
    ErpJobStatus,
    ErpSyncJob,
    Organization,
    Project,
    ProjectDocument,
    ProjectMembership,
    User,
    WorkOrder,
    utcnow,
)
from app.schemas.project import (
    ApprovedBoqProjectGroup,
    BoqHeadingOut,
    BoqVersionCreate,
    BoqVersionOut,
    MembershipAssign,
    ProjectCreate,
    ProjectOut,
    ProjectSummary,
)
from app.schemas.design import ChangeOrderOut
from app.services.audit import log_transition
from app.services.boq_import import import_boq_from_xlsx
from app.services.boq_submit_email import send_boq_submitted_for_approval_email
from app.services.n8n_notify import notify_n8n_boq_submitted
from app.services.storage import make_storage_key, upload_fileobj
from app.api.erp import next_work_order_no

router = APIRouter(prefix="/projects", tags=["projects"])


def _mark_pending_customer_approval(v: BoqVersion) -> None:
    v.customer_approval_status = CustomerApprovalStatus.pending
    v.customer_submitted_for_approval_at = utcnow()


@router.post("", response_model=ProjectOut)
def create_project(
    body: ProjectCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_superuser)],
) -> Project:
    org = db.query(Organization).first()
    if not org:
        org = Organization(name="Default Org")
        db.add(org)
        db.flush()
    if db.query(Project).filter(Project.code == body.code).first():
        raise HTTPException(400, "Project code already exists")
    p = Project(
        organization_id=org.id,
        name=body.name,
        code=body.code,
        erp_connector_key=body.erp_connector_key,
        client_name=(body.client_name or "").strip() or None,
        cluster_head=(body.cluster_head or "").strip() or None,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[Project]:
    if user.is_superuser:
        return db.query(Project).order_by(Project.name).all()
    mids = [m.project_id for m in user.memberships]
    if not mids:
        return []
    return db.query(Project).filter(Project.id.in_(mids)).order_by(Project.name).all()


@router.get("/approved-boqs", response_model=list[ApprovedBoqProjectGroup])
def list_approved_boqs_grouped(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[ApprovedBoqProjectGroup]:
    """Design dashboard feed: approved BOQs grouped by project with full version history context."""
    if user.is_superuser:
        projects = db.query(Project).order_by(Project.name).all()
    else:
        mids = [m.project_id for m in user.memberships]
        if not mids:
            return []
        projects = db.query(Project).filter(Project.id.in_(mids)).order_by(Project.name).all()

    out: list[ApprovedBoqProjectGroup] = []
    for p in projects:
        versions = (
            db.query(BoqVersion)
            .filter(
                BoqVersion.project_id == p.id,
                BoqVersion.customer_approval_status == CustomerApprovalStatus.approved,
            )
            .order_by(BoqVersion.customer_approval_decided_at.desc(), BoqVersion.created_at.desc())
            .all()
        )
        if not versions:
            continue
        out.append(
            ApprovedBoqProjectGroup(
                project=ProjectOut.model_validate(p),
                versions=[BoqVersionOut.model_validate(v) for v in versions],
            )
        )
    return out


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Project:
    require_project_access(user, db, project_id, None)
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404)
    return p


@router.get("/{project_id}/summary", response_model=ProjectSummary)
def project_summary(
    project_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ProjectSummary:
    require_project_access(user, db, project_id, None)
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404)
    boq_count = db.query(func.count(BoqVersion.id)).filter(BoqVersion.project_id == project_id).scalar() or 0
    latest_doc = (
        db.query(ProjectDocument)
        .filter(ProjectDocument.project_id == project_id)
        .order_by(ProjectDocument.updated_at.desc())
        .first()
    )
    open_jobs = (
        db.query(func.count(ErpSyncJob.id))
        .filter(
            ErpSyncJob.project_id == project_id,
            ErpSyncJob.status.in_([ErpJobStatus.queued, ErpJobStatus.running]),
        )
        .scalar()
        or 0
    )
    return ProjectSummary(
        project=ProjectOut.model_validate(p),
        boq_versions_count=int(boq_count),
        latest_document_status=latest_doc.status.value if latest_doc else None,
        open_erp_jobs=int(open_jobs),
    )


@router.post("/{project_id}/members", response_model=dict)
def assign_member(
    project_id: uuid.UUID,
    body: MembershipAssign,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_superuser)],
) -> dict:
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404)
    u = db.get(User, body.user_id)
    if not u:
        raise HTTPException(404, "User not found")
    existing = (
        db.query(ProjectMembership)
        .filter(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == body.user_id,
        )
        .first()
    )
    if existing:
        existing.role = body.role
    else:
        db.add(ProjectMembership(user_id=body.user_id, project_id=project_id, role=body.role))
    db.commit()
    return {"ok": True}


@router.get("/{project_id}/boq-versions", response_model=list[BoqVersionOut])
def list_boq_versions(
    project_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[BoqVersion]:
    require_project_access(user, db, project_id, None)
    return (
        db.query(BoqVersion)
        .filter(BoqVersion.project_id == project_id)
        .order_by(BoqVersion.created_at.desc())
        .all()
    )


def _looks_like_heading_row(line_no: str, description: str, uom: str | None, quantity: float, rate: float, amount: float) -> bool:
    """
    Best-effort heuristic to detect "heading" rows from imported BOQ sheets:
    - usually have no UOM and all numeric columns are 0
    - line numbers often are Roman numerals / single letters / short tokens
    """
    ln = (line_no or "").strip()
    desc = (description or "").strip()
    if not ln or not desc:
        return False
    if (uom or "").strip():
        return False
    if quantity != 0 or rate != 0 or amount != 0:
        return False
    # Roman numerals or single alphabetic tokens (I, II, A, B, etc.)
    import re

    if re.fullmatch(r"[IVXLCDM]+", ln, flags=re.IGNORECASE):
        return True
    if re.fullmatch(r"[A-Z]{1,3}", ln, flags=re.IGNORECASE):
        return True
    # Fallback: short token without separators
    if len(ln) <= 4 and all(ch.isalnum() for ch in ln):
        return True
    return False


@router.get("/{project_id}/boq-headings", response_model=list[BoqHeadingOut])
def list_boq_headings(
    project_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    version_id: Annotated[uuid.UUID | None, Query(description="Optional: extract headings from this BOQ version")] = None,
) -> list[BoqHeadingOut]:
    """
    Returns heading strings from the BOQ sheet to populate dropdowns in Design CO creation.
    If version_id is omitted, uses latest customer-approved BOQ version for the project.
    """
    require_project_access(user, db, project_id, None)

    v: BoqVersion | None
    if version_id:
        v = db.get(BoqVersion, version_id)
        if not v or v.project_id != project_id:
            raise HTTPException(404, "BOQ version not found")
    else:
        v = (
            db.query(BoqVersion)
            .filter(
                BoqVersion.project_id == project_id,
                BoqVersion.customer_approval_status == CustomerApprovalStatus.approved,
            )
            .order_by(BoqVersion.customer_approval_decided_at.desc(), BoqVersion.created_at.desc())
            .first()
        )
        if not v:
            return []

    lines = (
        db.query(BoqLineItem)
        .filter(BoqLineItem.boq_version_id == v.id)
        .order_by(BoqLineItem.sort_order)
        .limit(5000)
        .all()
    )
    out: list[BoqHeadingOut] = []
    seen: set[str] = set()
    for r in lines:
        if _looks_like_heading_row(r.line_no, r.description, r.uom, r.quantity, r.rate, r.amount):
            item = r.description.strip()
            ref = (r.line_no or "").strip()
            key = f"{ref.lower()}::{item.lower()}"
            if key not in seen:
                out.append(BoqHeadingOut(ref=ref, item=item))
                seen.add(key)
    return out


@router.get("/{project_id}/contracts/new-item-requests", response_model=list[ChangeOrderOut])
def list_addition_new_item_requests(
    project_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[ChangeOrder]:
    require_project_access(user, db, project_id, role_contracts())
    return (
        db.query(ChangeOrder)
        .filter(
            ChangeOrder.project_id == project_id,
            ChangeOrder.request_kind == ChangeOrderRequestKind.addition_new_item,
        )
        .order_by(ChangeOrder.created_at.desc())
        .all()
    )


@router.post("/{project_id}/boq-versions", response_model=BoqVersionOut)
def create_boq_version(
    project_id: uuid.UUID,
    body: BoqVersionCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> BoqVersion:
    require_project_access(user, db, project_id, role_contracts())
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404)
    v = BoqVersion(project_id=project_id, label=body.label, source=body.source)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.post(
    "/{project_id}/boq-versions/{version_id}/submit-for-customer-approval",
    response_model=BoqVersionOut,
)
def submit_boq_for_customer_approval(
    project_id: uuid.UUID,
    version_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> BoqVersion:
    """Mark an imported BOQ as waiting for customer approval and notify n8n (if configured)."""
    require_project_access(user, db, project_id, role_contracts())
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404)
    v = db.get(BoqVersion, version_id)
    if not v or v.project_id != project_id:
        raise HTTPException(404)
    if v.customer_approval_status != CustomerApprovalStatus.not_sent:
        raise HTTPException(400, "BOQ is already in customer approval or has been decided")
    if not v.row_count_snapshot or v.row_count_snapshot < 1:
        raise HTTPException(400, "Import BOQ lines before requesting customer approval")
    _mark_pending_customer_approval(v)
    log_transition(
        db,
        project_id=project_id,
        entity_type="boq_version",
        entity_id=v.id,
        from_status=CustomerApprovalStatus.not_sent.value,
        to_status=CustomerApprovalStatus.pending.value,
        actor_id=user.id,
        reason="submit_for_customer_approval",
        metadata={},
    )
    db.commit()
    db.refresh(v)
    notify_n8n_boq_submitted(v, p)
    send_boq_submitted_for_approval_email(v, p)
    return v


@router.post("/{project_id}/boq-versions/create-with-upload", response_model=BoqVersionOut)
async def create_boq_with_upload(
    project_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    form_project_name: Annotated[str, Form()],
    cluster_head: Annotated[str, Form()],
    client_name: Annotated[str, Form()],
    file: UploadFile = File(...),
) -> BoqVersion:
    """Create a new BOQ version and import the uploaded sheet in one step (Contracts flow)."""
    require_project_access(user, db, project_id, role_contracts())
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404)
    fp = form_project_name.strip()
    ch = cluster_head.strip()
    cn = client_name.strip()
    if not fp or not ch or not cn:
        raise HTTPException(400, "Project name, cluster head, and client name are required")
    data = await file.read()
    if not data:
        raise HTTPException(400, "BOQ file is empty")
    label = f"NEW BOQ — {fp}"[:255]
    v = BoqVersion(
        project_id=project_id,
        label=label,
        source=BoqSource.new_boq,
        form_project_name=fp,
        cluster_head=ch,
        client_name=cn,
        source_filename=file.filename or "upload.xlsx",
    )
    db.add(v)
    db.flush()
    # Creating a new BOQ implies a new Work Order number for this project.
    wo_no = next_work_order_no(db, project_id)
    wo = WorkOrder(project_id=project_id, work_order_no=wo_no, reference=str(wo_no))
    db.add(wo)
    db.flush()
    log_transition(
        db,
        project_id=project_id,
        entity_type="work_order",
        entity_id=wo.id,
        from_status=None,
        to_status="created",
        actor_id=user.id,
        reason="created_from_new_boq",
        metadata={"work_order_no": wo_no, "boq_version_id": str(v.id)},
    )
    try:
        count, errors = import_boq_from_xlsx(db, v, data)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e)) from e

    fname = v.source_filename or "upload.xlsx"
    key = make_storage_key(project_id, fname)
    ct = mimetypes.guess_type(fname)[0]
    upload_fileobj(BytesIO(data), key, ct)
    v.source_storage_key = key

    _mark_pending_customer_approval(v)
    log_transition(
        db,
        project_id=project_id,
        entity_type="boq_version",
        entity_id=v.id,
        from_status=None,
        to_status=v.status.value,
        actor_id=user.id,
        reason="create_new_boq_upload",
        metadata={
            "rows_imported": count,
            "errors": errors,
            "form_project_name": fp,
            "cluster_head": ch,
            "client_name": cn,
            "filename": v.source_filename,
            "customer_approval": CustomerApprovalStatus.pending.value,
        },
    )
    db.commit()
    db.refresh(v)
    notify_n8n_boq_submitted(v, p)
    send_boq_submitted_for_approval_email(v, p)
    return v
