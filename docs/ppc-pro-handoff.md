# PPC-Pro - Handoff Continuo

Ultima atualizacao: 05/04/2026

Este arquivo registra o estado tecnico do produto para continuidade semanal,
validacao funcional e reducao de perda de contexto.

## Objetivo do sistema

Plataforma de planejamento e controle semanal de obra (PPC), com fluxo:

1. Pre-programacao da semana
2. Reuniao de PPC
3. Programacao da semana
4. Atividades previstas
5. Feedback da semana
6. Qualidade percebida
7. Gestao e dashboards (relatorio semanal e historico)

## Stack

- Frontend: `frontend/index.html`, `frontend/app.js`, `frontend/styles.css`
- Backend: Node.js + Express
- ORM/DB: Prisma + SQLite (`backend/prisma/dev.db`)

## Regras de negocio vigentes (resumo)

- Semana operacional: segunda a sabado (com domingo exibido no clima em modulos de planejamento/PDFs definidos).
- Brasil: formato data/hora e textos em portugues BR.
- Fluxo de fechamento:
  - Reuniao PPC so fecha apos pre-programacao fechada.
  - Programacao so fecha apos pre-programacao + reuniao PPC fechadas.
- Feedback pode salvar parcial; fechamento exige completude conforme regra.
- Local 1 obrigatorio para fechamento de pre/programacao.

## Atualizacao desta etapa (05/04/2026)

1. **Pendencias para Pre-programacao**
- Corrigido rollover no backend: pendencias agora sao copiadas para `PreTask`
  da semana seguinte (antes estava indo para `Task`).
- Mantida regra de status:
  - `RESERVA` nao executada permanece `RESERVA` na semana seguinte.
  - `RETRABALHO` preservado.
  - Demais pendencias entram como base planejada e aparecem como pendentes por origem.

2. **Bloqueios de fechamento**
- Mensagens de bloqueio aplicadas para ordem correta de fechamento:
  - pre-programacao antes da reuniao PPC
  - pre-programacao + reuniao PPC antes da programacao

3. **UX de planejamento**
- Cabecalho da tabela de pre/programacao congelado (sticky).
- Miniatura de previsao do tempo (quando bloco principal sai da tela).
- Miniatura reposicionada mais acima e centralizada para evitar sobreposicao.

4. **Edicao de pendentes**
- Em atividades pendentes: bloqueada edicao de `Tarefa`, `Local 1` e `Local 2`.
- Mantida excecao de status para pendente vindo de reserva (editavel entre
  `Planejada` e `Reserva`).

5. **Preparacao para deploy web gratuito (18/04/2026)**
- Adicionado blueprint Render: `render.yaml`
- Adicionado schema Prisma para Postgres: `backend/prisma/schema.postgres.prisma`
- Adicionados scripts npm para Postgres no `package.json`
- Adicionado guia operacional: `docs/deploy-render-free.md`

## Comandos para subir o sistema local

```powershell
cd "C:\Users\eduar\Documents\Meus Aplicativos\ppc-pro"
npm run start
```

Saude da API:

```powershell
curl http://localhost:3000/health
```

Frontend no navegador:

```text
http://localhost:3000
```

## Se porta 3000 estiver ocupada

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID_ENCONTRADO> /F
```

## Arquivos principais para manutencao

- Backend:
  - `backend/routes/weeks.js`
  - `backend/routes/tasks.js`
  - `backend/routes/dashboard.js`
- Frontend:
  - `frontend/app.js`
  - `frontend/index.html`
  - `frontend/styles.css`
- Banco:
  - `backend/prisma/dev.db`
  - `backend/prisma/schema.prisma`

## Procedimento de continuidade (8 semanas)

No fim de cada bloco de trabalho:

1. Atualizar este handoff com:
  - data
  - alteracoes aplicadas
  - pendencias abertas
  - riscos/bugs observados
2. Validar sintaxe rapida:
  - `node --check frontend/app.js`
  - `node --check backend/routes/weeks.js`
  - `node --check backend/routes/dashboard.js`
3. Executar teste funcional rapido dos fluxos criticos:
  - pre-programacao
  - reuniao PPC
  - programacao
  - feedback
  - qualidade percebida
  - relatorios PDF
