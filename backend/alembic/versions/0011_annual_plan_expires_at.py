"""add annual_plan_expires_at to users (self-service annual plan)

Habilita el plan anual self-service ($799, exportaciones ilimitadas,
ver PaymentType.annual) reusando el mecanismo de annual_event_limit que
ya existia para deals manuales de partners, pero con vencimiento propio
para poder auto-revocar si no renueva. Puramente aditiva, nullable,
default None -- no afecta a ningun usuario/partner existente.

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-19

"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("annual_plan_expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "annual_plan_expires_at")
