# Comissão do profissional + Produção por dia

Permite ao dono definir quanto (%) do valor de cada serviço fica com o **profissional**
(o resto fica com a empresa) e acompanhar a **produção diária por profissional**.

## Comissão

- **Comissão padrão da empresa** (`professionals.default_commission_percent`, padrão 50): a %
  que fica com o profissional, aplicada a todos os serviços.
- **% por serviço** (`services.commission_percent`, opcional): sobrepõe o padrão só naquele serviço.
- **Snapshot no agendamento** (`appointments.commission_percent`): ao criar o agendamento (manual ou
  pelo WhatsApp), grava a comissão efetiva (do serviço, senão o padrão). Assim o relatório não muda
  se a % for alterada depois.
- Semântica: `commission_percent` = parte do **profissional**. Ex.: 40 → 40% profissional, 60% empresa.

### Endpoints
- `GET/PATCH /profile/commission` → `{ defaultPercent }` (só o dono).
- `POST/PATCH /services` aceitam `commissionPercent` (null = usa o padrão).

## Produção por profissional (por dia)

- `GET /reports/production?date=YYYY-MM-DD` (só o dono) → agrupa os agendamentos do dia (não
  cancelados) por profissional, com: quantidade, total, parte do profissional e parte da empresa,
  além da lista de serviços (valor, %, parte do profissional). Sem `date`, usa hoje (fuso da empresa).
- Painel: aba **Financeiro** → seção **"Produção por profissional"** com seletor de data.

## Frontend
- `servicos-client.tsx`: card "Comissão do profissional (padrão)" + campo "% do profissional" por
  serviço + a % aparece em cada serviço da lista.
- `financeiro/producao-dia.tsx`: relatório do dia por profissional.

## Migrations (idempotentes, no boot)
`services.commission_percent`, `professionals.default_commission_percent` (default 50),
`appointments.commission_percent`.
