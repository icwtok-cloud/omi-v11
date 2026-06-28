"""
Mapeo entre los módulos "de cara al usuario" de OMI y los módulos/modelos
técnicos reales dentro del código fuente de Odoo.

Esto existe separado porque los nombres no son 1:1: por ejemplo "Contactos"
en la UI de Odoo es el modelo res.partner, que vive físicamente en el
módulo base, no en un módulo "contacts". Si no centralizamos este mapeo,
cada parte del generador termina hardcodeando estos nombres por su cuenta.
"""

# Cada entrada define:
#   - addon_dirs: carpetas dentro de odoo/addons/ a inspeccionar
#   - primary_models: modelos cuyo schema mostramos como "el" schema de este
#     módulo en la UI de OMI (puede haber modelos auxiliares que se ignoran)
MODULE_MAP = {
    "contactos": {
        "label": "Contactos",
        "addon_dirs": ["base"],
        "primary_models": ["res.partner"],
    },
    "crm": {
        "label": "CRM",
        "addon_dirs": ["crm"],
        "primary_models": ["crm.lead", "crm.stage"],
    },
    "ventas": {
        "label": "Ventas",
        "addon_dirs": ["sale"],
        "primary_models": ["sale.order", "sale.order.line"],
    },
    "facturacion": {
        "label": "Facturación",
        "addon_dirs": ["account"],
        "primary_models": ["account.move", "account.move.line"],
    },
    "inventario": {
        "label": "Inventario",
        "addon_dirs": ["stock"],
        "primary_models": ["stock.quant", "stock.move", "product.uom"],
    },
    "productos": {
        "label": "Productos",
        "addon_dirs": ["product"],
        "primary_models": ["product.template", "product.product", "product.category"],
    },
    "contabilidad": {
        "label": "Contabilidad",
        "addon_dirs": ["account"],
        "primary_models": ["account.account", "account.journal"],
    },
    "compras": {
        "label": "Compras",
        "addon_dirs": ["purchase"],
        "primary_models": ["purchase.order", "purchase.order.line"],
    },
}

# Versiones soportadas por OMI al lanzar.
SUPPORTED_VERSIONS = ["14.0", "15.0", "16.0", "17.0", "18.0", "19.0"]
