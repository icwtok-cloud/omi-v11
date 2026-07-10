import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/privacidad`;
const TITLE = "Privacidad y datos en OMI";
const DESCRIPTION =
  "Qué hace OMI con el archivo que subís, cuánto tiempo lo guarda y cómo pedir que se borre.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const SECTIONS = [
  {
    title: "Qué subís y para qué se usa",
    body: "Tu archivo (CSV o Excel) se usa exclusivamente para validarlo contra las reglas de la versión de Odoo y el módulo que elegiste, y para generar el archivo corregido que descargás. No se usa para entrenar ningún modelo ni se comparte con terceros -- OMI valida con reglas determinísticas leídas del código fuente de Odoo, no con IA.",
  },
  {
    title: "Cuánto tiempo se guarda",
    body: "Tu archivo (original y corregido) queda asociado a tu cuenta mientras el proyecto exista -- así podés volver, agregar más módulos o volver a descargar sin resubir nada. No se borra automáticamente al generar la descarga. Si querés que borremos un proyecto y sus archivos, escribinos y lo hacemos a pedido.",
  },
  {
    title: "Quién puede ver tus datos",
    body: "Solo vos, autenticado con tu cuenta (Clerk). El equipo de OMI puede acceder a un proyecto puntual únicamente para diagnosticar un problema técnico que reportaste, nunca de forma rutinaria.",
  },
  {
    title: "Pagos",
    body: "El pago por proyecto o suscripción se hace en USDC (Polygon o Base) directo desde tu wallet -- OMI no procesa ni guarda datos de tarjeta. Estamos sumando un método de pago con tarjeta/fiat; cuando esté disponible, esta página se actualiza con el procesador correspondiente.",
  },
  {
    title: "Borrado de datos",
    body: "Podés pedir el borrado de un proyecto (archivo original, corregido y reporte) en cualquier momento escribiendo a hello@alterego.lat. Lo hacemos manualmente en esta etapa del producto -- todavía no hay un botón de autoservicio para esto.",
  },
  {
    title: "Reembolsos",
    body: "Un pago en USDC ya confirmado no se reembolsa -- es una limitación real de pagar directo entre wallets, sin un intermediario que pueda revertir la transacción. Esto no significa que quedes sin lo que pagaste: una vez confirmado el pago, la descarga del proyecto queda disponible para volver a generarla las veces que necesites, sin cargo adicional. Si la descarga falla o el archivo corregido no se genera, intentá de nuevo desde el proyecto -- si el problema persiste, escribinos a hello@alterego.lat y lo resolvemos manualmente (evaluamos cada caso: reintento asistido, corrección del problema puntual, o un proyecto de cortesía si corresponde). No ofrecemos devolución del USDC en ningún caso.",
  },
];

export default function PrivacidadPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Privacidad", item: PAGE_URL },
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
            <span className="text-ink">Privacidad</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-graphite leading-relaxed mb-12 max-w-2xl">{DESCRIPTION}</p>

          <div className="space-y-8">
            {SECTIONS.map((s) => (
              <div key={s.title} className="border-b border-line pb-6">
                <h2 className="font-bold text-lg mb-2">{s.title}</h2>
                <p className="text-graphite leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-graphite mt-10">
            Esta página describe cómo funciona OMI hoy, en la etapa de piloto -- no reemplaza
            un contrato de servicio formal. Si necesitás un acuerdo de tratamiento de datos
            (DPA) para tu propia operación, escribinos a{" "}
            <a href="mailto:hello@alterego.lat" className="text-brand hover:underline">
              hello@alterego.lat
            </a>
            .
          </p>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
