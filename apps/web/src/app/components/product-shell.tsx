"use client";

import {
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  ContactRound,
  LayoutDashboard,
  Menu,
  Settings2,
  Sparkles,
  X
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LogoutButton } from "./logout-button";

type ProductShellProps = {
  active: "dashboard" | "agenda" | "clientes" | "financeiro" | "settings";
  name: string;
  email: string;
  children: React.ReactNode;
};

const navigation = [
  { label: "Visao geral", href: "/", icon: LayoutDashboard, key: "dashboard" },
  { label: "Agenda", href: "/agenda", icon: CalendarRange, key: "agenda" },
  { label: "Clientes", href: "/clientes", icon: ContactRound, key: "clientes" },
  { label: "Financeiro", href: "/financeiro", icon: CircleDollarSign, key: "financeiro" },
  { label: "Configuracoes", href: "/admin", icon: Settings2, key: "settings" }
];

export function ProductShell({ active, name, email, children }: ProductShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-black/10 bg-[var(--canvas)] px-4 py-5 lg:flex lg:flex-col">
        <Brand />
        <nav className="mt-8 space-y-1" aria-label="Navegacao principal">
          {navigation.map((item) => {
            const Icon = item.icon;
            const selected = item.key === active;

            return (
              <Link
                className={`relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                  selected
                    ? "bg-white text-[var(--ink)] shadow-[0_0_0_1px_var(--line),0_4px_12px_-4px_rgba(23,32,30,0.12)]"
                    : "text-[var(--ink-secondary)] hover:bg-black/[0.035] hover:text-[var(--ink)]"
                }`}
                href={item.href}
                key={item.label}
              >
                {selected ? (
                  <span className="absolute inset-y-1.5 left-1.5 w-1 rounded-full bg-[var(--brand-gradient)]" />
                ) : null}
                <Icon className={selected ? "ml-1.5 text-[var(--brand)]" : ""} size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="relative mb-3 overflow-hidden rounded-2xl px-3.5 py-3.5" style={{ background: "var(--brand-gradient)" }}>
            <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-2 text-xs font-semibold text-white">
              <Sparkles size={14} />
              Assistente ativo
            </div>
            <p className="relative mt-1.5 text-xs leading-5 text-white/80">
              WhatsApp e Google Agenda trabalhando juntos.
            </p>
          </div>
          <Account name={name} email={email} />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="h-full w-[min(84vw,300px)] bg-[var(--canvas)] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Brand />
              <button
                aria-label="Fechar menu"
                className="grid size-10 place-items-center rounded-xl text-[var(--ink-secondary)] hover:bg-black/5"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                <X size={19} />
              </button>
            </div>
            <nav className="mt-7 space-y-1" aria-label="Navegacao principal">
              {navigation.map((item) => {
                const Icon = item.icon;
                const selected = item.key === active;

                return (
                  <Link
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                      selected ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-secondary)]"
                    }`}
                    href={item.href}
                    key={item.label}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className={selected ? "text-[var(--brand)]" : ""} size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-8">
              <Account name={name} email={email} />
            </div>
          </aside>
        </div>
      ) : null}

      <section className="min-w-0 lg:pl-60">
        <div className="flex h-14 items-center justify-between border-b border-black/10 bg-[var(--canvas)] px-4 lg:hidden">
          <Brand compact />
          <button
            aria-label="Abrir menu"
            className="grid size-10 place-items-center rounded-xl text-[var(--ink-secondary)] hover:bg-black/5"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu size={20} />
          </button>
        </div>
        {children}
      </section>
    </main>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="flex items-center gap-3" href="/">
      <span
        className="grid size-9 place-items-center rounded-xl text-white shadow-[0_4px_12px_-2px_rgba(20,122,95,0.5)]"
        style={{ background: "var(--brand-gradient)" }}
      >
        <CalendarDays size={19} />
      </span>
      {!compact ? (
        <span>
          <span className="block text-[15px] font-semibold leading-5 text-[var(--ink)]">SmartAgenda</span>
          <span className="block text-[11px] text-[var(--ink-muted)]">Atendimento inteligente</span>
        </span>
      ) : (
        <span className="text-[15px] font-semibold text-[var(--ink)]">SmartAgenda</span>
      )}
    </Link>
  );
}

function Account({ name, email }: { name: string; email: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="surface rounded-2xl p-2.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--calendar-soft)] text-xs font-bold text-[var(--calendar)]">
          {initials || "SA"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--ink)]">{name}</span>
          <span className="block truncate text-[11px] text-[var(--ink-muted)]">{email}</span>
        </span>
        <LogoutButton compact />
      </div>
    </div>
  );
}
