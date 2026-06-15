import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { GoogleCalendarConnection } from "../types/professional";

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
    this.ready = true;
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
          name = excluded.name,
          email = coalesce(excluded.email, clients.email),
          updated_at = now()
        returning id, professional_id, name, phone, email, notes, created_at, updated_at
      `,
      [id, input.professionalId, input.name, phone, input.email || null]
    );

    return result.rows[0];
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
      expectedRevenue: (row.expected_revenue_cents || 0) / 100,
      pendingRevenue: (row.pending_revenue_cents || 0) / 100
    };
  }
}
