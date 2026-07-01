"""
Tests de regresión para `validation_engine.py`.

Cada test de este archivo corresponde a un bug real documentado en
CHANGELOG.md (sección "2026-06-29 — Sesión de bugfixing"). Si alguno de
estos tests falla, es porque se reintrodujo un bug que ya costó tiempo
diagnosticar -- leer el changelog antes de "arreglar" el test en vez del
código.
"""

import json

import pandas as pd
import pytest

from app.services.validation_engine import validate_dataframe, _to_native
from app.services.rules_loader import load_rule_schema
from app.services import format_rules


# ---------------------------------------------------------------------------
# Bug #2 (2026-06-29): numpy.int64 / numpy.float64 no son JSON-serializables,
# y current_value/suggested_fix se llenaban con el valor crudo de pandas.
# ---------------------------------------------------------------------------

class TestToNative:
    def test_numpy_int64_se_convierte_a_int_nativo(self):
        value = pd.array([10, 5, 7], dtype="int64")[0]
        assert type(value).__name__ == "int64"  # confirma que el input es numpy
        result = _to_native(value)
        assert isinstance(result, int)
        assert not isinstance(result, type(value))

    def test_numpy_float64_se_convierte_a_float_nativo(self):
        df = pd.DataFrame({"x": [1.5, -2.5]})
        value = df.at[1, "x"]
        result = _to_native(value)
        assert isinstance(result, float)

    def test_nan_se_convierte_a_none(self):
        assert _to_native(float("nan")) is None
        assert _to_native(pd.NA) is None

    def test_string_pasa_sin_cambios(self):
        assert _to_native("hola") == "hola"

    def test_none_pasa_sin_cambios(self):
        assert _to_native(None) is None


class TestSerializacionDeReporte:
    """Reproduce el bug: un archivo con un issue en una columna entera
    rompía la serialización JSON de la respuesta de la API."""

    def test_reporte_con_columna_entera_es_json_serializable(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "name": ["Juan Perez", "Empresa SA", "Otro"],
                "vat": ["20-12345678-9", "30-99999999-1", "30-99999999-1"],
                "credit_limit": pd.array([100, -50, 0], dtype="int64"),
            }
        )

        report = validate_dataframe(df, schema)
        report_dict = report.to_dict()

        # Esto es exactamente lo que rompía antes del fix: json.dumps()
        # lanzaba "Object of type int64 is not JSON serializable".
        serialized = json.dumps(report_dict)
        assert serialized  # no debe lanzar excepción

        for issue in report_dict["issues"]:
            assert type(issue["current_value"]) in (int, float, str, type(None))
            assert type(issue["suggested_fix"]) in (int, float, str, type(None))

    def test_duplicado_usa_tipos_nativos(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "name": ["A", "B", "C"],
                "vat": ["20-12345678-9", "20-12345678-9", "30-99999999-1"],
            }
        )
        report = validate_dataframe(df, schema)
        dup_issues = [i for i in report.issues if i.issue_type == "duplicate"]
        assert len(dup_issues) == 1
        assert isinstance(dup_issues[0].current_value, str)


# ---------------------------------------------------------------------------
# Bug #3 (2026-06-29): un archivo sin relación con el módulo elegido se
# marcaba "0 errores" en vez de avisar que no corresponde al módulo.
# ---------------------------------------------------------------------------

class TestMismatchEstructural:
    def test_archivo_completamente_ajeno_se_marca_como_mismatch(self):
        """El caso real reportado: un export de bot (columnas de intents/
        triggers de chatbot) subido como si fuera un archivo de Contactos."""
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "intent_name": ["greeting", "fallback", "goodbye"],
                "trigger_phrase": ["hola", "ayuda", "chau"],
                "response_text": ["hola!", "decime", "nos vemos"],
            }
        )

        report = validate_dataframe(df, schema)

        assert report.structural_mismatch is True
        assert report.matched_columns_count == 0
        # No debe decir "0 errores" como si el archivo fuera válido --
        # debe cortar antes de fingir que validó algo.
        assert report.total_issues == 0
        assert report.issues == []

    def test_archivo_legitimo_no_dispara_mismatch(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "name": ["Juan Perez", "Empresa SA"],
                "vat": ["20-12345678-9", "30-99999999-1"],
                "email": ["juan@x.com", "info@x.com"],
                "city": ["CABA", "Cordoba"],
            }
        )
        report = validate_dataframe(df, schema)
        assert report.structural_mismatch is False
        assert report.matched_columns_count == 4

    def test_pocas_columnas_coincidentes_tambien_dispara_mismatch(self):
        """Si solo 1 de 10 columnas matchea, sigue siendo más probable que
        sea el módulo equivocado que un archivo válido con muchas columnas
        extra que Odoo ignora."""
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "name": ["Juan Perez"],  # la única que matchea
                "col_a": ["x"], "col_b": ["x"], "col_c": ["x"], "col_d": ["x"],
                "col_e": ["x"], "col_f": ["x"], "col_g": ["x"], "col_h": ["x"],
                "col_i": ["x"],
            }
        )
        report = validate_dataframe(df, schema)
        assert report.structural_mismatch is True


# ---------------------------------------------------------------------------
# Comportamiento normal -- estos tests NO son sobre bugs, son la red de
# seguridad para que los fixes de arriba no rompan el caso feliz.
# ---------------------------------------------------------------------------

class TestValidacionNormal:
    def test_archivo_limpio_no_genera_issues(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "name": ["Juan Perez", "Empresa SA"],
                "vat": ["20-12345678-9", "30-99999999-1"],
                "email": ["juan@x.com", "info@x.com"],
            }
        )
        report = validate_dataframe(df, schema)
        assert report.total_issues == 0
        assert report.structural_mismatch is False

    def test_email_invalido_se_detecta(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "name": ["Juan Perez"],
                "vat": ["20-12345678-9"],
                "email": ["esto-no-es-un-email"],
            }
        )
        report = validate_dataframe(df, schema)
        email_issues = [i for i in report.issues if i.column == "email"]
        assert len(email_issues) == 1
        assert email_issues[0].issue_type == "invalid_format"

    def test_columnas_requeridas_faltantes_se_reportan(self):
        # ventas.json sí tiene required fields reales (a diferencia de
        # contactos) -- ver bug #3 en el changelog sobre por qué no hay
        # que confiar ciegamente en required_fields() para todos los módulos.
        schema = load_rule_schema("ventas", "15.0")
        df = pd.DataFrame({"unrelated_col": ["x", "y"]})
        report = validate_dataframe(df, schema)
        # Si hay tan poca superposición de columnas, debería marcar mismatch
        # antes de llegar a columns_expected_missing.
        assert report.structural_mismatch is True

    def test_columna_requerida_presente_via_sinonimo_no_se_reporta_como_faltante(self):
        """Reproduce un bug real reportado en producción: el reporte decía
        'faltan columnas obligatorias: name' aunque el archivo SÍ traía esa
        info bajo el header en español 'Nombre', que el matching de
        sinónimos reconoce perfectamente. Causa: columns_expected_missing
        comparaba contra columns_seen (headers crudos) en vez de contra los
        campos técnicos ya mapeados (column_mapping.values())."""
        schema = load_rule_schema("ventas", "15.0")
        df = pd.DataFrame(
            {
                "Nombre": ["Pedido 001", "Pedido 002"],
                "date_order": ["2024-01-01", "2024-01-02"],
                "partner_id": ["Juan Perez", "Maria Gomez"],
                "partner_invoice_id": ["Juan Perez", "Maria Gomez"],
                "partner_shipping_id": ["Juan Perez", "Maria Gomez"],
                "pricelist_id": ["Lista 1", "Lista 1"],
                "company_id": ["Mi Empresa", "Mi Empresa"],
            }
        )
        report = validate_dataframe(df, schema)
        assert "name" not in report.columns_expected_missing


class TestMissingContactInfo:
    """email/phone no son `required` en el schema de Odoo (la falta de
    ambos no rompe la importación), pero un contacto sin ninguno de los
    dos es inútil en la práctica -- se avisa sin bloquear la exportación."""

    def test_fila_sin_email_ni_telefono_genera_aviso_no_bloqueante(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "name": ["Juan Perez", "Maria Gomez"],
                "email": ["juan@x.com", ""],
                "phone": ["", ""],
            }
        )
        report = validate_dataframe(df, schema)
        contact_issues = [i for i in report.issues if i.issue_type == "missing_contact_info"]
        assert len(contact_issues) == 1
        assert contact_issues[0].row_index == 1
        assert contact_issues[0].fix_is_automatic is False

    def test_fila_con_solo_telefono_no_genera_aviso(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "name": ["Juan Perez"],
                "email": [""],
                "phone": ["11-1234-5678"],
            }
        )
        report = validate_dataframe(df, schema)
        assert not any(i.issue_type == "missing_contact_info" for i in report.issues)


# ---------------------------------------------------------------------------
# fix_explanation: explica en español qué hace un fix (automático o
# manual-con-sugerencia) antes de que el usuario lo aplique en el reporte.
# ---------------------------------------------------------------------------

class TestFixExplanation:
    def test_telefono_normalizable_trae_explicacion(self):
        issue = format_rules.check("mobile", "char", "(011) 1234-5678")
        assert issue is not None
        assert issue.fix_is_automatic is True
        assert issue.fix_explanation is not None
        assert "dígitos" in issue.fix_explanation

    def test_precio_negativo_trae_explicacion(self):
        issue = format_rules.check("list_price", "float", -50)
        assert issue is not None
        assert issue.issue_type == "negative_value"
        assert issue.fix_explanation is not None
        assert "valor absoluto" in issue.fix_explanation

    def test_stock_negativo_trae_explicacion(self):
        issue = format_rules.check("quantity", "float", -3)
        assert issue is not None
        assert issue.issue_type == "negative_value"
        assert issue.fix_explanation is not None
        assert "piso" in issue.fix_explanation

    def test_sin_fix_no_trae_explicacion(self):
        issue = format_rules.check("email", "char", "esto-no-es-un-email")
        assert issue is not None
        assert issue.suggested_fix is None
        assert issue.fix_explanation is None

    def test_fix_explanation_se_propaga_al_reporte_serializado(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame(
            {
                "name": ["Juan Perez"],
                "vat": ["20-12345678-9"],
                "mobile": ["(011) 1234-5678"],
            }
        )
        report = validate_dataframe(df, schema)
        report_dict = report.to_dict()
        mobile_issues = [i for i in report_dict["issues"] if i["column"] == "mobile"]
        assert len(mobile_issues) == 1
        assert mobile_issues[0]["fix_is_automatic"] is True
        assert mobile_issues[0]["fix_explanation"] is not None


# ---------------------------------------------------------------------------
# on_progress: callback de progreso para la Fase 4 (validación async +
# polling desde el frontend) -- ver _run_validation_job() en
# app/api/projects.py.
# ---------------------------------------------------------------------------

class TestOnProgressCallback:
    def test_se_llama_con_pares_crecientes_y_termina_en_total(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        n = 1200  # > 500, para forzar más de un llamado con el step mínimo
        df = pd.DataFrame(
            {
                "name": [f"Persona {i}" for i in range(n)],
                "vat": ["20-12345678-9"] * n,
                "email": ["ok@x.com"] * n,
            }
        )
        calls = []
        validate_dataframe(df, schema, on_progress=lambda done, total: calls.append((done, total)))

        assert len(calls) >= 2
        assert all(calls[i][0] < calls[i + 1][0] for i in range(len(calls) - 1))
        assert calls[-1] == (n, n)

    def test_sin_callback_no_rompe_nada(self):
        schema = load_rule_schema("contactos", "15.0", "ar")
        df = pd.DataFrame({"name": ["Juan"], "vat": ["20-12345678-9"], "email": ["ok@x.com"]})
        report = validate_dataframe(df, schema)  # sin on_progress
        assert report.total_rows == 1
