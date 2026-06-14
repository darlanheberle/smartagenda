# Integrações

## WhatsApp

Opção inicial recomendada para o protótipo: Evolution API, porque você já possui uma instância na VPS.

Fluxo:

1. Cliente envia mensagem no WhatsApp.
2. Evolution API envia webhook para `POST /webhooks/evolution`.
3. API identifica cliente, intenção e contexto.
4. IA decide se precisa consultar horários, reagendar, cancelar ou responder.
5. API consulta disponibilidade no Google Calendar.
6. API responde pelo WhatsApp usando Evolution API.

## Chatwoot

Uso recomendado:

- Centralizar conversas humanas.
- Permitir transbordo da IA para atendente.
- Registrar histórico de conversas por cliente.

## Google Calendar

Será a agenda principal do profissional.

Operações:

- Verificar disponibilidade.
- Criar compromisso.
- Alterar compromisso.
- Cancelar compromisso.
- Enviar resumo diário.

## OpenAI

Uso inicial:

- Interpretar mensagens do cliente.
- Extrair intenção, data, horário, serviço e profissional.
- Gerar respostas curtas e naturais.

Regra importante: a IA não deve confirmar horário sem antes validar disponibilidade no Google Calendar.
