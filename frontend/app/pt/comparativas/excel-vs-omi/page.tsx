import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/comparativas/excel-vs-omi`;
const TITLE = "Limpar dados no Excel vs. validá-los com a OMI antes de migrar para o Odoo";
const DESCRIPTION =
  "O Excel limpa o que você mandar limpar. A OMI valida contra as regras reais da sua versão do Odoo. Em que se parecem, em que não, e quando um só é suficiente.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const ROWS = [
  {
    label: "Detecta formatos quebrados (emails, telefones)",
    excel: "Com uma fórmula ou macro que você monta",
    omi: "Automático, contra regras já definidas",
  },
  {
    label: "Sabe quais campos são obrigatórios na sua versão do Odoo",
    excel: "Não -- você precisa saber e codificar isso",
    omi: "Sim, gerado lendo o código-fonte real dessa versão",
  },
  {
    label: "Valida contra as categorias/etapas/moedas que existem na sua instância real",
    excel: "Não, a menos que você as carregue manualmente como referência",
    omi: "Sim, se você tiver essa informação disponível no projeto",
  },
  {
    label: "Detecta duplicados em toda a coluna (SKU, CNPJ, código de barras)",
    excel: "Com uma fórmula (condicional ou tabela dinâmica)",
    omi: "Automático, agrupado por tipo de problema",
  },
  {
    label: "Dá um número único de quão pronta está a migração",
    excel: "Não",
    omi: "Sim -- Quality Score de 0 a 100",
  },
  {
    label: "Exige saber programar ou usar fórmulas avançadas",
    excel: "Sim, para os casos acima",
    omi: "Não",
  },
];

export default function ExcelVsOmiPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Comparativos", item: `${SITE_URL}/pt/comparativas` },
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
        <SiteHeader locale="pt" />
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/pt" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Excel vs OMI</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Não são excludentes -- a OMI não substitui o Excel como ferramenta, ela valida o
            que o Excel não pode saber sozinho: as regras reais da versão do
            Odoo para a qual você vai importar. Esta tabela compara o que cada um resolve.
          </p>

          <div className="border border-line rounded-xl overflow-hidden mb-10">
            <div className="grid grid-cols-3 bg-canvas border-b border-line text-sm font-bold">
              <div className="p-4">O que você precisa fazer</div>
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
            O Excel não sabe quais campos são obrigatórios na sua versão do Odoo, nem quais
            etapas ou categorias existem na sua instância real. A OMI valida contra essas
            regras reais, não contra um checklist genérico que você mesmo montou.
          </p>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Teste com o mesmo arquivo que você já limpou no Excel</p>
            <p className="text-graphite mb-6">
              É grátis e não exige cartão nem carteira.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/pt/comparativas/excel-vs-omi" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
