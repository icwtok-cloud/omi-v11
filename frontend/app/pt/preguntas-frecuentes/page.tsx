import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/preguntas-frecuentes`;
const TITLE = "Perguntas frequentes sobre a OMI e migrações para o Odoo";
const DESCRIPTION =
  "Respostas diretas sobre como a OMI funciona: o que ela faz com seus dados, como é o pagamento, quais versões do Odoo suporta e por que não usa IA para validar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

// Mesma tradução usada na seção de FAQ da landing (/pt) -- mantida
// duplicada aqui de propósito (sem módulo compartilhado novo) para
// não arriscar acoplar as duas páginas nesta fase.
const DOUBTS = [
  {
    q: "Já tenho Odoo, para que preciso disso?",
    a: "A OMI não substitui o Odoo, valida o que você vai alimentar nele antes que o Odoo rejeite ou, pior, aceite errado.",
  },
  {
    q: "Já uso Excel para limpar meus dados",
    a: "O Excel não sabe quais campos são obrigatórios na sua versão do Odoo, nem quais etapas ou categorias existem na sua instância real. A OMI valida contra essas regras reais, não contra um checklist genérico.",
  },
  {
    q: "Minhas importações costumam funcionar",
    a: "Costumam. O problema aparece nas que não funcionam, e nesse momento você já está em produção. A OMI mostra os erros antes disso.",
  },
  {
    q: "Não migro com frequência, vale a pena?",
    a: "Não há curva de aprendizado: você envia o arquivo e vê o relatório. A primeira vez que evita um erro em produção já justifica o uso.",
  },
  {
    q: "Não confio em correções automáticas",
    a: "Seu arquivo original nunca é modificado. As correções são aplicadas apenas ao gerar o arquivo de download -- você pode ver cada mudança antes de exportar. O que exige seu critério (um preço zerado que poderia ser real, por exemplo) fica marcado para você decidir, não é corrigido sozinho.",
  },
  {
    q: "Não quero que uma IA mexa na minha contabilidade",
    a: "A OMI não usa IA. O motor é 100% determinístico -- as regras são geradas lendo o código-fonte real do Odoo, não um modelo que adivinha.",
  },
  {
    q: "Meus dados ficam guardados?",
    a: "Seu arquivo fica guardado apenas enquanto o projeto existir na sua conta, assim você pode voltar para baixá-lo ou adicionar módulos sem reenviar nada. Você pode pedir a exclusão de um projeto quando quiser escrevendo para hello@alterego.lat.",
  },
  {
    q: "Posso usar sem ser técnico?",
    a: "Sim. Você não precisa saber SQL nem Python. Envia o arquivo, revisa cada problema na tela, e baixa o resultado.",
  },
  {
    q: "Quais formatos são aceitos?",
    a: "CSV e Excel (.xlsx / .xls). O arquivo pode ter qualquer nome de coluna, a OMI mapeia contra os campos reais do Odoo.",
  },
  {
    q: "Quais versões do Odoo são suportadas?",
    a: "Da 14 à 19, incluindo versões que já não têm suporte oficial, são justamente as que têm mais urgência de migração.",
  },
  {
    q: "Como é o pagamento?",
    a: "Com cartão de crédito ou débito internacional, processado pela Lemon Squeezy. Você escolhe por projeto, assinatura mensal ou plano anual, no método que preferir.",
  },
];

export default function PreguntasFrecuentesPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Perguntas frequentes", item: PAGE_URL },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: DOUBTS.map((doubt) => ({
      "@type": "Question",
      name: doubt.q,
      acceptedAnswer: { "@type": "Answer", text: doubt.a },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="min-h-screen">
        <SiteHeader locale="pt" />
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/pt" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Perguntas frequentes</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-graphite leading-relaxed mb-12 max-w-2xl">{DESCRIPTION}</p>

          <div className="space-y-6">
            {DOUBTS.map((doubt) => (
              <div key={doubt.q} className="border-b border-line pb-6">
                <h2 className="font-bold text-lg mb-2">{doubt.q}</h2>
                <p className="text-graphite leading-relaxed">{doubt.a}</p>
              </div>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center mt-12">
            <p className="font-bold text-lg mb-2">Tem outra pergunta?</p>
            <p className="text-graphite mb-6">
              Teste com seu próprio arquivo -- é grátis e não exige cartão nem carteira.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/pt/preguntas-frecuentes" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
