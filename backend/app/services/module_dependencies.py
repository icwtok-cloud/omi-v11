"""
Orden recomendado de importación entre módulos de un mismo proyecto.

Por qué existe esto: Odoo valida relaciones (Many2one/Many2many) contra
registros que ya tienen que existir -- importar "ventas" antes que
"contactos" hace que cada pedido con un partner nuevo sea rechazado (o
importado con la relación vacía) porque ese contacto todavía no existe.
El orden alfabético del ZIP no refleja esto para nada.

No es un grafo exhaustivo de todo Odoo -- es un mapa estático de los
módulos que soporta OMI hoy (ver `backend/rules/*.json`), pensado para
que el ZIP final numere los archivos en el orden en que un Odoo Partner
los importaría a mano.
"""

from __future__ import annotations

# módulo -> módulos de los que depende (deben importarse antes)
MODULE_DEPENDENCIES: dict[str, list[str]] = {
    "contactos": [],
    "productos": [],
    "crm": ["contactos"],
    "inventario": ["productos"],
    "ventas": ["contactos", "productos"],
    "compras": ["contactos", "productos"],
}


def missing_dependencies(odoo_module: str, odoo_modules_in_project: list[str]) -> list[str]:
    """Dependencias conocidas de `odoo_module` que NO están (todavía) en
    este proyecto -- ej. subir "ventas" sin "contactos" en el mismo
    proyecto. Es informativo, no bloqueante: el usuario puede estar
    migrando contactos por separado, o va a agregar el módulo después."""
    deps = MODULE_DEPENDENCIES.get(odoo_module, [])
    present = set(odoo_modules_in_project)
    return [d for d in deps if d not in present]


def import_order(odoo_modules: list[str]) -> list[str]:
    """Ordena una lista de módulos (los que efectivamente están en el
    proyecto) respetando dependencias -- un módulo nunca aparece antes
    que sus dependencias, si esas dependencias también están en la
    lista. Módulos sin entrada en el mapa (o sin dependencias conocidas
    presentes en el proyecto) se ubican al principio, en el orden en que
    vinieron, para no romper con módulos futuros no contemplados acá."""
    remaining = list(odoo_modules)
    ordered: list[str] = []
    seen: set[str] = set()

    # Tope defensivo: con N módulos, un orden topológico válido nunca
    # necesita más de N pasadas -- si lo excedemos hay un ciclo en el
    # mapa (bug de configuración, no de datos del usuario) y preferimos
    # cortar en vez de loopear para siempre.
    max_passes = len(remaining) + 1
    passes = 0
    while remaining and passes <= max_passes:
        passes += 1
        next_remaining = []
        for module in remaining:
            deps = MODULE_DEPENDENCIES.get(module, [])
            deps_satisfied = all(d not in remaining or d in seen for d in deps)
            if deps_satisfied:
                ordered.append(module)
                seen.add(module)
            else:
                next_remaining.append(module)
        if len(next_remaining) == len(remaining):
            # No hubo progreso en esta pasada (ciclo) -- agregamos el
            # resto tal cual vino en vez de bloquear la descarga.
            ordered.extend(next_remaining)
            break
        remaining = next_remaining

    return ordered
