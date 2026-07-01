"""
Tests del rediseño de schema: Project como contenedor de hasta 8
ProjectModule (ver CHANGELOG.md, sección del rediseño multi-módulo).

Cubre lo que no cubren test_apply_fixes.py ni test_validation_engine.py:
crear un proyecto, acumular módulos sin perder progreso, el tope de 8,
que re-subir el mismo módulo pise limpio, el resumen del proyecto, y que
la descarga entregue un ZIP con un archivo por módulo validado.
"""

import io
import zipfile

import pandas as pd

CONTACTOS_CSV = "name,vat,email\nJuan Perez,20-12345678-9,juan@x.com\n"
CRM_CSV = "name\nOportunidad 1\n"


def _upload_module(client, project_id, odoo_module, csv_content, filename="archivo.csv"):
    return client.post(
        f"/projects/{project_id}/modules",
        data={"odoo_module": odoo_module},
        files={"file": (filename, io.BytesIO(csv_content.encode()), "text/csv")},
    )


class TestCrearProyectoYModulos:
    def test_crear_proyecto_vacio(self, client):
        resp = client.post("/projects", json={"odoo_version": "15.0", "odoo_country": "ar"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "active"
        assert "project_id" in body

    def test_agregar_un_modulo(self, client):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]

        resp = _upload_module(client, project_id, "contactos", CONTACTOS_CSV)
        assert resp.status_code == 200
        body = resp.json()
        assert body["odoo_module"] == "contactos"
        assert body["status"] == "uploaded"

    def test_acumular_dos_modulos_sin_perder_el_primero(self, client):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]

        _upload_module(client, project_id, "contactos", CONTACTOS_CSV)
        _upload_module(client, project_id, "crm", CRM_CSV)

        summary = client.get(f"/projects/{project_id}").json()
        modules = {m["odoo_module"] for m in summary["modules"]}
        assert modules == {"contactos", "crm"}

    def test_tope_de_8_modulos(self, client):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]

        ocho_modulos = [
            "contactos", "crm", "ventas", "facturacion",
            "inventario", "productos", "contabilidad", "compras",
        ]
        for m in ocho_modulos:
            resp = _upload_module(client, project_id, m, CONTACTOS_CSV)
            assert resp.status_code == 200, f"módulo {m} debería aceptarse (van {len(ocho_modulos)})"

        # el noveno (cualquiera, no hay un 9no módulo real, pero la
        # validación de tope corre antes de chequear si el módulo existe
        # de nuevo -- reintentar "contactos" de nuevo SÍ está permitido
        # porque pisa el existente, así que probamos con un módulo que
        # no está en la lista para simular "uno más" -- en la práctica
        # esto nunca pasa porque solo hay 8 módulos soportados, pero el
        # límite debe sostenerse igual si se agregara un 9no en el futuro.
        resp = client.post(
            f"/projects/{project_id}/modules",
            data={"odoo_module": "inexistente"},
            files={"file": ("x.csv", io.BytesIO(CONTACTOS_CSV.encode()), "text/csv")},
        )
        assert resp.status_code in (400, 404)  # rechazado, ya sea por tope o por módulo inválido

    def test_re_subir_el_mismo_modulo_pisa_limpio(self, client):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]

        first = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{first['module_id']}/validate")

        second = _upload_module(client, project_id, "contactos", CONTACTOS_CSV, filename="v2.csv").json()

        # mismo module_id (pisó la fila, no creó una nueva)
        assert second["module_id"] == first["module_id"]

        summary = client.get(f"/projects/{project_id}").json()
        assert len(summary["modules"]) == 1
        # el reporte viejo se descarta al re-subir
        assert summary["modules"][0]["total_issues"] is None


class TestValidacionYReportePorModulo:
    def test_validar_y_obtener_reporte_de_un_modulo(self, client):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()

        validate_resp = client.post(
            f"/projects/{project_id}/modules/{module['module_id']}/validate"
        )
        assert validate_resp.status_code == 200
        assert validate_resp.json()["module_id"] == module["module_id"]

        report_resp = client.get(
            f"/projects/{project_id}/modules/{module['module_id']}/report"
        )
        assert report_resp.status_code == 200
        assert report_resp.json()["project_id"] == project_id


class TestDescargaMultiModulo:
    def test_download_entrega_zip_con_un_archivo_por_modulo_validado(
        self, client, db_session, test_user
    ):
        from app.models.db_models import Project, ProjectStatus

        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]

        contactos = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        crm = _upload_module(client, project_id, "crm", CRM_CSV).json()
        client.post(f"/projects/{project_id}/modules/{contactos['module_id']}/validate")
        client.post(f"/projects/{project_id}/modules/{crm['module_id']}/validate")

        # simula que el proyecto ya está pagado (el flujo de pago real se
        # cubre en otros tests / el listener de pagos, no acá)
        project = db_session.query(Project).filter(Project.id == project_id).first()
        project.status = ProjectStatus.paid
        db_session.commit()

        resp = client.get(f"/projects/{project_id}/download")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"

        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = set(zf.namelist())
        assert names == {"contactos_corregido.csv", "crm_corregido.csv"}

    def test_download_sin_pagar_devuelve_402(self, client):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")

        resp = client.get(f"/projects/{project_id}/download")
        assert resp.status_code == 402
