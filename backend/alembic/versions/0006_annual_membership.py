"""add annual event-based membership fields for partners

Membresía anual manual para partners que quieren estresar la
herramienta con mucho volumen (ej. $499/año, 5M eventos, donde 1
evento = 1 fila analizada por el motor de validación). No reemplaza
los tiers existentes (gratis/por proyecto/suscripción) -- es un modo
aparte, activado a mano por el dueño del producto con un UPDATE
directo en la DB (no hay autoservicio ni UI de admin todavía, ver
README). Migración puramente aditiva -- columnas nuevas nullable/con
default, sin tocar nada existente.

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("annual_event_limit", sa.Integer(), nullable=True))
    op.add_column(
        "users", sa.Column("annual_events_used", sa.Integer(), nullable=True, server_default="0")
    )
    op.add_column("users", sa.Column("annual_events_reset_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "annual_events_reset_at")
    op.drop_column("users", "annual_events_used")
    op.drop_column("users", "annual_event_limit")
