"""
Tests de la ronda de hardening operacional (observability/telemetry):
correlation ID por request, readiness check real (chequea la DB, no
solo "el proceso responde"), y que los eventos de negocio clave
efectivamente se logueen -- antes de esta ronda, `log_event` existía
pero no se llamaba desde NINGÚN lado del código.
"""

import io

from fastapi.testclient import TestClient

from app.main import app
import app.main as main_module
import app.api.projects as projects_module

CONTACTOS_CSV = "name,vat,email\nJuan Perez,20-12345678-9,juan@x.com\n"


class TestHealthEndpoints:
    def test_health_devuelve_x_request_id(self):
        with TestClient(app) as c:
            resp = c.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
        assert "X-Request-ID" in resp.headers

    def test_health_incluye_nosniff(self):
        with TestClient(app) as c:
            resp = c.get("/health")
        assert resp.headers["X-Content-Type-Options"] == "nosniff"

    def test_dos_requests_tienen_request_ids_distintos(self):
        with TestClient(app) as c:
            r1 = c.get("/health")
            r2 = c.get("/health")
        assert r1.headers["X-Request-ID"] != r2.headers["X-Request-ID"]

    def test_readiness_ok_cuando_la_db_responde(self):
        with TestClient(app) as c:
            resp = c.get("/health/ready")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok", "database": "ok"}

    def test_readiness_503_cuando_la_db_no_responde(self, monkeypatch):
        class _BrokenSession:
            def execute(self, *a, **kw):
                raise RuntimeError("conexión rechazada")

            def close(self):
                pass

        monkeypatch.setattr(main_module, "SessionLocal", lambda: _BrokenSession())

        with TestClient(app) as c:
            resp = c.get("/health/ready")
        assert resp.status_code == 503
        assert resp.json()["status"] == "unavailable"


class TestTelemetryEvents:
    def test_crear_proyecto_loguea_project_created(self, client, monkeypatch):
        events = []
        monkeypatch.setattr(
            projects_module, "log_event", lambda event, **fields: events.append((event, fields))
        )

        client.post("/projects", json={"odoo_version": "15.0", "odoo_country": "ar"})

        assert any(e[0] == "ProjectCreated" for e in events)

    def test_subir_modulo_loguea_module_uploaded(self, client, monkeypatch):
        events = []
        monkeypatch.setattr(
            projects_module, "log_event", lambda event, **fields: events.append((event, fields))
        )

        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        client.post(
            f"/projects/{project_id}/modules",
            data={"odoo_module": "contactos"},
            files={"file": ("archivo.csv", io.BytesIO(CONTACTOS_CSV.encode()), "text/csv")},
        )

        upload_events = [e for e in events if e[0] == "ModuleUploaded"]
        assert len(upload_events) == 1
        assert upload_events[0][1]["is_reupload"] is False

    def test_validar_loguea_started_y_finished(self, client, monkeypatch):
        events = []
        monkeypatch.setattr(
            projects_module, "log_event", lambda event, **fields: events.append((event, fields))
        )

        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module_id = client.post(
            f"/projects/{project_id}/modules",
            data={"odoo_module": "contactos"},
            files={"file": ("archivo.csv", io.BytesIO(CONTACTOS_CSV.encode()), "text/csv")},
        ).json()["module_id"]
        client.post(f"/projects/{project_id}/modules/{module_id}/validate")

        event_names = [e[0] for e in events]
        assert "ValidationStarted" in event_names
        assert "ValidationFinished" in event_names
        finished = next(e for e in events if e[0] == "ValidationFinished")
        assert finished[1]["rows"] == 1
        assert "duration_ms" in finished[1]

    def test_iniciar_pago_loguea_payment_started(self, client, monkeypatch):
        import app.api.payments as payments_module

        events = []
        monkeypatch.setattr(
            payments_module, "log_event", lambda event, **fields: events.append((event, fields))
        )

        client.post(
            "/payments/start",
            json={"payment_type": "subscription", "network": "polygon"},
        )

        assert any(e[0] == "PaymentStarted" for e in events)
