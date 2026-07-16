"use client";

import { ChevronRight, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Card, IconBox, Pill } from "../components/ui";
import { formatShortDate } from "../lib/format";
import type { Client } from "../lib/types";

export function ClientesClient({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return clients;
    }

    return clients.filter((client) =>
      [client.name, client.phone, client.email].filter(Boolean).join(" ").toLowerCase().includes(normalized)
    );
  }, [clients, query]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-700">Relacionamento</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">Cada contato fica vinculado ao telefone usado no WhatsApp.</p>
        </div>
        <button
          aria-label="Novo cliente"
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          type="button"
        >
          <Plus size={21} />
        </button>
      </header>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          className="app-input min-h-14 w-full pl-12"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome, telefone ou email"
          value={query}
        />
      </label>

      <section className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <IconBox tone="violet">
            <Search size={20} />
          </IconBox>
          <p className="mt-4 font-display text-2xl font-bold tabular">{clients.length}</p>
          <p className="text-sm text-slate-500">clientes ativos</p>
        </Card>
        <Card className="p-4">
          <IconBox tone="emerald">
            <ChevronRight size={20} />
          </IconBox>
          <p className="mt-4 font-display text-2xl font-bold tabular">{recentClients(clients)}</p>
          <p className="text-sm text-slate-500">novos no mes</p>
        </Card>
      </section>

      <section>
        {filteredClients.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500">Nenhum cliente encontrado.</Card>
        ) : (
          <Card className="divide-y divide-slate-50 overflow-hidden">
            {filteredClients.map((client, index) => (
              <button
                className="flex min-h-[82px] w-full items-center gap-3 p-3.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
                key={client.id}
                type="button"
              >
                <Avatar index={index} name={client.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-950">{client.name}</p>
                    {index % 3 === 0 ? (
                      <Pill tone="amber">VIP</Pill>
                    ) : index % 3 === 1 ? (
                      <Pill tone="violet">Fiel</Pill>
                    ) : index % 3 === 2 ? (
                      <Pill tone="emerald">Retorno</Pill>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-400">
                    {index + 1} visitas · ultima {formatShortDate(client.updated_at)}
                  </p>
                </div>
                <ChevronRight className="shrink-0 text-slate-300" size={20} />
              </button>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function recentClients(clients: Client[]) {
  const now = new Date();

  return clients.filter((client) => {
    const updatedAt = new Date(client.updated_at);
    return updatedAt.getMonth() === now.getMonth() && updatedAt.getFullYear() === now.getFullYear();
  }).length;
}
