# SmartAgenda

Protótipo SaaS para profissionais que atendem com horário marcado. A plataforma centraliza WhatsApp, Google Agenda, lembretes, clientes, equipe e financeiro.

## Stack utilizada

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript
- Banco: PostgreSQL
- Integrações planejadas: Google Calendar API, Evolution API/WhatsApp, Chatwoot, OpenAI API
- Infra: Docker, VPS, Traefik

## Estrutura

```txt
apps/
  web/   Painel SaaS do profissional
  api/   API NestJS para agenda, clientes, financeiro e integrações
docs/
  integrations.md
  roadmap.md
```

## Como rodar localmente

1. Instale Node.js 20+.
2. Copie `.env.example` para `.env`.
3. Configure as URLs da VPS, Evolution API, Chatwoot, PostgreSQL, Google e OpenAI.
4. Rode:

```bash
npm install
npm run dev
```

## Primeira versão do protótipo

- Dashboard operacional do dia
- Agenda sincronizada conceitualmente com Google Calendar
- Clientes e histórico
- Financeiro básico
- Fluxo de atendimento por IA via WhatsApp
- Estrutura inicial da API para receber webhooks da Evolution API

## Observação

Não coloque tokens reais no repositório. Use somente variáveis de ambiente.
