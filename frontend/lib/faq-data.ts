export const DOUBTS = [
  {
    q: "Ya tengo Odoo, ¿para qué necesito esto?",
    a: "OMI no reemplaza a Odoo -- valida lo que le vas a dar de comer antes de que Odoo lo rechace o, peor, lo acepte mal.",
  },
  {
    q: "Ya uso Excel para limpiar mis datos",
    a: "Excel no sabe qué campos son obligatorios en tu versión de Odoo, ni qué etapas o categorías existen en tu instancia real. OMI valida contra esas reglas reales, no contra una checklist genérica.",
  },
  {
    q: "Mis imports suelen funcionar",
    a: "Suelen. El problema aparece en los que no -- y para entonces ya estás en producción. OMI te muestra los errores antes de ese momento.",
  },
  {
    q: "No migro seguido, ¿vale la pena?",
    a: "No hay curva de aprendizaje: subís el archivo y ves el reporte. La primera vez que evita un error en producción ya lo justifica.",
  },
  {
    q: "No confío en los fixes automáticos",
    a: "Tu archivo original nunca se modifica. Las correcciones se aplican recién al generar el archivo de descarga -- podés ver cada cambio antes de exportar. Lo que sí requiere tu criterio (un precio en cero que podría ser real, por ejemplo) queda marcado para que decidas vos, no se corrige solo.",
  },
  {
    q: "No quiero que una IA le meta mano a mi contabilidad",
    a: "OMI no usa IA. El motor es 100% determinístico -- las reglas se generan leyendo el código fuente real de Odoo, no un modelo que adivina.",
  },
  {
    q: "¿Mis datos se quedan guardados?",
    a: "Tu archivo se guarda solo mientras el proyecto exista en tu cuenta -- así podés volver a descargarlo o sumar módulos sin resubir nada. Podés pedir el borrado de un proyecto cuando quieras escribiendo a hello@alterego.lat.",
  },
  {
    q: "¿Puedo usarlo sin ser técnico?",
    a: "Sí. No necesitás saber SQL ni Python. Subís el archivo, revisás cada problema en pantalla, y descargás el resultado.",
  },
  {
    q: "¿Qué formatos acepta?",
    a: "CSV y Excel (.xlsx / .xls). El archivo puede tener cualquier nombre de columnas -- OMI las mapea contra los campos reales de Odoo.",
  },
  {
    q: "¿Qué versiones de Odoo soporta?",
    a: "De la 14 a la 19, incluyendo versiones que ya no tienen soporte oficial -- son justamente las que tienen más urgencia de migrar.",
  },
  {
    q: "¿Cómo se paga?",
    a: "En USDC, por Polygon o Base, directo desde tu wallet. Elegís por proyecto o suscripción mensual -- sin tarjeta de crédito.",
  },
];
