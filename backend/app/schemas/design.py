import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.entities import ChangeOrderRequestKind, ChangeOrderStatus, DesignPackageStatus


class DesignPackageCreate(BaseModel):
    label: str = Field(min_length=1, max_length=255)


class DesignPackageOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    label: str
    shop_drawing_approved: bool
    calculation_approved: bool
    status: DesignPackageStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class DesignApproveDrawing(BaseModel):
    approved: bool = True


class ChangeOrderCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=128)
    design_package_id: uuid.UUID | None = None
    boq_version_id: uuid.UUID | None = None
    request_kind: ChangeOrderRequestKind | None = None
    work_order_no: str | None = Field(default=None, max_length=64)
    description: str | None = None


class DirectChangeOrderCreate(BaseModel):
    reference: str | None = Field(default=None, max_length=128)
    request_kind: ChangeOrderRequestKind = Field(...)
    work_order_no: str | None = Field(default=None, max_length=64)
    description: str | None = None
    boq_version_id: uuid.UUID | None = None
    client_name: str | None = Field(default=None, max_length=255)
    cluster_head: str | None = Field(default=None, max_length=255)


class ChangeOrderOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    design_package_id: uuid.UUID | None
    reference: str
    request_kind: ChangeOrderRequestKind | None = None
    boq_version_id: uuid.UUID | None
    status: ChangeOrderStatus
    contracts_approval_status: str = "pending"
    contracts_approval_note: str | None = None
    contracts_submitted_for_approval_at: datetime | None = None
    contracts_approval_decided_at: datetime | None = None
    work_order_no: str | None = None
    description: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
