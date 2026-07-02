"""
Tests de integración end-to-end del Data Enrichment Engine: el reporte
de validación expone las oportunidades detectadas, el endpoint
apply-enrichment las confirma, el archivo corregido las aplica, y el
ZIP final incluye el log de auditoría -- todo sin tocar el
quality_score ni ningún dato de negocio existente.
"""

import io
import json
import zipfile

CONTACTOS_CSV = "name,vat,email\nJuan Perez,20-12345678-9,juan@x.com\n"


def _upload_module(client, project_id, odoo_module, csv_content, filename="archivo.csv"):
    return client.post(
        f"/projects/{project_id}/modules",
        data={"odoo_module": odoo_module},
        files={"file": (filename, io.BytesIO(csv_content.encode()), "text/csv")},
    )


class TestReporteExponeOportunidades:
    def test_reporte_incluye_oportunidad_de_external_id(self, client):
        """CONTACTOS_CSV no trae columna "id"/External ID -- el reporte
        tiene que proponer generarlo, sin haber tocado nada todavía."""
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")

        report = client.get(
            f"/projects/{project_id}/modules/{module['module_id']}/report"
        ).json()

        ext_id_opp = next(
            o for o in report["enrichment_opportunities"] if o["field"] == "external_id"
        )
        assert ext_id_opp["rows_affected"] == 1
        # No modifica nada por sí solo -- el quality_score sigue como si
        # el enriquecimiento no existiera.
        assert report["quality_score"] == 100


class TestApplyEnrichmentEndpoint:
    def test_confirmar_un_campo_desconocido_da_400(self, client, db_session, test_user):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")

        resp = client.post(
            f"/projects/{project_id}/modules/{module['module_id']}/apply-enrichment",
            json={"fields": ["campo_inventado"]},
        )
        assert resp.status_code == 400

    def test_requiere_que_el_modulo_ya_este_validado(self, client):
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()

        resp = client.post(
            f"/projects/{project_id}/modules/{module['module_id']}/apply-enrichment",
            json={"fields": ["external_id"]},
        )
        assert resp.status_code == 404


class TestDescargaConEnriquecimientoConfirmado:
    def test_sin_confirmar_nada_el_corregido_no_tiene_external_id(
        self, client, db_session, test_user
    ):
        from app.models.db_models import Project, ProjectStatus

        test_user.free_project_used = True
        db_session.commit()
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        project = db_session.query(Project).filter(Project.id == project_id).first()
        project.status = ProjectStatus.paid
        db_session.commit()

        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")

        resp = client.get(f"/projects/{project_id}/download")
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        contenido = zf.read("01_contactos_corregido.csv").decode()
        assert "omi_import" not in contenido
        # sin confirmar enriquecimiento, no debería haber ni log de auditoría
        assert not any(n.endswith("_enriquecimiento.json") for n in zf.namelist())

    def test_confirmar_external_id_lo_agrega_al_corregido_y_al_log_de_auditoria(
        self, client, db_session, test_user
    ):
        from app.models.db_models import Project, ProjectStatus

        test_user.free_project_used = True
        db_session.commit()
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        project = db_session.query(Project).filter(Project.id == project_id).first()
        project.status = ProjectStatus.paid
        db_session.commit()

        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")

        confirm = client.post(
            f"/projects/{project_id}/modules/{module['module_id']}/apply-enrichment",
            json={"fields": ["external_id"]},
        )
        assert confirm.status_code == 200

        resp = client.get(f"/projects/{project_id}/download")
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        contenido = zf.read("01_contactos_corregido.csv").decode()
        assert "omi_import.contactos_000001" in contenido
        # el nombre/vat/email originales siguen intactos, nada se alteró
        assert "Juan Perez" in contenido
        assert "20-12345678-9" in contenido

        audit_name = "01_contactos_enriquecimiento.json"
        assert audit_name in zf.namelist()
        audit_log = json.loads(zf.read(audit_name))
        assert audit_log == [{
            "row_index": 0, "field": "external_id",
            "generated_value": "omi_import.contactos_000001",
            "algorithm": "Secuencial determinístico: omi_import.<modulo>_NNNNNN por fila",
        }]

    def test_reconfirmar_sin_campos_invalida_el_enriquecimiento_previo(
        self, client, db_session, test_user
    ):
        """Mismo patrón de invalidación de cache que apply-fixes: si el
        usuario confirma enriquecimiento, descarga, y DESPUÉS decide
        que no quiere más el external_id generado, la próxima descarga
        tiene que reflejar eso -- no seguir sirviendo el corregido
        viejo con el external_id que ya no se quiere."""
        from app.models.db_models import Project, ProjectStatus

        test_user.free_project_used = True
        db_session.commit()
        project_id = client.post(
            "/projects", json={"odoo_version": "15.0", "odoo_country": "ar"}
        ).json()["project_id"]
        project = db_session.query(Project).filter(Project.id == project_id).first()
        project.status = ProjectStatus.paid
        db_session.commit()

        module = _upload_module(client, project_id, "contactos", CONTACTOS_CSV).json()
        client.post(f"/projects/{project_id}/modules/{module['module_id']}/validate")
        client.post(
            f"/projects/{project_id}/modules/{module['module_id']}/apply-enrichment",
            json={"fields": ["external_id"]},
        )
        first_download = client.get(f"/projects/{project_id}/download")
        assert "omi_import" in zipfile.ZipFile(
            io.BytesIO(first_download.content)
        ).read("01_contactos_corregido.csv").decode()

        project.status = ProjectStatus.paid  # la 1ra descarga lo pasó a "exported"
        db_session.commit()

        client.post(
            f"/projects/{project_id}/modules/{module['module_id']}/apply-enrichment",
            json={"fields": []},
        )
        second_download = client.get(f"/projects/{project_id}/download")
        zf2 = zipfile.ZipFile(io.BytesIO(second_download.content))
        assert "omi_import" not in zf2.read("01_contactos_corregido.csv").decode()
        assert not any(n.endswith("_enriquecimiento.json") for n in zf2.namelist())
