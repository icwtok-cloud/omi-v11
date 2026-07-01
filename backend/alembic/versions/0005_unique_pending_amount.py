"""partial unique index on expected_amount_usd for pending payments

Auditoría encontró que `generate_unique_amount()` (payment_matching.py)
hace un SELECT ("¿este monto ya está en uso por otro pending?") y
recién más tarde el caller hace el INSERT -- sin nada que lo proteja a
nivel de DB. Dos requests concurrentes a POST /payments/start podían
elegir el mismo monto candidato antes de que cualquiera de las dos
comiteara, resultando en dos Payments PENDING con el mismo
expected_amount_usd -- lo que rompe la premisa de todo el diseño (un
monto único identifica de forma inequívoca a qué Payment corresponde
una transferencia entrante).

Es un índice PARCIAL (solo sobre status='pending'), no un unique global
-- por diseño, un monto se reutiliza legítimamente una vez que el
Payment que lo tenía se confirma o expira (ver docstring de
payment_matching.py). Un índice único global lo hubiera roto.

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-01

"""
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_payments_pending_amount_unique",
        "payments",
        ["expected_amount_usd"],
        unique=True,
        postgresql_where=text("status = 'pending'"),
        sqlite_where=text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("ix_payments_pending_amount_unique", table_name="payments")
