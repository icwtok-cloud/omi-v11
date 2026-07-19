import type { Metadata } from "next";
import Link from "next/link";
import { ProductDemo } from "@/components/ProductDemo";
import { LocalizationPulse } from "@/components/LocalizationPulse";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "OMI — Validador de dados para migrações Odoo",
  description:
    "Envie seus dados, escolha o módulo e a versão do Odoo, e a OMI mostra exatamente o que corrigir antes de migrar. Validação determinística contra as regras reais do Odoo 14 a 19, sem IA.",
  alternates: {
    canonical: `${SITE_URL}/pt`,
    languages: {
      es: SITE_URL,
      pt: `${SITE_URL}/pt`,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: `${SITE_URL}/pt`,
    siteName: "OMI",
    title: "OMI — Validador de dados para migrações Odoo",
    description:
      "Detecte os erros que vão quebrar sua migração do Odoo antes de importar. Validação determinística, sem IA, do Odoo 14 a 19.",
  },
};

const BEFORE_AFTER = {
  before: [
    "Emails mal formatados e outros formatos quebrados",
    "Duplicados entre linhas ou depósitos",
    "Relações que não existem no seu Odoo (etapas, categorias, moedas)",
    "Colunas obrigatórias faltando",
    "Horas de limpeza manual em Excel, por precaução",
  ],
  after: [
    "Cada erro identificado e agrupado por tipo",
    "Correções automáticas já aplicadas; o resto, marcado para revisão manual",
    "Quality Score (0-100) que quantifica o quão pronta está sua base",
    "Relatório técnico em PDF com o detalhe de cada correção",
    "Arquivo corrigido, pronto para importar na ordem correta",
  ],
};

const STEPS = [
  {
    n: "01",
    title: "Você envia seu arquivo",
    body: "CSV ou Excel. Você escolhe o módulo, a versão e -- se for o caso -- o país, e a OMI valida cada campo contra as regras reais. Em segundos, não horas.",
  },
  {
    n: "02",
    title: "Você revisa cada problema",
    body: "Agrupado por tipo, com a correção automática já aplicada ou marcada para você decidir.",
  },
  {
    n: "03",
    title: "Você importa sem surpresas",
    body: "Baixe o arquivo corrigido, com os cabeçalhos exatos que sua versão do Odoo espera.",
  },
];

const PERSONAS = [
  {
    title: "Parceiros e consultorias Odoo",
    body: "Você migra dados de vários clientes ao mesmo tempo. Precisa de um processo repetível, não uma planilha diferente por projeto.",
  },
  {
    title: "Implementadores independentes",
    body: "Um Go Live que falha por dados quebrados recai sobre você, não sobre o cliente. Detecte antes que aconteça.",
  },
  {
    title: "Equipes internas de ERP",
    body: "Você migra uma única vez, mas não pode se permitir um erro em produção no dia do corte.",
  },
  {
    title: "Migrações de grande volume",
    body: "Milhares de linhas por módulo -- impossível revisar uma por uma manualmente.",
  },
];

const LATAM_COUNTRIES = [
  { code: "ar", name: "Argentina" },
  { code: "bo", name: "Bolívia" },
  { code: "br", name: "Brasil" },
  { code: "cl", name: "Chile" },
  { code: "co", name: "Colômbia" },
  { code: "cr", name: "Costa Rica" },
  { code: "do", name: "Rep. Dominicana" },
  { code: "ec", name: "Equador" },
  { code: "gt", name: "Guatemala" },
  { code: "mx", name: "México" },
  { code: "pa", name: "Panamá" },
  { code: "pe", name: "Peru" },
  { code: "py", name: "Paraguai" },
  { code: "uy", name: "Uruguai" },
  { code: "ve", name: "Venezuela" },
];

const TRUST_POINTS = [
  {
    title: "100% determinístico",
    body: "Regras geradas lendo o código-fonte real do Odoo. Sem IA, sem resultados que mudam entre execuções.",
  },
  {
    title: "Seus dados, sob seu controle",
    body: "Seu arquivo fica guardado apenas enquanto o projeto existir na sua conta -- você pode pedir a exclusão a qualquer momento nos escrevendo.",
  },
  {
    title: "Odoo 14 a 19",
    body: "Inclui versões sem suporte oficial do Odoo -- as que têm mais urgência de migração.",
  },
  {
    title: "Relatório técnico e arquivo pronto",
    body: "PDF com o detalhe de cada correção, e um ZIP numerado conforme a ordem de importação recomendada.",
  },
];

const DOUBTS = [
  {
    q: "Já tenho Odoo, para que preciso disso?",
    a: "A OMI não substitui o Odoo -- valida o que você vai alimentar nele antes que o Odoo rejeite ou, pior, aceite errado.",
  },
  {
    q: "Já uso Excel para limpar meus dados",
    a: "O Excel não sabe quais campos são obrigatórios na sua versão do Odoo, nem quais etapas ou categorias existem na sua instância real. A OMI valida contra essas regras reais, não contra um checklist genérico.",
  },
  {
    q: "Minhas importações costumam funcionar",
    a: "Costumam. O problema aparece nas que não funcionam -- e nesse momento você já está em produção. A OMI mostra os erros antes disso.",
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
    a: "Seu arquivo fica guardado apenas enquanto o projeto existir na sua conta -- assim você pode voltar para baixá-lo ou adicionar módulos sem reenviar nada. Você pode pedir a exclusão de um projeto quando quiser escrevendo para hello@alterego.lat.",
  },
  {
    q: "Posso usar sem ser técnico?",
    a: "Sim. Você não precisa saber SQL nem Python. Envia o arquivo, revisa cada problema na tela, e baixa o resultado.",
  },
  {
    q: "Quais formatos são aceitos?",
    a: "CSV e Excel (.xlsx / .xls). O arquivo pode ter qualquer nome de coluna -- a OMI mapeia contra os campos reais do Odoo.",
  },
  {
    q: "Quais versões do Odoo são suportadas?",
    a: "Da 14 à 19, incluindo versões que já não têm suporte oficial -- são justamente as que têm mais urgência de migração.",
  },
  {
    q: "Como é o pagamento?",
    a: "Com cartão (via Lemon Squeezy) ou em USDC, pela Polygon ou Base, direto da sua carteira. Você escolhe por projeto, assinatura mensal ou plano anual, no método que preferir.",
  },
];

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

export default function LandingPagePT() {
  return (
    <main className="min-h-screen">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-brand focus:text-white focus:font-medium focus:rounded-md focus:px-4 focus:py-2"
      >
        Pular para o conteúdo principal
      </a>
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-brand flex items-center justify-center text-white text-xs font-bold">
              OMI
            </div>
            <span className="font-extrabold text-lg tracking-tight">OMI Engine</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-graphite">
            <a href="#como-funciona" className="hover:text-ink transition-colors">Como funciona</a>
            <a href="#modulos" className="hover:text-ink transition-colors">Módulos</a>
            <a href="#latam" className="hover:text-ink transition-colors">LatAm</a>
            <a href="#precos" className="hover:text-ink transition-colors">Preços</a>
            <a href="#partners" className="hover:text-ink transition-colors">Parceiros</a>
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-graphite hover:text-ink transition-colors" title="Ver em español">
              ES
            </Link>
            <Link href="/app" className="text-sm font-medium text-graphite hover:text-ink transition-colors">
              Entrar
            </Link>
            <Link
              href="/app"
              className="bg-brand text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-brand-dark transition-colors"
            >
              Começar grátis
            </Link>
          </div>

          <details className="md:hidden relative">
            <summary
              className="list-none cursor-pointer border border-line rounded-md px-3 py-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden"
              aria-label="Abrir menu"
            >
              Menu
            </summary>
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-line rounded-lg shadow-lg py-2 z-50">
              <nav className="flex flex-col text-sm">
                <a href="#como-funciona" className="px-4 py-2 text-graphite hover:bg-canvas hover:text-ink transition-colors">Como funciona</a>
                <a href="#modulos" className="px-4 py-2 text-graphite hover:bg-canvas hover:text-ink transition-colors">Módulos</a>
                <a href="#latam" className="px-4 py-2 text-graphite hover:bg-canvas hover:text-ink transition-colors">LatAm</a>
                <a href="#precos" className="px-4 py-2 text-graphite hover:bg-canvas hover:text-ink transition-colors">Preços</a>
                <a href="#partners" className="px-4 py-2 text-graphite hover:bg-canvas hover:text-ink transition-colors">Parceiros</a>
              </nav>
              <div className="border-t border-line mt-2 pt-2 px-4 flex flex-col gap-2">
                <Link href="/" className="text-sm font-medium text-graphite hover:text-ink transition-colors">
                  Ver em español (ES)
                </Link>
                <Link href="/app" className="text-sm font-medium text-graphite hover:text-ink transition-colors">
                  Entrar
                </Link>
                <Link
                  href="/app"
                  className="bg-brand text-white text-sm font-semibold rounded-md px-4 py-2 text-center hover:bg-brand-dark transition-colors"
                >
                  Começar grátis
                </Link>
              </div>
            </div>
          </details>
        </div>
      </header>

      <section id="conteudo" className="max-w-6xl mx-auto px-6 md:px-10 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-graphite border border-line rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-verify" />
              Para implementadores e consultorias Odoo
            </span>
            <h1 className="font-extrabold text-4xl md:text-5xl xl:text-6xl leading-[1.05] tracking-tight mb-6">
              Migre para o Odoo<br />
              <span className="text-brand">sem surpresas</span>
            </h1>
            <p className="text-graphite text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
              Importar direto no Odoo é uma aposta: os dados quebrados só aparecem
              em produção. A OMI analisa antes -- duplicados, campos vazios,
              relações que não existem no seu Odoo e tudo que a versão que você
              escolheu vai rejeitar -- antes do Go Live.
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-4">
              <Link
                href="/app"
                className="bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
              >
                Analisar meus dados grátis →
              </Link>
              <a
                href="#como-funciona"
                className="border border-line font-medium rounded-md px-6 py-3 hover:bg-white transition-colors"
              >
                Ver como funciona
              </a>
            </div>
            <p className="text-sm text-graphite">Sem cartão. Sem instalação. Relatório grátis, primeiro download incluído.</p>
          </div>

          <div>
            <ProductDemo locale="pt" />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-12">
        <div className="max-w-6xl mx-auto px-6 md:px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {TRUST_POINTS.map((point) => (
            <div key={point.title} className="text-center sm:text-left">
              <p className="font-bold text-sm mb-1.5">{point.title}</p>
              <p className="text-sm text-graphite leading-relaxed">{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modulos" className="border-t border-line bg-white/60 py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            O problema real
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-4">
            A migração de dados quebra implementações
          </h2>
          <p className="text-graphite text-center max-w-xl mx-auto mb-14">
            Cada linha quebrada que você não vê hoje é um problema em produção amanhã. Você
            escolhe os módulos da sua implementação e a OMI aplica apenas as validações
            relevantes para cada um.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PAIN_CARDS.map((card) => (
              <div key={card.module} className="bg-white border border-line rounded-xl p-5 flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-wide text-graphite mb-3">
                  {card.module}
                </p>
                <p className="font-bold text-alert leading-snug mb-2">{card.pain}</p>
                <p className="text-sm text-graphite leading-relaxed mb-4 flex-1">
                  {card.consequence}
                </p>
                <div className="bg-verify-light text-verify text-sm font-medium rounded-md px-3 py-2.5 leading-snug">
                  {card.fix}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line py-20">
        <div className="max-w-5xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Antes / Depois
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-14">
            De um CSV quebrado a um arquivo pronto para o Odoo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-line rounded-xl p-7 bg-alert-light/40">
              <p className="font-bold text-alert mb-4">Antes</p>
              <ul className="space-y-2.5 text-sm">
                {BEFORE_AFTER.before.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-alert shrink-0">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-line rounded-xl p-7 bg-verify-light/40">
              <p className="font-bold text-verify mb-4">Depois</p>
              <ul className="space-y-2.5 text-sm">
                {BEFORE_AFTER.after.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-verify shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-t border-line bg-white/60 py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Processo
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-14">
            Como funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map((step) => (
              <div key={step.n}>
                <p className="font-extrabold text-4xl text-line mb-3">{step.n}</p>
                <p className="font-bold text-lg mb-2">{step.title}</p>
                <p className="text-sm text-graphite leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Para quem é
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-14">
            Pensado para quem migra dados para o Odoo de verdade
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PERSONAS.map((persona) => (
              <div key={persona.title} className="bg-white border border-line rounded-xl p-5">
                <p className="font-bold mb-2">{persona.title}</p>
                <p className="text-sm text-graphite leading-relaxed">{persona.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="latam" className="border-t border-line bg-white/60 py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Localização
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-center mb-4">
            Feito para implementações Odoo na América Latina
          </h2>
          <p className="text-graphite text-center max-w-2xl mx-auto mb-6">
            Cada país tem seu próprio addon oficial de localização dentro do Odoo
            (l10n_ar, l10n_mx, l10n_br...), com sua própria estrutura de campos. A OMI
            lê esse addon real para Contatos, Contabilidade e Faturamento -- não
            aplica o mesmo modelo para todos os países.
          </p>
          <div className="flex justify-center mb-10">
            <LocalizationPulse />
          </div>
          <div className="flex flex-wrap justify-center gap-2.5 mb-6">
            {LATAM_COUNTRIES.map((country) => (
              <span
                key={country.code}
                className="font-mono text-xs rounded-full px-3 py-1.5 border border-line text-graphite"
              >
                {country.name}
              </span>
            ))}
          </div>
          <p className="text-sm text-graphite text-center max-w-xl mx-auto mb-2">
            <span className="font-semibold text-ink">Brasil</span> já tem validação de
            dados ativa -- e esta é a versão da interface em português.
          </p>
          <p className="text-sm text-graphite text-center max-w-xl mx-auto">
            Os demais módulos (CRM, Vendas, Estoque, Produtos, Compras) validam
            contra as regras da sua versão do Odoo independentemente do país.
          </p>
        </div>
      </section>

      <section className="border-t border-line py-20">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite text-center mb-3">
            Antes de decidir
          </p>
          <h2 className="font-extrabold text-3xl tracking-tight text-center mb-12">
            As dúvidas mais comuns antes de migrar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DOUBTS.map((doubt) => (
              <div key={doubt.q} className="bg-white border border-line rounded-xl p-5">
                <p className="font-bold mb-1.5">{doubt.q}</p>
                <p className="text-sm text-graphite leading-relaxed">{doubt.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="precos" className="border-t border-line bg-white/60 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
            Preços
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">
            Preços simples, você paga quando estiver pronto
          </h2>
          <p className="text-graphite mb-14">
            A análise e o relatório são sempre grátis. Você paga só ao exportar, com
            cartão ou em USDC (Polygon ou Base) direto da sua carteira -- você escolhe.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white border border-line rounded-xl p-7">
              <p className="font-bold text-lg mb-1">Grátis</p>
              <p className="font-extrabold text-4xl tracking-tight mb-1">USD 0</p>
              <p className="text-sm text-graphite mb-6">1 projeto, 1 módulo -- uma vez por conta</p>
              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Relatório completo</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Download do arquivo corrigido incluído</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Não precisa pagar para testar</li>
              </ul>
              <Link
                href="/app"
                className="block text-center border border-line font-semibold rounded-md px-4 py-2.5 hover:bg-canvas transition-colors"
              >
                Testar grátis
              </Link>
            </div>

            <div className="bg-white border border-line rounded-xl p-7">
              <p className="font-bold text-lg mb-1">Por projeto</p>
              <p className="font-extrabold text-4xl tracking-tight mb-1">USD 99</p>
              <p className="text-sm text-graphite mb-6">Download de até 8 módulos, todo o projeto junto</p>
              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Exportação pronta para o Odoo, todos os módulos</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Relatório e validação continuam grátis antes de pagar</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Sem limite de linhas</li>
              </ul>
              <Link
                href="/app"
                className="block text-center border border-line font-semibold rounded-md px-4 py-2.5 hover:bg-canvas transition-colors"
              >
                Começar com um projeto
              </Link>
            </div>

            <div className="bg-white border-2 border-brand rounded-xl p-7 relative">
              <span className="absolute -top-3 left-7 bg-brand text-white text-xs font-bold rounded-full px-3 py-1">
                Para consultorias
              </span>
              <p className="font-bold text-lg mb-1">Mensal</p>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="font-extrabold text-4xl tracking-tight">USD 149</p>
                <p className="text-graphite/60 line-through text-lg">USD 495</p>
              </div>
              <p className="text-verify text-xs font-semibold mb-1">Economize 70% vs. pagar 5 projetos avulsos</p>
              <p className="inline-block bg-verify-light text-verify text-xs font-bold rounded-full px-3 py-1 mb-4">
                🎁 3 dias grátis para testar
              </p>
              <p className="text-sm text-graphite mb-6">Até 5 projetos exportados por mês</p>
              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Tudo do plano por projeto</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> 5 projetos exportados por mês</li>
                <li className="flex items-start gap-2"><span className="text-verify">✓</span> Pensado para vários clientes ao mesmo tempo</li>
              </ul>
              <Link
                href="/app"
                className="block text-center bg-brand text-white font-semibold rounded-md px-4 py-2.5 hover:bg-brand-dark transition-colors"
              >
                Assinar
              </Link>
            </div>
          </div>
          <p className="text-sm text-graphite mt-8">
            Migra com volume real?{" "}
            <a href="#partners" className="text-brand font-medium hover:underline">
              Veja o plano anual
            </a>
            .
          </p>
        </div>
      </section>

      <section id="partners" className="border-t border-line bg-white/60 py-20">
        <div className="max-w-md mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
            Para consultorias e equipes com volume
          </p>
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">
            Plano anual, exportações ilimitadas
          </h2>
          <p className="text-graphite mb-10">
            Pensado para quem migra o ano todo, não um projeto avulso -- você paga
            uma vez e se livra do teto mensal.
          </p>

          <div className="bg-white border-2 border-brand rounded-xl p-8 text-left relative">
            <span className="absolute -top-3 left-7 bg-brand text-white text-xs font-bold rounded-full px-3 py-1">
              Melhor preço
            </span>
            <p className="font-bold text-lg mb-1">Anual</p>
            <div className="flex items-baseline gap-2 mb-1">
              <p className="font-extrabold text-4xl tracking-tight">USD 799</p>
              <p className="text-graphite/60 line-through text-lg">USD 1.788</p>
            </div>
            <p className="text-verify text-xs font-semibold mb-6">
              Economize 55% vs. pagar o mensal os 12 meses
            </p>
            <ul className="space-y-2 text-sm mb-8">
              <li className="flex items-start gap-2"><span className="text-verify shrink-0">✓</span> Exportações ilimitadas, sem teto mensal</li>
              <li className="flex items-start gap-2"><span className="text-verify shrink-0">✓</span> Tudo do plano mensal</li>
              <li className="flex items-start gap-2"><span className="text-verify shrink-0">✓</span> Pensado para vários clientes ao mesmo tempo, o ano todo</li>
            </ul>
            <Link
              href="/pt/app?checkout=annual"
              className="block text-center bg-brand text-white font-semibold rounded-md px-4 py-3 hover:bg-brand-dark transition-colors"
            >
              Assinar o plano anual
            </Link>
          </div>

          <p className="text-sm text-graphite mt-8">
            Precisa de algo sob medida (faturamento diferente, volume fora desses
            planos)? Escreva para{" "}
            <a href="mailto:hello@alterego.lat?subject=Plano%20sob%20medida%20OMI" className="text-brand font-medium hover:underline">
              hello@alterego.lat
            </a>
            .
          </p>
        </div>
      </section>


      <section className="border-t border-line bg-ink py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-extrabold text-3xl md:text-4xl tracking-tight text-white mb-4">
            Você importa direto, ou sabe antes o que vai quebrar?
          </h2>
          <p className="text-white/70 mb-8">
            Sem cartão, sem instalação. Envie um arquivo e em segundos você tem o relatório completo.
          </p>
          <Link
            href="/app"
            className="inline-block bg-white text-ink font-semibold rounded-md px-8 py-3.5 hover:bg-canvas transition-colors"
          >
            Analisar meus dados grátis →
          </Link>
        </div>
      </section>

      <RelatedHubs currentHref="" locale="pt" />

      <SiteFooter locale="pt" />
    </main>
  );
}
