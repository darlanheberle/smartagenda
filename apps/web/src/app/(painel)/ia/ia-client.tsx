"use client";

import { Bot, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Avatar, Card, Pill, SectionTitle } from "../components/ui";
import { formatTime } from "../lib/format";
import type { Appointment, Client, Dashboard } from "../lib/types";

export function IAClient({
  appointments,
  clients,
  dashboard,
  ready
}: {
  appointments: Appointment[];
  clients: Client[];
  dashboard: Dashboard;
  ready: boolean;
}) {
  const [active, setActive] = useState(ready);
  const completed = appointments.filter((appointment) => appointment.status === "completed").length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-violet-700">WhatsApp + IA</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">Assistente IA</h1>
        <p className="mt-1 text-sm text-slate-500">Acompanhamento das conversas e automacao de agendamentos.</p>
      </header>

      <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl shadow-emerald-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/75">Controle da IA</p>
            <h2 className="mt-3 font-display text-2xl font-bold">{active ? "Ativa e respondendo" : "Pausada"}</h2>
          </div>
          <button
            aria-label={active ? "Pausar IA" : "Ativar IA"}
            className={`relative h-8 w-14 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600 ${
              active ? "bg-white" : "bg-white/30"
            }`}
            onClick={() => setActive((current) => !current)}
            type="button"
          >
            <span
              className={`absolute top-1 size-6 rounded-full transition-all ${
                active ? "left-7 bg-emerald-500" : "left-1 bg-white"
              }`}
            />
          </button>
        </div>
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
