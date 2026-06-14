import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  CreateProfessionalInput,
  GoogleCalendarConnection,
  Professional
} from "../types/professional";

@Injectable()
export class ProfessionalRegistryService {
  private readonly professionals = new Map<string, Professional>();

  constructor() {
    this.create({
      name: "Demonstração SmartAgenda",
      specialty: "Clínica modelo",
      whatsappNumber: "+5511999990000",
      evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME || "smartagenda-demo",
      gmail: "agenda.profissional@gmail.com",
      timezone: "America/Sao_Paulo",
      appointmentDurationMinutes: 60
    });
  }

  create(input: CreateProfessionalInput): Professional {
    const id = randomUUID();
    const now = new Date().toISOString();
    const professional: Professional = {
      id,
      name: input.name,
      specialty: input.specialty,
      whatsappNumber: this.normalizePhone(input.whatsappNumber),
      evolutionInstanceName:
        input.evolutionInstanceName || this.buildInstanceName(input.whatsappNumber),
      gmail: input.gmail.toLowerCase().trim(),
      timezone: input.timezone || "America/Sao_Paulo",
      appointmentDurationMinutes: input.appointmentDurationMinutes || 60,
      createdAt: now
    };

    this.professionals.set(id, professional);
    return professional;
  }

  list(): Professional[] {
    return Array.from(this.professionals.values());
  }

  getById(id: string): Professional {
    const professional = this.professionals.get(id);
    if (!professional) {
      throw new NotFoundException("Profissional não encontrado");
    }

    return professional;
  }

  findByEvolutionInstance(instanceName: string): Professional | undefined {
    return this.list().find(
      (professional) => professional.evolutionInstanceName === instanceName
    );
  }

  findByWhatsappNumber(phone: string): Professional | undefined {
    const normalized = this.normalizePhone(phone);
    return this.list().find((professional) => professional.whatsappNumber === normalized);
  }

  connectGoogleCalendar(id: string, connection: GoogleCalendarConnection): Professional {
    const professional = this.getById(id);
    const updated = {
      ...professional,
      googleCalendar: connection
    };

    this.professionals.set(id, updated);
    return updated;
  }

  updateGoogleCalendar(id: string, connection: Partial<GoogleCalendarConnection>): Professional {
    const professional = this.getById(id);
    const updated = {
      ...professional,
      googleCalendar: {
        ...professional.googleCalendar,
        ...connection,
        email: connection.email || professional.googleCalendar?.email || professional.gmail,
        calendarId: connection.calendarId || professional.googleCalendar?.calendarId || "primary",
        connectedAt:
          connection.connectedAt ||
          professional.googleCalendar?.connectedAt ||
          new Date().toISOString()
      }
    };

    this.professionals.set(id, updated);
    return updated;
  }

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    return digits.startsWith("+") ? digits : `+${digits}`;
  }

  private buildInstanceName(phone: string): string {
    return `smartagenda-${phone.replace(/\D/g, "")}`;
  }
}
