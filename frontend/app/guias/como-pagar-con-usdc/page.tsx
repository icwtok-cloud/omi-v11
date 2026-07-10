import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/guias/como-pagar-con-usdc`;
const TITLE = "Cómo pagar en OMI con USDC (si nunca usaste una wallet)";
const DESCRIPTION =
  "Guía paso a paso para consultores e implementadores que nunca pagaron con criptomonedas: qué es USDC, cómo instalar MetaMask, cómo conseguir USDC en Polygon o Base y cómo funciona el pago en OMI.";

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

const STEPS = [
  {
    title: "1. Instalá una wallet (MetaMask)",
    body: "OMI se conecta con MetaMask, una extensión de navegador gratuita que actúa como tu billetera. Instalala desde metamask.io o desde la tienda de extensiones de tu navegador, creá una wallet nueva y guardá la frase de recuperación (12 palabras) en un lugar seguro y offline -- quien tenga esa frase controla los fondos, así que no la compartas ni la guardes en texto plano en la nube.",
  },
  {
    title: "2. Conseguí USDC en un exchange",
    body: "USDC es una stablecoin: su valor está atado 1 a 1 al dólar, no fluctúa como Bitcoin o Ethereum. Podés comprarla con tarjeta o transferencia en la mayoría de los exchanges conocidos (Binance, Coinbase, Lemon, Belo, entre otros según tu país). No recomendamos uno en particular -- comparná comisiones y verificá que el exchange esté disponible en tu país antes de elegir.",
  },
  {
    title: "3. Retirá el USDC a tu wallet, en la red correcta",
    body: "Al retirar del exchange a tu MetaMask, el exchange te va a pedir elegir una red (network). OMI acepta pagos en dos redes: Polygon o Base. Elegí la misma red que vas a seleccionar después en OMI -- si el exchange solo ofrece una de las dos, usá esa y elegí la misma en el checkout de OMI. Retirar a la red equivocada no es recuperable automáticamente.",
  },
  {
    title: "4. Pagá desde OMI",
    body: "En el checkout de tu proyecto, elegís la red (Polygon o Base), OMI te muestra un monto exacto (con una micro-variación de hasta 4 decimales, por ejemplo $99.0034) y una dirección de destino. Conectás tu MetaMask y confirmás la transacción -- el monto tiene que coincidir exactamente, es lo que nos permite identificar tu pago sin pedirte más datos.",
  },
  {
    title: "5. Esperá la confirmación",
    body: "Una vez enviada la transacción, la confirmación en la red puede tardar uno o dos minutos (esperamos las confirmaciones de bloque para protegernos de reorganizaciones de la cadena). No hace falta que te quedes con la pestaña abierta -- si volvés después, OMI retoma el estado del pago pendiente automáticamente.",
  },
];

const FAQS = [
  {
    q: "¿Necesito tener criptomonedas para usar OMI?",
    a: "No para ver el reporte. El primer proyecto (1 módulo) es gratis, incluye reporte completo y una descarga, sin wallet ni pago. Solo necesitás USDC si vas a exportar un proyecto adicional o una suscripción mensual.",
  },
  {
    q: "¿Por qué USDC y no tarjeta de crédito?",
    a: "Hoy el único método de pago es USDC en Polygon o Base -- no procesamos ni guardamos datos de tarjeta. Estamos sumando un método de pago con tarjeta/fiat; cuando esté disponible se va a poder pagar sin wallet.",
  },
  {
    q: "¿Qué pasa si me equivoco de red al retirar del exchange?",
    a: "Si el USDC llega a una red distinta de Polygon o Base, no vas a poder pagar en OMI directamente con ese saldo -- necesitás moverlo (bridge) a una de las dos redes soportadas o retirarlo de nuevo desde el exchange en la red correcta. Revisá dos veces la red antes de confirmar el retiro.",
  },
  {
    q: "¿El monto exacto con decimales es un error?",
    a: "No. Por ejemplo, ver $99.0034 en vez de $99.00 es intencional: esa micro-variación es lo que usamos para identificar automáticamente qué pago corresponde a qué usuario, ya que todos los pagos llegan a la misma dirección.",
  },
];

export default function ComoPagarConUsdcGuide() {
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
            <span className="text-ink">Cómo pagar con USDC</span>
          </nav>

          <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
            Guía · Pagos
          </p>
          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-6">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Si nunca pagaste con criptomonedas, esto puede sonar más complicado de lo
            que es. No hace falta que entiendas blockchain -- con una wallet (MetaMask)
            y USDC en la red correcta, el pago en OMI se hace en un par de clicks.
            Esta guía asume que arrancás de cero.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Paso a paso</h2>
          <div className="space-y-6 mb-12">
            {STEPS.map((step) => (
              <div key={step.title} className="border-l border-brand pl-5">
                <h3 className="font-bold mb-1.5">{step.title}</h3>
                <p className="text-graphite leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Preguntas frecuentes</h2>
          <div className="space-y-6 mb-12">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <h3 className="font-bold mb-1.5">{faq.q}</h3>
                <p className="text-graphite leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-graphite mb-10">
            Esta guía es informativa y no constituye asesoramiento financiero ni de
            inversión -- no recomendamos un exchange ni un monto para comprar. Verificá
            comisiones, disponibilidad en tu país y la reputación del exchange que
            elijas antes de operar.
          </p>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">¿Ya tenés USDC listo?</p>
            <p className="text-graphite mb-6">
              Probá OMI gratis con tu primer módulo -- recién necesitás USDC si exportás
              un proyecto adicional.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </article>
        <RelatedHubs currentHref="/guias/como-pagar-con-usdc" />
        <SiteFooter />
      </main>
    </>
  );
}
