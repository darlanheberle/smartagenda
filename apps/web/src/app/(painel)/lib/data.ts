import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AccountProfessional, Appointment, Client, Dashboard, OnboardingStatus, PanelData, Service } from "./types";

async function fetchJson<T>(path: string, fallback: T, cookieHeader: string): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

  try {
    const response = await fetch(`${apiUrl}${path}`, {
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
  const cookieHeader = (await cookies()).toString();
  const sessionResponse = await fetch(`${apiUrl}/auth/me`, {
    cache: "no-store",
    headers: { cookie: cookieHeader }
  }).catch(() => undefined);

  if (!sessionResponse?.ok) {
    redirect("/login");
  }

  const account = (await sessionResponse.json()) as { professional: AccountProfessional };
  const professionalId = account.professional.id;
  const [dashboard, clients, appointments, services, onboarding] = await Promise.all([
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
    fetchJson<Appointment[]>("/appointments/upcoming?limit=20", [], cookieHeader),
    fetchJson<Service[]>("/services", [], cookieHeader),
    fetchJson<OnboardingStatus>(
      `/onboarding/${professionalId}/status`,
      {
        googleConnected: false,
        whatsappConnected: false,
        servicesConfigured: false,
        availabilityConfigured: false,
        servicesCount: 0,
        availabilityRulesCount: 0,
        ready: false
      },
      cookieHeader
    )
  ]);

  return {
    account: account.professional,
    apiUrl,
    appointments,
    clients,
    dashboard,
    onboarding,
    services
  };
}
