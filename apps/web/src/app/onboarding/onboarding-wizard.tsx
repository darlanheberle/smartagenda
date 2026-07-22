"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  MessageCircle,
  NotebookTabs,
  QrCode,
  RefreshCw,
  Rocket,
  Settings2,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wrench
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type StepId = "account" | "google" | "whatsapp" | "setup" | "complete";

type ProfessionalData = {
  id?: string;
  name?: string;
  gmail?: string;
  whatsappNumber?: string;
  whatsapp_number?: string;
  evolutionInstanceName?: string;
  evolution_instance_name?: string;
};

type OnboardingStatus = {
  professional?: ProfessionalData;
  ready?: boolean;
  googleConnected?: boolean;
  whatsappConnected?: boolean;
  servicesConfigured?: boolean;
  availabilityConfigured?: boolean;
  servicesCount?: number;
  availabilityRulesCount?: number;
};

type CreatedProfessional = {
  professional?: ProfessionalData;
  status?: OnboardingStatus;
};

type EvolutionStep = {
  status?: string;
  data?: unknown;
  error?: unknown;
};

type WhatsappPrepareResult = {
  instanceName?: string;
  created?: EvolutionStep;
  webhook?: EvolutionStep;
  connection?: EvolutionStep;
  onboarding?: OnboardingStatus;
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

const steps: Array<{
  id: StepId;
  title: string;
  shortTitle: string;
  description: string;
  icon: typeof UserRound;
}> = [
  {
    id: "account",
    title: "Crie sua conta",
    shortTitle: "Conta",
    description: "Seus dados profissionais e acesso ao painel.",
    icon: UserRound
  },
  {
    id: "google",
    title: "Conecte o Google Agenda",
    shortTitle: "Agenda",
    description: "O SmartAgenda consulta e cria horarios na sua agenda.",
    icon: CalendarDays
  },
  {
    id: "whatsapp",
    title: "Conecte seu WhatsApp",
    shortTitle: "WhatsApp",
    description: "Use um codigo no celular ou leia o QR Code.",
    icon: MessageCircle
  },
  {
    id: "setup",
    title: "Revise servicos e horarios",
    shortTitle: "Ajustes",
    description: "O sistema prepara um modelo que voce pode editar.",
    icon: Settings2
  },
  {
    id: "complete",
    title: "Tudo pronto",
    shortTitle: "Concluir",
    description: "Seu atendimento automatico pode comecar.",
    icon: Rocket
  }
];

export function OnboardingWizard() {
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState<StepId>("account");
  const [created, setCreated] = useState<CreatedProfessional>();
  const [resuming, setResuming] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState("");

  const status = created?.status;
  const professional = status?.professional || created?.professional;
  const professionalId = professional?.id;
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  const completion = useMemo<Record<StepId, boolean>>(
    () => ({
      account: Boolean(professionalId),
      google: Boolean(status?.googleConnected),
      whatsapp: Boolean(status?.whatsappConnected),
      setup: Boolean(status?.servicesConfigured && status?.availabilityConfigured),
      complete: Boolean(status?.ready)
    }),
    [professionalId, status]
  );

  useEffect(() => {
    void resumeOnboarding();
  }, []);

  async function resumeOnboarding() {
    setResuming(true);

    try {
      const response = await fetch(`${apiUrl}/auth/me`, {
        credentials: "include",
        cache: "no-store"
      });

      if (!response.ok) {
        setCurrentStep("account");
        return;
      }

      const account = (await response.json()) as { professional?: ProfessionalData };
      const id = account.professional?.id;
      if (!id) {
        return;
      }

      const nextStatus = await fetchStatus(id);
      setCreated({ professional: account.professional, status: nextStatus });

      const requestedStep = parseStep(searchParams.get("step"));
      setCurrentStep(requestedStep || firstIncompleteStep(nextStatus));
    } catch {
      setCurrentStep("account");
    } finally {
      setResuming(false);
    }
  }

  async function refreshStatus(options?: { advance?: boolean }) {
    if (!professionalId) {
      return undefined;
    }

    setCheckingStatus(true);
    setError("");

    try {
      const nextStatus = await fetchStatus(professionalId);
      setCreated((current) => ({ ...current, status: nextStatus }));

      if (options?.advance) {
        if (currentStep === "google" && nextStatus.googleConnected) {
          setCurrentStep("whatsapp");
        } else if (currentStep === "whatsapp" && nextStatus.whatsappConnected) {
          setCurrentStep("setup");
        }
      }

      return nextStatus;
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Nao foi possivel verificar agora.");
      return undefined;
    } finally {
      setCheckingStatus(false);
    }
  }

  function goToStep(step: StepId) {
    const targetIndex = steps.findIndex((item) => item.id === step);
    const canOpen = targetIndex <= currentIndex || canOpenStep(step, completion);
    if (canOpen) {
      setError("");
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (resuming) {
    return <OnboardingLoading />;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Brand />
          <Link className="app-button-secondary min-h-11 px-3" href="/login">
            Entrar
          </Link>
        </div>
      </header>

      <div className="mx-auto min-h-screen max-w-7xl md:grid md:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-slate-200/80 bg-white px-5 py-6 md:flex md:flex-col">
          <Brand />
          <div className="mt-12">
            <p className="text-xs font-semibold uppercase text-violet-700">Configuracao inicial</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-slate-950">Vamos preparar sua agenda</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Siga uma etapa por vez. Leva apenas alguns minutos.</p>
          </div>
          <nav aria-label="Etapas da configuracao" className="mt-8 space-y-2">
            {steps.map((step, index) => (
              <StepNavigationItem
                active={step.id === currentStep}
                available={index <= currentIndex || canOpenStep(step.id, completion)}
                done={completion[step.id]}
                key={step.id}
                onClick={() => goToStep(step.id)}
                step={step}
              />
            ))}
          </nav>
          <div className="mt-auto rounded-3xl bg-violet-50 p-4">
            <ShieldCheck className="text-violet-700" size={20} />
            <p className="mt-3 text-sm font-semibold text-slate-900">Seus dados ficam protegidos</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Cada profissional possui sua propria agenda, clientes e WhatsApp.</p>
          </div>
        </aside>

        <section className="min-w-0 px-4 pb-12 pt-6 sm:px-6 md:px-10 md:py-10 lg:px-14">
          <div className="mx-auto max-w-3xl">
            <MobileProgress currentIndex={currentIndex} />

            {currentStep === "account" ? (
              <AccountStep
                conflictError={error}
                onCreated={(result) => {
                  setCreated(result);
                  setError("");
                  setCurrentStep("google");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onError={setError}
              />
            ) : null}

            {currentStep === "google" && professionalId ? (
              <GoogleStep
                connected={Boolean(status?.googleConnected)}
                gmail={professional?.gmail || ""}
                googleUrl={`${apiUrl}/integrations/google/start?professionalId=${professionalId}`}
                loading={checkingStatus}
                onBack={() => setCurrentStep("account")}
                onContinue={() => setCurrentStep("whatsapp")}
                onVerify={() => void refreshStatus({ advance: true })}
              />
            ) : null}

            {currentStep === "whatsapp" && professionalId ? (
              <WhatsappStep
                connected={Boolean(status?.whatsappConnected)}
                loadingStatus={checkingStatus}
                onBack={() => setCurrentStep("google")}
                onContinue={() => setCurrentStep("setup")}
                onStatus={(nextStatus) => {
                  setCreated((current) => ({ ...current, status: nextStatus }));
                }}
                onVerify={() => void refreshStatus({ advance: true })}
                professionalId={professionalId}
                whatsappNumber={professional?.whatsappNumber || professional?.whatsapp_number || ""}
              />
            ) : null}

            {currentStep === "setup" && professionalId ? (
              <SetupStep
                availabilityConfigured={Boolean(status?.availabilityConfigured)}
                availabilityCount={status?.availabilityRulesCount || 0}
                loading={checkingStatus}
                onBack={() => setCurrentStep("whatsapp")}
                onContinue={() => setCurrentStep("complete")}
                onVerify={() => void refreshStatus()}
                servicesConfigured={Boolean(status?.servicesConfigured)}
                servicesCount={status?.servicesCount || 0}
              />
            ) : null}

            {currentStep === "complete" ? (
              <CompleteStep name={professional?.name || "Profissional"} ready={Boolean(status?.ready)} />
            ) : null}

            {error && currentStep !== "account" ? <ErrorNotice>{error}</ErrorNotice> : null}

            <footer className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-slate-400">
              <Link className="hover:text-violet-700" href="/privacy">Politica de Privacidade</Link>
              <Link className="hover:text-violet-700" href="/terms">Termos de Uso</Link>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

function AccountStep({
  conflictError,
  onCreated,
  onError
}: {
  conflictError: string;
  onCreated: (result: CreatedProfessional) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [gmail, setGmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState<OnboardingConflict>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setConflict(undefined);
    onError("");

    try {
      if (password !== passwordConfirmation) {
        throw new Error("As senhas nao conferem. Digite novamente.");
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
        throw new Error(readApiMessage(responseText, "Nao foi possivel criar sua conta."));
      }

      onCreated((await response.json()) as CreatedProfessional);
    } catch (submitError) {
      onError(submitError instanceof Error ? submitError.message : "Nao foi possivel criar sua conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepCard icon={<UserRound size={22} />} step="Etapa 1 de 5" subtitle="Preencha somente os dados usados no seu atendimento." title="Crie sua conta profissional">
      <div className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Use o Gmail que possui a agenda do profissional e o numero de WhatsApp que atendera os clientes.
      </div>
      <form className="mt-6 space-y-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field hint="Como seus clientes conhecem voce." label="Nome do profissional" htmlFor="name">
            <input className="app-input" id="name" onChange={(event) => setName(event.target.value)} placeholder="Ex: Sara" required value={name} />
          </Field>
          <Field hint="Sua area principal de atendimento." label="Especialidade" htmlFor="specialty">
            <input className="app-input" id="specialty" onChange={(event) => setSpecialty(event.target.value)} placeholder="Ex: Dentista" required value={specialty} />
          </Field>
          <Field hint="Inclua DDD. Exemplo: 5548999999999." label="WhatsApp profissional" htmlFor="whatsapp">
            <input className="app-input" id="whatsapp" inputMode="tel" onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="5548999999999" required value={whatsappNumber} />
          </Field>
          <Field hint="Precisa ser a conta da agenda que sera usada." label="Gmail da agenda" htmlFor="gmail">
            <input className="app-input" id="gmail" inputMode="email" onChange={(event) => setGmail(event.target.value)} placeholder="profissional@gmail.com" required type="email" value={gmail} />
          </Field>
          <Field hint="Use pelo menos 8 caracteres." label="Crie uma senha" htmlFor="password">
            <div className="relative">
              <input autoComplete="new-password" className="app-input pr-12" id="password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? "text" : "password"} value={password} />
              <button aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 hover:text-slate-700" onClick={() => setShowPassword((current) => !current)} type="button">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <Field hint="Repita a mesma senha." label="Confirme a senha" htmlFor="password-confirmation">
            <input autoComplete="new-password" className="app-input" id="password-confirmation" minLength={8} onChange={(event) => setPasswordConfirmation(event.target.value)} required type={showPassword ? "text" : "password"} value={passwordConfirmation} />
          </Field>
        </div>

        {conflictError ? <ErrorNotice>{conflictError}</ErrorNotice> : null}
        {conflict ? <ConflictNotice conflict={conflict} /> : null}

        <button className="app-button-primary w-full sm:w-auto" disabled={loading} type="submit">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
          {loading ? "Criando sua conta..." : "Criar conta e continuar"}
        </button>
      </form>
    </StepCard>
  );
}

function GoogleStep({ connected, gmail, googleUrl, loading, onBack, onContinue, onVerify }: {
  connected: boolean;
  gmail: string;
  googleUrl: string;
  loading: boolean;
  onBack: () => void;
  onContinue: () => void;
  onVerify: () => void;
}) {
  return (
    <StepCard icon={<CalendarDays size={22} />} step="Etapa 2 de 5" subtitle="Assim os horarios ocupados nunca serao oferecidos aos clientes." title="Conecte seu Google Agenda">
      {connected ? (
        <SuccessPanel title="Google Agenda conectado">A conta {gmail} ja pode consultar horarios e criar compromissos.</SuccessPanel>
      ) : (
        <>
          <div className="space-y-3">
            <Instruction number={1} title="Toque em Conectar Google Agenda">Uma pagina segura do Google sera aberta.</Instruction>
            <Instruction number={2} title={`Escolha ${gmail}`}>Confirme a conta que possui sua agenda profissional.</Instruction>
            <Instruction number={3} title="Autorize o acesso">O SmartAgenda usa apenas o necessario para consultar e criar eventos.</Instruction>
          </div>
          <a className="app-button-primary mt-6 w-full sm:w-auto" href={googleUrl}>
            <CalendarDays size={18} />
            Conectar Google Agenda
            <ExternalLink size={16} />
          </a>
          <p className="mt-3 text-xs leading-5 text-slate-400">Voce voltara automaticamente para esta etapa depois de autorizar.</p>
        </>
      )}
      <StepActions
        continueDisabled={!connected}
        continueLabel="Continuar para WhatsApp"
        loading={loading}
        onBack={onBack}
        onContinue={onContinue}
        onVerify={!connected ? onVerify : undefined}
      />
    </StepCard>
  );
}

function WhatsappStep({ connected, loadingStatus, onBack, onContinue, onStatus, onVerify, professionalId, whatsappNumber }: {
  connected: boolean;
  loadingStatus: boolean;
  onBack: () => void;
  onContinue: () => void;
  onStatus: (status: OnboardingStatus) => void;
  onVerify: () => void;
  professionalId: string;
  whatsappNumber: string;
}) {
  const [preparing, setPreparing] = useState(false);
  const [result, setResult] = useState<WhatsappPrepareResult>();
  const [method, setMethod] = useState<"code" | "qr">("code");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const pairingCode = findEvolutionValue(result, ["pairingCode", "pairing_code"]);
  const qrBase64 = findEvolutionValue(result, ["base64"]);

  async function prepareWhatsapp() {
    setPreparing(true);
    setError("");
    setCopied(false);

    try {
      const response = await fetch(`${apiUrl}/onboarding/${professionalId}/whatsapp/prepare`, {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(readApiMessage(await response.text(), "Nao foi possivel gerar a conexao."));
      }

      const nextResult = (await response.json()) as WhatsappPrepareResult;
      setResult(nextResult);
      if (nextResult.onboarding) {
        onStatus(nextResult.onboarding);
      }
      const code = findEvolutionValue(nextResult, ["pairingCode", "pairing_code"]);
      setMethod(code ? "code" : "qr");
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Nao foi possivel gerar a conexao.");
    } finally {
      setPreparing(false);
    }
  }

  async function copyCode() {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopied(true);
    } catch {
      setError("Nao foi possivel copiar automaticamente. Digite o codigo mostrado no WhatsApp.");
    }
  }

  return (
    <StepCard icon={<MessageCircle size={22} />} step="Etapa 3 de 5" subtitle={`Vamos vincular o numero ${whatsappNumber || "informado no cadastro"}.`} title="Conecte seu WhatsApp">
      {connected ? (
        <SuccessPanel title="WhatsApp conectado">O numero esta pronto para receber mensagens e usar o assistente.</SuccessPanel>
      ) : (
        <>
          <div className="rounded-3xl bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">Voce pode conectar usando apenas este celular</p>
            <p className="mt-1 text-sm leading-6 text-emerald-800">O codigo de pareamento evita precisar abrir o QR Code em outro aparelho.</p>
          </div>

          {!result ? (
            <button className="app-button-primary mt-6 w-full sm:w-auto" disabled={preparing} onClick={() => void prepareWhatsapp()} type="button">
              {preparing ? <Loader2 className="animate-spin" size={18} /> : <Smartphone size={18} />}
              {preparing ? "Preparando conexao..." : "Gerar codigo de conexao"}
            </button>
          ) : (
            <div className="mt-6">
              <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Forma de conectar WhatsApp">
                <button aria-selected={method === "code"} className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${method === "code" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`} disabled={!pairingCode} onClick={() => setMethod("code")} role="tab" type="button">
                  <Smartphone className="mr-2 inline" size={17} />Codigo
                </button>
                <button aria-selected={method === "qr"} className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${method === "qr" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`} disabled={!qrBase64} onClick={() => setMethod("qr")} role="tab" type="button">
                  <QrCode className="mr-2 inline" size={17} />QR Code
                </button>
              </div>

              {method === "code" && pairingCode ? (
                <div className="mt-5 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Digite este codigo no WhatsApp</p>
                  <p className="mt-3 break-all font-display text-3xl font-bold text-emerald-700 tabular">{formatPairingCode(pairingCode)}</p>
                  <button className="app-button-secondary mt-4" onClick={() => void copyCode()} type="button">
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                    {copied ? "Codigo copiado" : "Copiar codigo"}
                  </button>
                  <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                    <Instruction number={1} title="Abra o WhatsApp">Toque nos tres pontos ou em Configuracoes.</Instruction>
                    <Instruction number={2} title="Entre em Aparelhos conectados">Depois toque em Conectar um aparelho.</Instruction>
                    <Instruction number={3} title="Escolha Conectar com numero de telefone">Digite o codigo mostrado acima.</Instruction>
                  </div>
                </div>
              ) : null}

              {method === "qr" && qrBase64 ? (
                <div className="mt-5 grid gap-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-[200px_1fr] sm:items-center">
                  <img alt="QR Code para conectar o WhatsApp" className="mx-auto size-48 rounded-2xl bg-white p-2 ring-1 ring-slate-100" src={qrBase64} />
                  <div>
                    <p className="font-semibold text-slate-900">Leia com o WhatsApp</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Abra Aparelhos conectados, toque em Conectar um aparelho e aponte a camera para este QR Code.</p>
                  </div>
                </div>
              ) : null}

              {!pairingCode && qrBase64 ? <p className="mt-3 text-xs leading-5 text-amber-700">A Evolution nao devolveu um codigo desta vez. Use o QR Code ou gere uma nova conexao.</p> : null}

              <button className="app-button-secondary mt-4" disabled={preparing} onClick={() => void prepareWhatsapp()} type="button">
                <RefreshCw className={preparing ? "animate-spin" : ""} size={17} />
                Gerar novo codigo
              </button>
            </div>
          )}

          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        </>
      )}

      <StepActions
        continueDisabled={!connected}
        continueLabel="Continuar para ajustes"
        loading={loadingStatus}
        onBack={onBack}
        onContinue={onContinue}
        onVerify={!connected ? onVerify : undefined}
        verifyLabel="Ja conectei, verificar agora"
      />
    </StepCard>
  );
}

function SetupStep({ availabilityConfigured, availabilityCount, loading, onBack, onContinue, onVerify, servicesConfigured, servicesCount }: {
  availabilityConfigured: boolean;
  availabilityCount: number;
  loading: boolean;
  onBack: () => void;
  onContinue: () => void;
  onVerify: () => void;
  servicesConfigured: boolean;
  servicesCount: number;
}) {
  const setupReady = servicesConfigured && availabilityConfigured;

  return (
    <StepCard icon={<Settings2 size={22} />} step="Etapa 4 de 5" subtitle="Criamos um modelo inicial para voce comecar sem complicacao." title="Revise servicos e horarios">
      <div className="grid gap-4 sm:grid-cols-2">
        <SetupItem count={servicesCount} done={servicesConfigured} href="/servicos" icon={<Wrench size={20} />} label="Servicos cadastrados" text="Defina nome, duracao e preco de cada atendimento." />
        <SetupItem count={availabilityCount} done={availabilityConfigured} href="/agenda" icon={<Clock3 size={20} />} label="Dias configurados" text="Escolha os dias e horarios em que deseja atender." />
      </div>
      <div className="mt-5 rounded-3xl bg-violet-50 p-4 text-sm leading-6 text-slate-600">
        Voce pode concluir agora usando o modelo inicial e alterar servicos ou horarios depois pelo painel.
      </div>
      <StepActions
        continueDisabled={!setupReady}
        continueLabel="Concluir configuracao"
        loading={loading}
        onBack={onBack}
        onContinue={onContinue}
        onVerify={!setupReady ? onVerify : undefined}
      />
    </StepCard>
  );
}

function CompleteStep({ name, ready }: { name: string; ready: boolean }) {
  return (
    <StepCard icon={<Rocket size={22} />} step="Etapa 5 de 5" subtitle="A partir de agora voce controla tudo pelo seu painel." title={`Tudo pronto, ${firstName(name)}!`}>
      {ready ? (
        <>
          <div className="rounded-3xl bg-emerald-50 p-6 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-emerald-600 text-white shadow-lg shadow-emerald-200"><CheckCircle2 size={32} /></span>
            <h3 className="mt-5 font-display text-xl font-bold text-slate-950">Seu SmartAgenda esta ativo</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">O WhatsApp pode atender clientes, consultar horarios e criar eventos no seu Google Agenda.</p>
          </div>
          <Link className="app-button-primary mt-6 w-full" href="/home">
            Ir para meu painel
            <ArrowRight size={18} />
          </Link>
        </>
      ) : (
        <div className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="font-semibold">Ainda existe uma etapa pendente</p>
          <p className="mt-1 text-sm leading-6">Volte ao item indicado na barra de progresso e conclua a conexao.</p>
        </div>
      )}
    </StepCard>
  );
}

function StepCard({ children, icon, step, subtitle, title }: { children: ReactNode; icon: ReactNode; step: string; subtitle: string; title: string }) {
  return (
    <article className="app-card overflow-hidden p-5 sm:p-7">
      <header className="border-b border-slate-100 pb-6">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700">{icon}</span>
          <div>
            <p className="text-xs font-semibold uppercase text-violet-700">{step}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-slate-950 text-balance">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 text-pretty">{subtitle}</p>
          </div>
        </div>
      </header>
      <div className="pt-6">{children}</div>
    </article>
  );
}

function StepActions({ continueDisabled, continueLabel, loading, onBack, onContinue, onVerify, verifyLabel = "Ja autorizei, verificar agora" }: {
  continueDisabled: boolean;
  continueLabel: string;
  loading: boolean;
  onBack: () => void;
  onContinue: () => void;
  onVerify?: () => void;
  verifyLabel?: string;
}) {
  return (
    <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button className="app-button-secondary" onClick={onBack} type="button"><ArrowLeft size={17} />Voltar</button>
      {onVerify ? (
        <button className="app-button-primary" disabled={loading} onClick={onVerify} type="button">
          <RefreshCw className={loading ? "animate-spin" : ""} size={17} />
          {loading ? "Verificando..." : verifyLabel}
        </button>
      ) : (
        <button className="app-button-primary" disabled={continueDisabled} onClick={onContinue} type="button">
          {continueLabel}<ArrowRight size={17} />
        </button>
      )}
    </div>
  );
}

function StepNavigationItem({ active, available, done, onClick, step }: { active: boolean; available: boolean; done: boolean; onClick: () => void; step: (typeof steps)[number] }) {
  const Icon = step.icon;
  return (
    <button
      aria-current={active ? "step" : undefined}
      className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 text-left transition ${active ? "bg-violet-600 text-white shadow-lg shadow-violet-200" : available ? "text-slate-600 hover:bg-slate-50" : "cursor-not-allowed text-slate-300"}`}
      disabled={!available}
      onClick={onClick}
      type="button"
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${active ? "bg-white/15" : done ? "bg-emerald-50 text-emerald-600" : "bg-slate-100"}`}>
        {done && !active ? <Check size={17} /> : <Icon size={17} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{step.shortTitle}</span>
        <span className={`mt-0.5 block truncate text-xs ${active ? "text-white/70" : "text-slate-400"}`}>{done ? "Concluido" : step.description}</span>
      </span>
    </button>
  );
}

function MobileProgress({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="mb-6 md:hidden">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>Etapa {currentIndex + 1} de {steps.length}</span>
        <span>{steps[currentIndex]?.shortTitle}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-violet-600 transition-[width]" style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }} />
      </div>
    </div>
  );
}

function Instruction({ children, number, title }: { children: ReactNode; number: number; title: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-slate-50 p-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-600 text-sm font-bold text-white">{number}</span>
      <div><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{children}</p></div>
    </div>
  );
}

function SetupItem({ count, done, href, icon, label, text }: { count: number; done: boolean; href: string; icon: ReactNode; label: string; text: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-white text-violet-700 shadow-sm">{icon}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{done ? "Pronto" : "Pendente"}</span>
      </div>
      <p className="mt-4 font-display text-2xl font-bold tabular text-slate-950">{count}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
      <Link className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-700" href={href} target="_blank">Revisar agora<ExternalLink size={15} /></Link>
    </div>
  );
}

function SuccessPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-3xl bg-emerald-50 p-5 text-emerald-900">
      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={22} /><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-emerald-800">{children}</p></div></div>
    </div>
  );
}

function Field({ children, hint, htmlFor, label }: { children: ReactNode; hint: string; htmlFor: string; label: string }) {
  return (
    <label className="block text-sm font-semibold text-slate-700" htmlFor={htmlFor}>
      {label}<span className="mt-1 block text-xs font-normal leading-5 text-slate-400">{hint}</span><div className="mt-2">{children}</div>
    </label>
  );
}

function ConflictNotice({ conflict }: { conflict: OnboardingConflict }) {
  const gmailConflict = conflict.status === "gmail_already_registered";
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">{gmailConflict ? "Este Gmail ja possui uma conta" : "Este WhatsApp ja esta cadastrado"}</p>
      <p className="mt-1 leading-6">{gmailConflict ? "Entre com sua senha para continuar a configuracao." : <>O numero pertence ao cadastro <strong>{conflict.gmail || "existente"}</strong>.</>}</p>
      <Link className="app-button-secondary mt-4" href={`/login?email=${encodeURIComponent(conflict.gmail || "")}`}>Entrar na conta</Link>
    </div>
  );
}

function ErrorNotice({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">{children}</p>;
}

function Brand() {
  return (
    <Link className="flex min-h-11 items-center gap-3" href="/">
      <span className="grid size-11 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200"><NotebookTabs size={21} /></span>
      <span><span className="block font-display text-base font-bold text-slate-950">SmartAgenda</span><span className="block text-xs text-slate-400">Configuracao guiada</span></span>
    </Link>
  );
}

function OnboardingLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="text-center"><Loader2 className="mx-auto animate-spin text-violet-600" size={28} /><p className="mt-4 text-sm font-medium text-slate-500">Verificando sua configuracao...</p></div>
    </main>
  );
}

function parseStep(value: string | null): StepId | undefined {
  return steps.some((step) => step.id === value) ? (value as StepId) : undefined;
}

function canOpenStep(step: StepId, completion: Record<StepId, boolean>) {
  if (step === "account") return true;
  if (step === "google") return completion.account;
  if (step === "whatsapp") return completion.account && completion.google;
  if (step === "setup") return completion.account && completion.google && completion.whatsapp;
  return completion.account && completion.google && completion.whatsapp && completion.setup;
}

function firstIncompleteStep(status?: OnboardingStatus): StepId {
  if (!status?.googleConnected) return "google";
  if (!status.whatsappConnected) return "whatsapp";
  if (!status.servicesConfigured || !status.availabilityConfigured) return "setup";
  return "complete";
}

async function fetchStatus(professionalId: string) {
  const response = await fetch(`${apiUrl}/onboarding/${professionalId}/status`, {
    credentials: "include",
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(readApiMessage(await response.text(), "Nao foi possivel verificar sua configuracao."));
  }
  return (await response.json()) as OnboardingStatus;
}

function findEvolutionValue(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  for (const nested of Object.values(record)) {
    const found = findEvolutionValue(nested, keys);
    if (found) return found;
  }
  return undefined;
}

function formatPairingCode(value: string) {
  return value.replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") || value;
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function parseJson(value: string): unknown {
  try { return value ? JSON.parse(value) : undefined; } catch { return undefined; }
}

function normalizeConflict(payload: unknown): OnboardingConflict {
  if (!payload || typeof payload !== "object") return {};
  const response = payload as { message?: unknown };
  return response.message && typeof response.message === "object" ? response.message as OnboardingConflict : payload as OnboardingConflict;
}

function readApiMessage(value: string, fallback: string) {
  const payload = parseJson(value) as { message?: string | { message?: string } } | undefined;
  if (typeof payload?.message === "string") return payload.message;
  if (payload?.message && typeof payload.message.message === "string") return payload.message.message;
  return value || fallback;
}
