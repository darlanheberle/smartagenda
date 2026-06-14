import { Injectable } from "@nestjs/common";
import { CalendarService } from "./calendar.service";
import { EvolutionService } from "./evolution.service";
import { ProfessionalRegistryService } from "./professional-registry.service";
import { EvolutionWebhookPayload, IncomingWhatsAppMessage } from "../types/integrations";

type OfferedSlot = {
  startsAt: string;
  label: string;
};

@Injectable()
export class AiSchedulingService {
  private readonly pendingChoices = new Map<string, OfferedSlot[]>();

  constructor(
    private readonly calendar: CalendarService,
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
    const selectedSlot = this.findSelectedSlot(incoming.text, this.pendingChoices.get(pendingKey));

    if (selectedSlot) {
      const event = await this.calendar.createEvent({
        professionalId: professional.id,
        clientName: incoming.customerName || "Cliente WhatsApp",
        clientPhone: incoming.customerPhone,
        startsAt: selectedSlot.startsAt,
        serviceName: professional.specialty || "Atendimento"
      });
      const created = event.status === "created" || event.status === "mocked_until_google_connected";
      const reply = created
        ? `Perfeito, seu horario ficou agendado para ${selectedSlot.label}.`
        : "Nao consegui criar o evento na agenda agora. Vou pedir para o profissional confirmar manualmente.";

      if (created) {
        this.pendingChoices.delete(pendingKey);
      }

      const whatsapp = await this.evolution.sendTextMessage({
        instanceName: professional.evolutionInstanceName,
        phone: incoming.customerPhone,
        message: reply
      });

      return {
        received: true,
        intent: "confirm_appointment",
        professionalId: professional.id,
        customerPhone: incoming.customerPhone,
        selectedSlot,
        event,
        reply,
        whatsapp
      };
    }

    const availability = await this.calendar.getAvailability(professional.id);
    const slots = "slots" in availability ? availability.slots : [];
    const offeredSlots = slots.slice(0, 6).map((slot) => ({
      startsAt: slot.startsAt,
      label: slot.label
    }));

    if (offeredSlots.length > 0) {
      this.pendingChoices.set(pendingKey, offeredSlots);
    }

    const options = offeredSlots
      .map((slot, index) => `${index + 1}. ${slot.label}`)
      .join("\n");
    const reply = options
      ? `Tenho disponivel:\n\n${options}\n\nResponda com o numero da opcao desejada.`
      : "Nao encontrei horarios livres nos proximos dias. Vou pedir para o profissional verificar a agenda.";

    const whatsapp = await this.evolution.sendTextMessage({
      instanceName: professional.evolutionInstanceName,
      phone: incoming.customerPhone,
      message: reply
    });

    return {
      received: true,
      intent: "schedule_appointment",
      professionalId: professional.id,
      professionalName: professional.name,
      customerPhone: incoming.customerPhone,
      reply,
      availability,
      whatsapp
    };
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
