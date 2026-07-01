"""
Tests de POST /payments/start: tope de pagos pendientes simultáneos por
usuario (P1 de la auditoría -- sin esto, spamear el endpoint podía
consumir el pool finito de montos únicos que usa
generate_unique_amount()).
"""

from app.models.db_models import Payment, PaymentStatus


def test_iniciar_un_pago_normal_funciona(client):
    project_id = client.post(
        "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
    ).json()["project_id"]

    resp = client.post(
        "/payments/start",
        json={"payment_type": "per_project", "network": "polygon", "project_id": project_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["expected_amount_usd"] > 0
    assert body["payment_id"]


def test_cuarto_pago_pendiente_simultaneo_se_rechaza_con_429(client, db_session, test_user):
    for _ in range(3):
        resp = client.post(
            "/payments/start",
            json={"payment_type": "subscription", "network": "polygon"},
        )
        assert resp.status_code == 200

    resp = client.post(
        "/payments/start",
        json={"payment_type": "subscription", "network": "polygon"},
    )
    assert resp.status_code == 429

    # Confirma que efectivamente solo hay 3 filas pendientes -- el 429
    # frenó antes de crear una 4ta.
    pending = (
        db_session.query(Payment)
        .filter(Payment.user_id == test_user.id, Payment.status == PaymentStatus.pending)
        .count()
    )
    assert pending == 3


def test_un_pago_confirmado_no_cuenta_para_el_tope(client, db_session, test_user):
    for _ in range(3):
        client.post(
            "/payments/start",
            json={"payment_type": "subscription", "network": "polygon"},
        )

    # Confirma uno de los 3 -- ya no debería contar como "pendiente".
    payment = (
        db_session.query(Payment)
        .filter(Payment.user_id == test_user.id, Payment.status == PaymentStatus.pending)
        .first()
    )
    payment.status = PaymentStatus.confirmed
    db_session.commit()

    resp = client.post(
        "/payments/start",
        json={"payment_type": "subscription", "network": "polygon"},
    )
    assert resp.status_code == 200
