import Link from "next/link";

const PAIN_CARDS = [
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

const STEPS = [
  {
    n: "01",
    title: "Subís tu archivo",
    body: "CSV o Excel. Elegís el módulo y la versión de Odoo de tu implementación.",
  },
  {
    n: "02",
    title: "OMI analiza tus datos",
    body: "Valida cada campo contra las reglas reales de esa versión. En segundos, no horas.",
  },
  {
    n: "03",
    title: "Revisás cada problema",
    body: "Aceptás el fix automático o corregís a mano. Con el antes y el después a la vista.",
  },
  {
    n: "04",
    title: "Descargás el archivo corregido",
    body: "Listo para importar a Odoo, con los headers exactos que tu versión espera.",
  },
];

const FAQS = [
  {
    q: "¿Qué formatos acepta?",
    a: "CSV y Excel (.xlsx / .xls). El archivo puede tener cualquier nombre de columnas — OMI las mapea contra los campos reales de Odoo.",
  },
  {
    q: "¿Mis datos se quedan guardados?",
    a: "No. El archivo original se elimina automáticamente apenas se genera tu archivo corregido. No queda nada guardado más de lo necesario para procesarlo.",
  },
  {
    q: "¿Qué versiones de Odoo soporta?",
    a: "De la 14 a la 19, incluyendo versiones que ya no tienen soporte oficial de Odoo — son justamente las que tienen más urgencia de migrar.",
  },
  {
    q: "¿Puedo usarlo sin ser técnico?",
    a: "Sí. No necesitás saber SQL ni Python. Subís el archivo, revisás cada problema en pantalla, y descargás el resultado.",
  },
  {
    q: "¿Cómo se paga?",
    a: "En USDC, por Polygon o Base, directo desde tu wallet. Elegís por proyecto o suscripción mensual — sin tarjeta de crédito.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-brand flex items-center justify-center text-white text-xs font-bold">
              OMI
            </div>
            <span className="font-extrabold text-lg tracking-tight">OMI Engine</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-graphite">
            <a href="#como-funciona" className="hover:text-ink transition-colors">Cómo funciona</a>
            <a href="#modulos" className="hover:text-ink transition-colors">Módulos</a>
            <a href="#precios" className="hover:text-ink transition-colors">Precios</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/app" className="text-sm font-medium text-graphite hover:text-ink transition-colors">
              Iniciar sesión
            </Link>
            <Link
              href="/app"
              className="bg-brand text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-brand-dark transition-colors"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 text-center pt-20 pb-16">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-graphite border border-line rounded-full px-3 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-verify" />
          Para implementadores y consultoras Odoo
        </span>
        <h1 className="font-extrabold text-4xl md:text-6xl leading-[1.05] tracking-tight mb-6">
          Migrá a Odoo<br />
          <span className="text-brand">sin sorpresas</span>
        </h1>
        <p className="text-graphite text-lg leading-relaxed max-w-xl mx-auto mb-8">
          Analizá tus datos antes de importar. Detectá duplicados, campos vacíos,
          CUIT inválidos y errores que Odoo va a rechazar — antes del Go Live.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
          <Link
            href="/app"
            className="bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
          >
            Analizar mis datos gratis →
          </Link>
          <a
            href="#como-funciona"
            className="border border-line font-medium rounded-md px-6 py-3 hover:bg-white transition-colors"
          >
            Ver cómo funciona
          </a>
        </div>
        <p className="text-sm text-graphite">Sin tarjeta. Sin instalación. Resultados en segundos.</p>
      </section>

      <section id="modulos" className="border-t border-line bg-white/60 py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            El problema real
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-4">
            La migración de datos rompe implementaciones
          </h2>
          <p className="text-graphite text-center max-w-xl mx-auto mb-14">
            Seleccionás los módulos de tu implementación al crear el proyecto.
            OMI aplica solo las validaciones relevantes a cada uno.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PAIN_CARDS.map((card) => (
              <div key={card.module} className="bg-white border border-line rounded-xl p-5 flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-wide text-graphite mb-3">
                  {card.module}
                </p>
                <p className="font-bold text-alert leading-snug mb-2">{card.pain}</p>
                <p className="text-sm text-graphite leading-relaxed mb-4 flex-1">
                  {card.consequence}
                </p>
                <div className="bg-verify-light text-verify text-sm font-medium rounded-md px-3 py-2.5 leading-snug">
                  {card.fix}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Proceso
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-14">
            Cómo funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {STEPS.map((step) => (
              <div key={step.n}>
                <p className="font-extrabold text-4xl text-line mb-3">{step.n}</p>
                <p className="font-bold text-lg mb-2">{step.title}</p>
                <p className="text-sm text-graphite leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="precios" className="border-t border-line bg-white/60 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
            Precios
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">
            Pagás en cripto, sin suscripciones escondidas
          </h2>
          <p className="text-graphite mb-14">
            USDC en Polygon o Base, directo desde tu wallet. Sin tarjeta, sin intermediarios.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white border border-line rounded-xl p-7">
              <p className="font-bold text-lg mb-1">Gratis</p>
              <p className="font-extrabold text-4xl tracking-tight mb-1">USD 0</p>
              <p className="text-sm text-graphite mb-6">1 proyecto, 1 módulo -- una vez por cuenta</p>
              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Reporte completo</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Descarga del archivo corregido incluida</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Sin tarjeta ni wallet</li>
              </ul>
              <Link
                href="/app"
                className="block text-center border border-line font-semibold rounded-md px-4 py-2.5 hover:bg-canvas transition-colors"
              >
                Probar gratis
              </Link>
            </div>

            <div className="bg-white border border-line rounded-xl p-7">
              <p className="font-bold text-lg mb-1">Por proyecto</p>
              <p className="font-extrabold text-4xl tracking-tight mb-1">USD 99</p>
              <p className="text-sm text-graphite mb-6">Hasta 8 módulos, todo el proyecto junto</p>
              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Reporte completo gratis, sin límite</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Validaciones por módulo y versión</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Export listo para Odoo</li>
              </ul>
              <Link
                href="/app"
                className="block text-center border border-line font-semibold rounded-md px-4 py-2.5 hover:bg-canvas transition-colors"
              >
                Empezar con un proyecto
              </Link>
            </div>

            <div className="bg-white border-2 border-brand rounded-xl p-7 relative">
              <span className="absolute -top-3 left-7 bg-brand text-white text-xs font-bold rounded-full px-3 py-1">
                Para consultoras
              </span>
              <p className="font-bold text-lg mb-1">Mensual</p>
              <p className="font-extrabold text-4xl tracking-tight mb-1">USD 149</p>
              <p className="text-sm text-graphite mb-6">Hasta 5 proyectos exportados por mes</p>
              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Todo lo del plan por proyecto</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> 5 proyectos exportados por mes</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Pensado para varios clientes a la vez</li>
              </ul>
              <Link
                href="/app"
                className="block text-center bg-brand text-white font-semibold rounded-md px-4 py-2.5 hover:bg-brand-dark transition-colors"
              >
                Suscribirme
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            FAQ
          </p>
          <h2 className="font-extrabold text-3xl tracking-tight text-center mb-12">
            Preguntas frecuentes
          </h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-white border border-line rounded-xl p-5">
                <p className="font-bold mb-1.5">{faq.q}</p>
                <p className="text-sm text-graphite leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-10">
        <div className="max-w-6xl mx-auto px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-graphite">
          <p>© 2026 OMI Engine</p>
          <Link href="/app" className="text-brand font-medium hover:underline">
            Analizar mis datos gratis →
          </Link>
        </div>
      </footer>
    </main>
  );
}
