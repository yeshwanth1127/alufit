import uuid
from typing import Literal

from pydantic import BaseModel, Field


class N8nCustomerBoqApprovalBody(BaseModel):
    boq_version_id: uuid.UUID
    status: Literal["approved", "rejected", "changes_requested"]
    note: str | None = Field(default=None, max_length=4000)
    # main_boq: default — whole-BOQ customer approval. line_additions: edits after main BOQ was approved.
    approval_scope: Literal["main_boq", "line_additions"] = "main_boq"


class N8nContractsChangeOrderApprovalBody(BaseModel):
    change_order_id: uuid.UUID
    status: Literal["approved", "rejected", "changes_requested"]
    note: str | None = Field(default=None, max_length=4000)
