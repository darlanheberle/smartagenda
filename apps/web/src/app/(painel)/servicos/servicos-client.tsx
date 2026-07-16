"use client";

import { Check, Clock3, Edit3, Plus, Save, Tag, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, IconBox, Pill, SectionTitle } from "../components/ui";
import type { Service } from "../lib/types";
import { formatCurrency } from "../lib/format";

type ServiceForm = {
  category: string;
  name: string;
  durationMinutes: string;
  price: string;
  active: boolean;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

export function ServicosClient({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices);
  const [form, setForm] = useState<ServiceForm>({
    category: "",
    name: "",
    durationMinutes: "60",
    price: "0,00",
    active: true
  });
  const [editingServiceId, setEditingServiceId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeServices = useMemo(() => services.filter((service) => service.active), [services]);

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

  async function saveService() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        category: form.category.trim() || null,
        name: form.name.trim(),
        durationMinutes: Number.parseInt(form.durationMinutes, 10),
        priceCents: currencyToCents(form.price),
        active: form.active
      };

      if (!payload.name) {
        throw new Error("Informe o nome do servico.");
      }

      if (!Number.isFinite(payload.durationMinutes) || payload.durationMinutes <= 0) {
        throw new Error("Informe uma duracao valida.");
      }

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

      setForm({ category: "", name: "", durationMinutes: "60", price: "0,00", active: true });
      setEditingServiceId(undefined);
      setMessage(editingServiceId ? "Servico atualizado." : "Servico adicionado.");
      await reloadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o servico.");
    } finally {
      setSaving(false);
    }
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

      setMessage(service.active ? "Servico inativado." : "Servico ativado.");
      await reloadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel alterar o servico.");
    }
  }

  function editService(service: Service) {
    setEditingServiceId(service.id);
    setForm({
      category: service.category || "",
      name: service.name,
      durationMinutes: String(service.duration_minutes),
      price: centsToInput(service.price_cents),
      active: service.active
    });
  }

  function resetForm() {
    setEditingServiceId(undefined);
    setForm({ category: "", name: "", durationMinutes: "60", price: "0,00", active: true });
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-violet-700">Catalogo de atendimento</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">Servicos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Defina o que a IA pode oferecer no WhatsApp, com duracao e preco por servico.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <IconBox tone="violet">
            <Tag size={20} />
          </IconBox>
          <p className="mt-4 font-display text-2xl font-bold tabular">{services.length}</p>
          <p className="text-sm text-slate-500">servicos cadastrados</p>
        </Card>
        <Card className="p-4">
          <IconBox tone="emerald">
            <Check size={20} />
          </IconBox>
          <p className="mt-4 font-display text-2xl font-bold tabular">{activeServices.length}</p>
          <p className="text-sm text-slate-500">ativos para agenda</p>
        </Card>
      </section>

      {message ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
      ) : null}

      <Card className="p-5">
        <SectionTitle subtitle="Opcoes que aparecem no fluxo de agendamento pelo WhatsApp." title="Servicos cadastrados" />
        <div className="mt-5 space-y-3">
          {services.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Nenhum servico cadastrado ainda.
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

      <Card className="p-5">
        <SectionTitle subtitle="Nome, duracao, preco e disponibilidade para agendamento." title="Novo servico" />
        <div className="mt-5 space-y-4">
          <Field label="Categoria opcional" htmlFor="service-category">
            <input
              className="app-input min-h-14 w-full"
              id="service-category"
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="Ex: Cabelo, Unhas, Consulta"
              value={form.category}
            />
          </Field>

          <Field label="Nome do servico" htmlFor="service-name">
            <input
              className="app-input min-h-14 w-full"
              id="service-name"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ex: Limpeza odontologica"
              value={form.name}
            />
          </Field>

          <Field label="Duracao" htmlFor="service-duration">
            <input
              className="app-input min-h-14 w-full"
              id="service-duration"
              inputMode="numeric"
              onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
              value={form.durationMinutes}
            />
          </Field>

          <Field label="Preco" htmlFor="service-price">
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

          <button
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            onClick={() => setForm({ ...form, active: !form.active })}
            type="button"
          >
            {form.active ? <ToggleRight className="text-emerald-600" size={20} /> : <ToggleLeft size={20} />}
            {form.active ? "Servico ativo" : "Servico inativo"}
          </button>

          <button
            className="app-button-primary w-full"
            disabled={saving}
            onClick={() => void saveService()}
            type="button"
          >
            {editingServiceId ? <Save size={17} /> : <Plus size={17} />}
            {saving ? "Salvando..." : editingServiceId ? "Salvar alteracoes" : "Adicionar servico"}
          </button>

          {editingServiceId ? (
            <button className="app-button-secondary w-full" onClick={resetForm} type="button">
              Cancelar edicao
            </button>
          ) : null}
        </div>
      </Card>
    </div>
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
