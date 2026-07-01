"""
Tests de la Fase 3 del roadmap: nuevos tiers de precio (Free 1 módulo/1
vez por cuenta, $99 proyecto completo, $149/mes hasta 5 proyectos
exportados) y la cuota aplicada exactamente al exportar, no al validar.
"""

import io
from datetime import datetime, timedelta

from app.models.db_models import Project, ProjectStatus
from app.services.entitlements import (
    can_export_project,
    reset_monthly_counter_if_needed,
    SUBSCRIPTION_MONTHLY_EXPORT_LIMIT,
)

CONTACTOS_CSV = "name,vat,email\nJuan Perez,20-12345678-9,juan@x.com\n"
CRM_CSV = "name\nOportunidad 1\n"


def _upload_module(client, project_id, odoo_module, csv_content, filename="archivo.csv"):
    return client.post(
        f"/projects/{project_id}/modules",
        data={"odoo_module": odoo_module},
        files={"file": (filename, io.BytesIO(csv_content.encode()), "text/csv")},
    )


class TestResetMensual:
    def test_resetea_al_cruzar_a_un_mes_nuevo(self, test_user):
        test_user.monthly_export_count = 3
        test_user.monthly_export_reset_at = datetime(2026, 5, 1)

        reset_monthly_counter_if_needed(test_user)

        assert test_user.monthly_export_count == 0
        assert test_user.monthly_export_reset_at.month == datetime.utcnow().month

    def test_no_resetea_dentro_del_mismo_mes(self, test_user):
        current_month_start = datetime.utcnow().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        test_user.monthly_export_count = 3
        test_user.monthly_export_reset_at = current_month_start

        reset_monthly_counter_if_needed(test_user)

        assert test_user.monthly_export_count == 3

    def test_primera_vez_sin_reset_previo_inicializa(self, test_user):
        test_user.monthly_export_count = 0
        test_user.monthly_export_reset_at = None

        reset_monthly_counter_if_needed(test_user)

        assert test_user.monthly_export_reset_at is not None


class TestCanExportProject:
    def test_proyecto_ya_pagado_siempre_permite_exportar(self, db_session, test_user):
        project = Project(owner_id=test_user.id, odoo_version="15.0", status=ProjectStatus.paid)
        db_session.add(project)
        db_session.commit()

        allowed, err = can_export_project(db_session, test_user, project)
        assert allowed is True
        assert err is None

    def test_primer_proyecto_de_la_cuenta_es_gratis(self, db_session, test_user):
        project = Project(owner_id=test_user.id, odoo_version="15.0")
        db_session.add(project)
        db_session.commit()

        allowed, err = can_export_project(db_session, test_user, project)
        assert allowed is True
        assert err is None

    def test_segundo_proyecto_no_es_gratis_aunque_no_se_haya_usado_la_cuota(
        self, db_session, test_user
    ):
        primero = Project(owner_id=test_user.id, odoo_version="15.0")
        segundo = Project(owner_id=test_user.id, odoo_version="15.0")
        db_session.add_all([primero, segundo])
        db_session.commit()

        # el usuario nunca exportó nada (free_project_used sigue False),
        # pero como ya tiene 2 proyectos, el segundo no es el elegible.
        allowed, err = can_export_project(db_session, test_user, segundo)
        assert allowed is False
        assert "pagar" in err.lower() or "suscripción" in err.lower()

    def test_suscripcion_activa_bajo_el_tope_permite_exportar(self, db_session, test_user):
        # dos proyectos: el primero "gasta" la cuota gratis en el setup,
        # el segundo es el que se está evaluando bajo suscripción.
        primero = Project(owner_id=test_user.id, odoo_version="15.0")
        segundo = Project(owner_id=test_user.id, odoo_version="15.0")
        db_session.add_all([primero, segundo])
        test_user.free_project_used = True
        test_user.has_active_subscription = True
        test_user.subscription_expires_at = datetime.utcnow() + timedelta(days=10)
        test_user.monthly_export_count = 2
        db_session.commit()

        allowed, err = can_export_project(db_session, test_user, segundo)
        assert allowed is True
        assert err is None

    def test_suscripcion_activa_en_el_tope_bloquea(self, db_session, test_user):
        primero = Project(owner_id=test_user.id, odoo_version="15.0")
        segundo = Project(owner_id=test_user.id, odoo_version="15.0")
        db_session.add_all([primero, segundo])
        test_user.free_project_used = True
        test_user.has_active_subscription = True
        test_user.subscription_expires_at = datetime.utcnow() + timedelta(days=10)
        test_user.monthly_export_count = SUBSCRIPTION_MONTHLY_EXPORT_LIMIT
        # Sin esto, reset_monthly_counter_if_needed ve monthly_export_reset_at=None
        # y resetea el contador a 0 antes de chequear el tope.
        test_user.monthly_export_reset_at = datetime.utcnow().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        db_session.commit()

        allowed, err = can_export_project(db_session, test_user, segundo)
        assert allowed is False
        assert "límite" in err.lower()

    def test_sin_pago_ni_suscripcion_ni_free_disponible_bloquea(self, db_session, test_user):
        primero = Project(owner_id=test_user.id, odoo_version="15.0")
        segundo = Project(owner_id=test_user.id, odoo_version="15.0")
        db_session.add_all([primero, segundo])
        test_user.free_project_used = True
        db_session.commit()

        allowed, err = can_export_project(db_session, test_user, segundo)
        assert allowed is False


class TestTopeDeModuloEnProyectoGratis:
    def test_segundo_modulo_en_el_proyecto_gratis_se_rechaza(self, client):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]

        primero = _upload_module(client, project_id, "contactos", CONTACTOS_CSV)
        assert primero.status_code == 200

        segundo = _upload_module(client, project_id, "crm", CRM_CSV)
        assert segundo.status_code == 400
        assert "gratis" in segundo.json()["detail"].lower()

    def test_una_vez_pagado_no_aplica_el_tope_de_modulo_gratis(
        self, client, db_session, test_user
    ):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        _upload_module(client, project_id, "contactos", CONTACTOS_CSV)

        # simula que el usuario ya gastó su cuota gratis en OTRO proyecto
        # -- este ya no es "su primer proyecto elegible", así que no
        # debería aplicarle el tope de 1 módulo (el pago real de $99 se
        # cobra al exportar, no al subir módulos).
        test_user.free_project_used = True
        db_session.commit()

        segundo = _upload_module(client, project_id, "crm", CRM_CSV)
        # Igual se rechaza, porque este SIGUE siendo "su primer proyecto"
        # (count()==1) pero ya no es gratis-elegible por free_project_used
        # -- el tope de 1 módulo solo tiene sentido mientras el proyecto
        # sigue siendo candidato a gratis. Una vez que deja de serlo, el
        # usuario puede seguir agregando módulos libremente (paga recién
        # al exportar).
        assert segundo.status_code == 200


class TestDescargaIncrementaElContadorCorrecto:
    def test_exportar_el_proyecto_gratis_marca_free_project_used(
        self, client, db_session, test_user
    ):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")

        resp = client.get(f"/projects/{project_id}/download")
        assert resp.status_code == 200

        db_session.refresh(test_user)
        assert test_user.free_project_used is True
        assert test_user.monthly_export_count == 0  # no consumió cuota de suscripción

    def test_exportar_bajo_suscripcion_incrementa_el_contador_mensual(
        self, client, db_session, test_user
    ):
        primero = Project(owner_id=test_user.id, odoo_version="15.0")
        db_session.add(primero)
        test_user.free_project_used = True
        test_user.has_active_subscription = True
        test_user.subscription_expires_at = datetime.utcnow() + timedelta(days=10)
        db_session.commit()

        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")

        resp = client.get(f"/projects/{project_id}/download")
        assert resp.status_code == 200

        db_session.refresh(test_user)
        assert test_user.monthly_export_count == 1

    def test_exportar_un_proyecto_ya_pagado_no_incrementa_ningun_contador(
        self, client, db_session, test_user
    ):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")

        project = db_session.query(Project).filter(Project.id == project_id).first()
        project.status = ProjectStatus.paid
        db_session.commit()

        resp = client.get(f"/projects/{project_id}/download")
        assert resp.status_code == 200

        db_session.refresh(test_user)
        assert test_user.free_project_used is False
        assert test_user.monthly_export_count == 0
