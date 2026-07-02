"""add listener_state table to persist payment worker progress per network

`last_checked_block` del worker de pagos vivía solo en memoria: cada
restart/deploy lo re-inicializaba al bloque actual de la chain, y toda
transferencia USDC recibida durante el downtime quedaba sin escanear
para siempre (pago hecho, nunca acreditado, expira a los 30 min).
Migración puramente aditiva -- tabla nueva, sin tocar nada existente.

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "listener_state",
        sa.Column("network", sa.String(), primary_key=True),
        sa.Column("last_checked_block", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("listener_state")
