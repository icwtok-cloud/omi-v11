"""
Tests de la Fase 4 del roadmap: validación asíncrona con progreso real
(POST /validate dispara un background task y devuelve 202 de inmediato,
GET /validate-status expone rows_processed/rows_total/status/error).

Nota: con FastAPI TestClient, los BackgroundTasks corren dentro del
mismo ciclo de la request (el ASGI transport espera a que terminen
antes de devolver la response al test) -- así que para estos tests el
job ya terminó cuando `client.post(.../validate)` retorna. Eso alcanza
para probar la forma correcta del contrato (202 + status final vía
validate-status), aunque no ejercita la latencia real de un archivo
grande.
"""

import io

CONTACTOS_CSV = "name,vat,email\nJuan Perez,20-12345678-9,juan@x.com\n"


def _create_module(client, project_id="__auto__"):
    if project_id == "__auto__":
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
    module = client.post(
        f"/projects/{project_id}/modules",
        data={"odoo_module": "contactos"},
        files={"file": ("archivo.csv", io.BytesIO(CONTACTOS_CSV.encode()), "text/csv")},
    ).json()
    return project_id, module["module_id"]


class TestValidateAsync:
    def test_validate_devuelve_202_de_inmediato(self, client):
        project_id, module_id = _create_module(client)

        resp = client.post(f"/projects/{project_id}/modules/{module_id}/validate")

        assert resp.status_code == 202
        body = resp.json()
        assert body["project_id"] == project_id
        assert body["module_id"] == module_id

    def test_validate_status_refleja_validated_con_rows_completos(self, client):
        project_id, module_id = _create_module(client)
        client.post(f"/projects/{project_id}/modules/{module_id}/validate")

        status = client.get(
            f"/projects/{project_id}/modules/{module_id}/validate-status"
        ).json()

        assert status["status"] == "validated"
        assert status["rows_processed"] == status["rows_total"] == 1
        assert status["error"] is None
        assert status["started_at"] is not None

    def test_path_de_excepcion_deja_status_failed_con_mensaje(self, client, db_session):
        import os
        from app.models.db_models import ProjectModule

        project_id, module_id = _create_module(client)

        # Forzamos la excepción borrando el archivo del disco antes de
        # validar -- _read_tabular_file va a fallar al intentar abrirlo.
        module = (
            db_session.query(ProjectModule).filter(ProjectModule.id == module_id).first()
        )
        os.remove(module.storage_path)

        client.post(f"/projects/{project_id}/modules/{module_id}/validate")

        # El endpoint de validate (que también corre sobre db_session,
        # vía el mismo override de get_db) ya dejó cacheada en el
        # identity map de db_session una versión con status="validating"
        # -- sin expirarla acá, la próxima query por esta misma sesión
        # devuelve ese objeto cacheado en vez de releer lo que el
        # background job (con SU PROPIA sesión) commiteó después. En
        # producción esto no aplica: cada request abre su propia sesión,
        # sin identity map compartido entre el endpoint y el job.
        db_session.expire_all()

        status = client.get(
            f"/projects/{project_id}/modules/{module_id}/validate-status"
        ).json()

        assert status["status"] == "failed"
        assert status["error"] is not None

    def test_validating_atascado_pasado_el_timeout_se_marca_failed(
        self, client, db_session
    ):
        """Regresión P1: si el proceso muere (deploy, OOM) mientras un
        módulo está 'validating', antes quedaba trabado ahí para
        siempre -- el usuario solo veía un spinner infinito, sin señal
        de error ni indicación de que podía reintentar. Simula ese
        estado (started_at viejo) y confirma que el polling lo detecta
        y lo pasa a failed con un mensaje claro."""
        from datetime import datetime, timedelta
        from app.models.db_models import ProjectModule, ModuleStatus

        project_id, module_id = _create_module(client)

        module = (
            db_session.query(ProjectModule).filter(ProjectModule.id == module_id).first()
        )
        module.status = ModuleStatus.validating
        module.validation_started_at = datetime.utcnow() - timedelta(minutes=30)
        db_session.commit()

        status = client.get(
            f"/projects/{project_id}/modules/{module_id}/validate-status"
        ).json()

        assert status["status"] == "failed"
        assert "reinicio" in status["error"] or "tiempo" in status["error"]

    def test_validating_reciente_no_se_marca_failed(self, client, db_session):
        """No hay que ser agresivo con el timeout -- una validación
        recién arrancada (o un archivo grande que legítimamente tarda)
        no debe marcarse como fallida antes de tiempo."""
        from datetime import datetime, timedelta
        from app.models.db_models import ProjectModule, ModuleStatus

        project_id, module_id = _create_module(client)

        module = (
            db_session.query(ProjectModule).filter(ProjectModule.id == module_id).first()
        )
        module.status = ModuleStatus.validating
        module.validation_started_at = datetime.utcnow() - timedelta(minutes=2)
        db_session.commit()

        status = client.get(
            f"/projects/{project_id}/modules/{module_id}/validate-status"
        ).json()

        assert status["status"] == "validating"
