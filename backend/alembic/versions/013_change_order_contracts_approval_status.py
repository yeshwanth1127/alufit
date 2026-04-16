"""change order contracts approval status columns

Revision ID: 013
Revises: 012
Create Date: 2026-04-16 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("change_orders") as batch_op:
        batch_op.add_column(
            sa.Column("contracts_approval_status", sa.String(32), nullable=False, server_default="pending")
        )
        batch_op.add_column(sa.Column("contracts_approval_note", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("contracts_submitted_for_approval_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("contracts_approval_decided_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("change_orders") as batch_op:
        batch_op.drop_column("contracts_approval_decided_at")
        batch_op.drop_column("contracts_submitted_for_approval_at")
        batch_op.drop_column("contracts_approval_note")
        batch_op.drop_column("contracts_approval_status")

