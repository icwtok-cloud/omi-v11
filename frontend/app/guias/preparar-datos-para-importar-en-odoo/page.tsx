import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { IntentCTASlot } from "@/components/IntentEngine";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/guias/preparar-datos-para-importar-en-odoo`;
const TITLE = "Cómo preparar un archivo Excel o CSV para importar en Odoo";
const DESCRIPTION =
  "Guía práctica para preparar datos antes de importarlos a Odoo: qué revisa el importador nativo, los errores más comunes por módulo y cómo evitarlos antes de subir el archivo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "article",
    url: PAGE_URL,
    title: TITLE,
    description: DESCRIPTION,
  },
};

const CHECKS = [
  {
    title: "Los headers coinciden con los campos reales de Odoo",
    body: "El importador nativo de Odoo (Configuración > Técnico > Importar/Exportar, o el asistente al subir un archivo) mapea columnas por nombre. Si tu Excel dice \"Correo\" y Odoo espera \"email\", el mapeo automático falla o queda vacío silenciosamente.",
  },
  {
    title: "Las relaciones existen en tu instancia, no en la genérica",
    body: "Una categoría de producto, una etapa de CRM o una moneda que \"debería\" existir puede no estar dada de alta en tu base real. Odoo no inventa el valor: rechaza la fila o la deja sin esa relación.",
  },
  {
    title: "Cada fila tiene un identificador único (External ID)",
    body: "Sin una columna id (External ID) o una clave única real (como el email en Contactos), reimportar el mismo archivo dos veces puede crear registros duplicados en lugar de actualizar los existentes.",
  },
  {
    title: "Los formatos de número y fecha son consistentes",
    body: "Separador decimal, formato de fecha y encoding del archivo (UTF-8) varían según de dónde exportaste el Excel. Una inconsistencia entre filas hace que Odoo interprete mal el valor en unas y en otras no.",
  },
  {
    title: "No hay filas con campos obligatorios vacíos",
    body: "Cada módulo tiene campos que Odoo exige para crear el registro (por ejemplo, precio en Ventas o proveedor en Compras). Una celda vacía ahí no siempre da un error visible antes de la importación real.",
  },
];

export default function PrepararDatosGuide() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guías", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: TITLE, item: PAGE_URL },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: PAGE_URL,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <main className="min-h-screen">
        <SiteHeader />
        <article className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <Link href="/guias" className="hover:text-ink transition-colors">Guías</Link>
            {" / "}
            <span className="text-ink">Preparar datos para importar</span>
          </nav>

          <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
            Guía · Preparación de datos
          </p>
          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-6">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            La mayoría de los imports a Odoo no fallan por un problema del ERP -- fallan
            porque el archivo llega con supuestos que no se cumplen en esa instancia
            específica. Esta guía repasa qué revisar antes de subir un CSV o Excel, sin
            asumir que ya sabés qué es un External ID o un mapeo de columnas.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Qué revisar antes de importar</h2>
          <div className="space-y-6 mb-12">
            {CHECKS.map((check) => (
              <div key={check.title} className="border-l border-brand pl-5">
                <h3 className="font-bold mb-1.5">{check.title}</h3>
                <p className="text-graphite leading-relaxed">{check.body}</p>
              </div>
            ))}
          </div>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Cómo lo aborda OMI</h2>
          <p className="text-graphite leading-relaxed mb-4">
            OMI valida tu archivo contra las reglas reales del módulo y la versión de
            Odoo que elegiste (14 a 19), generadas leyendo el código fuente de Odoo, no
            una checklist genérica. Agrupa cada problema por tipo, aplica los fixes que
            puede resolver de forma automática y marca para revisión manual los que
            requieren tu criterio -- por ejemplo, un precio en cero que podría ser un
            error o podría ser real.
          </p>
          <p className="text-graphite leading-relaxed mb-10">
            El resultado es un Quality Score de 0 a 100, un reporte técnico en PDF y un
            archivo corregido, numerado según el orden de importación recomendado entre
            módulos relacionados. Nada de esto usa IA: es determinístico, así que el
            mismo archivo produce siempre el mismo resultado.
          </p>

          <IntentCTASlot />

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">¿Querés ver esto sobre tu propio archivo?</p>
            <p className="text-graphite mb-6">
              Subís un CSV o Excel y en segundos tenés el reporte completo, sin costo.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </article>
        <RelatedHubs currentHref="/guias/preparar-datos-para-importar-en-odoo" />
        <SiteFooter />
      </main>
    </>
  );
}
