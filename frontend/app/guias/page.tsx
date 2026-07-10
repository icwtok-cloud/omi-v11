import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/guias`;
const TITLE = "Guías para migrar y preparar datos hacia Odoo";
const DESCRIPTION =
  "Guías prácticas para partners, implementadores y equipos que preparan datos para migrar a Odoo: qué revisar antes de importar, errores comunes por módulo y cómo evitarlos.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const GUIDES = [
  {
    href: "/guias/preparar-datos-para-importar-en-odoo",
    title: "Cómo preparar un archivo Excel o CSV para importar en Odoo",
    body: "Qué revisa el importador nativo de Odoo, los errores más comunes por módulo y cómo evitarlos antes de subir el archivo.",
  },
  {
    href: "/guias/como-pagar-con-usdc",
    title: "Cómo pagar en OMI con USDC (si nunca usaste una wallet)",
    body: "Paso a paso para instalar MetaMask, conseguir USDC en Polygon o Base y pagar en OMI sin haber usado criptomonedas antes.",
  },
];

export default function GuiasIndex() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
          Guías
        </p>
        <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
        <p className="text-graphite leading-relaxed mb-12 max-w-2xl">{DESCRIPTION}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {GUIDES.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="block bg-white border border-line rounded-xl p-6 hover:border-brand transition-colors"
            >
              <h2 className="font-bold text-lg mb-2">{guide.title}</h2>
              <p className="text-sm text-graphite leading-relaxed">{guide.body}</p>
            </Link>
          ))}
        </div>
      </div>
      <RelatedHubs currentHref="/guias" />
      <SiteFooter />
    </main>
  );
}
