import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "../lib/format";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`app-card ${className}`}>{children}</section>;
}

export function Pill({
  children,
  tone = "slate"
}: {
  children: ReactNode;
  tone?: "slate" | "violet" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    violet: "bg-violet-50 text-violet-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700"
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Avatar({ index = 0, name, size = "md" }: { index?: number; name: string; size?: "sm" | "md" | "lg" }) {
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-sky-100 text-sky-700"
  ];
  const sizes = {
    sm: "size-10 text-xs",
    md: "size-12 text-sm",
    lg: "size-14 text-base"
  };

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl font-bold ${sizes[size]} ${colors[index % colors.length]}`}
    >
      {initials(name)}
    </span>
  );
}

export function SectionTitle({
  href,
  linkLabel = "ver tudo",
  subtitle,
  title
}: {
  href?: string;
  linkLabel?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-2xl px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          href={href}
        >
          {linkLabel}
          <ChevronRight size={16} />
        </Link>
      ) : null}
    </div>
  );
}

export function IconBox({
  children,
  tone = "violet"
}: {
  children: ReactNode;
  tone?: "violet" | "emerald" | "amber" | "rose" | "slate";
}) {
  const tones = {
    violet: "bg-violet-100 text-violet-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    slate: "bg-slate-100 text-slate-700"
  };

  return <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>{children}</span>;
}
