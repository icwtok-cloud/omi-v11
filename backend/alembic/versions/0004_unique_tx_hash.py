"""add unique constraint on payments.tx_hash

Auditoría encontró que `tx_hash` no tenía ninguna restricción a nivel de
DB -- el listener de pagos (app/workers/payment_listener.py) solo
chequea "¿ya existe un Payment con este tx_hash?" a nivel de aplicación
(un SELECT antes de escribir), sin lock. Hoy el listener corre
secuencial y de a un proceso (run_forever(), un solo loop), así que el
riesgo real es bajo, pero no hay ningún backstop si en el futuro se
escala a más de un worker o se corre una segunda instancia por error
durante un deploy -- dos instancias podrían procesar el mismo evento de
blockchain y, para pagos de suscripción, duplicar la extensión de
`subscription_expires_at` (60 días en vez de 30).

Este índice único es puramente defensivo (belt-and-suspenders): si dos
instancias intentaran setear el mismo tx_hash en dos Payments
distintos, la segunda escritura falla con IntegrityError en vez de
completarse silenciosamente. `tx_hash` es nullable (todavía no se
conoce hasta que llega la transferencia), y Postgres no considera dos
NULLs iguales para un índice único, así que múltiples Payments
pendientes sin tx_hash conviven sin problema.

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-01

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_payments_tx_hash_unique", "payments", ["tx_hash"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_payments_tx_hash_unique", table_name="payments")
