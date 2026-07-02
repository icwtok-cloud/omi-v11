import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/empresas`;
const TITLE = "Preparar tu empresa para migrar a Odoo: qué preguntar antes de empezar";
const DESCRIPTION =
  "Cuánto cuesta, cuánto tarda y qué pasa con inventario, ventas, compras, CRM y contabilidad al migrar a Odoo -- respuestas directas para quien decide, no solo para quien implementa.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const QUESTIONS = [
  {
    q: "¿Voy a perder información en la migración?",
    a: "El riesgo no está en Odoo -- está en los datos que le das de comer. Si un archivo tiene relaciones que no existen en tu instancia (una categoría, una etapa, una moneda), Odoo no inventa el dato: lo rechaza o lo deja incompleto. Validar antes de importar es lo que evita que eso pase en producción.",
  },
  {
    q: "¿Qué pasa con Inventario si migro con errores?",
    a: "SKUs duplicados entre depósitos hacen que el stock se descuente del producto equivocado -- un problema que recién se nota cuando el número no cierra, no en el momento de importar.",
  },
  {
    q: "¿Qué pasa con Ventas y Facturación?",
    a: "Un precio en cero que pasa desapercibido se factura tal cual. Una moneda no configurada deja la factura en un limbo que contabilidad no puede cerrar. Ninguno de los dos da un error visible al importar -- aparecen después.",
  },
  {
    q: "¿Cuánto cuesta validar los datos antes de migrar?",
    a: "El reporte completo es gratis para un proyecto de un módulo. Exportar el archivo corregido tiene un costo por proyecto o por suscripción mensual si migrás con volumen -- sin tarjeta de crédito, se paga en USDC.",
  },
  {
    q: "¿Cuánto tarda?",
    a: "El análisis de un archivo toma segundos, no horas. El tiempo real lo definen las decisiones que quedan para vos -- los casos que OMI marca como \"requiere revisión manual\" porque no puede decidir por criterio de negocio.",
  },
];

export default function EmpresasPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Empresas", item: PAGE_URL },
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
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Empresas</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Quien decide una migración no siempre es quien la ejecuta -- y las preguntas
            que importan son distintas. Estas son las que más se repiten antes de dar
            el visto bueno.
          </p>

          <div className="space-y-8">
            {QUESTIONS.map((item) => (
              <div key={item.q} className="border-b border-line pb-6">
                <h2 className="font-bold text-lg mb-2">{item.q}</h2>
                <p className="text-graphite leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center mt-12">
            <p className="font-bold text-lg mb-2">Vé el estado real de tus datos antes de decidir</p>
            <p className="text-graphite mb-6">
              El reporte completo es gratis -- no requiere compromiso para verlo.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/empresas" />
        <SiteFooter />
      </main>
    </>
  );
}
