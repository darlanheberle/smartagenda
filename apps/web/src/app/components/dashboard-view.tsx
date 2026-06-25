import {
  ArrowUpRight,
  CalendarCheck2,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  MessageCircle,
  Settings2,
  Smartphone,
  UserRound,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { ProductShell } from "./product-shell";

type DashboardViewProps = {
  account: {
    id: string;
    name: string;
    specialty?: string;
    gmail: string;
  };
  dashboard: {
    appointments: number;
    pending: number;
    completed: number;
    cancellations: number;
    expectedRevenue: number;
    pendingRevenue: number;
  };
  clients: Array<{
    id: string;
    name: string;
    phone?: string;
    email?: string;
    updated_at: string;
  }>;
  appointments: Array<{
    id: string;
    service_name: string;
    starts_at: string;
    status: string;
    value_cents: number;
    google_event_link?: string;
    client_name?: string;
    client_phone?: string;
  }>;
  services: Array<{
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number;
    active: boolean;
  }>;
  onboarding: {
    googleConnected: boolean;
    whatsappConnected: boolean;
    servicesConfigured: boolean;
    availabilityConfigured: boolean;
    ready: boolean;
  };
  googleConnectUrl: string;
  whatsappConnectUrl: string;
};

export function DashboardView({
  account,
  appointments,
  clients,
  dashboard,
  googleConnectUrl,
  onboarding,
  services,
  whatsappConnectUrl
}: DashboardViewProps) {
  const activeServices = services.filter((service) => service.active);
  const setupSteps = [
    { label: "Google Agenda", done: onboarding.googleConnected },
    { label: "WhatsApp", done: onboarding.whatsappConnected },
    { label: "Servicos", done: onboarding.servicesConfigured },
    { label: "Horarios", done: onboarding.availabilityConfigured }
  ];
  const completedSetup = setupSteps.filter((step) => step.done).length;

  return (
    <ProductShell active="dashboard" email={account.gmail} name={account.name}>
      <header className="border-b border-black/10 bg-[var(--canvas)] px-4 py-5 md:px-7">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">{formatLongDate(new Date())}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--ink)] text-balance">
              Bom dia, {firstName(account.name)}
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">
              {account.specialty || "Painel do profissional"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IntegrationPill
              active={onboarding.whatsappConnected}
              icon={<MessageCircle size={15} />}
              label="WhatsApp"
            />
            <IntegrationPill
              active={onboarding.googleConnected}
              icon={<CalendarCheck2 size={15} />}
              label="Google Agenda"
            />
            <Link className="btn-primary" href="/admin">
              <Settings2 size={16} />
              Configurar agenda
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 md:px-7 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-5">
          {!onboarding.ready ? (
            <section className="surface overflow-hidden rounded-lg">
              <div className="grid md:grid-cols-[220px_1fr]">
                <div className="bg-[var(--warning-soft)] px-5 py-5">
                  <p className="eyebrow text-[var(--warning)]">Configuracao inicial</p>
                  <p className="mt-2 text-3xl font-semibold tabular text-[var(--ink)]">
                    {completedSetup}
                    <span className="text-base font-medium text-[var(--ink-muted)]">/4</span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-secondary)]">etapas concluidas</p>
                </div>
                <div className="px-5 py-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--ink)]">
                        Prepare o atendimento automatico
                      </h2>
                      <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                        Complete as conexoes para a IA confirmar horarios pelo WhatsApp.
                      </p>
                    </div>
                    <Link className="btn-secondary shrink-0" href="/admin">
                      Continuar configuracao
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    {setupSteps.map((step) => (
                      <div className="flex items-center gap-2 text-xs" key={step.label}>
                        <span
                          className={`grid size-5 place-items-center rounded-full ${
                            step.done
                              ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                              : "bg-[var(--surface-inset)] text-[var(--ink-muted)]"
                          }`}
                        >
                          {step.done ? <Check size={12} strokeWidth={3} /> : <Clock3 size={11} />}
                        </span>
                        <span className={step.done ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="surface rounded-lg px-5 py-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Ritmo de hoje</p>
                <div className="mt-3 flex items-end gap-3">
                  <p className="text-5xl font-semibold leading-none tabular text-[var(--ink)]">
                    {dashboard.appointments}
                  </p>
                  <div className="pb-1">
                    <h2 className="text-base font-semibold text-[var(--ink)]">atendimentos</h2>
                    <p className="text-sm text-[var(--ink-muted)]">
                      {dashboard.pending} ainda aguardam conclusao
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 border-t border-black/10 pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                <InlineMetric label="Concluidos" value={String(dashboard.completed)} />
                <InlineMetric label="Cancelados" value={String(dashboard.cancellations)} />
                <InlineMetric label="Previsto" value={formatCurrency(dashboard.expectedRevenue)} />
              </div>
            </div>
          </section>

          <section className="surface rounded-lg" id="agenda">
            <SectionHeader
              action={<span className="text-xs font-medium text-[var(--ink-muted)]">{appointments.length} proximos</span>}
              subtitle="Sua sequencia de atendimentos sincronizada com o Google."
              title="Proximos horarios"
            />
            {appointments.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck2 size={22} />}
                text="Os novos agendamentos feitos pelo WhatsApp aparecerao aqui."
                title="Agenda livre por enquanto"
              />
            ) : (
              <div className="divide-y divide-black/[0.07] px-4 pb-2">
                {appointments.map((appointment, index) => (
                  <div
                    className="grid grid-cols-[64px_16px_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[78px_18px_minmax(0,1fr)_auto]"
                    key={appointment.id}
                  >
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular text-[var(--ink)]">
                        {formatTime(appointment.starts_at)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                        {formatDay(appointment.starts_at)}
                      </p>
                    </div>
                    <div className="relative flex justify-center">
                      {index < appointments.length - 1 ? (
                        <span className="absolute bottom-[-16px] top-3 w-px bg-black/10" />
                      ) : null}
                      <span
                        className={`relative mt-1.5 size-2.5 rounded-full ring-4 ${
                          appointment.status === "completed"
                            ? "bg-[var(--brand)] ring-[var(--brand-soft)]"
                            : "bg-[var(--calendar)] ring-[var(--calendar-soft)]"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--ink)]">
                          {appointment.client_name || "Cliente"}
                        </p>
                        <StatusBadge status={appointment.status} />
                      </div>
                      <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                        {appointment.service_name}
                        {appointment.client_phone ? ` · ${appointment.client_phone}` : ""}
                      </p>
                    </div>
                    <div className="col-start-3 flex items-center gap-3 sm:col-start-auto">
                      <span className="text-sm font-medium tabular text-[var(--ink-secondary)]">
                        {formatCurrency(appointment.value_cents / 100)}
                      </span>
                      {appointment.google_event_link ? (
                        <a
                          aria-label="Abrir evento no Google Agenda"
                          className="grid size-9 place-items-center rounded-md text-[var(--calendar)] hover:bg-[var(--calendar-soft)]"
                          href={appointment.google_event_link}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink size={15} />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <section className="surface rounded-lg" id="clientes">
              <SectionHeader subtitle="Identificados automaticamente pelo telefone." title="Clientes recentes" />
              {clients.length === 0 ? (
                <EmptyState
                  icon={<UsersRound size={22} />}
                  text="O primeiro contato salvo pelo WhatsApp aparecera aqui."
                  title="Nenhum cliente ainda"
                />
              ) : (
                <div className="divide-y divide-black/[0.07] px-4 pb-2">
                  {clients.slice(0, 5).map((client) => (
                    <div className="flex items-center gap-3 py-3" key={client.id}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--surface-inset)] text-[var(--ink-secondary)]">
                        <UserRound size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--ink)]">{client.name}</p>
                        <p className="truncate text-xs text-[var(--ink-muted)]">
                          {client.phone || client.email || "Sem contato"}
                        </p>
                      </div>
                      <span className="text-[11px] tabular text-[var(--ink-muted)]">
                        {formatShortDate(client.updated_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="surface rounded-lg">
              <SectionHeader
                action={
                  <Link className="text-xs font-semibold text-[var(--brand)] hover:underline" href="/admin">
                    Gerenciar
                  </Link>
                }
                subtitle="Opcoes oferecidas pela IA durante a conversa."
                title="Servicos ativos"
              />
              <div className="divide-y divide-black/[0.07] px-4 pb-2">
                {activeServices.slice(0, 5).map((service) => (
                  <div className="flex items-center justify-between gap-4 py-3" key={service.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{service.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                        {service.duration_minutes} minutos
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular text-[var(--ink-secondary)]">
                      {formatCurrency(service.price_cents / 100)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="surface rounded-lg" id="financeiro">
            <SectionHeader subtitle="Valores dos atendimentos de hoje." title="Financeiro" />
            <div className="px-5 pb-5">
              <p className="text-3xl font-semibold tabular text-[var(--ink)]">
                {formatCurrency(dashboard.expectedRevenue)}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">faturamento previsto</p>
              <div className="mt-5 space-y-3 border-t border-black/10 pt-4">
                <FinanceRow label="Pendente" value={formatCurrency(dashboard.pendingRevenue)} warning />
                <FinanceRow
                  label="Recebido ou concluido"
                  value={formatCurrency(Math.max(0, dashboard.expectedRevenue - dashboard.pendingRevenue))}
                />
              </div>
            </div>
          </section>

          <section className="surface rounded-lg">
            <SectionHeader subtitle="Canais que sustentam o atendimento." title="Integracoes" />
            <div className="space-y-2 px-4 pb-4">
              <IntegrationRow
                action={googleConnectUrl}
                active={onboarding.googleConnected}
                icon={<CalendarCheck2 size={17} />}
                label="Google Agenda"
              />
              <IntegrationRow
                action={whatsappConnectUrl}
                active={onboarding.whatsappConnected}
                icon={<Smartphone size={17} />}
                label="WhatsApp Evolution"
              />
            </div>
          </section>

          <section className="rounded-lg bg-[var(--brand)] px-5 py-5 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageCircle size={17} />
              Atendimento automatico
            </div>
            <p className="mt-3 text-sm leading-6 text-white/75">
              {onboarding.ready
                ? "A IA ja pode consultar sua agenda, oferecer horarios e confirmar atendimentos."
                : "Finalize as configuracoes para liberar o fluxo completo pelo WhatsApp."}
            </p>
            <Link
              className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              href="/admin"
            >
              Ver configuracoes
              <ArrowUpRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
    </ProductShell>
  );
}

function IntegrationPill({
  active,
  icon,
  label
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span
      className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold ${
        active
          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
          : "bg-[var(--warning-soft)] text-[var(--warning)]"
      }`}
    >
      {icon}
      {label}
      <span className={`size-1.5 rounded-full ${active ? "bg-[var(--brand)]" : "bg-[var(--warning)]"}`} />
    </span>
  );
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{label}</p>
    </div>
  );
}

function SectionHeader({
  action,
  subtitle,
  title
}: {
  action?: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  icon,
  text,
  title
}: {
  icon: React.ReactNode;
  text: string;
  title: string;
}) {
  return (
    <div className="mx-4 mb-4 rounded-md bg-[var(--surface-subtle)] px-5 py-8 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-md bg-white text-[var(--ink-muted)] shadow-sm">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-[var(--ink)]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--ink-muted)]">{text}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const completed = status === "completed";
  const cancelled = status === "cancelled";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        completed
          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
          : cancelled
            ? "bg-[var(--danger-soft)] text-[var(--danger)]"
            : "bg-[var(--calendar-soft)] text-[var(--calendar)]"
      }`}
    >
      {completed ? <CheckCircle2 size={10} /> : cancelled ? <CircleAlert size={10} /> : <Clock3 size={10} />}
      {completed ? "Concluido" : cancelled ? "Cancelado" : "Agendado"}
    </span>
  );
}

function FinanceRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-[var(--ink-secondary)]">{label}</span>
      <span className={`text-sm font-semibold tabular ${warning ? "text-[var(--warning)]" : "text-[var(--brand)]"}`}>
        {value}
      </span>
    </div>
  );
}

function IntegrationRow({
  action,
  active,
  icon,
  label
}: {
  action: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      className="flex min-h-12 items-center gap-3 rounded-md bg-[var(--surface-subtle)] px-3 hover:bg-[var(--surface-inset)]"
      href={action}
      target="_blank"
    >
      <span className={active ? "text-[var(--brand)]" : "text-[var(--ink-muted)]"}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[var(--ink)]">{label}</span>
        <span className={`block text-[11px] ${active ? "text-[var(--brand)]" : "text-[var(--warning)]"}`}>
          {active ? "Conectado" : "Pendente"}
        </span>
      </span>
      <ExternalLink size={13} className="text-[var(--ink-muted)]" />
    </a>
  );
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "profissional";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
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
