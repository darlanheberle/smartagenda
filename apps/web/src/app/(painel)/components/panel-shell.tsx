"use client";

import { Bell, Bot, Calendar, Home, Scissors, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "../../components/logout-button";
import { firstName } from "../lib/format";
import type { AccountProfessional, OnboardingStatus } from "../lib/types";
import { Avatar } from "./ui";

const navItems = [
  { href: "/", icon: Home, label: "Hoje" },
  { href: "/agenda", icon: Calendar, label: "Agenda" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/financeiro", icon: Wallet, label: "Financeiro" },
  { href: "/ia", icon: Bot, label: "IA" }
];

export function PanelShell({
  account,
  children,
  onboarding
}: {
  account: AccountProfessional;
  children: ReactNode;
  onboarding: OnboardingStatus;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="fixed inset-x-0 top-0 z-40 bg-slate-50/95 px-4 py-4 pt-safe backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link className="flex min-h-11 items-center gap-3" href="/">
            <span className="grid size-10 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
              <Scissors size={20} />
            </span>
            <span>
              <span className="block font-display text-base font-bold text-slate-900">SmartAgenda</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              aria-label="Notificacoes"
              className="relative grid size-11 place-items-center rounded-2xl border border-slate-100 bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              type="button"
            >
              <Bell size={18} />
              <span className="absolute right-3 top-3 size-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>
            <Avatar name={account.name} size="sm" />
          </div>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/80 bg-white px-4 py-5 md:flex md:flex-col">
        <Link className="flex min-h-12 items-center gap-3 rounded-3xl px-2" href="/">
          <span className="grid size-12 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
            <Scissors size={22} />
          </span>
          <span>
            <span className="block font-display text-lg font-bold">SmartAgenda</span>
            <span className="block text-xs text-slate-500">Atendimento inteligente</span>
          </span>
        </Link>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition ${
                  active
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2`}
                href={item.href}
                key={item.href}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <Avatar name={account.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{firstName(account.name)}</p>
                <p className="truncate text-xs text-slate-500">{account.gmail}</p>
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="md:pl-64">
        <div className="mx-auto max-w-3xl px-4 pb-32 pt-[104px] md:px-8 md:py-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-safe pt-2 shadow-[0_-18px_40px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                className={`flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition ${
                  active ? "text-violet-700" : "text-slate-500"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2`}
                href={item.href}
                key={item.href}
              >
                <span className={`grid h-9 w-14 place-items-center rounded-2xl ${active ? "bg-violet-50" : ""}`}>
                  <Icon size={19} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
