"use client";

import { ArrowRight, Bot, Loader2, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { Avatar, Card, Pill, SectionTitle } from "../components/ui";
import { formatTime } from "../lib/format";
import type { Appointment, Client, Dashboard } from "../lib/types";

export function IAClient({
  apiUrl,
  appointments,
  clients,
  dashboard,
  initialEnabled,
  ready,
  whatsappConnected
}: {
  apiUrl: string;
  appointments: Appointment[];
  clients: Client[];
  dashboard: Dashboard;
  initialEnabled: boolean;
  ready: boolean;
  whatsappConnected: boolean;
}) {
  const [active, setActive] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string }>();
  const completed = appointments.filter((appointment) => appointment.status === "completed").length;
  const operational = active && ready;

  async function toggleAssistant() {
    const nextActive = !active;
    setSaving(true);
    setFeedback(undefined);

    try {
      const response = await fetch(`${apiUrl}/profile/assistant`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: nextActive })
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const result = (await response.json()) as { enabled: boolean };
      setActive(result.enabled);
      setFeedback({
        tone: "success",
        text: result.enabled ? "Assistente ativado com sucesso." : "Assistente pausado com sucesso."
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "Nao foi possivel alterar o assistente."
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-violet-700">WhatsApp + IA</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">Assistente IA</h1>
        <p className="mt-1 text-sm text-slate-500">Acompanhamento das conversas e automacao de agendamentos.</p>
      </header>

      {!whatsappConnected ? (
        <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm shadow-emerald-100">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-emerald-600 shadow-sm">
              <MessageCircle size={23} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-emerald-700">Configuracao necessaria</p>
              <h2 className="mt-2 font-display text-xl font-bold text-slate-950">Conecte seu WhatsApp</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Para a IA atender seus clientes, vincule o numero profissional usando um codigo no celular ou QR Code.
              </p>
              <Link
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:w-auto"
                href="/onboarding?step=whatsapp"
              >
                Conectar WhatsApp
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className={`rounded-3xl bg-gradient-to-br p-5 text-white shadow-xl ${
          operational
            ? "from-emerald-500 to-teal-600 shadow-emerald-200"
            : active
              ? "from-amber-500 to-amber-600 shadow-amber-200"
              : "from-slate-700 to-slate-900 shadow-slate-200"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/75">Controle da IA</p>
            <h2 className="mt-3 font-display text-2xl font-bold">
              {operational ? "Ativa e respondendo" : active ? "Aguardando configuracao" : "Pausada"}
            </h2>
          </div>
          <button
            aria-label={active ? "Pausar IA" : "Ativar IA"}
            aria-checked={active}
            className={`relative h-8 w-14 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600 ${
              active ? "bg-white" : "bg-white/30"
            } disabled:cursor-wait disabled:opacity-70`}
            disabled={saving}
            onClick={() => void toggleAssistant()}
            role="switch"
            type="button"
          >
            {saving ? (
              <Loader2
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-emerald-600"
                size={18}
              />
            ) : (
              <span
                className={`absolute top-1 size-6 rounded-full transition-[left,background-color] ${
                  active ? "left-7 bg-emerald-500" : "left-1 bg-white"
                }`}
              />
            )}
          </button>
        </div>
        <p className="mt-2 text-sm text-white/75" aria-live="polite">
          {feedback?.tone === "success"
            ? feedback.text
            : operational
              ? "Novas mensagens do WhatsApp serao atendidas automaticamente."
              : active
                ? "Conclua as integracoes pendentes para iniciar o atendimento."
                : "Novas mensagens nao receberao resposta automatica."}
        </p>
        {feedback?.tone === "error" ? (
          <p
            className="mt-2 rounded-2xl bg-rose-950/35 px-3 py-2 text-sm font-medium text-white"
            role="alert"
          >
            {feedback.text}
          </p>
        ) : null}
        <div className="mt-5 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/20">
            <Sparkles size={24} />
          </span>
          <div>
            <p className="font-display font-bold">IA no WhatsApp</p>
            <p className="text-sm text-emerald-50">Agenda, confirma e responde sozinha</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <Metric label="Atend. hoje" value={dashboard.appointments} />
          <Metric label="Agendados" value={appointments.length} />
          <Metric label="Resolvidos" value={completed} />
        </div>
      </section>

      <Card className="p-5">
        <SectionTitle subtitle="Simulacao do tom usado no WhatsApp." title="Exemplo de atendimento" />
        <div className="mt-5 space-y-2.5 rounded-3xl bg-slate-50 p-4">
          <Bubble side="left">Oi, quero marcar um horario para semana que vem.</Bubble>
          <Bubble side="right">Claro. Qual servico voce deseja agendar?</Bubble>
          <Bubble side="left">{appointments[0]?.service_name || "Consulta inicial"}</Bubble>
          <Bubble side="right">
            Tenho quinta as 14h e sexta as 09h. Qual fica melhor para voce?
          </Bubble>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Conversas" />
        <div className="mt-4 space-y-3">
          {(clients.length ? clients : fallbackClients).slice(0, 8).map((client, index) => (
            <div className="flex min-h-[84px] items-center gap-3 rounded-3xl bg-slate-50 px-3" key={client.id}>
              <Avatar index={index} name={client.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-slate-950">{client.name}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <Bot size={14} />
                    IA
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {index % 2 === 0 ? "Horario confirmado. Ate breve!" : "Enviando opcoes disponiveis..."}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-400">
                  {appointments[index]?.starts_at ? formatTime(appointments[index].starts_at) : "agora"}
                </p>
                {index < 2 ? (
                  <span className="mt-2 inline-grid size-6 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white/15 p-3">
      <p className="font-display text-2xl font-bold tabular">{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-white/70">{label}</p>
    </div>
  );
}

function Bubble({ children, side }: { children: ReactNode; side: "left" | "right" }) {
  return (
    <div className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-6 ${
          side === "right"
            ? "rounded-tr-sm bg-violet-600 text-white"
            : "rounded-tl-sm bg-white text-slate-700 shadow-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

const fallbackClients: Client[] = [
  { id: "fallback-1", name: "Cliente novo", updated_at: new Date().toISOString() },
  { id: "fallback-2", name: "Lead WhatsApp", updated_at: new Date().toISOString() }
];

async function readError(response: Response) {
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as { message?: string };
    return payload.message || "Nao foi possivel alterar o assistente.";
  } catch {
    return text || "Nao foi possivel alterar o assistente.";
  }
}
