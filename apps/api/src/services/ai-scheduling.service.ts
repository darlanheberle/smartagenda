import { Injectable } from "@nestjs/common";
import { CalendarService } from "./calendar.service";
import { DatabaseService, ServiceRecord } from "./database.service";
import { EvolutionService } from "./evolution.service";
import { ProfessionalRegistryService } from "./professional-registry.service";
import { EvolutionWebhookPayload, IncomingWhatsAppMessage } from "../types/integrations";

type OfferedSlot = {
  startsAt: string;
  label: string;
};

type PendingFlow =
  | {
      step: "category";
      categories: string[];
      services: ServiceRecord[];
    }
  | {
      step: "service";
      services: ServiceRecord[];
    }
  | {
      step: "slot";
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

    await this.database.upsertClient({
      professionalId: professional.id,
      name: incoming.customerName || "Cliente WhatsApp",
      phone: incoming.customerPhone
    });

    const pendingKey = `${professional.id}:${incoming.customerPhone}`;
    const pending = this.pendingChoices.get(pendingKey);

    if (pending?.step === "category") {
      return this.handleCategoryChoice({ incoming, pending, pendingKey });
    }

    if (pending?.step === "service") {
      return this.handleServiceChoice({ incoming, pending, pendingKey, professionalId: professional.id });
    }

    if (pending?.step === "slot") {
      return this.handleSlotChoice({ incoming, pending, pendingKey, professional });
    }

    const services = await this.database.listServices(professional.id, true);

    if (services.length === 0) {
      return this.reply({
        incoming,
        instanceName: professional.evolutionInstanceName,
        body: "Ainda nao ha servicos cadastrados para agendamento. Vou pedir para o profissional configurar."
      });
    }

    const categories = this.getServiceCategories(services);

    if (categories.length > 0) {
      this.pendingChoices.set(pendingKey, { step: "category", categories, services });

      return this.reply({
        incoming,
        instanceName: professional.evolutionInstanceName,
        body: `Qual categoria voce deseja?\n\n${this.formatCategoryOptions(categories)}\n\nResponda com o numero da opcao.`
      });
    }

    this.pendingChoices.set(pendingKey, { step: "service", services });

    return this.reply({
      incoming,
      instanceName: professional.evolutionInstanceName,
      body: `Qual servico voce deseja agendar?\n\n${this.formatServiceOptions(services)}\n\nResponda com o numero da opcao.`
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

    this.pendingChoices.set(input.pendingKey, { step: "service", services });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `Certo. Qual servico de ${selectedCategory} voce deseja?\n\n${this.formatServiceOptions(services)}\n\nResponda com o numero da opcao.`
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
      service: selectedService,
      slots: offeredSlots
    });

    return this.reply({
      incoming: input.incoming,
      instanceName: input.incoming.instanceName,
      body: `Tenho estes horarios para ${selectedService.name}:\n\n${this.formatSlotOptions(offeredSlots)}\n\nResponda com o numero do horario desejado.`
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
      clientName: input.incoming.customerName || "Cliente WhatsApp",
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
      ? `Perfeito, agendamento confirmado.\n\nServico: ${input.pending.service.name}\nHorario: ${selectedSlot.label}${price}${link}`
      : "Nao consegui criar o evento na agenda agora. Vou pedir para o profissional confirmar manualmente.";

    return this.reply({
      incoming: input.incoming,
      instanceName: input.professional.evolutionInstanceName,
      body,
      extra: {
        intent: "confirm_appointment",
        selectedSlot,
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
