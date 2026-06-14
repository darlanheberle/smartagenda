import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { AiSchedulingService } from "../services/ai-scheduling.service";
import { CalendarService } from "../services/calendar.service";
import { ProfessionalRegistryService } from "../services/professional-registry.service";
import { EvolutionWebhookPayload } from "../types/integrations";
import { CreateProfessionalInput } from "../types/professional";

@Controller()
export class AppController {
  constructor(
    private readonly aiScheduling: AiSchedulingService,
    private readonly calendar: CalendarService,
    private readonly professionals: ProfessionalRegistryService
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

  @Post("professionals")
  createProfessional(@Body() input: CreateProfessionalInput) {
    return this.professionals.create(input);
  }

  @Get("professionals")
  listProfessionals() {
    return this.professionals.list();
  }

  @Get("professionals/:id")
  getProfessional(@Param("id") id: string) {
    return this.professionals.getById(id);
  }

  @Get("professionals/:id/google/auth-url")
  googleAuthUrl(@Param("id") id: string) {
    return this.calendar.createGoogleAuthUrl(id);
  }

  @Get("integrations/google/callback")
  googleCallback(@Query("code") code: string, @Query("state") state: string) {
    return this.calendar.handleGoogleCallback({ code, state });
  }

  @Get("calendar/availability")
  availability(@Query("professionalId") professionalId?: string) {
    return this.calendar.getAvailability(professionalId);
  }

  @Post("calendar/events")
  createEvent(
    @Body()
    input: {
      professionalId: string;
      clientName: string;
      clientPhone?: string;
      startsAt: string;
      serviceName: string;
    }
  ) {
    return this.calendar.createEvent(input);
  }

  @Post("webhooks/evolution")
  async evolutionWebhook(@Body() payload: EvolutionWebhookPayload) {
    return this.aiScheduling.handleIncomingWhatsAppMessage(payload);
  }
}