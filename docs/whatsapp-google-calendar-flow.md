# Fluxo WhatsApp + Google Agenda

## Regra de produto

Cada usuário/profissional que agenda pela plataforma precisa ter:

- Nome do profissional.
- Número de WhatsApp que atenderá clientes.
- Instância Evolution API vinculada a esse número.
- Gmail do profissional.
- Google Agenda conectada via OAuth usando esse Gmail.
- Regras de agenda: fuso horário, duração padrão e horários de atendimento.

O WhatsApp não substitui o Gmail. Ele identifica por qual número/instância o cliente chegou. O Gmail define qual Google Agenda será consultada e atualizada.

## Endpoints criados

### Cadastrar profissional

```http
POST /professionals
```

Exemplo:

```json
{
  "name": "Dra. Ana Pereira",
  "specialty": "Dentista",
  "whatsappNumber": "+5511999990000",
  "evolutionInstanceName": "dra-ana-whatsapp",
  "gmail": "dra.ana@gmail.com",
  "timezone": "America/Sao_Paulo",
  "appointmentDurationMinutes": 60
}
```

### Listar profissionais

```http
GET /professionals
```

### Testar conexão Evolution

```http
GET /integrations/evolution/status
```

### Gerar link de conexão Google

```http
GET /professionals/:id/google/auth-url
```

A resposta traz `authUrl`. O profissional abre esse link, entra com o Gmail cadastrado e autoriza a agenda.

### Callback Google

```http
GET /integrations/google/callback?code=...&state=professionalId
```

O `state` é o ID do profissional, usado para salvar os tokens na pessoa certa.

### Ver disponibilidade

```http
GET /calendar/availability?professionalId=...
```

Sem Google conectado, retorna horários mockados para o protótipo não travar.

### Criar evento

```http
POST /calendar/events
```

Exemplo:

```json
{
  "professionalId": "id-do-profissional",
  "clientName": "Maria Souza",
  "clientPhone": "+5511988887777",
  "startsAt": "2026-06-15T14:00:00-03:00",
  "serviceName": "Consulta"
}
```

### Webhook da Evolution API

```http
POST /webhooks/evolution
```

A Evolution deve enviar a instância do WhatsApp no payload. A API usa essa instância para descobrir qual profissional/Gmail/agenda deve responder.

## Variáveis usadas

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3333/integrations/google/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy

EVOLUTION_API_URL=https://evolutionapi.agendasmart.com.br
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=smartagenda-demo
```

## Próxima etapa técnica

Hoje os profissionais ficam em memória para validar o fluxo. A próxima etapa é persistir isso no PostgreSQL com tabelas reais.

Sugestão de tabelas:

```sql
create table professionals (
  id uuid primary key,
  name text not null,
  specialty text,
  whatsapp_number text not null unique,
  evolution_instance_name text not null unique,
  gmail text not null,
  timezone text not null default 'America/Sao_Paulo',
  appointment_duration_minutes integer not null default 60,
  created_at timestamptz not null default now()
);

create table google_calendar_connections (
  professional_id uuid primary key references professionals(id),
  email text not null,
  calendar_id text not null default 'primary',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  connected_at timestamptz not null default now()
);
```

Tokens devem ser criptografados antes de salvar em produção.