export const PAIN_CARDS = [
  {
    module: "Contactos",
    pain: "1 de cada 8 contactos con email mal formado",
    consequence: "Las campañas de cobranza y marketing rebotan sin que nadie note por qué.",
    fix: "Detecta y corrige el formato antes de importar.",
  },
  {
    module: "CRM",
    pain: "Oportunidades sin etapa reconocida por Odoo",
    consequence: "El pipeline de ventas aparece vacío el primer día de uso.",
    fix: "Mapea cada etapa contra las reales de tu versión de Odoo.",
  },
  {
    module: "Ventas",
    pain: "Órdenes con precio en cero",
    consequence: "Facturás $0 sin darte cuenta hasta que el cliente reclama.",
    fix: "Marca cada precio en cero antes de que llegue a producción.",
  },
  {
    module: "Facturación",
    pain: "Monedas no configuradas en el sistema",
    consequence: "Las facturas quedan en un limbo que ni contabilidad puede cerrar.",
    fix: "Verifica cada moneda contra la configuración real de Odoo.",
  },
  {
    module: "Inventario",
    pain: "SKUs duplicados entre depósitos",
    consequence: "El stock se descuenta del producto equivocado.",
    fix: "Detecta duplicados antes de que se mezcle el inventario.",
  },
  {
    module: "Productos",
    pain: "Categorías que no existen en el catálogo",
    consequence: "Los productos quedan huérfanos, invisibles en los reportes.",
    fix: "Valida cada categoría contra las reales de tu versión.",
  },
  {
    module: "Contabilidad",
    pain: "Asientos sin contraparte",
    consequence: "El balance no cierra y nadie sabe en qué línea está el error.",
    fix: "Encuentra el asiento exacto antes del cierre.",
  },
  {
    module: "Compras",
    pain: "Órdenes sin proveedor asignado",
    consequence: "El área de pagos no sabe a quién transferirle.",
    fix: "Bloquea la importación hasta resolver cada caso.",
  },
];
