"""
Membresía anual de partner (deal manual, no autoservicio -- ver README):
1 evento = 1 fila validada, sin importar cuántas veces se re-valide el
mismo archivo. Si `annual_event_limit` está seteado en el usuario:
  - queda exento del gating normal de pago en can_export_project()
  - pero cada validate() cuenta filas contra su cuota anual
Si NO está seteado (el caso de todos los usuarios normales), nada de
esto se activa -- son los tests de test_entitlements_quota.py los que
cubren ese comportamiento sin tocar.
"""

import io
from datetime import datetime, timedelta

from app.models.db_models import Project, ProjectStatus

CONTACTOS_CSV = "name,vat,email\nJuan Perez,20-12345678-9,juan@x.com\n"


def _upload_and_validate(client, project_id, csv_content=CONTACTOS_CSV):
    module = client.post(
        f"/projects/{project_id}/modules",
        data={"odoo_module": "contactos"},
        files={"file": ("archivo.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    ).json()
    client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")
    return module["module_id"]


class TestMembresiaAnual:
    def test_usuario_sin_membresia_no_se_ve_afectado(self, client, db_session, test_user):
        assert test_user.annual_event_limit is None
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module_id = _upload_and_validate(client, project_id)

        status = client.get(
            f"/projects/{project_id}/modules/{module_id}/validate-status"
        ).json()
        assert status["status"] == "validated"

        db_session.refresh(test_user)
        assert test_user.annual_events_used == 0

    def test_validar_incrementa_el_contador_de_eventos(self, client, db_session, test_user):
        test_user.annual_event_limit = 5_000_000
        db_session.commit()

        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module_id = _upload_and_validate(client, project_id)

        status = client.get(
            f"/projects/{project_id}/modules/{module_id}/validate-status"
        ).json()
        assert status["status"] == "validated"

        db_session.refresh(test_user)
        assert test_user.annual_events_used == 1  # CONTACTOS_CSV tiene 1 fila

    def test_revalidar_el_mismo_archivo_cuenta_de_nuevo(self, client, db_session, test_user):
        """Decisión explícita del producto: cada validate() cuenta,
        aunque sea el mismo archivo re-validado -- más simple que
        trackear qué filas ya se cobraron."""
        test_user.annual_event_limit = 5_000_000
        db_session.commit()

        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module_id = _upload_and_validate(client, project_id)
        client.post(f"/projects/{project_id}/modules/{module_id}/validate")

        db_session.refresh(test_user)
        assert test_user.annual_events_used == 2

    def test_supera_el_limite_anual_deja_el_modulo_en_failed(
        self, client, db_session, test_user
    ):
        test_user.annual_event_limit = 5  # bien bajo para forzar el límite
        test_user.annual_events_used = 4
        # sin esto, el reset automático de "primer chequeo del año" (ver
        # reset_annual_events_if_needed) interpretaría este estado como
        # una membresía recién activada y pondría used=0 de nuevo.
        test_user.annual_events_reset_at = datetime.utcnow().replace(
            month=1, day=1, hour=0, minute=0, second=0, microsecond=0
        )
        db_session.commit()

        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        # CONTACTOS_CSV tiene 1 fila -- 4 + 1 = 5, todavía entra justo.
        module_id = _upload_and_validate(client, project_id)
        status = client.get(
            f"/projects/{project_id}/modules/{module_id}/validate-status"
        ).json()
        assert status["status"] == "validated"

        # Ahora sí se pasa: 5 + 1 = 6 > 5.
        two_rows_csv = (
            "name,vat,email\n"
            "Juan Perez,20-12345678-9,juan@x.com\n"
            "Maria Lopez,27-98765432-1,maria@x.com\n"
        )
        module_id_2 = _upload_and_validate(client, project_id, two_rows_csv)
        status_2 = client.get(
            f"/projects/{project_id}/modules/{module_id_2}/validate-status"
        ).json()
        assert status_2["status"] == "failed"
        assert "límite anual" in status_2["error"]

        db_session.refresh(test_user)
        assert test_user.annual_events_used == 5  # no se incrementó por el intento fallido

    def test_se_resetea_al_cruzar_a_un_año_calendario_nuevo(self, client, db_session, test_user):
        test_user.annual_event_limit = 5_000_000
        test_user.annual_events_used = 4_999_999
        test_user.annual_events_reset_at = datetime.utcnow().replace(year=datetime.utcnow().year - 1)
        db_session.commit()

        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module_id = _upload_and_validate(client, project_id)

        status = client.get(
            f"/projects/{project_id}/modules/{module_id}/validate-status"
        ).json()
        assert status["status"] == "validated"

        db_session.refresh(test_user)
        # se resetea a 0 y recién ahí suma la fila de este archivo -- si
        # no se hubiera reseteado, 4_999_999 + 1 seguiría siendo válido
        # igual, así que lo relevante acá es que quedó en 1, no en 5_000_000.
        assert test_user.annual_events_used == 1

    def test_membresia_anual_exime_del_gating_normal_de_pago(
        self, client, db_session, test_user
    ):
        """Un socio con membresía anual puede descargar sin haber
        pagado el proyecto puntual, sin depender de su cuota de
        suscripción, y sin gastar su proyecto gratis."""
        test_user.annual_event_limit = 5_000_000
        test_user.free_project_used = True  # ya gastó el gratis, no importa
        db_session.commit()

        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        _upload_and_validate(client, project_id)

        project = db_session.query(Project).filter(Project.id == project_id).first()
        assert project.status == ProjectStatus.active  # nunca se pagó

        resp = client.get(f"/projects/{project_id}/download")
        assert resp.status_code == 200
