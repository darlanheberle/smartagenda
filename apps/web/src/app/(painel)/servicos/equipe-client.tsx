"use client";

import { Edit3, Plus, Save, ToggleLeft, ToggleRight, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Card, IconBox, Pill, SectionTitle } from "../components/ui";
import type { Service, TeamMember, TeamMemberAvailabilityRule } from "../lib/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

const WEEKDAYS = [
  { weekday: 1, label: "Segunda" },
  { weekday: 2, label: "Terca" },
  { weekday: 3, label: "Quarta" },
  { weekday: 4, label: "Quinta" },
  { weekday: 5, label: "Sexta" },
  { weekday: 6, label: "Sabado" },
  { weekday: 0, label: "Domingo" }
];

type ScheduleRow = {
  weekday: number;
  active: boolean;
  start_time: string;
  end_time: string;
};

function defaultSchedule(): ScheduleRow[] {
  return WEEKDAYS.map(({ weekday }) => ({
    weekday,
    active: weekday >= 1 && weekday <= 5,
    start_time: "09:00",
    end_time: "18:00"
  }));
}

function toTimeInput(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

export function EquipeClient({
  services,
  initialTeamMembers
}: {
  services: Service[];
  initialTeamMembers: TeamMember[];
}) {
  const activeServices = services.filter((service) => service.active);
  const [members, setMembers] = useState(initialTeamMembers);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [active, setActive] = useState(true);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(defaultSchedule());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function reloadMembers() {
    const response = await fetch(`${apiUrl}/team-members`, {
      cache: "no-store",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    setMembers((await response.json()) as TeamMember[]);
  }

  function resetForm() {
    setEditingId(undefined);
    setName("");
    setPhone("");
    setEmail("");
    setActive(true);
    setServiceIds([]);
    setSchedule(defaultSchedule());
  }

  function toggleServiceId(id: string) {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  function updateScheduleRow(weekday: number, patch: Partial<ScheduleRow>) {
    setSchedule((current) =>
      current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row))
    );
  }

  async function editMember(member: TeamMember) {
    setError("");
    setMessage("");
    setEditingId(member.id);
    setName(member.name);
    setPhone(member.phone || "");
    setEmail(member.email || "");
    setActive(member.active);
    setServiceIds(member.serviceIds || []);
    setSchedule(defaultSchedule());

    try {
      const response = await fetch(`${apiUrl}/team-members/${member.id}/availability`, {
        cache: "no-store",
        credentials: "include"
      });

      if (response.ok) {
        const rules = (await response.json()) as TeamMemberAvailabilityRule[];
        if (rules.length > 0) {
          setSchedule(
            WEEKDAYS.map(({ weekday }) => {
              const rule = rules.find((item) => item.weekday === weekday);
              return {
                weekday,
                active: rule ? rule.active : false,
                start_time: toTimeInput(rule?.start_time) || "09:00",
                end_time: toTimeInput(rule?.end_time) || "18:00"
              };
            })
          );
        }
      }
    } catch {
      // Mantem a grade padrao se a busca falhar.
    }
  }

  async function saveMember() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!name.trim()) {
        throw new Error("Informe o nome do profissional.");
      }

      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        active,
        serviceIds
      };

      const response = await fetch(
        editingId ? `${apiUrl}/team-members/${editingId}` : `${apiUrl}/team-members`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const member = (await response.json()) as TeamMember;

      const availabilityRules = schedule.map((row) => ({
        weekday: row.weekday,
        startTime: row.start_time,
        endTime: row.end_time,
        active: row.active
      }));

      await fetch(`${apiUrl}/team-members/${member.id}/availability`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rules: availabilityRules })
      });

      setMessage(editingId ? "Profissional atualizado." : "Profissional adicionado.");
      resetForm();
      await reloadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o profissional.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleMemberActive(member: TeamMember) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${apiUrl}/team-members/${member.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !member.active })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setMessage(member.active ? "Profissional inativado." : "Profissional ativado.");
      await reloadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel alterar o profissional.");
    }
  }

  function serviceNames(ids?: string[]) {
    if (!ids || ids.length === 0) {
      return "Nenhum servico vinculado";
    }
    return services
      .filter((service) => ids.includes(service.id))
      .map((service) => service.name)
      .join(", ");
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
      ) : null}

      <Card className="p-5">
        <SectionTitle subtitle="Quem o cliente pode escolher no WhatsApp." title="Profissionais" />
        <div className="mt-5 space-y-3">
          {members.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Nenhum profissional cadastrado ainda.
            </div>
          ) : (
            members.map((member) => (
              <div className="rounded-3xl bg-slate-50 p-4" key={member.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{member.name}</p>
                      <Pill tone={member.active ? "emerald" : "slate"}>
                        {member.active ? "Ativo" : "Inativo"}
                      </Pill>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{serviceNames(member.serviceIds)}</p>
                  </div>
                  <IconBox tone={member.active ? "violet" : "slate"}>
                    <UserPlus size={18} />
                  </IconBox>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    onClick={() => void editMember(member)}
                    type="button"
                  >
                    <Edit3 size={16} />
                    Editar
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    onClick={() => void toggleMemberActive(member)}
                    type="button"
                  >
                    <Trash2 size={16} />
                    {member.active ? "Inativar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          subtitle="Dados, servicos realizados e horario de atendimento."
          title={editingId ? "Editar profissional" : "Adicionar profissional"}
        />
        <div className="mt-5 space-y-4">
          <Field htmlFor="member-name" label="Nome">
            <input
              className="app-input min-h-14 w-full"
              id="member-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Maria"
              value={name}
            />
          </Field>

          <Field htmlFor="member-phone" label="Telefone (opcional)">
            <input
              className="app-input min-h-14 w-full"
              id="member-phone"
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(00) 00000-0000"
              value={phone}
            />
          </Field>

          <Field htmlFor="member-email" label="E-mail (opcional)">
            <input
              className="app-input min-h-14 w-full"
              id="member-email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="profissional@email.com"
              value={email}
            />
          </Field>

          <div>
            <p className="text-sm font-semibold text-slate-700">Servicos realizados</p>
            {activeServices.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Cadastre servicos na aba Servicos para vincular a este profissional.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {activeServices.map((service) => {
                  const checked = serviceIds.includes(service.id);
                  return (
                    <button
                      className={`flex min-h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        checked ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-600"
                      }`}
                      key={service.id}
                      onClick={() => toggleServiceId(service.id)}
                      type="button"
                    >
                      <span>{service.name}</span>
                      {checked ? <ToggleRight className="text-violet-600" size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700">Horario de atendimento</p>
            <div className="mt-2 space-y-2">
              {WEEKDAYS.map(({ weekday, label }) => {
                const row = schedule.find((item) => item.weekday === weekday);
                if (!row) {
                  return null;
                }
                return (
                  <div className="rounded-2xl bg-slate-50 p-3" key={weekday}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-700">{label}</span>
                      <button
                        aria-pressed={row.active}
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-xl"
                        onClick={() => updateScheduleRow(weekday, { active: !row.active })}
                        type="button"
                      >
                        {row.active ? (
                          <ToggleRight className="text-violet-600" size={22} />
                        ) : (
                          <ToggleLeft className="text-slate-400" size={22} />
                        )}
                      </button>
                    </div>
                    {row.active ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          aria-label={`Inicio ${label}`}
                          className="app-input min-h-11 w-full"
                          onChange={(event) => updateScheduleRow(weekday, { start_time: event.target.value })}
                          type="time"
                          value={row.start_time}
                        />
                        <span className="text-slate-400">as</span>
                        <input
                          aria-label={`Fim ${label}`}
                          className="app-input min-h-11 w-full"
                          onChange={(event) => updateScheduleRow(weekday, { end_time: event.target.value })}
                          type="time"
                          value={row.end_time}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            onClick={() => setActive((current) => !current)}
            type="button"
          >
            {active ? <ToggleRight className="text-emerald-600" size={20} /> : <ToggleLeft size={20} />}
            {active ? "Profissional ativo" : "Profissional inativo"}
          </button>

          <button
            className="app-button-primary w-full"
            disabled={saving}
            onClick={() => void saveMember()}
            type="button"
          >
            {editingId ? <Save size={17} /> : <Plus size={17} />}
            {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Adicionar profissional"}
          </button>

          {editingId ? (
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
