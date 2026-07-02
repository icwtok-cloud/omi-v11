import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/casos-frecuentes`;
const TITLE = "Casos frequentes de erros ao migrar dados para o Odoo, por módulo";
const DESCRIPTION =
  "Os erros mais comuns em Contatos, CRM, Vendas, Faturamento, Estoque, Produtos, Contabilidade e Compras ao migrar para o Odoo, e sua consequência real se não forem detectados antes de importar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

// Mesma tradução usada nos pain cards da landing (/pt) -- duplicada
// aqui de propósito, sem módulo compartilhado novo nesta fase.
const PAIN_CARDS = [
  {
    module: "Contatos",
    pain: "1 em cada 8 contatos com email mal formatado",
    consequence: "As campanhas de cobrança e marketing sofrem bounce sem que ninguém perceba o motivo.",
    fix: "Detecta e corrige o formato antes de importar.",
  },
  {
    module: "CRM",
    pain: "Oportunidades sem etapa reconhecida pelo Odoo",
    consequence: "O pipeline de vendas aparece vazio no primeiro dia de uso.",
    fix: "Mapeia cada etapa contra as reais da sua versão do Odoo.",
  },
  {
    module: "Vendas",
    pain: "Pedidos com preço zerado",
    consequence: "Você fatura R$0 sem perceber até o cliente reclamar.",
    fix: "Marca cada preço zerado antes de chegar à produção.",
  },
  {
    module: "Faturamento",
    pain: "Moedas não configuradas no sistema",
    consequence: "As faturas ficam em um limbo que nem a contabilidade consegue fechar.",
    fix: "Verifica cada moeda contra a configuração real do Odoo.",
  },
  {
    module: "Estoque",
    pain: "SKUs duplicados entre depósitos",
    consequence: "O estoque é descontado do produto errado.",
    fix: "Detecta duplicados antes que o inventário se misture.",
  },
  {
    module: "Produtos",
    pain: "Categorias que não existem no catálogo",
    consequence: "Os produtos ficam órfãos, invisíveis nos relatórios.",
    fix: "Valida cada categoria contra as reais da sua versão.",
  },
  {
    module: "Contabilidade",
    pain: "Lançamentos sem contrapartida",
    consequence: "O balanço não fecha e ninguém sabe em qual linha está o erro.",
    fix: "Encontra o lançamento exato antes do fechamento.",
  },
  {
    module: "Compras",
    pain: "Pedidos sem fornecedor atribuído",
    consequence: "A área de pagamentos não sabe para quem transferir.",
    fix: "Bloqueia a importação até resolver cada caso.",
  },
];

export default function CasosFrecuentesPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Casos frequentes", item: PAGE_URL },
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
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/pt" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Casos frequentes</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-graphite leading-relaxed mb-12 max-w-2xl">{DESCRIPTION}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PAIN_CARDS.map((card) => (
              <div key={card.module} className="bg-white border border-line rounded-xl p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-2">
                  {card.module}
                </p>
                <h2 className="font-bold text-lg mb-2">{card.pain}</h2>
                <p className="text-sm text-graphite leading-relaxed mb-3">
                  <span className="font-semibold text-ink">Consequência: </span>
                  {card.consequence}
                </p>
                <p className="text-sm text-verify leading-relaxed">
                  <span className="font-semibold">Como a OMI aborda: </span>
                  {card.fix}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center mt-12">
            <p className="font-bold text-lg mb-2">Seu arquivo tem algum destes?</p>
            <p className="text-graphite mb-6">
              Envie e em segundos você sabe exatamente quais, sem revisar linha por linha.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/pt/casos-frecuentes" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
