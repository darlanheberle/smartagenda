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
  googleCalendar?: GoogleCalendarConnection;
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
  whatsapp_status: string;
  whatsapp_connected_at?: string | null;
  onboarding_completed_at?: string | null;
  password_hash?: string | null;
  created_at: string;
  updated_at: string;
};
