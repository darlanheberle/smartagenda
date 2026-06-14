import { Injectable } from "@nestjs/common";
import { CalendarService } from "./calendar.service";
import { EvolutionService } from "./evolution.service";
import { ProfessionalRegistryService } from "./professional-registry.service";
import { EvolutionWebhookPayload, IncomingWhatsAppMessage } from "../types/integrations";

@Injectable()
export class AiSchedulingService {
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
        message: "Cadastre este número/instância de WhatsApp antes de atender clientes."
      };
    }

    const availability = await this.calendar.getAvailability(professional.id);
    const slots = "slots" in availability ? availability.slots : [];
    const options = slots.map((slot) => slot.label).join("\n");
    const reply = options
      ? `Tenho disponível:\n\n${options}\n\nQual horário você prefere?`
      : "Estou verificando a agenda e já retorno com os melhores horários.";

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

  private normalizeIncomingMessage(payload: EvolutionWebhookPayload): IncomingWhatsAppMessage {
    const remoteJid = payload?.data?.key?.remoteJid || payload.phone || "unknown";
    const text =
      payload.data?.message?.conversation ||
      payload.data?.message?.extendedTextMessage?.text ||
      "";
    const isFromMe = Boolean(payload.data?.key?.fromMe);
    const isMessageEvent = !payload.event || payload.event === "messages.upsert" || payload.event === "MESSAGES_UPSERT";
    const isCustomerMessage = isMessageEvent && !isFromMe && remoteJid !== "unknown" && text.trim().length > 0;

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