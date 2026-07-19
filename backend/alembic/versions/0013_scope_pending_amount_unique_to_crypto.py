"""scope ix_payments_pending_amount_unique to provider='crypto' only

BUG FIX: el índice parcial único de 0005 sobre expected_amount_usd
(status='pending') se creó ANTES de que existiera Lemon Squeezy como
provider, y protegía específicamente el mecanismo de matching por
monto único del flujo cripto (ver docstring de 0005 y de
payment_matching.py) -- nunca debió aplicar a pagos de Lemon Squeezy,
que no usan matching por monto (usan payment_id vía custom_data, ver
app/api/webhooks.py).

Al agregar el provider lemonsqueezy, el índice se aplicó igual a TODOS
los pending sin importar el provider -- como Lemon Squeezy usa precios
fijos (99, 149, 799, sin la micro-variación que sí tiene
generate_unique_amount() para cripto), dos pending de Lemon Squeezy del
MISMO plan (dos usuarios distintos comprando el plan anual a la vez, o
el mismo usuario reintentando) colisionaban en producción con
"duplicate key value violates unique constraint
ix_payments_pending_amount_unique" -- visto al intentar pagar el plan
anual con tarjeta.

Se recrea el índice con la condición scoped a provider='crypto', que es
donde el diseño original siempre quiso que aplicara.

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-19

"""
from alembic import op
from sqlalchemy import text

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_payments_pending_amount_unique", table_name="payments")
    op.create_index(
        "ix_payments_pending_amount_unique",
        "payments",
        ["expected_amount_usd"],
        unique=True,
        postgresql_where=text("status = 'pending' AND provider = 'crypto'"),
        sqlite_where=text("status = 'pending' AND provider = 'crypto'"),
    )


def downgrade() -> None:
    op.drop_index("ix_payments_pending_amount_unique", table_name="payments")
    op.create_index(
        "ix_payments_pending_amount_unique",
        "payments",
        ["expected_amount_usd"],
        unique=True,
        postgresql_where=text("status = 'pending'"),
        sqlite_where=text("status = 'pending'"),
    )
