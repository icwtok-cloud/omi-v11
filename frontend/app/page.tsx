import Link from "next/link";
import { ProductDemo } from "@/components/ProductDemo";
import { LocalizationPulse } from "@/components/LocalizationPulse";
import { StructuredData } from "@/components/StructuredData";
import { DOUBTS } from "@/lib/faq-data";

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

const BEFORE_AFTER = {
  before: [
    "Emails mal formados y otros formatos rotos",
    "Duplicados entre filas o depósitos",
    "Relaciones que no existen en tu Odoo (etapas, categorías, monedas)",
    "Columnas obligatorias faltantes",
    "Horas de limpieza manual en Excel, por las dudas",
  ],
  after: [
    "Cada error identificado y agrupado por tipo",
    "Fixes automáticos aplicados solos; el resto, marcado para revisión manual",
    "Quality Score (0-100) que cuantifica qué tan lista está tu data",
    "Reporte técnico en PDF con el detalle de cada corrección",
    "Archivo corregido, listo para importar en el orden correcto",
  ],
};

const STEPS = [
  {
    n: "01",
    title: "Subís tu archivo",
    body: "CSV o Excel. OMI detecta el módulo, la versión y -- si corresponde -- el país, y valida cada campo contra las reglas reales. En segundos, no horas.",
  },
  {
    n: "02",
    title: "Revisás cada problema",
    body: "Agrupado por tipo, con el fix automático ya aplicado o marcado para que decidas vos.",
  },
  {
    n: "03",
    title: "Importás sin sorpresas",
    body: "Descargás el archivo corregido, con los headers exactos que tu versión de Odoo espera.",
  },
];

const PERSONAS = [
  {
    title: "Partners y consultoras Odoo",
    body: "Migrás datos de varios clientes a la vez. Necesitás un proceso repetible, no una planilla distinta por proyecto.",
  },
  {
    title: "Implementadores independientes",
    body: "Un Go Live fallido por datos rotos cae sobre vos, no sobre el cliente. Detectalo antes de que pase.",
  },
  {
    title: "Equipos internos de ERP",
    body: "Migrás una sola vez, pero no podés permitirte un error en producción el día del corte.",
  },
  {
    title: "Migraciones de gran volumen",
    body: "Miles de filas por módulo -- imposible de revisar una por una a mano.",
  },
];

const LATAM_COUNTRIES = [
  { code: "ar", name: "Argentina" },
  { code: "bo", name: "Bolivia" },
  { code: "br", name: "Brasil" },
  { code: "cl", name: "Chile" },
  { code: "co", name: "Colombia" },
  { code: "cr", name: "Costa Rica" },
  { code: "do", name: "Rep. Dominicana" },
  { code: "ec", name: "Ecuador" },
  { code: "gt", name: "Guatemala" },
  { code: "mx", name: "México" },
  { code: "pa", name: "Panamá" },
  { code: "pe", name: "Perú" },
  { code: "py", name: "Paraguay" },
  { code: "uy", name: "Uruguay" },
  { code: "ve", name: "Venezuela" },
];

const TRUST_POINTS = [
  {
    title: "100% determinístico",
    body: "Reglas generadas leyendo el código fuente real de Odoo. Sin IA, sin resultados que cambian entre corridas.",
  },
  {
    title: "Tus datos no quedan guardados",
    body: "El archivo original se borra automáticamente apenas se genera tu archivo corregido.",
  },
  {
    title: "Odoo 14 a 19",
    body: "Incluye versiones sin soporte oficial de Odoo -- las que tienen más urgencia de migrar.",
  },
  {
    title: "Reporte técnico y archivo listo",
    body: "PDF con el detalle de cada corrección, y un ZIP numerado según el orden de importación recomendado.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <StructuredData faqs={DOUBTS} />
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-brand focus:text-white focus:font-medium focus:rounded-md focus:px-4 focus:py-2"
      >
        Saltar al contenido principal
      </a>
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-brand flex items-center justify-center text-white text-xs font-bold">
              OMI
            </div>
            <span className="font-extrabold text-lg tracking-tight">OMI Engine</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-graphite">
            <a href="#como-funciona" className="hover:text-ink transition-colors">Cómo funciona</a>
            <a href="#modulos" className="hover:text-ink transition-colors">Módulos</a>
            <a href="#latam" className="hover:text-ink transition-colors">LatAm</a>
            <a href="#precios" className="hover:text-ink transition-colors">Precios</a>
            <a href="#partners" className="hover:text-ink transition-colors">Partners</a>
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

      <section id="contenido" className="max-w-6xl mx-auto px-6 md:px-10 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-graphite border border-line rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-verify" />
              Para implementadores y consultoras Odoo
            </span>
            <h1 className="font-extrabold text-4xl md:text-5xl xl:text-6xl leading-[1.05] tracking-tight mb-6">
              Migrá a Odoo<br />
              <span className="text-brand">sin sorpresas</span>
            </h1>
            <p className="text-graphite text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
              Importar directo a Odoo es una apuesta: los datos rotos aparecen recién
              en producción. OMI los analiza antes -- duplicados, campos vacíos,
              relaciones que no existen en tu Odoo y todo lo que la versión que
              elegiste va a rechazar -- antes del Go Live.
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-4">
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
          </div>

          <div>
            <ProductDemo />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-12">
        <div className="max-w-6xl mx-auto px-6 md:px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {TRUST_POINTS.map((point) => (
            <div key={point.title} className="text-center sm:text-left">
              <p className="font-bold text-sm mb-1.5">{point.title}</p>
              <p className="text-sm text-graphite leading-relaxed">{point.body}</p>
            </div>
          ))}
        </div>
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
            Cada fila rota que no ves hoy es un problema en producción mañana. Elegís
            los módulos de tu implementación y OMI aplica solo las validaciones
            relevantes a cada uno.
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

      <section className="border-t border-line py-20">
        <div className="max-w-5xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Antes / Después
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-14">
            De un CSV roto a un archivo listo para Odoo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-line rounded-xl p-7 bg-alert-light/40">
              <p className="font-bold text-alert mb-4">Antes</p>
              <ul className="space-y-2.5 text-sm">
                {BEFORE_AFTER.before.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-alert shrink-0">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-line rounded-xl p-7 bg-verify-light/40">
              <p className="font-bold text-verify mb-4">Después</p>
              <ul className="space-y-2.5 text-sm">
                {BEFORE_AFTER.after.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-verify shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-t border-line bg-white/60 py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Proceso
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-14">
            Cómo funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
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

      <section className="border-t border-line py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Para quién es
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-14">
            Pensado para quien migra datos a Odoo en serio
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PERSONAS.map((persona) => (
              <div key={persona.title} className="bg-white border border-line rounded-xl p-5">
                <p className="font-bold mb-2">{persona.title}</p>
                <p className="text-sm text-graphite leading-relaxed">{persona.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="latam" className="border-t border-line bg-white/60 py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Localización
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-4">
            Hecho para implementaciones Odoo en Latinoamérica
          </h2>
          <p className="text-graphite text-center max-w-2xl mx-auto mb-6">
            Cada país tiene su propio addon oficial de localización dentro de Odoo
            (l10n_ar, l10n_mx, l10n_br...), con su propia estructura de campos. OMI
            lee ese addon real para Contactos, Contabilidad y Facturación -- no
            aplica la misma plantilla a todos los países.
          </p>
          <div className="flex justify-center mb-10">
            <LocalizationPulse />
          </div>
          <div className="flex flex-wrap justify-center gap-2.5 mb-6">
            {LATAM_COUNTRIES.map((country) => (
              <span
                key={country.code}
                className={`font-mono text-xs rounded-full px-3 py-1.5 border ${
                  country.code === "br"
                    ? "border-brand text-brand font-semibold"
                    : "border-line text-graphite"
                }`}
              >
                {country.name}
              </span>
            ))}
          </div>
          <p className="text-sm text-graphite text-center max-w-xl mx-auto mb-2">
            <span className="font-semibold text-ink">Brasil</span> ya tiene validación de
            datos activa -- la interfaz de OMI está en español; soporte en portugués,
            próximamente.
          </p>
          <p className="text-sm text-graphite text-center max-w-xl mx-auto">
            El resto de los módulos (CRM, Ventas, Inventario, Productos, Compras) valida
            contra las reglas de tu versión de Odoo sin importar el país.
          </p>
        </div>
      </section>

      <section className="border-t border-line py-20">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Antes de decidir
          </p>
          <h2 className="font-extrabold text-3xl tracking-tight text-center mb-12">
            Las dudas más comunes antes de migrar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DOUBTS.map((doubt) => (
              <div key={doubt.q} className="bg-white border border-line rounded-xl p-5">
                <p className="font-bold mb-1.5">{doubt.q}</p>
                <p className="text-sm text-graphite leading-relaxed">{doubt.a}</p>
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
          <p className="text-sm text-graphite mt-8">
            ¿Migrás con volumen real? Mirá el{" "}
            <a href="#partners" className="text-brand font-medium hover:underline">
              programa de partners
            </a>
            .
          </p>
        </div>
      </section>

      <section id="partners" className="border-t border-line py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
            Programa de partners
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">
            Para partners y consultoras que migran con volumen real
          </h2>
          <p className="text-graphite mb-10 max-w-xl mx-auto">
            No es otro plan de autoservicio -- es una activación directa con el
            equipo de OMI, pensada para quien necesita usar la herramienta muy por
            encima de un proyecto suelto.
          </p>
          <div className="bg-white border border-line rounded-xl p-8 text-left max-w-xl mx-auto mb-8">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-verify shrink-0">✓</span> Membresía anual: USD 499/año
              </li>
              <li className="flex items-start gap-2">
                <span className="text-verify shrink-0">✓</span> 5.000.000 de eventos por año (1 evento = 1 fila analizada)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-verify shrink-0">✓</span> Sin límite de proyectos ni exportes mientras dure la cuota
              </li>
              <li className="flex items-start gap-2">
                <span className="text-verify shrink-0">✓</span> Activación manual -- hablás directo con el equipo, no es autoservicio
              </li>
            </ul>
          </div>
          <a
            href="mailto:hello@alterego.lat?subject=Programa%20de%20Partners%20OMI"
            className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
          >
            Contactanos
          </a>
        </div>
      </section>

      <section className="border-t border-line bg-ink py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-white mb-4">
            ¿Importás directo, o sabés antes qué se va a romper?
          </h2>
          <p className="text-white/70 mb-8">
            Sin tarjeta, sin instalación. Subís un archivo y en segundos tenés el reporte completo.
          </p>
          <Link
            href="/app"
            className="inline-block bg-white text-ink font-semibold rounded-md px-8 py-3.5 hover:bg-canvas transition-colors"
          >
            Analizar mis datos gratis →
          </Link>
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
