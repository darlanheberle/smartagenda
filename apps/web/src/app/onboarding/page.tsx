"use client";

import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Link2,
  LockKeyhole,
  MessageCircle,
  Settings2,
  Smartphone,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type CreatedProfessional = {
  professional?: {
    id?: string;
    name?: string;
    evolution_instance_name?: string;
    evolutionInstanceName?: string;
    gmail?: string;
  };
  status?: {
    ready?: boolean;
    googleConnected?: boolean;
    whatsappConnected?: boolean;
    servicesConfigured?: boolean;
    availabilityConfigured?: boolean;
  };
};

type EvolutionStep = {
  status?: string;
  statusCode?: number;
  data?: {
    pairingCode?: string | null;
    code?: string;
    base64?: string;
    qrcode?: {
      pairingCode?: string | null;
      code?: string;
      base64?: string;
    };
  };
  error?: unknown;
};

type WhatsappPrepareResult = {
  instanceName?: string;
  created?: EvolutionStep;
  webhook?: EvolutionStep;
  connection?: EvolutionStep;
};

type OnboardingConflict = {
  status?: string;
  message?: string;
  gmail?: string;
  whatsappNumber?: string;
  professionalId?: string;
  professionalName?: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [gmail, setGmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preparingWhatsapp, setPreparingWhatsapp] = useState(false);
  const [whatsappPrepared, setWhatsappPrepared] = useState(false);
  const [whatsappResult, setWhatsappResult] = useState<WhatsappPrepareResult | undefined>();
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<OnboardingConflict | undefined>();
  const [created, setCreated] = useState<CreatedProfessional | undefined>();

  const professionalId = created?.professional?.id;
  const evolutionInstance =
    created?.professional?.evolution_instance_name || created?.professional?.evolutionInstanceName;
  const googleUrl = professionalId
    ? `${apiUrl}/integrations/google/start?professionalId=${professionalId}`
    : "";
  const whatsappPrepareUrl = professionalId
    ? `${apiUrl}/onboarding/${professionalId}/whatsapp/prepare`
    : "";
  const statusUrl = professionalId ? `${apiUrl}/onboarding/${professionalId}/status` : "";
  const checklist = useMemo(
    () => [
      {
        icon: <UserRound size={16} />,
        title: "Dados profissionais",
        text: "Nome, area de atendimento, WhatsApp e Gmail.",
        done: Boolean(created)
      },
      {
        icon: <CalendarCheck size={16} />,
        title: "Google Agenda",
        text: "O profissional autoriza a agenda do Gmail informado.",
        done: Boolean(created?.status?.googleConnected)
      },
      {
        icon: <Smartphone size={16} />,
        title: "WhatsApp",
        text: "A instancia Evolution e preparada para conectar o telefone.",
        done: Boolean(created?.status?.whatsappConnected)
      },
      {
        icon: <Settings2 size={16} />,
        title: "Padroes iniciais",
        text: "Consulta de 60 minutos e horarios de segunda a sexta.",
        done: Boolean(created?.status?.servicesConfigured && created?.status?.availabilityConfigured)
      }
    ],
    [created]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setConflict(undefined);

    try {
      if (password !== passwordConfirmation) {
        throw new Error("As senhas informadas nao conferem.");
      }

      const response = await fetch(`${apiUrl}/onboarding/professionals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          specialty,
          whatsappNumber,
          gmail,
          password,
          timezone: "America/Sao_Paulo",
          appointmentDurationMinutes: 60
        })
      });

      if (!response.ok) {
        const responseText = await response.text();
        const payload = parseJson(responseText);

        if (response.status === 409 && payload) {
          setConflict(normalizeConflict(payload));
          return;
        }

        throw new Error(responseText || "Nao foi possivel criar o onboarding.");
      }

      setCreated((await response.json()) as CreatedProfessional);
      setWhatsappPrepared(false);
      setWhatsappResult(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel criar o onboarding.");
    } finally {
      setLoading(false);
    }
  }

  async function prepareWhatsapp() {
    if (!professionalId) {
      return;
    }

    setPreparingWhatsapp(true);
    setError("");

    try {
      const response = await fetch(whatsappPrepareUrl, {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = (await response.json()) as WhatsappPrepareResult;
      setWhatsappResult(result);
      setWhatsappPrepared(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel preparar o WhatsApp.");
    } finally {
      setPreparingWhatsapp(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-5 text-[var(--ink)] md:px-8 md:py-7">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[420px_1fr]">
        <aside className="surface h-fit rounded-lg p-5 lg:sticky lg:top-7">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[var(--brand)] text-white">
              <CalendarCheck size={21} />
            </div>
            <div>
              <p className="text-lg font-semibold">SmartAgenda</p>
              <p className="text-xs text-[var(--ink-muted)]">Configuracao inicial</p>
            </div>
          </div>

          <div className="mt-8">
            <p className="eyebrow">Nova conta</p>
            <h1 className="mt-1 text-2xl font-semibold text-balance">Prepare sua agenda inteligente</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-secondary)] text-pretty">
              Cadastre os dados do profissional para preparar WhatsApp, Google Agenda, servicos e horarios iniciais.
            </p>
          </div>

          <div className="mt-6 space-y-2">
            {checklist.map((step) => (
              <div className="flex items-start gap-3 rounded-md bg-[var(--surface-subtle)] px-3 py-3" key={step.title}>
                <div className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-[var(--brand)] shadow-sm">
                  {step.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{step.title}</p>
                    <StatusBadge done={step.done} />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <Link className="btn-secondary mt-5 w-full" href="/login">
            Ja tenho uma conta
          </Link>
        </aside>

        <section className="space-y-6">
          <form className="surface rounded-lg p-5" onSubmit={handleSubmit}>
            <div className="mb-5 flex flex-col gap-2 border-b border-black/10 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-[15px] font-semibold">Dados do profissional</h2>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">Esses dados criam a conta operacional do atendimento.</p>
              </div>
              {created ? (
                <span className="w-fit rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-medium text-[var(--brand)]">
                  Cadastro criado
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome do profissional" htmlFor="name">
                <input
                  className="input"
                  id="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: Sara"
                  required
                  value={name}
                />
              </Field>
              <Field label="Especialidade" htmlFor="specialty">
                <input
                  className="input"
                  id="specialty"
                  onChange={(event) => setSpecialty(event.target.value)}
                  placeholder="Ex: Dentista"
                  required
                  value={specialty}
                />
              </Field>
              <Field label="WhatsApp" htmlFor="whatsapp">
                <input
                  className="input"
                  id="whatsapp"
                  inputMode="tel"
                  onChange={(event) => setWhatsappNumber(event.target.value)}
                  placeholder="5548999999999"
                  required
                  value={whatsappNumber}
                />
              </Field>
              <Field label="Gmail da agenda" htmlFor="gmail">
                <input
                  className="input"
                  id="gmail"
                  inputMode="email"
                  onChange={(event) => setGmail(event.target.value)}
                  placeholder="profissional@gmail.com"
                  required
                  type="email"
                  value={gmail}
                />
              </Field>
              <Field label="Criar senha" htmlFor="password">
                <div className="relative">
                  <input
                    autoComplete="new-password"
                    className="input pr-11"
                    id="password"
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
              <Field label="Confirmar senha" htmlFor="password-confirmation">
                <input
                  autoComplete="new-password"
                  className="input"
                  id="password-confirmation"
                  minLength={8}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirmation}
                />
              </Field>
            </div>

            {error ? (
              <p className="mt-4 rounded-md bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            {conflict ? <ConflictNotice conflict={conflict} /> : null}

            <button
              className="btn-primary mt-5"
              disabled={loading}
              type="submit"
            >
              {loading ? "Criando..." : "Criar configuracao inicial"}
              {loading ? <LockKeyhole size={16} /> : <ArrowRight size={16} />}
            </button>
          </form>

          <section className="surface rounded-lg p-5">
            <div className="mb-5 border-b border-black/10 pb-4">
              <h2 className="text-[15px] font-semibold">Proximos passos</h2>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">Depois do cadastro, conclua as duas conexoes autorizadas pelo usuario.</p>
            </div>

            {created ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Info label="Professional ID" value={professionalId || "-"} />
                  <Info label="Instancia Evolution" value={evolutionInstance || "-"} />
                  <Info label="Gmail" value={created.professional?.gmail || gmail || "-"} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ActionLink
                    href={googleUrl}
                    icon={<Link2 size={16} />}
                    label="Conectar Google Agenda"
                    text="Autorize o Gmail informado para consultar horarios e criar eventos."
                  />
                  <ActionButton
                    done={whatsappPrepared}
                    icon={<MessageCircle size={16} />}
                    label={preparingWhatsapp ? "Gerando QR..." : "Preparar e gerar QR"}
                    onClick={prepareWhatsapp}
                    text="Prepara a instancia Evolution e mostra o QR nesta pagina."
                  />
                  <ActionLink
                    href={statusUrl}
                    icon={<CheckCircle2 size={16} />}
                    label="Ver status"
                    text="Confirme se Google, WhatsApp, servicos e horarios estao prontos."
                  />
                  <ActionLink
                    href="/admin"
                    icon={<Settings2 size={16} />}
                    label="Configurar servicos e horarios"
                    text="Cadastre servicos, precos e regras de atendimento do profissional."
                  />
                </div>

                {whatsappResult ? <WhatsappResult result={whatsappResult} /> : null}
              </div>
            ) : (
              <div className="rounded-md bg-[var(--surface-subtle)] px-4 py-9 text-center">
                <Clock3 className="mx-auto text-[var(--ink-muted)]" size={26} />
                <p className="mt-3 font-medium">Aguardando cadastro</p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  Preencha os dados para liberar os links de conexao.
                </p>
              </div>
            )}
          </section>

          <footer className="flex flex-wrap gap-3 px-1 text-xs text-[var(--ink-muted)]">
            <a className="hover:text-[var(--brand)]" href="/privacy">
              Politica de Privacidade
            </a>
            <a className="hover:text-[var(--brand)]" href="/terms">
              Termos de Uso
            </a>
          </footer>
        </section>
      </section>
    </main>
  );
}

function parseJson(value: string): unknown {
  try {
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
}

function normalizeConflict(payload: unknown): OnboardingConflict {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const response = payload as { message?: unknown };

  if (response.message && typeof response.message === "object") {
    return response.message as OnboardingConflict;
  }

  return payload as OnboardingConflict;
}

function ConflictNotice({ conflict }: { conflict: OnboardingConflict }) {
  const gmailConflict = conflict.status === "gmail_already_registered";

  return (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <p className="font-medium">{gmailConflict ? "Gmail ja cadastrado" : "Numero ja cadastrado"}</p>
      <p className="mt-1">
        {gmailConflict ? "Este Gmail ja pertence a uma conta SmartAgenda." : "Este WhatsApp ja esta vinculado ao email"}{" "}
        {!gmailConflict ? (
          <span className="font-semibold">{conflict.gmail || "cadastrado anteriormente"}</span>
        ) : null}
      </p>
      {conflict.professionalId ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-amber-800">
            Professional ID: <span className="font-medium">{conflict.professionalId}</span>
          </p>
          <Link
            className="inline-flex w-fit items-center rounded-md bg-white px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-50"
            href={`/login?email=${encodeURIComponent(conflict.gmail || "")}`}
          >
            Entrar na conta
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function WhatsappResult({ result }: { result: WhatsappPrepareResult }) {
  const qrBase64 =
    result.connection?.data?.base64 ||
    result.connection?.data?.qrcode?.base64 ||
    result.created?.data?.qrcode?.base64 ||
    result.created?.data?.base64;
  const pairingCode =
    result.connection?.data?.pairingCode ||
    result.connection?.data?.qrcode?.pairingCode ||
    result.created?.data?.qrcode?.pairingCode ||
    result.created?.data?.pairingCode;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div>
        <div>
          <p className="font-medium text-emerald-900">WhatsApp preparado</p>
          <p className="mt-1 text-sm text-emerald-800">
            A instancia foi preparada e o webhook do SmartAgenda foi configurado.
          </p>
        </div>
      </div>

      {pairingCode ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-white px-3 py-3">
          <p className="text-xs font-medium uppercase text-emerald-700">Codigo de pareamento</p>
          <p className="mt-1 text-2xl font-semibold tracking-normal text-emerald-950">{pairingCode}</p>
        </div>
      ) : null}

      {qrBase64 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
          <img
            alt="QR Code para conectar WhatsApp"
            className="h-44 w-44 rounded-md border border-emerald-200 bg-white p-2"
            src={qrBase64}
          />
          <div className="text-sm leading-6 text-emerald-900">
            <p className="font-medium">Como conectar</p>
            <p className="mt-1">
              Abra o WhatsApp no celular, acesse aparelhos conectados e leia este QR Code. Quando
              conectar, volte em Ver status para confirmar.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-emerald-800">
          A Evolution ainda nao devolveu um QR valido. Aguarde alguns segundos e clique novamente
          em Preparar e gerar QR.
        </p>
      )}
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

function StatusBadge({ done }: { done: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${done ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[var(--surface-inset)] text-[var(--ink-muted)]"}`}>
      {done ? "Pronto" : "Pendente"}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-subtle)] px-3 py-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-[var(--ink)]">{value}</p>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  label,
  text
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  text: string;
}) {
  const isExternal = href.startsWith("http");

  return (
    <a
      className="flex min-h-20 items-start gap-3 rounded-md bg-[var(--surface-subtle)] px-3 py-3 text-[var(--ink-secondary)] hover:bg-[var(--surface-inset)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
      href={href}
      target={isExternal ? "_blank" : undefined}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-[var(--brand)] shadow-sm">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">{text}</span>
      </span>
    </a>
  );
}

function ActionButton({
  done,
  icon,
  label,
  onClick,
  text
}: {
  done?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  text: string;
}) {
  return (
    <button
      className="flex min-h-20 items-start gap-3 rounded-md bg-[var(--surface-subtle)] px-3 py-3 text-left text-[var(--ink-secondary)] hover:bg-[var(--surface-inset)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={label === "Gerando QR..."}
      onClick={onClick}
      type="button"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-[var(--brand)] shadow-sm">
        {icon}
      </span>
      <span>
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          {label}
          {done ? <CheckCircle2 className="text-emerald-600" size={15} /> : null}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">{text}</span>
      </span>
    </button>
  );
}
