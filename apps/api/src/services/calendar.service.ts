import { Injectable } from "@nestjs/common";

@Injectable()
export class CalendarService {
  getAvailability() {
    return {
      provider: "google-calendar",
      status: "mocked",
      slots: [
        { startsAt: "2026-06-15T14:00:00-03:00", label: "Segunda 14h" },
        { startsAt: "2026-06-15T15:00:00-03:00", label: "Segunda 15h" },
        { startsAt: "2026-06-16T09:00:00-03:00", label: "Terça 09h" }
      ]
    };
  }

  createEvent(input: { clientName: string; startsAt: string; serviceName: string }) {
    return {
      provider: "google-calendar",
      status: "mocked",
      eventId: "google-event-demo",
      ...input
    };
  }
}
