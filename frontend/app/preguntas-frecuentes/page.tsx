import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";
import { DOUBTS } from "@/lib/faq-data";

const PAGE_URL = `${SITE_URL}/preguntas-frecuentes`;
const TITLE = "Preguntas frecuentes sobre OMI y migraciones a Odoo";
const DESCRIPTION =
  "Respuestas directas sobre cómo funciona OMI: qué hace con tus datos, cómo se paga, qué versiones de Odoo soporta y por qué no usa IA para validar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

export default function PreguntasFrecuentesPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Preguntas frecuentes", item: PAGE_URL },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: DOUBTS.map((doubt) => ({
      "@type": "Question",
      name: doubt.q,
      acceptedAnswer: { "@type": "Answer", text: doubt.a },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Preguntas frecuentes</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-graphite leading-relaxed mb-12 max-w-2xl">{DESCRIPTION}</p>

          <div className="space-y-6">
            {DOUBTS.map((doubt) => (
              <div key={doubt.q} className="border-b border-line pb-6">
                <h2 className="font-bold text-lg mb-2">{doubt.q}</h2>
                <p className="text-graphite leading-relaxed">{doubt.a}</p>
              </div>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center mt-12">
            <p className="font-bold text-lg mb-2">¿Tenés otra pregunta?</p>
            <p className="text-graphite mb-6">
              Probá con tu propio archivo -- es gratis y no requiere tarjeta ni wallet.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/preguntas-frecuentes" />
        <SiteFooter />
      </main>
    </>
  );
}
