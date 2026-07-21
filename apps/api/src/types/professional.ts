export type GoogleCalendarConnection = {
  email: string;
  calendarId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  connectedAt: string;
};

export type Professional = {
  id: string;
  name: string;
  specialty?: string;
  whatsappNumber: string;
  evolutionInstanceName: string;
  gmail: string;
  timezone: string;
  appointmentDurationMinutes: number;
  aiEnabled?: boolean;
  googleCalendar?: GoogleCalendarConnection;
  logoUrl?: string | null;
  themePrimary?: string | null;
  themePrimaryDark?: string | null;
  themeAccent?: string | null;
  themeBackground?: string | null;
  themeSurface?: string | null;
  themeText?: string | null;
  themeSuccess?: string | null;
  createdAt: string;
};

export type CreateProfessionalInput = {
  id?: string;
  name: string;
  specialty?: string;
  whatsappNumber: string;
  evolutionInstanceName?: string;
  gmail: string;
  timezone?: string;
  appointmentDurationMinutes?: number;
};

export type ProfessionalRecord = {
  id: string;
  name: string;
  specialty?: string | null;
  whatsapp_number: string;
  evolution_instance_name: string;
  gmail: string;
  timezone: string;
  appointment_duration_minutes: number;
  ai_enabled: boolean;
  whatsapp_status: string;
  whatsapp_connected_at?: string | null;
  onboarding_completed_at?: string | null;
  logo_url?: string | null;
  theme_primary?: string | null;
  theme_primary_dark?: string | null;
  theme_accent?: string | null;
  theme_background?: string | null;
  theme_surface?: string | null;
  theme_text?: string | null;
  theme_success?: string | null;
  password_hash?: string | null;
  created_at: string;
  updated_at: string;
};
