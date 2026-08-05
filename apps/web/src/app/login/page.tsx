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
  const [error, setError] = useState(searchParams.get("googleError") || "");
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
                Acesse com sua conta Google ou use a senha cadastrada no SmartAgenda.
              </p>
            </div>

            <a
              className="btn-secondary mt-6 w-full border-black/10 bg-white"
              href={`${apiUrl}/auth/google/start?next=${encodeURIComponent(nextPath)}`}
            >
              <GoogleMark />
              Continuar com Google
            </a>
            <p className="mt-2 text-center text-xs leading-5 text-[var(--ink-muted)]">
              No primeiro acesso, conecta sua conta e o Google Agenda.
            </p>

            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-black/10" />
              <span className="text-[11px] font-semibold uppercase text-[var(--ink-muted)]">ou use sua senha</span>
              <span className="h-px flex-1 bg-black/10" />
            </div>

            <form className="space-y-4" onSubmit={submit}>
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

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
      <path d="M21.6 12.23c0-.71-.06-1.23-.2-1.78H12v3.42h5.52a4.75 4.75 0 0 1-2.05 3.03l2.93 2.27c1.72-1.58 3.2-3.94 3.2-6.94Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.97-.89 6.63-2.42l-3.16-2.68c-.88.59-2 .94-3.47.94-2.6 0-4.81-1.76-5.6-4.12l-3.03 2.34A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.4 13.72A6 6 0 0 1 6.08 12c0-.6.1-1.18.3-1.72L3.34 7.92A10 10 0 0 0 2 12c0 1.47.32 2.86 1.37 4.08l3.03-2.36Z" fill="#FBBC05" />
      <path d="M12 6.16c1.47 0 2.78.5 3.82 1.5l2.87-2.86A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.66 5.92l3.04 2.36C7.18 7.92 9.4 6.16 12 6.16Z" fill="#EA4335" />
    </svg>
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
