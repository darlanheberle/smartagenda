import { CalendarCheck } from "lucide-react";

const sections = [
  {
    title: "Dados que coletamos",
    items: [
      "Dados do profissional, como nome, especialidade, telefone WhatsApp, email Gmail e configuracoes de agenda.",
      "Dados de clientes informados durante o atendimento, como nome, telefone, email, observacoes e historico de agendamentos.",
      "Dados tecnicos de integracao, como identificadores de eventos do Google Calendar, status de conexao e logs operacionais."
    ]
  },
  {
    title: "Uso do Google Calendar",
    items: [
      "O SmartAgenda solicita acesso ao Google Calendar para consultar disponibilidade e criar, alterar ou cancelar eventos conforme comandos do profissional ou de seus clientes.",
      "Os tokens OAuth sao armazenados para manter a integracao ativa e podem ser revogados pelo usuario a qualquer momento na conta Google.",
      "O SmartAgenda nao vende dados do Google Calendar e nao usa esses dados para publicidade."
    ]
  },
  {
    title: "Uso do WhatsApp",
    items: [
      "Mensagens recebidas via WhatsApp podem ser processadas para identificar clientes, entender pedidos de agendamento e enviar confirmacoes.",
      "A conexao do WhatsApp depende da Evolution API configurada para cada instancia profissional.",
      "O profissional e responsavel por informar seus clientes sobre o uso do atendimento automatizado quando aplicavel."
    ]
  },
  {
    title: "Compartilhamento",
    items: [
      "Dados podem ser compartilhados apenas com provedores necessarios para operar o servico, como Google Calendar, Evolution API, infraestrutura de hospedagem e banco de dados.",
      "Nao comercializamos informacoes pessoais de profissionais ou clientes."
    ]
  },
  {
    title: "Seguranca e retencao",
    items: [
      "Aplicamos controles tecnicos razoaveis para proteger credenciais, tokens e dados operacionais.",
      "Os dados sao mantidos enquanto a conta estiver ativa ou enquanto forem necessarios para cumprir obrigacoes legais e operacionais.",
      "Solicitacoes de exclusao ou correcao podem ser enviadas pelo canal de suporte informado nesta pagina."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-ink md:px-8">
      <article className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 md:p-8">
        <Header title="Politica de Privacidade" />
        <p className="mt-6 text-sm leading-6 text-slate-600">
          Esta Politica de Privacidade descreve como o SmartAgenda coleta, usa e protege dados
          pessoais para operar o agendamento por WhatsApp integrado ao Google Calendar.
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
            Para duvidas, solicitacoes de privacidade ou remocao de dados, entre em contato pelo
            email de suporte configurado pelo responsavel do SmartAgenda.
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
