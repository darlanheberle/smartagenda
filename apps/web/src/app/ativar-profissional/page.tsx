"use client";

import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

export default function AtivarProfissionalPage() {
  const [token, setToken] = useState("");
  const [info, setInfo] = useState<{ name: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get("token") || "";
    setToken(current);

    if (!current) {
      setError("Link de ativação invalido.");
      setLoading(false);
      return;
    }

    fetch(`${apiUrl}/auth/team-activation?token=${encodeURIComponent(current)}`, {
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readMessage(response));
        }
        return response.json();
      })
      .then((data) => setInfo(data as { name: string; email?: string }))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Link de ativacao invalido ou expirado.")
      )
      .finally(() => setLoading(false));
  }, []);

  async function activate() {
    setError("");

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/auth/team-activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password })
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      window.location.href = "/home";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel ativar o acesso.");
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/60">
        <p className="text-sm font-semibold text-violet-700">SmartAgenda</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-950">Ativar seu acesso</h1>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Carregando...</p>
        ) : error && !info ? (
          <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error} Peca um novo link para a empresa.
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ola{info?.name ? `, ${info.name}` : ""}! Defina uma senha para acessar sua agenda e seus
              clientes.
            </p>
            {info?.email ? (
              <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Seu login será o e-mail <strong>{info.email}</strong>.
              </p>
            ) : null}

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Nova senha
                <input
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  type="password"
                  value={password}
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Confirmar senha
                <input
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void activate();
                  }}
                  placeholder="Repita a senha"
                  type="password"
                  value={confirmPassword}
                />
              </label>

              {error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
              ) : null}

              <button
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-200 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                disabled={saving}
                onClick={() => void activate()}
                type="button"
              >
                {saving ? "Ativando..." : "Ativar acesso e entrar"}
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
    return payload.message || "Nao foi possivel concluir.";
  } catch {
    return text || "Nao foi possivel concluir.";
  }
}
