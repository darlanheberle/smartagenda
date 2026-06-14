import { Injectable } from "@nestjs/common";
import { CalendarService } from "./calendar.service";
import { EvolutionService } from "./evolution.service";
import { EvolutionWebhookPayload } from "../types/integrations";

@Injectable()
export class AiSchedulingService {
  constructor(
    private readonly calendar: CalendarService,
    private readonly evolution: EvolutionService
  ) {}

  async handleIncomingWhatsAppMessage(payload: EvolutionWebhookPayload) {
    const phone = payload?.data?.key?.remoteJid || payload?.phone || "unknown";
    const availability = this.calendar.getAvailability();
    const options = availability.slots.map((slot) => slot.label).join("\n");
    const message = `Tenho disponível:\n\n${options}\n\nQual horário você prefere?`;

    await this.evolution.sendTextMessage({ phone, message });

    return {
      received: true,
      intent: "schedule_appointment",
      reply: message,
      availability
    };
  }
}
