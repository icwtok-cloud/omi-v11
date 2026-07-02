"""
Reglas de formato: validan la FORMA del dato, no su coherencia con Odoo.
Estas son las reglas que aparecían en la imagen de referencia de OMI:
emails inválidos, teléfonos sin formato, CUIT duplicados, precios en
cero, stock negativo, etc.

Estas reglas son las mismas sin importar la versión de Odoo -- por eso
viven separadas del RuleSchema (que sí varía por versión).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import pandas as pd


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Acepta formatos comunes de LatAm: +54 11 1234-5678, (011) 1234-5678, etc.
# No intenta validar de más -- el objetivo es atrapar basura obvia
# (texto random, números con letras mezcladas) sin rechazar formatos
# legítimos pero poco comunes.
PHONE_RE = re.compile(r"^[\d\s()+\-]{6,20}$")

# CUIT argentino: XX-XXXXXXXX-X (con o sin guiones)
CUIT_RE = re.compile(r"^\d{2}-?\d{8}-?\d{1}$")


@dataclass
class FormatIssue:
    issue_type: str
    message: str
    suggested_fix: object | None
    fix_is_automatic: bool
    # Explicación en español de qué hace el fix propuesto (automático o
    # manual-con-sugerencia), para mostrar en el reporte antes de que el
    # usuario decida aplicarlo. None cuando no hay suggested_fix.
    fix_explanation: str | None = None


# Columnas que activan cada chequeo, por nombre de campo Odoo.
# (los nombres reales de columna en el archivo pueden variar; el matching
# contra el field_def ya viene resuelto antes de llegar acá)
EMAIL_FIELDS = {"email"}
PHONE_FIELDS = {"phone", "mobile"}
VAT_FIELDS = {"vat"}
PRICE_FIELDS = {"list_price", "price_unit", "price_subtotal", "amount_total"}
STOCK_FIELDS = {"quantity", "qty_available"}


def _parse_regional_number(value) -> float:
    """Un CSV/Excel exportado con configuración regional es-AR/es-ES
    escribe los números con "," como separador decimal y "." como
    separador de miles (ej. "1.234,56" para mil doscientos treinta y
    cuatro con 56 centavos). `float()` a secas no entiende ese formato y
    tira ValueError -- un precio perfectamente válido terminaba
    reportado como "no es un número válido", el mismo tipo de falso
    positivo que ya se arregló para el separador de columnas y el
    encoding del archivo."""
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if "," in text and "." in text:
        # El separador que aparece más a la derecha es el decimal real
        # -- "1.234,56" (LatAm/ES) vs "1,234.56" (EE.UU.).
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif text.count(",") == 1:
        # Solo coma, una sola vez: asumimos separador decimal LatAm/ES
        # ("1234,56"). Si hubiera más de una coma es un formato ambiguo
        # que preferimos dejar fallar antes que adivinar mal.
        text = text.replace(",", ".")

    return float(text)


def _clean_phone(value: str) -> str:
    """Sugerencia simple de normalización: deja solo dígitos y el +
    inicial si existe."""
    value = value.strip()
    prefix = "+" if value.startswith("+") else ""
    digits = re.sub(r"\D", "", value)
    return f"{prefix}{digits}"


def check(
    column: str, field_type: str, value, country_rules: dict | None = None
) -> FormatIssue | None:
    str_value = str(value).strip()

    if column in EMAIL_FIELDS:
        if not EMAIL_RE.match(str_value):
            return FormatIssue(
                issue_type="invalid_format",
                message=f"'{str_value}' no parece un email válido",
                suggested_fix=None,  # un email mal formado no se puede "arreglar" solo, requiere intervención manual
                fix_is_automatic=False,
            )

    elif column in PHONE_FIELDS:
        if not PHONE_RE.match(str_value):
            return FormatIssue(
                issue_type="invalid_format",
                message=f"'{str_value}' no tiene formato de teléfono reconocible",
                suggested_fix=None,
                fix_is_automatic=False,
            )
        cleaned = _clean_phone(str_value)
        if cleaned != str_value:
            return FormatIssue(
                issue_type="invalid_format",
                message=f"'{str_value}' tiene formato inconsistente",
                suggested_fix=cleaned,
                fix_is_automatic=True,  # normalizar formato sí es seguro de aplicar solo
                fix_explanation="Se recortan espacios, paréntesis y guiones, dejando solo dígitos y el + inicial.",
            )

    elif column in VAT_FIELDS:
        # Si el schema trae una regla de tax_id propia del país (RFC en
        # MX, RUT en CL, etc.), se usa esa -- es la fuente correcta.
        # CUIT_RE queda como fallback solo cuando no hay regla de país
        # (ej. AR, o un país sin l10n reconocido todavía), preservando el
        # comportamiento legacy tal cual estaba.
        tax_id_rule = (country_rules or {}).get("tax_id")
        if tax_id_rule and tax_id_rule.get("regex"):
            tax_id_re = re.compile(tax_id_rule["regex"])
            label = tax_id_rule.get("label", "identificador fiscal")
            # Se prueba el valor crudo Y variantes normalizadas (mayúsculas,
            # sin puntos) -- los regexes generados son estrictos y en archivos
            # reales el mismo identificador válido aparece con variaciones de
            # tipeo: RUT chileno con puntos ("12.345.678-9", el formato más
            # común), RFC mexicano en minúsculas. El valor crudo va primero
            # para no romper países donde los puntos SÍ son parte del formato
            # (CNPJ/CPF de Brasil).
            candidates = (
                str_value,
                str_value.upper(),
                str_value.upper().replace(".", ""),
            )
            if not any(tax_id_re.match(c) for c in candidates):
                return FormatIssue(
                    issue_type="invalid_format",
                    message=f"'{str_value}' no tiene formato de {label} válido",
                    suggested_fix=None,
                    fix_is_automatic=False,
                )
        elif not CUIT_RE.match(str_value):
            return FormatIssue(
                issue_type="invalid_format",
                message=f"'{str_value}' no tiene formato de CUIT/CUIL válido",
                suggested_fix=None,
                fix_is_automatic=False,
            )

    elif column in PRICE_FIELDS:
        try:
            numeric = _parse_regional_number(value)
            if numeric == 0:
                return FormatIssue(
                    issue_type="invalid_format",
                    message=f"'{column}' está en cero, probablemente un dato faltante",
                    suggested_fix=None,
                    fix_is_automatic=False,
                )
            if numeric < 0:
                return FormatIssue(
                    issue_type="negative_value",
                    message=f"'{column}' es negativo ({numeric}), no es válido para un precio",
                    suggested_fix=abs(numeric),
                    fix_is_automatic=False,  # un valor negativo puede ser un signo invertido por error de carga, pero no siempre -- requiere confirmación
                    fix_explanation="Se propone el valor absoluto (sin el signo negativo) — confirmalo si corresponde a una nota de crédito o algo similar.",
                )
        except (ValueError, TypeError):
            return FormatIssue(
                issue_type="invalid_format",
                message=f"'{value}' no es un número válido para '{column}'",
                suggested_fix=None,
                fix_is_automatic=False,
            )

    elif column in STOCK_FIELDS:
        try:
            numeric = _parse_regional_number(value)
            if numeric < 0:
                return FormatIssue(
                    issue_type="negative_value",
                    message=f"Stock negativo ({numeric}) en '{column}'",
                    suggested_fix=0,
                    fix_is_automatic=False,
                    fix_explanation="Se propone 0 como piso — confirmalo si el stock negativo no refleja un error de carga.",
                )
        except (ValueError, TypeError):
            return FormatIssue(
                issue_type="invalid_format",
                message=f"'{value}' no es un número válido para '{column}'",
                suggested_fix=None,
                fix_is_automatic=False,
            )

    return None


def check_duplicates(df: pd.DataFrame, column_mapping: dict[str, str]) -> list:
    """Detecta duplicados en columnas que deberían ser únicas (CUIT, SKU,
    código de cuenta, referencia interna). Se chequea a nivel de toda la
    columna, no fila por fila.

    Recibe `column_mapping` (columna_del_archivo -> campo_tecnico), NO la
    lista cruda de headers -- comparar contra headers crudos era el mismo
    bug ya encontrado en columns_expected_missing: un archivo con el
    header en español ("CUIT" en vez de "vat") nunca activaba la
    detección de duplicados, porque "CUIT" no está en `unique_candidates`
    (que son nombres técnicos), aunque el matching ya lo haya reconocido
    perfectamente como "vat"."""
    from app.services.validation_engine import FieldIssue  # import local para evitar ciclo

    unique_candidates = {"vat", "default_code", "code", "barcode"}
    issues = []

    field_to_col = {
        field: col for col, field in column_mapping.items() if field in unique_candidates
    }

    for field_name, col in field_to_col.items():
        if col not in df.columns:
            continue

        seen: dict = {}
        for row_idx, value in df[col].items():
            if pd.isna(value) or str(value).strip() == "":
                continue
            original = str(value).strip()
            # Se compara case-insensitive y con espacios internos
            # colapsados -- sin esto, "ABC-123" vs "abc-123" (típico en
            # default_code/SKU) o "CUIT" con espacios de más no se
            # detectaban como duplicados, dejando pasar dos registros
            # que Odoo terminaría tratando como entidades distintas.
            key = " ".join(original.split()).lower()
            if key in seen:
                issues.append(FieldIssue(
                    row_index=int(row_idx),
                    column=col,
                    issue_type="duplicate",
                    # +1: el mensaje habla en filas 1-based (como las cuenta
                    # el usuario en su planilla), no en el índice 0-based
                    # interno que sigue viajando en row_index.
                    message=f"'{original}' en '{col}' ya aparece en la fila {seen[key] + 1}",
                    current_value=original,
                    suggested_fix=None,
                    fix_is_automatic=False,
                ))
            else:
                seen[key] = int(row_idx)

    return issues
