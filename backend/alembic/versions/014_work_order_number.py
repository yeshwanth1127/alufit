"""work order number column

Revision ID: 014
Revises: 013
Create Date: 2026-04-16 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("work_orders") as batch_op:
        batch_op.add_column(sa.Column("work_order_no", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("work_orders") as batch_op:
        batch_op.drop_column("work_order_no")

