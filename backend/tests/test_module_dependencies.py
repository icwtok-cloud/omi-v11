"""
Tests de `import_order()` -- el orden recomendado de importación entre
módulos de un mismo proyecto (ver module_dependencies.py y el ítem #1
del roadmap de calidad de datos en CHANGELOG.md).
"""

from app.services.module_dependencies import import_order


class TestImportOrder:
    def test_modulo_sin_dependencias_va_antes_que_su_dependiente(self):
        assert import_order(["crm", "contactos"]) == ["contactos", "crm"]

    def test_ya_en_orden_correcto_no_cambia(self):
        assert import_order(["contactos", "productos", "ventas"]) == [
            "contactos",
            "productos",
            "ventas",
        ]

    def test_dependencia_ausente_en_el_proyecto_no_bloquea_el_orden(self):
        # "ventas" depende de "contactos" y "productos", pero si el
        # proyecto solo tiene "ventas" (sin ninguno de los dos), no hay
        # nada que reordenar -- no tiene sentido bloquear la descarga
        # por una dependencia que ni siquiera está en el proyecto.
        assert import_order(["ventas"]) == ["ventas"]

    def test_multiples_dependientes_del_mismo_modulo_base(self):
        result = import_order(["ventas", "compras", "contactos", "productos"])
        assert result.index("contactos") < result.index("ventas")
        assert result.index("contactos") < result.index("compras")
        assert result.index("productos") < result.index("ventas")
        assert result.index("productos") < result.index("compras")

    def test_modulo_desconocido_no_rompe_el_orden(self):
        result = import_order(["modulo_futuro_no_mapeado", "contactos"])
        assert set(result) == {"modulo_futuro_no_mapeado", "contactos"}
