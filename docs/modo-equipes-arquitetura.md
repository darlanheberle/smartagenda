# Modo Equipes + Fluxo WhatsApp — Proposta de Arquitetura

> **Status:** proposta para aprovação. **Nada foi implementado.** Nenhum deploy/push/alteração em produção.
> Data da análise: 2026-09-16. Branch analisada: `main` (commit `7dbc933`).

---

## 0. Glossário (⚠️ conflito de nomes importante)

No código atual, **`professional` = a EMPRESA/conta** dona da plataforma: é quem tem a instância
Evolution (WhatsApp), o Gmail e **uma** Google Agenda. Cada `professional` é um **tenant**.

O recurso pedido chama de "profissional" o **membro da equipe** (Maria, João, Amanda).
Para não colidir com o conceito existente, nesta proposta e no código novo uso:

| Conceito do pedido | Nome no código | Já existe? |
|---|---|---|
| Empresa / conta / tenant | `professional` (mantido) | ✅ sim |
| Profissional da equipe (Maria, João…) | **`team_member`** | ❌ novo |
| Modo Equipes ligado/desligado | **`team_mode`** (flag na empresa) | ❌ novo |

Estrutura pedida: **Empresa → Equipe → Profissional → Serviços → Agenda**
Mapeamento: **`professional` → `team_members` → `team_member_services` → `appointments`**

---

## 1. Análise do código atual (respostas às 12 perguntas do item 18)

**Arquivos-chave**
- `apps/api/src/services/ai-scheduling.service.ts` — fluxo/estado do robô WhatsApp.
- `apps/api/src/services/calendar.service.ts` — disponibilidade + Google Calendar.
- `apps/api/src/services/database.service.ts` — schema (auto-migração) e persistência.
- `apps/api/src/services/professional-registry.service.ts` — cache em memória dos tenants.
- `apps/api/src/presentation/app.controller.ts` — todos os endpoints REST.
- `apps/web/src/app/(painel)/servicos/servicos-client.tsx` — aba Serviços (frontend).
- `apps/web/src/app/(painel)/components/panel-shell.tsx` — navegação do painel.

**1. Onde começa o fluxo de agendamento do WhatsApp**
`AppController.evolutionWebhook` / `evolutionWebhookForProfessional`
(`POST /webhooks/evolution` e `/webhooks/evolution/:professionalId`) →
`AiSchedulingService.handleIncomingWhatsAppMessage(payload, forcedProfessionalId?)`
(`ai-scheduling.service.ts:69`).

**2. Como a empresa é identificada durante a conversa**
Duas formas: (a) pelo `:professionalId` da URL do webhook (`forcedProfessionalId`), ou
(b) por `professionals.findByEvolutionInstance(instanceName)` — casando o nome da instância
Evolution do payload com o tenant (`ai-scheduling.service.ts:82-93`). O tenant é carregado do
cache em memória `ProfessionalRegistryService` (populado do banco no boot).

**3. Onde o estado/contexto da conversa é armazenado** ⚠️
Em **memória**, num `Map<string, PendingFlow>` chamado `pendingChoices`
(`ai-scheduling.service.ts:60`), com chave `${professionalId}:${customerPhone}`.
**Não é persistido.** É perdido em restart/redeploy e não funciona com múltiplas réplicas.
Passos atuais: `name → category → service → day → slot` (union type `PendingFlow`, linhas 25-56).

**4. Como serviços são carregados**
`DatabaseService.listServices(professionalId, onlyActive)` — tabela `services`, escopada por
`professional_id`. No robô: `startSchedulingFlow` (linha 245) e `refreshPendingServices`
(linha 615). Serviços têm `category` opcional que vira um passo extra de "categoria".

**5. Como disponibilidade é calculada**
`CalendarService.getAvailabilityForService({professionalId, serviceId, startDate, daysAhead})`
(`calendar.service.ts:178`): consulta **freeBusy da ÚNICA Google Agenda do tenant** e cruza com
as regras semanais (`professional_availability`) em `buildAvailableSlots` (linha 433). Sem Google
conectado, retorna slots mockados.

**6. Como conflitos de horário são verificados**
Só via `busy` do freeBusy do Google (`isSlotBusy`, `calendar.service.ts:544`). **Não há checagem
de conflito no banco** (`appointments`). Ou seja, hoje o "está ocupado?" depende 100% da agenda
Google compartilhada do tenant.

**7. Como o agendamento é persistido**
`CalendarService.createEvent` cria o evento no Google e chama
`DatabaseService.saveAppointment` → tabela `appointments`. Campos: `professional_id`, `client_id`,
`google_event_id`, `service_name` (**texto, sem FK para services**), `starts_at`, `ends_at`,
`status`, `value_cents`, `payment_status`, `source`.

**8. Quais tabelas precisam ser alteradas / criadas**
- **Novas:** `team_members`, `team_member_services` (N:N), `conversation_states` (persistir contexto).
- **Alteradas:** `professionals` (+`team_mode`); `appointments` (+`team_member_id`);
  opcional `team_member_availability` (agenda individual — ver decisão D2).
- Padrão de migração: **auto no boot** em `DatabaseService.onModuleInit` (`create table if not
  exists` + `alter table add column if not exists`). Não há ferramenta de migration separada.

**9. Quais endpoints precisam ser alterados / criados**
- Novos CRUD: `GET/POST/PATCH/DELETE /team-members`, `GET/PUT /team-members/:id/services`.
- Toggle do modo: `GET/PATCH /profile/team-mode` (ou incluir em `/professionals`).
- `POST /calendar/events` e `/appointments/manual` passam a aceitar `teamMemberId` opcional.
- `GET /calendar/availability` passa a aceitar `teamMemberId` opcional.
- `GET /appointments*` passam a devolver `team_member_id`/`team_member_name` (para o painel, #16).

**10. Como introduzir `team_member_id` sem quebrar agendamentos existentes**
Coluna **nullable** em `appointments` (`alter table ... add column if not exists team_member_id
text`). Agendamentos antigos e de empresas sem Modo Equipes ficam com `NULL`. Nenhum backfill
obrigatório. FK opcional (`references team_members(id)`), sem `on delete cascade` — usar
`on delete set null` para preservar histórico.

**11. Como manter o fluxo atual para quem não usa o recurso**
Flag `team_mode` (default `false`) na empresa. No início de `handleIncomingWhatsAppMessage`,
se `team_mode = false` → fluxo idêntico ao de hoje (zero desvio). Se `true` → insere o passo
`team_member` **antes** de `name/category/service`. Frontend: aba Equipe e o seletor só aparecem
com o modo ligado.

**12. Quais testes precisam ser criados**
Ver seção 7. Hoje **não há testes automatizados** no projeto (sem Jest configurado, sem specs).
Parte do trabalho é introduzir a infra de teste (Jest + ts-jest no `apps/api`).

---

## 2. Decisões arquiteturais

> **APROVADO em 2026-09-16:** D1 = **A** (persistir no banco) · D2 = **A** (conflito por banco/membro)
> · D3 = **B** (horário próprio por membro — `team_member_availability` entra na v1).

### D1 — Persistência do contexto da conversa (impacta o item 8) ⭐
O contexto hoje é um `Map` em memória. O item 8 exige que `team_member_id` "não seja perdido".
- **Opção A (recomendada):** criar tabela `conversation_states` e persistir o passo atual + os
  IDs selecionados (`company_id`, `customer_id`, `team_member_id`, `service_id`, etc.).
  Sobrevive a restart/redeploy e a múltiplas réplicas. Custo: refatorar o `pendingChoices`.
- **Opção B (mínima):** manter em memória, só adicionando `team_member` ao `PendingFlow`.
  Rápido, mas o contexto continua volátil (hoje roda 1 réplica `smartagenda_api.1`, então
  "funciona", mas todo deploy derruba conversas em andamento).

> **Recomendo A.** É a base para os itens 8, 9 (troca de profissional) e 13 (nome).

### D2 — Agenda individual / atendimento simultâneo (impacta o item 14) ⭐⭐
Hoje existe **uma** Google Agenda por empresa. Se Maria e João atendem 10:00 ao mesmo tempo,
o freeBusy compartilhado marcaria 10:00 como ocupado para os dois. Opções:

- **Opção A (recomendada): conflito por banco, por `team_member_id`.**
  Disponibilidade do membro = regras semanais − agendamentos daquele membro na tabela
  `appointments` (novo método `listBusyIntervals(professionalId, teamMemberId, range)`).
  A Google Agenda do tenant continua para o dono ver tudo num lugar só (evento marcado com o
  nome do membro no título). Permite simultaneidade real, sem exigir Gmail por membro.
- **Opção B: uma Google Agenda por membro** (cada um faz OAuth). Fiel ao Google, porém pesado:
  exige Gmail e consentimento de cada funcionário; muito atrito para salões pequenos.
- **Opção C: híbrido** — dono usa Google; equipe usa banco. Mais código, ganho pequeno sobre A.

> **Recomendo A.** Menor atrito, resolve simultaneidade e conflito de forma determinística.
> Efeito colateral positivo: passa a existir checagem de conflito no banco (hoje inexistente, item 6).

### D3 — Agenda do membro: herda a da empresa ou é própria? → **B aprovado**
- **Opção B (APROVADA):** tabela `team_member_availability` com horário semanal **por membro**,
  já na v1. Cada profissional tem sua própria grade. Fallback: se um membro não tiver nenhuma
  regra cadastrada, herda as regras da empresa (`professional_availability`) — evita membro sem
  agenda logo após ser criado.
- Opção A (herdar da empresa) — descartada.

### D4 — `service_name` texto vs. FK
Hoje `appointments.service_name` é texto. **Não** vou trocar por FK agora (evita regressão e
migração de dados). Apenas adiciono `team_member_id`. Refino de modelo fica fora de escopo.

---

## 3. Modelo de dados / migrations (auto-migração no boot)

Todas via `DatabaseService.onModuleInit`, idempotentes (`if not exists`).

```sql
-- 3.1 Flag do modo equipes na empresa
alter table professionals
  add column if not exists team_mode boolean not null default false;

-- 3.2 Membros da equipe
create table if not exists team_members (
  id text primary key,
  professional_id text not null,          -- empresa dona (tenant)
  name text not null,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_members_professional_idx
  on team_members (professional_id);

-- 3.3 N:N membro <-> serviço (sem duplicar serviço; serviço continua da empresa)
create table if not exists team_member_services (
  team_member_id text not null references team_members(id) on delete cascade,
  service_id text not null references services(id) on delete cascade,
  primary key (team_member_id, service_id)
);

-- 3.4 team_member_id no agendamento (nullable; não quebra histórico)
alter table appointments
  add column if not exists team_member_id text;
-- FK opcional preservando histórico:
--   alter table appointments add constraint appointments_team_member_fk
--   foreign key (team_member_id) references team_members(id) on delete set null;

-- 3.5 Contexto da conversa persistido (Decisão D1-A)
create table if not exists conversation_states (
  professional_id text not null,
  customer_phone text not null,
  step text not null,                      -- team_member | name | category | service | day | slot
  state_json jsonb not null default '{}',  -- team_member_id, service_id, day options, slots, etc.
  updated_at timestamptz not null default now(),
  primary key (professional_id, customer_phone)
);

-- 3.6 Agenda semanal POR MEMBRO (Decisão D3-B, v1)
create table if not exists team_member_availability (
  id text primary key,
  team_member_id text not null references team_members(id) on delete cascade,
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
  unique (team_member_id, weekday)
);
-- Fallback: membro sem nenhuma regra herda professional_availability da empresa.
```

---

## 4. Alterações de backend (NestJS)

**`database.service.ts`**
- Migrations acima em `onModuleInit`.
- Métodos novos: `listTeamMembers(professionalId, onlyActive?)`, `getTeamMember`,
  `createTeamMember`, `updateTeamMember`, `deactivateTeamMember`,
  `setTeamMemberServices(teamMemberId, serviceIds[])`, `listTeamMemberServiceIds`,
  `listServicesForTeamMember(professionalId, teamMemberId)` (join N:N).
- `saveAppointment`/`createManualAppointment`: aceitar `teamMemberId?`.
- `listBusyIntervals(professionalId, teamMemberId, start, end)` (Decisão D2-A).
- `getTeamMode(professionalId)` / `setTeamMode`.
- Agenda por membro (D3-B): `listTeamMemberAvailability(teamMemberId)`,
  `upsertTeamMemberAvailabilityRule(...)`, com **fallback** para
  `listAvailabilityRules(professionalId)` quando o membro não tem regra própria.
- Listagens de `appointments`: incluir `team_member_id` + `team_member_name` (join).

**`calendar.service.ts`**
- `getAvailabilityForService` e `createEvent` aceitam `teamMemberId?`.
- Em modo equipes, os slots do membro usam as **regras do membro** (`team_member_availability`,
  com fallback p/ as da empresa) e são cruzados com `listBusyIntervals(...teamMemberId...)`
  além do freeBusy compartilhado. Evento no Google recebe o nome do membro no `summary`.

**`ai-scheduling.service.ts`** (ver seção 6 — máquina de estados)
- Ler `team_mode` do tenant no início.
- Novo passo inicial `team_member` quando `team_mode = true`.
- Persistir/ler contexto via `conversation_states` (D1-A) em vez do `Map`.
- Resolver escolha por número **ou** nome (item 13); validar opção inválida (item 12);
  comando "trocar profissional" volta ao passo `team_member` (item 9).
- Serviços ofertados = só os do membro escolhido (item 5).

**`app.controller.ts`** — endpoints novos (todos com `requireOwnProfessional`):
```
GET    /team-members                 lista (query: active)
POST   /team-members                 cria { name, phone?, email?, active?, serviceIds? }
PATCH  /team-members/:id             atualiza
DELETE /team-members/:id             inativa (soft delete: active=false)
GET    /team-members/:id/services    ids de serviços do membro
PUT    /team-members/:id/services    define serviços { serviceIds: [] }
GET    /team-members/:id/availability regras semanais do membro (D3-B)
PUT    /team-members/:id/availability define/atualiza grade do membro
GET    /profile/team-mode            { enabled }
PATCH  /profile/team-mode            { enabled }
```
Ajustar `POST /calendar/events`, `/appointments/manual`, `PATCH /appointments/:id`,
`GET /calendar/availability` para `teamMemberId?`.

**Isolamento multi-tenant:** todo acesso a `team_members`/serviços valida que o registro
pertence ao `professional_id` da sessão (itens 10 e 17 — nunca mostrar/agendar membro de outra
empresa).

---

## 5. Alterações de frontend (Next.js)

**Aba Serviços vira "Serviços | Equipe" com sub-abas** (`servicos-client.tsx`):
- Toggle **"Ativar Modo Equipes"** (chama `PATCH /profile/team-mode`).
- Sub-aba **Serviços**: exatamente como hoje (nenhuma mudança de comportamento).
- Sub-aba **Equipe** (só habilitada/visível com modo ligado):
  - "+ Adicionar profissional": Nome, Telefone (opcional), E-mail (opcional), Status ativo/inativo.
  - Lista de checkboxes dos **serviços da empresa** para marcar o que o membro faz (N:N; serviço
    nunca duplicado).
  - **Grade de horário por membro** (D3-B): editor semanal por profissional (reaproveitar o
    componente de horários da empresa), com opção "usar horário da empresa" quando vazio.
  - Editar / inativar membro.

**`lib/types.ts`**: `TeamMember`, `TeamMemberServiceLink`; `Service` inalterado; `Appointment`
ganha `team_member_id?`, `team_member_name?`.

**`lib/data.ts`**: buscar `/team-members` e o flag do modo no SSR do painel.

**Agenda (item 16)**: em `agenda-client.tsx`, exibir "Profissional: João" quando houver
`team_member_name`. Arquitetura já permite futuro filtro **Todos | Maria | João | Amanda**
(deixar o filtro pronto no estado, mesmo que simples na v1).

**Navegação**: sem novo item de menu — tudo dentro de "Servicos" (`panel-shell.tsx` inalterado),
respeitando o pedido ("dentro da aba Serviços").

---

## 6. Fluxo WhatsApp + máquina de estados

**Estados** (`step`): `team_member?` → `name?` → `category?` → `service` → `day` → `slot` → confirmado.
`team_member` só existe se `team_mode = true`. `name` só se cliente novo. `category` só se houver categorias.

```
Mensagem recebida
  └─ identifica empresa (instância/URL)
  └─ team_mode?
       ├─ false ─────────────► FLUXO ATUAL (idêntico a hoje)
       └─ true
            └─ contexto tem team_member?
                 ├─ não → lista membros ATIVOS da empresa (numeração dinâmica, item 11)
                 │         └─ cliente responde nº OU nome (item 13); inválido → repergunta (item 12)
                 │         └─ salva team_member_id no conversation_states (item 8)
                 └─ sim → segue: (cliente novo? pede nome) → serviços DO MEMBRO (item 5)
                          → dia → horários DAQUELE MEMBRO (conflito por banco, item 14)
                          → confirma (Profissional/Serviço/Data/Hora) → cria evento c/ team_member_id
```

**Comandos especiais**
- "trocar profissional" (item 9): volta ao passo `team_member`, mantém `customer_id`, recalcula
  serviços/horários para o novo membro.
- "menu/reiniciar" (já existe): zera o contexto.

**Regras de resolução de escolha** (itens 11, 12, 13)
- Numeração construída na hora a partir dos membros ativos; a resposta `1/2/3` é resolvida contra
  **a lista daquela conversa** (guardada no contexto), nunca fixa.
- Aceita número **ou** nome; nome ambíguo → pedir confirmação.
- Fora do intervalo → mensagem amigável repetindo as opções (mesma regra p/ serviço e horário).

---

## 7. Testes (introduzir Jest + ts-jest no `apps/api`)

**Unitários — `AiSchedulingService`**
- `team_mode=false` produz exatamente o fluxo atual (teste de regressão de contrato).
- `team_mode=true`: pede profissional antes de tudo; escolha por número e por nome; opção inválida
  não avança; "trocar profissional" volta e recalcula; contexto preserva `team_member_id` entre
  mensagens.
- Serviços exibidos = só os do membro (item 5).

**Unitários — disponibilidade (D2-A)**
- Dois membros no mesmo horário não conflitam entre si.
- Mesmo membro com horário ocupado não é oferecido novamente.

**Integração — endpoints**
- CRUD `team_members` + isolamento por tenant (empresa A não vê/edita membro da empresa B).
- N:N serviços (sem duplicação; remoção limpa vínculos).
- `appointments` com/sem `team_member_id` (compatibilidade).

**Migração**
- Boot cria tabelas/colunas de forma idempotente; base antiga sobe sem erro (colunas nullable).

---

## 8. Riscos de regressão

| Risco | Mitigação |
|---|---|
| Quebrar fluxo de quem não usa equipes | `team_mode=false` = caminho intocado + teste de contrato |
| Perda de contexto no deploy (memória) | Persistir em `conversation_states` (D1-A) |
| Conflito de nomes `professional` × membro | Nomear tudo novo como `team_member`; sem tocar no tenant |
| Agenda compartilhada bloquear simultâneos | Conflito por banco por membro (D2-A) |
| Migração em base de produção | Colunas nullable + `if not exists` + FK `on delete set null` |
| Agendamentos antigos sem `team_member_id` | Ficam `NULL`; painel trata ausência (mostra sem membro) |
| Isolamento multi-tenant | `requireOwnProfessional` + `professional_id` em toda query |

---

## 9. Plano de implementação em etapas (só após aprovação)

- **Etapa 0 — Fundação:** infra de testes (Jest/ts-jest) + migrations 3.1–3.5. Sem mudança de comportamento.
- **Etapa 1 — Persistir contexto (D1-A):** refatorar `pendingChoices` → `conversation_states`,
  com testes provando que o fluxo atual não muda.
- **Etapa 2 — CRUD equipe (backend):** `team_members` + N:N serviços + `team_member_availability`
  (D3-B) + endpoints + isolamento + testes.
- **Etapa 3 — Frontend equipe:** toggle Modo Equipes + sub-aba Equipe (cadastro, serviços do
  membro e **grade de horário por membro**) na aba Serviços.
- **Etapa 4 — Fluxo WhatsApp:** passo `team_member`, serviços por membro, troca de profissional,
  validações (itens 5, 9, 11, 12, 13).
- **Etapa 5 — Disponibilidade individual (D2-A + D3-B):** slots pela grade do membro, conflito por
  banco por membro + evento com nome do membro (item 14) + testes de simultaneidade.
- **Etapa 6 — Painel:** exibir profissional na agenda + base para filtro por membro (item 16).
- **Etapa 7 — QA em staging** (sem produção; sem envio real): simular webhooks com payloads de teste.

Cada etapa é um PR pequeno, revisável, atrás da flag `team_mode` — produção não muda até o modo
ser ligado por empresa.

---

## 10. Decisões e pontos menores

**Resolvido:** D1 = persistir no banco · D2 = conflito por banco/membro · D3 = horário próprio por membro.

**Defaults adotados (me avise se quiser diferente):**
4. No modo equipes, o robô só oferta serviços com **pelo menos um membro ativo vinculado**
   (serviço "órfão" não aparece no WhatsApp, mas continua no catálogo).
5. Ao **desligar** o Modo Equipes com agendamentos futuros que já têm `team_member_id`: o dado é
   **preservado** (aparece no painel) e o fluxo do robô simplesmente para de perguntar profissional.
