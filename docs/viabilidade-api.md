# Modulo de Viabilidade de Empreendimentos (API)

Este modulo adiciona analise economica e acompanhamento de progresso por empreendimento (`Work`).

## Rotas

Todas as rotas exigem `Authorization: Bearer <token>`.

### 1) Consultar viabilidade da obra

`GET /works/:workId/feasibility`

Retorna o cenario economico da obra e metricas calculadas (`ROI`, `margem`, `payback`).

### 2) Criar/atualizar viabilidade da obra

`PUT /works/:workId/feasibility`

Payload exemplo:

```json
{
  "analysisDate": "2026-04-18",
  "totalInvestment": 1500000,
  "expectedRevenue": 2400000,
  "expectedOperatingCosts": 520000,
  "expectedDurationMonths": 20,
  "riskLevel": "MEDIUM",
  "notes": "Terreno regularizado e comercializacao prevista no mes 8."
}
```

Campos:
- `riskLevel`: `LOW | MEDIUM | HIGH`
- Valores monetarios: nao negativos
- `expectedDurationMonths`: inteiro >= 0

### 3) Listar snapshots de acompanhamento

`GET /works/:workId/feasibility/snapshots`

### 4) Criar/atualizar snapshot por data de referencia

`POST /works/:workId/feasibility/snapshots`

Payload exemplo:

```json
{
  "referenceDate": "2026-05-01",
  "plannedProgressPct": 20,
  "actualProgressPct": 18,
  "plannedCostAccum": 350000,
  "actualCostAccum": 390000,
  "plannedRevenueAccum": 100000,
  "actualRevenueAccum": 90000,
  "status": "ATTENTION",
  "notes": "Atraso de licenca ambiental."
}
```

Campos:
- `status`: `ON_TRACK | ATTENTION | CRITICAL | COMPLETED`
- Percentuais: de `0` a `100`
- Valores monetarios acumulados: nao negativos
- `referenceDate` obrigatoria

### 5) Editar snapshot por id

`PUT /works/:workId/feasibility/snapshots/:snapshotId`

Aceita os mesmos campos do snapshot e tambem permite alterar `referenceDate`.

### 6) Remover snapshot

`DELETE /works/:workId/feasibility/snapshots/:snapshotId`

### 7) Resumo executivo

`GET /works/:workId/feasibility/summary`

Retorna:
- `health` (situacao atual)
- cenario de viabilidade
- ultimo snapshot
- KPIs consolidados (`expectedNetResult`, `expectedRoiPct`, `estimatedPaybackMonths`, variacoes de custo/receita/progresso)
