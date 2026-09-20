const CONTACT_EMAIL = "contato@agendasmart.com.br";

const sections = [
  {
    title: "Dados que coletamos",
    items: [
      "Dados do profissional, como nome, especialidade, telefone WhatsApp, e-mail Gmail e configurações de agenda.",
      "Dados de clientes informados durante o atendimento, como nome, telefone, e-mail, observações e histórico de agendamentos.",
      "Dados técnicos de integração, como identificadores de eventos do Google Calendar, status de conexão e logs operacionais."
    ]
  },
  {
    title: "Uso do Google Calendar",
    items: [
      "O AgendaSmart solicita acesso ao Google Calendar para consultar disponibilidade e criar, alterar ou cancelar eventos conforme comandos do profissional ou de seus clientes.",
      "Os escopos solicitados limitam-se a eventos de agenda (calendar.events) e à consulta de horários livres/ocupados (calendar.freebusy). Não acessamos outros dados da sua Conta Google.",
      "Os tokens OAuth são armazenados de forma protegida apenas para manter a integração ativa e podem ser revogados pelo usuário a qualquer momento na Conta Google.",
      "O AgendaSmart não vende dados do Google Calendar e não os utiliza para publicidade ou para treinar modelos de inteligência artificial."
    ]
  },
  {
    title: "Uso limitado dos dados do Google (Limited Use)",
    items: [
      "O uso e a transferência, pelo AgendaSmart, de informações recebidas das APIs do Google obedecem à Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado (Limited Use).",
      "Os dados obtidos das APIs do Google são usados exclusivamente para prestar e melhorar as funcionalidades de agendamento visíveis ao usuário, e não são transferidos a terceiros, exceto quando necessário para operar o serviço, por exigência legal ou com o consentimento do usuário."
    ]
  },
  {
    title: "Uso do WhatsApp",
    items: [
      "Mensagens recebidas via WhatsApp podem ser processadas para identificar clientes, entender pedidos de agendamento e enviar confirmações.",
      "A conexão do WhatsApp depende da Evolution API configurada para cada instância profissional.",
      "O profissional é responsável por informar seus clientes sobre o uso do atendimento automatizado quando aplicável."
    ]
  },
  {
    title: "Compartilhamento",
    items: [
      "Dados podem ser compartilhados apenas com provedores necessários para operar o serviço, como Google Calendar, Evolution API, infraestrutura de hospedagem e banco de dados.",
      "Não comercializamos informações pessoais de profissionais ou clientes."
    ]
  },
  {
    title: "Segurança e retenção",
    items: [
      "Aplicamos controles técnicos razoáveis para proteger credenciais, tokens e dados operacionais.",
      "Os dados são mantidos enquanto a conta estiver ativa ou enquanto forem necessários para cumprir obrigações legais e operacionais.",
      "Solicitações de exclusão ou correção podem ser enviadas pelo e-mail de contato informado nesta página."
    ]
  },
  {
    title: "Exclusão de dados",
    items: [
      "Você pode revogar o acesso do AgendaSmart à sua Conta Google a qualquer momento em myaccount.google.com/permissions.",
      `Para solicitar a exclusão dos seus dados armazenados no AgendaSmart, envie um pedido para ${CONTACT_EMAIL}. As informações associadas à conta são removidas em até 30 dias, salvo registros que precisem ser mantidos por obrigação legal.`
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-ink md:px-8">
      <article className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 md:p-8">
        <Header title="Política de Privacidade" />
        <p className="mt-6 text-sm leading-6 text-slate-600">
          Esta Política de Privacidade descreve como o AgendaSmart coleta, usa e protege dados
          pessoais para operar o agendamento por WhatsApp integrado ao Google Calendar.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">Última atualização: 19/09/2026.</p>

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
            Para dúvidas, solicitações de privacidade ou remoção de dados, entre em contato pelo
            e-mail{" "}
            <a className="font-medium text-brand-600 underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
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
        <span className="grid size-10 place-items-center overflow-hidden rounded-lg">
          <img alt="AgendaSmart" className="h-full w-full object-contain" src="/logo-agendasmart.png" />
        </span>
        <span>
          <span className="block text-lg font-semibold">AgendaSmart</span>
          <span className="block text-xs text-slate-500">WhatsApp + Google Calendar</span>
        </span>
      </a>
      <h1 className="mt-6 text-3xl font-semibold tracking-normal">{title}</h1>
    </header>
  );
}
