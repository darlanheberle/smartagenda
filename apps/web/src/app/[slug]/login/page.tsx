"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

export default function CompanyLoginPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";

  const [company, setCompany] = useState<{ name: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`${apiUrl}/public/company/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("not_found");
        }
        return response.json();
      })
      .then((data) => setCompany(data as { name: string }))
      .catch(() => setNotFound(true));
  }, [slug]);

  async function signIn() {
    setError("");
    if (!email.trim() || !password) {
      setError("Informe e-mail e senha.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password, companySlug: slug })
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      window.location.href = "/home";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel entrar.");
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/60">
        <p className="text-sm font-semibold text-violet-700">SmartAgenda</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-950">
          {notFound ? "Empresa nao encontrada" : company ? company.name : "Entrar"}
        </h1>

        {notFound ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            Verifique o link de acesso da sua empresa.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Entre com seu e-mail e senha para acessar sua agenda.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                E-mail
                <input
                  autoComplete="email"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="você@email.com"
                  type="email"
                  value={email}
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Senha
                <input
                  autoComplete="current-password"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void signIn();
                  }}
                  placeholder="Sua senha"
                  type="password"
                  value={password}
                />
              </label>

              {error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
              ) : null}

              <button
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-200 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                disabled={saving}
                onClick={() => void signIn()}
                type="button"
              >
                {saving ? "Entrando..." : "Entrar"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

async function readMessage(response: Response) {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as { message?: string };
    return payload.message || "Nao foi possivel entrar.";
  } catch {
    return text || "Nao foi possivel entrar.";
  }
}
