import { BadgeDollarSign, CircleDollarSign, Clock3, XCircle } from "lucide-react";
import { ProductShell } from "./product-shell";

export type FinanceAppointment = {
  id: string;
  service_name: string;
  starts_at: string;
  status: string;
  value_cents: number;
  payment_status: string;
  payment_method?: string;
  client_name?: string;
};

type FinanceiroViewProps = {
  account: { name: string; gmail: string };
  appointments: FinanceAppointment[];
};

export function FinanceiroView({ account, appointments }: FinanceiroViewProps) {
  const active = appointments.filter((appointment) => appointment.status !== "cancelled");
  const received = active.filter((appointment) => appointment.payment_status !== "pending");
  const pending = active.filter((appointment) => appointment.payment_status === "pending");
  const cancelled = appointments.filter((appointment) => appointment.status === "cancelled");

  const receivedTotal = sumCents(received);
  const pendingTotal = sumCents(pending);
  const totalTotal = receivedTotal + pendingTotal;

  return (
    <ProductShell active="financeiro" email={account.gmail} name={account.name}>
      <header className="border-b border-black/10 bg-[var(--canvas)] px-4 py-5 md:px-7">
        <div className="mx-auto max-w-[1440px]">
          <p className="eyebrow">Movimentacao</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--ink)] text-balance">Financeiro</h1>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            Valores calculados a partir dos atendimentos registrados.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 md:px-7">
        <section className="grid gap-px overflow-hidden rounded-2xl bg-black/10 md:grid-cols-3">
          <SummaryCard
            icon={<CircleDollarSign size={18} />}
            label="Total do periodo"
            value={formatCurrency(totalTotal / 100)}
          />
          <SummaryCard
            icon={<BadgeDollarSign size={18} />}
            label="Recebido"
            tone="brand"
            value={formatCurrency(receivedTotal / 100)}
          />
          <SummaryCard
            icon={<Clock3 size={18} />}
            label="Pendente"
            tone="warning"
            value={formatCurrency(pendingTotal / 100)}
          />
        </section>

        <section className="surface rounded-2xl">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--ink)]">Historico de atendimentos</h2>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                {cancelled.length} cancelado{cancelled.length === 1 ? "" : "s"} nao entram no total.
              </p>
            </div>
          </div>

          {appointments.length === 0 ? (
            <div className="mx-4 mb-4 rounded-xl bg-[var(--surface-subtle)] px-5 py-8 text-center text-sm text-[var(--ink-muted)]">
              Nenhum atendimento registrado ainda.
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto px-4 pb-4">
              <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Servico</th>
                    <th className="px-3 py-2 font-medium">Valor</th>
                    <th className="px-3 py-2 font-medium">Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => {
                    const cancelledRow = appointment.status === "cancelled";

                    return (
                      <tr className="group" key={appointment.id}>
                        <td className="rounded-l-xl bg-[var(--surface-subtle)] px-3 py-3 tabular text-[var(--ink-secondary)] transition-colors group-hover:bg-[var(--surface-inset)]">
                          {formatDate(appointment.starts_at)}
                        </td>
                        <td className="bg-[var(--surface-subtle)] px-3 py-3 font-medium text-[var(--ink)] transition-colors group-hover:bg-[var(--surface-inset)]">
                          {appointment.client_name || "Cliente"}
                        </td>
                        <td className="bg-[var(--surface-subtle)] px-3 py-3 text-[var(--ink-secondary)] transition-colors group-hover:bg-[var(--surface-inset)]">
                          {appointment.service_name}
                        </td>
                        <td className="bg-[var(--surface-subtle)] px-3 py-3 tabular text-[var(--ink-secondary)] transition-colors group-hover:bg-[var(--surface-inset)]">
                          {formatCurrency(appointment.value_cents / 100)}
                        </td>
                        <td className="rounded-r-xl bg-[var(--surface-subtle)] px-3 py-3 transition-colors group-hover:bg-[var(--surface-inset)]">
                          <PaymentBadge cancelled={cancelledRow} status={appointment.payment_status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ProductShell>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone = "default"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "brand" | "warning";
}) {
  const iconTone =
    tone === "brand"
      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
      : tone === "warning"
        ? "bg-[var(--warning-soft)] text-[var(--warning)]"
        : "bg-[var(--surface-inset)] text-[var(--ink-secondary)]";

  return (
    <div className="bg-white p-4">
      <div className={`mb-4 flex size-8 items-center justify-center rounded-xl ${iconTone}`}>{icon}</div>
      <p className="truncate text-xl font-semibold tabular text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{label}</p>
    </div>
  );
}

function PaymentBadge({ status, cancelled }: { status: string; cancelled: boolean }) {
  if (cancelled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--danger-soft)] px-2.5 py-1 text-xs font-medium text-[var(--danger)]">
        <XCircle size={11} />
        Cancelado
      </span>
    );
  }

  const paid = status !== "pending";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        paid ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"
      }`}
    >
      {paid ? "Recebido" : "Pendente"}
    </span>
  );
}

function sumCents(appointments: FinanceAppointment[]) {
  return appointments.reduce((total, appointment) => total + appointment.value_cents, 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}
