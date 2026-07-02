import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/desarrollo`;
const TITLE = "Migrar addons, módulos personalizados y código de Odoo: qué NO hace OMI";
const DESCRIPTION =
  "OMI valida archivos de datos (CSV/Excel) antes de importarlos a Odoo. No migra código, XML, vistas ni módulos personalizados -- acá te decimos qué sí resuelve y qué necesitás para lo otro.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

export default function DesarrolloPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Desarrollo", item: PAGE_URL },
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
            <span className="text-ink">Desarrollo</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Si llegaste buscando cómo actualizar módulos personalizados, migrar XML,
            adaptar el ORM entre versiones o portar vistas y automatizaciones de
            Studio: eso es trabajo de desarrollo sobre código, y OMI no lo hace. Es
            justo que lo sepas antes de perder tiempo, en vez de que lo descubras
            después de subir un archivo.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Qué sí hace OMI</h2>
          <p className="text-graphite leading-relaxed mb-4">
            Valida archivos CSV o Excel con datos -- contactos, productos, órdenes,
            asientos contables -- contra las reglas reales del módulo y la versión de
            Odoo a la que vas a importarlos. Es una capa de preparación de datos, no
            de migración de código.
          </p>
          <p className="text-graphite leading-relaxed mb-10">
            Si tu módulo personalizado agrega campos nuevos a un modelo existente
            (por ejemplo, un campo extra en Contactos), esos campos no forman parte
            de las reglas que OMI conoce hoy -- valida contra los campos estándar de
            Odoo para ese módulo y versión.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Qué necesitás para lo otro</h2>
          <p className="text-graphite leading-relaxed mb-10">
            La actualización de código entre versiones de Odoo (addons, ORM, vistas,
            seguridad, automatizaciones) es trabajo de un desarrollador Odoo o de tu
            partner de implementación, con las herramientas de desarrollo propias del
            ecosistema. OMI entra después de eso: cuando ya sabés a qué módulos y
            campos vas a importar, y necesitás asegurarte de que los datos lleguen
            limpios.
          </p>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">¿Ya tenés el módulo listo y necesitás preparar los datos?</p>
            <p className="text-graphite mb-6">
              Ahí sí podemos ayudarte -- gratis para el primer proyecto.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analizar mis datos gratis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/desarrollo" />
        <SiteFooter />
      </main>
    </>
  );
}
