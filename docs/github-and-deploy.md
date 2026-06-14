# GitHub e Deploy

## Repositório

Destino escolhido:

```txt
https://github.com/darlanheberle/smartagenda
```

## Antes de publicar

- Confirmar que `.env` não existe no commit.
- Usar `.env.example` apenas como modelo.
- Configurar segredos reais somente na VPS, GitHub Actions ou painel de deploy.

## Comandos de publicação

Quando Git estiver instalado/autenticado nesta máquina:

```bash
git init
git branch -M main
git add .
git commit -m "feat: scaffold smartagenda prototype"
git remote add origin https://github.com/darlanheberle/smartagenda.git
git push -u origin main
```

## Variáveis necessárias na VPS

- `DATABASE_URL`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `CHATWOOT_URL`
- `CHATWOOT_ACCOUNT_ID`
- `CHATWOOT_API_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `JWT_SECRET`

## Primeira rota de webhook

A Evolution API deve apontar mensagens recebidas para:

```txt
POST https://SEU_DOMINIO/webhooks/evolution
```

No ambiente local:

```txt
POST http://localhost:3333/webhooks/evolution
```
