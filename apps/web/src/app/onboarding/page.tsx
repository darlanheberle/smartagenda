"use client";

import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Link2,
  MessageCircle,
  Settings2,
  Smartphone,
  UserRound
} from "lucide-react";
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
  const whatsappConnectUrl = professionalId
    ? `${apiUrl}/onboarding/${professionalId}/whatsapp/connect`
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
      const response = await fetch(`${apiUrl}/onboarding/professionals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          specialty,
          whatsappNumber,
          gmail,
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
      const response = await fetch(whatsappPrepareUrl, { method: "POST" });

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
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-ink md:px-8">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[420px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-brand-600 text-white">
              <CalendarCheck size={21} />
            </div>
            <div>
              <p className="text-lg font-semibold">SmartAgenda</p>
              <p className="text-xs text-slate-500">Configuracao inicial</p>
            </div>
          </div>

          <div className="mt-8">
            <h1 className="text-2xl font-semibold tracking-normal">Primeiro acesso</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Cadastre os dados do profissional para preparar WhatsApp, Google Agenda, servicos e horarios iniciais.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {checklist.map((step) => (
              <div className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3" key={step.title}>
                <div className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700">
                  {step.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{step.title}</p>
                    <StatusBadge done={step.done} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="space-y-6">
          <form className="rounded-lg border border-slate-200 bg-white p-5" onSubmit={handleSubmit}>
            <div className="mb-5 flex flex-col gap-2 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">Dados do profissional</h2>
                <p className="text-sm text-slate-500">Esses dados criam a conta operacional do atendimento.</p>
              </div>
              {created ? (
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
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
            </div>

            {error ? (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            {conflict ? <ConflictNotice conflict={conflict} /> : null}

            <button
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Criando..." : "Criar configuracao inicial"}
              <ArrowRight size={16} />
            </button>
          </form>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h2 className="font-semibold">Proximos passos</h2>
              <p className="text-sm text-slate-500">Depois do cadastro, conclua as duas conexoes autorizadas pelo usuario.</p>
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
                    label={preparingWhatsapp ? "Preparando..." : "Preparar WhatsApp"}
                    onClick={prepareWhatsapp}
                    text="Cria/atualiza a instancia Evolution e configura o webhook."
                  />
                  <ActionLink
                    href={whatsappConnectUrl}
                    icon={<Smartphone size={16} />}
                    label="Abrir QR do WhatsApp"
                    text="Use o telefone do profissional para conectar a instancia."
                  />
                  <ActionLink
                    href={statusUrl}
                    icon={<CheckCircle2 size={16} />}
                    label="Ver status"
                    text="Confirme se Google, WhatsApp, servicos e horarios estao prontos."
                  />
                </div>

                {whatsappResult ? (
                  <WhatsappResult
                    connectUrl={whatsappConnectUrl}
                    result={whatsappResult}
                  />
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center">
                <Clock3 className="mx-auto text-slate-400" size={28} />
                <p className="mt-3 font-medium">Aguardando cadastro</p>
                <p className="mt-1 text-sm text-slate-500">
                  Preencha os dados para liberar os links de conexao.
                </p>
              </div>
            )}
          </section>

          <footer className="flex flex-wrap gap-3 px-1 text-xs text-slate-500">
            <a className="hover:text-brand-700" href="/privacy">
              Politica de Privacidade
            </a>
            <a className="hover:text-brand-700" href="/terms">
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
  return (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <p className="font-medium">Numero ja cadastrado</p>
      <p className="mt-1">
        Este WhatsApp ja esta vinculado ao email{" "}
        <span className="font-semibold">{conflict.gmail || "cadastrado anteriormente"}</span>.
      </p>
      {conflict.professionalId ? (
        <p className="mt-1 text-amber-800">
          Professional ID: <span className="font-medium">{conflict.professionalId}</span>
        </p>
      ) : null}
    </div>
  );
}

function WhatsappResult({
  connectUrl,
  result
}: {
  connectUrl: string;
  result: WhatsappPrepareResult;
}) {
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
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-medium text-emerald-900">WhatsApp preparado</p>
          <p className="mt-1 text-sm text-emerald-800">
            A instancia foi preparada e o webhook do SmartAgenda foi configurado.
          </p>
        </div>
        <a
          className="inline-flex w-fit items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50"
          href={connectUrl}
          target="_blank"
        >
          Abrir conexao
        </a>
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
          Se o QR nao aparecer aqui, use o botao Abrir conexao para visualizar a resposta completa
          da Evolution.
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
    <label className="block text-sm font-medium text-slate-700" htmlFor={htmlFor}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function StatusBadge({ done }: { done: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      {done ? "Pronto" : "Pendente"}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value}</p>
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
  return (
    <a
      className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2"
      href={href}
      target="_blank"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="mt-1 block text-sm text-slate-500">{text}</span>
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
      className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3 text-left text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={label === "Preparando..."}
      onClick={onClick}
      type="button"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700">
        {icon}
      </span>
      <span>
        <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
          {label}
          {done ? <CheckCircle2 className="text-emerald-600" size={15} /> : null}
        </span>
        <span className="mt-1 block text-sm text-slate-500">{text}</span>
      </span>
    </button>
  );
}
