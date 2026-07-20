import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/afiliados`;
const TITLE = "Programa de afiliados de OMI -- ganá comisión por cada referido";
const DESCRIPTION =
  "Sumate al programa de afiliados de OMI. Compartís tu link, tu referido paga un proyecto, una suscripción o el plan anual, y vos cobrás comisión automática.";

const AFFILIATE_PORTAL_URL = "https://omilat.lemonsqueezy.com/affiliates";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const STEPS = [
  {
    label: "Aplicá",
    text: "Entrás al portal de afiliados y te das de alta -- es gratis, no hay cuota ni mínimo de ventas.",
  },
  {
    label: "Compartí tu link",
    text: "Lemon Squeezy te da un link único. Se lo pasás a quien vos quieras: una consultora, un colega, tu propia audiencia.",
  },
  {
    label: "Cobrás",
    text: "Cuando alguien entra por tu link y paga (por proyecto, mensual o anual), la comisión se calcula y se paga sola -- vos no hacés ninguna cuenta.",
  },
];

export default function AfiliadosPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Afiliados", item: PAGE_URL },
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

        {/* Banner / hero */}
        <section className="border-b border-line bg-ink text-paper">
          <div className="max-w-4xl mx-auto px-6 md:px-10 py-20 text-center">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-paper/70 border border-paper/25 rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-verify" />
              Programa de afiliados
            </span>
            <h1 className="font-extrabold text-3xl md:text-5xl tracking-tight mb-5">
              Referí OMI. Cobrá comisión.
            </h1>
            <p className="text-paper/70 text-lg max-w-xl mx-auto mb-10">
              Si conocés gente que migra a Odoo -- consultoras, implementadores,
              colegas -- referilos y ganá comisión por cada pago que hagan, sin
              límite de referidos.
            </p>
            <a
              href={AFFILIATE_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-brand text-white font-semibold rounded-md px-8 py-4 text-lg hover:bg-brand-dark transition-colors"
            >
              Sumarme al programa →
            </a>
            <p className="text-paper/50 text-xs mt-4">
              Te lleva al portal de afiliados (Lemon Squeezy) para darte de alta.
            </p>
          </div>
        </section>

        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-10">
            <Link href="/" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Afiliados</span>
          </nav>

          <h2 className="font-extrabold text-2xl tracking-tight mb-8">Cómo funciona</h2>
          <div className="space-y-8 mb-14">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex gap-5">
                <div className="shrink-0 w-9 h-9 rounded-full bg-verify-light text-verify font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <div>
                  <p className="font-bold text-lg mb-1">{step.label}</p>
                  <p className="text-graphite leading-relaxed">{step.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-line pt-10">
            <h2 className="font-extrabold text-2xl tracking-tight mb-4">Preguntas frecuentes</h2>
            <div className="space-y-6">
              <div>
                <p className="font-bold mb-1">¿Cuánto cuesta sumarme?</p>
                <p className="text-graphite leading-relaxed">Nada. No hay cuota ni compromiso de ventas mínimas.</p>
              </div>
              <div>
                <p className="font-bold mb-1">¿Con qué planes gano comisión?</p>
                <p className="text-graphite leading-relaxed">
                  Con cualquier pago que haga tu referido a través de tu link: por
                  proyecto, suscripción mensual o plan anual.
                </p>
              </div>
              <div>
                <p className="font-bold mb-1">¿Cómo y cuándo cobro?</p>
                <p className="text-graphite leading-relaxed">
                  El seguimiento de clicks, referidos y pagos lo maneja el propio
                  portal de afiliados -- ahí ves tu historial completo y tus cobros.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center mt-14">
            <p className="font-bold text-lg mb-2">Listo para arrancar</p>
            <p className="text-graphite mb-6">
              Te toma dos minutos darte de alta en el portal de afiliados.
            </p>
            <a
              href={AFFILIATE_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Ir al portal de afiliados →
            </a>
          </div>
        </div>

        <SiteFooter />
      </main>
    </>
  );
}
