"""
Tests del endpoint POST /projects/{id}/apply-fixes y de cómo
_ensure_corrected_file() usa confirmed_manual_fixes.

Corresponde al pendiente documentado en CHANGELOG.md, sección
"Fixes manuales: backend listo, frontend y DB pendientes" del
2026-06-30: el botón "Aplicar fix" en el frontend cambiaba solo estado
local de React sin persistir nada -- estos tests cubren que, una vez
persistido, el archivo final realmente contenga el valor corregido.
"""

import pandas as pd

from app.models.db_models import Project, ProjectStatus
from app.api.projects import _ensure_corrected_file


def _make_project(db_session, owner_id, **overrides):
    defaults = dict(
        owner_id=owner_id,
        odoo_module="contactos",
        odoo_version="15.0",
        odoo_country="ar",
        original_filename="contactos.csv",
        storage_path="/tmp/contactos.csv",
        status=ProjectStatus.validated,
    )
    defaults.update(overrides)
    project = Project(**defaults)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


class TestApplyFixesEndpoint:
    def test_guarda_fixes_confirmados_en_el_proyecto(self, client, db_session, test_user):
        project = _make_project(
            db_session, test_user.id, validation_report={"issues": []}
        )

        resp = client.post(
            f"/projects/{project.id}/apply-fixes",
            json=[{"row_index": 0, "column": "email"}],
        )

        assert resp.status_code == 200
        assert resp.json() == {"confirmed_count": 1}

        db_session.refresh(project)
        assert project.confirmed_manual_fixes == [{"row_index": 0, "column": "email"}]

    def test_requiere_que_el_proyecto_ya_este_validado(self, client, db_session, test_user):
        project = _make_project(
            db_session, test_user.id, status=ProjectStatus.uploaded, validation_report=None
        )

        resp = client.post(
            f"/projects/{project.id}/apply-fixes",
            json=[{"row_index": 0, "column": "email"}],
        )

        assert resp.status_code == 404

    def test_no_se_puede_aplicar_fixes_a_proyecto_ajeno(self, client, db_session):
        otro_owner_id = "user_otro_999"
        project = _make_project(db_session, otro_owner_id)

        resp = client.post(
            f"/projects/{project.id}/apply-fixes",
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

        project = _make_project(
            db_session,
            test_user.id,
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

        corrected_path = _ensure_corrected_file(project, db_session)
        result_df = pd.read_csv(corrected_path)

        assert result_df.at[0, "email"] == "corregido@example.com"
        # zero-retention: el original tiene que haberse borrado
        assert not original.exists()

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

        project = _make_project(
            db_session,
            test_user.id,
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

        corrected_path = _ensure_corrected_file(project, db_session)
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

        project = _make_project(
            db_session,
            test_user.id,
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

        corrected_path = _ensure_corrected_file(project, db_session)
        result_df = pd.read_csv(corrected_path)

        assert result_df.at[0, "name"] == "Juan Perez"
