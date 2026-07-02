import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/comparativas/excel-vs-omi`;
const TITLE = "Limpiar datos en Excel vs. validarlos con OMI antes de migrar a Odoo";
const DESCRIPTION =
  "Excel limpia lo que vos le decís que limpie. OMI valida contra las reglas reales de tu versión de Odoo. En qué se parecen, en qué no, y cuándo alcanza con uno solo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const ROWS = [
  {
    label: "Detecta formatos rotos (emails, teléfonos)",
    excel: "Con una fórmula o macro que vos armás",
    omi: "Automático, contra reglas ya definidas",
  },
  {
    label: "Sabe qué campos son obligatorios en tu versión de Odoo",
    excel: "No -- necesitás saberlo vos y codificarlo",
    omi: "Sí, generado leyendo el código fuente real de esa versión",
  },
  {
    label: "Valida contra las categorías/etapas/monedas que existen en tu instancia real",
    excel: "No, a menos que las cargues a mano como referencia",
    omi: "Sí, si tenés esa información disponible en el proyecto",
  },
  {
    label: "Detecta duplicados en toda la columna (SKU, CUIT, código de barras)",
    excel: "Con una fórmula (condicional o tabla dinámica)",
    omi: "Automático, agrupado por tipo de problema",
  },
  {
    label: "Da un número único de qué tan lista está la migración",
    excel: "No",
    omi: "Sí -- Quality Score de 0 a 100",
  },
  {
    label: "Requiere saber programar o usar fórmulas avanzadas",
    excel: "Sí, para los casos anteriores",
    omi: "No",
  },
];

export default function ExcelVsOmiPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Comparativas", item: `${SITE_URL}/comparativas` },
      { "@type": "ListItem", position: 3, name: "Excel vs OMI", item: PAGE_URL },
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
            <span className="text-ink">Excel vs OMI</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            No son excluyentes -- OMI no reemplaza a Excel como herramienta, valida lo
            que Excel no puede saber por sí solo: las reglas reales de la versión de
            Odoo a la que vas a importar. Esta tabla compara qué resuelve cada uno.
          </p>

          <div className="border border-line rounded-xl overflow-hidden mb-10">
            <div className="grid grid-cols-3 bg-canvas border-b border-line text-sm font-bold">
              <div className="p-4">Qué necesitás hacer</div>
              <div className="p-4 border-l border-line">Excel</div>
              <div className="p-4 border-l border-line">OMI</div>
            </div>
            {ROWS.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 text-sm ${i !== ROWS.length - 1 ? "border-b border-line" : ""}`}
              >
                <div className="p-4 font-medium">{row.label}</div>
                <div className="p-4 border-l border-line text-graphite">{row.excel}</div>
                <div className="p-4 border-l border-line text-graphite">{row.omi}</div>
              </div>
            ))}
          </div>

          <p className="text-graphite leading-relaxed mb-10">
            Excel no sabe qué campos son obligatorios en tu versión de Odoo, ni qué
            etapas o categorías existen en tu instancia real. OMI valida contra esas
            reglas reales, no contra una checklist genérica que armaste vos mismo.
          </p>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Probalo sobre el mismo archivo que ya limpiaste en Excel</p>
            <p className="text-graphite mb-6">
              Es gratis y no requiere tarjeta ni wallet.
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
