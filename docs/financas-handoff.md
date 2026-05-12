# Handoff - Projeto Financas (origem: `financas/`)

Data de consolidacao: 2026-02-22

## Escopo que foi definido
- Controle de Curto Prazo: Orcamento, Lancamentos, Relatorios.
- Longo Prazo: Investimentos/Patrimonio com evolucao mensal e relatorios.
- Backup/importacao de dados.
- Distribuicao para usuarios finais com instalacao simplificada.

## Status funcional atual
- Orcamento com EAP em 3 niveis; nivel 1/2 totalizadores.
- Planejamento mensal por categoria nivel 3.
- Lancamentos com edicao/exclusao e agrupamento por conta.
- Relatorio mensal, mensal inteligente e acumulado anual em PDF.
- Patrimonio com tipos de investimento e lancamentos mensais.
- Relatorio de patrimonio com comparativo mes a mes e variacoes.
- Variacao patrimonial de janeiro considera base do ano anterior.

## Persistencia e seguranca de dados
- Banco principal local: `%LOCALAPPDATA%\Financas\backend\prisma\dev.db`
- Instalador preserva `dev.db` em atualizacoes.
- Backup adicional existente: `financas\backup\dev-20260222-174847.db`

## Distribuicao
- Script principal de build: `financas\build-share-package.cmd`
- Pacote atual: `financas\release\Financas-Pacote.zip`
- Tamanho zip otimizado: ~159 MB
- Tamanho extraido esperado: ~365 MB

## Decisoes tecnicas relevantes
- App desktop Electron.
- Backend Node/Express + Prisma SQLite.
- App inicia backend local automaticamente em segundo plano.
- Runtime enxuto no pacote:
  - `node_modules` apenas producao
  - remocao de cache/engines de build desnecessarios
  - idiomas desktop reduzidos para `pt-BR` e `en-US`

## Pendencias conhecidas
- Geracao de `Financas-Setup.exe` (IExpress) ainda falha em alguns ambientes.
- Fluxo recomendado atual: usar `Financas-Pacote.zip` + `install-financas.cmd`.

## Comandos uteis
- Rebuild pacote:
  - `cd /d "C:\Users\eduar\Documents\Meus Aplicativos\financas"`
  - `build-share-package.cmd`
- Instalar no perfil local:
  - `cd /d "C:\Users\eduar\Documents\Meus Aplicativos\financas\release\Financas-Pacote"`
  - `install-financas.cmd`
- Abrir app instalado:
  - `"%LOCALAPPDATA%\Financas\app\Financas.exe"`

## Arquivos chave na origem
- `financas\desktop\main.js`
- `financas\desktop\src\renderer.js`
- `financas\backend\src\routes\patrimony.ts`
- `financas\distribution\install-financas.cmd`
- `financas\build-share-package.cmd`

## Observacao
Este handoff foi criado para preservar contexto e decisoes no novo workspace `ppc-pro`.
