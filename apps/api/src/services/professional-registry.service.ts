import { Injectable, NotFoundException, OnApplicationBootstrap } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  CreateProfessionalInput,
  GoogleCalendarConnection,
  Professional,
  ProfessionalRecord
} from "../types/professional";
import { DatabaseService } from "./database.service";

@Injectable()
export class ProfessionalRegistryService implements OnApplicationBootstrap {
  private readonly professionals = new Map<string, Professional>();

  constructor(private readonly database: DatabaseService) {
    this.create({
      id: process.env.DEMO_PROFESSIONAL_ID || "demo-professional",
      name: process.env.DEMO_PROFESSIONAL_NAME || "Demonstracao SmartAgenda",
      specialty: process.env.DEMO_PROFESSIONAL_SPECIALTY || "Clinica modelo",
      whatsappNumber: process.env.DEMO_PROFESSIONAL_WHATSAPP || "+554896807805",
      evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME || "smartagenda-demo",
      gmail: process.env.DEMO_PROFESSIONAL_GMAIL || "agenda.profissional@gmail.com",
      timezone: process.env.DEMO_PROFESSIONAL_TIMEZONE || "America/Sao_Paulo",
      appointmentDurationMinutes: Number.parseInt(
        process.env.DEMO_APPOINTMENT_DURATION_MINUTES || "60",
        10
      )
    });
  }

  async onApplicationBootstrap() {
    const storedProfessionals = await this.database.listProfessionals();

    for (const stored of storedProfessionals) {
      this.remember(this.fromRecord(stored));
    }
  }

  create(input: CreateProfessionalInput): Professional {
    const id = input.id || randomUUID();
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

  remember(professional: Professional) {
    this.professionals.set(professional.id, professional);
    return professional;
  }

  list(): Professional[] {
    return Array.from(this.professionals.values());
  }

  getById(id: string): Professional {
    const professional = this.professionals.get(id);
    if (!professional) {
      throw new NotFoundException("Profissional nao encontrado");
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
    const withCountryCode =
      (digits.length === 10 || digits.length === 11) && !digits.startsWith("55")
        ? `55${digits}`
        : digits;
    return `+${withCountryCode}`;
  }

  private buildInstanceName(phone: string): string {
    return `smartagenda-${this.normalizePhone(phone).replace(/\D/g, "")}`;
  }

  private fromRecord(record: ProfessionalRecord): Professional {
    return {
      id: record.id,
      name: record.name,
      specialty: record.specialty || undefined,
      whatsappNumber: record.whatsapp_number,
      evolutionInstanceName: record.evolution_instance_name,
      gmail: record.gmail,
      timezone: record.timezone,
      appointmentDurationMinutes: record.appointment_duration_minutes,
      logoUrl: record.logo_url,
      themePrimary: record.theme_primary,
      themePrimaryDark: record.theme_primary_dark,
      themeAccent: record.theme_accent,
      themeBackground: record.theme_background,
      themeSurface: record.theme_surface,
      themeText: record.theme_text,
      themeSuccess: record.theme_success,
      createdAt: new Date(record.created_at).toISOString()
    };
  }
}
