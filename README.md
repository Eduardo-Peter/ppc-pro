# ppc-pro

Módulo de Planejamento de Produção de Campo (PPC) para obras civis. O
software substitui planilhas Google Sheets e gera indicadores automáticos.

## Como rodar a V1 de teste

1. Abra a pasta `C:\Users\eduar\Documents\Meus Aplicativos\ppc-pro`.
2. Instale dependências:
   ```powershell
   npm install
   ```
3. Gere client Prisma + aplique schema no banco:
   ```powershell
   npm run db:generate
   $env:RUST_LOG="info"
   npm run db:push
   ```
4. Carregue dados de teste:
   ```powershell
   npm run db:seed
   ```
5. Suba o backend:
   ```powershell
   npm run start
   ```
6. API disponível em `http://localhost:3000`.

## Abrir rapido no Windows (sem digitar no CMD)

1. Duplo clique em `open-ppc-pro.cmd`.
2. Na primeira execucao ele prepara dependencias e banco automaticamente.
3. Nas proximas execucoes ele so sobe o backend em segundo plano e abre o sistema.

Para encerrar o backend por duplo clique, use `stop-ppc-pro.cmd`.

Para criar atalhos na area de trabalho (`PPC-Pro` e `PPC-Pro - Stop`), execute uma vez:

`install-desktop-shortcuts.cmd`

## Acesso visual (web)

- Abra no navegador: `http://localhost:3000`
- Login de teste:
  - `engenharia@ppc.local / engenharia123`
  - `controller@ppc.local / controller123`
  - `admin@ppc.local / admin123`
  - `diretoria@ppc.local / diretoria123`
  - `empreiteiro@ppc.local / empreiteiro123`
  - `visualizador@ppc.local / visualizador123`

## Usuarios de teste

- `admin@ppc.local` / `admin123`
- `engenharia@ppc.local` / `engenharia123`
- `controller@ppc.local` / `controller123`
- `diretoria@ppc.local` / `diretoria123`
- `empreiteiro@ppc.local` / `empreiteiro123`
- `visualizador@ppc.local` / `visualizador123`

## Estrutura de pastas

- `backend/` – servidor Express com rotas, permissoes e Prisma.
- `desktop/` – código mínimo Electron para testes em desktop.
- `docs/` – handoffs, roadmap e especificações.
- `distribution/` – scripts de empacotamento futuros.

## Referências anteriores
Ainda existem arquivos referentes ao projeto Financas em `docs/` apenas como
base e historico. Eles não devem ser utilizados no novo desenvolvimento.
