import { Injectable } from "@nestjs/common";
import { CalendarService } from "./calendar.service";
import { ClientRecord, DatabaseService, ServiceRecord } from "./database.service";
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
      services: ServiceRecord[];
    }
  | {
      step: "day";
      client: ClientRecord;
      service: ServiceRecord;
      dayOptions: OfferedDay[];
      requestedPeriod?: DateIntent;
    }
  | {
      step: "slot";
      client: ClientRecord;
      service: ServiceRecord;
      slots: OfferedSlot[];
    };

@Injectable()
export class AiSchedulingService {
  private readonly pendingChoices = new Map<string, PendingFlow>();

  constructor(
    private readonly calendar: CalendarService,
    private readonly database: DatabaseService,
    private readonly evolution: EvolutionService,
    private readonly professionals: ProfessionalRegistryService
  ) {}

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
    const pending = this.pendingChoices.get(pendingKey);

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
      return this.handleCategoryChoice({ incoming, pending, pendingKey });
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

    const client = await this.database.findClientByPhone(professional.id, incoming.customerPhone);
    const requestedPeriod = this.parseDateIntent(incoming.text);

    if (!client) {
      this.pendingChoices.set(pendingKey, { step: "name", requestedPeriod });

      return this.reply({
        incoming,
        instanceName: professional.evolutionInstanceName,
        body: "Ola! Para comecar seu atendimento, qual e o seu nome completo?"
      });
    }

    return this.startSchedulingFlow({
      incoming,
      pendingKey,
      professionalId: professional.id,
      instanceName: professional.evolutionInstanceName,
      client,
      requestedPeriod
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
    const pending = this.pendingChoices.get(input.pendingKey);
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
      this.pendingChoices.delete(input.pendingKey);
      return this.reply({
        incoming: input.incoming,
        instanceName: input.professional.evolutionInstanceName,
        body: "Nao consegui salvar seu cadastro agora. Vou pedir para o profissional conferir manualmente."
      });
    }

    this.pendingChoices.delete(input.pendingKey);

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

    if (categories.length > 0) {
      this.pendingChoices.set(input.pendingKey, {
        step: "category",
        client: input.client,
        requestedPeriod: input.requestedPeriod,
        categories,
        services
      });

      return this.reply({
        incoming: input.incoming,
        instanceName: input.instanceName,
        body: `${input.client.name}, qual categoria voce deseja?\n\n${this.formatCategoryOptions(categories)}\n\nResponda com o numero da opcao.`
      });
    }

    this.pendingChoices.set(input.pendingKey, {
      step: "service",
      client: input.client,
      requestedPeriod: input.requestedPeriod,
      services
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.instanceName,
      body: `${input.client.name}, qual servico voce deseja agendar?\n\n${this.formatServiceOptions(services)}\n\nResponda com o numero da opcao.`
    });
  }

  private async handleCategoryChoice(input: {
    incoming: IncomingWhatsAppMessage;
    pending: Extract<PendingFlow, { step: "category" }>;
    pendingKey: string;
  }) {
    const selectedCategory = this.findSelectedCategory(
      input.incoming.text,
      input.pending.categories
    );

    if (!selectedCategory) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei essa categoria. Escolha uma das opcoes:\n\n${this.formatCategoryOptions(input.pending.categories)}`
      });
    }

    const services = input.pending.services.filter(
      (service) => service.category?.toLowerCase() === selectedCategory.toLowerCase()
    );

    this.pendingChoices.set(input.pendingKey, {
      step: "service",
      client: input.pending.client,
      requestedPeriod: input.pending.requestedPeriod,
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
    const selectedService = this.findSelectedService(input.incoming.text, input.pending.services);

    if (!selectedService) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei esse servico. Escolha uma das opcoes:\n\n${this.formatServiceOptions(input.pending.services)}`
      });
    }

    const requestedPeriod = this.parseDateIntent(input.incoming.text) || input.pending.requestedPeriod;
    const availability = await this.calendar.getAvailabilityForService({
      professionalId: input.professionalId,
      serviceId: selectedService.id,
      ...requestedPeriod
    });
    const slots = "slots" in availability ? availability.slots : [];
    const dayOptions = this.buildDayOptions(slots);

    if (dayOptions.length === 0) {
      this.pendingChoices.delete(input.pendingKey);
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei horarios livres para ${selectedService.name} nesse periodo. Voce pode pedir outro dia, por exemplo: "semana que vem" ou "proxima terca".`
      });
    }

    this.pendingChoices.set(input.pendingKey, {
      step: "day",
      client: input.pending.client,
      service: selectedService,
      requestedPeriod,
      dayOptions
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `${input.pending.client.name}, em qual dia voce prefere fazer ${selectedService.name}?\n\n${this.formatDayOptions(dayOptions)}\n\nResponda com o numero do dia.`
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

    this.pendingChoices.set(input.pendingKey, {
      step: "slot",
      client: input.pending.client,
      service: input.pending.service,
      slots: offeredSlots
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `Perfeito. Qual horario de ${selectedDay.label} voce prefere?\n\n${this.formatSlotOptions(offeredSlots, "time")}\n\nResponda com o numero do horario.`
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
      serviceName: input.pending.service.name
    });
    const created = event.status === "created";

    if (created) {
      this.pendingChoices.delete(input.pendingKey);
    }

    const link = "htmlLink" in event && event.htmlLink ? `\n\nLink do evento: ${event.htmlLink}` : "";
    const price =
      input.pending.service.price_cents > 0
        ? `\nValor: ${this.formatCurrency(input.pending.service.price_cents)}`
        : "";
    const body = created
      ? `Perfeito, ${input.pending.client.name}. Agendamento confirmado.\n\nServico: ${input.pending.service.name}\nHorario: ${selectedSlot.label}${price}${link}`
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

  private async reply(input: {
    incoming: IncomingWhatsAppMessage;
    instanceName: string;
    body: string;
    extra?: Record<string, unknown>;
  }) {
    const whatsapp = await this.evolution.sendTextMessage({
      instanceName: input.instanceName,
      phone: input.incoming.customerPhone,
      message: input.body
    });

    return {
      received: true,
      customerPhone: input.incoming.customerPhone,
      reply: input.body,
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
    const availability = await this.calendar.getAvailabilityForService({
      professionalId: input.professionalId,
      serviceId: input.pending.service.id,
      startDate: input.requestedPeriod.startDate,
      daysAhead: input.requestedPeriod.daysAhead
    });
    const slots = "slots" in availability ? availability.slots : [];
    const dayOptions = this.buildDayOptions(slots);

    if (dayOptions.length === 0) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.instanceName,
        body: `Nao encontrei horarios livres para ${input.pending.service.name} em ${input.requestedPeriod.label}. Pode tentar outro periodo?`
      });
    }

    this.pendingChoices.set(input.pendingKey, {
      step: "day",
      client: input.pending.client,
      service: input.pending.service,
      requestedPeriod: input.requestedPeriod,
      dayOptions
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
    const availability = await this.calendar.getAvailabilityForService({
      professionalId: input.professionalId,
      serviceId: input.pending.service.id,
      startDate: input.requestedPeriod.startDate,
      daysAhead: input.requestedPeriod.daysAhead
    });
    const slots = "slots" in availability ? availability.slots : [];
    const dayOptions = this.buildDayOptions(slots);

    if (dayOptions.length === 0) {
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei dias livres para ${input.pending.service.name} em ${input.requestedPeriod.label}. Pode tentar outro periodo?`
      });
    }

    this.pendingChoices.set(input.pendingKey, {
      step: "day",
      client: input.pending.client,
      service: input.pending.service,
      requestedPeriod: input.requestedPeriod,
      dayOptions
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

  private buildDayOptions(slots: OfferedSlot[], maxDays = 7): OfferedDay[] {
    const days = new Map<string, OfferedDay>();

    for (const slot of slots) {
      const dateKey = this.slotDateKey(slot.startsAt);
      const existing = days.get(dateKey);

      if (existing) {
        existing.slots.push(slot);
        continue;
      }

      if (days.size >= maxDays) {
        continue;
      }

      days.set(dateKey, {
        dateKey,
        label: this.formatDayLabel(slot.startsAt),
        slots: [slot]
      });
    }

    return Array.from(days.values()).slice(0, maxDays);
  }

  private pickSlotsForDay(slots: OfferedSlot[], maxSlots = 10) {
    return slots.slice(0, maxSlots).map((slot) => ({
      startsAt: slot.startsAt,
      label: slot.label
    }));
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
        return `${index + 1}. ${day.label} (${count} horario${count === 1 ? "" : "s"})`;
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
    }).format(new Date(startsAt));
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
