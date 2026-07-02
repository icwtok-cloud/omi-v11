"""
Data Enrichment Engine -- etapa NUEVA e independiente del pipeline,
después de Validation y antes de Report/Export.

Principio innegociable (igual que el resto de OMI): nunca inventar
información de NEGOCIO. Sí generar información TÉCNICA -- identificadores
internos que Odoo necesita para importar prolijo, pero que no representan
ninguna afirmación sobre el negocio del cliente (a diferencia de un
impuesto, una categoría, un proveedor o un precio, que sí lo son y nunca
se tocan acá).

Todo lo que este módulo genera es:
  - determinístico: mismo archivo, mismo row_index -> mismo valor siempre
    (nunca random.random()/uuid4, que no son reproducibles entre corridas).
  - único y estable dentro del archivo (secuencial por row_index).
  - auditable: cada valor generado queda en un log explícito
    (row_index, field, valor generado, algoritmo usado), y en el archivo
    exportado se agrega una columna `omi_generated_fields` que dice qué
    se tocó en cada fila -- nunca se mezcla en silencio con datos
    originales del cliente.
  - 100% opt-in: nada de esto se aplica solo. El usuario tiene que
    confirmarlo explícitamente (ver POST .../apply-enrichment en
    projects.py), igual que ya pasa con los fixes manuales.

Registro modular: agregar un enriquecimiento nuevo en el futuro es
agregar una entrada a `ENRICHMENT_RULES`, sin tocar el parser ni el
validation engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import pandas as pd

from app.services.column_matcher import has_external_id_column

# Nombre del header que Odoo reconoce como External ID en un import --
# ver has_external_id_column() en column_matcher.py.
EXTERNAL_ID_HEADER = "id"


def generate_default_code(odoo_module: str, row_index: int) -> str:
    """SKU/código interno técnico -- secuencial y determinístico. Nunca
    se genera un código que "parezca" un SKU real de negocio (no
    inventa marca, categoría, ni ningún dato del producto) -- el
    prefijo OMI- lo deja visualmente identificable como generado."""
    return f"OMI-{odoo_module.upper()}-{row_index + 1:06d}"


def generate_external_id(odoo_module: str, row_index: int) -> str:
    """External ID técnico en el formato `modulo.nombre` que Odoo espera
    para imports (ver documentación de /base_import). El namespace
    `omi_import` deja claro que es sintético, generado por esta
    herramienta -- no un ID real de ningún sistema de origen."""
    return f"omi_import.{odoo_module}_{row_index + 1:06d}"


@dataclass
class EnrichmentRule:
    field_name: str                              # "default_code" | "external_id"
    odoo_header: str                              # columna real a escribir en el archivo
    label: str                                     # texto para mostrar al usuario
    generator: Callable[[str, int], str]
    algorithm_description: str


ENRICHMENT_RULES: dict[str, EnrichmentRule] = {
    "default_code": EnrichmentRule(
        field_name="default_code",
        odoo_header="default_code",
        label="Código interno (SKU)",
        generator=generate_default_code,
        algorithm_description="Secuencial determinístico: OMI-<MODULO>-NNNNNN por fila",
    ),
    "external_id": EnrichmentRule(
        field_name="external_id",
        odoo_header=EXTERNAL_ID_HEADER,
        label="External ID",
        generator=generate_external_id,
        algorithm_description="Secuencial determinístico: omi_import.<modulo>_NNNNNN por fila",
    ),
}


@dataclass
class EnrichmentOpportunity:
    field: str
    label: str
    rows_affected: int
    algorithm: str

    def to_dict(self) -> dict:
        return {
            "field": self.field, "label": self.label,
            "rows_affected": self.rows_affected, "algorithm": self.algorithm,
        }


def detect_enrichment_opportunities(
    fields_by_name: dict, column_mapping: dict[str, str], columns_seen: list[str], df: pd.DataFrame,
) -> list[EnrichmentOpportunity]:
    """Detecta, sin modificar nada, qué campos técnicos podrían
    generarse para este archivo. Puramente informativo -- no toca el
    quality_score ni se mezcla con los `issues` de Validation (etapa
    separada a propósito, ver docstring del módulo)."""
    opportunities: list[EnrichmentOpportunity] = []

    if "default_code" in fields_by_name:
        mapped_col = next((col for col, f in column_mapping.items() if f == "default_code"), None)
        if mapped_col is None:
            rows_affected = len(df)
        else:
            rows_affected = int(df[mapped_col].isna().sum() + (df[mapped_col].astype(str).str.strip() == "").sum())
        if rows_affected > 0:
            rule = ENRICHMENT_RULES["default_code"]
            opportunities.append(EnrichmentOpportunity(
                field="default_code", label=rule.label,
                rows_affected=rows_affected, algorithm=rule.algorithm_description,
            ))

    if not has_external_id_column(columns_seen):
        rule = ENRICHMENT_RULES["external_id"]
        opportunities.append(EnrichmentOpportunity(
            field="external_id", label=rule.label,
            rows_affected=len(df), algorithm=rule.algorithm_description,
        ))

    return opportunities


def apply_enrichment(
    df: pd.DataFrame, odoo_module: str, accepted_fields: set[str],
) -> tuple[pd.DataFrame, list[dict]]:
    """Aplica SOLO los campos que el usuario confirmó explícitamente
    (`accepted_fields`) -- nunca todos los detectados por
    `detect_enrichment_opportunities`. Devuelve el DataFrame enriquecido
    (con una columna `omi_generated_fields` de auditoría agregada al
    final, nunca mezclada en silencio con las columnas originales) y el
    log de auditoría fila por fila."""
    df = df.copy()
    audit_log: list[dict] = []
    generated_fields_per_row: list[list[str]] = [[] for _ in range(len(df))]

    for field_key in accepted_fields:
        rule = ENRICHMENT_RULES.get(field_key)
        if rule is None:
            continue

        if rule.odoo_header not in df.columns:
            df[rule.odoo_header] = None

        for row_index in range(len(df)):
            current = df.at[row_index, rule.odoo_header]
            is_empty = pd.isna(current) or str(current).strip() == ""
            if not is_empty:
                continue
            generated_value = rule.generator(odoo_module, row_index)
            df.at[row_index, rule.odoo_header] = generated_value
            generated_fields_per_row[row_index].append(field_key)
            audit_log.append({
                "row_index": row_index, "field": field_key,
                "generated_value": generated_value, "algorithm": rule.algorithm_description,
            })

    df["omi_generated_fields"] = [",".join(fields) for fields in generated_fields_per_row]
    return df, audit_log
