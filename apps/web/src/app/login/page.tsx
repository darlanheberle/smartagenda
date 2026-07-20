"use client";

import {
  CalendarCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  Smartphone
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nextPath = safeNextPath(searchParams.get("next"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const payload = await readError(response);
        throw new Error(payload);
      }

      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-6 text-[var(--ink)] md:px-8 md:py-8">
      <section className="surface mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl overflow-hidden rounded-lg lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1fr_440px]">
        <aside className="hidden bg-[var(--ink)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-[var(--brand)]">
                <CalendarCheck size={22} />
              </div>
              <div>
                <p className="text-lg font-semibold">SmartAgenda</p>
                <p className="text-xs text-white/55">Painel do profissional</p>
              </div>
            </div>

            <div className="mt-16 max-w-md">
              <h1 className="max-w-md text-3xl font-semibold text-balance">
                Seu dia organizado antes da primeira mensagem.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/65 text-pretty">
                WhatsApp, horarios, clientes e financeiro no mesmo ritmo da sua Google Agenda.
              </p>
            </div>
            <div className="mt-10 max-w-sm rounded-md bg-white/[0.055] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-semibold uppercase text-white/45">Proximo atendimento</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-2xl font-semibold tabular">09:00</span>
                <span className="h-8 w-px bg-white/15" />
                <span>
                  <span className="block text-sm font-semibold">Agenda sincronizada</span>
                  <span className="block text-xs text-white/50">Google + WhatsApp</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-sm text-white/65">
            <LoginBenefit icon={<ShieldCheck size={17} />} text="Sessao protegida e individual" />
            <LoginBenefit icon={<Smartphone size={17} />} text="WhatsApp vinculado ao profissional" />
            <LoginBenefit icon={<CheckCircle2 size={17} />} text="Dados separados por conta" />
          </div>
        </aside>

        <section className="flex items-center px-5 py-8 sm:px-10">
          <div className="w-full">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="grid size-10 place-items-center rounded-md bg-[var(--brand)] text-white">
                <CalendarCheck size={21} />
              </div>
              <div>
                <p className="text-lg font-semibold">SmartAgenda</p>
                <p className="text-xs text-[var(--ink-muted)]">Painel do profissional</p>
              </div>
            </div>

            <div>
              <p className="eyebrow">Acesso seguro</p>
              <h2 className="mt-1 text-2xl font-semibold text-balance">Entrar na sua conta</h2>
              <p className="mt-2 text-sm text-[var(--ink-secondary)]">
                Use o Gmail e a senha cadastrados no SmartAgenda.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              <Field label="Gmail cadastrado" htmlFor="login-email">
                <input
                  autoComplete="email"
                  className="input"
                  id="login-email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="profissional@gmail.com"
                  required
                  type="email"
                  value={email}
                />
              </Field>

              <Field label="Senha" htmlFor="login-password">
                <div className="relative">
                  <input
                    autoComplete="current-password"
                    className="input pr-11"
                    id="login-password"
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>

              {error ? (
                <p className="rounded-md bg-[var(--danger-soft)] px-3 py-2.5 text-sm font-medium text-[var(--danger)]">
                  {error}
                </p>
              ) : null}

              <button
                className="btn-primary w-full"
                disabled={loading}
                type="submit"
              >
                <LogIn size={17} />
                {loading ? "Entrando..." : "Entrar no painel"}
              </button>
            </form>

            <div className="mt-6 border-t border-black/10 pt-6 text-center">
              <p className="text-sm text-[var(--ink-muted)]">Ainda nao possui cadastro?</p>
              <Link
                className="btn-secondary mt-3 w-full"
                href="/onboarding"
              >
                Criar conta
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function LoginBenefit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 place-items-center rounded-md bg-white/10 text-[#8fd4bb]">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-[var(--ink-secondary)]" htmlFor={htmlFor}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function LoginFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <p className="text-sm text-slate-500">Carregando acesso seguro...</p>
    </main>
  );
}

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/home";
}

async function readError(response: Response) {
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as { message?: string | { message?: string } };
    if (typeof payload.message === "string") {
      return payload.message;
    }
    if (payload.message && typeof payload.message.message === "string") {
      return payload.message.message;
    }
  } catch {
    // Mantem o texto original quando a API nao retorna JSON.
  }

  return text || "Nao foi possivel concluir o acesso.";
}
