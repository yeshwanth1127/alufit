"""change order direct request fields

Revision ID: 012
Revises: 011
Create Date: 2026-04-16 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("change_orders") as batch_op:
        batch_op.add_column(sa.Column("work_order_no", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("change_orders") as batch_op:
        batch_op.drop_column("description")
        batch_op.drop_column("work_order_no")

