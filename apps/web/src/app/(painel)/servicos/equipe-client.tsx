"use client";

import {
  Copy,
  Edit3,
  KeyRound,
  Link2,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserPlus,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card, IconBox, Pill, SectionTitle } from "../components/ui";
import { useToast } from "../components/toast";
import type { Service, TeamMember, TeamMemberAvailabilityRule } from "../lib/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

const WEEKDAYS = [
  { weekday: 1, label: "Segunda" },
  { weekday: 2, label: "Terça" },
  { weekday: 3, label: "Quarta" },
  { weekday: 4, label: "Quinta" },
  { weekday: 5, label: "Sexta" },
  { weekday: 6, label: "Sábado" },
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
  initialTeamMembers,
  companySlug
}: {
  services: Service[];
  initialTeamMembers: TeamMember[];
  companySlug?: string;
}) {
  const activeServices = services.filter((service) => service.active);
  const [members, setMembers] = useState(initialTeamMembers);
  const [companyLoginUrl, setCompanyLoginUrl] = useState("");

  useEffect(() => {
    if (companySlug) {
      setCompanyLoginUrl(`${window.location.origin}/${companySlug}/login`);
    }
  }, [companySlug]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [active, setActive] = useState(true);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(defaultSchedule());
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});
  const [invitingId, setInvitingId] = useState<string | undefined>();

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

  async function generateInvite(member: TeamMember) {
    if (!member.email) {
      toast.error("Cadastre um e-mail para este profissional antes de gerar o acesso.");
      return;
    }

    setInvitingId(member.id);
    try {
      const response = await fetch(`${apiUrl}/team-members/${member.id}/invite`, {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as { activationUrl: string };
      setInviteUrls((current) => ({ ...current, [member.id]: data.activationUrl }));
      toast.success("Link de acesso gerado. Copie e envie ao profissional.");
      await reloadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o link de acesso.");
    } finally {
      setInvitingId(undefined);
    }
  }

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

  function openForNew() {
    resetForm();
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
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
    setEditingId(member.id);
    setName(member.name);
    setPhone(member.phone || "");
    setEmail(member.email || "");
    setActive(member.active);
    setServiceIds(member.serviceIds || []);
    setSchedule(defaultSchedule());
    setFormOpen(true);

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

      const wasEditing = Boolean(editingId);
      setFormOpen(false);
      resetForm();
      await reloadMembers();
      if (wasEditing) {
        toast.saved();
      } else {
        toast.created();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o profissional.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleMemberActive(member: TeamMember) {
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

      toast.saved();
      await reloadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar o profissional.");
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
      {companyLoginUrl ? (
        <Card className="p-5">
          <SectionTitle
            subtitle="Cada profissional entra com o próprio e-mail e senha e ve so a agenda dele."
            title="Link de acesso da sua equipe"
          />
          <div className="mt-4 flex items-center gap-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600">
              <Link2 size={18} />
            </span>
            <input
              className="min-h-11 w-full rounded-2xl border border-slate-100 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
              readOnly
              value={companyLoginUrl}
            />
            <button
              className="inline-flex min-h-11 items-center gap-1 rounded-2xl bg-violet-600 px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              onClick={() => {
                void navigator.clipboard
                  .writeText(companyLoginUrl)
                  .then(() => toast.success("Link de acesso da empresa copiado."));
              }}
              type="button"
            >
              <Copy size={14} />
              Copiar
            </button>
          </div>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-950">Profissionais</h2>
            <p className="mt-1 text-sm text-slate-500">Quem o cliente pode escolher no WhatsApp.</p>
          </div>
          <button className="app-button-primary shrink-0" onClick={openForNew} type="button">
            <Plus size={17} />
            Cadastro de profissional
          </button>
        </div>

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
                      {member.access?.hasPassword ? (
                        <Pill tone="emerald">Acesso ativo</Pill>
                      ) : member.access?.invitePending ? (
                        <Pill tone="violet">Convite pendente</Pill>
                      ) : (
                        <Pill tone="slate">Sem acesso</Pill>
                      )}
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

                <button
                  className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-semibold text-violet-700 shadow-sm ring-1 ring-slate-100 hover:bg-violet-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  disabled={invitingId === member.id}
                  onClick={() => void generateInvite(member)}
                  type="button"
                >
                  <KeyRound size={16} />
                  {invitingId === member.id
                    ? "Gerando..."
                    : member.access?.hasPassword
                      ? "Gerar novo link de acesso"
                      : "Gerar link de acesso"}
                </button>

                {inviteUrls[member.id] ? (
                  <div className="mt-2 space-y-2 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                    <p className="text-xs font-semibold text-slate-500">
                      Envie este link para {member.name} definir a senha (valido por 7 dias):
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        className="min-h-10 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs text-slate-700 outline-none"
                        readOnly
                        value={inviteUrls[member.id]}
                      />
                      <button
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(inviteUrls[member.id])
                            .then(() => toast.success("Link copiado."));
                        }}
                        type="button"
                      >
                        <Copy size={14} />
                        Copiar
                      </button>
                    </div>
                  </div>
                ) : null}
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
            aria-labelledby="equipe-form-title"
            aria-modal="true"
            className="flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            {/* Cabeçalho fixo */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-950" id="equipe-form-title">
                  {editingId ? "Editar profissional" : "Cadastrar profissional"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dados, serviços realizados e horário de atendimento.
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

                <div className="block text-sm font-semibold text-slate-700">
                  Status
                  <button
                    className="mt-2 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    onClick={() => setActive((current) => !current)}
                    type="button"
                  >
                    {active ? <ToggleRight className="text-emerald-600" size={20} /> : <ToggleLeft size={20} />}
                    {active ? "Profissional ativo" : "Profissional inativo"}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Serviços realizados</p>
                  {activeServices.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">
                      Cadastre serviços na aba Serviços para vincular a este profissional.
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
                            {checked ? (
                              <ToggleRight className="text-violet-600" size={20} />
                            ) : (
                              <ToggleLeft size={20} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-700">Horário de atendimento</p>
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
                              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
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
                                onChange={(event) =>
                                  updateScheduleRow(weekday, { start_time: event.target.value })
                                }
                                type="time"
                                value={row.start_time}
                              />
                              <span className="text-slate-400">as</span>
                              <input
                                aria-label={`Fim ${label}`}
                                className="app-input min-h-11 w-full"
                                onChange={(event) =>
                                  updateScheduleRow(weekday, { end_time: event.target.value })
                                }
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
                onClick={() => void saveMember()}
                type="button"
              >
                {editingId ? <Save size={17} /> : <Plus size={17} />}
                {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Cadastrar profissional"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
