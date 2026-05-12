# PPC-Pro - Requisitos Recuperados

Data: 2026-02-24

## Fonte recuperada
- Conversa histórica local em `C:\Users\eduar\Documents\Meus Aplicativos\ppc-pro\docs\historico-recuperado.md`
- PDF citado por você: `C:\Users\eduar\Downloads\APP - INTEGRAÇÃO PLANEJAMENTO E MEDIÇÕES.pdf`

## Objetivo do app
- App Windows para planejamento e controle de obra, com operação parecida com MS Project/ProjectLibre.
- Estrutura de planejamento com hierarquia, tarefas, dependências, recursos e integração com medições/FVS.
- Importação e exportação de XML do MS Project sem destruir a estrutura EAP/WBS.

## Diretrizes funcionais que você definiu
- Interface estilo Project, prática, sem fricção operacional.
- WBS com 6 níveis de convenção:
  - Nível 0: Empreendimento
  - Nível 1: Zona
  - Nível 2: Repetição
  - Nível 3: Grupo de Trabalho
  - Nível 4: Tarefas
  - Nível 5: EAP (vinculação)
- Possibilidade de excluir níveis.
- Tarefas com ID numérica visível.
- Dependências com tipos FS, SS, FF e SF.
- Dependências entre tarefas de grupos/níveis diferentes.
- Cadastro de recursos (empreiteiros) e alocação em tarefas.
- Campo EAP na tarefa.
- Copiar nível preservando estrutura/identação (uso de pavimentos tipo).
- Duplicação múltipla de nível.
- Reordenação de níveis (subir/descer) e drag-and-drop.
- Drag-and-drop de tarefas dentro e entre níveis.

## Regras de importação/exportação (críticas)
- Não criar nível artificial "Importado MS Project ...".
- Preservar hierarquia original do XML.
- Itens estruturais sem tarefas filhas não devem virar tarefa por padrão.
- Permitir configurar limite de nível tratado como "plan" na importação.

## Evolução solicitada
- Gantt acoplado à grade.
- FVS ligado ao planejamento (planejado x medido por tarefa/EAP).
- Painéis de avanço por empreiteiro/EAP.

## Próximo passo técnico recomendado
1. Fechar fidelidade de import/export XML (round-trip consistente com ProjectLibre/MS Project).
2. Validar classificação de níveis/tarefas em casos de borda.
3. Só depois evoluir Gantt e FVS.
