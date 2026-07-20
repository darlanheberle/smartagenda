"use client";

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { Card, Pill, SectionTitle } from "../components/ui";
import { formatCurrency, formatTime } from "../lib/format";
import type { Appointment, AvailabilityRule, Service } from "../lib/types";

const workdayStartHour = 8;
const workdayEndHour = 18;
const timezone = "America/Sao_Paulo";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

type AgendaSlot = {
  key: string;
  label: string;
  startsAt: string;
  startTime: number;
  endTime: number;
  hour: number;
  minute: number;
};

type AgendaEditor = {
  mode: "create" | "edit";
  appointmentId?: string;
  hour: number;
  minute: number;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  startsAt: string;
  durationMinutes: number;
  priceCents: number;
};

type AvailabilityForm = {
  weekday: number;
  startTime: string;
  endTime: string;
  lunchStart: string;
  lunchEnd: string;
  active: boolean;
  exists: boolean;
};

const weekdays = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terca" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" }
];

export function AgendaClient({
  appointments,
  availabilityRules,
  services
}: {
  appointments: Appointment[];
  availabilityRules: AvailabilityRule[];
  services: Service[];
}) {
  const days = useMemo(() => buildDays(21), []);
  const todayKey = dateKey(new Date());
  const [appointmentsState, setAppointmentsState] = useState(appointments);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [selectedServiceId, setSelectedServiceId] = useState(
    services.find((service) => service.active)?.id || services[0]?.id || ""
  );
  const [editor, setEditor] = useState<AgendaEditor | undefined>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeServices = useMemo(
    () => services.filter((service) => service.active),
    [services]
  );
  const serviceOptions = activeServices.length > 0 ? activeServices : services;
  const selectedService = serviceOptions.find((service) => service.id === selectedServiceId) || serviceOptions[0];
  const slotDurationMinutes = selectedService?.duration_minutes || 60;
  const selectedDay = days.find((day) => day.key === selectedDayKey) || days[0];
  const selectedAvailabilityRule = getAvailabilityRuleForDate(availabilityRules, selectedDay.date);
  const slots = useMemo(
    () => buildSlots(selectedDay.date, slotDurationMinutes, selectedAvailabilityRule),
    [selectedAvailabilityRule, selectedDay.date, slotDurationMinutes]
  );
  const selectedAppointments = appointmentsState.filter(
    (appointment) => dateKey(new Date(appointment.starts_at)) === selectedDay.key
  );

  function moveDay(offset: number) {
    const currentIndex = days.findIndex((day) => day.key === selectedDay.key);
    const nextDay = days[Math.min(Math.max(currentIndex + offset, 0), days.length - 1)];
    setSelectedDayKey(nextDay.key);
  }

  function openCreate(slot: AgendaSlot) {
    const service = selectedService || serviceOptions[0];
    setMessage("");
    setError("");
    setEditor({
      mode: "create",
      hour: slot.hour,
      minute: slot.minute,
      clientName: "",
      clientPhone: "",
      serviceId: service?.id || "",
      serviceName: service?.name || "",
      startsAt: slot.startsAt,
      durationMinutes: service?.duration_minutes || 60,
      priceCents: service?.price_cents || 0
    });
  }

  function openEdit(appointment: Appointment) {
    const service = serviceOptions.find((item) => item.name === appointment.service_name);
    const startTime = timePartsInSaoPaulo(appointment.starts_at);
    setMessage("");
    setError("");
    setEditor({
      mode: "edit",
      appointmentId: appointment.id,
      hour: startTime.hour,
      minute: startTime.minute,
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
          <p className="mt-1 text-sm text-slate-500">Escolha o servico para a agenda abrir os encaixes na duracao certa.</p>
        </div>
        <button
          aria-label="Novo agendamento"
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          disabled={slots.length === 0}
          onClick={() => {
            const slot = suggestedSlot(slots, selectedDay.key === todayKey);
            if (slot) {
              openCreate(slot);
            }
          }}
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
          subtitle={`${slotDurationMinutes} min por encaixe${selectedService ? ` para ${selectedService.name}` : ""}`}
          title={selectedDay.key === todayKey ? "Agenda de hoje" : formatHeaderDay(selectedDay.date)}
        />
        {serviceOptions.length > 0 ? (
          <label className="mt-5 block">
            <span className="text-sm font-semibold text-slate-700">Servico para calcular horarios livres</span>
            <select
              className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              onChange={(event) => setSelectedServiceId(event.target.value)}
              value={selectedService?.id || ""}
            >
              {serviceOptions.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.category ? `${service.category} - ` : ""}
                  {service.name} - {service.duration_minutes} min
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="mt-5 space-y-3">
          {slots.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Este dia esta fechado ou sem horario de atendimento cadastrado para a duracao escolhida.
            </div>
          ) : null}
          {slots.map((slot) => {
            const overlappingAppointments = selectedAppointments.filter((appointment) =>
              appointmentOverlapsSlot(appointment, slot)
            );
            const appointmentStartingInSlot = overlappingAppointments.find((appointment) =>
              appointmentStartsInSlot(appointment, slot)
            );
            const appointment = appointmentStartingInSlot || overlappingAppointments[0];
            const blockedByPrevious = appointment && !appointmentStartingInSlot;

            return (
              <div className="grid grid-cols-[56px_1fr] gap-3" key={slot.key}>
                <div className="pt-4 text-right text-sm font-bold tabular text-slate-500">
                  {slot.label}
                </div>
                {appointment && !blockedByPrevious ? (
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
                    {overlappingAppointments.length > 1 ? (
                      <p className="mt-2 text-xs font-semibold text-violet-500">
                        +{overlappingAppointments.length - 1} atendimento{overlappingAppointments.length - 1 === 1 ? "" : "s"} neste horario
                      </p>
                    ) : null}
                  </div>
                ) : appointment && blockedByPrevious ? (
                  <div className="flex min-h-[64px] items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-slate-100 px-4 text-sm text-slate-500">
                    <span className="font-semibold">Ocupado por {appointment.service_name}</span>
                    <Pill tone="slate">
                      ate {appointment.ends_at ? formatTime(appointment.ends_at) : "--:--"}
                    </Pill>
                  </div>
                ) : (
                  <button
                    className="flex min-h-[76px] items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-400 transition hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    onClick={() => openCreate(slot)}
                    type="button"
                  >
                    <CalendarPlus size={17} />
                    Livre - {slotDurationMinutes} min
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <AvailabilitySettings initialRules={availabilityRules} />

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
                  {formatSlotLabel(editor.hour, editor.minute)}
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

function AvailabilitySettings({ initialRules }: { initialRules: AvailabilityRule[] }) {
  const [rules, setRules] = useState(() => defaultAvailabilityForms(initialRules));
  const [selectedDay, setSelectedDay] = useState("all");
  const [allRule, setAllRule] = useState<AvailabilityForm>(() => defaultAllAvailabilityForm());
  const [savingWeekday, setSavingWeekday] = useState<number | undefined>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedRule =
    selectedDay === "all"
      ? allRule
      : rules.find((rule) => String(rule.weekday) === selectedDay) || rules[0];

  function updateRule(weekday: number, patch: Partial<AvailabilityForm>) {
    setMessage("");
    setError("");

    if (weekday === -1) {
      setAllRule((current) => ({ ...current, ...patch }));
      return;
    }

    setRules((current) =>
      current.map((rule) => (rule.weekday === weekday ? { ...rule, ...patch } : rule))
    );
  }

  async function reloadRules() {
    const response = await fetch(`${apiUrl}/availability-rules`, {
      cache: "no-store",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    setRules(defaultAvailabilityForms((await response.json()) as AvailabilityRule[]));
  }

  async function saveRule(rule: AvailabilityForm) {
    setSavingWeekday(rule.weekday);
    setMessage("");
    setError("");

    try {
      const rulesToSave =
        rule.weekday === -1
          ? weekdays.map((weekday) => ({
              ...rule,
              weekday: weekday.value,
              exists: rules.find((item) => item.weekday === weekday.value)?.exists || false
            }))
          : [rule];

      for (const targetRule of rulesToSave) {
        const payload = {
          weekday: targetRule.weekday,
          startTime: targetRule.startTime,
          endTime: targetRule.endTime,
          lunchStart: targetRule.lunchStart || null,
          lunchEnd: targetRule.lunchEnd || null,
          slotIntervalMinutes: null,
          bufferMinutes: 0,
          minimumNoticeMinutes: 120,
          active: targetRule.active
        };

        const response = await fetch(
          targetRule.exists
            ? `${apiUrl}/availability-rules/${targetRule.weekday}`
            : `${apiUrl}/availability-rules`,
          {
            method: targetRule.exists ? "PATCH" : "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload)
          }
        );

        if (!response.ok) {
          throw new Error(await response.text());
        }
      }

      await reloadRules();
      setMessage(rule.weekday === -1 ? "Horarios aplicados para todos os dias." : "Horario salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar os horarios.");
    } finally {
      setSavingWeekday(undefined);
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle
        subtitle="Escolha um dia, ajuste a regra e salve. Use todos para repetir a configuracao."
        title="Horarios de atendimento"
      />

      <div className="mt-5 rounded-3xl bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_auto] md:items-end md:justify-between">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Dia da semana</span>
            <select
              className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-white px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              onChange={(event) => setSelectedDay(event.target.value)}
              value={selectedDay}
            >
              <option value="all">Todos os dias</option>
              {weekdays.map((weekday) => (
                <option key={weekday.value} value={weekday.value}>
                  {weekday.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            onClick={() => updateRule(selectedRule.weekday, { active: !selectedRule.active })}
            type="button"
          >
            {selectedRule.active ? (
              <ToggleRight className="text-emerald-600" size={19} />
            ) : (
              <ToggleLeft className="text-slate-400" size={19} />
            )}
            {selectedRule.active ? "Dia ativo" : "Dia inativo"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TimeField
            label="Inicio"
            onChange={(value) => updateRule(selectedRule.weekday, { startTime: value })}
            value={selectedRule.startTime}
          />
          <TimeField
            label="Fim"
            onChange={(value) => updateRule(selectedRule.weekday, { endTime: value })}
            value={selectedRule.endTime}
          />
          <TimeField
            label="Almoco inicio"
            onChange={(value) => updateRule(selectedRule.weekday, { lunchStart: value })}
            value={selectedRule.lunchStart}
          />
          <TimeField
            label="Almoco fim"
            onChange={(value) => updateRule(selectedRule.weekday, { lunchEnd: value })}
            value={selectedRule.lunchEnd}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            O periodo de almoco nao aparece na agenda nem nas opcoes enviadas pelo WhatsApp.
          </p>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-200 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            disabled={savingWeekday === selectedRule.weekday}
            onClick={() => void saveRule(selectedRule)}
            type="button"
          >
            <Save size={17} />
            {savingWeekday === selectedRule.weekday ? "Salvando..." : "Salvar horario"}
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}
      </div>
    </Card>
  );
}

function TimeField({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      <input
        className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-white px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
        onChange={(event) => onChange(event.target.value)}
        type="time"
        value={value}
      />
    </label>
  );
}

function defaultAvailabilityForms(rules: AvailabilityRule[]): AvailabilityForm[] {
  return weekdays.map((weekday) => {
    const rule = rules.find((item) => item.weekday === weekday.value);

    return {
      weekday: weekday.value,
      startTime: trimTime(rule?.start_time) || "09:00",
      endTime: trimTime(rule?.end_time) || "18:00",
      lunchStart: trimTime(rule?.lunch_start) || "12:00",
      lunchEnd: trimTime(rule?.lunch_end) || "13:00",
      active: rule?.active ?? (weekday.value >= 1 && weekday.value <= 5),
      exists: Boolean(rule)
    };
  });
}

function defaultAllAvailabilityForm(): AvailabilityForm {
  return {
    weekday: -1,
    startTime: "09:00",
    endTime: "18:00",
    lunchStart: "12:00",
    lunchEnd: "13:00",
    active: true,
    exists: false
  };
}

function trimTime(value?: string | null) {
  return value ? value.slice(0, 5) : "";
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

function timePartsInSaoPaulo(value: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone
  }).formatToParts(new Date(value));

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value || 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value || 0)
  };
}

function buildSlots(day: Date, durationMinutes: number, rule?: AvailabilityRule | null): AgendaSlot[] {
  const normalizedDuration = Math.max(15, durationMinutes || 60);
  if (rule === null) {
    return [];
  }

  const firstMinute = rule ? timeToMinutes(rule.start_time) : workdayStartHour * 60;
  const lastMinute = rule ? timeToMinutes(rule.end_time) : workdayEndHour * 60;
  const lunchStart = rule?.lunch_start ? timeToMinutes(rule.lunch_start) : undefined;
  const lunchEnd = rule?.lunch_end ? timeToMinutes(rule.lunch_end) : undefined;
  const stepMinutes =
    rule?.slot_interval_minutes && rule.slot_interval_minutes > 0
      ? rule.slot_interval_minutes
      : normalizedDuration + (rule?.buffer_minutes || 0);
  const slots: AgendaSlot[] = [];

  if (lastMinute <= firstMinute) {
    return slots;
  }

  for (let minuteOfDay = firstMinute; minuteOfDay + normalizedDuration <= lastMinute; minuteOfDay += stepMinutes) {
    const appointmentEndMinute = minuteOfDay + normalizedDuration;

    if (
      lunchStart !== undefined &&
      lunchEnd !== undefined &&
      minuteOfDay < lunchEnd &&
      appointmentEndMinute > lunchStart
    ) {
      minuteOfDay = lunchEnd - stepMinutes;
      continue;
    }

    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const start = new Date(day);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + normalizedDuration * 60 * 1000);
    const label = formatSlotLabel(hour, minute);

    slots.push({
      key: `${dateKey(day)}-${label}`,
      label,
      startsAt: start.toISOString(),
      startTime: start.getTime(),
      endTime: end.getTime(),
      hour,
      minute
    });
  }

  return slots;
}

function getAvailabilityRuleForDate(rules: AvailabilityRule[], date: Date) {
  const weekday = weekdayForDate(date);

  if (rules.length === 0) {
    if (weekday === 0 || weekday === 6) {
      return null;
    }

    return {
      weekday,
      start_time: `${String(workdayStartHour).padStart(2, "0")}:00`,
      end_time: `${String(workdayEndHour).padStart(2, "0")}:00`,
      lunch_start: null,
      lunch_end: null,
      slot_interval_minutes: null,
      buffer_minutes: 0,
      minimum_notice_minutes: 120,
      active: true
    } as AvailabilityRule;
  }

  return rules.find((rule) => rule.weekday === weekday && rule.active) || null;
}

function weekdayForDate(date: Date) {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short"
  }).format(date);
  const weekdaysByName: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return weekdaysByName[value] ?? date.getDay();
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + (minute || 0);
}

function suggestedSlot(slots: AgendaSlot[], isToday: boolean) {
  if (slots.length === 0) {
    return undefined;
  }

  if (!isToday) {
    return slots[0];
  }

  const now = new Date();
  return slots.find((slot) => slot.startTime > now.getTime()) || slots[slots.length - 1];
}

function appointmentStartsInSlot(appointment: Appointment, slot: AgendaSlot) {
  const startsAt = new Date(appointment.starts_at).getTime();
  return startsAt >= slot.startTime && startsAt < slot.endTime;
}

function appointmentOverlapsSlot(appointment: Appointment, slot: AgendaSlot) {
  const startsAt = new Date(appointment.starts_at).getTime();
  const endsAt = appointment.ends_at
    ? new Date(appointment.ends_at).getTime()
    : startsAt + 60 * 60 * 1000;

  return startsAt < slot.endTime && endsAt > slot.startTime;
}

function formatSlotLabel(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
