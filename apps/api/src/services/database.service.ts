import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import {
  CreateProfessionalInput,
  GoogleCalendarConnection,
  ProfessionalRecord
} from "../types/professional";

type SaveAppointmentInput = {
  professionalId: string;
  clientId: string;
  googleEventId: string;
  googleEventLink?: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  valueCents?: number;
  source?: string;
};

type UpsertClientInput = {
  professionalId: string;
  name: string;
  phone?: string;
  email?: string;
};

type ManualAppointmentInput = {
  professionalId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  valueCents?: number;
  status?: string;
  paymentStatus?: string;
};

type UpdateAppointmentInput = Partial<ManualAppointmentInput>;

export type ClientRecord = {
  id: string;
  professional_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceRecord = {
  id: string;
  professional_id: string;
  category: string | null;
  name: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AvailabilityRule = {
  id: string;
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
  slot_interval_minutes: number | null;
  buffer_minutes: number;
  minimum_notice_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateServiceInput = {
  professionalId: string;
  category?: string | null;
  name: string;
  durationMinutes: number;
  priceCents?: number;
  active?: boolean;
};

export type UpdateServiceInput = Partial<Omit<CreateServiceInput, "professionalId">>;

export type CreateAvailabilityInput = {
  professionalId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  lunchStart?: string;
  lunchEnd?: string;
  slotIntervalMinutes?: number | null;
  bufferMinutes?: number;
  minimumNoticeMinutes?: number;
  active?: boolean;
};

export type UpdateAvailabilityInput = Partial<Omit<CreateAvailabilityInput, "professionalId">>;

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool?: Pool;
  private ready = false;

  constructor() {
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
    }
  }

  async onModuleInit() {
    if (!this.pool) {
      this.logger.warn("DATABASE_URL nao configurado. Persistencia em banco desativada.");
      return;
    }

    await this.pool.query(`
      create table if not exists professionals (
        id text primary key,
        name text not null,
        specialty text,
        whatsapp_number text not null,
        evolution_instance_name text not null unique,
        gmail text not null,
        timezone text not null default 'America/Sao_Paulo',
        appointment_duration_minutes integer not null default 60,
        whatsapp_status text not null default 'pending',
        whatsapp_connected_at timestamptz,
        onboarding_completed_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
    await this.pool.query(`
      alter table professionals
      add column if not exists password_hash text
    `);
    await this.pool.query(`
      create table if not exists google_calendar_connections (
        professional_id text primary key,
        email text not null,
        calendar_id text not null default 'primary',
        access_token text,
        refresh_token text,
        expires_at timestamptz,
        connected_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
    await this.pool.query(`
      create table if not exists clients (
        id text primary key,
        professional_id text not null,
        name text not null,
        phone text,
        email text,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (professional_id, phone)
      )
    `);
    await this.pool.query(`
      create table if not exists appointments (
        id text primary key,
        professional_id text not null,
        client_id text references clients(id),
        google_event_id text,
        google_event_link text,
        service_name text not null,
        starts_at timestamptz not null,
        ends_at timestamptz not null,
        status text not null default 'scheduled',
        value_cents integer not null default 0,
        payment_status text not null default 'pending',
        payment_method text,
        source text not null default 'whatsapp',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (professional_id, google_event_id)
      )
    `);
    await this.pool.query(`
      create table if not exists services (
        id text primary key,
        professional_id text not null,
        category text,
        name text not null,
        duration_minutes integer not null,
        price_cents integer not null default 0,
        active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
    await this.pool.query(`
      create table if not exists professional_availability (
        id text primary key,
        professional_id text not null,
        weekday integer not null check (weekday between 0 and 6),
        start_time time not null,
        end_time time not null,
        lunch_start time,
        lunch_end time,
        slot_interval_minutes integer,
        buffer_minutes integer not null default 0,
        minimum_notice_minutes integer not null default 120,
        active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (professional_id, weekday)
      )
    `);
    await this.pool.query(`
      alter table professional_availability
      add column if not exists slot_interval_minutes integer
    `);
    await this.pool.query(`
      alter table services
      add column if not exists category text
    `);
    this.ready = true;
    await this.ensureDefaultSchedulingData();
  }

  async upsertProfessional(input: CreateProfessionalInput & { id: string }) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        insert into professionals (
          id,
          name,
          specialty,
          whatsapp_number,
          evolution_instance_name,
          gmail,
          timezone,
          appointment_duration_minutes,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, now())
        on conflict (id)
        do update set
          name = excluded.name,
          specialty = excluded.specialty,
          whatsapp_number = excluded.whatsapp_number,
          evolution_instance_name = excluded.evolution_instance_name,
          gmail = excluded.gmail,
          timezone = excluded.timezone,
          appointment_duration_minutes = excluded.appointment_duration_minutes,
          updated_at = now()
        returning *
      `,
      [
        input.id,
        input.name.trim(),
        input.specialty || null,
        this.normalizePhone(input.whatsappNumber),
        input.evolutionInstanceName || this.buildInstanceName(input.whatsappNumber),
        input.gmail.toLowerCase().trim(),
        input.timezone || "America/Sao_Paulo",
        input.appointmentDurationMinutes || 60
      ]
    );

    return result.rows[0] as ProfessionalRecord;
  }

  async listProfessionals(): Promise<ProfessionalRecord[]> {
    if (!this.pool || !this.ready) {
      return [];
    }

    const result = await this.pool.query(
      `
        select *
        from professionals
        order by created_at desc
      `
    );

    return result.rows;
  }

  async getProfessional(id: string): Promise<ProfessionalRecord | undefined> {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query("select * from professionals where id = $1", [id]);
    return result.rows[0] as ProfessionalRecord | undefined;
  }

  async findProfessionalByWhatsappNumber(phone: string): Promise<ProfessionalRecord | undefined> {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        select *
        from professionals
        where whatsapp_number = $1
        limit 1
      `,
      [this.normalizePhone(phone)]
    );

    return result.rows[0] as ProfessionalRecord | undefined;
  }

  async findProfessionalByGmail(gmail: string): Promise<ProfessionalRecord | undefined> {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        select *
        from professionals
        where lower(gmail) = $1
        order by updated_at desc
        limit 1
      `,
      [gmail.toLowerCase().trim()]
    );

    return result.rows[0] as ProfessionalRecord | undefined;
  }

  async setProfessionalPassword(professionalId: string, passwordHash: string) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        update professionals
        set password_hash = $2, updated_at = now()
        where id = $1
        returning *
      `,
      [professionalId, passwordHash]
    );

    return result.rows[0] as ProfessionalRecord | undefined;
  }

  async markProfessionalWhatsappStatus(
    professionalId: string,
    status: "pending" | "instance_created" | "connected" | "error"
  ) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        update professionals
        set
          whatsapp_status = $2,
          whatsapp_connected_at = case when $2 = 'connected' then now() else whatsapp_connected_at end,
          updated_at = now()
        where id = $1
        returning *
      `,
      [professionalId, status]
    );

    return result.rows[0] as ProfessionalRecord | undefined;
  }

  async getOnboardingStatus(professionalId: string) {
    if (!this.pool || !this.ready) {
      return {
        professionalId,
        googleConnected: false,
        whatsappConnected: false,
        servicesConfigured: false,
        availabilityConfigured: false,
        ready: false
      };
    }

    const result = await this.pool.query(
      `
        select
          p.*,
          (gcc.professional_id is not null) as google_connected,
          (p.whatsapp_status = 'connected') as whatsapp_connected,
          (select count(*)::int from services s where s.professional_id = p.id and s.active = true) as services_count,
          (select count(*)::int from professional_availability pa where pa.professional_id = p.id and pa.active = true) as availability_rules_count
        from professionals p
        left join google_calendar_connections gcc on gcc.professional_id = p.id
        where p.id = $1
      `,
      [professionalId]
    );
    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    const servicesConfigured = row.services_count > 0;
    const availabilityConfigured = row.availability_rules_count > 0;
    const ready =
      Boolean(row.google_connected) &&
      Boolean(row.whatsapp_connected) &&
      servicesConfigured &&
      availabilityConfigured;

    if (ready && !row.onboarding_completed_at) {
      await this.pool.query(
        "update professionals set onboarding_completed_at = now(), updated_at = now() where id = $1",
        [professionalId]
      );
    }

    return {
      professional: {
        id: row.id,
        name: row.name,
        specialty: row.specialty,
        whatsappNumber: row.whatsapp_number,
        evolutionInstanceName: row.evolution_instance_name,
        gmail: row.gmail,
        timezone: row.timezone,
        appointmentDurationMinutes: row.appointment_duration_minutes,
        whatsappStatus: row.whatsapp_status
      },
      googleConnected: Boolean(row.google_connected),
      whatsappConnected: Boolean(row.whatsapp_connected),
      servicesConfigured,
      availabilityConfigured,
      servicesCount: row.services_count,
      availabilityRulesCount: row.availability_rules_count,
      ready
    };
  }

  isEnabled() {
    return this.ready && Boolean(this.pool);
  }

  async getGoogleCalendarConnection(
    professionalId: string
  ): Promise<GoogleCalendarConnection | undefined> {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        select email, calendar_id, access_token, refresh_token, expires_at, connected_at
        from google_calendar_connections
        where professional_id = $1
      `,
      [professionalId]
    );
    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return {
      email: row.email,
      calendarId: row.calendar_id,
      accessToken: row.access_token || undefined,
      refreshToken: row.refresh_token || undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
      connectedAt: new Date(row.connected_at).toISOString()
    };
  }

  async saveGoogleCalendarConnection(
    professionalId: string,
    connection: GoogleCalendarConnection
  ) {
    if (!this.pool || !this.ready) {
      return;
    }

    await this.pool.query(
      `
        insert into google_calendar_connections (
          professional_id,
          email,
          calendar_id,
          access_token,
          refresh_token,
          expires_at,
          connected_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, now())
        on conflict (professional_id)
        do update set
          email = excluded.email,
          calendar_id = excluded.calendar_id,
          access_token = excluded.access_token,
          refresh_token = coalesce(excluded.refresh_token, google_calendar_connections.refresh_token),
          expires_at = excluded.expires_at,
          connected_at = excluded.connected_at,
          updated_at = now()
      `,
      [
        professionalId,
        connection.email,
        connection.calendarId,
        connection.accessToken || null,
        connection.refreshToken || null,
        connection.expiresAt || null,
        connection.connectedAt
      ]
    );
  }

  async upsertClient(input: UpsertClientInput) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const id = randomUUID();
    const phone = input.phone || null;
    const result = await this.pool.query(
      `
        insert into clients (id, professional_id, name, phone, email, updated_at)
        values ($1, $2, $3, $4, $5, now())
        on conflict (professional_id, phone)
        do update set
          name = case
            when clients.name in ('Cliente WhatsApp', 'Cliente') then excluded.name
            else clients.name
          end,
          email = coalesce(excluded.email, clients.email),
          updated_at = now()
        returning id, professional_id, name, phone, email, notes, created_at, updated_at
      `,
      [id, input.professionalId, input.name, phone, input.email || null]
    );

    return result.rows[0] as ClientRecord;
  }

  async findClientByPhone(professionalId: string, phone: string) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        select id, professional_id, name, phone, email, notes, created_at, updated_at
        from clients
        where professional_id = $1
          and phone = $2
        limit 1
      `,
      [professionalId, phone]
    );

    return result.rows[0] as ClientRecord | undefined;
  }

  async saveAppointment(input: SaveAppointmentInput) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        insert into appointments (
          id,
          professional_id,
          client_id,
          google_event_id,
          google_event_link,
          service_name,
          starts_at,
          ends_at,
          value_cents,
          source,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
        on conflict (professional_id, google_event_id)
        do update set
          client_id = excluded.client_id,
          google_event_link = excluded.google_event_link,
          service_name = excluded.service_name,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          value_cents = excluded.value_cents,
          updated_at = now()
        returning *
      `,
      [
        randomUUID(),
        input.professionalId,
        input.clientId,
        input.googleEventId,
        input.googleEventLink || null,
        input.serviceName,
        input.startsAt,
        input.endsAt,
        input.valueCents || 0,
        input.source || "whatsapp"
      ]
    );

    return result.rows[0];
  }

  async getAppointment(professionalId: string, appointmentId: string) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        select
          a.id,
          a.professional_id,
          a.client_id,
          a.google_event_id,
          a.google_event_link,
          a.service_name,
          a.starts_at,
          a.ends_at,
          a.status,
          a.value_cents,
          a.payment_status,
          a.payment_method,
          a.source,
          a.created_at,
          c.name as client_name,
          c.phone as client_phone,
          c.email as client_email
        from appointments a
        left join clients c on c.id = a.client_id
        where a.professional_id = $1 and a.id = $2
        limit 1
      `,
      [professionalId, appointmentId]
    );

    return result.rows[0];
  }

  async createManualAppointment(input: ManualAppointmentInput) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const client = await this.upsertClient({
      professionalId: input.professionalId,
      name: input.clientName,
      phone: input.clientPhone,
      email: input.clientEmail
    });

    if (!client) {
      return undefined;
    }

    const id = randomUUID();
    const result = await this.pool.query(
      `
        insert into appointments (
          id,
          professional_id,
          client_id,
          google_event_id,
          service_name,
          starts_at,
          ends_at,
          status,
          value_cents,
          payment_status,
          source,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual', now())
        returning id
      `,
      [
        id,
        input.professionalId,
        client.id,
        `manual-${id}`,
        input.serviceName,
        input.startsAt,
        input.endsAt,
        input.status || "scheduled",
        input.valueCents ?? 0,
        input.paymentStatus || "pending"
      ]
    );

    return this.getAppointment(input.professionalId, result.rows[0].id);
  }

  async updateAppointment(
    professionalId: string,
    appointmentId: string,
    input: UpdateAppointmentInput
  ) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const current = await this.getAppointment(professionalId, appointmentId);
    if (!current) {
      return undefined;
    }

    let clientId = current.client_id;
    if (input.clientName || input.clientPhone !== undefined || input.clientEmail !== undefined) {
      const client = await this.upsertClient({
        professionalId,
        name: input.clientName || current.client_name || "Cliente",
        phone: input.clientPhone || current.client_phone || undefined,
        email: input.clientEmail || current.client_email || undefined
      });
      clientId = client?.id || clientId;
    }

    await this.pool.query(
      `
        update appointments set
          client_id = $3,
          service_name = $4,
          starts_at = $5,
          ends_at = $6,
          status = $7,
          value_cents = $8,
          payment_status = $9,
          updated_at = now()
        where professional_id = $1 and id = $2
      `,
      [
        professionalId,
        appointmentId,
        clientId,
        input.serviceName || current.service_name,
        input.startsAt || current.starts_at,
        input.endsAt || current.ends_at,
        input.status || current.status,
        input.valueCents ?? current.value_cents,
        input.paymentStatus || current.payment_status
      ]
    );

    return this.getAppointment(professionalId, appointmentId);
  }

  async deleteAppointment(professionalId: string, appointmentId: string) {
    if (!this.pool || !this.ready) {
      return { deleted: false };
    }

    const result = await this.pool.query(
      `
        delete from appointments
        where professional_id = $1 and id = $2
        returning id
      `,
      [professionalId, appointmentId]
    );

    return { deleted: (result.rowCount || 0) > 0 };
  }

  async listClients(professionalId: string) {
    if (!this.pool || !this.ready) {
      return [];
    }

    const result = await this.pool.query(
      `
        select id, professional_id, name, phone, email, notes, created_at, updated_at
        from clients
        where professional_id = $1
        order by updated_at desc
        limit 100
      `,
      [professionalId]
    );

    return result.rows;
  }

  async listAppointments(professionalId: string, limit = 100) {
    if (!this.pool || !this.ready) {
      return [];
    }

    const result = await this.pool.query(
      `
        select
          a.id,
          a.professional_id,
          a.google_event_id,
          a.google_event_link,
          a.service_name,
          a.starts_at,
          a.ends_at,
          a.status,
          a.value_cents,
          a.payment_status,
          a.payment_method,
          a.source,
          a.created_at,
          c.name as client_name,
          c.phone as client_phone,
          c.email as client_email
        from appointments a
        left join clients c on c.id = a.client_id
        where a.professional_id = $1
        order by a.starts_at desc
        limit $2
      `,
      [professionalId, limit]
    );

    return result.rows;
  }

  async listUpcomingAppointments(professionalId: string, limit = 20) {
    if (!this.pool || !this.ready) {
      return [];
    }

    const result = await this.pool.query(
      `
        select
          a.id,
          a.professional_id,
          a.google_event_id,
          a.google_event_link,
          a.service_name,
          a.starts_at,
          a.ends_at,
          a.status,
          a.value_cents,
          a.payment_status,
          a.payment_method,
          a.source,
          a.created_at,
          c.name as client_name,
          c.phone as client_phone,
          c.email as client_email
        from appointments a
        left join clients c on c.id = a.client_id
        where a.professional_id = $1
          and a.starts_at >= now()
        order by a.starts_at asc
        limit $2
      `,
      [professionalId, limit]
    );

    return result.rows;
  }

  async getTodayDashboard(professionalId: string, timezone: string) {
    if (!this.pool || !this.ready) {
      return {
        appointments: 0,
        cancellations: 0,
        expectedRevenue: 0,
        pendingRevenue: 0
      };
    }

    const result = await this.pool.query(
      `
        select
          count(*) filter (where status <> 'cancelled')::int as appointments,
          count(*) filter (where status = 'cancelled')::int as cancellations,
          count(*) filter (where status = 'scheduled' and payment_status = 'pending')::int as pending,
          count(*) filter (where status = 'completed')::int as completed,
          coalesce(sum(value_cents) filter (where status <> 'cancelled'), 0)::int as expected_revenue_cents,
          coalesce(sum(value_cents) filter (where status <> 'cancelled' and payment_status = 'pending'), 0)::int as pending_revenue_cents
        from appointments
        where professional_id = $1
          and (starts_at at time zone $2)::date = (now() at time zone $2)::date
      `,
      [professionalId, timezone]
    );
    const row = result.rows[0];

    return {
      appointments: row.appointments || 0,
      cancellations: row.cancellations || 0,
      pending: row.pending || 0,
      completed: row.completed || 0,
      expectedRevenue: (row.expected_revenue_cents || 0) / 100,
      pendingRevenue: (row.pending_revenue_cents || 0) / 100
    };
  }

  async listServices(professionalId: string, onlyActive = false): Promise<ServiceRecord[]> {
    if (!this.pool || !this.ready) {
      return [];
    }

    const result = await this.pool.query(
      `
        select *
        from services
        where professional_id = $1
          and ($2::boolean = false or active = true)
        order by active desc, nullif(category, '') asc nulls last, name asc
      `,
      [professionalId, onlyActive]
    );

    return result.rows;
  }

  async getService(professionalId: string, serviceId: string) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        select *
        from services
        where professional_id = $1 and id = $2
      `,
      [professionalId, serviceId]
    );

    return result.rows[0] as ServiceRecord | undefined;
  }

  async createService(input: CreateServiceInput) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        insert into services (
          id,
          professional_id,
          category,
          name,
          duration_minutes,
          price_cents,
          active,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, now())
        returning *
      `,
      [
        randomUUID(),
        input.professionalId,
        this.normalizeOptionalText(input.category),
        input.name.trim(),
        input.durationMinutes,
        input.priceCents || 0,
        input.active ?? true
      ]
    );

    return result.rows[0] as ServiceRecord;
  }

  async updateService(professionalId: string, serviceId: string, input: UpdateServiceInput) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const current = await this.getService(professionalId, serviceId);
    if (!current) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        update services set
          category = $3,
          name = $4,
          duration_minutes = $5,
          price_cents = $6,
          active = $7,
          updated_at = now()
        where professional_id = $1 and id = $2
        returning *
      `,
      [
        professionalId,
        serviceId,
        input.category === undefined ? current.category : this.normalizeOptionalText(input.category),
        input.name?.trim() || current.name,
        input.durationMinutes ?? current.duration_minutes,
        input.priceCents ?? current.price_cents,
        input.active ?? current.active
      ]
    );

    return result.rows[0] as ServiceRecord;
  }

  async deleteService(professionalId: string, serviceId: string) {
    if (!this.pool || !this.ready) {
      return { deleted: false };
    }

    const result = await this.pool.query(
      `
        update services
        set active = false, updated_at = now()
        where professional_id = $1 and id = $2
        returning id
      `,
      [professionalId, serviceId]
    );

    return { deleted: (result.rowCount || 0) > 0 };
  }

  async listAvailabilityRules(professionalId: string): Promise<AvailabilityRule[]> {
    if (!this.pool || !this.ready) {
      return [];
    }

    const result = await this.pool.query(
      `
        select *
        from professional_availability
        where professional_id = $1
        order by weekday asc
      `,
      [professionalId]
    );

    return result.rows;
  }

  async getAvailabilityRule(professionalId: string, weekday: number) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        select *
        from professional_availability
        where professional_id = $1 and weekday = $2
      `,
      [professionalId, weekday]
    );

    return result.rows[0] as AvailabilityRule | undefined;
  }

  async createAvailabilityRule(input: CreateAvailabilityInput) {
    if (!this.pool || !this.ready) {
      return undefined;
    }

    const result = await this.pool.query(
      `
        insert into professional_availability (
          id,
          professional_id,
          weekday,
          start_time,
          end_time,
          lunch_start,
          lunch_end,
          slot_interval_minutes,
          buffer_minutes,
          minimum_notice_minutes,
          active,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        on conflict (professional_id, weekday)
        do update set
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          lunch_start = excluded.lunch_start,
          lunch_end = excluded.lunch_end,
          slot_interval_minutes = excluded.slot_interval_minutes,
          buffer_minutes = excluded.buffer_minutes,
          minimum_notice_minutes = excluded.minimum_notice_minutes,
          active = excluded.active,
          updated_at = now()
        returning *
      `,
      [
        randomUUID(),
        input.professionalId,
        input.weekday,
        input.startTime,
        input.endTime,
        input.lunchStart || null,
        input.lunchEnd || null,
        input.slotIntervalMinutes ?? null,
        input.bufferMinutes || 0,
        input.minimumNoticeMinutes || 120,
        input.active ?? true
      ]
    );

    return result.rows[0] as AvailabilityRule;
  }

  async updateAvailabilityRule(
    professionalId: string,
    weekday: number,
    input: UpdateAvailabilityInput
  ) {
    const current = await this.getAvailabilityRule(professionalId, weekday);
    if (!current) {
      return undefined;
    }

    return this.createAvailabilityRule({
      professionalId,
      weekday,
      startTime: input.startTime || current.start_time,
      endTime: input.endTime || current.end_time,
      lunchStart: input.lunchStart ?? current.lunch_start ?? undefined,
      lunchEnd: input.lunchEnd ?? current.lunch_end ?? undefined,
      slotIntervalMinutes:
        input.slotIntervalMinutes === undefined
          ? current.slot_interval_minutes
          : input.slotIntervalMinutes,
      bufferMinutes: input.bufferMinutes ?? current.buffer_minutes,
      minimumNoticeMinutes: input.minimumNoticeMinutes ?? current.minimum_notice_minutes,
      active: input.active ?? current.active
    });
  }

  private async ensureDefaultSchedulingData() {
    if (!this.pool) {
      return;
    }

    const professionalId = process.env.DEMO_PROFESSIONAL_ID || "demo-professional";
    await this.upsertProfessional({
      id: professionalId,
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

    const servicesResult = await this.pool.query(
      "select count(*)::int as count from services where professional_id = $1",
      [professionalId]
    );

    if (servicesResult.rows[0].count === 0) {
      await this.pool.query(
        `
          insert into services (id, professional_id, name, duration_minutes, price_cents, active)
          values
            ($1, $2, 'Consulta', 60, 0, true),
            ($3, $2, 'Retorno', 30, 0, true)
        `,
        [randomUUID(), professionalId, randomUUID()]
      );
    }

    const availabilityResult = await this.pool.query(
      "select count(*)::int as count from professional_availability where professional_id = $1",
      [professionalId]
    );

    if (availabilityResult.rows[0].count === 0) {
      for (const weekday of [1, 2, 3, 4, 5]) {
        await this.createAvailabilityRule({
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

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    const withCountryCode =
      (digits.length === 10 || digits.length === 11) && !digits.startsWith("55")
        ? `55${digits}`
        : digits;
    return `+${withCountryCode}`;
  }

  private normalizeOptionalText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private buildInstanceName(phone: string): string {
    return `smartagenda-${this.normalizePhone(phone).replace(/\D/g, "")}`;
  }
}
