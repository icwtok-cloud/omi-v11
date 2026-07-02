import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/site";
import { PAIN_CARDS } from "@/lib/pain-cards-data";

const PAGE_URL = `${SITE_URL}/casos-frecuentes`;
const TITLE = "Casos frecuentes de errores al migrar datos a Odoo, por módulo";
const DESCRIPTION =
  "Los errores más comunes en Contactos, CRM, Ventas, Facturación, Inventario, Productos, Contabilidad y Compras al migrar a Odoo, y su consecuencia real si no se detectan antes de importar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

export default function CasosFrecuentesPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Casos frecuentes", item: PAGE_URL },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Casos frecuentes</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-graphite leading-relaxed mb-12 max-w-2xl">{DESCRIPTION}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PAIN_CARDS.map((card) => (
              <div key={card.module} className="bg-white border border-line rounded-xl p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-2">
                  {card.module}
                </p>
                <h2 className="font-bold text-lg mb-2">{card.pain}</h2>
                <p className="text-sm text-graphite leading-relaxed mb-3">
                  <span className="font-semibold text-ink">Consecuencia: </span>
                  {card.consequence}
                </p>
                <p className="text-sm text-verify leading-relaxed">
                  <span className="font-semibold">Cómo lo aborda OMI: </span>
                  {card.fix}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center mt-12">
            <p className="font-bold text-lg mb-2">¿Tu archivo tiene alguno de estos?</p>
            <p className="text-graphite mb-6">
              Subilo y en segundos sabés exactamente cuáles, sin revisar fila por fila.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
