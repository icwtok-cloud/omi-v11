"""
Tests unitarios del Data Enrichment Engine (etapa nueva e independiente
del pipeline, ver app/services/enrichment_engine.py). Cubre: los
generadores son determinísticos y reproducibles, la detección de
oportunidades no modifica nada, y apply_enrichment solo toca los campos
que el usuario aceptó explícitamente -- nunca inventa datos de negocio.
"""

import pandas as pd

from app.services.enrichment_engine import (
    generate_default_code,
    generate_external_id,
    detect_enrichment_opportunities,
    apply_enrichment,
)


class TestGeneradoresDeterministicos:
    def test_default_code_es_reproducible(self):
        assert generate_default_code("productos", 0) == generate_default_code("productos", 0)
        assert generate_default_code("productos", 0) == "OMI-PRODUCTOS-000001"
        assert generate_default_code("productos", 41) == "OMI-PRODUCTOS-000042"

    def test_external_id_es_reproducible(self):
        assert generate_external_id("contactos", 0) == generate_external_id("contactos", 0)
        assert generate_external_id("contactos", 0) == "omi_import.contactos_000001"

    def test_valores_distintos_para_filas_distintas(self):
        assert generate_default_code("productos", 0) != generate_default_code("productos", 1)


class TestDeteccionDeOportunidades:
    def test_detecta_default_code_faltante_si_el_modelo_lo_tiene(self):
        fields_by_name = {"name": {"name": "name"}, "default_code": {"name": "default_code"}}
        df = pd.DataFrame({"name": ["A", "B"], "codigo": [None, ""]})
        column_mapping = {"name": "name", "codigo": "default_code"}
        opportunities = detect_enrichment_opportunities(
            fields_by_name, column_mapping, list(df.columns), df,
        )
        default_code_opp = next(o for o in opportunities if o.field == "default_code")
        assert default_code_opp.rows_affected == 2

    def test_no_detecta_default_code_si_el_modelo_no_lo_tiene(self):
        """Ej. contactos (res.partner) no tiene default_code -- no debe
        proponerse algo que Odoo ni siquiera acepta para ese modelo."""
        fields_by_name = {"name": {"name": "name"}, "email": {"name": "email"}}
        df = pd.DataFrame({"name": ["A"], "email": ["a@x.com"]})
        opportunities = detect_enrichment_opportunities(
            fields_by_name, {"name": "name", "email": "email"}, list(df.columns), df,
        )
        assert not any(o.field == "default_code" for o in opportunities)

    def test_detecta_external_id_faltante(self):
        fields_by_name = {"name": {"name": "name"}}
        df = pd.DataFrame({"name": ["A", "B", "C"]})
        opportunities = detect_enrichment_opportunities(
            fields_by_name, {"name": "name"}, list(df.columns), df,
        )
        ext_id_opp = next(o for o in opportunities if o.field == "external_id")
        assert ext_id_opp.rows_affected == 3

    def test_no_detecta_external_id_si_ya_existe_la_columna(self):
        fields_by_name = {"name": {"name": "name"}}
        df = pd.DataFrame({"name": ["A"], "id": ["ext_1"]})
        opportunities = detect_enrichment_opportunities(
            fields_by_name, {"name": "name"}, list(df.columns), df,
        )
        assert not any(o.field == "external_id" for o in opportunities)

    def test_no_detecta_nada_si_no_falta_nada(self):
        fields_by_name = {"name": {"name": "name"}, "default_code": {"name": "default_code"}}
        df = pd.DataFrame({"name": ["A"], "codigo": ["ABC-1"], "id": ["ext_1"]})
        opportunities = detect_enrichment_opportunities(
            fields_by_name, {"name": "name", "codigo": "default_code"}, list(df.columns), df,
        )
        assert opportunities == []


class TestAplicarEnriquecimiento:
    def test_no_aplica_nada_si_no_se_acepta_ningun_campo(self):
        df = pd.DataFrame({"name": ["A", "B"], "default_code": [None, None]})
        enriched, audit_log = apply_enrichment(df, "productos", accepted_fields=set())
        assert audit_log == []
        assert enriched["default_code"].isna().all()

    def test_genera_default_code_solo_en_filas_vacias(self):
        df = pd.DataFrame({"name": ["A", "B"], "default_code": ["YA-EXISTE", None]})
        enriched, audit_log = apply_enrichment(df, "productos", accepted_fields={"default_code"})
        assert enriched.at[0, "default_code"] == "YA-EXISTE"  # no toca lo que ya existía
        assert enriched.at[1, "default_code"] == "OMI-PRODUCTOS-000002"
        assert len(audit_log) == 1
        assert audit_log[0] == {
            "row_index": 1, "field": "default_code",
            "generated_value": "OMI-PRODUCTOS-000002",
            "algorithm": "Secuencial determinístico: OMI-<MODULO>-NNNNNN por fila",
        }

    def test_genera_columna_external_id_completa_si_no_existia(self):
        df = pd.DataFrame({"name": ["A", "B"]})
        enriched, audit_log = apply_enrichment(df, "contactos", accepted_fields={"external_id"})
        assert list(enriched["id"]) == ["omi_import.contactos_000001", "omi_import.contactos_000002"]
        assert len(audit_log) == 2

    def test_columna_de_auditoria_refleja_que_se_genero_en_cada_fila(self):
        df = pd.DataFrame({"name": ["A", "B"], "default_code": [None, "YA-TENIA"]})
        enriched, _ = apply_enrichment(df, "productos", accepted_fields={"default_code"})
        assert enriched.at[0, "omi_generated_fields"] == "default_code"
        assert enriched.at[1, "omi_generated_fields"] == ""

    def test_nunca_toca_columnas_de_negocio(self):
        """Ninguna columna que no sea default_code/id/omi_generated_fields
        debe cambiar de valor -- el enriquecimiento nunca inventa
        precios, categorías, ni ningún otro dato de negocio."""
        df = pd.DataFrame({
            "name": ["A", "B"], "list_price": [100.0, 200.0],
            "categ_id": ["Categoria X", None], "default_code": [None, None],
        })
        enriched, _ = apply_enrichment(df, "productos", accepted_fields={"default_code"})
        assert list(enriched["list_price"]) == [100.0, 200.0]
        assert enriched.at[0, "categ_id"] == "Categoria X"
        assert pd.isna(enriched.at[1, "categ_id"])  # sigue vacío, no se inventó nada
