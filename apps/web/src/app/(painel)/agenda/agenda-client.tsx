"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, Pill, SectionTitle } from "../components/ui";
import { formatCurrency, formatTime } from "../lib/format";
import type { Appointment } from "../lib/types";

const hours = Array.from({ length: 10 }, (_, index) => 8 + index);
const timezone = "America/Sao_Paulo";

export function AgendaClient({ appointments }: { appointments: Appointment[] }) {
  const days = useMemo(() => buildDays(21), []);
  const todayKey = dateKey(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const selectedDay = days.find((day) => day.key === selectedDayKey) || days[0];
  const selectedAppointments = appointments.filter((appointment) => dateKey(new Date(appointment.starts_at)) === selectedDay.key);

  function moveDay(offset: number) {
    const currentIndex = days.findIndex((day) => day.key === selectedDay.key);
    const nextDay = days[Math.min(Math.max(currentIndex + offset, 0), days.length - 1)];
    setSelectedDayKey(nextDay.key);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-700">{formatMonth(selectedDay.date)}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">
            {selectedDay.key === todayKey ? "Hoje" : formatHeaderDay(selectedDay.date)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Selecione o dia para ver horarios livres e ocupados.</p>
        </div>
        <button
          aria-label="Novo agendamento"
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          type="button"
        >
          <Plus size={21} />
        </button>
      </header>

      <div className="flex items-center gap-2">
        <button
          aria-label="Dia anterior"
          className="grid size-11 shrink-0 place-items-center rounded-2xl border border-slate-100 bg-white text-slate-500 shadow-sm disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          disabled={selectedDay.key === days[0].key}
          onClick={() => moveDay(-1)}
          type="button"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="-mx-1 flex-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2">
            {days.map((day) => {
              const selected = day.key === selectedDay.key;
              const hasAppointments = appointments.some((appointment) => dateKey(new Date(appointment.starts_at)) === day.key);

              return (
                <button
                  className={`relative min-h-[76px] w-16 rounded-3xl border px-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                    selected
                      ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-200"
                      : "border-slate-100 bg-white text-slate-600 shadow-sm"
                  }`}
                  key={day.key}
                  onClick={() => setSelectedDayKey(day.key)}
                  type="button"
                >
                  <span className="block text-xs font-semibold uppercase">{formatWeekday(day.date)}</span>
                  <span className="mt-1 block font-display text-2xl font-bold">{day.date.getDate()}</span>
                  {hasAppointments ? (
                    <span
                      className={`absolute bottom-2 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${
                        selected ? "bg-white" : "bg-violet-500"
                      }`}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <button
          aria-label="Proximo dia"
          className="grid size-11 shrink-0 place-items-center rounded-2xl border border-slate-100 bg-white text-slate-500 shadow-sm disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          disabled={selectedDay.key === days[days.length - 1].key}
          onClick={() => moveDay(1)}
          type="button"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <Card className="p-5">
        <SectionTitle
          subtitle={`${selectedAppointments.length} atendimento${selectedAppointments.length === 1 ? "" : "s"} neste dia`}
          title={selectedDay.key === todayKey ? "Agenda de hoje" : formatHeaderDay(selectedDay.date)}
        />
        <div className="mt-5 space-y-3">
          {hours.map((hour) => {
            const appointmentsAtHour = selectedAppointments.filter((item) => hourInSaoPaulo(item.starts_at) === hour);
            const appointment = appointmentsAtHour[0];

            return (
              <div className="grid grid-cols-[50px_1fr] gap-3" key={hour}>
                <div className="pt-4 text-right text-sm font-bold tabular text-slate-500">
                  {String(hour).padStart(2, "0")}:00
                </div>
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
                    {appointmentsAtHour.length > 1 ? (
                      <p className="mt-2 text-xs font-semibold text-violet-500">
                        +{appointmentsAtHour.length - 1} atendimento{appointmentsAtHour.length - 1 === 1 ? "" : "s"} neste horario
                      </p>
                    ) : null}
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

function buildDays(amount: number) {
  const today = new Date();

  return Array.from({ length: amount }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    date.setHours(12, 0, 0, 0);

    return {
      date,
      key: dateKey(date)
    };
  });
}

function dateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric"
  }).format(value);
}

function hourInSaoPaulo(value: string) {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: timezone
    }).format(new Date(value))
  );
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: timezone }).format(value);
}

function formatWeekday(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: timezone }).format(value).replace(".", "");
}

function formatHeaderDay(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: timezone,
    weekday: "long"
  }).format(value);
}
