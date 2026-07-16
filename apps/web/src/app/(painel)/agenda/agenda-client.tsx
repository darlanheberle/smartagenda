"use client";

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Save,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { Card, Pill, SectionTitle } from "../components/ui";
import { formatCurrency, formatTime } from "../lib/format";
import type { Appointment, Service } from "../lib/types";

const hours = Array.from({ length: 10 }, (_, index) => 8 + index);
const timezone = "America/Sao_Paulo";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

type AgendaEditor = {
  mode: "create" | "edit";
  appointmentId?: string;
  hour: number;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  startsAt: string;
  durationMinutes: number;
  priceCents: number;
};

export function AgendaClient({
  appointments,
  services
}: {
  appointments: Appointment[];
  services: Service[];
}) {
  const days = useMemo(() => buildDays(21), []);
  const todayKey = dateKey(new Date());
  const [appointmentsState, setAppointmentsState] = useState(appointments);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [editor, setEditor] = useState<AgendaEditor | undefined>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeServices = useMemo(
    () => services.filter((service) => service.active),
    [services]
  );
  const serviceOptions = activeServices.length > 0 ? activeServices : services;
  const selectedDay = days.find((day) => day.key === selectedDayKey) || days[0];
  const selectedAppointments = appointmentsState.filter(
    (appointment) => dateKey(new Date(appointment.starts_at)) === selectedDay.key
  );

  function moveDay(offset: number) {
    const currentIndex = days.findIndex((day) => day.key === selectedDay.key);
    const nextDay = days[Math.min(Math.max(currentIndex + offset, 0), days.length - 1)];
    setSelectedDayKey(nextDay.key);
  }

  function openCreate(hour: number) {
    const service = serviceOptions[0];
    setMessage("");
    setError("");
    setEditor({
      mode: "create",
      hour,
      clientName: "",
      clientPhone: "",
      serviceId: service?.id || "",
      serviceName: service?.name || "",
      startsAt: buildSlotIso(selectedDay.date, hour),
      durationMinutes: service?.duration_minutes || 60,
      priceCents: service?.price_cents || 0
    });
  }

  function openEdit(appointment: Appointment) {
    const service = serviceOptions.find((item) => item.name === appointment.service_name);
    setMessage("");
    setError("");
    setEditor({
      mode: "edit",
      appointmentId: appointment.id,
      hour: hourInSaoPaulo(appointment.starts_at),
      clientName: appointment.client_name || "",
      clientPhone: appointment.client_phone || "",
      serviceId: service?.id || "",
      serviceName: appointment.service_name,
      startsAt: appointment.starts_at,
      durationMinutes: service?.duration_minutes || minutesBetween(appointment.starts_at, appointment.ends_at),
      priceCents: appointment.value_cents || service?.price_cents || 0
    });
  }

  function selectService(serviceId: string) {
    const service = serviceOptions.find((item) => item.id === serviceId);

    setEditor((current) =>
      current
        ? {
            ...current,
            serviceId,
            serviceName: service?.name || current.serviceName,
            durationMinutes: service?.duration_minutes || current.durationMinutes,
            priceCents: service?.price_cents ?? current.priceCents
          }
        : current
    );
  }

  async function reloadAppointments() {
    const response = await fetch(`${apiUrl}/appointments?limit=200`, {
      cache: "no-store",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    setAppointmentsState((await response.json()) as Appointment[]);
  }

  async function saveAppointment() {
    if (!editor) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!editor.clientName.trim()) {
        throw new Error("Informe o nome do cliente.");
      }

      if (!editor.serviceId && !editor.serviceName.trim()) {
        throw new Error("Informe o servico.");
      }

      const payload = {
        clientName: editor.clientName.trim(),
        clientPhone: editor.clientPhone.trim() || undefined,
        serviceId: editor.serviceId || undefined,
        serviceName: editor.serviceName.trim() || undefined,
        startsAt: editor.startsAt,
        durationMinutes: editor.durationMinutes,
        valueCents: editor.priceCents
      };
      const response = await fetch(
        editor.mode === "edit" && editor.appointmentId
          ? `${apiUrl}/appointments/${editor.appointmentId}`
          : `${apiUrl}/appointments/manual`,
        {
          method: editor.mode === "edit" ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await reloadAppointments();
      setEditor(undefined);
      setMessage(editor.mode === "edit" ? "Atendimento atualizado." : "Atendimento criado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o atendimento.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment(appointment: Appointment) {
    const confirmed = window.confirm("Apagar este atendimento da agenda?");
    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(`${apiUrl}/appointments/${appointment.id}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setAppointmentsState((current) => current.filter((item) => item.id !== appointment.id));
      setEditor(undefined);
      setMessage("Atendimento apagado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel apagar o atendimento.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-700">{formatMonth(selectedDay.date)}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">
            {selectedDay.key === todayKey ? "Hoje" : formatHeaderDay(selectedDay.date)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Toque em um horario livre para criar atendimento manual.</p>
        </div>
        <button
          aria-label="Novo agendamento"
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          onClick={() => openCreate(suggestedHour(selectedDay.key === todayKey))}
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
              const hasAppointments = appointmentsState.some(
                (appointment) => dateKey(new Date(appointment.starts_at)) === day.key
              );

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

      {message ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
      ) : null}

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
                      <Pill tone="violet">
                        {formatTime(appointment.starts_at)}
                        {appointment.ends_at ? ` - ${formatTime(appointment.ends_at)}` : ""}
                      </Pill>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold tabular text-violet-700">
                        {formatCurrency(appointment.value_cents / 100)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-3 text-sm font-semibold text-violet-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                          onClick={() => openEdit(appointment)}
                          type="button"
                        >
                          <Edit3 size={16} />
                          Editar
                        </button>
                        <button
                          className="grid size-11 place-items-center rounded-2xl bg-white text-rose-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                          onClick={() => deleteAppointment(appointment)}
                          type="button"
                          aria-label="Apagar atendimento"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {appointmentsAtHour.length > 1 ? (
                      <p className="mt-2 text-xs font-semibold text-violet-500">
                        +{appointmentsAtHour.length - 1} atendimento{appointmentsAtHour.length - 1 === 1 ? "" : "s"} neste horario
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <button
                    className="flex min-h-[76px] items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-400 transition hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    onClick={() => openCreate(hour)}
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

      {editor ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-3 backdrop-blur-sm md:items-center md:justify-center">
          <section
            aria-modal="true"
            className="w-full rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl md:max-w-md"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
                  {String(editor.hour).padStart(2, "0")}:00
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-slate-950">
                  {editor.mode === "edit" ? "Editar atendimento" : "Novo atendimento"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{formatHeaderDay(selectedDay.date)}</p>
              </div>
              <button
                aria-label="Fechar"
                className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                onClick={() => setEditor(undefined)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Nome do cliente</span>
                <input
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  onChange={(event) => setEditor({ ...editor, clientName: event.target.value })}
                  placeholder="Ex: Maria Souza"
                  value={editor.clientName}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Telefone opcional</span>
                <input
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  onChange={(event) => setEditor({ ...editor, clientPhone: event.target.value })}
                  placeholder="Ex: 5548999999999"
                  value={editor.clientPhone}
                />
              </label>

              {serviceOptions.length > 0 ? (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Servico</span>
                  <select
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                    onChange={(event) => selectService(event.target.value)}
                    value={editor.serviceId}
                  >
                    <option value="">Escolher servico</option>
                    {serviceOptions.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.category ? `${service.category} - ` : ""}
                        {service.name} - {service.duration_minutes} min
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Servico</span>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                    onChange={(event) => setEditor({ ...editor, serviceName: event.target.value })}
                    placeholder="Ex: Consulta"
                    value={editor.serviceName}
                  />
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">Duracao</p>
                  <p className="mt-1 font-display text-xl font-bold text-slate-950">{editor.durationMinutes} min</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">Valor</p>
                  <p className="mt-1 font-display text-xl font-bold text-slate-950">
                    {formatCurrency(editor.priceCents / 100)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-200 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                disabled={saving}
                onClick={saveAppointment}
                type="button"
              >
                <Save size={17} />
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                className="min-h-12 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                onClick={() => setEditor(undefined)}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      ) : null}
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

function buildSlotIso(day: Date, hour: number) {
  const slot = new Date(day);
  slot.setHours(hour, 0, 0, 0);
  return slot.toISOString();
}

function suggestedHour(isToday: boolean) {
  if (!isToday) {
    return hours[0];
  }

  const currentHour = new Date().getHours() + 1;
  return Math.min(Math.max(currentHour, hours[0]), hours[hours.length - 1]);
}

function minutesBetween(startsAt: string, endsAt?: string) {
  if (!endsAt) {
    return 60;
  }

  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
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
