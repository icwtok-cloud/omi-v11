import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/compatibilidad`;
const TITLE = "Quais módulos e países a OMI suporta para migrar para o Odoo";
const DESCRIPTION =
  "A OMI valida 8 módulos do Odoo (Contatos, CRM, Vendas, Faturamento, Estoque, Produtos, Contabilidade, Compras) em 15 países da LatAm, versões 14 a 19.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const MODULES = [
  { name: "Contatos", scoped: true },
  { name: "CRM", scoped: false },
  { name: "Vendas", scoped: false },
  { name: "Faturamento", scoped: true },
  { name: "Estoque", scoped: false },
  { name: "Produtos", scoped: false },
  { name: "Contabilidade", scoped: true },
  { name: "Compras", scoped: false },
];

const COUNTRIES = [
  "Argentina", "Bolívia", "Brasil", "Chile", "Colômbia", "Costa Rica",
  "Rep. Dominicana", "Equador", "Guatemala", "México", "Panamá", "Peru",
  "Paraguai", "Uruguai", "Venezuela",
];

export default function CompatibilidadPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Compatibilidade", item: PAGE_URL },
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
        <SiteHeader locale="pt" />
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/pt" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Compatibilidade</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            A OMI gera suas regras de validação lendo o código-fonte real do Odoo
            -- por isso o suporte é limitado aos módulos e versões onde essas
            regras já foram geradas, não a todo o Odoo em geral.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Módulos suportados</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {MODULES.map((m) => (
              <div key={m.name} className="bg-white border border-line rounded-lg p-4 text-center">
                <p className="font-semibold text-sm">{m.name}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-graphite mb-10">
            Contatos, Faturamento e Contabilidade têm regras adicionais conforme o
            país escolhido -- os outros cinco módulos validam igual em qualquer país.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Países com localização LatAm</h2>
          <div className="flex flex-wrap gap-2 mb-10">
            {COUNTRIES.map((c) => (
              <span key={c} className="bg-canvas border border-line rounded-full px-3 py-1.5 text-sm">
                {c}
              </span>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Seu módulo e país são suportados?</p>
            <p className="text-graphite mb-6">
              Escolha-os no formulário e confirme em segundos, sem custo.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/pt/compatibilidad" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
