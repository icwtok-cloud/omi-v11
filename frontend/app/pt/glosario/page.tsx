import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/glosario`;
const TITLE = "Glossário de migração de dados para o Odoo";
const DESCRIPTION =
  "O que significam External ID, SKU, Quality Score, l10n e outros termos que aparecem ao preparar ou migrar dados para o Odoo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const TERMS = [
  {
    term: "External ID",
    def: "Identificador único de um registro dentro do Odoo, no formato módulo.nome. É usado na coluna id de uma importação para que reimportar o mesmo arquivo atualize o registro existente em vez de duplicá-lo.",
  },
  {
    term: "SKU / código interno (default_code)",
    def: "Código que identifica um produto de forma única dentro do seu catálogo. Se dois produtos diferentes compartilham o mesmo SKU, o Odoo pode confundir o estoque ou a venda de um com o do outro.",
  },
  {
    term: "l10n (localização)",
    def: "Addon do Odoo que adapta um módulo às regras de um país específico -- por exemplo, l10n_ar para Argentina ou l10n_br para o Brasil. Estende módulos base como Contatos ou Faturamento com campos e validações próprias desse país.",
  },
  {
    term: "Quality Score",
    def: "Número de 0 a 100 que resume o quão pronto está um arquivo para importar no Odoo, calculado a partir da quantidade e severidade dos problemas detectados.",
  },
  {
    term: "Mapeamento de colunas",
    def: "Processo de fazer corresponder os nomes de coluna do seu arquivo (que podem estar em qualquer idioma ou formato) com os campos técnicos reais que o Odoo espera para esse módulo.",
  },
  {
    term: "Correção automática",
    def: "Correção que pode ser aplicada sem ambiguidade -- por exemplo, um espaço a mais em um email. É aplicada apenas ao gerar o arquivo de download, nunca sobre o arquivo original.",
  },
  {
    term: "Revisão manual",
    def: "Caso que exige critério de negócio para ser resolvido -- por exemplo, um preço zerado que pode ser um erro ou pode ser real. Fica marcado para você decidir, não é corrigido sozinho.",
  },
  {
    term: "Módulo (no contexto da OMI)",
    def: "Agrupamento de dados por área funcional do Odoo: Contatos, CRM, Vendas, Faturamento, Estoque, Produtos, Contabilidade ou Compras. Não deve ser confundido com um módulo/addon de código Odoo.",
  },
];

export default function GlosarioPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Glossário", item: PAGE_URL },
    ],
  };

  const definedTermSetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: TITLE,
    url: PAGE_URL,
    hasDefinedTerm: TERMS.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.def,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSetJsonLd) }}
      />
      <main className="min-h-screen">
        <SiteHeader locale="pt" />
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/pt" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Glossário</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-graphite leading-relaxed mb-12 max-w-2xl">{DESCRIPTION}</p>

          <dl className="space-y-6">
            {TERMS.map((t) => (
              <div key={t.term} className="border-b border-line pb-6">
                <dt className="font-bold text-lg mb-1.5">{t.term}</dt>
                <dd className="text-graphite leading-relaxed">{t.def}</dd>
              </div>
            ))}
          </dl>
        </div>
        <RelatedHubs currentHref="/pt/glosario" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
