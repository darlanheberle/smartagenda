import { Injectable } from "@nestjs/common";
import { ProfessionalRegistryService } from "./professional-registry.service";
import { AvailabilityRule, DatabaseService } from "./database.service";
import { Professional } from "../types/professional";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

type BusyInterval = {
  start: string;
  end: string;
};

type CalendarSlot = {
  startsAt: string;
  endsAt: string;
  label: string;
};

@Injectable()
export class CalendarService {
  constructor(
    private readonly professionals: ProfessionalRegistryService,
    private readonly database: DatabaseService
  ) {}

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
      login_hint: professional.gmail,
      include_granted_scopes: "true"
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

    const connection = {
      email: professional.gmail,
      calendarId: "primary",
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : undefined,
      connectedAt: new Date().toISOString()
    };
    await this.database.saveGoogleCalendarConnection(professional.id, connection);
    const connected = this.professionals.connectGoogleCalendar(professional.id, connection);

    return {
      status: "connected",
      professionalId: connected.id,
      gmail: connected.gmail,
      calendarId: connected.googleCalendar?.calendarId,
      nextStep: "Agora a agenda ja pode consultar disponibilidade e criar eventos."
    };
  }

  async getAvailability(professionalId?: string) {
    const professional = await this.loadGoogleCalendarConnection(
      professionalId
      ? this.professionals.getById(professionalId)
      : this.professionals.list()[0]
    );

    if (!professional?.googleCalendar?.accessToken) {
      return this.mockAvailability(professional?.id, "mocked_until_google_connected");
    }

    return this.getAvailabilityForService({ professionalId: professional.id });
  }

  async getAvailabilityForService(input: {
    professionalId: string;
    serviceId?: string;
    startDate?: string;
    daysAhead?: number;
  }) {
    const professional = await this.loadGoogleCalendarConnection(
      this.professionals.getById(input.professionalId)
    );

    const service = input.serviceId
      ? await this.database.getService(professional.id, input.serviceId)
      : (await this.database.listServices(professional.id, true))[0];
    const durationMinutes =
      service?.duration_minutes || professional.appointmentDurationMinutes;

    if (!professional?.googleCalendar?.accessToken) {
      return this.mockAvailability(professional?.id, "mocked_until_google_connected");
    }

    const accessToken = await this.getValidAccessToken(professional.id);
    const now = new Date();
    const searchStart = input.startDate ? new Date(input.startDate) : now;
    const daysAhead =
      input.daysAhead || Number.parseInt(process.env.GOOGLE_AVAILABILITY_DAYS || "21", 10);
    const timeMin = searchStart > now ? searchStart.toISOString() : now.toISOString();
    const timeMax = new Date(
      searchStart.getTime() + daysAhead * 24 * 60 * 60 * 1000
    ).toISOString();

    const response = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
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

    const freeBusy = (await response.json()) as {
      calendars?: Record<string, { busy?: BusyInterval[] }>;
    };
    const busy = freeBusy.calendars?.[professional.googleCalendar.calendarId]?.busy || [];
    const slots = this.buildAvailableSlots({
      busy,
      durationMinutes,
      timezone: professional.timezone,
      searchStart,
      daysAhead,
      rules: await this.database.listAvailabilityRules(professional.id)
    });

    return {
      provider: "google-calendar",
      status: "connected",
      professionalId: professional.id,
      calendarId: professional.googleCalendar.calendarId,
      timezone: professional.timezone,
      service,
      durationMinutes,
      slots,
      busy
    };
  }

  async createEvent(input: {
    professionalId: string;
    clientName: string;
    clientPhone?: string;
    startsAt: string;
    serviceName: string;
    serviceId?: string;
  }) {
    const professional = await this.loadGoogleCalendarConnection(
      this.professionals.getById(input.professionalId)
    );

    if (!professional.googleCalendar?.accessToken) {
      return {
        provider: "google-calendar",
        status: "mocked_until_google_connected",
        eventId: "google-event-demo",
        ...input
      };
    }

    const service = input.serviceId
      ? await this.database.getService(professional.id, input.serviceId)
      : undefined;
    const durationMinutes = service?.duration_minutes || professional.appointmentDurationMinutes;
    const serviceName = service?.name || input.serviceName;
    const valueCents =
      service?.price_cents ?? Number.parseInt(process.env.DEFAULT_APPOINTMENT_VALUE_CENTS || "0", 10);
    const accessToken = await this.getValidAccessToken(professional.id);
    const start = new Date(input.startsAt);
    const end = new Date(
      start.getTime() + durationMinutes * 60 * 1000
    );

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
        professional.googleCalendar.calendarId
      )}/events`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          summary: `${serviceName} - ${input.clientName}`,
          description: input.clientPhone
            ? `Agendamento recebido via WhatsApp: ${input.clientPhone}`
            : "Agendamento recebido via SmartAgenda",
          start: { dateTime: input.startsAt, timeZone: professional.timezone },
          end: { dateTime: end.toISOString(), timeZone: professional.timezone },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 120 },
              { method: "popup", minutes: 24 * 60 }
            ]
          }
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
    const client = await this.database.upsertClient({
      professionalId: professional.id,
      name: input.clientName,
      phone: input.clientPhone
    });
    const appointment = client
      ? await this.database.saveAppointment({
          professionalId: professional.id,
          clientId: client.id,
          googleEventId: event.id,
          googleEventLink: event.htmlLink,
          serviceName,
          startsAt: input.startsAt,
          endsAt: end.toISOString(),
          valueCents,
          source: "whatsapp"
        })
      : undefined;

    return {
      provider: "google-calendar",
      status: "created",
      eventId: event.id,
      htmlLink: event.htmlLink,
      savedAppointmentId: appointment?.id,
      serviceId: service?.id,
      durationMinutes,
      priceCents: valueCents,
      ...input,
      serviceName
    };
  }

  private async getValidAccessToken(professionalId: string): Promise<string> {
    const professional = this.professionals.getById(professionalId);
    const connection = professional.googleCalendar;

    if (!connection?.accessToken) {
      throw new Error("Google Calendar nao conectado.");
    }

    const expiresAt = connection.expiresAt ? new Date(connection.expiresAt).getTime() : 0;
    const hasTimeLeft = expiresAt > Date.now() + 2 * 60 * 1000;

    if (hasTimeLeft || !connection.refreshToken) {
      return connection.accessToken;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return connection.accessToken;
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!response.ok) {
      return connection.accessToken;
    }

    const token = (await response.json()) as {
      access_token: string;
      expires_in?: number;
    };

    this.professionals.updateGoogleCalendar(professional.id, {
      accessToken: token.access_token,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : connection.expiresAt
    });
    await this.database.saveGoogleCalendarConnection(professional.id, {
      ...connection,
      accessToken: token.access_token,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : connection.expiresAt
    });

    return token.access_token;
  }

  private async loadGoogleCalendarConnection(professional: Professional) {
    if (professional.googleCalendar?.accessToken) {
      return professional;
    }

    const connection = await this.database.getGoogleCalendarConnection(professional.id);

    if (!connection) {
      return professional;
    }

    return this.professionals.connectGoogleCalendar(professional.id, connection);
  }

  private buildAvailableSlots(input: {
    busy: BusyInterval[];
    durationMinutes: number;
    timezone: string;
    searchStart: Date;
    daysAhead: number;
    rules: AvailabilityRule[];
  }): CalendarSlot[] {
    const configuredMaxSlots = Number.parseInt(process.env.MAX_AVAILABILITY_SLOTS || "30", 10);
    const maxSlots = Math.max(configuredMaxSlots, input.daysAhead * 24 * 60);
    const slots: CalendarSlot[] = [];
    const now = new Date();
    const searchStart = input.searchStart > now ? input.searchStart : now;

    for (
      let dayOffset = 0;
      dayOffset < input.daysAhead && slots.length < maxSlots;
      dayOffset += 1
    ) {
      const date = new Date(searchStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const parts = this.getDateParts(date, input.timezone);
      const dayOfWeek = this.getDayOfWeek(parts);
      const rule = this.getRuleForWeekday(input.rules, dayOfWeek);

      if (!rule) {
        continue;
      }

      const startMinute = this.timeToMinutes(rule.start_time);
      const endMinute = this.timeToMinutes(rule.end_time);

      if (endMinute <= startMinute) {
        continue;
      }

      const lunchStart = rule.lunch_start ? this.timeToMinutes(rule.lunch_start) : undefined;
      const lunchEnd = rule.lunch_end ? this.timeToMinutes(rule.lunch_end) : undefined;
      const minimumStart = new Date(now.getTime() + rule.minimum_notice_minutes * 60 * 1000);
      const slotStepMinutes =
        rule.slot_interval_minutes && rule.slot_interval_minutes > 0
          ? rule.slot_interval_minutes
          : input.durationMinutes + rule.buffer_minutes;

      let minuteOfDay = startMinute;
      while (
        minuteOfDay + input.durationMinutes <= endMinute &&
        slots.length < maxSlots
      ) {
        const appointmentEndMinute = minuteOfDay + input.durationMinutes;
        if (
          lunchStart !== undefined &&
          lunchEnd !== undefined &&
          minuteOfDay < lunchEnd &&
          appointmentEndMinute > lunchStart
        ) {
          minuteOfDay = lunchEnd;
          continue;
        }

        const hour = Math.floor(minuteOfDay / 60);
        const minute = minuteOfDay % 60;
        const start = this.zonedDateTimeToUtcDate(parts, hour, minute, input.timezone);
        const end = new Date(
          start.getTime() + (input.durationMinutes + rule.buffer_minutes) * 60 * 1000
        );
        const displayEnd = new Date(start.getTime() + input.durationMinutes * 60 * 1000);

        if (start <= minimumStart || this.isSlotBusy(start, end, input.busy)) {
          minuteOfDay += slotStepMinutes;
          continue;
        }

        slots.push({
          startsAt: start.toISOString(),
          endsAt: displayEnd.toISOString(),
          label: this.formatSlotLabel(start, input.timezone)
        });
        minuteOfDay += slotStepMinutes;
      }
    }

    return slots;
  }

  private getRuleForWeekday(rules: AvailabilityRule[], weekday: number) {
    if (rules.length > 0) {
      return rules.find((rule) => rule.weekday === weekday && rule.active);
    }

    if (weekday === 0 || weekday === 6) {
      return undefined;
    }

    return {
      weekday,
      start_time: `${process.env.WORK_START_HOUR || "9"}:00`,
      end_time: `${process.env.WORK_END_HOUR || "18"}:00`,
      lunch_start: null,
      lunch_end: null,
      slot_interval_minutes: null,
      buffer_minutes: 0,
      minimum_notice_minutes: 120,
      active: true
    } as AvailabilityRule;
  }

  private timeToMinutes(time: string) {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + (minute || 0);
  }

  private isSlotBusy(start: Date, end: Date, busy: BusyInterval[]) {
    return busy.some((interval) => {
      const busyStart = new Date(interval.start);
      const busyEnd = new Date(interval.end);
      return start < busyEnd && end > busyStart;
    });
  }

  private getDateParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    return {
      year: Number(parts.find((part) => part.type === "year")?.value),
      month: Number(parts.find((part) => part.type === "month")?.value),
      day: Number(parts.find((part) => part.type === "day")?.value)
    };
  }

  private getDayOfWeek(parts: { year: number; month: number; day: number }) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  }

  private zonedDateTimeToUtcDate(
    parts: { year: number; month: number; day: number },
    hour: number,
    minute: number,
    timezone: string
  ) {
    const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute));
    const zonedParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(utcGuess);
    const actualAsUtc = Date.UTC(
      Number(zonedParts.find((part) => part.type === "year")?.value),
      Number(zonedParts.find((part) => part.type === "month")?.value) - 1,
      Number(zonedParts.find((part) => part.type === "day")?.value),
      Number(zonedParts.find((part) => part.type === "hour")?.value),
      Number(zonedParts.find((part) => part.type === "minute")?.value)
    );
    const desiredAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute);

    return new Date(utcGuess.getTime() + (desiredAsUtc - actualAsUtc));
  }

  private formatSlotLabel(date: Date, timezone: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  private mockAvailability(professionalId?: string, status = "mocked") {
    return {
      provider: "google-calendar",
      status,
      professionalId,
      slots: [
        { startsAt: "2026-06-15T14:00:00-03:00", label: "Segunda 14h" },
        { startsAt: "2026-06-15T15:00:00-03:00", label: "Segunda 15h" },
        { startsAt: "2026-06-16T09:00:00-03:00", label: "Terca 09h" }
      ]
    };
  }
}
