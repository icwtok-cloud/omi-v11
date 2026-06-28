"""
Motor de validación de OMI -- 100% determinístico, sin IA.

Recibe un DataFrame (ya parseado desde CSV/XLSX) y un RuleSchema, y
produce un reporte estructurado de errores + sugerencias de fix.

Dos categorías de reglas, como quedó claro en el diseño:

  1. FORMATO: validaciones de forma del dato en sí, independientes de
     Odoo (email inválido, teléfono sin formato, CUIT duplicado, precio
     en cero). Viven en `format_rules.py`.

  2. COHERENCIA: validaciones contra el schema real de Odoo (campo
     requerido faltante, tipo incorrecto, relación a un valor que no
     existe en los defaults de fábrica o en el override del cliente).
     Viven acá, porque necesitan el RuleSchema.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from app.services.rules_loader import RuleSchema
from app.services import format_rules


@dataclass
class FieldIssue:
    row_index: int            # índice de fila en el archivo subido (0-based)
    column: str                # nombre de columna donde está el problema
    issue_type: str             # "missing_required" | "invalid_format" |
                                 # "unknown_relation" | "duplicate" | "negative_value"
    message: str                # descripción legible para el usuario
    current_value: object       # valor tal cual vino en el archivo
    suggested_fix: object | None = None   # valor propuesto, si hay fix automático
    fix_is_automatic: bool = False        # True = se puede aplicar solo, False = requiere que el usuario decida


@dataclass
class ValidationReport:
    total_rows: int
    total_issues: int
    issues: list[FieldIssue] = field(default_factory=list)
    columns_seen: list[str] = field(default_factory=list)
    columns_expected_missing: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "total_rows": self.total_rows,
            "total_issues": self.total_issues,
            "columns_seen": self.columns_seen,
            "columns_expected_missing": self.columns_expected_missing,
            "issues": [
                {
                    "row_index": i.row_index,
                    "column": i.column,
                    "issue_type": i.issue_type,
                    "message": i.message,
                    "current_value": i.current_value,
                    "suggested_fix": i.suggested_fix,
                    "fix_is_automatic": i.fix_is_automatic,
                }
                for i in self.issues
            ],
        }


def _known_relation_values(schema: RuleSchema, comodel_name: str, override: dict | None) -> set[str] | None:
    """Para un campo de relación (Many2one/Many2many), devuelve el set de
    valores válidos conocidos: primero mira si el cliente dio su propia
    config (override) para ese comodel, si no, usa los defaults de fábrica
    extraídos por el rules-generator. Devuelve None si no hay forma de
    saberlo (no es necesariamente un error del archivo -- puede ser que
    ese modelo no tenga defaults relevantes, ej res.partner).
    """
    if override and comodel_name in override:
        return set(override[comodel_name])

    defaults = schema.default_values_for(comodel_name)
    if not defaults:
        return None

    names = set()
    for rec in defaults:
        name_value = rec["values"].get("name")
        if name_value:
            names.add(name_value)
    return names or None


def validate_dataframe(
    df: pd.DataFrame,
    schema: RuleSchema,
    client_override: dict | None = None,
) -> ValidationReport:
    model = schema.primary_model()
    model_name = model["name"]
    fields_by_name = {f["name"]: f for f in model["fields"]}

    columns_seen = list(df.columns)
    required = schema.required_fields()
    columns_expected_missing = [r for r in required if r not in columns_seen]

    issues: list[FieldIssue] = []

    # --- 1. Columnas requeridas que ni siquiera están en el archivo ---
    # (esto se reporta una vez a nivel reporte, no fila por fila, porque
    # afecta a todas las filas igual)

    # --- 2. Validación fila por fila para las columnas que sí vinieron ---
    for row_idx, row in df.iterrows():
        for col_name in columns_seen:
            if col_name not in fields_by_name:
                continue  # columna que el usuario subió pero Odoo no usa en este modelo; no es un error, se ignora

            field_def = fields_by_name[col_name]
            value = row[col_name]
            is_empty = pd.isna(value) or (isinstance(value, str) and value.strip() == "")

            # 2a. Requerido y vacío
            if field_def.get("required") and is_empty:
                issues.append(FieldIssue(
                    row_index=int(row_idx),
                    column=col_name,
                    issue_type="missing_required",
                    message=f"'{col_name}' es obligatorio en Odoo {schema.version} y está vacío",
                    current_value=None,
                    suggested_fix=None,
                    fix_is_automatic=False,
                ))
                continue

            if is_empty:
                continue  # vacío pero no requerido, no es un issue

            # 2b. Validaciones de formato puro (no dependen de Odoo)
            format_issue = format_rules.check(col_name, field_def["type"], value)
            if format_issue:
                issues.append(FieldIssue(
                    row_index=int(row_idx),
                    column=col_name,
                    issue_type=format_issue.issue_type,
                    message=format_issue.message,
                    current_value=value,
                    suggested_fix=format_issue.suggested_fix,
                    fix_is_automatic=format_issue.fix_is_automatic,
                ))

            # 2c. Validación de coherencia: relaciones contra valores conocidos
            comodel = field_def.get("comodel_name")
            if comodel:
                known_values = _known_relation_values(schema, comodel, client_override)
                if known_values is not None and str(value) not in known_values:
                    issues.append(FieldIssue(
                        row_index=int(row_idx),
                        column=col_name,
                        issue_type="unknown_relation",
                        message=(
                            f"'{value}' no existe como {comodel} en Odoo "
                            f"{schema.version} (ni en tu configuración, si la diste)"
                        ),
                        current_value=value,
                        suggested_fix=None,
                        fix_is_automatic=False,
                    ))

            # 2d. Validación de coherencia: Selection con opciones fijas
            selection_options = field_def.get("selection_options")
            if selection_options and not field_def.get("selection_dynamic"):
                if str(value) not in selection_options:
                    issues.append(FieldIssue(
                        row_index=int(row_idx),
                        column=col_name,
                        issue_type="invalid_format",
                        message=(
                            f"'{value}' no es una opción válida para '{col_name}'. "
                            f"Opciones válidas: {', '.join(selection_options)}"
                        ),
                        current_value=value,
                        suggested_fix=selection_options[0] if selection_options else None,
                        fix_is_automatic=False,
                    ))

    # --- 3. Duplicados (a nivel columna completa, no fila por fila) ---
    issues.extend(format_rules.check_duplicates(df, columns_seen))

    return ValidationReport(
        total_rows=len(df),
        total_issues=len(issues),
        issues=issues,
        columns_seen=columns_seen,
        columns_expected_missing=columns_expected_missing,
    )
