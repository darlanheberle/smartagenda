import { AiSchedulingService } from "../src/services/ai-scheduling.service";
import type { EvolutionWebhookPayload } from "../src/types/integrations";

/**
 * Teste de regressao do fluxo de agendamento do WhatsApp (Modo Equipes DESLIGADO).
 *
 * Objetivo: garantir que o comportamento atual continua identico apos a Etapa 1
 * (contexto da conversa persistido). Roda duas vezes:
 *  - dbEnabled=false  -> contexto usa o fallback em memoria.
 *  - dbEnabled=true   -> contexto usa os metodos de conversation_states (fake em memoria).
 */

const PROFESSIONAL = {
  id: "pro-1",
  name: "Salao Teste",
  evolutionInstanceName: "inst-1",
  timezone: "America/Sao_Paulo",
  appointmentDurationMinutes: 30
};

const SERVICE = {
  id: "svc-1",
  professional_id: "pro-1",
  category: null,
  name: "Corte",
  duration_minutes: 30,
  price_cents: 5000,
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

function buildAvailabilitySlots() {
  const slots = [] as { startsAt: string; endsAt: string; label: string }[];
  for (let dayOffset = -1; dayOffset <= 9; dayOffset += 1) {
    const start = new Date();
    start.setDate(start.getDate() + dayOffset);
    start.setUTCHours(13, 0, 0, 0);
    slots.push({
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60000).toISOString(),
      label: "slot"
    });
  }
  return slots;
}

function buildService(dbEnabled: boolean) {
  const conversationStore = new Map<string, { step: string; state: unknown }>();
  let clientSaved: { id: string; name: string; phone: string } | undefined;

  const database = {
    isEnabled: () => dbEnabled,
    getTeamMode: async () => false,
    getProfessional: async () => ({ ai_enabled: true }),
    findClientByPhone: async () => clientSaved,
    upsertClient: async (input: { name: string; phone?: string }) => {
      clientSaved = { id: "cli-1", name: input.name, phone: input.phone ?? "" };
      return clientSaved;
    },
    listServices: async () => [SERVICE],
    getService: async () => SERVICE,
    getConversationState: async (professionalId: string, phone: string) =>
      conversationStore.get(`${professionalId}:${phone}`),
    saveConversationState: async (
      professionalId: string,
      phone: string,
      step: string,
      state: unknown
    ) => {
      conversationStore.set(`${professionalId}:${phone}`, { step, state });
    },
    clearConversationState: async (professionalId: string, phone: string) => {
      conversationStore.delete(`${professionalId}:${phone}`);
    }
  };

  const calendar = {
    getAvailabilityForService: async () => ({ slots: buildAvailabilitySlots() }),
    createEvent: async () => ({ status: "created", htmlLink: "https://example.com/evt" })
  };

  const evolution = {
    sendTextMessage: async () => ({ ok: true })
  };

  const professionals = {
    findByEvolutionInstance: () => PROFESSIONAL,
    getById: () => PROFESSIONAL
  };

  return new AiSchedulingService(
    calendar as never,
    database as never,
    evolution as never,
    professionals as never
  );
}

function incoming(text: string): EvolutionWebhookPayload {
  return {
    instance: "inst-1",
    data: {
      key: { remoteJid: "5511999990000@s.whatsapp.net", fromMe: false },
      message: { conversation: text }
    }
  };
}

describe.each([
  ["contexto em memoria (sem banco)", false],
  ["contexto persistido (com banco)", true]
])("AiSchedulingService - fluxo padrao com %s", (_label, dbEnabled) => {
  it("pede nome, servico, dia, horario e confirma o agendamento", async () => {
    const service = buildService(dbEnabled as boolean);

    const askName = (await service.handleIncomingWhatsAppMessage(incoming("Ola"))) as {
      reply?: string;
    };
    expect(askName.reply).toContain("nome completo");

    const askService = (await service.handleIncomingWhatsAppMessage(
      incoming("Maria Silva")
    )) as { reply?: string };
    expect(askService.reply?.toLowerCase()).toContain("servico");

    const askDay = (await service.handleIncomingWhatsAppMessage(incoming("1"))) as {
      reply?: string;
    };
    expect(askDay.reply?.toLowerCase()).toContain("dia");

    const askSlot = (await service.handleIncomingWhatsAppMessage(incoming("1"))) as {
      reply?: string;
    };
    expect(askSlot.reply?.toLowerCase()).toContain("horario");

    const confirmed = (await service.handleIncomingWhatsAppMessage(incoming("1"))) as {
      reply?: string;
    };
    expect(confirmed.reply?.toLowerCase()).toContain("confirmado");
  });

  it("nunca pergunta por profissional quando o Modo Equipes esta desligado", async () => {
    const service = buildService(dbEnabled as boolean);
    const first = (await service.handleIncomingWhatsAppMessage(incoming("Oi"))) as {
      reply?: string;
    };
    expect(first.reply?.toLowerCase()).not.toContain("profissional");
  });
});

// ---------------------------------------------------------------------------
// Modo Equipes LIGADO
// ---------------------------------------------------------------------------

const MARIA = { id: "tm-maria", name: "Maria", phone: null, email: null, active: true };
const JOAO = { id: "tm-joao", name: "Joao", phone: null, email: null, active: true };

// Servicos da empresa. Corte: Maria e Joao. Barba: so Joao.
const CORTE = { ...SERVICE, id: "svc-corte", name: "Corte" };
const BARBA = { ...SERVICE, id: "svc-barba", name: "Barba" };
const COMPANY_SERVICES = [CORTE, BARBA];

function buildTeamService() {
  const conversationStore = new Map<string, { step: string; state: unknown }>();
  let clientSaved: { id: string; name: string; phone: string } | undefined;

  const database = {
    isEnabled: () => true,
    getTeamMode: async () => true,
    getProfessional: async () => ({ ai_enabled: true }),
    listServices: async () => COMPANY_SERVICES,
    getService: async (_pid: string, id: string) =>
      COMPANY_SERVICES.find((service) => service.id === id) || CORTE,
    listTeamMembersForService: async (_pid: string, serviceId: string) =>
      serviceId === BARBA.id ? [JOAO] : [MARIA, JOAO],
    findClientByPhone: async () => clientSaved,
    upsertClient: async (input: { name: string; phone?: string }) => {
      clientSaved = { id: "cli-1", name: input.name, phone: input.phone ?? "" };
      return clientSaved;
    },
    getConversationState: async (professionalId: string, phone: string) =>
      conversationStore.get(`${professionalId}:${phone}`),
    saveConversationState: async (
      professionalId: string,
      phone: string,
      step: string,
      state: unknown
    ) => {
      conversationStore.set(`${professionalId}:${phone}`, { step, state });
    },
    clearConversationState: async (professionalId: string, phone: string) => {
      conversationStore.delete(`${professionalId}:${phone}`);
    }
  };

  const calendar = {
    getAvailabilityForService: async () => ({ slots: buildAvailabilitySlots() }),
    createEvent: async () => ({ status: "created", htmlLink: "https://example.com/evt" })
  };

  const evolution = { sendTextMessage: async () => ({ ok: true }) };
  const professionals = {
    findByEvolutionInstance: () => PROFESSIONAL,
    getById: () => PROFESSIONAL
  };

  return new AiSchedulingService(
    calendar as never,
    database as never,
    evolution as never,
    professionals as never
  );
}

describe("AiSchedulingService - Modo Equipes ligado", () => {
  it("segue a ordem nome -> servico -> profissional -> dia -> horario", async () => {
    const service = buildTeamService();

    // 1) nome primeiro
    const askName = (await service.handleIncomingWhatsAppMessage(incoming("Ola"))) as {
      reply?: string;
    };
    expect(askName.reply?.toLowerCase()).toContain("nome");
    expect(askName.reply?.toLowerCase()).not.toContain("profissional");

    // 2) depois o servico (lista os servicos da empresa)
    const askService = (await service.handleIncomingWhatsAppMessage(
      incoming("Carlos Souza")
    )) as { reply?: string };
    expect(askService.reply?.toLowerCase()).toContain("servico");
    expect(askService.reply).toContain("Corte");
    expect(askService.reply).toContain("Barba");

    // 3) escolhe Corte -> pergunta o profissional que faz Corte (Maria e Joao)
    const askPro = (await service.handleIncomingWhatsAppMessage(incoming("1"))) as {
      reply?: string;
    };
    expect(askPro.reply?.toLowerCase()).toContain("profissional");
    expect(askPro.reply).toContain("Maria");
    expect(askPro.reply).toContain("Joao");

    // 4) escolhe profissional -> dia
    const askDay = (await service.handleIncomingWhatsAppMessage(incoming("2"))) as {
      reply?: string;
    };
    expect(askDay.reply?.toLowerCase()).toContain("dia");

    // 5) escolhe dia -> horario
    const askSlot = (await service.handleIncomingWhatsAppMessage(incoming("2"))) as {
      reply?: string;
    };
    expect(askSlot.reply?.toLowerCase()).toContain("horario");

    // confirma
    const confirmed = (await service.handleIncomingWhatsAppMessage(incoming("1"))) as {
      reply?: string;
    };
    expect(confirmed.reply?.toLowerCase()).toContain("confirmado");
    expect(confirmed.reply).toContain("Joao");
  });

  it("mostra apenas os profissionais que fazem o servico escolhido", async () => {
    const service = buildTeamService();
    await service.handleIncomingWhatsAppMessage(incoming("Ola"));
    await service.handleIncomingWhatsAppMessage(incoming("Carlos Souza"));
    // Barba -> so Joao (auto-selecionado, sem listar Maria)
    const afterBarba = (await service.handleIncomingWhatsAppMessage(incoming("2"))) as {
      reply?: string;
    };
    expect(afterBarba.reply).toContain("Joao");
    expect(afterBarba.reply).not.toContain("Maria");
  });

  it("resolve o profissional pelo nome (item 13)", async () => {
    const service = buildTeamService();
    await service.handleIncomingWhatsAppMessage(incoming("Ola"));
    await service.handleIncomingWhatsAppMessage(incoming("Carlos Souza"));
    await service.handleIncomingWhatsAppMessage(incoming("1")); // Corte -> lista Maria/Joao
    const chose = (await service.handleIncomingWhatsAppMessage(incoming("maria"))) as {
      reply?: string;
    };
    expect(chose.reply).toContain("Maria");
    expect(chose.reply?.toLowerCase()).toContain("dia");
  });

  it("rejeita profissional invalido sem avancar (item 12)", async () => {
    const service = buildTeamService();
    await service.handleIncomingWhatsAppMessage(incoming("Ola"));
    await service.handleIncomingWhatsAppMessage(incoming("Carlos Souza"));
    await service.handleIncomingWhatsAppMessage(incoming("1")); // Corte -> lista Maria/Joao
    const invalid = (await service.handleIncomingWhatsAppMessage(incoming("9"))) as {
      reply?: string;
    };
    expect(invalid.reply?.toLowerCase()).toContain("nao encontrei");
    expect(invalid.reply).toContain("Maria");
  });

  it("apos confirmar, pergunta se quer agendar outro servico e reinicia se sim", async () => {
    const service = buildTeamService();
    // Fluxo ate confirmar: nome -> Barba (auto Joao) -> dia -> horario
    await service.handleIncomingWhatsAppMessage(incoming("Ola"));
    await service.handleIncomingWhatsAppMessage(incoming("Carlos Souza"));
    await service.handleIncomingWhatsAppMessage(incoming("2")); // Barba -> auto Joao -> dia
    await service.handleIncomingWhatsAppMessage(incoming("2")); // dia -> horario
    const confirmed = (await service.handleIncomingWhatsAppMessage(incoming("1"))) as {
      reply?: string;
    };
    expect(confirmed.reply?.toLowerCase()).toContain("confirmado");
    expect(confirmed.reply?.toLowerCase()).toContain("mais algum servico");

    // Responde "1" (sim) -> volta para a escolha de servico, sem pedir nome de novo
    const again = (await service.handleIncomingWhatsAppMessage(incoming("1"))) as {
      reply?: string;
    };
    expect(again.reply?.toLowerCase()).toContain("servico");
    expect(again.reply).toContain("Corte");
    expect(again.reply?.toLowerCase()).not.toContain("nome completo");
  });

  it("encerra o atendimento quando o cliente responde que nao quer mais", async () => {
    const service = buildTeamService();
    await service.handleIncomingWhatsAppMessage(incoming("Ola"));
    await service.handleIncomingWhatsAppMessage(incoming("Carlos Souza"));
    await service.handleIncomingWhatsAppMessage(incoming("2")); // Barba -> auto Joao
    await service.handleIncomingWhatsAppMessage(incoming("2")); // dia
    await service.handleIncomingWhatsAppMessage(incoming("1")); // horario -> confirma
    const done = (await service.handleIncomingWhatsAppMessage(incoming("2"))) as {
      reply?: string;
    };
    expect(done.reply?.toLowerCase()).toContain("ate breve");
  });
});

describe("AiSchedulingService - etapa de categoria", () => {
  it("pula a categoria e lista todos os servicos quando ha servico sem categoria", async () => {
    const conv = new Map<string, { step: string; state: unknown }>();
    let saved: { id: string; name: string; phone: string } | undefined;
    const services = [
      { ...SERVICE, id: "s1", name: "Corte", category: null },
      { ...SERVICE, id: "s2", name: "Unha mao", category: "Unha" }
    ];
    const database = {
      isEnabled: () => true,
      getTeamMode: async () => false,
      getProfessional: async () => ({ ai_enabled: true }),
      listServices: async () => services,
      getService: async (_p: string, id: string) => services.find((s) => s.id === id),
      findClientByPhone: async () => saved,
      upsertClient: async (i: { name: string; phone?: string }) =>
        (saved = { id: "c1", name: i.name, phone: i.phone ?? "" }),
      getConversationState: async (p: string, ph: string) => conv.get(`${p}:${ph}`),
      saveConversationState: async (p: string, ph: string, step: string, state: unknown) => {
        conv.set(`${p}:${ph}`, { step, state });
      },
      clearConversationState: async (p: string, ph: string) => {
        conv.delete(`${p}:${ph}`);
      }
    };
    const calendar = {
      getAvailabilityForService: async () => ({ slots: buildAvailabilitySlots() }),
      createEvent: async () => ({ status: "created" })
    };
    const evolution = { sendTextMessage: async () => ({ ok: true }) };
    const professionals = { findByEvolutionInstance: () => PROFESSIONAL, getById: () => PROFESSIONAL };
    const service = new AiSchedulingService(
      calendar as never,
      database as never,
      evolution as never,
      professionals as never
    );

    await service.handleIncomingWhatsAppMessage(incoming("Ola"));
    const r = (await service.handleIncomingWhatsAppMessage(incoming("Cliente Teste"))) as {
      reply?: string;
    };
    expect(r.reply?.toLowerCase()).toContain("servico");
    expect(r.reply?.toLowerCase()).not.toContain("categoria");
    expect(r.reply).toContain("Corte");
    expect(r.reply).toContain("Unha mao");
  });
});
