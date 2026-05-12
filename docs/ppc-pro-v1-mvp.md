# PPC-Pro V1 MVP (Teste)

Data: 2026-02-25

## Escopo implementado nesta iteracao

- Autenticacao e sessao via JWT.
- Multiobra com cadastro de obra (nome, endereco, CEP, data de inicio).
- Perfis flexiveis por obra com vigencia (`UserWorkRole`).
  - Perfis padrao de teste: `ADMIN`, `ENGINEERING`, `CONTROLLER`, `MANAGEMENT`, `CONTRACTOR`, `VISUALIZER`.
- Cadastros operacionais:
  - empreiteiros;
  - causas;
  - locais (2 niveis);
  - grupos de tarefas (bunches) e itens.
- Ciclo de semana PPC:
  - abertura da semana;
  - previsao do tempo por dia;
  - fechamento de planejamento;
  - solicitacao de reabertura;
  - aprovacao/rejeicao de reabertura.
- Ciclo de tarefas:
  - criacao/edicao/exclusao enquanto semana aberta;
  - aplicacao de grupo de tarefas na semana;
  - cancelamento apenas por `ADMIN` ou `CONTROLLER`;
  - persistencia com semana de origem + semana atual;
  - replanejamento (rollover) para semana seguinte.
- Feedback de fim de ciclo por tarefa:
  - `EXECUTED`, `STARTED`, `NOT_STARTED`, `CANCELLED`;
  - causa e comentario;
  - fechamento de feedback da semana.
- Indicadores e governanca:
  - dashboard semanal global e por empreiteiro;
  - canceladas fora do denominador do PPC;
  - trilha de auditoria por evento.
- Regras de semanas futuras:
  - engenharia pode solicitar;
  - controller/admin aprovam.
- Configuracao institucional:
  - dados da empresa e logo path;
  - regra de prazo para planejamento/feedback.

## Pendencias planejadas para proxima iteracao

- Exportacao real para `xlsx` e `pdf`.
- Relatorio por empreiteiro para impressao/assinatura fisica.
- Disparo real de e-mail (atualmente existe apenas varredura de atrasos via endpoint).
- Interface desktop/web para substituir completamente a planilha.

## Regras confirmadas pelo negocio

1. Assinatura do encarregado: fisica.
2. Tarefas canceladas: fora do indicador PPC principal.
3. Hospedagem: nuvem em fase posterior.
4. Replanejamento:
   - linha original permanece no historico;
   - tarefa aparece nas semanas seguintes enquanto pendente;
   - deixa de aparecer na semana posterior a execucao.
5. Apenas `ADMIN` pode criar novas obras.
