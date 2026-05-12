const { ROLES } = require('./constants');

const PERMISSION_CATALOG = [
  { key: 'cadastro_geral.usuarios.ver', module: 'Cadastro Geral', label: 'Ver usuários', description: 'Permite visualizar usuários e seus perfis.' },
  { key: 'cadastro_geral.usuarios.editar', module: 'Cadastro Geral', label: 'Gerir usuários', description: 'Permite criar, editar e inativar usuários.' },
  { key: 'cadastro_geral.perfis.ver', module: 'Cadastro Geral', label: 'Ver perfis', description: 'Permite visualizar perfis de permissionamento.' },
  { key: 'cadastro_geral.perfis.editar', module: 'Cadastro Geral', label: 'Gerir perfis', description: 'Permite criar, editar e excluir perfis de permissionamento.' },
  { key: 'cadastro_geral.obras.ver', module: 'Cadastro Geral', label: 'Ver obras', description: 'Permite visualizar obras cadastradas.' },
  { key: 'cadastro_geral.obras.editar', module: 'Cadastro Geral', label: 'Gerir obras', description: 'Permite criar, editar e excluir obras sem histórico.' },
  { key: 'cadastro_geral.empreiteiros.ver', module: 'Cadastro Geral', label: 'Ver empreiteiros gerais', description: 'Permite visualizar cadastro geral de empreiteiros.' },
  { key: 'cadastro_geral.empreiteiros.editar', module: 'Cadastro Geral', label: 'Gerir empreiteiros gerais', description: 'Permite criar, editar e excluir empreiteiros gerais.' },
  { key: 'cadastro_geral.causas.ver', module: 'Cadastro Geral', label: 'Ver causas', description: 'Permite visualizar totalizadoras e causas.' },
  { key: 'cadastro_geral.causas.editar', module: 'Cadastro Geral', label: 'Gerir causas', description: 'Permite criar, editar e excluir causas.' },
  { key: 'cadastro_geral.grupos.ver', module: 'Cadastro Geral', label: 'Ver grupos gerais', description: 'Permite visualizar grupos de atividades gerais.' },
  { key: 'cadastro_geral.grupos.editar', module: 'Cadastro Geral', label: 'Gerir grupos gerais', description: 'Permite criar, editar e excluir grupos gerais.' },
  { key: 'cadastro_geral.mao_obra.ver', module: 'Cadastro Geral', label: 'Ver tipos de mão de obra', description: 'Permite visualizar tipos de mão de obra.' },
  { key: 'cadastro_geral.mao_obra.editar', module: 'Cadastro Geral', label: 'Gerir tipos de mão de obra', description: 'Permite criar, editar e excluir tipos de mão de obra.' },
  { key: 'cadastro_geral.construtora.ver', module: 'Cadastro Geral', label: 'Ver dados da construtora', description: 'Permite visualizar dados institucionais da construtora.' },
  { key: 'cadastro_geral.construtora.editar', module: 'Cadastro Geral', label: 'Gerir dados da construtora', description: 'Permite editar nome, CNPJ, endereço, site e logo.' },

  { key: 'obra.cadastros.zoneamento.ver', module: 'Cadastros da Obra', label: 'Ver zoneamento', description: 'Permite visualizar zoneamento da obra.' },
  { key: 'obra.cadastros.zoneamento.editar', module: 'Cadastros da Obra', label: 'Gerir zoneamento', description: 'Permite criar, editar e excluir itens do zoneamento.' },
  { key: 'obra.cadastros.empreiteiros.ver', module: 'Cadastros da Obra', label: 'Ver empreiteiros da obra', description: 'Permite visualizar empreiteiros vinculados à obra.' },
  { key: 'obra.cadastros.empreiteiros.editar', module: 'Cadastros da Obra', label: 'Gerir empreiteiros da obra', description: 'Permite importar e excluir empreiteiros da obra.' },
  { key: 'obra.cadastros.grupos.ver', module: 'Cadastros da Obra', label: 'Ver grupos da obra', description: 'Permite visualizar grupos de atividades da obra.' },
  { key: 'obra.cadastros.grupos.editar', module: 'Cadastros da Obra', label: 'Gerir grupos da obra', description: 'Permite importar, editar e excluir grupos da obra.' },
  { key: 'obra.cadastros.feriados.ver', module: 'Cadastros da Obra', label: 'Ver feriados', description: 'Permite visualizar feriados da obra.' },
  { key: 'obra.cadastros.feriados.editar', module: 'Cadastros da Obra', label: 'Gerir feriados', description: 'Permite criar, editar e excluir feriados da obra.' },
  { key: 'obra.cadastros.prazos.ver', module: 'Cadastros da Obra', label: 'Ver prazos de governança', description: 'Permite visualizar prazos de fechamento do planejamento e feedback.' },
  { key: 'obra.cadastros.prazos.editar', module: 'Cadastros da Obra', label: 'Gerir prazos de governança', description: 'Permite editar prazos de fechamento do planejamento e feedback.' },

  { key: 'programacao.semana.ver', module: 'Programação', label: 'Ver programação da semana', description: 'Permite visualizar programação semanal e clima.' },
  { key: 'programacao.semana.abrir', module: 'Programação', label: 'Abrir semana', description: 'Permite abrir semana para planejamento.' },
  { key: 'programacao.semana.editar', module: 'Programação', label: 'Editar programação', description: 'Permite incluir/editar/excluir tarefas no planejamento.' },
  { key: 'programacao.semana.fechar', module: 'Programação', label: 'Fechar planejamento', description: 'Permite fechar planejamento da semana.' },
  { key: 'programacao.semana.solicitar_reabertura', module: 'Programação', label: 'Solicitar reabertura', description: 'Permite solicitar reabertura de semana fechada.' },
  { key: 'programacao.semana.aprovar_reabertura', module: 'Programação', label: 'Aprovar reabertura', description: 'Permite aprovar e executar reabertura de semana.' },
  { key: 'programacao.tarefas.cancelar', module: 'Programação', label: 'Cancelar tarefas', description: 'Permite cancelar tarefas com rastreabilidade.' },
  { key: 'programacao.excel.importar_exportar', module: 'Programação', label: 'Importar/Exportar Excel', description: 'Permite importar e exportar planilha da semana em Excel.' },

  { key: 'atividades_previstas.ver', module: 'Atividades Previstas', label: 'Ver atividades previstas', description: 'Permite visualizar lista prevista da semana fechada.' },
  { key: 'atividades_previstas.pdf_empreiteiro', module: 'Atividades Previstas', label: 'PDF por empreiteiro', description: 'Permite gerar PDF de tarefas por empreiteiro.' },
  { key: 'atividades_previstas.pdf_geral', module: 'Atividades Previstas', label: 'PDF geral da semana', description: 'Permite gerar PDF geral da semana.' },
  { key: 'atividades_previstas.pdf_ata', module: 'Atividades Previstas', label: 'PDF ata de reunião', description: 'Permite gerar PDF de ata de presença.' },
  { key: 'atividades_previstas.excel', module: 'Atividades Previstas', label: 'Excel atividades previstas', description: 'Permite exportar atividades previstas para Excel.' },

  { key: 'feedback.semana.ver', module: 'Feedback', label: 'Ver feedback da semana', description: 'Permite visualizar itens para feedback.' },
  { key: 'feedback.semana.editar', module: 'Feedback', label: 'Editar feedback', description: 'Permite preencher status, causas e comentários do feedback.' },
  { key: 'feedback.semana.fechar', module: 'Feedback', label: 'Fechar feedback', description: 'Permite fechar feedback da semana.' },
  { key: 'feedback.semana.pdf_comparativo', module: 'Feedback', label: 'PDF comparativo do feedback', description: 'Permite gerar PDF comparando planejado vs executado.' },

  { key: 'dashboards.semana.ver', module: 'Dashboards', label: 'Ver dashboard semanal', description: 'Permite visualizar indicadores da semana.' },
  { key: 'dashboards.historico.ver', module: 'Dashboards', label: 'Ver dashboard histórico', description: 'Permite visualizar histórico acumulado da obra.' },
  { key: 'dashboards.pdf_semana', module: 'Dashboards', label: 'PDF semanal', description: 'Permite gerar relatório PDF semanal.' },
  { key: 'dashboards.pdf_historico', module: 'Dashboards', label: 'PDF histórico', description: 'Permite gerar relatório PDF histórico.' },
  { key: 'auditoria.ver', module: 'Governança', label: 'Ver trilhas de auditoria', description: 'Permite acesso aos registros de quem fez o quê e quando.' },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((item) => item.key);

const ROLE_DEFAULT_PERMISSIONS = {
  [ROLES.ADMIN]: [...ALL_PERMISSION_KEYS],
  [ROLES.ENGINEERING]: [
    'obra.cadastros.zoneamento.ver',
    'obra.cadastros.empreiteiros.ver',
    'obra.cadastros.grupos.ver',
    'obra.cadastros.feriados.ver',
    'obra.cadastros.prazos.ver',
    'programacao.semana.ver',
    'programacao.semana.abrir',
    'programacao.semana.editar',
    'programacao.semana.fechar',
    'programacao.semana.solicitar_reabertura',
    'programacao.excel.importar_exportar',
    'atividades_previstas.ver',
    'atividades_previstas.pdf_empreiteiro',
    'atividades_previstas.pdf_geral',
    'atividades_previstas.pdf_ata',
    'atividades_previstas.excel',
    'feedback.semana.ver',
    'feedback.semana.editar',
    'feedback.semana.fechar',
    'feedback.semana.pdf_comparativo',
    'dashboards.semana.ver',
    'dashboards.historico.ver',
    'dashboards.pdf_semana',
    'dashboards.pdf_historico',
  ],
  [ROLES.CONTROLLER]: [
    'cadastro_geral.usuarios.ver',
    'cadastro_geral.perfis.ver',
    'obra.cadastros.prazos.ver',
    'obra.cadastros.prazos.editar',
    'programacao.semana.ver',
    'programacao.semana.aprovar_reabertura',
    'atividades_previstas.ver',
    'atividades_previstas.pdf_empreiteiro',
    'atividades_previstas.pdf_geral',
    'atividades_previstas.pdf_ata',
    'feedback.semana.ver',
    'dashboards.semana.ver',
    'dashboards.historico.ver',
    'dashboards.pdf_semana',
    'dashboards.pdf_historico',
    'auditoria.ver',
  ],
  [ROLES.MANAGEMENT]: [
    'programacao.semana.ver',
    'atividades_previstas.ver',
    'dashboards.semana.ver',
    'dashboards.historico.ver',
    'dashboards.pdf_semana',
    'dashboards.pdf_historico',
    'auditoria.ver',
  ],
  [ROLES.CONTRACTOR]: [
    'atividades_previstas.ver',
    'atividades_previstas.pdf_empreiteiro',
  ],
  [ROLES.VISUALIZER]: [
    'programacao.semana.ver',
    'atividades_previstas.ver',
    'feedback.semana.ver',
    'dashboards.semana.ver',
  ],
  [ROLES.FOREMAN]: [
    'programacao.semana.ver',
    'atividades_previstas.ver',
    'feedback.semana.ver',
  ],
};

const SYSTEM_PROFILE_TEMPLATES = [
  {
    name: 'Administrador',
    description: 'Acesso total ao sistema, incluindo cadastros, planejamento, feedback, dashboards e auditoria.',
    baseRole: ROLES.ADMIN,
    isSystem: true,
    permissions: [...ALL_PERMISSION_KEYS],
  },
  {
    name: 'Engenharia',
    description: 'Operação de planejamento e feedback da obra, com acesso aos relatórios operacionais.',
    baseRole: ROLES.ENGINEERING,
    isSystem: true,
    permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.ENGINEERING],
  },
  {
    name: 'Controller',
    description: 'Controle de governança, prazos, aprovações e visão gerencial da obra.',
    baseRole: ROLES.CONTROLLER,
    isSystem: true,
    permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.CONTROLLER],
  },
  {
    name: 'Diretoria/Gerência',
    description: 'Visualização gerencial de indicadores e relatórios executivos.',
    baseRole: ROLES.MANAGEMENT,
    isSystem: true,
    permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.MANAGEMENT],
  },
  {
    name: 'Empreiteiro',
    description: 'Acesso às atividades vinculadas à sua empresa na semana.',
    baseRole: ROLES.CONTRACTOR,
    isSystem: true,
    permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.CONTRACTOR],
  },
  {
    name: 'Visualizador',
    description: 'Acesso apenas de leitura para acompanhamento.',
    baseRole: ROLES.VISUALIZER,
    isSystem: true,
    permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.VISUALIZER],
  },
  {
    name: 'Mestre/Contra-mestre',
    description: 'Leitura operacional da programação e feedback.',
    baseRole: ROLES.FOREMAN,
    isSystem: true,
    permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.FOREMAN],
  },
];

function sanitizePermissionKeys(keys) {
  const valid = new Set(PERMISSION_CATALOG.map((item) => item.key));
  return [...new Set((Array.isArray(keys) ? keys : [])
    .map((item) => String(item || '').trim())
    .filter((key) => valid.has(key)))];
}

module.exports = {
  PERMISSION_CATALOG,
  ALL_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSIONS,
  SYSTEM_PROFILE_TEMPLATES,
  sanitizePermissionKeys,
};

