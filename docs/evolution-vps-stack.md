# Evolution API na VPS

Stack informada pelo usuário para Evolution API em Docker Swarm.

## Dados confirmados

- Serviço: `evolution_v2`
- Imagem: `evoapicloud/evolution-api:v2.3.6`
- URL pública: `https://evolutionapi.agendasmart.com.br`
- Porta interna exposta ao Traefik: `8080`
- Rede Docker: `network_public`
- Autenticação: `apikey`
- Banco Evolution: PostgreSQL externo ao serviço
- Cache: Redis em `redis://redis:6379/2`
- Chatwoot: habilitado
- Webhook global: desabilitado na stack atual

## O que isso significa para o SmartAgenda

No ambiente do SmartAgenda, configurar:

```env
EVOLUTION_API_URL=https://evolutionapi.agendasmart.com.br
EVOLUTION_API_KEY=colocar-a-chave-global-ou-chave-da-instancia-no-ambiente
EVOLUTION_INSTANCE_NAME=nome-da-instancia-whatsapp-de-teste
```

A chave não deve ser versionada. Coloque somente no `.env` local, nos secrets da VPS ou no secret manager usado no deploy.

## Webhook

Como `WEBHOOK_GLOBAL_ENABLED=false`, o caminho recomendado é configurar webhook por instância no manager da Evolution.

URL do webhook quando a API SmartAgenda estiver publicada:

```txt
https://api.agendasmart.com.br/webhooks/evolution
```

Enquanto estiver local, usar túnel público temporário ou publicar a API na VPS. A Evolution na VPS não consegue chamar `localhost` da sua máquina.

Eventos necessários para o MVP:

- `MESSAGES_UPSERT`
- `CONNECTION_UPDATE`

Eventos opcionais depois:

- `MESSAGES_UPDATE`
- `SEND_MESSAGE`
- `QRCODE_UPDATED`

## Endpoint de diagnóstico no SmartAgenda

A API possui:

```http
GET /integrations/evolution/status
```

Esse endpoint chama:

```http
GET https://evolutionapi.agendasmart.com.br/instance/fetchInstances
```

usando o header:

```http
apikey: EVOLUTION_API_KEY
```

Ele serve para confirmar se a API do SmartAgenda consegue conversar com sua Evolution.

## Segurança

A stack compartilhada contém segredos reais. Recomendações:

- Rotacionar a chave global da Evolution se ela foi exposta fora do ambiente seguro.
- Não commitar `.env`.
- Não salvar tokens do Google Calendar em texto puro no banco em produção.
- Usar secrets do Docker Swarm ou variáveis protegidas no deploy.
- Criar uma chave dedicada para o SmartAgenda se a Evolution permitir permissões por instância.