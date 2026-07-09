import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardView } from "./components/dashboard-view";

export const dynamic = "force-dynamic";

type Dashboard = {
  appointments: number;
  pending: number;
  completed: number;
  cancellations: number;
  expectedRevenue: number;
  pendingRevenue: number;
};

type Client = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  updated_at: string;
};

type Appointment = {
  id: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  value_cents: number;
  payment_status: string;
  google_event_link?: string;
  client_name?: string;
  client_phone?: string;
};

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
};

type OnboardingStatus = {
  professional?: {
    id: string;
    name: string;
    whatsappNumber: string;
    evolutionInstanceName: string;
    gmail: string;
    whatsappStatus: string;
  };
  googleConnected: boolean;
  whatsappConnected: boolean;
  servicesConfigured: boolean;
  availabilityConfigured: boolean;
  servicesCount: number;
  availabilityRulesCount: number;
  ready: boolean;
};

type AccountProfessional = {
  id: string;
  name: string;
  specialty?: string;
  gmail: string;
  whatsappNumber: string;
};

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

export default async function Home() {
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
  const googleConnectUrl = `${apiUrl}/integrations/google/start?professionalId=${professionalId}`;
  const [dashboard, clients, appointments, services, onboarding] = await Promise.all([
    fetchJson<Dashboard>(`/dashboard/today`, {
      appointments: 0,
      pending: 0,
      completed: 0,
      cancellations: 0,
      expectedRevenue: 0,
      pendingRevenue: 0
    }, cookieHeader),
    fetchJson<Client[]>(`/clients`, [], cookieHeader),
    fetchJson<Appointment[]>(`/appointments/upcoming?limit=10`, [], cookieHeader),
    fetchJson<Service[]>(`/services`, [], cookieHeader),
    fetchJson<OnboardingStatus>(`/onboarding/${professionalId}/status`, {
      googleConnected: false,
      whatsappConnected: false,
      servicesConfigured: false,
      availabilityConfigured: false,
      servicesCount: 0,
      availabilityRulesCount: 0,
      ready: false
    }, cookieHeader)
  ]);

  return (
    <DashboardView
      account={account.professional}
      appointments={appointments}
      clients={clients}
      dashboard={dashboard}
      googleConnectUrl={googleConnectUrl}
      onboarding={onboarding}
      services={services}
    />
  );
}
