import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type {
  AccountProfessional,
  Appointment,
  AvailabilityRule,
  Client,
  Dashboard,
  OnboardingStatus,
  PanelData,
  Service,
  TeamMember
} from "./types";

// URL interna (rede Docker) para chamadas servidor->servidor. Evita sair pela
// internet/Traefik (que pode falhar com "fetch failed" no runtime do Next).
// O lado cliente continua usando NEXT_PUBLIC_API_URL (URL publica).
function serverApiUrl() {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3333"
  );
}

function publicApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
}

async function fetchJson<T>(path: string, fallback: T, cookieHeader: string): Promise<T> {
  try {
    const response = await fetch(`${serverApiUrl()}${path}`, {
      cache: "no-store",
      headers: { cookie: cookieHeader }
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function getPanelData(): Promise<PanelData> {
  const apiUrl = publicApiUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  let sessionResponse: Response | undefined;
  try {
    sessionResponse = await fetch(`${serverApiUrl()}/auth/me`, {
      cache: "no-store",
      headers: { cookie: cookieHeader }
    });
  } catch (error) {
    console.error(
      "[getPanelData] /auth/me erro de rede:",
      error instanceof Error ? error.message : error
    );
  }

  if (!sessionResponse?.ok) {
    if (sessionResponse && sessionResponse.status !== 401) {
      console.error("[getPanelData] /auth/me status inesperado:", sessionResponse.status);
    }
    redirect("/login");
  }

  const account = (await sessionResponse.json()) as { professional: AccountProfessional };
  const professionalId = account.professional.id;

  // Profissional da equipe: acesso restrito (so a propria agenda/clientes).
  // Nao carrega dados de administracao (onboarding, equipe, modo equipes).
  if (account.professional.role === "team_member") {
    const [dashboard, clients, appointments, services, availabilityRules] = await Promise.all([
      fetchJson<Dashboard>(
        "/dashboard/today",
        { appointments: 0, pending: 0, completed: 0, cancellations: 0, expectedRevenue: 0, pendingRevenue: 0 },
        cookieHeader
      ),
      fetchJson<Client[]>("/clients", [], cookieHeader),
      fetchJson<Appointment[]>("/appointments/upcoming?limit=100", [], cookieHeader),
      fetchJson<Service[]>("/services", [], cookieHeader),
      fetchJson<AvailabilityRule[]>("/availability-rules", [], cookieHeader)
    ]);

    return {
      account: account.professional,
      apiUrl,
      appointments,
      clients,
      dashboard,
      onboarding: {
        googleConnected: true,
        whatsappConnected: true,
        whatsappSkipped: false,
        servicesConfigured: true,
        availabilityConfigured: true,
        servicesCount: services.length,
        availabilityRulesCount: availabilityRules.length,
        ready: true
      },
      services,
      availabilityRules,
      teamMode: false,
      teamMembers: []
    };
  }

  const [
    dashboard,
    clients,
    appointments,
    services,
    availabilityRules,
    onboarding,
    teamModeResponse,
    teamMembers
  ] = await Promise.all([
    fetchJson<Dashboard>(
      "/dashboard/today",
      {
        appointments: 0,
        pending: 0,
        completed: 0,
        cancellations: 0,
        expectedRevenue: 0,
        pendingRevenue: 0
      },
      cookieHeader
    ),
    fetchJson<Client[]>("/clients", [], cookieHeader),
    fetchJson<Appointment[]>("/appointments/upcoming?limit=100", [], cookieHeader),
    fetchJson<Service[]>("/services", [], cookieHeader),
    fetchJson<AvailabilityRule[]>("/availability-rules", [], cookieHeader),
    fetchJson<OnboardingStatus>(
      `/onboarding/${professionalId}/status`,
      {
        googleConnected: false,
        whatsappConnected: false,
        whatsappSkipped: false,
        servicesConfigured: false,
        availabilityConfigured: false,
        servicesCount: 0,
        availabilityRulesCount: 0,
        ready: false
      },
      cookieHeader
    ),
    fetchJson<{ enabled: boolean }>("/profile/team-mode", { enabled: false }, cookieHeader),
    fetchJson<TeamMember[]>("/team-members", [], cookieHeader)
  ]);

  return {
    account: account.professional,
    apiUrl,
    appointments,
    clients,
    dashboard,
    onboarding,
    services,
    availabilityRules,
    teamMode: teamModeResponse.enabled,
    teamMembers
  };
}
