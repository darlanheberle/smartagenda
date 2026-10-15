"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Card, Pill, SectionTitle } from "../components/ui";
import { formatCurrency } from "../lib/format";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

type Item = {
  serviceName: string;
  clientName: string | null;
  startsAt: string;
  valueCents: number;
  commissionPercent: number;
  professionalCents: number;
};

type Group = {
  teamMemberId: string | null;
  teamMemberName: string;
  count: number;
  totalCents: number;
  professionalCents: number;
  companyCents: number;
  items: Item[];
};

type Report = {
  from: string;
  to: string;
  totals: { count: number; totalCents: number; professionalCents: number; companyCents: number };
  professionals: Group[];
};

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function firstDayOfMonth() {
  return `${todayKey().slice(0, 8)}01`;
}

export function Producao({ role }: { role: "owner" | "team_member" }) {
  const isOwner = role === "owner";
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayKey());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  // Por padrao os profissionais ficam recolhidos (so nome + totais).
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) =>
    setExpanded((current) => ({ ...current, [key]: !current[key] }));

  const load = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/reports/production?from=${start}&to=${end}`, {
        cache: "no-store",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("falha");
      }
      setReport((await response.json()) as Report);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(from, to);
  }, [from, to, load]);

  const totals = report?.totals;
  const headlineCents = (isOwner ? totals?.companyCents : totals?.professionalCents) ?? 0;
  const hasData = report && report.professionals.length > 0;

  return (
    <Card className="p-5">
      <SectionTitle
        subtitle={
          isOwner
            ? "Serviços concluídos no período, com a parte de cada profissional e da empresa."
            : "Seus serviços concluídos no período e quanto você tem a receber."
        }
        title={isOwner ? "Produção por profissional" : "Minha produção"}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-500">
          De
          <input
            className="app-input mt-1 min-h-12"
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-500">
          Até
          <input
            className="app-input mt-1 min-h-12"
            min={from}
            onChange={(event) => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </label>
      </div>

      <div
        className="mt-4 rounded-3xl p-5 text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9, #4f46e5)" }}
      >
        <p className="text-sm font-semibold text-white/80">
          {isOwner ? "A receber (empresa)" : "A receber no período"}
        </p>
        <p className="mt-2 font-display text-4xl font-bold tabular">{formatCurrency(headlineCents / 100)}</p>
        <p className="mt-1 text-sm text-white/70">
          {loading
            ? "Carregando..."
            : `${totals?.count ?? 0} serviço${(totals?.count ?? 0) === 1 ? "" : "s"} concluído${(totals?.count ?? 0) === 1 ? "" : "s"}`}
        </p>
      </div>

      {isOwner && hasData ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Total label="Total do período" value={totals?.totalCents ?? 0} tone="slate" />
          <Total label="Profissionais" value={totals?.professionalCents ?? 0} tone="violet" />
          <Total label="Empresa" value={totals?.companyCents ?? 0} tone="emerald" />
        </div>
      ) : null}

      {hasData ? (
        isOwner ? (
          <div className="mt-5 space-y-3">
            {report!.professionals.map((group) => {
              const key = group.teamMemberId || "none";
              const isOpen = Boolean(expanded[key]);

              return (
                <div className="rounded-3xl bg-slate-50 p-4" key={key}>
                  <button
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    onClick={() => toggleGroup(key)}
                    type="button"
                  >
                    <p className="font-semibold text-slate-950">{group.teamMemberName}</p>
                    <span className="flex items-center gap-2">
                      <Pill tone="violet">
                        {group.count} servico{group.count === 1 ? "" : "s"}
                      </Pill>
                      <ChevronDown
                        className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        size={20}
                      />
                    </span>
                  </button>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <MiniTotal label="Total" value={group.totalCents} />
                    <MiniTotal label="Profissional" value={group.professionalCents} highlight />
                    <MiniTotal label="Empresa" value={group.companyCents} />
                  </div>
                  {isOpen ? (
                    <div className="mt-3 space-y-1.5">
                      {group.items.map((item, index) => (
                        <ItemRow item={item} key={index} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 space-y-1.5">
            {report!.professionals.flatMap((group) => group.items).map((item, index) => (
              <ItemRow item={item} key={index} showShare />
            ))}
          </div>
        )
      ) : (
        <div className="mt-4 rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          {loading ? "Carregando..." : "Nenhum serviço concluído neste período."}
        </div>
      )}
    </Card>
  );
}

function ItemRow({ item, showShare = false }: { item: Item; showShare?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800">{item.serviceName}</p>
        <p className="truncate text-xs text-slate-400">
          {formatDate(item.startsAt)}
          {item.clientName ? ` · ${item.clientName}` : ""} · {item.commissionPercent}%
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold tabular text-slate-800">{formatCurrency(item.valueCents / 100)}</p>
        <p className="text-xs font-semibold text-violet-700">
          {showShare ? "você: " : ""}
          {formatCurrency(item.professionalCents / 100)}
        </p>
      </div>
    </div>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone: "slate" | "violet" | "emerald" }) {
  const color =
    tone === "violet" ? "text-violet-700" : tone === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-3xl bg-slate-50 p-3 text-center">
      <p className={`font-display text-lg font-bold tabular ${color}`}>{formatCurrency(value / 100)}</p>
      <p className="mt-1 text-[11px] font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function MiniTotal({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className={`font-semibold tabular ${highlight ? "text-violet-700" : "text-slate-800"}`}>
        {formatCurrency(value / 100)}
      </p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}
