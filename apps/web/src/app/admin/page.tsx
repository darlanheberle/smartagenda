"use client";

import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LogOut,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCcw,
  Save,
  Settings2,
  ToggleLeft,
  ToggleRight,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductShell } from "../components/product-shell";

type Service = {
  id: string;
  category: string | null;
  name: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
};

type AvailabilityRule = {
  id?: string;
  weekday: number;
  start_time: string;
  end_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
  slot_interval_minutes: number | null;
  buffer_minutes: number;
  minimum_notice_minutes: number;
  active: boolean;
};

type OnboardingStatus = {
  professional?: {
    id: string;
    name: string;
    specialty?: string;
    gmail: string;
    whatsappNumber: string;
  };
  googleConnected: boolean;
  whatsappConnected: boolean;
  servicesConfigured: boolean;
  availabilityConfigured: boolean;
  ready: boolean;
};

type ServiceForm = {
  category: string;
  name: string;
  durationMinutes: string;
  price: string;
  active: boolean;
};

type AccountProfessional = {
  id: string;
  name: string;
  specialty?: string;
  gmail: string;
  whatsappNumber: string;
};

type AvailabilityForm = {
  weekday: number;
  startTime: string;
  endTime: string;
  lunchStart: string;
  lunchEnd: string;
  slotIntervalMinutes: string;
  bufferMinutes: string;
  minimumNoticeMinutes: string;
  active: boolean;
  exists: boolean;
};

type WhatsappConnectionResult = {
  connection?: {
    status?: string;
    data?: {
      base64?: string;
      pairingCode?: string | null;
      qrcode?: {
        base64?: string;
        pairingCode?: string | null;
      };
    };
    error?: unknown;
  };
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";
const weekdays = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terca" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" }
];

export default function AdminPage() {
  return <AdminSettings />;
}

function AdminSettings() {
  const router = useRouter();
  const [professional, setProfessional] = useState<AccountProfessional | undefined>();
  const professionalId = professional?.id || "";
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<AvailabilityForm[]>(() => defaultAvailabilityForms([]));
  const [selectedAvailabilityDay, setSelectedAvailabilityDay] = useState("all");
  const [allAvailability, setAllAvailability] = useState<AvailabilityForm>(() => defaultAllAvailabilityForm());
  const [status, setStatus] = useState<OnboardingStatus | undefined>();
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    category: "",
    name: "",
    durationMinutes: "60",
    price: "0,00",
    active: true
  });
  const [editingServiceId, setEditingServiceId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [savingService, setSavingService] = useState(false);
  const [savingWeekday, setSavingWeekday] = useState<number | undefined>();
  const [connectingWhatsapp, setConnectingWhatsapp] = useState(false);
  const [whatsappConnection, setWhatsappConnection] = useState<WhatsappConnectionResult | undefined>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeServices = useMemo(() => services.filter((service) => service.active), [services]);
  const activeRules = useMemo(() => availability.filter((rule) => rule.active), [availability]);
  const selectedAvailability = useMemo(
    () =>
      selectedAvailabilityDay === "all"
        ? allAvailability
        : availability.find((rule) => String(rule.weekday) === selectedAvailabilityDay) ||
          defaultAvailabilityForms([])[0],
    [allAvailability, availability, selectedAvailabilityDay]
  );

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    try {
      const response = await fetch(`${apiUrl}/auth/me`, {
        cache: "no-store",
        credentials: "include"
      });

      if (response.status === 401) {
        router.replace("/login?next=/admin");
        return;
      }

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const account = (await response.json()) as { professional: AccountProfessional };
      setProfessional(account.professional);
      await loadAdminData(account.professional.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel validar sua sessao.");
      setLoading(false);
    }
  }

  async function loadAdminData(id: string) {
    setLoading(true);
    setError("");

    try {
      const [servicesResponse, availabilityResponse, statusResponse] = await Promise.all([
        fetch(`${apiUrl}/services`, { cache: "no-store", credentials: "include" }),
        fetch(`${apiUrl}/availability-rules`, { cache: "no-store", credentials: "include" }),
        fetch(`${apiUrl}/onboarding/${id}/status`, { cache: "no-store", credentials: "include" })
      ]);

      if ([servicesResponse, availabilityResponse, statusResponse].some((response) => response.status === 401)) {
        router.replace("/login?next=/admin");
        return;
      }

      const loadedServices = servicesResponse.ok ? ((await servicesResponse.json()) as Service[]) : [];
      const loadedAvailability = availabilityResponse.ok
        ? ((await availabilityResponse.json()) as AvailabilityRule[])
        : [];
      const loadedStatus = statusResponse.ok ? ((await statusResponse.json()) as OnboardingStatus) : undefined;

      setServices(loadedServices);
      setAvailability(defaultAvailabilityForms(loadedAvailability));
      setAllAvailability(defaultAllAvailabilityForm());
      setStatus(loadedStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar as configuracoes.");
    } finally {
      setLoading(false);
    }
  }

  async function saveService() {
    setSavingService(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        category: serviceForm.category.trim() || null,
        name: serviceForm.name.trim(),
        durationMinutes: Number.parseInt(serviceForm.durationMinutes, 10),
        priceCents: currencyToCents(serviceForm.price),
        active: serviceForm.active
      };

      if (!payload.name) {
        throw new Error("Informe o nome do servico.");
      }

      if (!Number.isFinite(payload.durationMinutes) || payload.durationMinutes <= 0) {
        throw new Error("Informe uma duracao valida.");
      }

      const response = await fetch(
        editingServiceId
          ? `${apiUrl}/services/${editingServiceId}`
          : `${apiUrl}/services`,
        {
          method: editingServiceId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setServiceForm({ category: "", name: "", durationMinutes: "60", price: "0,00", active: true });
      setEditingServiceId(undefined);
      setMessage(editingServiceId ? "Servico atualizado." : "Servico criado.");
      await loadAdminData(professionalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o servico.");
    } finally {
      setSavingService(false);
    }
  }

  function editService(service: Service) {
    setEditingServiceId(service.id);
    setServiceForm({
      name: service.name,
      category: service.category || "",
      durationMinutes: String(service.duration_minutes),
      price: centsToInput(service.price_cents),
      active: service.active
    });
  }

  async function toggleService(service: Service) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${apiUrl}/services/${service.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !service.active })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setMessage(!service.active ? "Servico ativado." : "Servico inativado.");
      await loadAdminData(professionalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel alterar o servico.");
    }
  }

  async function saveAvailability(rule: AvailabilityForm) {
    setSavingWeekday(rule.weekday);
    setError("");
    setMessage("");

    try {
      const targetRules = rule.weekday === -1 ? availability : [rule];

      for (const targetRule of targetRules) {
        const payload = {
          weekday: targetRule.weekday,
          startTime: rule.startTime,
          endTime: rule.endTime,
          lunchStart: rule.lunchStart || undefined,
          lunchEnd: rule.lunchEnd || undefined,
          slotIntervalMinutes:
            rule.slotIntervalMinutes === "auto"
              ? null
              : Number.parseInt(rule.slotIntervalMinutes, 10),
          bufferMinutes: Number.parseInt(rule.bufferMinutes, 10) || 0,
          minimumNoticeMinutes: Number.parseInt(rule.minimumNoticeMinutes, 10) || 0,
          active: rule.active
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

      setMessage(
        rule.weekday === -1
          ? "Horario aplicado para todos os dias."
          : `Horario de ${weekdayLabel(rule.weekday)} salvo.`
      );
      await loadAdminData(professionalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o horario.");
    } finally {
      setSavingWeekday(undefined);
    }
  }

  function updateAvailability(weekday: number, patch: Partial<AvailabilityForm>) {
    if (weekday === -1) {
      setAllAvailability((current) => ({ ...current, ...patch }));
      return;
    }

    setAvailability((current) =>
      current.map((rule) => (rule.weekday === weekday ? { ...rule, ...patch } : rule))
    );
  }

  async function logout() {
    await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    router.replace("/login");
  }

  async function generateWhatsappQr() {
    if (!professionalId) {
      return;
    }

    setConnectingWhatsapp(true);
    setError("");

    try {
      const response = await fetch(
        `${apiUrl}/onboarding/${professionalId}/whatsapp/connect`,
        { credentials: "include", cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setWhatsappConnection((await response.json()) as WhatsappConnectionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel gerar o QR do WhatsApp.");
    } finally {
      setConnectingWhatsapp(false);
    }
  }

  return (
    <ProductShell
      active="settings"
      email={professional?.gmail || "Carregando conta..."}
      name={professional?.name || "SmartAgenda"}
    >
      <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 md:px-7">
        <header className="flex flex-col gap-4 border-b border-black/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">Preferencias do atendimento</p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--ink)]">Configuracoes da agenda</h1>
              <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                Servicos, precos e horarios usados pela IA durante o agendamento.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={loading}
              onClick={() => void loadAdminData(professionalId)}
              type="button"
            >
              <RefreshCcw size={16} />
              Atualizar
            </button>
            <Link className="btn-primary" href="/">
              <CalendarClock size={16} />
              Voltar ao dia
            </Link>
          </div>
        </header>

        <section className="grid gap-px overflow-hidden rounded-lg bg-black/10 md:grid-cols-4">
          <Metric
            icon={<Settings2 size={18} />}
            label="Profissional"
            value={status?.professional?.name || professionalId}
          />
          <Metric icon={<CheckCircle2 size={18} />} label="Servicos ativos" value={`${activeServices.length}`} />
          <Metric icon={<Clock3 size={18} />} label="Dias ativos" value={`${activeRules.length}`} />
          <Metric
            icon={<BadgeDollarSign size={18} />}
            label="Ticket inicial"
            value={activeServices[0] ? formatCurrency(activeServices[0].price_cents / 100) : "R$ 0,00"}
          />
        </section>

        {message ? (
          <p className="rounded-md bg-[var(--brand-soft)] px-4 py-3 text-sm font-medium text-[var(--brand)]">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-md bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
          <div className="space-y-6">
            <Panel title="Novo servico" subtitle="Nome, duracao, preco e disponibilidade para agendamento.">
              <div className="space-y-4">
                <Field label="Categoria opcional" htmlFor="service-category">
                  <input
                    className="input"
                    id="service-category"
                    onChange={(event) => setServiceForm({ ...serviceForm, category: event.target.value })}
                    placeholder="Ex: Cabelo, Unhas, Consulta"
                    value={serviceForm.category}
                  />
                </Field>
                <Field label="Nome do servico" htmlFor="service-name">
                  <input
                    className="input"
                    id="service-name"
                    onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })}
                    placeholder="Ex: Limpeza odontologica"
                    value={serviceForm.name}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Duracao" htmlFor="service-duration">
                    <input
                      className="input"
                      id="service-duration"
                      inputMode="numeric"
                      onChange={(event) =>
                        setServiceForm({ ...serviceForm, durationMinutes: event.target.value })
                      }
                      value={serviceForm.durationMinutes}
                    />
                  </Field>
                  <Field label="Preco" htmlFor="service-price">
                    <input
                      className="input"
                      id="service-price"
                      inputMode="decimal"
                      onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })}
                      onBlur={() => setServiceForm({ ...serviceForm, price: centsToInput(currencyToCents(serviceForm.price)) })}
                      placeholder="150,00"
                      value={serviceForm.price}
                    />
                  </Field>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => setServiceForm({ ...serviceForm, active: !serviceForm.active })}
                  type="button"
                >
                  {serviceForm.active ? <ToggleRight className="text-emerald-600" size={18} /> : <ToggleLeft size={18} />}
                  {serviceForm.active ? "Servico ativo" : "Servico inativo"}
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    disabled={savingService}
                    onClick={() => void saveService()}
                    type="button"
                  >
                    {editingServiceId ? <Save size={16} /> : <Plus size={16} />}
                    {savingService ? "Salvando..." : editingServiceId ? "Salvar alteracoes" : "Adicionar servico"}
                  </button>
                  {editingServiceId ? (
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setEditingServiceId(undefined);
                        setServiceForm({ category: "", name: "", durationMinutes: "60", price: "0,00", active: true });
                      }}
                      type="button"
                    >
                      Cancelar edicao
                    </button>
                  ) : null}
                </div>
              </div>
            </Panel>

            <Panel title="Status da conta" subtitle="Conexoes que liberam o atendimento automatico.">
              <div className="space-y-3 text-sm">
                <StatusRow label="Google Agenda" done={Boolean(status?.googleConnected)} />
                <StatusRow label="WhatsApp Evolution" done={Boolean(status?.whatsappConnected)} />
                <StatusRow label="Servicos configurados" done={Boolean(status?.servicesConfigured)} />
                <StatusRow label="Horarios configurados" done={Boolean(status?.availabilityConfigured)} />
              </div>
              <button
                className="btn-secondary mt-4 w-full"
                disabled={connectingWhatsapp}
                onClick={() => void generateWhatsappQr()}
                type="button"
              >
                {connectingWhatsapp ? <MessageCircle size={16} /> : <QrCode size={16} />}
                {connectingWhatsapp ? "Gerando QR..." : "Gerar QR do WhatsApp"}
              </button>
              {whatsappConnection ? <WhatsappQr result={whatsappConnection} /> : null}
            </Panel>
          </div>

          <Panel title="Servicos cadastrados" subtitle="A IA oferece essas opcoes durante a conversa no WhatsApp.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-medium">Categoria</th>
                    <th className="px-3 py-3 font-medium">Servico</th>
                    <th className="px-3 py-3 font-medium">Duracao</th>
                    <th className="px-3 py-3 font-medium">Preco</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                        Carregando servicos...
                      </td>
                    </tr>
                  ) : services.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                        Nenhum servico cadastrado ainda.
                      </td>
                    </tr>
                  ) : (
                    services.map((service) => (
                      <tr key={service.id}>
                        <td className="px-3 py-3 text-slate-600">{service.category || "Sem categoria"}</td>
                        <td className="px-3 py-3 font-medium text-slate-900">{service.name}</td>
                        <td className="px-3 py-3 text-slate-600">{service.duration_minutes} min</td>
                        <td className="px-3 py-3 text-slate-600">
                          {formatCurrency(service.price_cents / 100)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              service.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {service.active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="inline-flex min-h-9 items-center rounded-md bg-[var(--surface-inset)] px-3 text-xs font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                              onClick={() => editService(service)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button
                              className="inline-flex min-h-9 items-center gap-1 rounded-md bg-[var(--surface-inset)] px-3 text-xs font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                              onClick={() => void toggleService(service)}
                              type="button"
                            >
                              <Trash2 size={13} />
                              {service.active ? "Inativar" : "Ativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>

        <Panel title="Horarios de atendimento" subtitle="Escolha um dia, ajuste a regra e salve. Use Todos para repetir a configuracao.">
          <div className="rounded-md bg-[var(--surface-subtle)] p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_auto] md:items-end md:justify-between">
              <Field label="Dia da semana" htmlFor="availability-day">
                <select
                  className="input"
                  id="availability-day"
                  onChange={(event) => setSelectedAvailabilityDay(event.target.value)}
                  value={selectedAvailabilityDay}
                >
                  <option value="all">Todos os dias</option>
                  {weekdays.map((weekday) => (
                    <option key={weekday.value} value={weekday.value}>
                      {weekday.label}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="btn-secondary justify-center"
                onClick={() =>
                  updateAvailability(selectedAvailability.weekday, {
                    active: !selectedAvailability.active
                  })
                }
                type="button"
              >
                {selectedAvailability.active ? (
                  <ToggleRight className="text-emerald-600" size={18} />
                ) : (
                  <ToggleLeft size={18} />
                )}
                {selectedAvailability.active ? "Dia ativo" : "Dia inativo"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CompactField label="Inicio">
                <input
                  className="input"
                  onChange={(event) =>
                    updateAvailability(selectedAvailability.weekday, { startTime: event.target.value })
                  }
                  type="time"
                  value={selectedAvailability.startTime}
                />
              </CompactField>
              <CompactField label="Fim">
                <input
                  className="input"
                  onChange={(event) =>
                    updateAvailability(selectedAvailability.weekday, { endTime: event.target.value })
                  }
                  type="time"
                  value={selectedAvailability.endTime}
                />
              </CompactField>
              <CompactField label="Almoco inicio">
                <input
                  className="input"
                  onChange={(event) =>
                    updateAvailability(selectedAvailability.weekday, { lunchStart: event.target.value })
                  }
                  type="time"
                  value={selectedAvailability.lunchStart}
                />
              </CompactField>
              <CompactField label="Almoco fim">
                <input
                  className="input"
                  onChange={(event) =>
                    updateAvailability(selectedAvailability.weekday, { lunchEnd: event.target.value })
                  }
                  type="time"
                  value={selectedAvailability.lunchEnd}
                />
              </CompactField>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <CompactField label="Inicios a cada">
                <select
                  className="input"
                  onChange={(event) =>
                    updateAvailability(selectedAvailability.weekday, {
                      slotIntervalMinutes: event.target.value
                    })
                  }
                  value={selectedAvailability.slotIntervalMinutes}
                >
                  <option value="auto">Automatico</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                </select>
              </CompactField>
              <CompactField label="Pausa apos atendimento">
                <input
                  className="input"
                  inputMode="numeric"
                  onChange={(event) =>
                    updateAvailability(selectedAvailability.weekday, { bufferMinutes: event.target.value })
                  }
                  value={selectedAvailability.bufferMinutes}
                />
              </CompactField>
              <CompactField label="Antecedencia minima">
                <input
                  className="input"
                  inputMode="numeric"
                  onChange={(event) =>
                    updateAvailability(selectedAvailability.weekday, {
                      minimumNoticeMinutes: event.target.value
                    })
                  }
                  value={selectedAvailability.minimumNoticeMinutes}
                />
              </CompactField>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[var(--ink-muted)]">
                Automatico usa a duracao do servico escolhido no WhatsApp mais a pausa apos o atendimento.
              </p>
              <button
                className="btn-primary justify-center"
                disabled={savingWeekday === selectedAvailability.weekday}
                onClick={() => void saveAvailability(selectedAvailability)}
                type="button"
              >
                <Save size={15} />
                {savingWeekday === selectedAvailability.weekday ? "Salvando..." : "Salvar horario"}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </ProductShell>
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
      slotIntervalMinutes: rule?.slot_interval_minutes
        ? String(rule.slot_interval_minutes)
        : "auto",
      bufferMinutes: String(rule?.buffer_minutes ?? 0),
      minimumNoticeMinutes: String(rule?.minimum_notice_minutes ?? 120),
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
    slotIntervalMinutes: "auto",
    bufferMinutes: "0",
    minimumNoticeMinutes: "120",
    active: true,
    exists: false
  };
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <div className="mb-4 flex size-8 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand)]">
        {icon}
      </div>
      <p className="truncate text-xl font-semibold tabular text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{label}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={htmlFor}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CompactField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium uppercase text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-[var(--surface-subtle)] px-3 py-2.5">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          done
            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
            : "bg-[var(--warning-soft)] text-[var(--warning)]"
        }`}
      >
        {done ? "Pronto" : "Pendente"}
      </span>
    </div>
  );
}

function WhatsappQr({ result }: { result: WhatsappConnectionResult }) {
  const data = result.connection?.data;
  const qrBase64 = data?.base64 || data?.qrcode?.base64;
  const pairingCode = data?.pairingCode || data?.qrcode?.pairingCode;

  if (!qrBase64 && !pairingCode) {
    return (
      <p className="mt-3 rounded-md bg-[var(--warning-soft)] px-3 py-3 text-xs leading-5 text-[var(--warning)]">
        A Evolution ainda nao devolveu um QR. Aguarde alguns segundos e tente novamente.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-md bg-[var(--surface-subtle)] p-3 text-center">
      {qrBase64 ? (
        <img
          alt="QR Code para conectar o WhatsApp"
          className="mx-auto size-52 max-w-full rounded-md bg-white p-2 shadow-sm"
          src={qrBase64}
        />
      ) : null}
      {pairingCode ? (
        <div className="mt-3">
          <p className="eyebrow">Codigo de pareamento</p>
          <p className="mt-1 text-xl font-semibold tabular text-[var(--ink)]">{pairingCode}</p>
        </div>
      ) : null}
      <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-[var(--ink-muted)]">
        No WhatsApp, abra Aparelhos conectados e leia este codigo.
      </p>
    </div>
  );
}

function weekdayLabel(value: number) {
  return weekdays.find((weekday) => weekday.value === value)?.label || String(value);
}

function trimTime(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

function currencyToCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function centsToInput(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}
