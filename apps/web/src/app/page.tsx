import {
  BadgeDollarSign,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  UsersRound
} from "lucide-react";

const appointments = [
  { time: "09:00", client: "Maria Souza", service: "Consulta", status: "Confirmado" },
  { time: "10:30", client: "Carlos Lima", service: "Retorno", status: "Aguardando" },
  { time: "14:00", client: "Ana Pereira", service: "Avaliação", status: "Confirmado" },
  { time: "16:00", client: "Pedro Rocha", service: "Sessão", status: "Pendente" }
];

const messages = [
  "Cliente pediu horário para semana que vem",
  "IA sugeriu terça 14h ou quinta 16h",
  "Evento criado na Google Agenda",
  "Lembrete de 24h programado"
];

const clients = [
  { name: "Maria Souza", phone: "+55 11 90000-1111", history: "3 atendimentos" },
  { name: "Carlos Lima", phone: "+55 11 90000-2222", history: "1 falta" },
  { name: "Ana Pereira", phone: "+55 11 90000-3333", history: "5 atendimentos" }
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white/88 px-5 py-6 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-brand-600 text-white">
            <CalendarCheck size={22} />
          </div>
          <div>
            <p className="text-lg font-semibold">SmartAgenda</p>
            <p className="text-xs text-slate-500">WhatsApp + Agenda + IA</p>
          </div>
        </div>

        <nav className="mt-8 space-y-1 text-sm">
          {["Dashboard", "Agenda", "Clientes", "Financeiro", "Equipe", "Integrações"].map(
            (item, index) => (
              <a
                className={`flex items-center rounded-md px-3 py-2 ${
                  index === 0 ? "bg-brand-50 text-brand-900" : "text-slate-600 hover:bg-slate-100"
                }`}
                href="#"
                key={item}
              >
                {item}
              </a>
            )
          )}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/82 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-ink">Operação de hoje</h1>
              <p className="text-sm text-slate-500">
                Agenda sincronizada, atendimento por IA e controle financeiro.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <MessageCircle size={16} />
                WhatsApp
              </button>
              <button className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
                <CalendarCheck size={16} />
                Novo agendamento
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 px-4 py-6 md:px-8 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-4">
              <Metric icon={<CalendarCheck size={18} />} label="Atendimentos" value="8" />
              <Metric icon={<Clock3 size={18} />} label="Cancelamentos" value="2" />
              <Metric icon={<BadgeDollarSign size={18} />} label="Previsto" value="R$ 1.840" />
              <Metric icon={<UsersRound size={18} />} label="Clientes ativos" value="126" />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="font-semibold">Agenda</h2>
                  <p className="text-sm text-slate-500">Visualização do dia sincronizada com Google.</p>
                </div>
                <div className="flex rounded-md border border-slate-200 p-1 text-xs">
                  {["Dia", "Semana", "Mês"].map((item, index) => (
                    <button
                      className={`rounded px-3 py-1.5 ${index === 0 ? "bg-slate-900 text-white" : "text-slate-600"}`}
                      key={item}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {appointments.map((item) => (
                  <div className="grid gap-3 px-4 py-4 md:grid-cols-[84px_1fr_120px]" key={item.time}>
                    <span className="font-semibold text-brand-700">{item.time}</span>
                    <div>
                      <p className="font-medium">{item.client}</p>
                      <p className="text-sm text-slate-500">{item.service}</p>
                    </div>
                    <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel title="Clientes" subtitle="Cadastro e histórico">
                <div className="space-y-3">
                  {clients.map((client) => (
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3" key={client.phone}>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-sm text-slate-500">{client.phone}</p>
                      </div>
                      <span className="text-xs text-slate-500">{client.history}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Financeiro" subtitle="Recebidos e pendentes">
                <div className="space-y-4">
                  <FinancialRow label="Recebido" value="R$ 980,00" tone="green" />
                  <FinancialRow label="Pendente" value="R$ 860,00" tone="amber" />
                  <FinancialRow label="PIX" value="62%" tone="slate" />
                  <FinancialRow label="Cartão" value="28%" tone="slate" />
                  <FinancialRow label="Dinheiro" value="10%" tone="slate" />
                </div>
              </Panel>
            </section>
          </div>

          <aside className="space-y-6">
            <Panel title="Assistente IA" subtitle="Fluxo WhatsApp em execução">
              <div className="rounded-md bg-slate-950 p-4 text-sm text-slate-100">
                <div className="mb-3 flex items-center gap-2 text-brand-100">
                  <Bot size={16} />
                  Atendimento automatizado
                </div>
                <p>Tenho disponível terça às 14h ou quinta às 16h. Qual prefere?</p>
              </div>
              <div className="mt-4 space-y-3">
                {messages.map((message) => (
                  <div className="flex items-start gap-2 text-sm text-slate-600" key={message}>
                    <CheckCircle2 className="mt-0.5 text-brand-600" size={16} />
                    <span>{message}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Planos" subtitle="Modelo inicial de assinatura">
              <div className="space-y-3">
                <Plan name="Básico" price="R$ 29,90" details="1 profissional, WhatsApp e Google Agenda" />
                <Plan name="Profissional" price="R$ 59,90" details="IA, lembretes e financeiro" />
                <Plan name="Equipe" price="R$ 99,90" details="Múltiplos profissionais e agendas" />
              </div>
            </Panel>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex size-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function FinancialRow({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "slate" }) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700"
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-sm font-medium ${colors[tone]}`}>{value}</span>
    </div>
  );
}

function Plan({ name, price, details }: { name: string; price: string; details: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{name}</p>
        <p className="font-semibold text-brand-700">{price}</p>
      </div>
      <p className="mt-1 text-sm text-slate-500">{details}</p>
    </div>
  );
}
