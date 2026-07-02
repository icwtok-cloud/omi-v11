"""
Worker de escucha de pagos cripto.

Corre como proceso separado (background worker en Render, no en el
mismo proceso que atiende requests HTTP) -- ver render.yaml.

Por cada red soportada (Polygon, Base):
  1. Se conecta al RPC vía web3.py
  2. Escucha eventos Transfer del contrato de USDC donde el `to` sea
     nuestra dirección fija de cobro
  3. Por cada transferencia nueva, intenta hacer match contra un Payment
     pendiente por monto (ver payment_matching.py)
  4. Si matchea, espera las confirmaciones de bloque requeridas antes de
     marcarlo como confirmed -- así nos protegemos de reorgs en L2s.

Nota de diseño: esto es polling simple (chequea bloques nuevos cada
N segundos), no un websocket -- es más fácil de operar y resetear si
el worker se cae, a costa de algo de latencia (segundos, no minutos).
Para el volumen esperado de OMI esto es más que suficiente.
"""

from __future__ import annotations

import time
from datetime import datetime

from sqlalchemy.exc import IntegrityError
from web3 import Web3

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.safe_logging import log_event
from app.models.db_models import Payment, PaymentStatus, PaymentNetwork, ListenerState
from app.services.payment_matching import find_pending_payment_by_amount

# ABI mínima: solo necesitamos el evento Transfer y decimals().
ERC20_MINIMAL_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "value", "type": "uint256"},
        ],
        "name": "Transfer",
        "type": "event",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
]

POLL_INTERVAL_SECONDS = 15


RPC_REQUEST_TIMEOUT_SECONDS = 15


class ChainListener:
    def __init__(self, network: PaymentNetwork, rpc_url: str, usdc_contract: str):
        self.network = network
        # Sin timeout explícito, `requests` (que usa HTTPProvider por
        # debajo) espera indefinidamente. `run_forever()` es
        # single-threaded y secuencial entre redes -- un RPC provider
        # que se cuelga (no rechaza la conexión, simplemente no
        # responde) dejaría el worker entero trabado para SIEMPRE, sin
        # confirmar pagos en NINGUNA red, sin ningún error visible en
        # logs (nunca se llega a loguear nada porque la llamada nunca
        # retorna).
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": RPC_REQUEST_TIMEOUT_SECONDS}))
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(usdc_contract),
            abi=ERC20_MINIMAL_ABI,
        )
        self.decimals = self.contract.functions.decimals().call()
        # Retomar desde el último bloque persistido en DB, si existe --
        # sin esto, cada restart/deploy del worker arrancaba desde el
        # bloque actual y toda transferencia recibida durante el downtime
        # quedaba sin escanear para siempre (pago hecho, nunca acreditado).
        persisted = self._load_last_checked_block()
        if persisted is not None:
            self.last_checked_block = persisted
        else:
            self.last_checked_block = self.w3.eth.block_number
            self._persist_last_checked_block(self.last_checked_block)

    def _load_last_checked_block(self) -> int | None:
        db = SessionLocal()
        try:
            state = (
                db.query(ListenerState)
                .filter(ListenerState.network == self.network.value)
                .first()
            )
            return state.last_checked_block if state else None
        finally:
            db.close()

    def _persist_last_checked_block(self, block: int) -> None:
        db = SessionLocal()
        try:
            state = (
                db.query(ListenerState)
                .filter(ListenerState.network == self.network.value)
                .first()
            )
            if state is None:
                db.add(ListenerState(network=self.network.value, last_checked_block=block))
            else:
                state.last_checked_block = block
            db.commit()
        finally:
            db.close()

    def poll_once(self):
        latest_block = self.w3.eth.block_number
        if latest_block <= self.last_checked_block:
            return

        receive_address = Web3.to_checksum_address(settings.payment_receive_address)

        logs = self.contract.events.Transfer().get_logs(
            from_block=self.last_checked_block + 1,
            to_block=latest_block,
            argument_filters={"to": receive_address},
        )

        for log in logs:
            self._handle_transfer(log, latest_block)

        self.last_checked_block = latest_block
        # Persistir DESPUÉS de procesar los logs del rango: si el worker
        # muere a mitad de un batch, el próximo boot re-escanea el rango
        # completo (los handlers son idempotentes: tx_hash único + el
        # early-return de `existing`), en vez de saltearse pagos.
        self._persist_last_checked_block(latest_block)

    def _handle_transfer(self, log, current_block: int):
        raw_value = log["args"]["value"]
        amount_usd = raw_value / (10 ** self.decimals)
        tx_hash = log["transactionHash"].hex()
        tx_block = log["blockNumber"]
        confirmations = current_block - tx_block

        db = SessionLocal()
        try:
            existing = db.query(Payment).filter(Payment.tx_hash == tx_hash).first()
            if existing:
                self._update_confirmations(db, existing, confirmations)
                return

            payment = find_pending_payment_by_amount(db, amount_usd, self.network.value)
            if payment is None:
                # Llegó plata que no matchea ningún pago pendiente -- se
                # registra en logs para revisión manual, no se pierde el
                # dato, pero no se asocia a nada automáticamente.
                log_event(
                    "UnmatchedPaymentReceived",
                    network=self.network.value, tx_hash=tx_hash, amount_usd=amount_usd,
                )
                return

            payment.tx_hash = tx_hash
            payment.network = self.network
            payment.confirmations_seen = confirmations
            try:
                db.commit()
            except IntegrityError:
                # El índice único de tx_hash (migración 0004) frenó una
                # doble escritura -- otra instancia/loop ya está
                # procesando esta misma transferencia. No es un error
                # real, solo hay que abandonar este intento.
                db.rollback()
                return

            if confirmations >= settings.confirmations_required:
                self._confirm_payment(db, payment)

        finally:
            db.close()

    def _update_confirmations(self, db, payment: Payment, confirmations: int):
        if payment.status != PaymentStatus.pending:
            return
        payment.confirmations_seen = confirmations
        db.commit()
        if confirmations >= settings.confirmations_required:
            self._confirm_payment(db, payment)

    def _confirm_payment(self, db, payment: Payment):
        # Efectos de negocio (desbloquear proyecto / activar suscripción)
        # y cambio de estado del Payment en UNA SOLA transacción -- antes
        # se comiteaba `confirmed` primero y los efectos después, y si el
        # proceso moría en el medio el pago quedaba confirmado sin
        # desbloquear nada, sin reintento posible (el re-chequeo corta
        # con status != pending).
        from app.services.entitlements import apply_payment_confirmation

        payment.status = PaymentStatus.confirmed
        payment.confirmed_at = datetime.utcnow()
        apply_payment_confirmation(db, payment)
        try:
            db.commit()
        except Exception:
            db.rollback()
            raise

        log_event(
            "PaymentConfirmed",
            payment_id=payment.id, user_id=payment.user_id,
            payment_type=payment.payment_type.value, network=self.network.value,
        )


def run_forever():
    listeners = [
        ChainListener(PaymentNetwork.polygon, settings.polygon_rpc_url, settings.polygon_usdc_contract),
        ChainListener(PaymentNetwork.base, settings.base_rpc_url, settings.base_usdc_contract),
    ]

    log_event("PaymentListenerStarted", networks=[l.network.value for l in listeners])

    while True:
        for listener in listeners:
            try:
                listener.poll_once()
            except Exception as e:
                # Un error transitorio de RPC no debe matar el worker entero.
                log_event(
                    "PaymentListenerPollError",
                    network=listener.network.value, error_type=type(e).__name__,
                )
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_forever()
