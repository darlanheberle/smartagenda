import { CalendarPlus, Plus } from "lucide-react";
import { Card, Pill, SectionTitle } from "../components/ui";
import { formatCurrency, formatTime } from "../lib/format";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

const hours = Array.from({ length: 10 }, (_, index) => 8 + index);

export default async function AgendaPage() {
  const { appointments } = await getPanelData();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-700">{formatMonth(today)}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">Agenda</h1>
          <p className="mt-1 text-sm text-slate-500">Horarios livres e ocupados sincronizados com Google Agenda.</p>
        </div>
        <button
          aria-label="Novo agendamento"
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          type="button"
        >
          <Plus size={21} />
        </button>
      </header>

      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex min-w-max gap-2">
          {days.map((day, index) => (
            <button
              className={`min-h-[76px] w-16 rounded-3xl border px-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                index === 0
                  ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-200"
                  : "border-slate-100 bg-white text-slate-600 shadow-sm"
              }`}
              key={day.toISOString()}
              type="button"
            >
              <span className="block text-xs font-semibold uppercase">{formatWeekday(day)}</span>
              <span className="mt-1 block font-display text-2xl font-bold">{day.getDate()}</span>
            </button>
          ))}
        </div>
      </div>

      <Card className="p-5">
        <SectionTitle subtitle="Toque nos horarios livres para criar um novo atendimento." title="Hoje" />
        <div className="mt-5 space-y-3">
          {hours.map((hour) => {
            const appointment = appointments.find((item) => new Date(item.starts_at).getHours() === hour);

            return (
              <div className="grid grid-cols-[50px_1fr] gap-3" key={hour}>
                <div className="pt-4 text-right text-sm font-bold tabular text-slate-500">{String(hour).padStart(2, "0")}:00</div>
                {appointment ? (
                  <div className="rounded-3xl border border-violet-100 bg-violet-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{appointment.client_name || "Cliente"}</p>
                        <p className="mt-1 text-sm text-slate-500">{appointment.service_name}</p>
                      </div>
                      <Pill tone="violet">{formatTime(appointment.starts_at)}</Pill>
                    </div>
                    <p className="mt-3 text-sm font-semibold tabular text-violet-700">
                      {formatCurrency(appointment.value_cents / 100)}
                    </p>
                  </div>
                ) : (
                  <button
                    className="flex min-h-[76px] items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-400 hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    type="button"
                  >
                    <CalendarPlus size={17} />
                    Livre
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" }).format(value);
}

function formatWeekday(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" })
    .format(value)
    .replace(".", "");
}
