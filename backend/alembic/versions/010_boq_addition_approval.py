"""boq line addition approval columns

Revision ID: 010
Revises: 009
Create Date: 2026-04-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("boq_versions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "addition_approval_status",
                sa.String(32),
                nullable=False,
                server_default="not_sent",
            )
        )
        batch_op.add_column(sa.Column("addition_approval_note", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column("addition_submitted_for_approval_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("addition_approval_decided_at", sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("boq_versions") as batch_op:
        batch_op.drop_column("addition_approval_decided_at")
        batch_op.drop_column("addition_submitted_for_approval_at")
        batch_op.drop_column("addition_approval_note")
        batch_op.drop_column("addition_approval_status")
