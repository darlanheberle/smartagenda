import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import { GoogleCalendarConnection } from "../types/professional";

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
}
