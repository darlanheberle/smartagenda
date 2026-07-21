export type Dashboard = {
  appointments: number;
  pending: number;
  completed: number;
  cancellations: number;
  expectedRevenue: number;
  pendingRevenue: number;
};

export type Client = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  updated_at: string;
};

export type Appointment = {
  id: string;
  service_name: string;
  starts_at: string;
  ends_at?: string;
  status: string;
  value_cents: number;
  payment_status?: string;
  google_event_link?: string;
  client_name?: string;
  client_phone?: string;
};

export type Service = {
  id: string;
  category?: string | null;
  name: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
};

export type ProfessionalBranding = {
  logoUrl?: string | null;
  themePrimary: string;
  themePrimaryDark: string;
  themeAccent: string;
  themeBackground: string;
  themeSurface: string;
  themeText: string;
  themeSuccess: string;
};

export type AvailabilityRule = {
  id?: string;
  weekday: number;
  start_time: string;
  end_time: string;
  lunch_start?: string | null;
  lunch_end?: string | null;
  slot_interval_minutes?: number | null;
  buffer_minutes: number;
  minimum_notice_minutes: number;
  active: boolean;
};

export type OnboardingStatus = {
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

export type AccountProfessional = {
  id: string;
  name: string;
  specialty?: string;
  gmail: string;
  whatsappNumber: string;
  timezone?: string;
  aiEnabled?: boolean;
  branding?: ProfessionalBranding;
};

export type PanelData = {
  account: AccountProfessional;
  appointments: Appointment[];
  clients: Client[];
  dashboard: Dashboard;
  onboarding: OnboardingStatus;
  services: Service[];
  availabilityRules: AvailabilityRule[];
  apiUrl: string;
};
