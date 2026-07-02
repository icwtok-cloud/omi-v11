import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/versiones`;
const TITLE = "Qué versión de Odoo tenés y qué implica migrarla";
const DESCRIPTION =
  "OMI valida datos para Odoo 14 a 19, incluyendo versiones sin soporte oficial. Qué significa que una versión esté fuera de soporte y qué cambia para tu migración.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const VERSIONS = [
  { v: "14.0", note: "Sin soporte oficial de Odoo -- la migración de datos tiene más urgencia que la de versiones activas." },
  { v: "15.0", note: "Sin soporte oficial de Odoo -- misma urgencia que 14.0." },
  { v: "16.0", note: "Soportada por OMI." },
  { v: "17.0", note: "Soportada por OMI." },
  { v: "18.0", note: "Soportada por OMI." },
  { v: "19.0", note: "Soportada por OMI." },
];

export default function VersionesPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Versiones", item: PAGE_URL },
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
            <span className="text-ink">Versiones</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Odoo publica soporte oficial (parches de seguridad y correcciones) solo
            durante un período limitado después de lanzar cada versión. Pasado ese
            período, la versión sigue funcionando -- pero cualquier problema nuevo que
            aparezca no se corrige más de forma oficial. Eso no cambia cómo se prepara
            un archivo para importar, pero sí la urgencia de migrar.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Versiones que valida OMI</h2>
          <div className="border border-line rounded-xl overflow-hidden mb-10">
            {VERSIONS.map((item, i) => (
              <div
                key={item.v}
                className={`flex items-center gap-4 px-6 py-4 ${i !== VERSIONS.length - 1 ? "border-b border-line" : ""}`}
              >
                <span className="font-mono font-bold text-lg w-16 shrink-0">{item.v}</span>
                <span className="text-sm text-graphite">{item.note}</span>
              </div>
            ))}
          </div>

          <h2 className="font-bold text-2xl tracking-tight mb-5">¿La versión importa para preparar los datos?</h2>
          <p className="text-graphite leading-relaxed mb-4">
            Sí, directamente. Los campos obligatorios, los modelos disponibles y las
            reglas de cada módulo cambian entre versiones de Odoo. OMI genera las
            reglas de validación leyendo el código fuente real de la versión que
            elegís -- no aplica una checklist genérica para todas.
          </p>
          <p className="text-graphite leading-relaxed mb-10">
            Si no estás seguro de qué versión corrés, se ve en Ajustes {">"} Información
            técnica dentro de tu instancia de Odoo (con el modo desarrollador activado),
            o preguntándole a quien la administra.
          </p>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Validá tus datos contra tu versión real</p>
            <p className="text-graphite mb-6">
              Elegís la versión y el módulo, subís el archivo, y OMI valida contra las
              reglas exactas de esa combinación.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/versiones" />
        <SiteFooter />
      </main>
    </>
  );
}
