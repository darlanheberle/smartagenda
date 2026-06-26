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

type PendingFlow =
  | {
      step: "name";
    }
  | {
      step: "category";
      client: ClientRecord;
      categories: string[];
      services: ServiceRecord[];
    }
  | {
      step: "service";
      client: ClientRecord;
      services: ServiceRecord[];
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

  async handleIncomingWhatsAppMessage(payload: EvolutionWebhookPayload) {
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

    const professional = this.professionals.findByEvolutionInstance(incoming.instanceName);

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

    if (pending?.step === "slot") {
      return this.handleSlotChoice({ incoming, pending, pendingKey, professional });
    }

    const client = await this.database.findClientByPhone(professional.id, incoming.customerPhone);

    if (!client) {
      this.pendingChoices.set(pendingKey, { step: "name" });

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
      client
    });
  }

  private async handleNameAnswer(input: {
    incoming: IncomingWhatsAppMessage;
    pendingKey: string;
    professional: {
      id: string;
      evolutionInstanceName: string;
    };
  }) {
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
      client
    });
  }

  private async startSchedulingFlow(input: {
    incoming: IncomingWhatsAppMessage;
    pendingKey: string;
    professionalId: string;
    instanceName: string;
    client: ClientRecord;
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

    const availability = await this.calendar.getAvailabilityForService({
      professionalId: input.professionalId,
      serviceId: selectedService.id
    });
    const slots = "slots" in availability ? availability.slots : [];
    const offeredSlots = slots.slice(0, 6).map((slot) => ({
      startsAt: slot.startsAt,
      label: slot.label
    }));

    if (offeredSlots.length === 0) {
      this.pendingChoices.delete(input.pendingKey);
      return this.reply({
        incoming: input.incoming,
        instanceName: input.incoming.instanceName,
        body: `Nao encontrei horarios livres para ${selectedService.name} nos proximos dias.`
      });
    }

    this.pendingChoices.set(input.pendingKey, {
      step: "slot",
      client: input.pending.client,
      service: selectedService,
      slots: offeredSlots
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `${input.pending.client.name}, tenho estes horarios para ${selectedService.name}:\n\n${this.formatSlotOptions(offeredSlots)}\n\nResponda com o numero do horario desejado.`
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
      return this.reply({
        incoming: input.incoming,
        instanceName: input.professional.evolutionInstanceName,
        body: `Nao encontrei esse horario. Escolha uma das opcoes:\n\n${this.formatSlotOptions(input.pending.slots)}`
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

    return slots.find((slot) => slot.label.toLowerCase() === normalized);
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

  private formatSlotOptions(slots: OfferedSlot[]) {
    return slots.map((slot, index) => `${index + 1}. ${slot.label}`).join("\n");
  }

  private formatCurrency(valueCents: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(valueCents / 100);
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
