"""
Mapeo entre módulos OMI y módulos/modelos técnicos de Odoo.
Incluye soporte para localizaciones LATAM en los 3 módulos que varían por país.
"""

# Países LATAM soportados: código ISO -> (label, addon_l10n)
# El addon_l10n es el nombre de la carpeta dentro de odoo/addons/
LATAM_COUNTRIES = {
    "ar": ("Argentina",     "l10n_ar"),
    "bo": ("Bolivia",       "l10n_bo"),
    "br": ("Brasil",        "l10n_br"),       # requiere OCA/l10n-brazil en algunas versiones
    "cl": ("Chile",         "l10n_cl"),
    "co": ("Colombia",      "l10n_co"),
    "cr": ("Costa Rica",    "l10n_cr"),
    "do": ("R. Dominicana", "l10n_do"),
    "ec": ("Ecuador",       "l10n_ec"),
    "gt": ("Guatemala",     "l10n_gt"),
    "mx": ("México",        "l10n_mx"),
    "pa": ("Panamá",        "l10n_pa"),
    "pe": ("Perú",          "l10n_pe"),
    "py": ("Paraguay",      "l10n_py"),
    "uy": ("Uruguay",       "l10n_uy"),
    "ve": ("Venezuela",     "l10n_ve"),
}

# Formato de Tax ID por país (para validación en Contactos)
TAX_ID_RULES = {
    "ar": {"label": "CUIT",  "regex": r"^\d{2}-\d{8}-\d{1}$",          "example": "20-12345678-9"},
    "bo": {"label": "NIT",   "regex": r"^\d{7,10}$",                    "example": "1234567"},
    "br": {"label": "CNPJ/CPF", "regex": r"^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$", "example": "12.345.678/0001-90"},
    "cl": {"label": "RUT",   "regex": r"^\d{1,8}-[\dkK]$",             "example": "12345678-9"},
    "co": {"label": "NIT",   "regex": r"^\d{9,10}-\d{1}$",             "example": "900123456-7"},
    "cr": {"label": "Cédula Jurídica", "regex": r"^\d{10}$",           "example": "3101123456"},
    "do": {"label": "RNC/Cédula", "regex": r"^\d{9,11}$",              "example": "101234567"},
    "ec": {"label": "RUC",   "regex": r"^\d{13}$",                      "example": "1791234567001"},
    "gt": {"label": "NIT",   "regex": r"^\d{1,8}-\d{1}$",              "example": "1234567-8"},
    "mx": {"label": "RFC",   "regex": r"^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$", "example": "XAXX010101000"},
    "pa": {"label": "RUC",   "regex": r"^\d{1,3}-\d{1,6}-\d{1,5}$",   "example": "8-123-456"},
    "pe": {"label": "RUC",   "regex": r"^\d{11}$",                      "example": "20123456789"},
    "py": {"label": "RUC",   "regex": r"^\d{6,8}-\d{1}$",              "example": "80012345-6"},
    "uy": {"label": "RUT",   "regex": r"^\d{12}$",                      "example": "210000280018"},
    "ve": {"label": "RIF",   "regex": r"^[JGVE]-\d{8}-\d{1}$",        "example": "J-12345678-9"},
}

MODULE_MAP = {
    "contactos": {
        "label": "Contactos",
        "addon_dirs": ["base"],
        "primary_models": ["res.partner"],
        "country_scoped": True,
        # Para cada país, qué addon l10n extiende res.partner
        "l10n_addon_dirs": {
            country: [data[1]] for country, data in LATAM_COUNTRIES.items()
        },
    },
    "crm": {
        "label": "CRM",
        "addon_dirs": ["crm"],
        "primary_models": ["crm.lead", "crm.stage"],
        "country_scoped": False,
    },
    "ventas": {
        "label": "Ventas",
        "addon_dirs": ["sale"],
        "primary_models": ["sale.order", "sale.order.line"],
        "country_scoped": False,
    },
    "facturacion": {
        "label": "Facturación",
        "addon_dirs": ["account"],
        "primary_models": ["account.move", "account.move.line"],
        "country_scoped": True,
        "l10n_addon_dirs": {
            country: [data[1]] for country, data in LATAM_COUNTRIES.items()
        },
    },
    "inventario": {
        "label": "Inventario",
        "addon_dirs": ["stock"],
        "primary_models": ["stock.quant", "stock.move"],
        "country_scoped": False,
    },
    "productos": {
        "label": "Productos",
        "addon_dirs": ["product"],
        "primary_models": ["product.template", "product.product", "product.category"],
        "country_scoped": False,
    },
    "contabilidad": {
        "label": "Contabilidad",
        "addon_dirs": ["account"],
        "primary_models": ["account.account", "account.journal"],
        "country_scoped": True,
        "l10n_addon_dirs": {
            country: [data[1]] for country, data in LATAM_COUNTRIES.items()
        },
    },
    "compras": {
        "label": "Compras",
        "addon_dirs": ["purchase"],
        "primary_models": ["purchase.order", "purchase.order.line"],
        "country_scoped": False,
    },
}

SUPPORTED_VERSIONS = ["14.0", "15.0", "16.0", "17.0", "18.0", "19.0"]
