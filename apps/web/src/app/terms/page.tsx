import { CalendarCheck } from "lucide-react";

const CONTACT_EMAIL = "contato@agendasmart.com.br";

const sections = [
  {
    title: "Uso da plataforma",
    items: [
      "O SmartAgenda centraliza atendimentos recebidos por WhatsApp, consulta disponibilidade no Google Calendar e cria agendamentos quando autorizado.",
      "O profissional é responsável por manter seus dados, serviços, horários e integrações corretos.",
      "O uso da plataforma deve respeitar leis aplicáveis, políticas do WhatsApp, políticas do Google e direitos dos clientes atendidos."
    ]
  },
  {
    title: "Contas e integrações",
    items: [
      "Cada profissional deve conectar uma conta Google própria para uso do Google Calendar.",
      "Cada número de WhatsApp deve ser conectado por QR Code ou outro método autorizado pela Evolution API.",
      "A indisponibilidade de Google, WhatsApp, Evolution API ou infraestrutura externa pode afetar o funcionamento do SmartAgenda."
    ]
  },
  {
    title: "Responsabilidades do profissional",
    items: [
      "Conferir os agendamentos criados e manter regras de disponibilidade atualizadas.",
      "Garantir que possui autorização para armazenar e tratar dados dos clientes atendidos.",
      "Usar mensagens automáticas de forma adequada, sem spam, abuso ou comunicação indevida."
    ]
  },
  {
    title: "Limitações",
    items: [
      "O SmartAgenda busca automatizar agendamentos, mas não substitui revisão humana em casos sensíveis ou urgentes.",
      "Podem ocorrer falhas temporárias por indisponibilidade de APIs externas, erros de conexão, configurações incorretas ou limites de uso.",
      "Novas funcionalidades podem ser alteradas, pausadas ou removidas durante a evolução do produto."
    ]
  },
  {
    title: "Cancelamento e dados",
    items: [
      "O profissional pode solicitar desconexão das integrações e exclusão de dados operacionais quando aplicável.",
      "Tokens do Google podem ser revogados diretamente pela Conta Google do usuário em myaccount.google.com/permissions.",
      "Alguns registros podem ser mantidos pelo tempo necessário para cumprir obrigações legais, fiscais ou de segurança."
    ]
  }
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-ink md:px-8">
      <article className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 md:p-8">
        <Header title="Termos de Uso" />
        <p className="mt-6 text-sm leading-6 text-slate-600">
          Estes Termos de Uso definem as condições gerais para uso do SmartAgenda, uma plataforma
          para organizar agendamentos via WhatsApp com integração ao Google Calendar.
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
            Para dúvidas sobre estes termos, entre em contato pelo e-mail{" "}
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
