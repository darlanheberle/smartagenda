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
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomBytes, randomUUID } from "crypto";
import { AiSchedulingService } from "../services/ai-scheduling.service";
import { AuthService } from "../services/auth.service";
import { CalendarService } from "../services/calendar.service";
import { DatabaseService, TeamMemberRecord } from "../services/database.service";
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
    @Body() input: { email?: string; password?: string; companySlug?: string },
    @Res({ passthrough: true }) response: Response
  ) {
    if (!input.email?.trim() || !input.password) {
      throw new BadRequestException("Email e senha sao obrigatorios.");
    }

    // Login por empresa (/{slug}/login): escopa a busca aquela empresa.
    let scopedProfessionalId: string | undefined;
    if (input.companySlug?.trim()) {
      const company = await this.database.findProfessionalBySlug(input.companySlug);
      if (!company) {
        throw new NotFoundException("Empresa nao encontrada.");
      }
      scopedProfessionalId = company.id;
    }

    // Tenta primeiro como profissional da equipe (team_member); depois como empresa.
    const member = await this.auth.authenticateTeamMember(
      input.email,
      input.password,
      scopedProfessionalId
    );
    if (member) {
      this.auth.createSession(response, member.professional_id, member.id);
      return {
        status: "authenticated",
        professional: this.toAccountMember(member)
      };
    }

    const professional = await this.auth.authenticate(input.email, input.password);
    if (scopedProfessionalId && professional.id !== scopedProfessionalId) {
      throw new UnauthorizedException("Esta conta nao pertence a esta empresa.");
    }
    this.auth.createSession(response, professional.id);

    return {
      status: "authenticated",
      professional: this.toAccountProfessional(professional)
    };
  }

  // Dados publicos da empresa para a tela de login por URL (/{slug}/login).
  @Get("public/company/:slug")
  async publicCompany(@Param("slug") slug: string) {
    const company = await this.database.findProfessionalBySlug(slug);
    if (!company) {
      throw new NotFoundException("Empresa nao encontrada.");
    }
    return {
      slug: company.slug,
      name: company.name,
      branding: this.toProfessionalBranding(company)
    };
  }

  // Dados do convite (para a pagina de ativacao mostrar de quem e o acesso).
  @Get("auth/team-activation")
  async teamActivationInfo(@Query("token") token?: string) {
    const member = await this.findValidActivationMember(token);
    return { name: member.name, email: member.email };
  }

  // O profissional define a propria senha e ja entra logado.
  @Post("auth/team-activate")
  async teamActivate(
    @Body() input: { token?: string; password?: string },
    @Res({ passthrough: true }) response: Response
  ) {
    if (!input.token || !input.password) {
      throw new BadRequestException("Token e senha sao obrigatorios.");
    }

    this.validatePassword(input.password);
    const member = await this.findValidActivationMember(input.token);
    const passwordHash = await this.auth.hashPassword(input.password);
    const updated = await this.database.setTeamMemberPassword(member.id, passwordHash);
    this.auth.createSession(response, member.professional_id, member.id);

    return {
      status: "activated",
      professional: this.toAccountMember(updated || member)
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
    const session = this.auth.requireSession(request);

    if (session.teamMemberId) {
      const member = await this.database.getTeamMember(session.professionalId, session.teamMemberId);
      if (!member) {
        throw new BadRequestException("Profissional da sessao nao encontrado.");
      }
      return { professional: this.toAccountMember(member) };
    }

    const professional = await this.database.getProfessional(session.professionalId);
    if (!professional) {
      throw new BadRequestException("Profissional da sessao nao encontrado.");
    }

    // Garante o slug (empresas antigas podem nao ter) para montar a URL de login.
    if (!professional.slug) {
      professional.slug = await this.database.ensureProfessionalSlug(professional);
    }

    return {
      professional: this.toAccountProfessional(professional)
    };
  }

  @Get("profile/branding")
  async professionalBranding(@Req() request: Request) {
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
    this.validateBrandingInput(input);
    const professional = await this.database.updateProfessionalBranding(professionalId, input);

    if (!professional) {
      throw new BadRequestException("Profissional da sessao nao encontrado.");
    }

    return this.toProfessionalBranding(professional);
  }

  @Get("profile/assistant")
  async professionalAssistant(@Req() request: Request) {
    const professionalId = this.auth.requireOwner(request);
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

    const professionalId = this.auth.requireOwner(request);
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
    const session = this.requireScopedSession(request, requestedProfessionalId);
    const professional = this.professionals.getById(session.professionalId);
    return this.database.getTodayDashboard(professional.id, professional.timezone, session.teamMemberId);
  }

  @Post("professionals")
  async updateAuthenticatedProfessional(
    @Req() request: Request,
    @Body() input: CreateProfessionalInput
  ) {
    const professionalId = this.auth.requireOwner(request);
    return this.persistProfessional({ ...input, id: professionalId });
  }

  @Get("professionals")
  listProfessionals(@Req() request: Request) {
    const professionalId = this.auth.requireOwner(request);
    return [this.sanitizeProfessional(this.professionals.getById(professionalId))];
  }

  @Get("professionals/:id")
  getProfessional(@Req() request: Request, @Param("id") requestedProfessionalId: string) {
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
    await this.syncWhatsappStatus(professionalId);
    return this.database.getOnboardingStatus(professionalId);
  }

  @Post("onboarding/:professionalId/defaults")
  async onboardingDefaults(
    @Req() request: Request,
    @Param("professionalId") requestedProfessionalId: string
  ) {
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
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
    this.auth.requireOwner(request);
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
    this.auth.requireOwner(request);
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
        const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
    return this.calendar.getAvailabilityForService({ professionalId, serviceId });
  }

  @Get("clients")
  clients(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const session = this.requireScopedSession(request, requestedProfessionalId);
    return session.teamMemberId
      ? this.database.listClientsForTeamMember(session.professionalId, session.teamMemberId)
      : this.database.listClients(session.professionalId);
  }

  @Get("appointments")
  appointments(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string,
    @Query("limit") limit?: string
  ) {
    const session = this.requireScopedSession(request, requestedProfessionalId);
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 100;
    return this.database.listAppointments(session.professionalId, parsedLimit, session.teamMemberId);
  }

  @Get("appointments/upcoming")
  upcomingAppointments(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string,
    @Query("limit") limit?: string
  ) {
    const session = this.requireScopedSession(request, requestedProfessionalId);
    return this.database.listUpcomingAppointments(
      session.professionalId,
      limit ? Number.parseInt(limit, 10) : 20,
      session.teamMemberId
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
      teamMemberId?: string | null;
    }
  ) {
    // Profissional cria agendamento para SI (team_member_id forcado ao da sessao);
    // o dono pode criar para qualquer profissional.
    const session = this.requireScopedSession(request, input.professionalId);
    const payload = await this.buildManualAppointmentPayload(session.professionalId, {
      ...input,
      teamMemberId: session.teamMemberId ?? input.teamMemberId ?? null
    });
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
      teamMemberId?: string | null;
    }
  ) {
    const session = this.requireScopedSession(request, requestedProfessionalId);
    const current = await this.database.getAppointment(session.professionalId, id);

    if (!current) {
      throw new NotFoundException("Atendimento nao encontrado.");
    }

    // Profissional so mexe nos proprios agendamentos.
    if (session.teamMemberId && current.team_member_id !== session.teamMemberId) {
      throw new NotFoundException("Atendimento nao encontrado.");
    }

    const payload = await this.buildManualAppointmentPayload(session.professionalId, {
      clientName: input.clientName || current.client_name || "Cliente",
      clientPhone: input.clientPhone ?? current.client_phone ?? undefined,
      clientEmail: input.clientEmail ?? current.client_email ?? undefined,
      serviceId: input.serviceId,
      serviceName: input.serviceName || current.service_name,
      startsAt: input.startsAt || current.starts_at,
      durationMinutes:
        input.durationMinutes || this.minutesBetween(current.starts_at, current.ends_at),
      valueCents: input.valueCents ?? current.value_cents,
      teamMemberId: session.teamMemberId
        ? session.teamMemberId
        : input.teamMemberId === undefined
          ? current.team_member_id
          : input.teamMemberId
    });

    return this.database.updateAppointment(session.professionalId, id, {
      ...payload,
      status: input.status,
      paymentStatus: input.paymentStatus
    });
  }

  @Delete("appointments/:id")
  async deleteAppointment(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const session = this.requireScopedSession(request, requestedProfessionalId);

    if (session.teamMemberId) {
      const current = await this.database.getAppointment(session.professionalId, id);
      if (!current || current.team_member_id !== session.teamMemberId) {
        throw new NotFoundException("Atendimento nao encontrado.");
      }
    }

    return this.database.deleteAppointment(session.professionalId, id);
  }

  @Get("services")
  services(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string,
    @Query("active") active?: string
  ) {
    // Leitura: o profissional ve apenas os PROPRIOS servicos; o dono ve todos.
    const session = this.requireScopedSession(request, requestedProfessionalId);
    if (session.teamMemberId) {
      return this.database.listServicesForTeamMember(session.professionalId, session.teamMemberId, true);
    }
    return this.database.listServices(session.professionalId, active === "true");
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
      commissionPercent?: number | null;
    }
  ) {
    const professionalId = this.auth.requireOwner(request);
    this.validateServiceInput(input);
    return this.database.createService({
      professionalId,
      category: input.category,
      name: input.name,
      durationMinutes: input.durationMinutes,
      priceCents: input.priceCents,
      active: input.active,
      commissionPercent: input.commissionPercent
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
      commissionPercent?: number | null;
    }
  ) {
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
    return this.database.deleteService(professionalId, id);
  }

  // ------------------------------------------------------------------
  // Comissao do profissional (feat/comissao-profissional)
  // ------------------------------------------------------------------

  @Get("profile/commission")
  async getCommission(@Req() request: Request) {
    const professionalId = this.auth.requireOwner(request);
    return { defaultPercent: await this.database.getDefaultCommission(professionalId) };
  }

  @Patch("profile/commission")
  async updateCommission(@Req() request: Request, @Body() input: { defaultPercent?: number }) {
    const professionalId = this.auth.requireOwner(request);
    if (
      typeof input.defaultPercent !== "number" ||
      input.defaultPercent < 0 ||
      input.defaultPercent > 100
    ) {
      throw new BadRequestException("defaultPercent deve estar entre 0 e 100.");
    }
    const saved = await this.database.setDefaultCommission(professionalId, input.defaultPercent);
    return { defaultPercent: saved ?? input.defaultPercent };
  }

  // Producao do dia por profissional: quantidade, total, parte do profissional e da empresa.
  @Get("reports/production")
  async productionReport(@Req() request: Request, @Query("date") date?: string) {
    const professionalId = this.auth.requireOwner(request);
    const professional = this.professionals.getById(professionalId);
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Intl.DateTimeFormat("en-CA", { timeZone: professional.timezone }).format(new Date());

    const rows = await this.database.getProductionByDay(professionalId, day, professional.timezone);

    type Group = {
      teamMemberId: string | null;
      teamMemberName: string;
      count: number;
      totalCents: number;
      professionalCents: number;
      companyCents: number;
      items: Array<{
        serviceName: string;
        clientName: string | null;
        startsAt: string;
        valueCents: number;
        commissionPercent: number;
        professionalCents: number;
      }>;
    };

    const groups = new Map<string, Group>();
    for (const row of rows) {
      const key = row.team_member_id || "__none__";
      const professionalCents = Math.round((row.value_cents * row.commission_percent) / 100);
      let group = groups.get(key);
      if (!group) {
        group = {
          teamMemberId: row.team_member_id,
          teamMemberName: row.team_member_name || "Sem profissional",
          count: 0,
          totalCents: 0,
          professionalCents: 0,
          companyCents: 0,
          items: []
        };
        groups.set(key, group);
      }
      group.count += 1;
      group.totalCents += row.value_cents;
      group.professionalCents += professionalCents;
      group.companyCents += row.value_cents - professionalCents;
      group.items.push({
        serviceName: row.service_name,
        clientName: row.client_name,
        startsAt: row.starts_at,
        valueCents: row.value_cents,
        commissionPercent: row.commission_percent,
        professionalCents
      });
    }

    const professionals = Array.from(groups.values()).sort((a, b) =>
      a.teamMemberName.localeCompare(b.teamMemberName)
    );

    return {
      date: day,
      totals: {
        count: professionals.reduce((sum, g) => sum + g.count, 0),
        totalCents: professionals.reduce((sum, g) => sum + g.totalCents, 0),
        professionalCents: professionals.reduce((sum, g) => sum + g.professionalCents, 0),
        companyCents: professionals.reduce((sum, g) => sum + g.companyCents, 0)
      },
      professionals
    };
  }

  // ------------------------------------------------------------------
  // Modo Equipes (feat/modo-equipes)
  // ------------------------------------------------------------------

  @Get("profile/team-mode")
  async getTeamMode(@Req() request: Request) {
    const professionalId = this.auth.requireOwner(request);
    return { enabled: await this.database.getTeamMode(professionalId) };
  }

  @Patch("profile/team-mode")
  async setTeamMode(@Req() request: Request, @Body() input: { enabled?: boolean }) {
    if (typeof input.enabled !== "boolean") {
      throw new BadRequestException("enabled precisa ser verdadeiro ou falso.");
    }

    const professionalId = this.auth.requireOwner(request);
    const updated = await this.database.setTeamMode(professionalId, input.enabled);
    return { enabled: updated?.team_mode === true };
  }

  @Get("team-members")
  async listTeamMembers(
    @Req() request: Request,
    @Query("active") active?: string,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwner(request);
    const members = await this.database.listTeamMembers(professionalId, active === "true");
    return Promise.all(members.map((member) => this.decorateTeamMember(professionalId, member)));
  }

  @Post("team-members")
  async createTeamMember(
    @Req() request: Request,
    @Body()
    input: {
      professionalId?: string;
      name?: string;
      phone?: string | null;
      email?: string | null;
      active?: boolean;
      serviceIds?: string[];
    }
  ) {
    const professionalId = this.auth.requireOwner(request);
    if (!input.name?.trim()) {
      throw new BadRequestException("name e obrigatorio.");
    }

    const member = await this.database.createTeamMember({
      professionalId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      active: input.active
    });

    if (!member) {
      throw new BadRequestException("Nao foi possivel cadastrar o profissional.");
    }

    if (Array.isArray(input.serviceIds)) {
      await this.database.setTeamMemberServices(professionalId, member.id, input.serviceIds);
    }

    return this.decorateTeamMember(professionalId, member);
  }

  @Get("team-members/:id")
  async getTeamMemberDetail(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwner(request);
    const member = await this.database.getTeamMember(professionalId, id);

    if (!member) {
      throw new NotFoundException("Profissional nao encontrado.");
    }

    return this.decorateTeamMember(professionalId, member);
  }

  @Patch("team-members/:id")
  async updateTeamMember(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId: string | undefined,
    @Body()
    input: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      active?: boolean;
      serviceIds?: string[];
    }
  ) {
    const professionalId = this.auth.requireOwner(request);
    const member = await this.database.updateTeamMember(professionalId, id, input);

    if (!member) {
      throw new NotFoundException("Profissional nao encontrado.");
    }

    if (Array.isArray(input.serviceIds)) {
      await this.database.setTeamMemberServices(professionalId, member.id, input.serviceIds);
    }

    return this.decorateTeamMember(professionalId, member);
  }

  @Delete("team-members/:id")
  async deleteTeamMember(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwner(request);
    return this.database.deactivateTeamMember(professionalId, id);
  }

  // Gera (ou renova) o link de ativacao de acesso do profissional. So o dono.
  @Post("team-members/:id/invite")
  async inviteTeamMember(@Req() request: Request, @Param("id") id: string) {
    const professionalId = this.auth.requireOwner(request);
    const member = await this.database.getTeamMember(professionalId, id);

    if (!member) {
      throw new NotFoundException("Profissional nao encontrado.");
    }

    if (!member.email) {
      throw new BadRequestException("Cadastre um e-mail para este profissional antes de gerar o acesso.");
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.database.setTeamMemberActivationToken(professionalId, id, token, expiresAt);

    return {
      status: "invite_created",
      teamMemberId: id,
      email: member.email,
      activationUrl: this.appUrl(`/ativar-profissional?token=${token}`),
      expiresAt
    };
  }

  @Get("team-members/:id/services")
  async getTeamMemberServices(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwner(request);
    const member = await this.database.getTeamMember(professionalId, id);

    if (!member) {
      throw new NotFoundException("Profissional nao encontrado.");
    }

    return { serviceIds: await this.database.listTeamMemberServiceIds(id) };
  }

  @Put("team-members/:id/services")
  async setTeamMemberServices(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId: string | undefined,
    @Body() input: { serviceIds?: string[] }
  ) {
    const professionalId = this.auth.requireOwner(request);
    if (!Array.isArray(input.serviceIds)) {
      throw new BadRequestException("serviceIds deve ser uma lista.");
    }

    const serviceIds = await this.database.setTeamMemberServices(
      professionalId,
      id,
      input.serviceIds
    );

    if (serviceIds === undefined) {
      throw new NotFoundException("Profissional nao encontrado.");
    }

    return { serviceIds };
  }

  @Get("team-members/:id/availability")
  async getTeamMemberAvailability(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    const professionalId = this.auth.requireOwner(request);
    const member = await this.database.getTeamMember(professionalId, id);

    if (!member) {
      throw new NotFoundException("Profissional nao encontrado.");
    }

    return this.database.listTeamMemberAvailability(id);
  }

  @Put("team-members/:id/availability")
  async setTeamMemberAvailability(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("professionalId") requestedProfessionalId: string | undefined,
    @Body()
    input: {
      rules?: Array<{
        weekday: number;
        startTime: string;
        endTime: string;
        lunchStart?: string;
        lunchEnd?: string;
        slotIntervalMinutes?: number | null;
        bufferMinutes?: number;
        minimumNoticeMinutes?: number;
        active?: boolean;
      }>;
    }
  ) {
    const professionalId = this.auth.requireOwner(request);
    const member = await this.database.getTeamMember(professionalId, id);

    if (!member) {
      throw new NotFoundException("Profissional nao encontrado.");
    }

    if (!Array.isArray(input.rules)) {
      throw new BadRequestException("rules deve ser uma lista.");
    }

    for (const rule of input.rules) {
      this.validateAvailabilityInput(rule);
      await this.database.upsertTeamMemberAvailabilityRule({
        teamMemberId: id,
        weekday: rule.weekday,
        startTime: rule.startTime,
        endTime: rule.endTime,
        lunchStart: rule.lunchStart,
        lunchEnd: rule.lunchEnd,
        slotIntervalMinutes: rule.slotIntervalMinutes,
        bufferMinutes: rule.bufferMinutes,
        minimumNoticeMinutes: rule.minimumNoticeMinutes,
        active: rule.active
      });
    }

    return this.database.listTeamMemberAvailability(id);
  }

  @Get("availability-rules")
  availabilityRules(
    @Req() request: Request,
    @Query("professionalId") requestedProfessionalId?: string
  ) {
    // Leitura: a equipe le os horarios para montar a agenda (nao edita).
    const session = this.requireScopedSession(request, requestedProfessionalId);
    return this.database.listAvailabilityRules(session.professionalId);
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
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
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
    const professionalId = this.auth.requireOwner(request);
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

  // Nunca expor password_hash/activation_token. Traz o status de acesso do membro.
  private async decorateTeamMember(professionalId: string, member: TeamMemberRecord) {
    void professionalId;
    return {
      id: member.id,
      professional_id: member.professional_id,
      name: member.name,
      phone: member.phone,
      email: member.email,
      active: member.active,
      serviceIds: await this.database.listTeamMemberServiceIds(member.id),
      access: {
        hasPassword: Boolean(member.password_hash),
        activated: Boolean(member.activated_at),
        invitePending: Boolean(member.activation_token) && !member.password_hash
      }
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
      teamMemberId?: string | null;
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
    // Snapshot da comissao: do servico, senao o padrao da empresa.
    const commissionPercent =
      service?.commission_percent ?? (await this.database.getDefaultCommission(professionalId));

    return {
      professionalId,
      clientName: input.clientName.trim(),
      clientPhone: input.clientPhone,
      clientEmail: input.clientEmail,
      serviceName,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      valueCents: service?.price_cents ?? input.valueCents ?? 0,
      teamMemberId: input.teamMemberId ?? null,
      commissionPercent
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
      role: "owner" as const,
      slug: professional.slug || null,
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

  // Conta de um profissional da equipe (acesso restrito). O `id` continua sendo
  // o da empresa (tenant) para chamadas por professionalId; o papel e o vinculo
  // vao em `role` e `teamMemberId`.
  private toAccountMember(member: {
    id: string;
    professional_id: string;
    name: string;
    email?: string | null;
  }) {
    return {
      id: member.professional_id,
      role: "team_member" as const,
      teamMemberId: member.id,
      name: member.name,
      gmail: member.email || "",
      whatsappNumber: "",
      aiEnabled: true
    };
  }

  private requireScopedSession(request: Request, requestedProfessionalId?: string) {
    const session = this.auth.requireSession(request);

    if (requestedProfessionalId && requestedProfessionalId !== session.professionalId) {
      throw new NotFoundException("Recurso nao encontrado para esta sessao.");
    }

    return session;
  }

  private async findValidActivationMember(token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException("Token de ativacao ausente.");
    }

    const member = await this.database.findTeamMemberByActivationToken(token);
    if (!member) {
      throw new NotFoundException("Link de ativacao invalido ou expirado.");
    }

    return member;
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
