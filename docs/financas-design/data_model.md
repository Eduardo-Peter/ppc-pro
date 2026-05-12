Modelagem de Dados - App de Financas Pessoais

Objetivo
- Orcamento anual estatico em EAP (3 niveis).
- Lancamentos diarios com consolidacao automatica.
- Comparativo Orcado x Realizado por mes.
- Fechamento mensal de contas, investimentos e FGTS.
- Evolucao patrimonial e retorno percentual.

Entidades principais

- User
  - id, name, email, password_hash, created_at, updated_at

- BudgetYear
  - id, user_id, year, name, status (draft|active|archived), locked_at (nullable), created_at, updated_at
  - regra: um registro por ano por usuario

- BudgetCategory
  - id, budget_year_id, code, name, level (1|2|3), parent_id (nullable), kind (income|expense), order_idx, active
  - regra: apenas nivel 3 recebe lancamentos

- BudgetPlanAmount
  - id, budget_year_id, budget_category_id, month (1..12), planned_amount_cents

- Institution
  - id, user_id, name, type (bank|broker|wallet|government), active

- Account
  - id, user_id, institution_id (nullable), name, type (checking|savings|credit_card|cash|investment|fgts|other), include_in_net_worth, active
  - closing_day (nullable), due_day (nullable)

- PaymentMethod
  - id, user_id, name, type (pix|debit|credit|ted|boleto|cash|other), account_id (nullable), institution_id (nullable), active

- Transaction
  - id, user_id, occurred_on, competency_year, competency_month
  - amount_cents, direction (income|expense|transfer), description
  - budget_category_id (nullable para transfer), account_id, payment_method_id (nullable), institution_id (nullable)
  - status (posted|pending|canceled), created_at, updated_at

- Transfer
  - id, user_id, from_transaction_id, to_transaction_id
  - regra: representa transferencia interna, sem impacto em resultado

- MonthlyClose
  - id, user_id, year, month, status (open|closed), closed_at (nullable), notes (nullable)

- AccountBalanceSnapshot
  - id, monthly_close_id, account_id, closing_balance_cents

- AssetSnapshot
  - id, monthly_close_id, asset_type (investment|fgts|property|other), name
  - gross_value_cents, liabilities_value_cents (nullable), cost_basis_cents (nullable), notes (nullable)

- InvestmentPosition
  - id, user_id, account_id, snapshot_date, symbol (nullable), name
  - quantity (nullable), avg_price_cents (nullable), cost_basis_cents, current_value_cents

- InvestmentPerformance
  - id, user_id, period_start, period_end, scope (portfolio|account|asset), scope_id (nullable)
  - net_contributions_cents, pnl_cents, return_percent, method (simple|mwr|twr), calculated_at

- FgtsSnapshot
  - id, user_id, snapshot_date, balance_cents, monthly_deposit_cents (nullable), monthly_yield_cents (nullable), notes (nullable)

Dados manuais (usuario preenche)
- EAP e valores planejados do orcamento.
- Cadastros de banco, conta e forma de pagamento.
- Lancamentos diarios (ou importacao e classificacao).
- Saldos de fechamento mensal das contas.
- Snapshot de investimentos e FGTS (quando nao houver importacao automatica).

Dados automaticos (sistema calcula)
- Realizado mensal por categoria/conta.
- Desvio Orcado x Realizado (valor e percentual).
- Resultado mensal (receitas - despesas).
- Patrimonio liquido mensal e evolucao.
- Retorno percentual de investimentos.
- Evolucao FGTS por periodo.

Regras de negocio
- Orcamento bloqueado (`locked_at`) nao permite alterar estrutura EAP.
- Categoria obrigatoria para `income` e `expense`.
- Categoria proibida para `transfer`.
- Mes fechado bloqueia alteracoes ate reabertura.
- Valores monetarios sempre em centavos inteiros.

Indices recomendados
- budget_plan_amount(budget_year_id, month, budget_category_id)
- transaction(user_id, occurred_on)
- transaction(user_id, competency_year, competency_month)
- transaction(account_id, occurred_on)
- monthly_close(user_id, year, month) unique
- account_balance_snapshot(monthly_close_id, account_id) unique
- investment_position(user_id, snapshot_date)
- fgts_snapshot(user_id, snapshot_date)
