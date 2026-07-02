import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { IntentCTASlot } from "@/components/IntentEngine";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/migraciones`;
const TITLE = "En qué orden migrar los datos a Odoo (y por qué importa)";
const DESCRIPTION =
  "El orden en que importás los módulos a Odoo afecta si las relaciones entre registros quedan bien armadas. Qué depende de qué, y cómo evitar importar en el orden equivocado.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const ORDER_GROUPS = [
  {
    step: "1",
    modules: "Contactos, Productos",
    body: "No dependen de ningún otro módulo -- van primero. Todo lo demás los referencia.",
  },
  {
    step: "2",
    modules: "CRM",
    body: "Depende de Contactos: cada oportunidad necesita un contacto ya existente para asociarse.",
  },
  {
    step: "3",
    modules: "Inventario",
    body: "Depende de Productos: no se puede tener stock de un producto que todavía no existe en el sistema.",
  },
  {
    step: "4",
    modules: "Ventas, Compras",
    body: "Dependen de Contactos y Productos: una orden necesita ambos ya cargados para tener sentido.",
  },
];

export default function MigracionesPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Migraciones", item: PAGE_URL },
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
            <span className="text-ink">Migraciones</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Importar "ventas" antes que "contactos" hace que Odoo rechace la orden, o
            la acepte sin el contacto asociado -- una relación vacía que después nadie
            nota hasta que alguien busca ese cliente y no aparece. El orden de
            importación entre módulos relacionados no es arbitrario.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Orden recomendado entre los módulos que dependen entre sí</h2>
          <div className="space-y-6 mb-12">
            {ORDER_GROUPS.map((g) => (
              <div key={g.step} className="flex gap-5">
                <div className="w-10 h-10 rounded-full bg-brand text-white font-bold flex items-center justify-center shrink-0">
                  {g.step}
                </div>
                <div>
                  <h3 className="font-bold mb-1">{g.modules}</h3>
                  <p className="text-graphite leading-relaxed">{g.body}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-graphite leading-relaxed mb-10">
            Facturación, Contabilidad y otros módulos con localización por país
            (l10n) tienen sus propias reglas de campos obligatorios, pero no
            dependencias de orden documentadas frente a estos cuatro grupos --
            conviene validarlos igual antes de importar, pero el orden relativo
            entre ellos es menos crítico.
          </p>

          <IntentCTASlot />

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">OMI arma este orden por vos</p>
            <p className="text-graphite mb-6">
              Cuando exportás un proyecto con varios módulos, el ZIP viene numerado
              según el orden de importación recomendado -- no hay que armarlo a mano.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/migraciones" />
        <SiteFooter />
      </main>
    </>
  );
}
