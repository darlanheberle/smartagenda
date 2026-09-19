# Login próprio por profissional

Cada **profissional da equipe** (`team_member`) passa a ter login próprio, com acesso
**restrito à própria agenda e aos próprios clientes**. A **empresa** (`professional`, o tenant
dono do WhatsApp/Google/painel) continua com acesso total (dono/admin).

## Papéis

- **owner** (empresa): login por e-mail/senha da conta. Acesso total (administração, serviços,
  equipe, IA, financeiro, configurações).
- **team_member** (profissional): login próprio. Vê apenas **Hoje, Agenda e Clientes**, filtrados
  para os agendamentos/clientes dele.

A sessão é um cookie assinado com `{ professionalId, teamMemberId?, expiresAt }`. Se houver
`teamMemberId`, é sessão de profissional (escopo restrito); sem ele, é sessão de dono.

## Credenciais via link de ativação

O profissional **define a própria senha**. Fluxo:

1. Na aba **Serviços → Equipe**, o dono clica em **"Gerar link de acesso"** de um profissional
   (precisa ter e-mail cadastrado). → `POST /team-members/:id/invite` gera um token (validade 7 dias).
2. O dono envia o link `…/ativar-profissional?token=…` ao profissional.
3. O profissional abre o link, confirma nome/e-mail (`GET /auth/team-activation?token=…`) e define a
   senha (`POST /auth/team-activate`), já entrando logado.
4. Depois, o profissional entra normalmente pelo `/login` com **e-mail + senha**.

`/auth/login` tenta primeiro autenticar como `team_member` e, se não achar, como empresa.

## Backend (apps/api)

- `auth.service.ts`: `SessionPayload.teamMemberId?`; `createSession(res, professionalId, teamMemberId?)`;
  `requireSession`, `requireOwner`, `authenticateTeamMember`.
- `database.service.ts`: colunas em `team_members` (`password_hash`, `activation_token`,
  `activation_token_expires_at`, `activated_at`) — migração idempotente no boot; métodos
  `findTeamMemberByEmail`, `findTeamMemberByActivationToken`, `setTeamMemberActivationToken`,
  `setTeamMemberPassword`, `listClientsForTeamMember`; `listAppointments`/`listUpcomingAppointments`/
  `getTodayDashboard` aceitam `teamMemberId?`.
- `app.controller.ts`: `/auth/login` (equipe→empresa), `/auth/me` retorna `role`,
  `POST /team-members/:id/invite`, `GET /auth/team-activation`, `POST /auth/team-activate`.
  Endpoints de administração exigem `requireOwner` (bloqueiam profissionais). `dashboard/today`,
  `clients`, `appointments`, `appointments/upcoming` e `GET /services` usam sessão escopada.
  `decorateTeamMember` **não** expõe segredos (senha/token); traz só o status de acesso.

## Frontend (apps/web)

- `lib/types.ts`: `AccountProfessional.role`/`teamMemberId`, `TeamMemberAccess`.
- `lib/data.ts`: `getPanelData` ramifica por papel (equipe carrega só dashboard/clients/appointments/services).
- `components/panel-shell.tsx`: profissional vê só Hoje/Agenda/Clientes.
- `app/ativar-profissional/page.tsx`: página de ativação (define a senha).
- `servicos/equipe-client.tsx`: status de acesso (Sem acesso / Convite pendente / Acesso ativo) +
  botão **"Gerar link de acesso"**.

## Testes

`test/auth.service.spec.ts`: sessão com papéis (owner vs team_member), `requireOwner` bloqueia
profissional, `authenticateTeamMember` valida a senha.

## Login por empresa (multi-tenant): `/{slug}/login`

Para não misturar acessos entre empresas, cada empresa tem um **slug** único (apelido gerado
automaticamente do nome, coluna `professionals.slug`, backfill no boot). O login pode ser escopado
a uma empresa via a URL `https://www.agendasmart.com.br/{slug}/login`:

- `GET /public/company/:slug` → nome + branding da empresa (público, para a tela de login).
- `POST /auth/login` aceita `companySlug`: resolve a empresa e **escopa** a busca do profissional
  (`findTeamMemberByEmail(email, professionalId)`), então o mesmo e-mail pode existir em empresas
  diferentes sem conflito. Login de dono também é validado contra a empresa do slug.
- Página `app/[slug]/login/page.tsx`; `/auth/me` do dono retorna `slug` (gera se faltar).
- A aba **Serviços → Equipe** mostra o **"Link de acesso da sua equipe"** (`/{slug}/login`) para o
  dono copiar e enviar. O `/login` global continua funcionando.

> Observação: mesmo sem a URL por empresa, os dados **nunca** se misturam após o login — a sessão
> é ligada a `{professionalId, teamMemberId}`. O slug resolve a ambiguidade de e-mail no momento do
> login e organiza o acesso por empresa.

## Fora de escopo (próximos passos)

- Recuperação de senha (esqueci a senha).
- Envio automático do convite por e-mail/WhatsApp (hoje o link é copiado e enviado manualmente).
- Edição da própria grade de horários pelo profissional.
