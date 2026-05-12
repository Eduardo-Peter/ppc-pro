# App Financas

Projeto isolado do app financeiro, separado do ConstruPlan.

Estrutura:
- `design/` - especificacoes funcionais e tecnicas
- `backend/` - API local
- `desktop/` - app desktop
- `distribution/` - scripts de instalacao e inicializacao
- `release/` - pacotes gerados para compartilhamento

## Build rapido de distribuicao

No CMD:

```bat
cd /d "C:\Users\eduar\Documents\Meus Aplicativos\financas"
build-share-package.cmd
```

Saida:
- Pasta: `release\Financas-Pacote`
- Zip para compartilhar: `release\Financas-Pacote.zip`
- Instalador unico: `release\Financas-Setup.exe`

No computador de destino:
1. Executar `Financas-Setup.exe`.
2. Abrir pelo atalho `Financas` na area de trabalho (sem abrir backend manualmente).
3. Nao precisa instalar Node.js no computador de destino.
