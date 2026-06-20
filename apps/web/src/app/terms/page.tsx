import { CalendarCheck } from "lucide-react";

const sections = [
  {
    title: "Uso da plataforma",
    items: [
      "O SmartAgenda centraliza atendimentos recebidos por WhatsApp, consulta disponibilidade no Google Calendar e cria agendamentos quando autorizado.",
      "O profissional e responsavel por manter seus dados, servicos, horarios e integracoes corretos.",
      "O uso da plataforma deve respeitar leis aplicaveis, politicas do WhatsApp, politicas do Google e direitos dos clientes atendidos."
    ]
  },
  {
    title: "Contas e integracoes",
    items: [
      "Cada profissional deve conectar uma conta Google propria para uso do Google Calendar.",
      "Cada numero de WhatsApp deve ser conectado por QR Code ou outro metodo autorizado pela Evolution API.",
      "A indisponibilidade de Google, WhatsApp, Evolution API ou infraestrutura externa pode afetar o funcionamento do SmartAgenda."
    ]
  },
  {
    title: "Responsabilidades do profissional",
    items: [
      "Conferir os agendamentos criados e manter regras de disponibilidade atualizadas.",
      "Garantir que possui autorizacao para armazenar e tratar dados dos clientes atendidos.",
      "Usar mensagens automaticas de forma adequada, sem spam, abuso ou comunicacao indevida."
    ]
  },
  {
    title: "Limitacoes",
    items: [
      "O SmartAgenda busca automatizar agendamentos, mas nao substitui revisao humana em casos sensiveis ou urgentes.",
      "Podem ocorrer falhas temporarias por indisponibilidade de APIs externas, erros de conexao, configuracoes incorretas ou limites de uso.",
      "Novas funcionalidades podem ser alteradas, pausadas ou removidas durante a evolucao do produto."
    ]
  },
  {
    title: "Cancelamento e dados",
    items: [
      "O profissional pode solicitar desconexao das integracoes e exclusao de dados operacionais quando aplicavel.",
      "Tokens do Google podem ser revogados diretamente pela conta Google do usuario.",
      "Alguns registros podem ser mantidos pelo tempo necessario para cumprir obrigacoes legais, fiscais ou de seguranca."
    ]
  }
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-ink md:px-8">
      <article className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 md:p-8">
        <Header title="Termos de Uso" />
        <p className="mt-6 text-sm leading-6 text-slate-600">
          Estes Termos de Uso definem as condicoes gerais para uso do SmartAgenda, uma plataforma
          para organizar agendamentos via WhatsApp com integracao ao Google Calendar.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Ultima atualizacao: 20/06/2026.
        </p>

        <div className="mt-8 space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {section.items.map((item) => (
                  <li className="rounded-md border border-slate-200 px-3 py-2" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-4">
          <h2 className="font-semibold">Contato</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Para duvidas sobre estes termos, entre em contato pelo canal de suporte informado pelo
            responsavel do SmartAgenda.
          </p>
        </section>
      </article>
    </main>
  );
}

function Header({ title }: { title: string }) {
  return (
    <header className="border-b border-slate-200 pb-5">
      <a className="inline-flex items-center gap-3 text-slate-900" href="/">
        <span className="grid size-10 place-items-center rounded-lg bg-brand-600 text-white">
          <CalendarCheck size={21} />
        </span>
        <span>
          <span className="block text-lg font-semibold">SmartAgenda</span>
          <span className="block text-xs text-slate-500">WhatsApp + Google Calendar</span>
        </span>
      </a>
      <h1 className="mt-6 text-3xl font-semibold tracking-normal">{title}</h1>
    </header>
  );
}
