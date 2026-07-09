import { Mail, Phone, UserRound, UsersRound } from "lucide-react";
import { ProductShell } from "./product-shell";

export type ClientRecord = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  updated_at: string;
};

type ClientesViewProps = {
  account: { name: string; gmail: string };
  clients: ClientRecord[];
};

export function ClientesView({ account, clients }: ClientesViewProps) {
  return (
    <ProductShell active="clientes" email={account.gmail} name={account.name}>
      <header className="border-b border-black/10 bg-[var(--canvas)] px-4 py-5 md:px-7">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Base de contatos</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--ink)] text-balance">Clientes</h1>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">
              Identificados automaticamente pelo telefone no WhatsApp.
            </p>
          </div>
          <span className="w-fit rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]">
            {clients.length} cliente{clients.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-7">
        {clients.length === 0 ? (
          <section className="surface rounded-2xl px-5 py-12 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-xl bg-[var(--surface-inset)] text-[var(--ink-muted)]">
              <UsersRound size={20} />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--ink)]">Nenhum cliente ainda</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--ink-muted)]">
              O primeiro contato salvo pelo WhatsApp aparecera aqui.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <div className="surface min-w-0 rounded-2xl p-4" key={client.id}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-inset)] text-[var(--ink-secondary)]">
                    <UserRound size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">{client.name}</p>
                    <p className="text-[11px] text-[var(--ink-muted)]">
                      Atualizado {formatShortDate(client.updated_at)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t border-black/10 pt-3 text-xs text-[var(--ink-secondary)]">
                  {client.phone ? (
                    <p className="flex items-center gap-2">
                      <Phone size={13} className="text-[var(--ink-muted)]" />
                      {client.phone}
                    </p>
                  ) : null}
                  {client.email ? (
                    <p className="flex items-center gap-2">
                      <Mail size={13} className="text-[var(--ink-muted)]" />
                      {client.email}
                    </p>
                  ) : null}
                  {!client.phone && !client.email ? (
                    <p className="text-[var(--ink-muted)]">Sem contato registrado.</p>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </ProductShell>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}
