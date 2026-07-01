"""
Tests del endpoint POST /projects/{id}/modules/{mid}/apply-fixes y de
cómo _ensure_corrected_file() usa confirmed_manual_fixes.

Corresponde al pendiente documentado en CHANGELOG.md, sección
"Fixes manuales: backend listo, frontend y DB pendientes" del
2026-06-30: el botón "Aplicar fix" en el frontend cambiaba solo estado
local de React sin persistir nada -- estos tests cubren que, una vez
persistido, el archivo final realmente contenga el valor corregido.

Actualizado para el modelo Project (contenedor) + ProjectModule (un
módulo con su archivo/reporte) -- ver CHANGELOG.md, sección del
rediseño de schema multi-módulo.
"""

import pandas as pd

from app.models.db_models import Project, ProjectModule, ModuleStatus
from app.api.projects import _ensure_corrected_file


def _make_project(db_session, owner_id, **overrides):
    project = Project(owner_id=owner_id, odoo_version="15.0", odoo_country="ar")
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _make_module(db_session, project, **overrides):
    defaults = dict(
        project_id=project.id,
        odoo_module="contactos",
        original_filename="contactos.csv",
        storage_path="/tmp/contactos.csv",
        status=ModuleStatus.validated,
    )
    defaults.update(overrides)
    module = ProjectModule(**defaults)
    db_session.add(module)
    db_session.commit()
    db_session.refresh(module)
    return module


class TestApplyFixesEndpoint:
    def test_guarda_fixes_confirmados_en_el_modulo(self, client, db_session, test_user):
        project = _make_project(db_session, test_user.id)
        module = _make_module(db_session, project, validation_report={"issues": []})

        resp = client.post(
            f"/projects/{project.id}/modules/{module.id}/apply-fixes",
            json=[{"row_index": 0, "column": "email"}],
        )

        assert resp.status_code == 200
        assert resp.json() == {"confirmed_count": 1}

        db_session.refresh(module)
        assert module.confirmed_manual_fixes == [{"row_index": 0, "column": "email"}]

    def test_requiere_que_el_modulo_ya_este_validado(self, client, db_session, test_user):
        project = _make_project(db_session, test_user.id)
        module = _make_module(
            db_session, project, status=ModuleStatus.uploaded, validation_report=None
        )

        resp = client.post(
            f"/projects/{project.id}/modules/{module.id}/apply-fixes",
            json=[{"row_index": 0, "column": "email"}],
        )

        assert resp.status_code == 404

    def test_no_se_puede_aplicar_fixes_a_proyecto_ajeno(self, client, db_session):
        otro_owner_id = "user_otro_999"
        project = _make_project(db_session, otro_owner_id)
        module = _make_module(db_session, project)

        resp = client.post(
            f"/projects/{project.id}/modules/{module.id}/apply-fixes",
            json=[{"row_index": 0, "column": "email"}],
        )

        assert resp.status_code == 403


class TestEnsureCorrectedFileAplicaManualFixes:
    """Va un nivel más abajo que el endpoint: confirma que el archivo CSV
    final realmente tenga el valor corregido, no solo que el booleano
    quedó guardado en la DB. Es el test que el changelog pedía como
    verificación E2E de que 'aplicar fix' no es decorativo."""

    def test_fix_manual_confirmado_se_aplica_al_csv_final(self, db_session, test_user, tmp_path):
        original = tmp_path / "contactos.csv"
        df = pd.DataFrame(
            {
                "name": ["Juan Perez"],
                "vat": ["20-12345678-9"],
                "email": ["esto-no-es-un-email"],
            }
        )
        df.to_csv(original, index=False)

        project = _make_project(db_session, test_user.id)
        module = _make_module(
            db_session,
            project,
            storage_path=str(original),
            validation_report={
                "issues": [
                    {
                        "row_index": 0,
                        "column": "email",
                        "issue_type": "invalid_format",
                        "message": "no parece un email válido",
                        "current_value": "esto-no-es-un-email",
                        "suggested_fix": "corregido@example.com",
                        "fix_is_automatic": False,
                    }
                ]
            },
            confirmed_manual_fixes=[{"row_index": 0, "column": "email"}],
        )

        corrected_path = _ensure_corrected_file(module, db_session)
        result_df = pd.read_csv(corrected_path)

        assert result_df.at[0, "email"] == "corregido@example.com"
        # El original YA NO se borra acá (ver CHANGELOG -- se borraba
        # antes, pero eso rompía la regeneración del corregido cuando
        # el usuario confirmaba nuevos fixes manuales después de la
        # primera descarga). Tiene que seguir existiendo para poder
        # regenerar el .corrected.csv si se invalida el cache.
        assert original.exists()

    def test_confirmar_un_nuevo_fix_invalida_el_corregido_ya_generado(
        self, client, db_session, test_user, tmp_path
    ):
        """Regresión P0: mismo bug de fondo que el de re-subir un
        archivo con el mismo nombre, pero disparado por el flujo de
        fixes manuales. Si el usuario ya descargó una vez (generando
        el .corrected.csv en disco) y DESPUÉS confirma un fix manual
        nuevo vía POST /apply-fixes, la próxima vez que se pida el
        corregido tiene que reflejar ese fix -- no servir en silencio
        el .csv que había quedado cacheado de la descarga anterior."""
        original = tmp_path / "contactos.csv"
        df = pd.DataFrame(
            {
                "name": ["Juan Perez"],
                "vat": ["20-12345678-9"],
                "email": ["esto-no-es-un-email"],
            }
        )
        df.to_csv(original, index=False)

        project = _make_project(db_session, test_user.id)
        module = _make_module(
            db_session,
            project,
            storage_path=str(original),
            validation_report={
                "issues": [
                    {
                        "row_index": 0,
                        "column": "email",
                        "issue_type": "invalid_format",
                        "message": "no parece un email válido",
                        "current_value": "esto-no-es-un-email",
                        "suggested_fix": "corregido@example.com",
                        "fix_is_automatic": False,
                    }
                ]
            },
            confirmed_manual_fixes=None,  # todavía no confirmó nada
        )

        # 1ra "descarga" -- sin fix confirmado, el email queda tal cual.
        first_corrected = _ensure_corrected_file(module, db_session)
        assert pd.read_csv(first_corrected).at[0, "email"] == "esto-no-es-un-email"

        # Confirma el fix manual DESPUÉS de que el .corrected.csv ya
        # existe en disco -- esto es lo que antes no invalidaba el cache.
        resp = client.post(
            f"/projects/{project.id}/modules/{module.id}/apply-fixes",
            json=[{"row_index": 0, "column": "email"}],
        )
        assert resp.status_code == 200

        db_session.refresh(module)
        second_corrected = _ensure_corrected_file(module, db_session)
        assert pd.read_csv(second_corrected).at[0, "email"] == "corregido@example.com"

    def test_fix_manual_no_confirmado_no_se_aplica(self, db_session, test_user, tmp_path):
        """Si el usuario marcó el fix en pantalla pero nunca llamó a
        apply-fixes (o el frontend rompió, como pasaba antes de este
        cambio), el valor original tiene que quedar intacto -- no hay
        que asumir que 'sugerido' significa 'confirmado'."""
        original = tmp_path / "contactos.csv"
        df = pd.DataFrame(
            {
                "name": ["Juan Perez"],
                "vat": ["20-12345678-9"],
                "email": ["esto-no-es-un-email"],
            }
        )
        df.to_csv(original, index=False)

        project = _make_project(db_session, test_user.id)
        module = _make_module(
            db_session,
            project,
            storage_path=str(original),
            validation_report={
                "issues": [
                    {
                        "row_index": 0,
                        "column": "email",
                        "issue_type": "invalid_format",
                        "message": "no parece un email válido",
                        "current_value": "esto-no-es-un-email",
                        "suggested_fix": "corregido@example.com",
                        "fix_is_automatic": False,
                    }
                ]
            },
            confirmed_manual_fixes=None,  # nunca se confirmó
        )

        corrected_path = _ensure_corrected_file(module, db_session)
        result_df = pd.read_csv(corrected_path)

        assert result_df.at[0, "email"] == "esto-no-es-un-email"

    def test_fix_automatico_se_aplica_sin_necesitar_confirmacion(
        self, db_session, test_user, tmp_path
    ):
        original = tmp_path / "contactos.csv"
        df = pd.DataFrame(
            {
                "name": ["  Juan Perez  "],
                "vat": ["20-12345678-9"],
                "email": ["juan@x.com"],
            }
        )
        df.to_csv(original, index=False)

        project = _make_project(db_session, test_user.id)
        module = _make_module(
            db_session,
            project,
            storage_path=str(original),
            validation_report={
                "issues": [
                    {
                        "row_index": 0,
                        "column": "name",
                        "issue_type": "invalid_format",
                        "message": "espacios extra",
                        "current_value": "  Juan Perez  ",
                        "suggested_fix": "Juan Perez",
                        "fix_is_automatic": True,
                    }
                ]
            },
            confirmed_manual_fixes=None,
        )

        corrected_path = _ensure_corrected_file(module, db_session)
        result_df = pd.read_csv(corrected_path)

        assert result_df.at[0, "name"] == "Juan Perez"
