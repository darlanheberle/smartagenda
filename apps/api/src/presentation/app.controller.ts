import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { AiSchedulingService } from "../services/ai-scheduling.service";
import { AuthService } from "../services/auth.service";
import { CalendarService } from "../services/calendar.service";
import { DatabaseService } from "../services/database.service";
import { EvolutionService } from "../services/evolution.service";
import { ProfessionalRegistryService } from "../services/professional-registry.service";
import { EvolutionWebhookPayload } from "../types/integrations";
import {
  CreateProfessionalInput,
  Professional,
  ProfessionalRecord
} from "../types/professional";

@Controller()
export class AppController {
  constructor(
    private readonly aiScheduling: AiSchedulingService,
    private readonly auth: AuthService,
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

  @Post("auth/login")
  async login(
    @Body() input: { email?: string; password?: string },
    @Res({ passthrough: true }) response: Response
  ) {
    if (!input.email?.trim() || !input.password) {
      throw new BadRequestException("Email e senha sao obrigatorios.");
    }

    const professional = await this.auth.authenticate(input.email, input.password);
    this.auth.createSession(response, professional.id);

    return {
      status: "authenticated",
      professional: this.toAccountProfessional(professional)
    };
  }

  @Get("auth/google/start")
  googleLoginStart(@Query("next") requestedNext = "/home", @Res() response: Response) {
    const state = this.auth.createGoogleOAuthState(response, {
      purpose: "login",
      nextPath: this.safeAppPath(requestedNext, "/home")
    });
    const googleAuth = this.calendar.createGoogleAuthUrl({ state });

    if (googleAuth.status !== "ready" || !googleAuth.authUrl) {
      return response.status(400).json(googleAuth);
    }

    return response.redirect(googleAuth.authUrl);
  }

  @Post("auth/activate")
  async activateAccount(
    @Body() input: { email?: string; whatsappNumber?: string; password?: string },
    @Res({ passthrough: true }) response: Response
  ) {
    if (!input.email?.trim() || !input.whatsappNumber?.trim() || !input.password) {
      throw new BadRequestException("Email, WhatsApp e nova senha sao obrigatorios.");
    }

    this.validatePassword(input.password);
    const professional = await this.database.findProfessionalByGmail(input.email);

    if (!professional || this.normalizePhone(input.whatsappNumber) !== professional.whatsapp_number) {
      throw new BadRequestException("Nao encontramos uma conta com este Gmail e WhatsApp.");
    }

    if (professional.password_hash) {
      throw new ConflictException("Esta conta ja possui senha. Use a tela de login.");
    }

    const passwordHash = await this.auth.hashPassword(input.password);
    const updated = await this.database.setProfessionalPassword(professional.id, passwordHash);
    this.auth.createSession(response, professional.id);

    return {
      status: "activated",
      professional: this.toAccountProfessional(updated || professional)
    };
  }

  @Get("auth/me")
  async authenticatedProfessional(@Req() request: Request) {
    const professionalId = this.auth.requireProfessionalId(request);
    const professional = await this.database.getProfessional(professionalId);

    if (!professional) {
      throw new BadRequestException("Profissional da sessao nao encontrado.");
    }

    return {
      professional: this.toAccountProfessional(professional)
    };
  }

  @Get("profile/branding")
  async professionalBranding(@Req() request: Request) {
    const professionalId = this.auth.requireProfessionalId(request);
    const professional = await this.database.getProfessional(professionalId);

    if (!professional) {
      throw new BadRequestException("Profissional da sessao nao encontrado.");
    }

    return this.toProfessionalBranding(professional);
  }

  @Patch("profile/branding")
  async updateProfessionalBranding(
    @Req() request: Request,
    @Body()
    input: {
      logoUrl?: string | null;
      themePrimary?: string | null;
      themePrimaryDark?: string | null;
      themeAccent?: string | null;
      themeBackground?: string | null;
      themeSurface?: string | null;
      themeText?: string | null;
      themeSuccess?: string | null;
    }
  ) {
    const professionalId = this.auth.requireProfessionalId(request);
    this.validateBrandingInput(input);
    const professional = await this.database.updateProfessionalBranding(professionalId, input);

    if (!professional) {
      throw new BadRequestException("Profissional da sessao nao encontrado.");
    }

    return this.toProfessionalBranding(professional);
  }

  @Get("profile/assistant")
  async professionalAssistant(@Req() request: Request) {
    const professionalId = this.auth.requireProfessionalId(request);
    const professional = await this.database.getProfessional(professionalId);

    if (!professional) {
      throw new BadRequestException("Profissional da sessao nao encontrado.");
    }

    return {
      enabled: professional.ai_enabled !== false,
      updatedAt: professional.updated_at
    };
  }

  @Patch("profile/assistant")
  async updateProfessionalAssistant(
    @Req() request: Request,
    @Body() input: { enabled?: boolean }
  ) {
    if (typeof input.enabled !== "boolean") {
      throw new BadRequestException("enabled precisa ser verdadeiro ou falso.");
    }

    const professionalId = this.auth.requireProfessionalId(request);
    const professional = await this.database.updateProfessionalAiEnabled(
      professionalId,
      input.enabled
    );

    if (!professional) {
      throw new BadRequestException("Profissional da sessao nao encontrado.");
    }

    return {
      enabled: professional.ai_enabled !== false,
      updatedAt: professional.updated_at
    };
  }

  @Post("auth/logout")
  logout(@Res({ passthrough: true }) response: Response) {
    this.auth.clearSession(response);
    return { status: "logged_out" };
  }

  @Get("dashboard/today")
  today(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    const professional = this.professionals.getById(professionalId);
    return this.database.getTodayDashboard(professional.id, professional.timezone);
  }

  @Post("professionals")
  async updateAuthenticatedProfessional(
    @Req() request: Request,
    @Body() input: CreateProfessionalInput
  ) {
    const professionalId = this.auth.requireProfessionalId(request);
    return this.persistProfessional({ ...input, id: professionalId });
  }

  @Get("professionals")
  listProfessionals(@Req() request: Request) {
    const professionalId = this.auth.requireProfessionalId(request);
    return [this.sanitizeProfessional(this.professionals.getById(professionalId))];
  }

  @Get("professionals/:id")
  getProfessional(@Req() request: Request, @Param("id") requestedProfessionalId: string) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    return this.sanitizeProfessional(this.professionals.getById(professionalId));
  }

  @Post("onboarding/professionals")
  async onboardingCreateProfessional(
    @Body() input: CreateProfessionalInput & { password?: string },
    @Res({ passthrough: true }) response: Response
  ) {
    if (!input.password) {
      throw new BadRequestException("password e obrigatoria.");
    }

    this.validatePassword(input.password);
    const existingGmail = await this.database.findProfessionalByGmail(input.gmail);

    if (existingGmail) {
      throw new ConflictException({
        status: "gmail_already_registered",
        message: "Este Gmail ja esta cadastrado.",
        whatsappNumber: existingGmail.whatsapp_number,
        gmail: existingGmail.gmail,
        professionalId: existingGmail.id,
        professionalName: existingGmail.name
      });
    }

    const existingProfessional = await this.database.findProfessionalByWhatsappNumber(
      input.whatsappNumber
    );

    if (existingProfessional) {
      throw new ConflictException({
        status: "whatsapp_already_registered",
        message: "Este numero de WhatsApp ja esta cadastrado.",
        whatsappNumber: existingProfessional.whatsapp_number,
        gmail: existingProfessional.gmail,
        professionalId: existingProfessional.id,
        professionalName: existingProfessional.name
      });
    }

    const professional = await this.persistProfessional(input);
    const passwordHash = await this.auth.hashPassword(input.password);
    await this.database.setProfessionalPassword(
      professional.id || input.id || "demo-professional",
      passwordHash
    );
    await this.createDefaultScheduling(professional.id || input.id || "demo-professional");
    this.auth.createSession(response, professional.id || input.id || "demo-professional");

    return {
      professional,
      status: await this.database.getOnboardingStatus(professional.id || input.id || "demo-professional")
    };
  }

  @Post("onboarding/:professionalId/profile")
  async completeGoogleProfessionalProfile(
    @Req() request: Request,
    @Param("professionalId") requestedProfessionalId: string,
    @Body() input: { name?: string; specialty?: string; whatsappNumber?: string }
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    if (!input.name?.trim() || !input.specialty?.trim() || !input.whatsappNumber?.trim()) {
      throw new BadRequestException("Nome, especialidade e WhatsApp sao obrigatorios.");
    }

    const stored = await this.database.getProfessional(professionalId);
    if (!stored) {
      throw new NotFoundException("Profissional nao encontrado.");
    }

    const whatsappOwner = await this.database.findProfessionalByWhatsappNumber(
      input.whatsappNumber
    );
    if (whatsappOwner && whatsappOwner.id !== professionalId) {
      throw new ConflictException({
        status: "whatsapp_already_registered",
        message: "Este numero de WhatsApp ja esta cadastrado.",
        whatsappNumber: whatsappOwner.whatsapp_number,
        gmail: whatsappOwner.gmail,
        professionalId: whatsappOwner.id,
        professionalName: whatsappOwner.name
      });
    }

    const professional = await this.persistProfessional({
      id: professionalId,
      name: input.name,
      specialty: input.specialty,
      whatsappNumber: input.whatsappNumber,
      gmail: stored.gmail,
      timezone: stored.timezone,
      appointmentDurationMinutes: stored.appointment_duration_minutes
    });
    await this.createDefaultScheduling(professionalId);

    return {
      professional,
      status: await this.database.getOnboardingStatus(professionalId)
    };
  }

  @Get("onboarding/:professionalId/status")
  async onboardingStatus(
    @Req() request: Request,
    @Param("professionalId") requestedProfessionalId: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    await this.syncWhatsappStatus(professionalId);
    return this.database.getOnboardingStatus(professionalId);
  }

  @Post("onboarding/:professionalId/defaults")
  async onboardingDefaults(
    @Req() request: Request,
    @Param("professionalId") requestedProfessionalId: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    await this.createDefaultScheduling(professionalId);

    return {
      status: "defaults_created",
      professionalId,
      onboarding: await this.database.getOnboardingStatus(professionalId)
    };
  }

  @Post("onboarding/:professionalId/whatsapp/prepare")
  async onboardingWhatsappPrepare(
    @Req() request: Request,
    @Param("professionalId") requestedProfessionalId: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    const professional = this.professionals.getById(professionalId);
    const webhookUrl = `${
      process.env.PUBLIC_API_URL || "https://api.agendasmart.com.br"
    }/webhooks/evolution/${professional.id}`;
    const result = await this.evolution.prepareProfessionalInstance({
      instanceName: professional.evolutionInstanceName,
      webhookUrl,
      phone: professional.whatsappNumber
    });
    const hasError = [result.webhook, result.connection].some(
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

  @Post("onboarding/:professionalId/whatsapp/skip")
  async onboardingWhatsappSkip(
    @Req() request: Request,
    @Param("professionalId") requestedProfessionalId: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    await this.database.markProfessionalWhatsappStatus(professionalId, "skipped");

    return {
      status: "whatsapp_skipped",
      professionalId,
      onboarding: await this.database.getOnboardingStatus(professionalId)
    };
  }

  @Get("onboarding/:professionalId/whatsapp/connect")
  async onboardingWhatsappConnect(
    @Req() request: Request,
    @Param("professionalId") requestedProfessionalId: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    const professional = this.professionals.getById(professionalId);
    const connection = await this.evolution.connectInstance(
      professional.evolutionInstanceName,
      professional.whatsappNumber
    );

    return {
      provider: "evolution-api",
      professionalId: professional.id,
      instanceName: professional.evolutionInstanceName,
      connection
    };
  }

  @Get("professionals/:id/google/auth-url")
  googleAuthUrl(
    @Req() request: Request,
    @Param("id") requestedProfessionalId: string,
    @Res({ passthrough: true }) response: Response
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    const professional = this.professionals.getById(professionalId);
    const state = this.auth.createGoogleOAuthState(response, {
      purpose: "connect",
      professionalId,
      nextPath: "/onboarding?step=google&connected=1"
    });
    return this.calendar.createGoogleAuthUrl({ state, loginHint: professional.gmail });
  }

  @Get("integrations/google/start")
  googleStart(
    @Req() request: Request,
    @Query("professionalId") professionalId = "demo-professional",
    @Res() response: Response
  ) {
    this.auth.requireOwnProfessional(request, professionalId);
    const professional = this.professionals.getById(professionalId);
    const state = this.auth.createGoogleOAuthState(response, {
      purpose: "connect",
      professionalId,
      nextPath: "/onboarding?step=google&connected=1"
    });
    const auth = this.calendar.createGoogleAuthUrl({ state, loginHint: professional.gmail });

    if (auth.status !== "ready" || !("authUrl" in auth) || !auth.authUrl) {
      return response.status(400).json(auth);
    }

    return response.redirect(auth.authUrl);
  }

  @Get("integrations/evolution/status")
  evolutionStatus(@Req() request: Request) {
    this.auth.requireProfessionalId(request);
    return this.evolution.fetchInstances();
  }

  @Get("integrations/google/callback")
  async googleCallback(
    @Req() request: Request,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") googleError: string | undefined,
    @Res() response: Response
  ) {
    const oauthState = this.auth.consumeGoogleOAuthState(request, response, state);
    if (googleError || !code) {
      return this.redirectGoogleError(
        response,
        oauthState.purpose,
        "Autorizacao cancelada no Google."
      );
    }

    try {
      const authorization = await this.calendar.exchangeGoogleAuthorizationCode(code);

      if (oauthState.purpose === "connect") {
        const professionalId = this.auth.requireOwnProfessional(
          request,
          oauthState.professionalId
        );
        const googleOwner = await this.database.findProfessionalByGoogleSubject(
          authorization.profile.subject
        );
        if (googleOwner && googleOwner.id !== professionalId) {
          throw new Error("Esta conta Google ja esta vinculada a outro profissional.");
        }

        await this.calendar.connectGoogleAccount(professionalId, authorization);
        await this.database.linkGoogleIdentity(
          professionalId,
          authorization.profile.subject
        );
        return response.redirect(this.appUrl(oauthState.nextPath));
      }

      let professional = await this.database.findProfessionalByGoogleSubject(
        authorization.profile.subject
      );
      professional ||= await this.database.findProfessionalByGmail(authorization.profile.email);

      if (
        professional?.google_subject &&
        professional.google_subject !== authorization.profile.subject
      ) {
        throw new Error("Este Gmail ja esta vinculado a outra identidade Google.");
      }

      if (!professional) {
        professional = await this.database.createGoogleProfessional({
          id: randomUUID(),
          name: authorization.profile.name,
          gmail: authorization.profile.email,
          googleSubject: authorization.profile.subject
        });
      } else if (!professional.google_subject) {
        professional =
          (await this.database.linkGoogleIdentity(
            professional.id,
            authorization.profile.subject
          )) || professional;
      }

      if (!professional) {
        throw new Error("Nao foi possivel criar a conta profissional.");
      }

      this.professionals.rememberRecord(professional);
      await this.calendar.connectGoogleAccount(professional.id, authorization);
      this.auth.createSession(response, professional.id);

      const nextPath = professional.profile_completed
        ? oauthState.nextPath
        : "/onboarding?step=account&google=1";
      return response.redirect(this.appUrl(nextPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao entrar com o Google.";
      return this.redirectGoogleError(response, oauthState.purpose, message);
    }
  }

  @Get("calendar/availability")
  availability(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string,
    @Query("serviceId") serviceId?: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    return this.calendar.getAvailabilityForService({ professionalId, serviceId });
  }

  @Get("clients")
  clients(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    return this.database.listClients(professionalId);
  }

  @Get("appointments")
  appointments(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string,
    @Query("limit") limit?: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 100;
    return this.database.listAppointments(professionalId, parsedLimit);
  }

  @Get("appointments/upcoming")
  upcomingAppointments(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string,
    @Query("limit") limit?: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    return this.database.listUpcomingAppointments(
      professionalId,
      limit ? Number.parseInt(limit, 10) : 20
    );
  }

  @Post("appointments/manual")
  async createManualAppointment(
    @Req() request: Request,
    @Body()
    input: {
      professionalId?: string;
      clientName: string;
      clientPhone?: string;
      clientEmail?: string;
      serviceId?: string;
      serviceName?: string;
      startsAt: string;
      durationMinutes?: number;
      valueCents?: number;
    }
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, input.professionalId);
    const payload = await this.buildManualAppointmentPayload(professionalId, input);
    return this.database.createManualAppointment(payload);
  }

  @Patch("appointments/:id")
  async updateAppointment(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId: string | undefined,
    @Body()
    input: {
      clientName?: string;
      clientPhone?: string;
      clientEmail?: string;
      serviceId?: string;
      serviceName?: string;
      startsAt?: string;
      durationMinutes?: number;
      valueCents?: number;
      status?: string;
      paymentStatus?: string;
    }
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    const current = await this.database.getAppointment(professionalId, id);

    if (!current) {
      throw new NotFoundException("Atendimento nao encontrado.");
    }

    const payload = await this.buildManualAppointmentPayload(professionalId, {
      clientName: input.clientName || current.client_name || "Cliente",
      clientPhone: input.clientPhone ?? current.client_phone ?? undefined,
      clientEmail: input.clientEmail ?? current.client_email ?? undefined,
      serviceId: input.serviceId,
      serviceName: input.serviceName || current.service_name,
      startsAt: input.startsAt || current.starts_at,
      durationMinutes:
        input.durationMinutes || this.minutesBetween(current.starts_at, current.ends_at),
      valueCents: input.valueCents ?? current.value_cents
    });

    return this.database.updateAppointment(professionalId, id, {
      ...payload,
      status: input.status,
      paymentStatus: input.paymentStatus
    });
  }

  @Delete("appointments/:id")
  deleteAppointment(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    return this.database.deleteAppointment(professionalId, id);
  }

  @Get("services")
  services(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string,
    @Query("active") active?: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    return this.database.listServices(professionalId, active === "true");
  }

  @Post("services")
  createService(
    @Req() request: Request,
    @Body()
    input: {
      professionalId?: string;
      category?: string | null;
      name: string;
      durationMinutes: number;
      priceCents?: number;
      active?: boolean;
    }
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, input.professionalId);
    this.validateServiceInput(input);
    return this.database.createService({
      professionalId,
      category: input.category,
      name: input.name,
      durationMinutes: input.durationMinutes,
      priceCents: input.priceCents,
      active: input.active
    });
  }

  @Patch("services/:id")
  updateService(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId: string | undefined,
    @Body()
    input: {
      category?: string | null;
      name?: string;
      durationMinutes?: number;
      priceCents?: number;
      active?: boolean;
    }
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    if (input.durationMinutes !== undefined && input.durationMinutes <= 0) {
      return { status: "validation_error", message: "durationMinutes deve ser maior que zero." };
    }

    return this.database.updateService(professionalId, id, input);
  }

  @Delete("services/:id")
  deleteService(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    return this.database.deleteService(professionalId, id);
  }

  @Get("availability-rules")
  availabilityRules(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    return this.database.listAvailabilityRules(professionalId);
  }

  @Post("availability-rules")
  createAvailabilityRule(
    @Req() request: Request,
    @Body()
    input: {
      professionalId?: string;
      weekday: number;
      startTime: string;
      endTime: string;
      lunchStart?: string;
      lunchEnd?: string;
      slotIntervalMinutes?: number | null;
      bufferMinutes?: number;
      minimumNoticeMinutes?: number;
      active?: boolean;
    }
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, input.professionalId);
    this.validateAvailabilityInput(input);
    return this.database.createAvailabilityRule({
      professionalId,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      lunchStart: input.lunchStart,
      lunchEnd: input.lunchEnd,
      slotIntervalMinutes: input.slotIntervalMinutes,
      bufferMinutes: input.bufferMinutes,
      minimumNoticeMinutes: input.minimumNoticeMinutes,
      active: input.active
    });
  }

  @Patch("availability-rules/:weekday")
  updateAvailabilityRule(
    @Req() request: Request,
    @Param("weekday") weekday: string,
    @Query("professionalId") requestedProfessionalId: string | undefined,
    @Body()
    input: {
      startTime?: string;
      endTime?: string;
      lunchStart?: string;
      lunchEnd?: string;
      slotIntervalMinutes?: number | null;
      bufferMinutes?: number;
      minimumNoticeMinutes?: number;
      active?: boolean;
    }
  ) {
    const professionalId = this.auth.requireOwnProfessional(request, requestedProfessionalId);
    this.validateAvailabilitySettings(input);
    return this.database.updateAvailabilityRule(
      professionalId,
      Number.parseInt(weekday, 10),
      input
    );
  }

  @Post("calendar/events")
  createEvent(
    @Req() request: Request,
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
    const professionalId = this.auth.requireOwnProfessional(request, input.professionalId);
    return this.calendar.createEvent({ ...input, professionalId });
  }

  @Post("webhooks/evolution")
  async evolutionWebhook(@Body() payload: EvolutionWebhookPayload) {
    await this.updateWhatsappStatusFromWebhook(payload);
    return this.aiScheduling.handleIncomingWhatsAppMessage(payload);
  }

  @Post("webhooks/evolution/:professionalId")
  async evolutionWebhookForProfessional(
    @Param("professionalId") professionalId: string,
    @Body() payload: EvolutionWebhookPayload
  ) {
    await this.updateWhatsappStatusFromWebhook(payload, professionalId);
    return this.aiScheduling.handleIncomingWhatsAppMessage(payload, professionalId);
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

  private async persistProfessional(input: CreateProfessionalInput) {
    this.validateProfessionalInput(input);
    const professional = this.professionals.create(input);
    const stored = await this.database.upsertProfessional({
      ...input,
      id: professional.id,
      evolutionInstanceName: professional.evolutionInstanceName
    });

    if (stored) {
      const { password_hash: _passwordHash, ...safeProfessional } = stored;
      return safeProfessional;
    }

    return this.sanitizeProfessional(professional);
  }

  private validateServiceInput(input: { name?: string; durationMinutes?: number }) {
    if (!input.name?.trim()) {
      throw new BadRequestException("name e obrigatorio.");
    }

    if (!input.durationMinutes || input.durationMinutes <= 0) {
      throw new BadRequestException("durationMinutes deve ser maior que zero.");
    }
  }

  private async buildManualAppointmentPayload(
    professionalId: string,
    input: {
      clientName?: string;
      clientPhone?: string;
      clientEmail?: string;
      serviceId?: string;
      serviceName?: string;
      startsAt?: string;
      durationMinutes?: number;
      valueCents?: number;
    }
  ) {
    if (!input.clientName?.trim()) {
      throw new BadRequestException("clientName e obrigatorio.");
    }

    if (!input.startsAt) {
      throw new BadRequestException("startsAt e obrigatorio.");
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException("startsAt invalido.");
    }

    const service = input.serviceId
      ? await this.database.getService(professionalId, input.serviceId)
      : undefined;
    const serviceName = service?.name || input.serviceName?.trim();
    if (!serviceName) {
      throw new BadRequestException("serviceName ou serviceId e obrigatorio.");
    }

    const durationMinutes = service?.duration_minutes || input.durationMinutes || 60;
    if (durationMinutes <= 0) {
      throw new BadRequestException("durationMinutes deve ser maior que zero.");
    }

    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

    return {
      professionalId,
      clientName: input.clientName.trim(),
      clientPhone: input.clientPhone,
      clientEmail: input.clientEmail,
      serviceName,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      valueCents: service?.price_cents ?? input.valueCents ?? 0
    };
  }

  private minutesBetween(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
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

  private validatePassword(password: string) {
    if (password.length < 8) {
      throw new BadRequestException("A senha deve possuir pelo menos 8 caracteres.");
    }
  }

  private toAccountProfessional(professional: ProfessionalRecord) {
    return {
      id: professional.id,
      name: professional.name,
      specialty: professional.specialty,
      gmail: professional.gmail,
      whatsappNumber: professional.whatsapp_number,
      timezone: professional.timezone,
      profileCompleted: professional.profile_completed,
      aiEnabled: professional.ai_enabled !== false,
      branding: this.toProfessionalBranding(professional)
    };
  }

  private safeAppPath(value: string | undefined, fallback: string) {
    return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
  }

  private appUrl(path: string) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.agendasmart.com.br";
    return `${appUrl.replace(/\/$/, "")}${this.safeAppPath(path, "/home")}`;
  }

  private redirectGoogleError(
    response: Response,
    purpose: "login" | "connect",
    message: string
  ) {
    const path = purpose === "connect" ? "/onboarding?step=google" : "/login";
    const separator = path.includes("?") ? "&" : "?";
    return response.redirect(
      this.appUrl(`${path}${separator}googleError=${encodeURIComponent(message)}`)
    );
  }

  private toProfessionalBranding(professional: ProfessionalRecord) {
    return {
      logoUrl: professional.logo_url || null,
      themePrimary: professional.theme_primary || "#7c3aed",
      themePrimaryDark: professional.theme_primary_dark || "#6d28d9",
      themeAccent: professional.theme_accent || "#4f46e5",
      themeBackground: professional.theme_background || "#f8fafc",
      themeSurface: professional.theme_surface || "#ffffff",
      themeText: professional.theme_text || "#0f172a",
      themeSuccess: professional.theme_success || "#059669"
    };
  }

  private normalizePhone(phone: string) {
    return `+${phone.replace(/\D/g, "")}`;
  }

  private validateAvailabilityInput(input: {
    weekday?: number;
    startTime?: string;
    endTime?: string;
    slotIntervalMinutes?: number | null;
    bufferMinutes?: number;
    minimumNoticeMinutes?: number;
  }) {
    if (input.weekday === undefined || input.weekday < 0 || input.weekday > 6) {
      throw new BadRequestException("weekday deve estar entre 0 e 6.");
    }

    if (!input.startTime || !input.endTime) {
      throw new BadRequestException("startTime e endTime sao obrigatorios.");
    }

    this.validateAvailabilitySettings(input);
  }

  private validateAvailabilitySettings(input: {
    slotIntervalMinutes?: number | null;
    bufferMinutes?: number;
    minimumNoticeMinutes?: number;
  }) {
    if (
      input.slotIntervalMinutes !== undefined &&
      input.slotIntervalMinutes !== null &&
      input.slotIntervalMinutes <= 0
    ) {
      throw new BadRequestException("slotIntervalMinutes deve ser maior que zero ou null.");
    }

    if (input.bufferMinutes !== undefined && input.bufferMinutes < 0) {
      throw new BadRequestException("bufferMinutes nao pode ser negativo.");
    }

    if (input.minimumNoticeMinutes !== undefined && input.minimumNoticeMinutes < 0) {
      throw new BadRequestException("minimumNoticeMinutes nao pode ser negativo.");
    }
  }

  private validateBrandingInput(input: {
    logoUrl?: string | null;
    themePrimary?: string | null;
    themePrimaryDark?: string | null;
    themeAccent?: string | null;
    themeBackground?: string | null;
    themeSurface?: string | null;
    themeText?: string | null;
    themeSuccess?: string | null;
  }) {
    if (input.logoUrl && input.logoUrl.length > 300000) {
      throw new BadRequestException("A imagem do logo esta muito grande.");
    }

    for (const [key, value] of Object.entries(input)) {
      if (key === "logoUrl" || value === undefined || value === null || value === "") {
        continue;
      }

      if (!/^#[0-9a-f]{6}$/i.test(String(value))) {
        throw new BadRequestException(`${key} precisa estar no formato hexadecimal #RRGGBB.`);
      }
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

  private async updateWhatsappStatusFromWebhook(
    payload: EvolutionWebhookPayload,
    forcedProfessionalId?: string
  ) {
    const event = payload.event?.toUpperCase();
    if (event !== "CONNECTION_UPDATE") {
      return;
    }

    const instanceName =
      payload.instance || payload.instanceName || payload.data?.instance || process.env.EVOLUTION_INSTANCE_NAME;
    const state = JSON.stringify(payload.data || {}).toLowerCase();
    const professional = forcedProfessionalId
      ? this.findProfessionalSafely(forcedProfessionalId)
      : instanceName
        ? this.professionals.findByEvolutionInstance(instanceName)
        : undefined;

    if (!professional) {
      return;
    }

    if (state.includes("open") || state.includes("connected")) {
      await this.database.markProfessionalWhatsappStatus(professional.id, "connected");
    }
  }

  private findProfessionalSafely(professionalId: string) {
    try {
      return this.professionals.getById(professionalId);
    } catch {
      return undefined;
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
