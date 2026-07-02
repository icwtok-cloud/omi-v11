import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/datos`;
const TITLE = "Datos duplicados, sin SKU o con volumen alto: cómo prepararlos para Odoo";
const DESCRIPTION =
  "Cómo detectar duplicados, códigos faltantes y archivos con miles de filas antes de importarlos a Odoo -- sin revisar fila por fila a mano.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const CASES = [
  {
    title: "Tengo códigos o identificadores duplicados",
    body: "Un mismo código interno (SKU), CUIT/RFC/RUT, código de barras o de cuenta contable repetido entre filas suele pasar desapercibido en Excel -- hasta que Odoo lo rechaza o, peor, sobrescribe un registro con otro. OMI compara toda la columna, no fila por fila, y marca cada valor que debería ser único y no lo es.",
  },
  {
    title: "No tengo código interno (SKU) en algunas filas",
    body: "Si un campo que Odoo necesita como identificador viene vacío, no se genera un valor al azar en tu lugar: la fila queda marcada como pendiente para que decidas vos qué código le corresponde antes de exportar. OMI valida, no adivina datos de negocio.",
  },
  {
    title: "Tengo un archivo con miles de filas",
    body: "Revisar 80.000 productos línea por línea a mano no es viable. OMI agrupa cada tipo de problema (duplicados, formatos, relaciones que no existen) en una sola vista -- vas por tipo de error, no por fila, y el Quality Score te dice de un vistazo qué tan lista está la migración.",
  },
];

export default function DatosPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Datos", item: PAGE_URL },
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
            <span className="text-ink">Datos</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Estos tres problemas aparecen en casi cualquier migración con datos reales
            -- no son casos raros. Así los aborda OMI, sin modificar tu archivo
            original y sin inventar ningún dato de negocio.
          </p>

          <div className="space-y-8 mb-12">
            {CASES.map((c) => (
              <div key={c.title} className="border-l border-brand pl-5">
                <h2 className="font-bold text-lg mb-1.5">{c.title}</h2>
                <p className="text-graphite leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">¿Cuántos duplicados tiene tu archivo?</p>
            <p className="text-graphite mb-6">
              Subilo y en segundos tenés el detalle exacto, agrupado por tipo de problema.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/datos" />
        <SiteFooter />
      </main>
    </>
  );
}
