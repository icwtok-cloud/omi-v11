import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/glosario`;
const TITLE = "Glosario de migración de datos a Odoo";
const DESCRIPTION =
  "Qué significan External ID, SKU, Quality Score, l10n y otros términos que aparecen al preparar o migrar datos a Odoo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const TERMS = [
  {
    term: "External ID",
    def: "Identificador único de un registro dentro de Odoo, con formato módulo.nombre. Se usa en la columna id de un import para que reimportar el mismo archivo actualice el registro existente en vez de duplicarlo.",
  },
  {
    term: "SKU / código interno (default_code)",
    def: "Código que identifica un producto de forma única dentro de tu catálogo. Si dos productos distintos comparten el mismo SKU, Odoo puede confundir el stock o la venta de uno con el del otro.",
  },
  {
    term: "l10n (localización)",
    def: "Addon de Odoo que adapta un módulo a las reglas de un país específico -- por ejemplo, l10n_ar para Argentina o l10n_mx para México. Extiende módulos base como Contactos o Facturación con campos y validaciones propias de ese país.",
  },
  {
    term: "Quality Score",
    def: "Número de 0 a 100 que resume qué tan lista está un archivo para importar a Odoo, calculado a partir de la cantidad y severidad de los problemas detectados.",
  },
  {
    term: "Mapeo de columnas",
    def: "Proceso de hacer corresponder los nombres de columna de tu archivo (que pueden estar en cualquier idioma o formato) con los campos técnicos reales que Odoo espera para ese módulo.",
  },
  {
    term: "Fix automático",
    def: "Corrección que se puede aplicar sin ambigüedad -- por ejemplo, un espacio de más en un email. Se aplica recién al generar el archivo de descarga, nunca sobre el archivo original.",
  },
  {
    term: "Revisión manual",
    def: "Caso que requiere criterio de negocio para resolverse -- por ejemplo, un precio en cero que podría ser un error o podría ser real. Queda marcado para que decidas vos, no se corrige solo.",
  },
  {
    term: "Módulo (en el contexto de OMI)",
    def: "Agrupación de datos por área funcional de Odoo: Contactos, CRM, Ventas, Facturación, Inventario, Productos, Contabilidad o Compras. No debe confundirse con un módulo/addon de código Odoo.",
  },
];

export default function GlosarioPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Glosario", item: PAGE_URL },
    ],
  };

  const definedTermSetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: TITLE,
    url: PAGE_URL,
    hasDefinedTerm: TERMS.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.def,
    })),
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSetJsonLd) }}
      />
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Glosario</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-graphite leading-relaxed mb-12 max-w-2xl">{DESCRIPTION}</p>

          <dl className="space-y-6">
            {TERMS.map((t) => (
              <div key={t.term} className="border-b border-line pb-6">
                <dt className="font-bold text-lg mb-1.5">{t.term}</dt>
                <dd className="text-graphite leading-relaxed">{t.def}</dd>
              </div>
            ))}
          </dl>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
