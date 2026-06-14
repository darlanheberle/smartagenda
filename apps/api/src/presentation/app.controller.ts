import { Body, Controller, Get, Post } from "@nestjs/common";
import { AiSchedulingService } from "../services/ai-scheduling.service";
import { CalendarService } from "../services/calendar.service";
import { EvolutionWebhookPayload } from "../types/integrations";

@Controller()
export class AppController {
  constructor(
    private readonly aiScheduling: AiSchedulingService,
    private readonly calendar: CalendarService
  ) {}

  @Get("health")
  health() {
    return {
      ok: true,
      service: "smartagenda-api"
    };
  }

  @Get("dashboard/today")
  today() {
    return {
      appointments: 8,
      cancellations: 2,
      expectedRevenue: 1840,
      pendingRevenue: 860
    };
  }

  @Get("calendar/availability")
  availability() {
    return this.calendar.getAvailability();
  }

  @Post("webhooks/evolution")
  async evolutionWebhook(@Body() payload: EvolutionWebhookPayload) {
    return this.aiScheduling.handleIncomingWhatsAppMessage(payload);
  }
}
