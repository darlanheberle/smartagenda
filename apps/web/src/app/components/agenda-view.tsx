import { CalendarRange, ExternalLink } from "lucide-react";
import { ProductShell } from "./product-shell";

export type AgendaAppointment = {
  id: string;
  service_name: string;
  starts_at: string;
  status: string;
  value_cents: number;
  google_event_link?: string;
  client_name?: string;
  client_phone?: string;
};

type AgendaViewProps = {
  account: { name: string; gmail: string };
  appointments: AgendaAppointment[];
};

export function AgendaView({ account, appointments }: AgendaViewProps) {
  const groups = groupByDay(appointments);

  return (
    <ProductShell active="agenda" email={account.gmail} name={account.name}>
      <header className="border-b border-black/10 bg-[var(--canvas)] px-4 py-5 md:px-7">
        <div className="mx-auto max-w-[1440px]">
          <p className="eyebrow">Sua semana</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--ink)] text-balance">Agenda</h1>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            Todos os atendimentos sincronizados com o Google Agenda.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 md:px-7">
        {groups.length === 0 ? (
          <section className="surface rounded-2xl px-5 py-12 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-xl bg-[var(--surface-inset)] text-[var(--ink-muted)]">
              <CalendarRange size={20} />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--ink)]">Nenhum atendimento por aqui</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--ink-muted)]">
              Os agendamentos feitos pelo WhatsApp aparecerao nesta lista.
            </p>
          </section>
        ) : (
          groups.map((group) => (
            <section className="surface rounded-2xl" key={group.label}>
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <h2 className="text-[15px] font-semibold text-[var(--ink)]">{group.label}</h2>
                <span className="text-xs font-medium text-[var(--ink-muted)]">
                  {group.items.length} atendimento{group.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="divide-y divide-black/[0.07] px-4 pb-2">
                {group.items.map((appointment) => (
                  <div
                    className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 py-4 sm:grid-cols-[78px_minmax(0,1fr)_auto]"
                    key={appointment.id}
                  >
                    <div>
                      <p className="text-sm font-semibold tabular text-[var(--ink)]">
                        {formatTime(appointment.starts_at)}
                      </p>
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
                    <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                      <span className="text-sm font-medium tabular text-[var(--ink-secondary)]">
                        {formatCurrency(appointment.value_cents / 100)}
                      </span>
                      {appointment.google_event_link ? (
                        <a
                          aria-label="Abrir evento no Google Agenda"
                          className="grid size-9 place-items-center rounded-xl text-[var(--calendar)] hover:bg-[var(--calendar-soft)]"
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
            </section>
          ))
        )}
      </div>
    </ProductShell>
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
      {completed ? "Concluido" : cancelled ? "Cancelado" : "Agendado"}
    </span>
  );
}

function groupByDay(appointments: AgendaAppointment[]) {
  const map = new Map<string, AgendaAppointment[]>();

  for (const appointment of appointments) {
    const key = formatDayKey(appointment.starts_at);
    const list = map.get(key) || [];
    list.push(appointment);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      label: formatDayLabel(items[0].starts_at),
      items: items.sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      key
    }));
}

function formatDayKey(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function formatDayLabel(value: string) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
