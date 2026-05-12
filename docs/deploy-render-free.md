# Deploy do PPC-Pro em site gratuito (Render)

Atualizado em: 18/04/2026

Este guia publica o PPC-Pro com:

- Web app Node.js (Express + frontend estatico)
- Banco PostgreSQL gratuito no Render

## 1) O que ja ficou pronto no projeto

- Blueprint de infraestrutura: `render.yaml`
- Schema Prisma para Postgres: `backend/prisma/schema.postgres.prisma`
- Scripts npm para Postgres:
  - `npm run db:generate:pg`
  - `npm run db:migrate:pg`
  - `npm run db:push:pg`
  - `npm run db:seed:pg`

## 2) O que voce precisa fazer (painel)

1. Criar conta no Render: https://dashboard.render.com
2. Conectar sua conta do GitHub ao Render.
3. Subir este projeto no GitHub (se ainda nao estiver).
4. No Render, abrir `Blueprints` > `New Blueprint Instance`.
5. Selecionar o repositório `ppc-pro` com o arquivo `render.yaml`.
6. Na tela de aprovacao, preencher o segredo:
   - `JWT_SECRET`: use uma string longa e aleatoria (minimo 32 caracteres).
7. Clicar em `Apply` / `Deploy`.

## 3) O que o Render vai criar automaticamente

- `ppc-pro-db` (PostgreSQL Free)
- `ppc-pro-web` (Web Service Free)

O `DATABASE_URL` fica ligado automaticamente via `fromDatabase` no `render.yaml`.

## 4) Primeiro acesso

Quando o deploy terminar:

1. Abra a URL `https://...onrender.com`
2. Teste `https://...onrender.com/health` (deve retornar `status: ok`)

Se for o primeiro deploy com banco vazio, rode bootstrap uma vez no Shell do Render:

```bash
ADMIN_NAME="Administrador PPC" \
ADMIN_EMAIL="admin@seudominio.com" \
ADMIN_PASSWORD="SENHA_FORTE_AQUI" \
BOOTSTRAP_WORK_NAME="OBRA INICIAL" \
npm run db:bootstrap:prod
```

Depois, entre no sistema com `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## 5) Sobre usuarios iniciais

O deploy em producao **nao roda seed automaticamente**.

Motivo: o seed atual foi feito para ambiente de teste e pode sobrescrever dados.

Se precisar popular banco vazio com dados de demonstracao, executar manualmente no
console do serviço:

```bash
npm run db:seed:pg
```

Use isso apenas em ambiente de teste.

## 6) Observacoes de plano gratuito

- O web service free entra em sleep por inatividade.
- Primeira requisicao apos sleep pode demorar.
- Nao indicado para producao final com SLA.

## 7) Troubleshooting rapido

Se build falhar:

1. Confirme que o `render.yaml` foi lido (Blueprint).
2. Verifique logs do step `db:push:pg`.
3. Confirme que `JWT_SECRET` foi preenchido no deploy inicial.

Se app subir mas tela der erro:

1. Abra `/health`
2. Verifique logs do serviço `ppc-pro-web`
3. Se necessario, rode deploy manual novamente.
