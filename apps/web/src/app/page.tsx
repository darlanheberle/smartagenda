import {
  BadgeDollarSign,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Link2,
  MessageCircle,
  PlayCircle,
  Settings2,
  Smartphone,
  UsersRound
} from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "./components/logout-button";
import { DashboardView } from "./components/dashboard-view";

export const dynamic = "force-dynamic";

type Dashboard = {
  appointments: number;
  pending: number;
  completed: number;
  cancellations: number;
  expectedRevenue: number;
  pendingRevenue: number;
};

type Client = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  updated_at: string;
};

type Appointment = {
  id: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  value_cents: number;
  payment_status: string;
  google_event_link?: string;
  client_name?: string;
  client_phone?: string;
};

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
};

type OnboardingStatus = {
  professional?: {
    id: string;
    name: string;
    whatsappNumber: string;
    evolutionInstanceName: string;
    gmail: string;
    whatsappStatus: string;
  };
  googleConnected: boolean;
  whatsappConnected: boolean;
  servicesConfigured: boolean;
  availabilityConfigured: boolean;
  servicesCount: number;
  availabilityRulesCount: number;
  ready: boolean;
};

type AccountProfessional = {
  id: string;
  name: string;
  specialty?: string;
  gmail: string;
  whatsappNumber: string;
};

async function fetchJson<T>(path: string, fallback: T, cookieHeader: string): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      cache: "no-store",
      headers: { cookie: cookieHeader }
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
  const cookieHeader = (await cookies()).toString();
  const sessionResponse = await fetch(`${apiUrl}/auth/me`, {
    cache: "no-store",
    headers: { cookie: cookieHeader }
  }).catch(() => undefined);

  if (!sessionResponse?.ok) {
    redirect("/login");
  }

  const account = (await sessionResponse.json()) as { professional: AccountProfessional };
  const professionalId = account.professional.id;
  const googleConnectUrl = `${apiUrl}/integrations/google/start?professionalId=${professionalId}`;
  const whatsappPrepareUrl = `${apiUrl}/onboarding/${professionalId}/whatsapp/prepare`;
  const whatsappConnectUrl = `${apiUrl}/onboarding/${professionalId}/whatsapp/connect`;
  const defaultsUrl = `${apiUrl}/onboarding/${professionalId}/defaults`;
  const [dashboard, clients, appointments, services, onboarding] = await Promise.all([
    fetchJson<Dashboard>(`/dashboard/today`, {
      appointments: 0,
      pending: 0,
      completed: 0,
      cancellations: 0,
      expectedRevenue: 0,
      pendingRevenue: 0
    }, cookieHeader),
    fetchJson<Client[]>(`/clients`, [], cookieHeader),
    fetchJson<Appointment[]>(`/appointments/upcoming?limit=10`, [], cookieHeader),
    fetchJson<Service[]>(`/services`, [], cookieHeader),
    fetchJson<OnboardingStatus>(`/onboarding/${professionalId}/status`, {
      googleConnected: false,
      whatsappConnected: false,
      servicesConfigured: false,
      availabilityConfigured: false,
      servicesCount: 0,
      availabilityRulesCount: 0,
      ready: false
    }, cookieHeader)
  ]);
  const onboardingSteps = [
    {
      icon: <Link2 size={16} />,
      title: "Google Agenda",
      detail: onboarding.professional?.gmail || "Gmail do profissional",
      done: onboarding.googleConnected,
      actionLabel: onboarding.googleConnected ? "Reconectar" : "Conectar",
      href: googleConnectUrl
    },
    {
      icon: <Smartphone size={16} />,
      title: "WhatsApp",
      detail: onboarding.professional?.evolutionInstanceName || "Instancia Evolution",
      done: onboarding.whatsappConnected,
      actionLabel: onboarding.whatsappConnected ? "Abrir conexao" : "Preparar",
      href: whatsappConnectUrl,
      postHref: whatsappPrepareUrl
    },
    {
      icon: <Settings2 size={16} />,
      title: "Servicos",
      detail: `${onboarding.servicesCount || services.length} servicos ativos`,
      done: onboarding.servicesConfigured,
      actionLabel: "Criar padrao",
      href: defaultsUrl,
      postHref: defaultsUrl
    },
    {
      icon: <Clock3 size={16} />,
      title: "Horarios",
      detail: `${onboarding.availabilityRulesCount || 0} regras ativas`,
      done: onboarding.availabilityConfigured,
      actionLabel: "Criar padrao",
      href: defaultsUrl,
      postHref: defaultsUrl
    }
  ];
  const completedSteps = onboardingSteps.filter((step) => step.done).length;

  return (
    <DashboardView
      account={account.professional}
      appointments={appointments}
      clients={clients}
      dashboard={dashboard}
      googleConnectUrl={googleConnectUrl}
      onboarding={onboarding}
      services={services}
      whatsappConnectUrl={whatsappConnectUrl}
    />
  );

  /*
  return (
    <main className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-6 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-brand-600 text-white">
            <CalendarCheck size={22} />
          </div>
          <div>
            <p className="text-lg font-semibold">SmartAgenda</p>
            <p className="text-xs text-slate-500">WhatsApp + Agenda</p>
          </div>
        </div>

        <nav className="mt-8 space-y-1 text-sm">
          {["Dashboard", "Configuracoes", "Agenda", "Clientes", "Servicos", "Financeiro", "Integracoes"].map(
            (item, index) => (
              <a
                className={`flex items-center rounded-md px-3 py-2 ${
                  index === 0 ? "bg-brand-50 text-brand-900" : "text-slate-600 hover:bg-slate-100"
                }`}
                href={item === "Configuracoes" || item === "Servicos" ? "/admin" : item === "Dashboard" ? "/" : "#"}
                key={item}
              >
                {item}
              </a>
            )
          )}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-ink">Painel do profissional</h1>
              <p className="text-sm text-slate-500">
                {account.professional.name} - {account.professional.gmail}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <MessageCircle size={16} />
                {onboarding.whatsappConnected ? "WhatsApp ativo" : "WhatsApp pendente"}
              </button>
              <a
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2"
                href={googleConnectUrl}
              >
                <Link2 size={16} />
                Conectar Google Agenda
              </a>
              <LogoutButton />
            </div>
          </div>
        </header>

        <div className="grid gap-6 px-4 py-6 md:px-8 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-semibold">Bem-vindo ao SmartAgenda</h2>
                  <p className="text-sm text-slate-500">
                    Complete as conexoes iniciais para liberar o atendimento automatico.
                  </p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${onboarding.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {onboarding.ready ? "Atendimento liberado" : `${completedSteps}/4 etapas completas`}
                </span>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                {onboardingSteps.map((step) => (
                  <div className="rounded-md border border-slate-200 p-3" key={step.title}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-md bg-brand-50 text-brand-700">
                          {step.icon}
                        </span>
                        <div>
                          <p className="font-medium">{step.title}</p>
                          <p className="text-xs text-slate-500">{step.detail}</p>
                        </div>
                      </div>
                      <StepState done={step.done} />
                    </div>
                    <div className="mt-4 flex gap-2">
                      {step.postHref ? (
                        <form action={step.postHref} method="post">
                          <button className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <PlayCircle size={13} />
                            {step.actionLabel}
                          </button>
                        </form>
                      ) : (
                        <a
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          href={step.href}
                        >
                          <PlayCircle size={13} />
                          {step.actionLabel}
                        </a>
                      )}
                      {step.title === "WhatsApp" ? (
                        <a
                          className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          href={whatsappConnectUrl}
                          target="_blank"
                        >
                          QR
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <Metric icon={<CalendarCheck size={18} />} label="Atendimentos hoje" value={`${dashboard.appointments}`} />
              <Metric icon={<Clock3 size={18} />} label="Pendentes" value={`${dashboard.pending}`} />
              <Metric icon={<CheckCircle2 size={18} />} label="Concluidos" value={`${dashboard.completed}`} />
              <Metric
                icon={<BadgeDollarSign size={18} />}
                label="Financeiro pendente"
                value={formatCurrency(dashboard.pendingRevenue)}
              />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-semibold">Proximos atendimentos</h2>
                  <p className="text-sm text-slate-500">Eventos salvos pelo fluxo WhatsApp e vinculados ao Google Calendar.</p>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {appointments.length} proximos
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Horario</th>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Servico</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                      <th className="px-4 py-3 font-medium">Google</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appointments.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                          Nenhum atendimento futuro encontrado.
                        </td>
                      </tr>
                    ) : (
                      appointments.map((appointment) => (
                        <tr className="align-middle" key={appointment.id}>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {formatDateTime(appointment.starts_at)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{appointment.client_name || "Cliente"}</p>
                            <p className="text-xs text-slate-500">{appointment.client_phone || "-"}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{appointment.service_name}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={appointment.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatCurrency(appointment.value_cents / 100)}</td>
                          <td className="px-4 py-3">
                            {appointment.google_event_link ? (
                              <a
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                href={appointment.google_event_link}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Abrir
                                <ExternalLink size={13} />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">Sem link</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel title="Clientes recentes" subtitle="Identificados pelo telefone do WhatsApp">
                <div className="space-y-3">
                  {clients.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                      Nenhum cliente salvo ainda.
                    </p>
                  ) : (
                    clients.slice(0, 6).map((client) => (
                      <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3" key={client.id}>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-sm text-slate-500">{client.phone || client.email || "-"}</p>
                        </div>
                        <span className="text-xs text-slate-500">{formatShortDate(client.updated_at)}</span>
                      </div>
                    ))
                  )}
                </div>
              </Panel>

              <Panel title="Servicos" subtitle="Usados pelo fluxo de agendamento">
                <div className="space-y-3">
                  {services.map((service) => (
                    <div className="rounded-md border border-slate-200 px-3 py-3" key={service.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{service.name}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${service.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {service.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {service.duration_minutes} min - {formatCurrency(service.price_cents / 100)}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          </div>

          <aside className="space-y-6">
            <Panel title="Resumo financeiro" subtitle="Baseado nos atendimentos salvos">
              <div className="space-y-4">
                <FinancialRow label="Previsto hoje" value={formatCurrency(dashboard.expectedRevenue)} tone="green" />
                <FinancialRow label="Pendente hoje" value={formatCurrency(dashboard.pendingRevenue)} tone="amber" />
                <FinancialRow label="Cancelamentos" value={`${dashboard.cancellations}`} tone="slate" />
              </div>
            </Panel>

            <Panel title="Regras ativas" subtitle="Agenda consultada antes da resposta">
              <div className="space-y-3 text-sm text-slate-600">
                <RequiredItem label="Profissional" value={account.professional.name} />
                <RequiredItem label="Agenda" value={onboarding.googleConnected ? "Google conectado" : "Pendente"} />
                <RequiredItem label="WhatsApp" value={onboarding.whatsappConnected ? "Evolution conectado" : onboarding.professional?.whatsappStatus || "Pendente"} />
                <RequiredItem label="Servicos" value={`${services.filter((service) => service.active).length} ativos`} />
              </div>
            </Panel>

            <Panel title="Proximas configuracoes" subtitle="Base para operar como SaaS">
              <div className="space-y-3 text-sm text-slate-600">
                <NextItem text="Cadastrar servicos e valores por profissional" />
                <NextItem text="Definir disponibilidade semanal e pausas" />
                <NextItem text="Marcar pagamento recebido ou pendente" />
              </div>
            </Panel>
          </aside>
        </div>
      </section>
    </main>
  );
  */
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

function RequiredItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200 px-3 py-2.5">
      <span className="font-medium text-slate-800">{label}</span>
      <span className="text-right text-slate-500">{value}</span>
    </div>
  );
}

function StepState({ done }: { done: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      {done ? "Pronto" : "Pendente"}
    </span>
  );
}

function NextItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 px-3 py-2.5">
      <Settings2 className="mt-0.5 text-brand-600" size={15} />
      <span>{text}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "cancelled"
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}>{status}</span>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}
