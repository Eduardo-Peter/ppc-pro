API Spec - App de Financas Pessoais (v1)

Autenticacao
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout

Orcamento anual
- GET /budget-years
- POST /budget-years
- GET /budget-years/:id
- PATCH /budget-years/:id
- POST /budget-years/:id/lock
- POST /budget-years/:id/unlock

Categorias EAP
- GET /budget-years/:id/categories
- POST /budget-years/:id/categories
- PUT /categories/:id
- DELETE /categories/:id

Valores planejados (orcado)
- GET /budget-years/:id/plans?month=
- PUT /budget-years/:id/plans/bulk

Cadastros base
- GET /institutions
- POST /institutions
- PUT /institutions/:id
- DELETE /institutions/:id

- GET /accounts
- POST /accounts
- PUT /accounts/:id
- DELETE /accounts/:id

- GET /payment-methods
- POST /payment-methods
- PUT /payment-methods/:id
- DELETE /payment-methods/:id

Lancamentos
- GET /transactions?from=&to=&accountId=&categoryId=&direction=&status=
- POST /transactions
- PUT /transactions/:id
- DELETE /transactions/:id
- POST /transactions/import/csv

Transferencias
- POST /transfers
- GET /transfers?from=&to=

Relatorios
- GET /reports/budget-vs-actual?budgetYearId=&month=
- GET /reports/budget-vs-actual/summary?budgetYearId=&fromMonth=&toMonth=
- GET /reports/monthly-result?year=&month=
- GET /reports/net-worth?from=&to=
- GET /reports/account-balance-trend?accountId=&from=&to=
- GET /reports/fgts-evolution?from=&to=

Fechamento mensal
- GET /monthly-closes?year=
- POST /monthly-closes/:year/:month/preview
- POST /monthly-closes/:year/:month/close
- POST /monthly-closes/:year/:month/reopen

Investimentos
- GET /investments/positions?snapshotDate=
- POST /investments/positions/bulk
- GET /investments/performance?from=&to=&scope=&scopeId=

FGTS
- GET /fgts/snapshots?from=&to=
- POST /fgts/snapshots

Auditoria
- GET /audit?entityType=&entityId=&from=&to=

Validacoes obrigatorias
- Categoria obrigatoria para income/expense.
- Categoria proibida para transfer.
- Mes fechado bloqueia alteracoes de lancamentos.
- Orcamento bloqueado impede alteracao da EAP.
- Valores monetarios em centavos inteiros no payload.

Campos tipicos que o usuario preenche
- Orcamento anual (categorias + valores por mes).
- Lancamentos diarios.
- Saldos de fechamento de contas.
- Snapshot de investimentos e FGTS.

Calculos automaticos esperados
- Consolidacao mensal por categoria/conta.
- Comparativo Orcado x Realizado.
- Resultado mensal.
- Patrimonio liquido e sua evolucao.
- Retorno percentual dos investimentos.
