"""add user quota fields for free tier + subscription monthly export cap

Fase 3 del roadmap: nuevos tiers de precio (Free 1 módulo/1 vez, $99
proyecto completo, $149/mes hasta 5 proyectos exportados). Necesita
trackear, por usuario: si ya usó su proyecto gratis, y cuántos exports
lleva en el mes actual bajo su suscripción.

Migración puramente aditiva -- columnas nuevas con default, sin tocar
nada existente. Mucho más simple que 0002 (nada de enums, nada de
drop_column, nada de auto-create de tipos).

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-30

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("free_project_used", sa.Boolean(), nullable=True, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("monthly_export_count", sa.Integer(), nullable=True, server_default="0"),
    )
    op.add_column(
        "users", sa.Column("monthly_export_reset_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "monthly_export_reset_at")
    op.drop_column("users", "monthly_export_count")
    op.drop_column("users", "free_project_used")
