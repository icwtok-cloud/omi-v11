import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/compatibilidad`;
const TITLE = "Qué módulos y países soporta OMI para migrar a Odoo";
const DESCRIPTION =
  "OMI valida 8 módulos de Odoo (Contactos, CRM, Ventas, Facturación, Inventario, Productos, Contabilidad, Compras) en 15 países de LatAm, versiones 14 a 19.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const MODULES = [
  { name: "Contactos", scoped: true },
  { name: "CRM", scoped: false },
  { name: "Ventas", scoped: false },
  { name: "Facturación", scoped: true },
  { name: "Inventario", scoped: false },
  { name: "Productos", scoped: false },
  { name: "Contabilidad", scoped: true },
  { name: "Compras", scoped: false },
];

const COUNTRIES = [
  "Argentina", "Bolivia", "Brasil", "Chile", "Colombia", "Costa Rica",
  "Rep. Dominicana", "Ecuador", "Guatemala", "México", "Panamá", "Perú",
  "Paraguay", "Uruguay", "Venezuela",
];

export default function CompatibilidadPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Compatibilidad", item: PAGE_URL },
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
            <span className="text-ink">Compatibilidad</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            OMI genera sus reglas de validación leyendo el código fuente real de Odoo
            -- por eso el soporte está limitado a los módulos y versiones donde ya se
            generaron esas reglas, no a todo Odoo en general.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Módulos soportados</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {MODULES.map((m) => (
              <div key={m.name} className="bg-white border border-line rounded-lg p-4 text-center">
                <p className="font-semibold text-sm">{m.name}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-graphite mb-10">
            Contactos, Facturación y Contabilidad tienen reglas adicionales según el
            país que elijas -- los otros cinco módulos validan igual en cualquier país.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Países con localización LatAm</h2>
          <div className="flex flex-wrap gap-2 mb-10">
            {COUNTRIES.map((c) => (
              <span key={c} className="bg-canvas border border-line rounded-full px-3 py-1.5 text-sm">
                {c}
              </span>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">¿Tu módulo y país están soportados?</p>
            <p className="text-graphite mb-6">
              Elegilos en el formulario y confirmalo en segundos, sin costo.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/compatibilidad" />
        <SiteFooter />
      </main>
    </>
  );
}
