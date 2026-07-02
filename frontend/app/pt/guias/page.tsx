import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/guias`;
const TITLE = "Guias para migrar e preparar dados para o Odoo";
const DESCRIPTION =
  "Guias práticos para parceiros, implementadores e equipes que preparam dados para migrar para o Odoo: o que revisar antes de importar, erros comuns por módulo e como evitá-los.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const GUIDES = [
  {
    href: "/pt/guias/preparar-datos-para-importar-en-odoo",
    title: "Como preparar um arquivo Excel ou CSV para importar no Odoo",
    body: "O que o importador nativo do Odoo revisa, os erros mais comuns por módulo e como evitá-los antes de enviar o arquivo.",
  },
];

export default function GuiasIndexPT() {
  return (
    <main className="min-h-screen">
      <SiteHeader locale="pt" />
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
          Guias
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
      <RelatedHubs currentHref="/pt/guias" locale="pt" />
      <SiteFooter locale="pt" />
    </main>
  );
}
