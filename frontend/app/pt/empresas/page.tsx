import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/empresas`;
const TITLE = "Preparar sua empresa para migrar para o Odoo: o que perguntar antes de começar";
const DESCRIPTION =
  "Quanto custa, quanto tempo leva e o que acontece com estoque, vendas, compras, CRM e contabilidade ao migrar para o Odoo -- respostas diretas para quem decide, não só para quem implementa.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const QUESTIONS = [
  {
    q: "Vou perder informação na migração?",
    a: "O risco não está no Odoo -- está nos dados que você alimenta nele. Se um arquivo tem relações que não existem na sua instância (uma categoria, uma etapa, uma moeda), o Odoo não inventa o dado: rejeita ou deixa incompleto. Validar antes de importar é o que evita que isso aconteça em produção.",
  },
  {
    q: "O que acontece com o Estoque se eu migrar com erros?",
    a: "SKUs duplicados entre depósitos fazem com que o estoque seja descontado do produto errado -- um problema que só é percebido quando o número não fecha, não no momento de importar.",
  },
  {
    q: "O que acontece com Vendas e Faturamento?",
    a: "Um preço zerado que passa despercebido é faturado assim mesmo. Uma moeda não configurada deixa a fatura em um limbo que a contabilidade não consegue fechar. Nenhum dos dois dá um erro visível ao importar -- aparecem depois.",
  },
  {
    q: "Quanto custa validar os dados antes de migrar?",
    a: "O relatório completo é grátis para um projeto de um módulo. Exportar o arquivo corrigido tem um custo por projeto ou por assinatura mensal se você migra com volume -- sem cartão de crédito, paga-se em USDC.",
  },
  {
    q: "Quanto tempo leva?",
    a: "A análise de um arquivo leva segundos, não horas. O tempo real é definido pelas decisões que ficam com você -- os casos que a OMI marca como \"exige revisão manual\" porque não pode decidir por critério de negócio.",
  },
];

export default function EmpresasPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Empresas", item: PAGE_URL },
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
            <span className="text-ink">Empresas</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Quem decide uma migração nem sempre é quem a executa -- e as perguntas
            que importam são diferentes. Estas são as que mais se repetem antes de dar
            o aval.
          </p>

          <div className="space-y-8">
            {QUESTIONS.map((item) => (
              <div key={item.q} className="border-b border-line pb-6">
                <h2 className="font-bold text-lg mb-2">{item.q}</h2>
                <p className="text-graphite leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center mt-12">
            <p className="font-bold text-lg mb-2">Veja o estado real dos seus dados antes de decidir</p>
            <p className="text-graphite mb-6">
              O relatório completo é grátis -- não exige compromisso para ver.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/pt/empresas" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
