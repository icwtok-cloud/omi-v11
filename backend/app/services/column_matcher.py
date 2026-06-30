"""
Mapea nombres de columnas "humanos" (como vienen en un CSV/XLSX real,
típicamente en español y sin ningún estándar) a los nombres técnicos de
campo que usa Odoo (ej. "Nombre" -> "name", "Correo Electrónico" -> "email").

Por qué existe esto:

  El schema generado por rules-generator (ver rules_loader.py) solo trae
  el nombre técnico del campo (`f["name"]`), no un label en español. Si el
  validador compara columnas del archivo contra ese nombre técnico de
  forma literal, CUALQUIER archivo con headers humanos (que es el caso
  normal -- nadie exporta un CSV con headers "name", "email", "phone")
  da 0% de coincidencia, aunque el contenido sea perfectamente válido.
  Esto generaba falsos positivos de "structural_mismatch" en archivos
  legítimos.

Estrategia de tres niveles, en orden:
  1. Exact match contra el nombre técnico (cubre el caso de alguien que
     exporta directo desde Odoo, donde el header YA es el nombre técnico).
  2. Diccionario de sinónimos en español (normalizado: sin acentos, sin
     mayúsculas, sin espacios extra) -- cubre los headers más comunes que
     un usuario de LATAM va a poner.
  3. Fuzzy match como último recurso, para variantes no previstas en el
     diccionario (ej. "Mail" en vez de "Correo", "Cel" en vez de "Celular").
     Usa un umbral conservador para evitar falsos positivos.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher


def _normalize(text: str) -> str:
    """minúsculas, sin acentos, sin espacios/guiones/guion bajo redundantes."""
    text = text.strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[\s_\-./]+", " ", text)
    return text.strip()


# Sinónimos en español (y alguna variante en inglés informal) -> nombre
# técnico de campo en Odoo. Cubre res.partner (Contactos) y los campos más
# transversales que aparecen en otros módulos. Se puede ampliar sin tocar
# la lógica de matching.
FIELD_SYNONYMS: dict[str, list[str]] = {
    "name": ["nombre", "nombre completo", "razon social", "nombre y apellido"],
    "email": ["correo", "correo electronico", "mail", "e mail", "email"],
    "phone": ["telefono", "tel", "fono", "telefono fijo"],
    "mobile": ["celular", "movil", "cel", "whatsapp", "telefono movil"],
    "vat": ["cuit", "cuil", "rut", "rfc", "nit", "identificacion fiscal", "dni"],
    "street": ["calle", "direccion", "domicilio"],
    "city": ["ciudad", "localidad"],
    "zip": ["codigo postal", "cp"],
    "country_id": ["pais"],
    "state_id": ["provincia", "estado", "departamento"],
    "parent_id": ["empresa", "compania", "organizacion"],
    "function": ["cargo", "puesto", "rol", "posicion"],
    "category_id": ["categoria", "etiqueta", "etiquetas", "tags"],
    "comment": ["notas", "comentario", "comentarios", "observaciones"],
    "website": ["sitio web", "web", "pagina web"],
    "lang": ["idioma"],
}

# Para cada campo técnico, lista de variantes normalizadas (incluye el
# propio nombre técnico normalizado, por si el archivo viene en inglés).
_NORMALIZED_SYNONYMS: dict[str, set[str]] = {
    field: {_normalize(field)} | {_normalize(s) for s in synonyms}
    for field, synonyms in FIELD_SYNONYMS.items()
}


def match_columns(
    columns_seen: list[str],
    known_field_names: list[str],
    fuzzy_threshold: float = 0.82,
) -> dict[str, str]:
    """Devuelve un dict {columna_del_archivo: nombre_tecnico_de_campo} para
    cada columna del archivo que se pudo asociar a un campo conocido.
    Las columnas que no matchean ningún campo simplemente no aparecen en
    el resultado (se siguen ignorando como antes, no son un error).

    known_field_names: los nombres técnicos de campo definidos en el
    modelo (ej. ["name", "email", "phone", ...]), tal como vienen del
    RuleSchema.
    """
    known_set = set(known_field_names)
    result: dict[str, str] = {}

    for col in columns_seen:
        normalized_col = _normalize(col)

        # Nivel 1: exact match contra el nombre técnico tal cual.
        if col in known_set:
            result[col] = col
            continue

        # Nivel 2: diccionario de sinónimos.
        matched_field = None
        for field_name in known_field_names:
            variants = _NORMALIZED_SYNONYMS.get(field_name)
            if variants and normalized_col in variants:
                matched_field = field_name
                break
        if matched_field:
            result[col] = matched_field
            continue

        # Nivel 3: fuzzy match contra el nombre técnico y sus sinónimos,
        # solo si superan el umbral. Evita matchear cosas no relacionadas
        # (ej. "Notas" contra "name" por longitud similar de letras).
        best_field = None
        best_score = 0.0
        for field_name in known_field_names:
            candidates = {field_name} | _NORMALIZED_SYNONYMS.get(field_name, set())
            for candidate in candidates:
                score = SequenceMatcher(None, normalized_col, candidate).ratio()
                if score > best_score:
                    best_score = score
                    best_field = field_name
        if best_field and best_score >= fuzzy_threshold:
            result[col] = best_field

    return result
