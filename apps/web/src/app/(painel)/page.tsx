import {
  BadgeDollarSign,
  CalendarCheck2,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MessageCircle,
  Phone,
  Percent,
  TrendingUp,
  Zap,
  Wallet
} from "lucide-react";
import type { ReactNode } from "react";
import { Card, IconBox, Pill, SectionTitle } from "./components/ui";
import { firstName, formatCurrency, formatDuration, formatRelativeStart, formatTime } from "./lib/format";
import { getPanelData } from "./lib/data";

export const dynamic = "force-dynamic";

export default async function HojePage() {
  const { account, appointments, dashboard } = await getPanelData();
  const nextAppointment = appointments[0];
  const occupancy = Math.min(100, Math.round((dashboard.appointments / 8) * 100));
  const received = Math.max(0, dashboard.expectedRevenue - dashboard.pendingRevenue);

  return (
    <div className="space-y-6">
      <header className="hidden md:block">
        <p className="text-sm font-semibold text-violet-700">{formatLongDate(new Date())}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">
          Bom dia, {firstName(account.name)}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Atendimentos, pagamentos e WhatsApp no ritmo da sua agenda.</p>
      </header>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-500 p-5 text-white shadow-xl shadow-violet-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-100">
          <Clock3 size={16} />
          Proximo atendimento {nextAppointment ? `· ${formatRelativeStart(nextAppointment.starts_at)}` : ""}
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="mt-3 font-display text-2xl font-bold">
              {nextAppointment?.client_name || "Agenda livre"}
            </h2>
            <p className="mt-1 text-sm text-white/75">
              {nextAppointment
                ? [nextAppointment.service_name, formatDuration(nextAppointment.starts_at, nextAppointment.ends_at)]
                    .filter(Boolean)
                    .join(" · ")
                : "Nenhum atendimento futuro encontrado."}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-4xl font-bold tabular">
              {nextAppointment ? formatTime(nextAppointment.starts_at) : "--:--"}
            </p>
            <p className="text-xs text-white/65">hoje</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700">
            <Check size={17} />
            Check-in
          </button>
          <a
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 text-sm font-bold text-white ring-1 ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
            href={nextAppointment?.client_phone ? `https://wa.me/${nextAppointment.client_phone.replace(/\D/g, "")}` : "#"}
            rel="noreferrer"
            target="_blank"
          >
            <Phone size={17} />
            WhatsApp
          </a>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={<CalendarCheck2 size={20} />}
          label="Atendimentos"
          sub={`${dashboard.completed} concluidos`}
          tone="violet"
          value={dashboard.appointments}
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Faturamento"
          sub="previsto hoje"
          tone="emerald"
          value={formatCurrency(dashboard.expectedRevenue)}
        />
        <KpiCard icon={<Zap size={20} />} label="Ocupacao" sub="da agenda" tone="amber" value={`${occupancy}%`} />
        <KpiCard
          icon={<Wallet size={20} />}
          label="A receber"
          sub={`${dashboard.pending} pendentes`}
          tone="rose"
          value={formatCurrency(dashboard.pendingRevenue)}
        />
      </section>

      <Card className="p-5">
        <SectionTitle subtitle={`${formatCurrency(received)} ja recebido ou concluido`} title="Linha do tempo" />
        <div className="mt-5 space-y-1">
          {appointments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Os atendimentos criados pelo WhatsApp aparecem aqui.
            </div>
          ) : (
            appointments.slice(0, 8).map((appointment, index) => {
              const now = index === 0 && appointment.status !== "completed";
              const done = appointment.status === "completed";

              return (
                <div
                  className={`grid grid-cols-[54px_22px_1fr] gap-3 rounded-3xl px-1 py-3 ${now ? "bg-violet-50" : ""}`}
                  key={appointment.id}
                >
                  <div className="pt-1 text-right text-sm font-bold tabular text-slate-700">
                    {formatTime(appointment.starts_at)}
                  </div>
                  <div className="relative flex justify-center">
                    {index < appointments.slice(0, 8).length - 1 ? (
                      <span className="absolute bottom-[-12px] top-7 w-px bg-slate-200" />
                    ) : null}
                    <span
                      className={`mt-2 size-3 rounded-full ${
                        done ? "bg-emerald-500" : now ? "bg-violet-600 ring-4 ring-violet-200" : "bg-slate-300"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold text-slate-950">{appointment.client_name || "Cliente"}</p>
                      {appointment.google_event_link ? (
                        <a
                          aria-label="Abrir evento no Google Calendar"
                          className="grid size-11 shrink-0 place-items-center rounded-2xl text-slate-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                          href={appointment.google_event_link}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink size={17} />
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {[appointment.service_name, formatDuration(appointment.starts_at, appointment.ends_at)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {now ? <Pill tone="violet">agora</Pill> : null}
                        {done ? <CheckCheck className="text-emerald-500" size={17} /> : null}
                      </div>
                      <p className="text-sm font-bold tabular text-slate-700">
                        {formatCurrency(appointment.value_cents / 100)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  sub,
  tone,
  value
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  tone: "violet" | "emerald" | "amber" | "rose";
  value: number | string;
}) {
  return (
    <Card className="min-h-[150px] p-5">
      <IconBox tone={tone}>{icon}</IconBox>
      <p className="mt-5 font-display text-2xl font-bold tabular text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </Card>
  );
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
    weekday: "long"
  }).format(value);
}
