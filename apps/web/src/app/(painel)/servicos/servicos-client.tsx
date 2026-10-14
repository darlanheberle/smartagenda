"use client";

import {
  Check,
  Clock3,
  Edit3,
  Percent,
  Plus,
  Save,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, IconBox, Pill, SectionTitle } from "../components/ui";
import { useToast } from "../components/toast";
import type { Service, TeamMember } from "../lib/types";
import { formatCurrency } from "../lib/format";
import { EquipeClient } from "./equipe-client";

type ServiceForm = {
  category: string;
  name: string;
  durationMinutes: string;
  price: string;
  commission: string;
  active: boolean;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

export function ServicosClient({
  initialServices,
  initialTeamMode,
  initialTeamMembers,
  companySlug
}: {
  initialServices: Service[];
  initialTeamMode: boolean;
  initialTeamMembers: TeamMember[];
  companySlug?: string;
}) {
  const toast = useToast();
  const [services, setServices] = useState(initialServices);
  const [teamMode, setTeamMode] = useState(initialTeamMode);
  const [tab, setTab] = useState<"servicos" | "equipe">("servicos");
  const [teamModeSaving, setTeamModeSaving] = useState(false);
  const [form, setForm] = useState<ServiceForm>({
    category: "",
    name: "",
    durationMinutes: "60",
    price: "0,00",
    commission: "",
    active: true
  });
  const [editingServiceId, setEditingServiceId] = useState<string | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultCommission, setDefaultCommission] = useState("50");
  const [commissionSaving, setCommissionSaving] = useState(false);

  const activeServices = useMemo(() => services.filter((service) => service.active), [services]);

  useEffect(() => {
    fetch(`${apiUrl}/profile/commission`, { cache: "no-store", credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && typeof data.defaultPercent === "number") {
          setDefaultCommission(String(data.defaultPercent));
        }
      })
      .catch(() => undefined);
  }, []);

  // Trava a rolagem do fundo e fecha no Esc enquanto o modal estiver aberto.
  useEffect(() => {
    if (!formOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeForm();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);

  async function saveDefaultCommission() {
    setCommissionSaving(true);
    try {
      const percent = Number.parseInt(defaultCommission, 10);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new Error("Informe uma porcentagem entre 0 e 100.");
      }
      const response = await fetch(`${apiUrl}/profile/commission`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ defaultPercent: percent })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      toast.saved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a comissão.");
    } finally {
      setCommissionSaving(false);
    }
  }

  async function reloadServices() {
    const response = await fetch(`${apiUrl}/services`, {
      cache: "no-store",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    setServices((await response.json()) as Service[]);
  }

  async function toggleTeamMode() {
    setTeamModeSaving(true);

    try {
      const next = !teamMode;
      const response = await fetch(`${apiUrl}/profile/team-mode`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: next })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as { enabled: boolean };
      setTeamMode(data.enabled);
      toast.saved();
      if (!data.enabled) {
        setTab("servicos");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar o Modo Equipes.");
    } finally {
      setTeamModeSaving(false);
    }
  }

  async function saveService() {
    setSaving(true);

    try {
      const commissionText = form.commission.trim();
      const payload = {
        category: form.category.trim() || null,
        name: form.name.trim(),
        durationMinutes: Number.parseInt(form.durationMinutes, 10),
        priceCents: currencyToCents(form.price),
        active: form.active,
        commissionPercent: commissionText === "" ? null : Number.parseInt(commissionText, 10)
      };

      if (!payload.name) {
        throw new Error("Informe o nome do serviço.");
      }

      if (!Number.isFinite(payload.durationMinutes) || payload.durationMinutes <= 0) {
        throw new Error("Informe uma duração válida.");
      }

      if (
        payload.commissionPercent !== null &&
        (!Number.isFinite(payload.commissionPercent) ||
          payload.commissionPercent < 0 ||
          payload.commissionPercent > 100)
      ) {
        throw new Error("A comissão deve estar entre 0 e 100.");
      }

      const isEditing = Boolean(editingServiceId);
      const response = await fetch(
        editingServiceId ? `${apiUrl}/services/${editingServiceId}` : `${apiUrl}/services`,
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

      setForm({ category: "", name: "", durationMinutes: "60", price: "0,00", commission: "", active: true });
      setEditingServiceId(undefined);
      setFormOpen(false);
      if (isEditing) {
        toast.saved();
      } else {
        toast.created();
      }
      await reloadServices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o serviço.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleService(service: Service) {
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

      toast.saved();
      await reloadServices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar o serviço.");
    }
  }

  function editService(service: Service) {
    setEditingServiceId(service.id);
    setForm({
      category: service.category || "",
      name: service.name,
      durationMinutes: String(service.duration_minutes),
      price: centsToInput(service.price_cents),
      commission:
        service.commission_percent === null || service.commission_percent === undefined
          ? ""
          : String(service.commission_percent),
      active: service.active
    });
    setFormOpen(true);
  }

  function resetForm() {
    setEditingServiceId(undefined);
    setForm({ category: "", name: "", durationMinutes: "60", price: "0,00", commission: "", active: true });
  }

  function openForNew() {
    resetForm();
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-violet-700">Catalogo de atendimento</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">Serviços</h1>
        <p className="mt-1 text-sm text-slate-500">
          Defina o que a IA pode oferecer no WhatsApp, com duração e preço por serviço.
        </p>
      </header>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <IconBox tone={teamMode ? "violet" : "slate"}>
                <Users size={18} />
              </IconBox>
              <p className="font-semibold text-slate-950">Modo Equipes</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Ative para cadastrar profissionais e fazer o robo do WhatsApp perguntar com quem o
              cliente quer agendar antes de escolher o serviço.
            </p>
          </div>
          <button
            aria-pressed={teamMode}
            className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 rounded-2xl"
            disabled={teamModeSaving}
            onClick={() => void toggleTeamMode()}
            type="button"
          >
            {teamMode ? (
              <ToggleRight className="text-violet-600" size={40} />
            ) : (
              <ToggleLeft className="text-slate-400" size={40} />
            )}
          </button>
        </div>
      </Card>

      {teamMode ? (
        <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
          <TabButton active={tab === "servicos"} label="Serviços" onClick={() => setTab("servicos")} />
          <TabButton active={tab === "equipe"} label="Equipe" onClick={() => setTab("equipe")} />
        </div>
      ) : null}

      {teamMode && tab === "equipe" ? (
        <EquipeClient
          services={services}
          initialTeamMembers={initialTeamMembers}
          companySlug={companySlug}
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <IconBox tone="violet">
                <Tag size={20} />
              </IconBox>
              <p className="mt-4 font-display text-2xl font-bold tabular">{services.length}</p>
              <p className="text-sm text-slate-500">serviços cadastrados</p>
            </Card>
            <Card className="p-4">
              <IconBox tone="emerald">
                <Check size={20} />
              </IconBox>
              <p className="mt-4 font-display text-2xl font-bold tabular">{activeServices.length}</p>
              <p className="text-sm text-slate-500">ativos para agenda</p>
            </Card>
          </section>

          <Card className="p-5">
            <SectionTitle
              subtitle="Parte (%) que fica com o profissional. Vale para todos os serviços, exceto os que tiverem % próprio."
              title="Comissão do profissional (padrão)"
            />
            <div className="mt-4 flex items-end gap-3">
              <label className="block flex-1 text-sm font-semibold text-slate-700">
                % para o profissional
                <div className="mt-2 flex items-center gap-2">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600">
                    <Percent size={18} />
                  </span>
                  <input
                    className="app-input min-h-14 w-full"
                    inputMode="numeric"
                    onChange={(event) => setDefaultCommission(event.target.value)}
                    placeholder="Ex: 40"
                    value={defaultCommission}
                  />
                </div>
              </label>
              <button
                className="app-button-primary min-h-14 shrink-0 px-5"
                disabled={commissionSaving}
                onClick={() => void saveDefaultCommission()}
                type="button"
              >
                <Save size={16} />
                {commissionSaving ? "..." : "Salvar"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Ex.: 40% para o profissional significa 60% para a empresa.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-950">Serviços cadastrados</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Opções que aparecem no fluxo de agendamento pelo WhatsApp.
                </p>
              </div>
              <button className="app-button-primary shrink-0" onClick={openForNew} type="button">
                <Plus size={17} />
                Cadastro de serviço
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {services.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Nenhum serviço cadastrado ainda.
                </div>
              ) : (
                services.map((service) => (
                  <div className="rounded-3xl bg-slate-50 p-4" key={service.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">{service.name}</p>
                          <Pill tone={service.active ? "emerald" : "slate"}>
                            {service.active ? "Ativo" : "Inativo"}
                          </Pill>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {service.category || "Sem categoria"} · {service.duration_minutes} min ·{" "}
                          {formatCurrency(service.price_cents / 100)}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-violet-700">
                          Profissional:{" "}
                          {service.commission_percent ?? (Number.parseInt(defaultCommission, 10) || 0)}%
                          {service.commission_percent === null || service.commission_percent === undefined
                            ? " (padrao)"
                            : ""}
                        </p>
                      </div>
                      <IconBox tone={service.active ? "violet" : "slate"}>
                        <Clock3 size={18} />
                      </IconBox>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        onClick={() => editService(service)}
                        type="button"
                      >
                        <Edit3 size={16} />
                        Editar
                      </button>
                      <button
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        onClick={() => void toggleService(service)}
                        type="button"
                      >
                        <Trash2 size={16} />
                        {service.active ? "Inativar" : "Ativar"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {formOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-5"
              onClick={closeForm}
              role="presentation"
            >
              <section
                aria-labelledby="servico-form-title"
                aria-modal="true"
                className="flex max-h-[90vh] w-[90vw] max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                {/* Cabeçalho fixo */}
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-950" id="servico-form-title">
                      {editingServiceId ? "Editar serviço" : "Cadastrar serviço"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Nome, duração, preço e disponibilidade para agendamento.
                    </p>
                  </div>
                  <button
                    aria-label="Fechar"
                    className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    onClick={closeForm}
                    type="button"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Corpo rolável (só os campos rolam) */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nome do serviço" htmlFor="service-name">
                      <input
                        className="app-input min-h-14 w-full"
                        id="service-name"
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        placeholder="Ex: Limpeza odontologica"
                        value={form.name}
                      />
                    </Field>

                    <Field label="Categoria opcional" htmlFor="service-category">
                      <input
                        className="app-input min-h-14 w-full"
                        id="service-category"
                        onChange={(event) => setForm({ ...form, category: event.target.value })}
                        placeholder="Ex: Cabelo, Unhas, Consulta"
                        value={form.category}
                      />
                    </Field>

                    <Field label="Duração (minutos)" htmlFor="service-duration">
                      <input
                        className="app-input min-h-14 w-full"
                        id="service-duration"
                        inputMode="numeric"
                        onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
                        value={form.durationMinutes}
                      />
                    </Field>

                    <Field label="Preço" htmlFor="service-price">
                      <input
                        className="app-input min-h-14 w-full"
                        id="service-price"
                        inputMode="decimal"
                        onBlur={() => setForm({ ...form, price: centsToInput(currencyToCents(form.price)) })}
                        onChange={(event) => setForm({ ...form, price: event.target.value })}
                        placeholder="0,00"
                        value={form.price}
                      />
                    </Field>

                    <Field label="% do profissional (opcional)" htmlFor="service-commission">
                      <input
                        className="app-input min-h-14 w-full"
                        id="service-commission"
                        inputMode="numeric"
                        onChange={(event) => setForm({ ...form, commission: event.target.value })}
                        placeholder={`Vazio usa o padrao (${defaultCommission}%)`}
                        value={form.commission}
                      />
                    </Field>

                    <div className="block text-sm font-semibold text-slate-700">
                      Status
                      <button
                        className="mt-2 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                        onClick={() => setForm({ ...form, active: !form.active })}
                        type="button"
                      >
                        {form.active ? (
                          <ToggleRight className="text-emerald-600" size={20} />
                        ) : (
                          <ToggleLeft size={20} />
                        )}
                        {form.active ? "Servico ativo" : "Servico inativo"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rodapé fixo com as ações */}
                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
                  <button className="app-button-secondary" onClick={closeForm} type="button">
                    Cancelar
                  </button>
                  <button
                    className="app-button-primary"
                    disabled={saving}
                    onClick={() => void saveService()}
                    type="button"
                  >
                    {editingServiceId ? <Save size={17} /> : <Plus size={17} />}
                    {saving ? "Salvando..." : editingServiceId ? "Salvar alteracoes" : "Cadastrar serviço"}
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        active ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function Field({
  children,
  htmlFor,
  label
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700" htmlFor={htmlFor}>
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function currencyToCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function centsToInput(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}
