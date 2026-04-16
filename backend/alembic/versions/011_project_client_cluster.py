"""project client metadata

Revision ID: 011
Revises: 010
Create Date: 2026-04-16 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.add_column(sa.Column("client_name", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("cluster_head", sa.String(255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_column("cluster_head")
        batch_op.drop_column("client_name")

