import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res
} from "@nestjs/common";
import { Response } from "express";
import { AiSchedulingService } from "../services/ai-scheduling.service";
import { CalendarService } from "../services/calendar.service";
import { DatabaseService } from "../services/database.service";
import { EvolutionService } from "../services/evolution.service";
import { ProfessionalRegistryService } from "../services/professional-registry.service";
import { EvolutionWebhookPayload } from "../types/integrations";
import { CreateProfessionalInput, Professional } from "../types/professional";

@Controller()
export class AppController {
  constructor(
    private readonly aiScheduling: AiSchedulingService,
    private readonly calendar: CalendarService,
    private readonly database: DatabaseService,
    private readonly evolution: EvolutionService,
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
  today(@Query("professionalId") professionalId = "demo-professional") {
    const professional = this.professionals.getById(professionalId);
    return this.database.getTodayDashboard(professional.id, professional.timezone);
  }

  @Post("professionals")
  async createProfessional(@Body() input: CreateProfessionalInput) {
    this.validateProfessionalInput(input);
    const professional = this.professionals.create(input);
    const stored = await this.database.upsertProfessional({
      ...input,
      id: professional.id,
      evolutionInstanceName: professional.evolutionInstanceName
    });

    return stored || this.sanitizeProfessional(professional);
  }

  @Get("professionals")
  listProfessionals() {
    return this.professionals.list().map((professional) => this.sanitizeProfessional(professional));
  }

  @Get("professionals/:id")
  getProfessional(@Param("id") id: string) {
    return this.sanitizeProfessional(this.professionals.getById(id));
  }

  @Post("onboarding/professionals")
  async onboardingCreateProfessional(@Body() input: CreateProfessionalInput) {
    const professional = await this.createProfessional(input);
    await this.createDefaultScheduling(professional.id || input.id || "demo-professional");

    return {
      professional,
      status: await this.database.getOnboardingStatus(professional.id || input.id || "demo-professional")
    };
  }

  @Get("onboarding/:professionalId/status")
  async onboardingStatus(@Param("professionalId") professionalId: string) {
    await this.syncWhatsappStatus(professionalId);
    return this.database.getOnboardingStatus(professionalId);
  }

  @Post("onboarding/:professionalId/defaults")
  async onboardingDefaults(@Param("professionalId") professionalId: string) {
    await this.createDefaultScheduling(professionalId);

    return {
      status: "defaults_created",
      professionalId,
      onboarding: await this.database.getOnboardingStatus(professionalId)
    };
  }

  @Post("onboarding/:professionalId/whatsapp/prepare")
  async onboardingWhatsappPrepare(@Param("professionalId") professionalId: string) {
    const professional = this.professionals.getById(professionalId);
    const webhookUrl = `${
      process.env.PUBLIC_API_URL || "https://api.agendasmart.com.br"
    }/webhooks/evolution`;
    const result = await this.evolution.prepareProfessionalInstance({
      instanceName: professional.evolutionInstanceName,
      webhookUrl,
      phone: professional.whatsappNumber
    });
    const hasError = [result.created, result.webhook, result.connection].some(
      (step) => "status" in step && typeof step.status === "string" && step.status.includes("error")
    );

    await this.database.markProfessionalWhatsappStatus(
      professional.id,
      hasError ? "error" : "instance_created"
    );

    return {
      ...result,
      onboarding: await this.database.getOnboardingStatus(professional.id)
    };
  }

  @Get("onboarding/:professionalId/whatsapp/connect")
  async onboardingWhatsappConnect(@Param("professionalId") professionalId: string) {
    const professional = this.professionals.getById(professionalId);
    const connection = await this.evolution.connectInstance(professional.evolutionInstanceName);

    return {
      provider: "evolution-api",
      professionalId: professional.id,
      instanceName: professional.evolutionInstanceName,
      connection
    };
  }

  @Get("professionals/:id/google/auth-url")
  googleAuthUrl(@Param("id") id: string) {
    return this.calendar.createGoogleAuthUrl(id);
  }

  @Get("integrations/google/start")
  googleStart(
    @Query("professionalId") professionalId = "demo-professional",
    @Res() response: Response
  ) {
    const auth = this.calendar.createGoogleAuthUrl(professionalId);

    if (auth.status !== "ready" || !("authUrl" in auth) || !auth.authUrl) {
      return response.status(400).json(auth);
    }

    return response.redirect(auth.authUrl);
  }

  @Get("integrations/evolution/status")
  evolutionStatus() {
    return this.evolution.fetchInstances();
  }

  @Get("integrations/google/callback")
  googleCallback(@Query("code") code: string, @Query("state") state: string) {
    return this.calendar.handleGoogleCallback({ code, state });
  }

  @Get("calendar/availability")
  availability(
    @Query("professionalId") professionalId = "demo-professional",
    @Query("serviceId") serviceId?: string
  ) {
    return this.calendar.getAvailabilityForService({ professionalId, serviceId });
  }

  @Get("clients")
  clients(@Query("professionalId") professionalId = "demo-professional") {
    return this.database.listClients(professionalId);
  }

  @Get("appointments")
  appointments(
    @Query("professionalId") professionalId = "demo-professional",
    @Query("limit") limit?: string
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 100;
    return this.database.listAppointments(professionalId, parsedLimit);
  }

  @Get("appointments/upcoming")
  upcomingAppointments(
    @Query("professionalId") professionalId = "demo-professional",
    @Query("limit") limit?: string
  ) {
    return this.database.listUpcomingAppointments(
      professionalId,
      limit ? Number.parseInt(limit, 10) : 20
    );
  }

  @Get("services")
  services(
    @Query("professionalId") professionalId = "demo-professional",
    @Query("active") active?: string
  ) {
    return this.database.listServices(professionalId, active === "true");
  }

  @Post("services")
  createService(
    @Body()
    input: {
      professionalId?: string;
      name: string;
      durationMinutes: number;
      priceCents?: number;
      active?: boolean;
    }
  ) {
    this.validateServiceInput(input);
    return this.database.createService({
      professionalId: input.professionalId || "demo-professional",
      name: input.name,
      durationMinutes: input.durationMinutes,
      priceCents: input.priceCents,
      active: input.active
    });
  }

  @Patch("services/:id")
  updateService(
    @Param("id") id: string,
    @Query("professionalId") professionalId = "demo-professional",
    @Body()
    input: {
      name?: string;
      durationMinutes?: number;
      priceCents?: number;
      active?: boolean;
    }
  ) {
    if (input.durationMinutes !== undefined && input.durationMinutes <= 0) {
      return { status: "validation_error", message: "durationMinutes deve ser maior que zero." };
    }

    return this.database.updateService(professionalId, id, input);
  }

  @Delete("services/:id")
  deleteService(
    @Param("id") id: string,
    @Query("professionalId") professionalId = "demo-professional"
  ) {
    return this.database.deleteService(professionalId, id);
  }

  @Get("availability-rules")
  availabilityRules(@Query("professionalId") professionalId = "demo-professional") {
    return this.database.listAvailabilityRules(professionalId);
  }

  @Post("availability-rules")
  createAvailabilityRule(
    @Body()
    input: {
      professionalId?: string;
      weekday: number;
      startTime: string;
      endTime: string;
      lunchStart?: string;
      lunchEnd?: string;
      bufferMinutes?: number;
      minimumNoticeMinutes?: number;
      active?: boolean;
    }
  ) {
    this.validateAvailabilityInput(input);
    return this.database.createAvailabilityRule({
      professionalId: input.professionalId || "demo-professional",
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      lunchStart: input.lunchStart,
      lunchEnd: input.lunchEnd,
      bufferMinutes: input.bufferMinutes,
      minimumNoticeMinutes: input.minimumNoticeMinutes,
      active: input.active
    });
  }

  @Patch("availability-rules/:weekday")
  updateAvailabilityRule(
    @Param("weekday") weekday: string,
    @Query("professionalId") professionalId = "demo-professional",
    @Body()
    input: {
      startTime?: string;
      endTime?: string;
      lunchStart?: string;
      lunchEnd?: string;
      bufferMinutes?: number;
      minimumNoticeMinutes?: number;
      active?: boolean;
    }
  ) {
    return this.database.updateAvailabilityRule(
      professionalId,
      Number.parseInt(weekday, 10),
      input
    );
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
      serviceId?: string;
    }
  ) {
    return this.calendar.createEvent(input);
  }

  @Post("webhooks/evolution")
  async evolutionWebhook(@Body() payload: EvolutionWebhookPayload) {
    await this.updateWhatsappStatusFromWebhook(payload);
    return this.aiScheduling.handleIncomingWhatsAppMessage(payload);
  }

  private sanitizeProfessional(professional: Professional) {
    return {
      ...professional,
      googleCalendar: professional.googleCalendar
        ? {
            email: professional.googleCalendar.email,
            calendarId: professional.googleCalendar.calendarId,
            connectedAt: professional.googleCalendar.connectedAt,
            expiresAt: professional.googleCalendar.expiresAt,
            connected: Boolean(professional.googleCalendar.accessToken)
          }
        : undefined
    };
  }

  private validateServiceInput(input: { name?: string; durationMinutes?: number }) {
    if (!input.name?.trim()) {
      throw new BadRequestException("name e obrigatorio.");
    }

    if (!input.durationMinutes || input.durationMinutes <= 0) {
      throw new BadRequestException("durationMinutes deve ser maior que zero.");
    }
  }

  private validateProfessionalInput(input: CreateProfessionalInput) {
    if (!input.name?.trim()) {
      throw new BadRequestException("name e obrigatorio.");
    }

    if (!input.whatsappNumber?.trim()) {
      throw new BadRequestException("whatsappNumber e obrigatorio.");
    }

    if (!input.gmail?.trim()) {
      throw new BadRequestException("gmail e obrigatorio.");
    }
  }

  private validateAvailabilityInput(input: {
    weekday?: number;
    startTime?: string;
    endTime?: string;
  }) {
    if (input.weekday === undefined || input.weekday < 0 || input.weekday > 6) {
      throw new BadRequestException("weekday deve estar entre 0 e 6.");
    }

    if (!input.startTime || !input.endTime) {
      throw new BadRequestException("startTime e endTime sao obrigatorios.");
    }
  }

  private async createDefaultScheduling(professionalId: string) {
    const services = await this.database.listServices(professionalId, true);
    if (services.length === 0) {
      await this.database.createService({
        professionalId,
        name: "Consulta",
        durationMinutes: 60,
        priceCents: 0,
        active: true
      });
    }

    const rules = await this.database.listAvailabilityRules(professionalId);
    if (rules.length === 0) {
      for (const weekday of [1, 2, 3, 4, 5]) {
        await this.database.createAvailabilityRule({
          professionalId,
          weekday,
          startTime: "09:00",
          endTime: "18:00",
          lunchStart: "12:00",
          lunchEnd: "13:00",
          bufferMinutes: 0,
          minimumNoticeMinutes: 120,
          active: true
        });
      }
    }
  }

  private async updateWhatsappStatusFromWebhook(payload: EvolutionWebhookPayload) {
    const event = payload.event?.toUpperCase();
    if (event !== "CONNECTION_UPDATE") {
      return;
    }

    const instanceName =
      payload.instance || payload.instanceName || payload.data?.instance || process.env.EVOLUTION_INSTANCE_NAME;
    const state = JSON.stringify(payload.data || {}).toLowerCase();
    const professional = instanceName
      ? this.professionals.findByEvolutionInstance(instanceName)
      : undefined;

    if (!professional) {
      return;
    }

    if (state.includes("open") || state.includes("connected")) {
      await this.database.markProfessionalWhatsappStatus(professional.id, "connected");
    }
  }

  private async syncWhatsappStatus(professionalId: string) {
    const professional = this.professionals.getById(professionalId);
    const instance = await this.evolution.getInstanceSummary(professional.evolutionInstanceName);

    if (instance?.connected) {
      await this.database.markProfessionalWhatsappStatus(professional.id, "connected");
    }
  }
}
