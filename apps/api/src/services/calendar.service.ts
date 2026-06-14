import { Injectable } from "@nestjs/common";
import { ProfessionalRegistryService } from "./professional-registry.service";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

@Injectable()
export class CalendarService {
  constructor(private readonly professionals: ProfessionalRegistryService) {}

  createGoogleAuthUrl(professionalId: string) {
    const professional = this.professionals.getById(professionalId);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const scopes =
      process.env.GOOGLE_SCOPES ||
      "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy";

    if (!clientId || !redirectUri) {
      return {
        status: "missing_google_oauth_config",
        professionalId: professional.id,
        message: "Configure GOOGLE_CLIENT_ID e GOOGLE_REDIRECT_URI no .env."
      };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
      state: professional.id,
      login_hint: professional.gmail
    });

    return {
      status: "ready",
      professionalId: professional.id,
      gmail: professional.gmail,
      authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`
    };
  }

  async handleGoogleCallback(input: { code: string; state: string }) {
    const professional = this.professionals.getById(input.state);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return {
        status: "missing_google_oauth_config",
        professionalId: professional.id,
        message: "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI."
      };
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      return {
        status: "google_token_error",
        professionalId: professional.id,
        error: await tokenResponse.text()
      };
    }

    const token = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const connected = this.professionals.connectGoogleCalendar(professional.id, {
      email: professional.gmail,
      calendarId: "primary",
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : undefined,
      connectedAt: new Date().toISOString()
    });

    return {
      status: "connected",
      professionalId: connected.id,
      gmail: connected.gmail,
      calendarId: connected.googleCalendar?.calendarId
    };
  }

  async getAvailability(professionalId?: string) {
    const professional = professionalId
      ? this.professionals.getById(professionalId)
      : this.professionals.list()[0];

    if (!professional?.googleCalendar?.accessToken) {
      return this.mockAvailability(professional?.id, "mocked_until_google_connected");
    }

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${professional.googleCalendar.accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: professional.timezone,
        items: [{ id: professional.googleCalendar.calendarId }]
      })
    });

    if (!response.ok) {
      return {
        ...this.mockAvailability(professional.id, "google_freebusy_error_fallback"),
        googleError: await response.text()
      };
    }

    return {
      provider: "google-calendar",
      status: "connected",
      professionalId: professional.id,
      calendarId: professional.googleCalendar.calendarId,
      busy: await response.json()
    };
  }

  async createEvent(input: {
    professionalId: string;
    clientName: string;
    clientPhone?: string;
    startsAt: string;
    serviceName: string;
  }) {
    const professional = this.professionals.getById(input.professionalId);

    if (!professional.googleCalendar?.accessToken) {
      return {
        provider: "google-calendar",
        status: "mocked_until_google_connected",
        eventId: "google-event-demo",
        ...input
      };
    }

    const start = new Date(input.startsAt);
    const end = new Date(
      start.getTime() + professional.appointmentDurationMinutes * 60 * 1000
    );

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
        professional.googleCalendar.calendarId
      )}/events`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${professional.googleCalendar.accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          summary: `${input.serviceName} - ${input.clientName}`,
          description: input.clientPhone
            ? `Agendamento recebido via WhatsApp: ${input.clientPhone}`
            : "Agendamento recebido via SmartAgenda",
          start: { dateTime: input.startsAt, timeZone: professional.timezone },
          end: { dateTime: end.toISOString(), timeZone: professional.timezone }
        })
      }
    );

    if (!response.ok) {
      return {
        provider: "google-calendar",
        status: "google_create_event_error",
        error: await response.text(),
        ...input
      };
    }

    const event = (await response.json()) as { id: string; htmlLink?: string };

    return {
      provider: "google-calendar",
      status: "created",
      eventId: event.id,
      htmlLink: event.htmlLink,
      ...input
    };
  }

  private mockAvailability(professionalId?: string, status = "mocked") {
    return {
      provider: "google-calendar",
      status,
      professionalId,
      slots: [
        { startsAt: "2026-06-15T14:00:00-03:00", label: "Segunda 14h" },
        { startsAt: "2026-06-15T15:00:00-03:00", label: "Segunda 15h" },
        { startsAt: "2026-06-16T09:00:00-03:00", label: "Terça 09h" }
      ]
    };
  }
}