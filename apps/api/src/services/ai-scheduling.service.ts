import { Injectable } from "@nestjs/common";
import { CalendarService } from "./calendar.service";
import { ClientRecord, DatabaseService, ServiceRecord, TeamMemberRecord } from "./database.service";
import { EvolutionService } from "./evolution.service";
import { ProfessionalRegistryService } from "./professional-registry.service";
import { EvolutionWebhookPayload, IncomingWhatsAppMessage } from "../types/integrations";

type OfferedSlot = {
  startsAt: string;
  label: string;
};

type OfferedDay = {
  dateKey: string;
  label: string;
  slots: OfferedSlot[];
};

type DateIntent = {
  startDate: string;
  daysAhead: number;
  label: string;
};

type TeamContext = {
  teamMemberId: string;
  teamMemberName: string;
};

type PendingFlow =
  | {
      step: "name";
      requestedPeriod?: DateIntent;
    }
  | {
      step: "category";
      client: ClientRecord;
      requestedPeriod?: DateIntent;
      categories: string[];
      services: ServiceRecord[];
    }
  | {
      step: "service";
      client: ClientRecord;
      requestedPeriod?: DateIntent;
      category?: string;
      services: ServiceRecord[];
    }
  | {
      // Ordem do fluxo (Modo Equipes): nome -> servico -> PROFISSIONAL -> dia -> horario.
      // Aqui ja temos o servico escolhido e listamos quem o realiza.
      step: "team_member";
      client: ClientRecord;
      requestedPeriod?: DateIntent;
      service: ServiceRecord;
      members: TeamMemberRecord[];
    }
  | {
      step: "day";
      client: ClientRecord;
      service: ServiceRecord;
      dayOptions: OfferedDay[];
      requestedPeriod?: DateIntent;
      team?: TeamContext;
    }
  | {
      step: "slot";
      client: ClientRecord;
      service: ServiceRecord;
      slots: OfferedSlot[];
      team?: TeamContext;
    }
  | {
      // Apos confirmar, pergunta se quer agendar outro servico.
      step: "post_booking";
      client: ClientRecord;
    };

@Injectable()
export class AiSchedulingService {
  // Fallback em memoria usado apenas quando o banco nao esta configurado (dev/testes).
  private readonly memoryPending = new Map<string, PendingFlow>();

  constructor(
    private readonly calendar: CalendarService,
    private readonly database: DatabaseService,
    private readonly evolution: EvolutionService,
    private readonly professionals: ProfessionalRegistryService
  ) {}

  // --- Contexto da conversa (Decisao D1-A: persistido no banco) ---
  // Chave: `${professionalId}:${customerPhone}`. Persiste em conversation_states
  // quando ha banco; senao mantem em memoria (dev/testes).
  private splitPendingKey(pendingKey: string) {
    const separatorIndex = pendingKey.indexOf(":");
    return {
      professionalId: pendingKey.slice(0, separatorIndex),
      customerPhone: pendingKey.slice(separatorIndex + 1)
    };
  }

  private async loadPending(pendingKey: string): Promise<PendingFlow | undefined> {
    if (!this.database.isEnabled()) {
      return this.memoryPending.get(pendingKey);
    }

    const { professionalId, customerPhone } = this.splitPendingKey(pendingKey);
    const stored = await this.database.getConversationState<PendingFlow>(
      professionalId,
      customerPhone
    );
    return stored?.state;
  }

  private async savePending(pendingKey: string, flow: PendingFlow): Promise<void> {
    if (!this.database.isEnabled()) {
      this.memoryPending.set(pendingKey, flow);
      return;
    }

    const { professionalId, customerPhone } = this.splitPendingKey(pendingKey);
    await this.database.saveConversationState(
      professionalId,
      customerPhone,
      flow.step,
      flow as unknown as Record<string, unknown>
    );
  }

  private async clearPending(pendingKey: string): Promise<void> {
    if (!this.database.isEnabled()) {
      this.memoryPending.delete(pendingKey);
      return;
    }

    const { professionalId, customerPhone } = this.splitPendingKey(pendingKey);
    await this.database.clearConversationState(professionalId, customerPhone);
  }

  async handleIncomingWhatsAppMessage(payload: EvolutionWebhookPayload, forcedProfessionalId?: string) {
    const incoming = this.normalizeIncomingMessage(payload);

    if (!incoming.isCustomerMessage) {
      return {
        received: true,
        ignored: true,
        reason: incoming.ignoreReason,
        event: payload.event,
        instanceName: incoming.instanceName
      };
    }

    const professional = forcedProfessionalId
      ? this.findProfessionalById(forcedProfessionalId)
      : this.professionals.findByEvolutionInstance(incoming.instanceName);

    if (!professional) {
      return {
        received: true,
        status: "professional_not_found",
        instanceName: incoming.instanceName,
        message: "Cadastre este numero/instancia de WhatsApp antes de atender clientes."
      };
    }

    const pendingKey = `${professional.id}:${incoming.customerPhone}`;
    const storedProfessional = await this.database.getProfessional(professional.id);

    if (storedProfessional?.ai_enabled === false) {
      await this.clearPending(pendingKey);
      return {
        received: true,
        ignored: true,
        status: "assistant_paused",
        professionalId: professional.id,
        instanceName: incoming.instanceName
      };
    }

    const pending = await this.loadPending(pendingKey);
    const teamMode = await this.database.getTeamMode(professional.id);

    if (pending && this.isRestartCommand(incoming.text)) {
      await this.clearPending(pendingKey);
      return this.startFlow({ incoming, pendingKey, professional });
    }

    // Voltar uma etapa (item de navegacao presente em todo o chat).
    if (pending && this.isBackCommand(incoming.text)) {
      return this.handleGoBack({ incoming, pending, pendingKey, professional });
    }

    // Troca de profissional em qualquer momento (item 9): volta a escolha de
    // profissional, mantendo o servico ja selecionado quando houver.
    if (
      teamMode &&
      pending &&
      "service" in pending &&
      "client" in pending &&
      this.isChangeProfessionalCommand(incoming.text)
    ) {
      return this.askTeamMemberForService({
        incoming,
        pendingKey,
        professionalId: professional.id,
        client: pending.client,
        service: pending.service,
        requestedPeriod: "requestedPeriod" in pending ? pending.requestedPeriod : undefined
      });
    }

    if (pending?.step === "post_booking") {
      return this.handlePostBooking({ incoming, pending, pendingKey, professional });
    }

    if (pending?.step === "team_member") {
      return this.handleTeamMemberChoice({ incoming, pending, pendingKey, professional });
    }

    if (pending?.step === "name") {
      return this.handleNameAnswer({
        incoming,
        pendingKey,
        professional: {
          id: professional.id,
          evolutionInstanceName: professional.evolutionInstanceName
        }
      });
    }

    if (pending?.step === "category") {
      return this.handleCategoryChoice({ incoming, pending, pendingKey, professionalId: professional.id });
    }

    if (pending?.step === "service") {
      return this.handleServiceChoice({ incoming, pending, pendingKey, professionalId: professional.id });
    }

    if (pending?.step === "day") {
      return this.handleDayChoice({ incoming, pending, pendingKey, professionalId: professional.id });
    }

    if (pending?.step === "slot") {
      return this.handleSlotChoice({ incoming, pending, pendingKey, professional });
    }

    // Sem contexto: os dois modos comecam igual (nome, se cliente novo -> servico).
    return this.startFlow({ incoming, pendingKey, professional });
  }

  private async startFlow(input: {
    incoming: IncomingWhatsAppMessage;
    pendingKey: string;
    professional: { id: string; evolutionInstanceName: string };
  }) {
    const client = await this.database.findClientByPhone(
      input.professional.id,
      input.incoming.customerPhone
    );
    const requestedPeriod = this.parseDateIntent(input.incoming.text);

    if (!client) {
      await this.savePending(input.pendingKey, { step: "name", requestedPeriod });

      return this.reply({
        incoming: input.incoming,
        instanceName: input.professional.evolutionInstanceName,
        body: "Ola! Para comecar seu atendimento, qual e o seu nome completo?"
      });
    }

    return this.startSchedulingFlow({
      incoming: input.incoming,
      pendingKey: input.pendingKey,
      professionalId: input.professional.id,
      instanceName: input.professional.evolutionInstanceName,
      client,
      requestedPeriod
    });
  }

  // Modo Equipes: apos o servico, lista quem realiza aquele servico (item: mostra
  // os profissionais que prestam o servico). Numeracao corresponde a lista exibida.
  private async askTeamMemberForService(input: {
    incoming: IncomingWhatsAppMessage;
    pendingKey: string;
    professionalId: string;
    client: ClientRecord;
    service: ServiceRecord;
    requestedPeriod?: DateIntent;
  }) {
    const members = await this.database.listTeamMembersForService(
      input.professionalId,
      input.service.id,
      true
    );

    // Ninguem vinculado ao servico: segue sem profissional (fluxo padrao).
    if (members.length === 0) {
      return this.offerDaysForService({
        incoming: input.incoming,
        pendingKey: input.pendingKey,
        professionalId: input.professionalId,
        client: input.client,
        service: input.service,
        requestedPeriod: input.requestedPeriod
      });
    }

    // Um unico profissional realiza o servico: seleciona e ja segue.
    if (members.length === 1) {
      return this.offerDaysForService({
        incoming: input.incoming,
        pendingKey: input.pendingKey,
        professionalId: input.professionalId,
        client: input.client,
        service: input.service,
        requestedPeriod: input.requestedPeriod,
        team: { teamMemberId: members[0].id, teamMemberName: members[0].name },
        announceTeam: true
      });
    }

    await this.savePending(input.pendingKey, {
      step: "team_member",
      client: input.client,
      service: input.service,
      members,
      requestedPeriod: input.requestedPeriod
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `${input.client.name}, com qual profissional voce quer fazer ${input.service.name}?\n\n${this.formatTeamMemberOptions(
        members
      )}\n\nResponda com o numero ou o nome.`,
      nav: true
    });
  }

  private async handleTeamMemberChoice(input: {
    incoming: IncomingWhatsAppMessage;
    pending: Extract<PendingFlow, { step: "team_member" }>;
    pendingKey: string;
    professional: { id: string; evolutionInstanceName: string };
  }) {
    // Resolve contra a lista exibida naquela conversa (numero ou nome).
    const selected = this.findSelectedTeamMember(input.incoming.text, input.pending.members);

    if (!selected) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei essa opcao. Escolha um dos profissionais abaixo:\n\n${this.formatTeamMemberOptions(
          input.pending.members
        )}`
      });
    }

    return this.offerDaysForService({
      incoming: input.incoming,
      pendingKey: input.pendingKey,
      professionalId: input.professional.id,
      client: input.pending.client,
      service: input.pending.service,
      requestedPeriod: input.pending.requestedPeriod,
      team: { teamMemberId: selected.id, teamMemberName: selected.name },
      announceTeam: true
    });
  }

  // Calcula os dias (proximos 7) com horario para o servico (e profissional, se houver).
  private async offerDaysForService(input: {
    incoming: IncomingWhatsAppMessage;
    pendingKey: string;
    professionalId: string;
    client: ClientRecord;
    service: ServiceRecord;
    requestedPeriod?: DateIntent;
    team?: TeamContext;
    announceTeam?: boolean;
  }) {
    const searchPeriod = this.toSevenDaySearchPeriod(input.requestedPeriod);
    const availability = await this.calendar.getAvailabilityForService({
      professionalId: input.professionalId,
      serviceId: input.service.id,
      teamMemberId: input.team?.teamMemberId,
      ...searchPeriod
    });
    const slots = "slots" in availability ? availability.slots : [];
    const dayOptions = this.buildDayOptions(slots, searchPeriod.startDate);
    const announce =
      input.announceTeam && input.team
        ? `Perfeito! Voce escolheu ${input.team.teamMemberName}.\n\n`
        : "";

    if (dayOptions.length === 0) {
      await this.clearPending(input.pendingKey);
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `${announce}Nao encontrei horarios livres para ${input.service.name} nesse periodo. Voce pode pedir outro dia, por exemplo: "semana que vem" ou "proxima terca".`
      });
    }

    await this.savePending(input.pendingKey, {
      step: "day",
      client: input.client,
      service: input.service,
      requestedPeriod: input.requestedPeriod,
      dayOptions,
      team: input.team
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `${announce}${input.client.name}, em qual dia voce prefere fazer ${input.service.name}?\n\n${this.formatDayOptions(dayOptions)}\n\nResponda com o numero do dia.`,
      nav: true
    });
  }

  private findProfessionalById(professionalId: string) {
    try {
      return this.professionals.getById(professionalId);
    } catch {
      return undefined;
    }
  }

  private async handleNameAnswer(input: {
    incoming: IncomingWhatsAppMessage;
    pendingKey: string;
      professional: {
        id: string;
        evolutionInstanceName: string;
      };
  }) {
    const pending = await this.loadPending(input.pendingKey);
    const name = this.normalizeClientName(input.incoming.text);

    if (!name) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.professional.evolutionInstanceName,
        body: "Nao consegui identificar seu nome. Por favor, envie seu nome completo para continuar."
      });
    }

    const client = await this.database.upsertClient({
      professionalId: input.professional.id,
      name,
      phone: input.incoming.customerPhone
    });

    if (!client) {
      await this.clearPending(input.pendingKey);
      return this.reply({
        incoming: input.incoming,
        instanceName: input.professional.evolutionInstanceName,
        body: "Nao consegui salvar seu cadastro agora. Vou pedir para o profissional conferir manualmente."
      });
    }

    await this.clearPending(input.pendingKey);

    return this.startSchedulingFlow({
      incoming: input.incoming,
      pendingKey: input.pendingKey,
      professionalId: input.professional.id,
      instanceName: input.professional.evolutionInstanceName,
      client,
      requestedPeriod: pending?.step === "name" ? pending.requestedPeriod : undefined
    });
  }

  private async startSchedulingFlow(input: {
    incoming: IncomingWhatsAppMessage;
    pendingKey: string;
    professionalId: string;
    instanceName: string;
    client: ClientRecord;
    requestedPeriod?: DateIntent;
  }) {
    const services = await this.database.listServices(input.professionalId, true);

    if (services.length === 0) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.instanceName,
        body: "Ainda nao ha servicos cadastrados para agendamento. Vou pedir para o profissional configurar."
      });
    }

    const categories = this.getServiceCategories(services);
    // So usa a etapa de categoria quando TODOS os servicos tem categoria; caso
    // contrario, servicos sem categoria ficariam inacessiveis. Nesse caso lista
    // todos os servicos direto (nome -> servico -> profissional -> dia -> horario).
    const allCategorized = services.every((service) => Boolean(service.category && service.category.trim()));

    if (categories.length > 0 && allCategorized) {
      await this.savePending(input.pendingKey, {
        step: "category",
        client: input.client,
        requestedPeriod: input.requestedPeriod,
        categories,
        services
      });

      return this.reply({
        incoming: input.incoming,
        instanceName: input.instanceName,
        body: `${input.client.name}, qual categoria voce deseja?\n\n${this.formatCategoryOptions(categories)}\n\nResponda com o numero da opcao.`,
        nav: true
      });
    }

    await this.savePending(input.pendingKey, {
      step: "service",
      client: input.client,
      requestedPeriod: input.requestedPeriod,
      services
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.instanceName,
      body: `${input.client.name}, qual servico voce deseja agendar?\n\n${this.formatServiceOptions(services)}\n\nResponda com o numero da opcao.`,
      nav: true
    });
  }

  private async handleCategoryChoice(input: {
    incoming: IncomingWhatsAppMessage;
    pending: Extract<PendingFlow, { step: "category" }>;
    pendingKey: string;
    professionalId: string;
  }) {
    const currentServices = await this.database.listServices(input.professionalId, true);
    const categories = this.getServiceCategories(currentServices);
    const selectedCategory = this.findSelectedCategory(
      input.incoming.text,
      categories
    );

    if (!selectedCategory) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei essa categoria. Escolha uma das opcoes:\n\n${this.formatCategoryOptions(categories)}`
      });
    }

    const services = this.filterServicesByCategory(currentServices, selectedCategory);

    await this.savePending(input.pendingKey, {
      step: "service",
      client: input.pending.client,
      requestedPeriod: input.pending.requestedPeriod,
      category: selectedCategory,
      services
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `Certo, ${input.pending.client.name}. Qual servico de ${selectedCategory} voce deseja?\n\n${this.formatServiceOptions(services)}\n\nResponda com o numero da opcao.`
    });
  }

  private async handleServiceChoice(input: {
    incoming: IncomingWhatsAppMessage;
    pending: Extract<PendingFlow, { step: "service" }>;
    pendingKey: string;
    professionalId: string;
  }) {
    const services = await this.refreshPendingServices(input.professionalId, input.pending);
    const selectedService = this.findSelectedService(input.incoming.text, services);

    if (!selectedService) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei esse servico. Escolha uma das opcoes:\n\n${this.formatServiceOptions(services)}`
      });
    }

    const requestedPeriod = this.parseDateIntent(input.incoming.text) || input.pending.requestedPeriod;
    const teamMode = await this.database.getTeamMode(input.professionalId);

    // Modo Equipes: depois do servico, pergunta QUEM realiza aquele servico.
    if (teamMode) {
      return this.askTeamMemberForService({
        incoming: input.incoming,
        pendingKey: input.pendingKey,
        professionalId: input.professionalId,
        client: input.pending.client,
        service: selectedService,
        requestedPeriod
      });
    }

    // Fluxo padrao (sem equipes): servico -> dia.
    return this.offerDaysForService({
      incoming: input.incoming,
      pendingKey: input.pendingKey,
      professionalId: input.professionalId,
      client: input.pending.client,
      service: selectedService,
      requestedPeriod
    });
  }

  private async handleDayChoice(input: {
    incoming: IncomingWhatsAppMessage;
    pending: Extract<PendingFlow, { step: "day" }>;
    pendingKey: string;
    professionalId: string;
  }) {
    const selectedDay = this.findSelectedDay(input.incoming.text, input.pending.dayOptions);

    if (!selectedDay) {
      const requestedPeriod = this.parseDateIntent(input.incoming.text);

      if (requestedPeriod) {
        return this.offerDaysForRequestedPeriod({
          incoming: input.incoming,
          pending: input.pending,
          pendingKey: input.pendingKey,
          professionalId: input.professionalId,
          requestedPeriod
        });
      }

      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei esse dia. Escolha uma das opcoes ou diga outro dia, como "quinta" ou "semana que vem":\n\n${this.formatDayOptions(input.pending.dayOptions)}`
      });
    }

    const offeredSlots = this.pickSlotsForDay(selectedDay.slots);

    if (offeredSlots.length === 0) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `${selectedDay.label} esta fechado ou sem horarios livres para esse servico.\n\nEscolha outro dia:\n\n${this.formatDayOptions(input.pending.dayOptions)}`
      });
    }

    await this.savePending(input.pendingKey, {
      step: "slot",
      client: input.pending.client,
      service: input.pending.service,
      slots: offeredSlots,
      team: input.pending.team
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `Perfeito. Qual horario de ${selectedDay.label} voce prefere?\n\n${this.formatSlotOptions(offeredSlots, "time")}\n\nResponda com o numero do horario.`,
      nav: true
    });
  }

  private async handleSlotChoice(input: {
    incoming: IncomingWhatsAppMessage;
    pending: Extract<PendingFlow, { step: "slot" }>;
    pendingKey: string;
    professional: {
      id: string;
      specialty?: string;
      evolutionInstanceName: string;
    };
  }) {
    const selectedSlot = this.findSelectedSlot(input.incoming.text, input.pending.slots);

    if (!selectedSlot) {
      const requestedPeriod = this.parseDateIntent(input.incoming.text);

      if (requestedPeriod) {
        return this.offerSlotsForRequestedPeriod({
          incoming: input.incoming,
          pending: input.pending,
          pendingKey: input.pendingKey,
          professionalId: input.professional.id,
          instanceName: input.professional.evolutionInstanceName,
          requestedPeriod
        });
      }

      return this.reply({
        incoming: input.incoming,
        instanceName: input.professional.evolutionInstanceName,
        body: `Nao encontrei esse horario. Escolha uma das opcoes ou peça outro periodo, como "semana que vem":\n\n${this.formatSlotOptions(input.pending.slots)}`
      });
    }

    const event = await this.calendar.createEvent({
      professionalId: input.professional.id,
      clientName: input.pending.client.name,
      clientPhone: input.incoming.customerPhone,
      startsAt: selectedSlot.startsAt,
      serviceId: input.pending.service.id,
      serviceName: input.pending.service.name,
      teamMemberId: input.pending.team?.teamMemberId
    });
    const created = event.status === "created";

    if (created) {
      // Mantem o cliente no contexto para oferecer um novo agendamento.
      await this.savePending(input.pendingKey, {
        step: "post_booking",
        client: input.pending.client
      });
    }

    const link = "htmlLink" in event && event.htmlLink ? `\n\nLink do evento: ${event.htmlLink}` : "";
    const price =
      input.pending.service.price_cents > 0
        ? `\nValor: ${this.formatCurrency(input.pending.service.price_cents)}`
        : "";
    const professionalLine = input.pending.team
      ? `\nProfissional: ${input.pending.team.teamMemberName}`
      : "";
    const followUp = "\n\nDeseja agendar mais algum servico?\n1 - Sim\n2 - Nao";
    const body = created
      ? `Perfeito, ${input.pending.client.name}. Agendamento confirmado.${professionalLine}\nServico: ${input.pending.service.name}\nHorario: ${selectedSlot.label}${price}${link}${followUp}`
      : "Nao consegui criar o evento na agenda agora. Vou pedir para o profissional confirmar manualmente.";

    return this.reply({
      incoming: input.incoming,
      instanceName: input.professional.evolutionInstanceName,
      body,
      extra: {
        intent: "confirm_appointment",
        selectedSlot,
        client: input.pending.client,
        service: input.pending.service,
        event
      }
    });
  }

  private async handlePostBooking(input: {
    incoming: IncomingWhatsAppMessage;
    pending: Extract<PendingFlow, { step: "post_booking" }>;
    pendingKey: string;
    professional: { id: string; evolutionInstanceName: string };
  }) {
    const normalized = this.normalizeText(input.incoming.text);
    const wantsMore = ["1", "sim", "s", "quero", "claro", "isso"].includes(normalized);
    const wantsToStop = ["2", "nao", "n", "encerrar", "finalizar", "obrigado", "obrigada"].includes(
      normalized
    );

    if (wantsMore) {
      // Volta ao inicio do agendamento (mantendo o cliente): escolha de servico.
      return this.startSchedulingFlow({
        incoming: input.incoming,
        pendingKey: input.pendingKey,
        professionalId: input.professional.id,
        instanceName: input.professional.evolutionInstanceName,
        client: input.pending.client
      });
    }

    if (wantsToStop) {
      await this.clearPending(input.pendingKey);
      return this.reply({
        incoming: input.incoming,
        instanceName: input.professional.evolutionInstanceName,
        body: `Perfeito, ${input.pending.client.name}! Seu agendamento esta confirmado. Ate breve. 😊`
      });
    }

    return this.reply({
      incoming: input.incoming,
      instanceName: input.professional.evolutionInstanceName,
      body: "Deseja agendar mais algum servico?\n1 - Sim\n2 - Nao"
    });
  }

  // Volta uma etapa do fluxo com base no passo atual.
  private async handleGoBack(input: {
    incoming: IncomingWhatsAppMessage;
    pending: PendingFlow;
    pendingKey: string;
    professional: { id: string; evolutionInstanceName: string };
  }) {
    const p = input.pending;
    const professionalId = input.professional.id;

    // horario -> volta para a escolha do dia
    if (p.step === "slot") {
      return this.offerDaysForService({
        incoming: input.incoming,
        pendingKey: input.pendingKey,
        professionalId,
        client: p.client,
        service: p.service,
        team: p.team
      });
    }

    // dia -> volta para o profissional (se houver) ou para o servico
    if (p.step === "day") {
      if (p.team) {
        return this.askTeamMemberForService({
          incoming: input.incoming,
          pendingKey: input.pendingKey,
          professionalId,
          client: p.client,
          service: p.service
        });
      }
      return this.startSchedulingFlow({
        incoming: input.incoming,
        pendingKey: input.pendingKey,
        professionalId,
        instanceName: input.professional.evolutionInstanceName,
        client: p.client
      });
    }

    // profissional -> volta para o servico
    if (p.step === "team_member") {
      return this.startSchedulingFlow({
        incoming: input.incoming,
        pendingKey: input.pendingKey,
        professionalId,
        instanceName: input.professional.evolutionInstanceName,
        client: p.client
      });
    }

    // nome/categoria/servico/pos-agendamento -> recomeca do inicio
    await this.clearPending(input.pendingKey);
    return this.startFlow({
      incoming: input.incoming,
      pendingKey: input.pendingKey,
      professional: input.professional
    });
  }

  private async reply(input: {
    incoming: IncomingWhatsAppMessage;
    instanceName: string;
    body: string;
    extra?: Record<string, unknown>;
    nav?: boolean;
  }) {
    // Rodape de navegacao: opcao de voltar uma etapa ou recomecar do inicio.
    const body = input.nav
      ? `${input.body}\n\n_Responda *voltar* para a etapa anterior ou *menu* para recomecar._`
      : input.body;

    const whatsapp = await this.evolution.sendTextMessage({
      instanceName: input.instanceName,
      phone: input.incoming.customerPhone,
      message: body
    });

    return {
      received: true,
      customerPhone: input.incoming.customerPhone,
      reply: body,
      whatsapp,
      ...input.extra
    };
  }

  private async offerSlotsForRequestedPeriod(input: {
    incoming: IncomingWhatsAppMessage;
    pending: Extract<PendingFlow, { step: "slot" }>;
    pendingKey: string;
    professionalId: string;
    instanceName: string;
    requestedPeriod: DateIntent;
  }) {
    const searchPeriod = this.toSevenDaySearchPeriod(input.requestedPeriod);
    const availability = await this.calendar.getAvailabilityForService({
      professionalId: input.professionalId,
      serviceId: input.pending.service.id,
      teamMemberId: input.pending.team?.teamMemberId,
      startDate: searchPeriod.startDate,
      daysAhead: searchPeriod.daysAhead
    });
    const slots = "slots" in availability ? availability.slots : [];
    const dayOptions = this.buildDayOptions(slots, searchPeriod.startDate);

    if (dayOptions.length === 0) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.instanceName,
        body: `Nao encontrei horarios livres para ${input.pending.service.name} em ${input.requestedPeriod.label}. Pode tentar outro periodo?`
      });
    }

    await this.savePending(input.pendingKey, {
      step: "day",
      client: input.pending.client,
      service: input.pending.service,
      requestedPeriod: input.requestedPeriod,
      dayOptions,
      team: input.pending.team
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.instanceName,
      body: `${input.pending.client.name}, encontrei estes dias para ${input.requestedPeriod.label}:\n\n${this.formatDayOptions(dayOptions)}\n\nResponda com o numero do dia.`
    });
  }

  private async offerDaysForRequestedPeriod(input: {
    incoming: IncomingWhatsAppMessage;
    pending: Extract<PendingFlow, { step: "day" }>;
    pendingKey: string;
    professionalId: string;
    requestedPeriod: DateIntent;
  }) {
    const searchPeriod = this.toSevenDaySearchPeriod(input.requestedPeriod);
    const availability = await this.calendar.getAvailabilityForService({
      professionalId: input.professionalId,
      serviceId: input.pending.service.id,
      teamMemberId: input.pending.team?.teamMemberId,
      startDate: searchPeriod.startDate,
      daysAhead: searchPeriod.daysAhead
    });
    const slots = "slots" in availability ? availability.slots : [];
    const dayOptions = this.buildDayOptions(slots, searchPeriod.startDate);

    if (dayOptions.length === 0) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei dias livres para ${input.pending.service.name} em ${input.requestedPeriod.label}. Pode tentar outro periodo?`
      });
    }

    await this.savePending(input.pendingKey, {
      step: "day",
      client: input.pending.client,
      service: input.pending.service,
      requestedPeriod: input.requestedPeriod,
      dayOptions,
      team: input.pending.team
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `${input.pending.client.name}, encontrei estes dias para ${input.requestedPeriod.label}:\n\n${this.formatDayOptions(dayOptions)}\n\nResponda com o numero do dia.`
    });
  }

  private findSelectedService(text: string, services: ServiceRecord[]) {
    const normalized = text.trim().toLowerCase();
    const numericChoice = Number.parseInt(normalized, 10);

    if (
      Number.isInteger(numericChoice) &&
      numericChoice >= 1 &&
      numericChoice <= services.length
    ) {
      return services[numericChoice - 1];
    }

    return services.find((service) => service.name.toLowerCase() === normalized);
  }

  private async refreshPendingServices(
    professionalId: string,
    pending: Extract<PendingFlow, { step: "service" }>
  ) {
    const services = await this.database.listServices(professionalId, true);

    if (!pending.category) {
      return services;
    }

    return this.filterServicesByCategory(services, pending.category);
  }

  private filterServicesByCategory(services: ServiceRecord[], category: string) {
    const normalizedCategory = this.normalizeText(category);

    return services.filter((service) => {
      const serviceCategory = service.category ? this.normalizeText(service.category) : "";
      return serviceCategory === normalizedCategory;
    });
  }

  private buildDayOptions(slots: OfferedSlot[], startDate?: string, maxDays = 7): OfferedDay[] {
    const slotsByDay = new Map<string, OfferedSlot[]>();

    for (const slot of slots) {
      const dateKey = this.slotDateKey(slot.startsAt);
      const existing = slotsByDay.get(dateKey) || [];
      existing.push(slot);
      slotsByDay.set(dateKey, existing);
    }

    const startDateKey = startDate
      ? this.slotDateKey(startDate)
      : this.slotDateKey(new Date().toISOString());
    const firstDay = new Date(`${startDateKey}T12:00:00-03:00`);

    return Array.from({ length: maxDays }, (_, index) => {
      const day = this.addDays(firstDay, index);
      const startsAt = day.toISOString();
      const dateKey = this.slotDateKey(startsAt);

      return {
        dateKey,
        label: this.formatDayLabel(startsAt),
        slots: slotsByDay.get(dateKey) || []
      };
    });
  }

  private pickSlotsForDay(slots: OfferedSlot[], maxSlots = 48) {
    return slots.slice(0, maxSlots).map((slot) => ({
      startsAt: slot.startsAt,
      label: slot.label
    }));
  }

  private toSevenDaySearchPeriod(requestedPeriod?: DateIntent) {
    return {
      startDate: requestedPeriod?.startDate,
      daysAhead: Math.max(requestedPeriod?.daysAhead || 7, 7)
    };
  }

  private parseDateIntent(text: string): DateIntent | undefined {
    const normalized = this.normalizeText(text);
    const now = new Date();
    const requestedWeekday = this.findRequestedWeekday(normalized);
    const isNextWeek =
      normalized.includes("semana que vem") || normalized.includes("proxima semana");

    if (requestedWeekday !== undefined && isNextWeek) {
      const start = this.weekdayInNextWeek(now, requestedWeekday);

      return {
        startDate: start.toISOString(),
        daysAhead: 1,
        label: `${this.weekdayName(requestedWeekday)} da semana que vem`
      };
    }

    if (requestedWeekday !== undefined) {
      const nextDate = this.nextWeekday(now, requestedWeekday, normalized.includes("proxima"));
      return {
        startDate: this.startOfDay(nextDate).toISOString(),
        daysAhead: 1,
        label: this.weekdayName(requestedWeekday)
      };
    }

    if (isNextWeek) {
      const start = this.startOfNextWeek(now);
      return {
        startDate: start.toISOString(),
        daysAhead: 7,
        label: "semana que vem"
      };
    }

    if (normalized.includes("amanha")) {
      const start = this.startOfDay(this.addDays(now, 1));
      return {
        startDate: start.toISOString(),
        daysAhead: 1,
        label: "amanha"
      };
    }

    return undefined;
  }

  private findRequestedWeekday(text: string) {
    const weekdays = [
      ["domingo", 0],
      ["segunda", 1],
      ["terca", 2],
      ["terça", 2],
      ["quarta", 3],
      ["quinta", 4],
      ["sexta", 5],
      ["sabado", 6],
      ["sábado", 6]
    ] as const;

    return weekdays.find(([name]) => text.includes(name))?.[1];
  }

  private nextWeekday(from: Date, weekday: number, forceFollowingWeek = false) {
    const date = new Date(from);
    const current = date.getDay();
    let diff = (weekday - current + 7) % 7;

    if (diff === 0 || forceFollowingWeek) {
      diff += 7;
    }

    return this.addDays(date, diff);
  }

  private startOfNextWeek(from: Date) {
    const date = new Date(from);
    const current = date.getDay();
    const daysUntilNextMonday = ((1 - current + 7) % 7) || 7;
    return this.startOfDay(this.addDays(date, daysUntilNextMonday));
  }

  private weekdayInNextWeek(from: Date, weekday: number) {
    const nextMonday = this.startOfNextWeek(from);
    const offsetFromMonday = (weekday - 1 + 7) % 7;

    return this.startOfDay(this.addDays(nextMonday, offsetFromMonday));
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private startOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private weekdayName(weekday: number) {
    return ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][weekday];
  }

  private normalizeText(text: string) {
    return text
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  private isRestartCommand(text: string) {
    const normalized = this.normalizeText(text);
    return ["menu", "reiniciar", "iniciar", "inicio", "comecar", "recomecar"].includes(normalized);
  }

  // Comando de navegacao: voltar uma etapa.
  private isBackCommand(text: string) {
    const normalized = this.normalizeText(text);
    return ["voltar", "volta", "anterior", "0"].includes(normalized);
  }

  // Item 9: comando para trocar o profissional durante o fluxo.
  private isChangeProfessionalCommand(text: string) {
    const normalized = this.normalizeText(text);
    return (
      normalized.includes("trocar profissional") ||
      normalized.includes("mudar profissional") ||
      normalized.includes("outro profissional") ||
      normalized === "trocar" ||
      normalized === "profissional"
    );
  }

  private formatTeamMemberOptions(members: TeamMemberRecord[]) {
    return members.map((member, index) => `${index + 1} - ${member.name}`).join("\n");
  }

  // Itens 11, 12 e 13: resolve a escolha por numero OU nome; ambiguidade => nao seleciona.
  private findSelectedTeamMember(text: string, members: TeamMemberRecord[]) {
    const normalized = this.normalizeText(text);
    const numericChoice = Number.parseInt(normalized, 10);

    if (
      Number.isInteger(numericChoice) &&
      numericChoice >= 1 &&
      numericChoice <= members.length
    ) {
      return members[numericChoice - 1];
    }

    const byName = members.filter((member) => {
      const name = this.normalizeText(member.name);
      return name === normalized || name.split(" ")[0] === normalized;
    });

    return byName.length === 1 ? byName[0] : undefined;
  }

  private normalizeClientName(text: string) {
    const name = text
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[<>]/g, "");

    if (name.length < 2 || /^\d+$/.test(name)) {
      return undefined;
    }

    return name;
  }

  private findSelectedCategory(text: string, categories: string[]) {
    const normalized = text.trim().toLowerCase();
    const numericChoice = Number.parseInt(normalized, 10);

    if (
      Number.isInteger(numericChoice) &&
      numericChoice >= 1 &&
      numericChoice <= categories.length
    ) {
      return categories[numericChoice - 1];
    }

    return categories.find((category) => category.toLowerCase() === normalized);
  }

  private findSelectedSlot(text: string, slots?: OfferedSlot[]) {
    if (!slots?.length) {
      return undefined;
    }

    const normalized = text.trim().toLowerCase();
    const numericChoice = Number.parseInt(normalized, 10);

    if (
      Number.isInteger(numericChoice) &&
      numericChoice >= 1 &&
      numericChoice <= slots.length
    ) {
      return slots[numericChoice - 1];
    }

    return slots.find((slot) => {
      const label = slot.label.toLowerCase();
      const time = this.formatTimeLabel(slot.startsAt).toLowerCase();
      return label === normalized || time === normalized;
    });
  }

  private findSelectedDay(text: string, days: OfferedDay[]) {
    const normalized = this.normalizeText(text);
    const numericChoice = Number.parseInt(normalized, 10);

    if (
      Number.isInteger(numericChoice) &&
      numericChoice >= 1 &&
      numericChoice <= days.length
    ) {
      return days[numericChoice - 1];
    }

    const requestedWeekday = this.findRequestedWeekday(normalized);
    if (requestedWeekday !== undefined) {
      return days.find((day) => new Date(`${day.dateKey}T12:00:00`).getDay() === requestedWeekday);
    }

    return days.find((day) => this.normalizeText(day.label) === normalized);
  }

  private formatServiceOptions(services: ServiceRecord[]) {
    return services
      .map((service, index) => {
        const price =
          service.price_cents > 0 ? ` - ${this.formatCurrency(service.price_cents)}` : "";
        return `${index + 1}. ${service.name} (${service.duration_minutes} min)${price}`;
      })
      .join("\n");
  }

  private getServiceCategories(services: ServiceRecord[]) {
    return Array.from(
      new Set(
        services
          .map((service) => service.category?.trim())
          .filter((category): category is string => Boolean(category))
      )
    );
  }

  private formatCategoryOptions(categories: string[]) {
    return categories.map((category, index) => `${index + 1}. ${category}`).join("\n");
  }

  private formatDayOptions(days: OfferedDay[]) {
    return days
      .map((day, index) => {
        const count = day.slots.length;
        const availabilityLabel =
          count > 0 ? `${count} horario${count === 1 ? "" : "s"}` : "fechado";
        return `${index + 1}. ${day.label} (${availabilityLabel})`;
      })
      .join("\n");
  }

  private formatSlotOptions(slots: OfferedSlot[], mode: "full" | "time" = "full") {
    return slots
      .map((slot, index) => {
        const label = mode === "time" ? this.formatTimeLabel(slot.startsAt) : slot.label;
        return `${index + 1}. ${label}`;
      })
      .join("\n");
  }

  private formatCurrency(valueCents: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(valueCents / 100);
  }

  private slotDateKey(startsAt: string) {
    return new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
      year: "numeric"
    }).format(new Date(startsAt));
  }

  private formatDayLabel(startsAt: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
      weekday: "long"
    })
      .format(new Date(startsAt))
      .replace(",", "");
  }

  private formatTimeLabel(startsAt: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    }).format(new Date(startsAt));
  }

  private normalizeIncomingMessage(payload: EvolutionWebhookPayload): IncomingWhatsAppMessage {
    const remoteJid = payload?.data?.key?.remoteJid || payload.phone || "unknown";
    const text =
      payload.data?.message?.conversation ||
      payload.data?.message?.extendedTextMessage?.text ||
      "";
    const isFromMe = Boolean(payload.data?.key?.fromMe);
    const isMessageEvent =
      !payload.event || payload.event === "messages.upsert" || payload.event === "MESSAGES_UPSERT";
    const isCustomerMessage =
      isMessageEvent && !isFromMe && remoteJid !== "unknown" && text.trim().length > 0;

    return {
      instanceName:
        payload.instance ||
        payload.instanceName ||
        payload.data?.instance ||
        process.env.EVOLUTION_INSTANCE_NAME ||
        "smartagenda_teste",
      customerPhone: remoteJid.replace("@s.whatsapp.net", ""),
      customerName: payload.data?.pushName,
      text,
      isCustomerMessage,
      ignoreReason: isCustomerMessage
        ? undefined
        : !isMessageEvent
          ? "not_a_message_event"
          : isFromMe
            ? "message_from_bot"
            : text.trim().length === 0
              ? "empty_message"
              : "missing_customer_phone"
    };
  }
}
