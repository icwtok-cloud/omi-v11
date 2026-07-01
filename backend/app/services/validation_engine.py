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
from typing import Callable

import pandas as pd

from app.services.rules_loader import RuleSchema
from app.services import format_rules
from app.services.column_matcher import match_columns


def _to_native(value: object) -> object:
    """Convierte escalares de numpy/pandas (int64, float64, Timestamp, etc.)
    a tipos nativos de Python, para que sean JSON-serializables al armar
    la respuesta de la API. Sin esto, cualquier issue sobre una columna
    numérica entera (numpy.int64) rompe la serialización de la respuesta
    y el frontend nunca recibe `issues`, solo los contadores agregados."""
    if value is None:
        return None
    if pd.isna(value):
        return None
    if hasattr(value, "item"):  # numpy scalar (int64, float64, bool_, etc.)
        return value.item()
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return value


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
    fix_explanation: str | None = None    # explicación en español de qué hace el fix, para mostrar antes de aplicarlo


@dataclass
class ValidationReport:
    total_rows: int
    total_issues: int
    issues: list[FieldIssue] = field(default_factory=list)
    columns_seen: list[str] = field(default_factory=list)
    columns_expected_missing: list[str] = field(default_factory=list)
    structural_mismatch: bool = False
    matched_columns_count: int = 0
    column_mapping: dict = field(default_factory=dict)
    unmatched_columns: list[str] = field(default_factory=list)
    preview_rows: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "total_rows": self.total_rows,
            "total_issues": self.total_issues,
            "columns_seen": self.columns_seen,
            "columns_expected_missing": self.columns_expected_missing,
            "structural_mismatch": self.structural_mismatch,
            "matched_columns_count": self.matched_columns_count,
            "column_mapping": self.column_mapping,
            "unmatched_columns": self.unmatched_columns,
            "preview_rows": self.preview_rows,
            "issues": [
                {
                    "row_index": i.row_index,
                    "column": i.column,
                    "issue_type": i.issue_type,
                    "message": i.message,
                    "current_value": i.current_value,
                    "suggested_fix": i.suggested_fix,
                    "fix_is_automatic": i.fix_is_automatic,
                    "fix_explanation": i.fix_explanation,
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
    on_progress: Callable[[int, int], None] | None = None,
) -> ValidationReport:
    model = schema.primary_model()
    model_name = model["name"]
    fields_by_name = {f["name"]: f for f in model["fields"]}

    columns_seen = list(df.columns)
    required = schema.required_fields()

    issues: list[FieldIssue] = []

    # --- 0. Chequeo estructural: ¿este archivo se parece en algo al modelo
    # elegido? Confiar solo en `required_fields()` no alcanza -- muchos
    # modelos de Odoo (ej. res.partner) no marcan ningún campo como
    # `required=True` a nivel de código aunque en la práctica sea
    # obligatorio (la regla vive en una constraint, no en el field). Sin
    # este chequeo, un archivo totalmente ajeno al módulo (ej. el export
    # de un bot) pasa con "0 errores" simplemente porque ninguna de sus
    # columnas matchea nada y entonces no hay nada que validar fila por
    # fila. Si casi ninguna columna matchea, es más probable que el
    # archivo no corresponda al módulo/versión elegidos que que sea un
    # archivo perfecto.
    column_mapping = match_columns(columns_seen, list(fields_by_name.keys()))
    matched_columns = list(column_mapping.keys())
    unmatched_columns = [c for c in columns_seen if c not in column_mapping]
    match_ratio = (len(matched_columns) / len(columns_seen)) if columns_seen else 0.0
    structural_mismatch = len(columns_seen) > 0 and match_ratio < 0.2

    # OJO: comparar contra los campos técnicos YA MAPEADOS
    # (column_mapping.values()), no contra columns_seen (los headers
    # crudos del archivo). Si no, un campo requerido que sí vino pero con
    # un header en español (ej. "Nombre" -> "name" vía sinónimo) se
    # reportaba como "falta esta columna obligatoria" aunque el matching
    # lo haya reconocido perfectamente -- un falso positivo justo en el
    # caso normal (nadie exporta un CSV con headers técnicos en inglés).
    mapped_fields = set(column_mapping.values())
    columns_expected_missing = [r for r in required if r not in mapped_fields]

    # Preview de las primeras filas reales del archivo, tal cual vinieron
    # (no solo el reporte de errores) -- para que el usuario pueda
    # confirmar visualmente que el mapeo de columnas tiene sentido antes
    # de pagar, sea o no haya errores. Se muestra siempre, incluso en
    # structural_mismatch, porque "ver qué se detectó" es justo lo que
    # necesita alguien para decidir si tiene que cambiar de módulo o no.
    preview_n = min(10, len(df))
    preview_rows = [
        {col: _to_native(row[col]) for col in columns_seen}
        for _, row in df.head(preview_n).iterrows()
    ]

    if structural_mismatch:
        # No tiene sentido seguir validando fila por fila: las columnas no
        # corresponden al modelo, así que cualquier "0 errores" sería
        # engañoso. Devolvemos el reporte cortando acá.
        return ValidationReport(
            total_rows=len(df),
            total_issues=0,
            issues=[],
            columns_seen=columns_seen,
            columns_expected_missing=columns_expected_missing,
            structural_mismatch=True,
            matched_columns_count=len(matched_columns),
            column_mapping=column_mapping,
            unmatched_columns=unmatched_columns,
            preview_rows=preview_rows,
        )

    # --- 1. Columnas requeridas que ni siquiera están en el archivo ---
    # (esto se reporta una vez a nivel reporte, no fila por fila, porque
    # afecta a todas las filas igual)

    # --- 2. Validación fila por fila para las columnas que sí vinieron ---
    # Progreso: se avisa cada `progress_step` filas (no en cada una) para
    # no pagar el costo de un commit a DB por fila en archivos grandes --
    # ver Fase 4 del roadmap / _run_validation_job() en app/api/projects.py.
    total_rows = len(df)
    progress_step = max(500, total_rows // 100) if total_rows else 1

    # Columnas del archivo que mapean a "email"/"phone"/"mobile", si el
    # modelo elegido tiene esos campos -- ninguno es `required` en Odoo
    # (la constraint real vive en la práctica de negocio, no en el
    # schema), así que hoy un contacto sin ningún dato de contacto pasa
    # con "0 errores". Es un caso real y no bloqueante: se avisa, pero
    # no impide exportar (misma lógica que el resto de los issues).
    contact_field_to_col = {
        field: col
        for col, field in column_mapping.items()
        if field in ("email", "phone", "mobile") and field in fields_by_name
    }

    for position, (row_idx, row) in enumerate(df.iterrows(), start=1):
        if contact_field_to_col:
            all_contact_values_empty = all(
                pd.isna(row[col]) or (isinstance(row[col], str) and row[col].strip() == "")
                for col in contact_field_to_col.values()
            )
            if all_contact_values_empty:
                any_contact_col = next(iter(contact_field_to_col.values()))
                issues.append(FieldIssue(
                    row_index=int(row_idx),
                    column=any_contact_col,
                    issue_type="missing_contact_info",
                    message=(
                        "Este registro no tiene email ni teléfono/celular cargado — "
                        "es válido para Odoo, pero no vas a poder contactarlo."
                    ),
                    current_value=None,
                    suggested_fix=None,
                    fix_is_automatic=False,
                ))

        for col_name in columns_seen:
            mapped_field = column_mapping.get(col_name)
            if mapped_field is None:
                continue  # columna que el usuario subió pero no matchea ningún campo conocido (ni exacto, ni sinónimo, ni fuzzy); no es un error, se ignora

            field_def = fields_by_name[mapped_field]
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
                    current_value=_to_native(value),
                    suggested_fix=_to_native(format_issue.suggested_fix),
                    fix_is_automatic=format_issue.fix_is_automatic,
                    fix_explanation=format_issue.fix_explanation,
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
                        current_value=_to_native(value),
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
                        current_value=_to_native(value),
                        suggested_fix=selection_options[0] if selection_options else None,
                        fix_is_automatic=False,
                        fix_explanation=(
                            "Se propone la primera opción válida como placeholder — "
                            "reemplazala por el valor correcto."
                        ) if selection_options else None,
                    ))

        if on_progress and (position % progress_step == 0 or position == total_rows):
            on_progress(position, total_rows)

    # --- 3. Duplicados (a nivel columna completa, no fila por fila) ---
    issues.extend(format_rules.check_duplicates(df, columns_seen))

    return ValidationReport(
        total_rows=len(df),
        total_issues=len(issues),
        issues=issues,
        columns_seen=columns_seen,
        columns_expected_missing=columns_expected_missing,
        structural_mismatch=False,
        matched_columns_count=len(matched_columns),
        column_mapping=column_mapping,
        unmatched_columns=unmatched_columns,
        preview_rows=preview_rows,
    )
