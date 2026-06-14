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
