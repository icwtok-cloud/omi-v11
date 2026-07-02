import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/guias/preparar-datos-para-importar-en-odoo`;
const TITLE = "Como preparar um arquivo Excel ou CSV para importar no Odoo";
const DESCRIPTION =
  "Guia prático para preparar dados antes de importá-los no Odoo: o que o importador nativo revisa, os erros mais comuns por módulo e como evitá-los antes de enviar o arquivo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "article",
    url: PAGE_URL,
    title: TITLE,
    description: DESCRIPTION,
  },
};

const CHECKS = [
  {
    title: "Os cabeçalhos coincidem com os campos reais do Odoo",
    body: "O importador nativo do Odoo (Configurações > Técnico > Importar/Exportar, ou o assistente ao enviar um arquivo) mapeia colunas por nome. Se o seu Excel diz \"Email\" e o Odoo espera \"email\" mas em outro idioma ou grafia, o mapeamento automático falha ou fica vazio silenciosamente.",
  },
  {
    title: "As relações existem na sua instância, não na genérica",
    body: "Uma categoria de produto, uma etapa de CRM ou uma moeda que \"deveria\" existir pode não estar cadastrada na sua base real. O Odoo não inventa o valor: rejeita a linha ou a deixa sem essa relação.",
  },
  {
    title: "Cada linha tem um identificador único (External ID)",
    body: "Sem uma coluna id (External ID) ou uma chave única real (como o email em Contatos), reimportar o mesmo arquivo duas vezes pode criar registros duplicados em vez de atualizar os existentes.",
  },
  {
    title: "Os formatos de número e data são consistentes",
    body: "Separador decimal, formato de data e encoding do arquivo (UTF-8) variam conforme de onde você exportou o Excel. Uma inconsistência entre linhas faz o Odoo interpretar o valor errado em algumas e certo em outras.",
  },
  {
    title: "Não há linhas com campos obrigatórios vazios",
    body: "Cada módulo tem campos que o Odoo exige para criar o registro (por exemplo, preço em Vendas ou fornecedor em Compras). Uma célula vazia ali nem sempre dá um erro visível antes da importação real.",
  },
];

export default function PrepararDatosGuidePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/pt/guias` },
      { "@type": "ListItem", position: 3, name: TITLE, item: PAGE_URL },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: PAGE_URL,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <main className="min-h-screen">
        <SiteHeader locale="pt" />
        <article className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/pt" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <Link href="/pt/guias" className="hover:text-ink transition-colors">Guias</Link>
            {" / "}
            <span className="text-ink">Preparar dados para importar</span>
          </nav>

          <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
            Guia · Preparação de dados
          </p>
          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-6">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            A maioria das importações para o Odoo não falha por um problema do ERP -- falha
            porque o arquivo chega com pressupostos que não se cumprem naquela instância
            específica. Este guia revisa o que checar antes de enviar um CSV ou Excel, sem
            assumir que você já sabe o que é um External ID ou um mapeamento de colunas.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">O que checar antes de importar</h2>
          <div className="space-y-6 mb-12">
            {CHECKS.map((check) => (
              <div key={check.title} className="border-l border-brand pl-5">
                <h3 className="font-bold mb-1.5">{check.title}</h3>
                <p className="text-graphite leading-relaxed">{check.body}</p>
              </div>
            ))}
          </div>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Como a OMI aborda isso</h2>
          <p className="text-graphite leading-relaxed mb-4">
            A OMI valida seu arquivo contra as regras reais do módulo e da versão do
            Odoo que você escolheu (14 a 19), geradas lendo o código-fonte do Odoo, não
            um checklist genérico. Agrupa cada problema por tipo, aplica as correções que
            pode resolver automaticamente e marca para revisão manual as que
            exigem seu critério -- por exemplo, um preço zerado que poderia ser um
            erro ou poderia ser real.
          </p>
          <p className="text-graphite leading-relaxed mb-10">
            O resultado é um Quality Score de 0 a 100, um relatório técnico em PDF e um
            arquivo corrigido, numerado conforme a ordem de importação recomendada entre
            módulos relacionados. Nada disso usa IA: é determinístico, então o
            mesmo arquivo sempre produz o mesmo resultado.
          </p>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Quer ver isso com o seu próprio arquivo?</p>
            <p className="text-graphite mb-6">
              Envie um CSV ou Excel e em segundos você tem o relatório completo, sem custo.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </article>
        <RelatedHubs currentHref="/pt/guias/preparar-datos-para-importar-en-odoo" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
