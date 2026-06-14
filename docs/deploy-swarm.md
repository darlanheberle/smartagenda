# Deploy Swarm

Domínios usados:

- Frontend: `https://www.agendasmart.com.br`
- API: `https://api.agendasmart.com.br`
- Evolution: `https://evolutionapi.agendasmart.com.br`

## Build na VPS

```bash
git clone https://github.com/darlanheberle/smartagenda.git
cd smartagenda
docker build -f apps/api/Dockerfile -t smartagenda-api:latest .
docker build -f apps/web/Dockerfile -t smartagenda-web:latest .
```

## Variáveis de deploy

Não salvar chaves no Git. Antes do deploy, exportar no shell da VPS:

```bash
export EVOLUTION_API_KEY="..."
export EVOLUTION_INSTANCE_NAME="robo_openai"
export JWT_SECRET="..."
```

Quando o Google OAuth estiver criado:

```bash
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
```

## Publicar stack

```bash
docker stack deploy -c deploy/smartagenda-stack.yml smartagenda
```

## Validar

```bash
curl -k https://api.agendasmart.com.br/health
curl -k https://api.agendasmart.com.br/integrations/evolution/status
curl -k https://www.agendasmart.com.br
```