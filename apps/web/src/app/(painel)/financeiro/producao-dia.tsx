"use client";

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
  date: string;
  totals: { count: number; totalCents: number; professionalCents: number; companyCents: number };
  professionals: Group[];
};

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function ProducaoDia() {
  const [date, setDate] = useState(todayKey());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/reports/production?date=${day}`, {
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
    void load(date);
  }, [date, load]);

  return (
    <Card className="p-5">
      <SectionTitle
        subtitle="Serviços do dia por profissional, com a parte de cada um."
        title="Produção por profissional"
      />

      <div className="mt-4 flex items-center gap-2">
        <input
          className="app-input min-h-12"
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
        {loading ? <span className="text-sm text-slate-400">Carregando...</span> : null}
      </div>

      {report && report.professionals.length > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Total label="Total do dia" value={report.totals.totalCents} tone="slate" />
            <Total label="Profissionais" value={report.totals.professionalCents} tone="violet" />
            <Total label="Empresa" value={report.totals.companyCents} tone="emerald" />
          </div>

          <div className="mt-5 space-y-3">
            {report.professionals.map((group) => (
              <div className="rounded-3xl bg-slate-50 p-4" key={group.teamMemberId || "none"}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-950">{group.teamMemberName}</p>
                  <Pill tone="violet">
                    {group.count} servico{group.count === 1 ? "" : "s"}
                  </Pill>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <MiniTotal label="Total" value={group.totalCents} />
                  <MiniTotal label="Profissional" value={group.professionalCents} highlight />
                  <MiniTotal label="Empresa" value={group.companyCents} />
                </div>
                <div className="mt-3 space-y-1.5">
                  {group.items.map((item, index) => (
                    <div
                      className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 text-sm"
                      key={index}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{item.serviceName}</p>
                        <p className="truncate text-xs text-slate-400">
                          {formatTime(item.startsAt)}
                          {item.clientName ? ` · ${item.clientName}` : ""} · {item.commissionPercent}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular text-slate-800">
                          {formatCurrency(item.valueCents / 100)}
                        </p>
                        <p className="text-xs font-semibold text-violet-700">
                          {formatCurrency(item.professionalCents / 100)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          {loading ? "Carregando..." : "Nenhum servico neste dia."}
        </div>
      )}
    </Card>
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}
