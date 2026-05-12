# Roadmap inicial do PPC-Pro

## Visão geral
Planejamento das fases iniciais do projeto web PPC-Pro.

## Fase 1: Fundação
- [ ] Levantar requisitos básicos (campanhas, orçamentos, relatórios).
- [ ] Definir stack de frontend (React/Next/etc.).
- [ ] Configurar repositório e ambiente (Git, npm, nodemon).
- [ ] Criar servidor Express básico com `/health`.

## Fase 2: Estrutura
- [ ] Modelar banco de dados com Prisma (User, Campaign).
- [ ] Scaffold frontend (Hello World que consome `/health`).
- [ ] Definir scripts de desenvolvimento em package.json.
- [ ] Iniciar documentação e handoff (ppc-pro-handoff.md).

## Fase 3: Módulos iniciais
- [ ] Endpoint de autenticação (`/auth/login`).
- [ ] CRUD de campanhas.
- [ ] Interface web básica para criar/editar campanhas.

## Fase 4: Qualidade e entrega
- [ ] Testes unitários/integração.
- [ ] Automação de build e deploy.
- [ ] Pacote de distribuição (ZIP/installer).

## Observações
- Manter o trabalho isolado em `ppc-pro`.
- Atualizar este roadmap conforme o projeto evoluir.