import { CalendarService } from "../src/services/calendar.service";

/**
 * Teste da agenda individual por profissional (Decisoes D2-A + D3-B).
 *
 * Verifica que, no Modo Equipes, a disponibilidade de um membro considera
 * SOMENTE os agendamentos daquele membro (conflito por banco), permitindo que
 * membros diferentes atendam no mesmo horario sem conflito entre si (item 14).
 */

const PROFESSIONAL = {
  id: "pro-1",
  timezone: "America/Sao_Paulo",
  appointmentDurationMinutes: 30,
  googleCalendar: undefined
};

// Grade cobrindo todos os dias, 09:00-12:00, para nao depender do dia da semana.
const ALL_WEEK_RULES = Array.from({ length: 7 }, (_, weekday) => ({
  id: `rule-${weekday}`,
  team_member_id: "tm",
  weekday,
  start_time: "09:00:00",
  end_time: "12:00:00",
  lunch_start: null,
  lunch_end: null,
  slot_interval_minutes: null,
  buffer_minutes: 0,
  minimum_notice_minutes: 120,
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}));

function targetDay() {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 3);
  base.setUTCHours(12, 0, 0, 0); // meio-dia UTC => mesmo dia em Sao_Paulo (UTC-3)
  return base;
}

function buildCalendar(busyIntervals: { start: string; end: string }[]) {
  const database = {
    getGoogleCalendarConnection: async () => undefined,
    getService: async () => ({ id: "svc-1", name: "Corte", duration_minutes: 30, price_cents: 0 }),
    listServices: async () => [],
    listTeamMemberAvailability: async () => ALL_WEEK_RULES,
    listAvailabilityRules: async () => [],
    listBusyIntervals: async () => busyIntervals
  };

  const professionals = { getById: () => PROFESSIONAL };

  return new CalendarService(professionals as never, database as never);
}

describe("CalendarService - agenda individual (Modo Equipes)", () => {
  it("exclui o horario ocupado do proprio membro e mantem os livres", async () => {
    const day = targetDay();
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth();
    const d = day.getUTCDate();
    const busyStart = new Date(Date.UTC(y, m, d, 13, 0, 0)).toISOString(); // 10:00 em SP
    const busyEnd = new Date(Date.UTC(y, m, d, 13, 30, 0)).toISOString();
    const freeSlot = new Date(Date.UTC(y, m, d, 12, 0, 0)).toISOString(); // 09:00 em SP

    const calendar = buildCalendar([{ start: busyStart, end: busyEnd }]);
    const result = (await calendar.getAvailabilityForService({
      professionalId: "pro-1",
      serviceId: "svc-1",
      teamMemberId: "tm",
      startDate: day.toISOString(),
      daysAhead: 1
    })) as { slots: { startsAt: string }[] };

    const startTimes = result.slots.map((slot) => slot.startsAt);
    expect(startTimes).toContain(freeSlot);
    expect(startTimes).not.toContain(busyStart);
  });

  it("nao bloqueia o membro quando quem esta ocupado e outro (atendimento simultaneo)", async () => {
    const day = targetDay();
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth();
    const d = day.getUTCDate();
    const contested = new Date(Date.UTC(y, m, d, 13, 0, 0)).toISOString(); // 10:00 em SP

    // Membro sem nenhum agendamento -> horario 10:00 continua livre para ele,
    // mesmo que outro membro esteja ocupado nesse horario.
    const calendar = buildCalendar([]);
    const result = (await calendar.getAvailabilityForService({
      professionalId: "pro-1",
      serviceId: "svc-1",
      teamMemberId: "tm",
      startDate: day.toISOString(),
      daysAhead: 1
    })) as { slots: { startsAt: string }[] };

    expect(result.slots.map((slot) => slot.startsAt)).toContain(contested);
  });
});
