"use client";

import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LogOut,
  Plus,
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

type Service = {
  id: string;
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
  bufferMinutes: string;
  minimumNoticeMinutes: string;
  active: boolean;
  exists: boolean;
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
  const [status, setStatus] = useState<OnboardingStatus | undefined>();
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    name: "",
    durationMinutes: "60",
    price: "0,00",
    active: true
  });
  const [editingServiceId, setEditingServiceId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [savingService, setSavingService] = useState(false);
  const [savingWeekday, setSavingWeekday] = useState<number | undefined>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeServices = useMemo(() => services.filter((service) => service.active), [services]);
  const activeRules = useMemo(() => availability.filter((rule) => rule.active), [availability]);

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

      setServiceForm({ name: "", durationMinutes: "60", price: "0,00", active: true });
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
      const payload = {
        weekday: rule.weekday,
        startTime: rule.startTime,
        endTime: rule.endTime,
        lunchStart: rule.lunchStart || undefined,
        lunchEnd: rule.lunchEnd || undefined,
        bufferMinutes: Number.parseInt(rule.bufferMinutes, 10) || 0,
        minimumNoticeMinutes: Number.parseInt(rule.minimumNoticeMinutes, 10) || 0,
        active: rule.active
      };
      const response = await fetch(
        rule.exists
          ? `${apiUrl}/availability-rules/${rule.weekday}`
          : `${apiUrl}/availability-rules`,
        {
          method: rule.exists ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setMessage(`Horario de ${weekdayLabel(rule.weekday)} salvo.`);
      await loadAdminData(professionalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o horario.");
    } finally {
      setSavingWeekday(undefined);
    }
  }

  function updateAvailability(weekday: number, patch: Partial<AvailabilityForm>) {
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-ink md:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Link
                className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-700"
                href="/"
              >
                <ArrowLeft size={16} />
                Voltar ao dashboard
              </Link>
              <h1 className="text-2xl font-semibold tracking-normal">Painel administrativo</h1>
              <p className="mt-1 text-sm text-slate-500">
                {professional
                  ? `${professional.name} - ${professional.gmail}`
                  : "Carregando dados da conta..."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={loading}
                onClick={() => void loadAdminData(professionalId)}
                type="button"
              >
                <RefreshCcw size={16} />
                Atualizar
              </button>
              <Link
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
                href="/"
              >
                <CalendarClock size={16} />
                Abrir dashboard
              </Link>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => void logout()}
                type="button"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
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
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
          <div className="space-y-6">
            <Panel title="Cadastro de servico" subtitle="Nome, duracao, preco e disponibilidade para agendamento.">
              <div className="space-y-4">
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
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setServiceForm({ ...serviceForm, active: !serviceForm.active })}
                  type="button"
                >
                  {serviceForm.active ? <ToggleRight className="text-emerald-600" size={18} /> : <ToggleLeft size={18} />}
                  {serviceForm.active ? "Servico ativo" : "Servico inativo"}
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={savingService}
                    onClick={() => void saveService()}
                    type="button"
                  >
                    {editingServiceId ? <Save size={16} /> : <Plus size={16} />}
                    {savingService ? "Salvando..." : editingServiceId ? "Salvar alteracoes" : "Adicionar servico"}
                  </button>
                  {editingServiceId ? (
                    <button
                      className="rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setEditingServiceId(undefined);
                        setServiceForm({ name: "", durationMinutes: "60", price: "0,00", active: true });
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
            </Panel>
          </div>

          <Panel title="Servicos cadastrados" subtitle="A IA oferece esses servicos no fluxo pelo WhatsApp.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
                  <tr>
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
                      <td className="px-3 py-8 text-center text-slate-500" colSpan={5}>
                        Carregando servicos...
                      </td>
                    </tr>
                  ) : services.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-slate-500" colSpan={5}>
                        Nenhum servico cadastrado ainda.
                      </td>
                    </tr>
                  ) : (
                    services.map((service) => (
                      <tr key={service.id}>
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
                              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => editService(service)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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

        <Panel title="Horarios de atendimento" subtitle="Defina quando a IA pode oferecer agenda para clientes.">
          <div className="grid gap-3">
            {availability.map((rule) => (
              <div
                className="grid gap-3 rounded-md border border-slate-200 px-3 py-3 lg:grid-cols-[120px_repeat(6,minmax(0,1fr))_110px]"
                key={rule.weekday}
              >
                <div className="flex items-center justify-between gap-3 lg:block">
                  <p className="font-medium">{weekdayLabel(rule.weekday)}</p>
                  <button
                    className="mt-0 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 lg:mt-2"
                    onClick={() => updateAvailability(rule.weekday, { active: !rule.active })}
                    type="button"
                  >
                    {rule.active ? <ToggleRight className="text-emerald-600" size={16} /> : <ToggleLeft size={16} />}
                    {rule.active ? "Ativo" : "Inativo"}
                  </button>
                </div>
                <CompactField label="Inicio">
                  <input
                    className="input"
                    onChange={(event) => updateAvailability(rule.weekday, { startTime: event.target.value })}
                    type="time"
                    value={rule.startTime}
                  />
                </CompactField>
                <CompactField label="Fim">
                  <input
                    className="input"
                    onChange={(event) => updateAvailability(rule.weekday, { endTime: event.target.value })}
                    type="time"
                    value={rule.endTime}
                  />
                </CompactField>
                <CompactField label="Almoco inicio">
                  <input
                    className="input"
                    onChange={(event) => updateAvailability(rule.weekday, { lunchStart: event.target.value })}
                    type="time"
                    value={rule.lunchStart}
                  />
                </CompactField>
                <CompactField label="Almoco fim">
                  <input
                    className="input"
                    onChange={(event) => updateAvailability(rule.weekday, { lunchEnd: event.target.value })}
                    type="time"
                    value={rule.lunchEnd}
                  />
                </CompactField>
                <CompactField label="Intervalo">
                  <input
                    className="input"
                    inputMode="numeric"
                    onChange={(event) => updateAvailability(rule.weekday, { bufferMinutes: event.target.value })}
                    value={rule.bufferMinutes}
                  />
                </CompactField>
                <CompactField label="Antecedencia">
                  <input
                    className="input"
                    inputMode="numeric"
                    onChange={(event) =>
                      updateAvailability(rule.weekday, { minimumNoticeMinutes: event.target.value })
                    }
                    value={rule.minimumNoticeMinutes}
                  />
                </CompactField>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={savingWeekday === rule.weekday}
                  onClick={() => void saveAvailability(rule)}
                  type="button"
                >
                  <Save size={15} />
                  {savingWeekday === rule.weekday ? "..." : "Salvar"}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </main>
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
      bufferMinutes: String(rule?.buffer_minutes ?? 0),
      minimumNoticeMinutes: String(rule?.minimum_notice_minutes ?? 120),
      active: rule?.active ?? (weekday.value >= 1 && weekday.value <= 5),
      exists: Boolean(rule)
    };
  });
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex size-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        {icon}
      </div>
      <p className="truncate text-xl font-semibold">{value}</p>
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
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2.5">
      <span className="font-medium text-slate-800">{label}</span>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
        }`}
      >
        {done ? "Pronto" : "Pendente"}
      </span>
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
