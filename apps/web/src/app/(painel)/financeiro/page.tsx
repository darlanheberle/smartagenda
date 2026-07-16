import { ArrowDownLeft, ArrowUpRight, Clock3, Wallet } from "lucide-react";
import { Card, IconBox, Pill, SectionTitle } from "../components/ui";
import { formatCurrency, formatShortDate } from "../lib/format";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const { appointments, dashboard } = await getPanelData();
  const received = Math.max(0, dashboard.expectedRevenue - dashboard.pendingRevenue);
  const bars = buildBars(appointments);
  const maxBar = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-violet-700">Controle financeiro</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">Financeiro</h1>
        <p className="mt-1 text-sm text-slate-500">Recebimentos, pendencias e previsao do mes.</p>
      </header>

      <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl shadow-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-300">Faturamento do mes</p>
            <p className="mt-3 font-display text-4xl font-bold tabular">{formatCurrency(dashboard.expectedRevenue)}</p>
          </div>
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
            <Wallet size={22} />
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-white/10 p-4">
            <p className="text-xs text-slate-300">Recebido</p>
            <p className="mt-1 font-display text-xl font-bold tabular text-emerald-300">{formatCurrency(received)}</p>
          </div>
          <div className="rounded-3xl bg-white/10 p-4">
            <p className="text-xs text-slate-300">A receber</p>
            <p className="mt-1 font-display text-xl font-bold tabular text-amber-300">
              {formatCurrency(dashboard.pendingRevenue)}
            </p>
          </div>
        </div>
      </section>

      <Card className="p-5">
        <SectionTitle subtitle="Ultimos 7 dias" title="Entradas por dia" />
        <div className="mt-6 flex h-44 items-end gap-2">
          {bars.map((bar) => {
            const highest = bar.value === maxBar && bar.value > 0;

            return (
              <div className="flex flex-1 flex-col items-center gap-2" key={bar.label}>
                <div className="flex h-32 w-full items-end rounded-full bg-slate-50 p-1">
                  <div
                    className={`w-full rounded-full transition-[height] motion-reduce:transition-none ${
                      highest ? "bg-violet-600" : "bg-violet-200"
                    }`}
                    style={{ height: `${Math.max(8, (bar.value / maxBar) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-400">{bar.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Movimentacoes" />
        <div className="mt-4 space-y-3">
          {appointments.slice(0, 8).map((appointment, index) => {
            const pending = appointment.payment_status === "pending" || appointment.status !== "completed";
            const cancelled = appointment.status === "cancelled";

            return (
              <div className="flex min-h-[72px] items-center gap-3 rounded-3xl bg-slate-50 px-3" key={appointment.id}>
                <IconBox tone={cancelled ? "rose" : pending ? "amber" : "emerald"}>
                  {cancelled ? <ArrowDownLeft size={18} /> : pending ? <Clock3 size={18} /> : <ArrowUpRight size={18} />}
                </IconBox>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-950">{appointment.service_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatShortDate(appointment.starts_at)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-display font-bold tabular ${cancelled ? "text-rose-600" : "text-emerald-600"}`}>
                    {cancelled ? "-" : "+"}
                    {formatCurrency(appointment.value_cents / 100)}
                  </p>
                  <Pill tone={cancelled ? "rose" : pending ? "amber" : "emerald"}>
                    {cancelled ? "saida" : pending ? "pendente" : "entrada"}
                  </Pill>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function buildBars(appointments: Array<{ starts_at: string; value_cents: number }>) {
  const today = new Date();

  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - offset));
    const total = appointments
      .filter((appointment) => new Date(appointment.starts_at).toDateString() === date.toDateString())
      .reduce((sum, appointment) => sum + appointment.value_cents / 100, 0);

    return {
      label: new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" })
        .format(date)
        .replace(".", ""),
      value: total
    };
  });
}
