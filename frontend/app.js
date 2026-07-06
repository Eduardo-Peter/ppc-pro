const state = {
  token: null,
  user: null,
  userWorks: [],
  availableWorks: [],
  contractors: [],
  contractorCatalog: [],
  locations: [],
  contractorFunctions: [],
  causes: [],
  holidays: [],
  users: [],
  permissionCatalog: [],
  permissionProfiles: [],
  workProfileAssignments: [],
  effectivePermissions: [],
  taskGroups: [],
  taskGroupTemplates: [],
  sheetDraftRows: [],
  weatherExtrasByWeekId: {},
  weeks: [],
  tasks: [],
  expectedWeekId: null,
  expectedWeekNumber: null,
  expectedTasks: [],
  expectedEmailContractors: [],
  qualityWeekId: null,
  qualityWeekNumber: null,
  qualityData: null,
  ppcMeetingWeekId: null,
  ppcMeetingWeekNumber: null,
  ppcMeetingData: null,
  dashboardWeekId: null,
  dashboardWeekNumber: null,
  selectedWorkId: null,
  selectedWeekId: null,
  cadastroView: 'menu',
  appMode: 'obra',
  editingWorkId: null,
  editingContractorId: null,
  editingCauseId: null,
  editingTaskGroupId: null,
  editingTaskGroupItemId: null,
  editingLaborTypeId: null,
  editingZoneLevel1Id: null,
  editingZoneLevel2Id: null,
  contractorCatalogFilter: '',
  editingObraTaskGroupId: null,
  editingObraTaskGroupItemId: null,
  editingObraHolidayId: null,
  notificationRule: null,
  perceivedQualityConfig: null,
  workTimeZone: 'America/Sao_Paulo',
  workTimeZoneByWorkId: {},
  deadlineCountdownTimer: null,
  saveReminderTimer: null,
  keepaliveTimer: null,
  autosaveTimer: null,
  editingUserId: null,
  editingUserWorkIds: [],
  editingPermissionProfileId: null,
  cadastroUsersTab: 'users',
  obraCadastroTab: 'zoneamento',
  dashboardTab: 'relatorio',
  workflowNavigationInProgress: false,
  currentRoles: new Set(),
  isAdmin: false,
  appConfig: null,
  closeFeedbackPending: false,
  weekSheetSaveInProgress: false,
  feedbackSaveInProgress: false,
  qualitySaveInProgress: false,
  planningDirty: false,
  feedbackDirty: false,
  qualityDirty: false,
  weatherMiniObserver: null,
  weatherStripVisible: true,
  weatherMiniPosition: null,
  zoneCollapsedParents: new Set(),
  zoneCollapsedWorkId: null,
  editingZoneLevel1ModalId: null,
  planningFilters: {
    seq: '',
    originWeek: '',
    contractor: '',
    location1: '',
    location2: '',
    task: '',
    mon: '',
    tue: '',
    wed: '',
    thu: '',
    fri: '',
    sat: '',
    status: '',
  },
  expectedFilters: {
    seq: '',
    contractor: '',
    supervisor: '',
    labor: '',
    location1: '',
    location2: '',
    task: '',
    status: '',
  },
  feedbackFilters: {
    seq: '',
    contractor: '',
    location1: '',
    location2: '',
    task: '',
    causeGroup: '',
    cause: '',
    comment: '',
    status: '',
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const PT_WEEKDAY = {
  MONDAY: 'Seg',
  TUESDAY: 'Ter',
  WEDNESDAY: 'Qua',
  THURSDAY: 'Qui',
  FRIDAY: 'Sex',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

const PT_WEEKDAY_FULL = {
  MONDAY: 'Segunda-feira',
  TUESDAY: 'Terça-feira',
  WEDNESDAY: 'Quarta-feira',
  THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

const PT_MONTH_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const BR_TIMEZONE_BY_UF = {
  AC: 'America/Rio_Branco',
  AL: 'America/Maceio',
  AP: 'America/Belem',
  AM: 'America/Manaus',
  BA: 'America/Bahia',
  CE: 'America/Fortaleza',
  DF: 'America/Sao_Paulo',
  ES: 'America/Sao_Paulo',
  GO: 'America/Sao_Paulo',
  MA: 'America/Fortaleza',
  MT: 'America/Cuiaba',
  MS: 'America/Campo_Grande',
  MG: 'America/Sao_Paulo',
  PA: 'America/Belem',
  PB: 'America/Fortaleza',
  PR: 'America/Sao_Paulo',
  PE: 'America/Recife',
  PI: 'America/Fortaleza',
  RJ: 'America/Sao_Paulo',
  RN: 'America/Fortaleza',
  RS: 'America/Sao_Paulo',
  RO: 'America/Porto_Velho',
  RR: 'America/Boa_Vista',
  SC: 'America/Sao_Paulo',
  SP: 'America/Sao_Paulo',
  SE: 'America/Maceio',
  TO: 'America/Araguaina',
};

const STATUS_PT = {
  PLANNED: 'Planejada',
  RETRABALHO: 'Retrabalho',
  RESERVA: 'Reserva',
  IN_PROGRESS: 'Iniciada',
  EXECUTED: 'Executada',
  CANCELLED: 'Cancelada',
};

const FEEDBACK_STATUS_PT = {
  EXECUTED: 'Executada',
  EXECUTED_UNPLANNED: 'Executada / Não planejada',
  STARTED: 'Iniciada',
  NOT_STARTED: 'Não iniciada',
  CANCELLED: 'Cancelada',
};

const DASHBOARD_ROLES = ['ADMIN', 'CONTROLLER', 'MANAGEMENT', 'ENGINEERING'];
const EDIT_ROLES = ['ADMIN', 'ENGINEERING', 'CONTROLLER'];
const CANCEL_ROLES = ['ADMIN', 'CONTROLLER'];
const ADMIN_ONLY_ROLES = ['ADMIN'];
const DEADLINE_ROLES = ['ADMIN', 'CONTROLLER'];

const ROLE_PT = {
  ADMIN: 'Administrador',
  ENGINEERING: 'Engenharia',
  CONTROLLER: 'Controller',
  MANAGEMENT: 'Diretoria/Gerência',
  CONTRACTOR: 'Empreiteiro',
  VISUALIZER: 'Visualizador',
  FOREMAN: 'Mestre/Contra-mestre',
};

const ZONE_LEVEL1_PREFIX = '__ZONE_L1__::';
const SHEET_WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function setStatus(message, isError = false) {
  const bar = $('#statusBar');
  if (!bar) return;
  bar.textContent = message;
  bar.style.color = '';
  bar.classList.toggle('status-error', Boolean(isError));
  bar.classList.toggle('status-success', !isError);
  showToast(message, { kind: isError ? 'error' : 'success' });
}

function showToast(message, options = {}) {
  const container = $('#toastContainer');
  if (!container || !message) return;
  const toast = document.createElement('div');
  const kind = String(options.kind || 'success');
  toast.className = `toast-message toast-${kind}`;
  toast.textContent = String(message);
  container.appendChild(toast);

  const duration = Number(options.durationMs) > 0
    ? Number(options.durationMs)
    : (kind === 'error' ? 7000 : 4500);

  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-4px)';
    window.setTimeout(() => toast.remove(), 180);
  }, duration);
}

function reminderMessageForTab(tabName = activeTabName()) {
  if (tabName === 'preprogramacao') return 'Lembrete: salve a planilha da Pré-programação da Semana.';
  if (tabName === 'programacao') return 'Lembrete: salve a planilha da Programação da Semana.';
  if (tabName === 'feedback') return 'Lembrete: salve o Feedback da Semana antes de continuar.';
  if (tabName === 'qualidade') return 'Lembrete: salve a Qualidade Percebida antes de continuar.';
  return '';
}

function shouldShowSaveReminder(tabName = activeTabName()) {
  if (!state.user || !$('#appView') || $('#appView').classList.contains('hidden')) return false;
  return ['preprogramacao', 'programacao', 'feedback', 'qualidade'].includes(String(tabName || ''));
}

function markScreenDirty(scope) {
  if (scope === 'planning') state.planningDirty = true;
  if (scope === 'feedback') state.feedbackDirty = true;
  if (scope === 'quality') state.qualityDirty = true;
}

function clearScreenDirty(scope) {
  if (scope === 'planning') state.planningDirty = false;
  if (scope === 'feedback') state.feedbackDirty = false;
  if (scope === 'quality') state.qualityDirty = false;
}

function shouldRunKeepalive() {
  return Boolean(
    state.user
    && $('#appView')
    && !$('#appView').classList.contains('hidden')
    && document.visibilityState === 'visible',
  );
}

async function sendKeepalivePing() {
  if (!shouldRunKeepalive()) return;
  try {
    await fetch(`/health?_=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    // keepalive não deve interromper o fluxo da interface
  }
}

function planningCanEditNow() {
  const week = activeWeek();
  const statusField = planningModeStatusField();
  const weekOpen = String(week?.[statusField] || '').toUpperCase() === 'OPEN';
  return hasAnyRole(EDIT_ROLES)
    && weekOpen
    && (isPrePlanningMode() || String(week?.ppcMeeting?.isClosed || '').toLowerCase() === 'true');
}

function feedbackCanEditNow() {
  const week = feedbackWeekSelected();
  return hasAnyRole(EDIT_ROLES)
    && String(week?.planningStatus || '').toUpperCase() === 'CLOSED'
    && String(week?.feedbackStatus || '').toUpperCase() !== 'CLOSED';
}

function qualityCanEditNow() {
  return canEditQualityWeek(qualityWeekSelected());
}

function shouldRunAutosave(tabName = activeTabName()) {
  if (!state.user || document.visibilityState !== 'visible') return false;
  return ['preprogramacao', 'programacao', 'feedback', 'qualidade'].includes(String(tabName || ''));
}

function autosaveScopeFromActiveTab(tabName = activeTabName()) {
  const normalized = String(tabName || '');
  if (normalized === 'preprogramacao' || normalized === 'programacao') return 'planning';
  if (normalized === 'feedback') return 'feedback';
  if (normalized === 'qualidade') return 'quality';
  return null;
}

function isAutosaveNeeded(scope) {
  if (scope === 'planning') return state.planningDirty && planningCanEditNow() && !state.weekSheetSaveInProgress;
  if (scope === 'feedback') return state.feedbackDirty && feedbackCanEditNow() && !state.feedbackSaveInProgress;
  if (scope === 'quality') return state.qualityDirty && qualityCanEditNow() && !state.qualitySaveInProgress;
  return false;
}

async function runAutosaveForActiveTab() {
  const scope = autosaveScopeFromActiveTab();
  if (!scope || !isAutosaveNeeded(scope)) return;
  if (scope === 'planning') {
    await handleSaveWeekSheet({ autosave: true, silentSuccess: true });
    return;
  }
  if (scope === 'feedback') {
    await handleFeedback(null, { autosave: true, silentSuccess: true });
    return;
  }
  if (scope === 'quality') {
    await handleQualitySave({ autosave: true, silentSuccess: true });
  }
}

function resetKeepaliveTicker() {
  if (state.keepaliveTimer) {
    window.clearInterval(state.keepaliveTimer);
    state.keepaliveTimer = null;
  }
  if (!shouldRunKeepalive()) return;
  state.keepaliveTimer = window.setInterval(() => {
    sendKeepalivePing();
  }, 4 * 60 * 1000);
}

function resetAutosaveTicker() {
  if (state.autosaveTimer) {
    window.clearInterval(state.autosaveTimer);
    state.autosaveTimer = null;
  }
  if (document.hidden) return;
  if (!shouldRunAutosave()) return;
  state.autosaveTimer = window.setInterval(() => {
    runAutosaveForActiveTab().catch(() => {
      // falha de autosave não pode travar a navegação
    });
  }, 2 * 60 * 1000);
}

function resetSaveReminderTicker() {
  if (state.saveReminderTimer) {
    window.clearInterval(state.saveReminderTimer);
    state.saveReminderTimer = null;
  }
  if (shouldShowSaveReminder()) {
    state.saveReminderTimer = window.setInterval(() => {
      const message = reminderMessageForTab();
      if (!message || !shouldShowSaveReminder()) return;
      showToast(message, { kind: 'reminder', durationMs: 6500 });
    }, 5 * 60 * 1000);
  }
  resetKeepaliveTicker();
  resetAutosaveTicker();
}

function performLogout() {
  state.token = null;
  state.user = null;
  state.userWorks = [];
  state.availableWorks = [];
  state.contractors = [];
  state.contractorCatalog = [];
  state.locations = [];
  state.contractorFunctions = [];
  state.causes = [];
  state.holidays = [];
  state.weeks = [];
  state.tasks = [];
  state.expectedTasks = [];
  state.expectedEmailContractors = [];
  state.qualityData = null;
  state.ppcMeetingData = null;
  state.planningDirty = false;
  state.feedbackDirty = false;
  state.qualityDirty = false;
  state.weekSheetSaveInProgress = false;
  state.feedbackSaveInProgress = false;
  state.qualitySaveInProgress = false;
  state.selectedWorkId = null;
  state.selectedWeekId = null;
  state.currentRoles = new Set();
  state.isAdmin = false;
  state.weatherMiniPosition = null;
  state.sheetDraftRows = [];
  resetSaveReminderTicker();
  $('#password').value = '';
  $('#loginView').classList.remove('hidden');
  $('#gatewayView').classList.add('hidden');
  $('#appView').classList.add('hidden');
  updateSessionInfo();
  setStatus('Sessão encerrada.');
}

function closePlanningValidationModal() {
  const modal = $('#planningValidationModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openPlanningValidationModal(message, lineIssues = [], options = {}) {
  const modal = $('#planningValidationModal');
  const titleEl = $('#planningValidationTitle');
  const messageEl = $('#planningValidationMessage');
  const listEl = $('#planningValidationList');
  if (!modal || !messageEl || !listEl) return;

  if (titleEl) titleEl.textContent = options.title || 'Validação da Programação Semanal';
  messageEl.textContent = message;
  listEl.innerHTML = '';
  lineIssues.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    listEl.appendChild(li);
  });
  listEl.classList.toggle('hidden', lineIssues.length === 0);
  modal.classList.remove('hidden');
}

function closeFeedbackValidationModal() {
  const modal = $('#feedbackValidationModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openFeedbackValidationModal(message, lineIssues = [], options = {}) {
  const modal = $('#feedbackValidationModal');
  const titleEl = $('#feedbackValidationTitle');
  const messageEl = $('#feedbackValidationMessage');
  const listEl = $('#feedbackValidationList');
  if (!modal || !messageEl || !listEl) return;

  if (titleEl) titleEl.textContent = options.title || 'Validação do Feedback da Semana';
  messageEl.textContent = message;
  listEl.innerHTML = '';
  lineIssues.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    listEl.appendChild(li);
  });
  listEl.classList.toggle('hidden', lineIssues.length === 0);
  modal.classList.remove('hidden');
}

function closeQualityValidationModal() {
  const modal = $('#qualityValidationModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openQualityValidationModal(message, lineIssues = [], options = {}) {
  const modal = $('#qualityValidationModal');
  const titleEl = $('#qualityValidationTitle');
  const messageEl = $('#qualityValidationMessage');
  const listEl = $('#qualityValidationList');
  if (!modal || !messageEl || !listEl) return;

  if (titleEl) titleEl.textContent = options.title || 'Validação da Qualidade Percebida';
  messageEl.textContent = message;
  listEl.innerHTML = '';
  lineIssues.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    listEl.appendChild(li);
  });
  listEl.classList.toggle('hidden', lineIssues.length === 0);
  modal.classList.remove('hidden');
}

function closePpcMeetingValidationModal() {
  const modal = $('#ppcMeetingValidationModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openPpcMeetingValidationModal(message, options = {}) {
  const modal = $('#ppcMeetingValidationModal');
  const titleEl = $('#ppcMeetingValidationTitle');
  const messageEl = $('#ppcMeetingValidationMessage');
  if (!modal || !messageEl) return;
  if (titleEl) titleEl.textContent = options.title || 'Fechamento bloqueado';
  messageEl.textContent = message;
  modal.classList.remove('hidden');
}

function closeFeedbackCloseConfirmModal() {
  const modal = $('#feedbackCloseConfirmModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openFeedbackCloseConfirmModal() {
  const modal = $('#feedbackCloseConfirmModal');
  if (!modal) return;
  modal.classList.remove('hidden');
}

function updatePlanningSaveProgress(progress = 0, message = 'Salvando...') {
  const bar = $('#planningSaveProgressBar');
  const percentEl = $('#planningSaveProgressPercent');
  const messageEl = $('#planningSaveProgressMessage');
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  if (bar) bar.style.width = `${safeProgress}%`;
  if (percentEl) percentEl.textContent = `${Math.round(safeProgress)}%`;
  if (messageEl) messageEl.textContent = message;
}

function openPlanningSaveProgressModal(progress = 0, message = 'Preparando salvamento...') {
  const modal = $('#planningSaveProgressModal');
  if (!modal) return;
  updatePlanningSaveProgress(progress, message);
  modal.classList.remove('hidden');
}

function closePlanningSaveProgressModal() {
  const modal = $('#planningSaveProgressModal');
  if (!modal) return;
  modal.classList.add('hidden');
  updatePlanningSaveProgress(0, 'Preparando salvamento...');
}

function updateFeedbackSaveProgress(progress = 0, message = 'Salvando...') {
  const bar = $('#feedbackSaveProgressBar');
  const percentEl = $('#feedbackSaveProgressPercent');
  const messageEl = $('#feedbackSaveProgressMessage');
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  if (bar) bar.style.width = `${safeProgress}%`;
  if (percentEl) percentEl.textContent = `${Math.round(safeProgress)}%`;
  if (messageEl) messageEl.textContent = message;
}

function openFeedbackSaveProgressModal(progress = 0, message = 'Preparando salvamento...') {
  const modal = $('#feedbackSaveProgressModal');
  if (!modal) return;
  updateFeedbackSaveProgress(progress, message);
  modal.classList.remove('hidden');
}

function closeFeedbackSaveProgressModal() {
  const modal = $('#feedbackSaveProgressModal');
  if (!modal) return;
  modal.classList.add('hidden');
  updateFeedbackSaveProgress(0, 'Preparando salvamento...');
}

function updateGenericSaveProgress(progress = 0, message = 'Salvando...', title = 'Salvando') {
  const bar = $('#genericSaveProgressBar');
  const percentEl = $('#genericSaveProgressPercent');
  const messageEl = $('#genericSaveProgressMessage');
  const titleEl = $('#genericSaveProgressTitle');
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  if (titleEl) titleEl.textContent = title;
  if (bar) bar.style.width = `${safeProgress}%`;
  if (percentEl) percentEl.textContent = `${Math.round(safeProgress)}%`;
  if (messageEl) messageEl.textContent = message;
}

function openGenericSaveProgressModal(progress = 0, message = 'Preparando salvamento...', title = 'Salvando') {
  const modal = $('#genericSaveProgressModal');
  if (!modal) return;
  updateGenericSaveProgress(progress, message, title);
  modal.classList.remove('hidden');
}

function closeGenericSaveProgressModal() {
  const modal = $('#genericSaveProgressModal');
  if (!modal) return;
  modal.classList.add('hidden');
  updateGenericSaveProgress(0, 'Preparando salvamento...', 'Salvando');
}

function toggleTemporaryDisabled(elements, disabled, stateKey) {
  elements.forEach((el) => {
    if (!el) return;
    if (disabled) {
      if (!Object.prototype.hasOwnProperty.call(el.dataset, stateKey)) {
        el.dataset[stateKey] = el.disabled ? '1' : '0';
      }
      el.disabled = true;
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(el.dataset, stateKey)) return;
    el.disabled = el.dataset[stateKey] === '1';
    delete el.dataset[stateKey];
  });
}

function setPlanningSavingLock(locked, message = 'Salvando planilha...') {
  const elements = [
    ...$$('#tasksBody input, #tasksBody select, #tasksBody textarea, #tasksBody button'),
    $('#saveWeekSheetBtn'),
    $('#addRow1Btn'),
    $('#addRow3Btn'),
    $('#addRow5Btn'),
    $('#addRowCustomQty'),
    $('#addRowCustomBtn'),
    $('#importGroupSource'),
    $('#importGroupSelect'),
    $('#importGroupBtn'),
    $('#exportWeekExcelBtn'),
    $('#importWeekExcelBtn'),
    $('#exportWeekTxtBtn'),
    $('#importWeekTxtBtn'),
    $('#weekRefreshBtn'),
    $('#openWeekBtn'),
    $('#closePlanningBtn'),
    $('#reopenBtn'),
  ];
  toggleTemporaryDisabled(elements, locked, 'savedisabledPlanning');
  const panel = $('#tasksBody')?.closest('.panel');
  if (panel) panel.classList.toggle('panel-saving', locked);
  if (locked) panel?.setAttribute('aria-busy', 'true');
  else panel?.removeAttribute('aria-busy');
  if (locked) updatePlanningSaveProgress(8, message);
}

function setFeedbackSavingLock(locked) {
  const elements = [
    ...$$('#feedbackTasksBody input, #feedbackTasksBody select, #feedbackTasksBody textarea, #feedbackTasksBody button'),
    ...$$('#feedbackNewTaskForm input, #feedbackNewTaskForm select, #feedbackNewTaskForm textarea, #feedbackNewTaskForm button'),
    $('#saveFeedbackInlineBtn'),
    $('#closeFeedbackWeekBtn'),
    $('#reopenFeedbackWeekBtn'),
    $('#feedbackBulkExecutedBtn'),
    $('#feedbackBulkStartedBtn'),
    $('#feedbackBulkNotStartedBtn'),
    $('#feedbackComparisonPdfBtn'),
    $('#feedbackWeekRefreshBtn'),
  ];
  toggleTemporaryDisabled(elements, locked, 'savedisabledFeedback');
  const panel = $('#feedbackTasksBody')?.closest('.panel');
  if (panel) panel.classList.toggle('panel-saving', locked);
  if (panel && locked) panel.setAttribute('aria-busy', 'true');
  if (panel && !locked) panel.removeAttribute('aria-busy');
}

function setQualitySavingLock(locked) {
  const elements = [
    ...$$('#qualityBody input, #qualityBody textarea, #qualityBody button'),
    $('#saveQualityBtn'),
    $('#closeQualityWeekBtn'),
    $('#reopenQualityWeekBtn'),
    $('#qualityWeekRefreshBtn'),
    $('#qualityWeekPdfBtn'),
  ];
  toggleTemporaryDisabled(elements, locked, 'savedisabledQuality');
  const panel = $('#qualityBody')?.closest('.panel');
  if (panel) panel.classList.toggle('panel-saving', locked);
  if (panel && locked) panel.setAttribute('aria-busy', 'true');
  if (panel && !locked) panel.removeAttribute('aria-busy');
}

function setMeetingSavingLock(locked) {
  const elements = [
    $('#ppcMeetingDate'),
    $('#ppcMeetingDatePicker'),
    $('#ppcMeetingTime'),
    $('#ppcMeetingSavePreBtn'),
    $('#ppcMeetingPreExportAllPdfBtn'),
    $('#ppcMeetingPreExportMinutesPdfBtn'),
    $('#ppcMeetingPreSendAllEmailBtn'),
    $('#ppcMeetingAddContractorSelect'),
    $('#ppcMeetingAddContractorBtn'),
    $('#ppcMeetingSavePostBtn'),
    $('#ppcMeetingCloseBtn'),
    $('#ppcMeetingReopenBtn'),
    $('#ppcMeetingExportMinutesPdfBtn'),
    $('#ppcMeetingSendMinutesEmailBtn'),
    $('#ppcMeetingWeekRefreshBtn'),
    $('#ppcMeetingMinutes'),
    ...$$('#ppcMeetingAttendanceBody input, #ppcMeetingAttendanceBody select, #ppcMeetingAttendanceBody button'),
    ...$$('#ppcMeetingPreContractorsBody button'),
  ];
  toggleTemporaryDisabled(elements, locked, 'savedisabledMeeting');
  const panel = $('#ppcMeetingAttendanceBody')?.closest('.panel');
  if (panel) panel.classList.toggle('panel-saving', locked);
  if (panel && locked) panel.setAttribute('aria-busy', 'true');
  if (panel && !locked) panel.removeAttribute('aria-busy');
}

function handleQualityGridChange() {
  markScreenDirty('quality');
}

function translateApiError(errorCodeOrMessage, fallbackPrefix = 'Erro') {
  const code = String(errorCodeOrMessage || '').trim();
  if (code === 'planning_closed') {
    return 'Planejamento da semana está fechado. Solicite reabertura para editar e salvar.';
  }
  if (code === 'pre_planning_closed') {
    return 'Pré-programação da semana está fechada. Reabra a semana para editar e salvar.';
  }
  if (code === 'pre_planning_already_closed') {
    return 'Pré-programação da semana já está fechada.';
  }
  if (code === 'pre_planning_already_open') {
    return 'Pré-programação da semana já está aberta.';
  }
  if (code === 'pre_planning_not_closed') {
    return 'A pré-programação da semana ainda não foi fechada.';
  }
  if (code === 'pre_planning_reopen_requires_open_ppc_meeting') {
    return 'A Pré-programação só pode ser reaberta quando a Reunião de PPC da mesma semana estiver aberta.';
  }
  if (code === 'planning_not_empty') {
    return 'A programação da semana já possui tarefas. Use a ação de substituir para copiar da pré-programação.';
  }
  if (code === 'planning_not_closed') {
    return 'Planejamento da semana ainda não foi fechado.';
  }
  if (code === 'planning_requires_ppc_meeting_close') {
    return 'Você precisa fechar a lista de presença e ata da Reunião de PPC antes de editar a Programação da semana.';
  }
  if (code === 'close_requires_location_level1') {
    return 'Não é possível fechar a programação sem indicar o local de uma das tarefas';
  }
  if (code === 'meeting_datetime_required') {
    return 'Informe data e hora da reunião de PPC.';
  }
  if (code === 'meeting_datetime_not_defined') {
    return 'Data/hora da reunião de PPC ainda não foi definida.';
  }
  if (code === 'invalid_meeting_date') {
    return 'Data da reunião inválida. Use DD/MM/AAAA.';
  }
  if (code === 'invalid_meeting_time') {
    return 'Hora da reunião inválida. Use HH:MM.';
  }
  if (code === 'ppc_meeting_not_found') {
    return 'Reunião de PPC não encontrada para esta semana.';
  }
  if (code === 'ppc_meeting_closed') {
    return 'Reunião de PPC já está fechada e não pode ser editada.';
  }
  if (code === 'ppc_meeting_already_closed') {
    return 'Reunião de PPC já está fechada.';
  }
  if (code === 'ppc_meeting_minutes_required') {
    return 'Preencha a ata (pontos discutidos) antes de fechar a reunião de PPC.';
  }
  if (code === 'ppc_meeting_not_closed') {
    return 'Feche a reunião de PPC para gerar a ata final.';
  }
  if (code === 'ppc_meeting_reopen_requires_planning_open') {
    return 'A Reunião de PPC só pode ser reaberta quando a Programação da semana ainda estiver aberta.';
  }
  if (code === 'ppc_meeting_requires_pre_planning_close') {
    return 'Você precisa fechar a pré-programação primeiro';
  }
  if (code === 'planning_requires_pre_and_ppc_close') {
    return 'Você precisa fechar a pré-programação primeiro e/ou a lista de preseção e ata';
  }
  if (code === 'contractor_not_active_in_week') {
    return 'Empreiteiro sem atividades ativas nesta semana.';
  }
  if (code === 'feedback_not_closed') {
    return 'O feedback da semana ainda não foi fechado. Feche o feedback para gerar este PDF.';
  }
  if (code === 'feedback_not_closed_for_quality') {
    return 'Não é possível fechar a Qualidade Percebida da semana sem fechar o feedback primeiro.';
  }
  if (code === 'feedback_closed') {
    return 'Feedback da semana já está fechado.';
  }
  if (code === 'feedback_reopen_requires_quality_open') {
    return 'O feedback só pode ser reaberto quando a Qualidade Percebida da mesma semana estiver aberta.';
  }
  if (code === 'feedback_close_incomplete') {
    return 'Não é possível fechar o feedback da semana sem completar as causas obrigatórias.';
  }
  if (code === 'quality_closed') {
    return 'Qualidade percebida da semana já está fechada.';
  }
  if (code === 'quality_already_closed') {
    return 'Qualidade percebida da semana já foi fechada.';
  }
  if (code === 'quality_not_closed') {
    return 'A Qualidade Percebida desta semana ainda não está fechada.';
  }
  if (code === 'quality_incomplete') {
    return 'Não foi possível fechar a Qualidade Percebida da semana. Existem campos obrigatórios não preenchidos.';
  }
  if (code === 'quality_item_invalid_contractor') {
    return 'Há itens de Qualidade Percebida com empreiteiro inválido para esta semana.';
  }
  if (code === 'cannot_cancel_current_week_task') {
    return 'Apenas atividades herdadas de semanas anteriores podem ser canceladas nesta etapa.';
  }
  if (code === 'cannot_cancel_reserve_task') {
    return 'Atividades em status Reserva não podem ser canceladas por esta ação.';
  }
  if (code === 'task_already_cancelled') {
    return 'Esta atividade já está cancelada.';
  }
  if (code === 'quality_score_invalid') {
    return 'Nota inválida na Qualidade Percebida. Use números inteiros de 0 a 10.';
  }
  if (code === 'pdf_dependency_missing') {
    return 'Dependência de PDF não instalada no servidor.';
  }
  if (code === 'forbidden') return 'Você não possui permissão para esta ação.';
  if (code === 'not_allowed') return 'Você não possui permissão para esta ação.';
  if (code === 'invalid_contractor_id') return 'Empreiteiro inválido.';
  if (code === 'week_not_found') return 'Semana não encontrada.';
  if (code === 'work_not_found') return 'Obra não encontrada.';
  if (code === 'invalid_week_id') return 'Semana inválida.';
  if (code === 'contractor_required') return 'Selecione um empreiteiro.';
  if (code === 'contractor_not_in_work') return 'Empreiteiro não pertence à obra selecionada.';
  if (code === 'location_level1_required') return 'Local 1 é obrigatório para atividade executada não planejada.';
  if (code === 'only_unplanned_task_can_be_deleted_here') return 'Somente atividades executadas/não planejadas podem ser excluídas por esta ação.';
  if (code === 'actual_dates_or_days_required') return 'Informe dias executados (checkbox) ou datas reais.';
  if (code === 'invalid_holiday_date') return 'Data de feriado inválida. Use DD/MM/AAAA.';
  if (code === 'holiday_description_required') return 'Descrição do feriado é obrigatória.';
  if (code === 'holiday_already_exists') return 'Já existe feriado cadastrado nesta data para a obra.';
  if (code === 'holiday_not_found') return 'Feriado não encontrado na obra selecionada.';
  if (code === 'no_holidays_registered') return 'Não há feriados cadastrados para gerar o calendário.';
  if (code === 'invalid_contractor_phone') return 'Telefone inválido. Informe somente números com DDD (10 ou 11 dígitos).';
  if (code === 'password_required_for_new_user') return 'Senha é obrigatória para criar novo usuário.';
  if (code === 'user_not_in_work') return 'Usuário não está vinculado a esta obra.';
  if (code === 'user_creation_all_fields_required') return 'Preencha todos os campos obrigatórios do usuário.';
  if (code === 'system_profile_cannot_be_deleted') return 'Perfis de sistema não podem ser excluídos.';
  if (code === 'profile_in_use') return 'Perfil em uso por usuários. Remova os vínculos antes de excluir.';
  if (code === 'profile_not_found') return 'Perfil de permissionamento não encontrado.';
  if (code === 'assignment_not_found') return 'Vínculo de perfil não encontrado.';
  if (code === 'invalid_date_range') return 'Período inválido: a data final deve ser posterior à data inicial.';
  if (code === 'perceived_quality_all_fields_required') return 'Preencha todos os campos da Qualidade Percebida.';
  if (code === 'invalid_deadline_thresholds') return 'Faixas de Prazo inválidas. Use valores entre 0 e 100 e mantenha Bom maior ou igual a Regular.';
  if (code === 'location_level_conflict') return 'Conflito no zoneamento: já existe item com mesmo Nível 1/Nível 2 no destino.';
  if (code === 'invalid_level2_name') return 'Nome inválido para Nível 2.';
  if (code === 'invalid_quality_scores') return 'Notas inválidas. Use valores inteiros entre 0 e 10 e mantenha Bom maior ou igual a Regular.';
  if (code === 'name_description_baseRole_required') return 'Informe nome, descrição e papel base do perfil.';
  if (code === 'invalid_base_role') return 'Papel base do perfil inválido.';
  return `${fallbackPrefix}: ${code || 'Falha desconhecida.'}`;
}

function formatDate(value) {
  if (!value) return '-';
  const key = dateKeyLocal(value);
  const date = dateFromKeyLocal(key);
  if (!date) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTimeBr(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

function formatDateTimeLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateBrLocalFromIso(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTimeLocalFromIso(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatIsoDateInputFromValue(value) {
  if (!value) return '';
  const key = dateKeyLocal(value);
  const date = dateFromKeyLocal(key);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseBrDateTimeToIso(dateText, timeText) {
  const parsedDate = parseBrDate(dateText);
  if (!parsedDate) return { iso: null, error: 'invalid_meeting_date' };
  const match = /^(\d{2}):(\d{2})$/.exec(String(timeText || '').trim());
  if (!match) return { iso: null, error: 'invalid_meeting_time' };
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) || !Number.isFinite(minutes)
    || hours < 0 || hours > 23
    || minutes < 0 || minutes > 59
  ) {
    return { iso: null, error: 'invalid_meeting_time' };
  }
  const localDate = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    hours,
    minutes,
    0,
    0,
  );
  return { iso: localDate.toISOString(), error: null };
}

function formatDayMonth(value) {
  if (!value) return '--/--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function parseBrDate(value) {
  const text = String(value || '').trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function normalizePhoneDigits(value, maxLen = 11) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLen);
}

function normalizeBrDateInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function normalizeBrTimeInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeWeekdayKey(value) {
  return String(value || '').trim().toUpperCase();
}

function isValidBrTimeText(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return Number.isFinite(hours) && Number.isFinite(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function parseBrTimeText(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function weekdayOffsetFromMonday(value) {
  const weekday = normalizeWeekdayKey(value);
  if (weekday === 'MONDAY') return 0;
  if (weekday === 'TUESDAY') return 1;
  if (weekday === 'WEDNESDAY') return 2;
  if (weekday === 'THURSDAY') return 3;
  if (weekday === 'FRIDAY') return 4;
  if (weekday === 'SATURDAY') return 5;
  if (weekday === 'SUNDAY') return 6;
  return null;
}

function virtualWeekByNumber(weekNumber) {
  const normalizedWeekNumber = Number.parseInt(weekNumber, 10);
  const work = selectedWork();
  if (!work?.startDate || !Number.isFinite(normalizedWeekNumber) || normalizedWeekNumber <= 0) return null;
  const { startDate, endDate } = calculateWeekPeriodLocal(work.startDate, normalizedWeekNumber);
  return { weekNumber: normalizedWeekNumber, startDate, endDate };
}

function resolveWorkTimeZoneFromState(stateUf) {
  const uf = String(stateUf || '').trim().toUpperCase();
  return BR_TIMEZONE_BY_UF[uf] || 'America/Sao_Paulo';
}

async function ensureSelectedWorkTimeZone() {
  const work = selectedWork();
  if (!work?.id) {
    state.workTimeZone = 'America/Sao_Paulo';
    return state.workTimeZone;
  }

  const workId = Number(work.id);
  if (state.workTimeZoneByWorkId[workId]) {
    state.workTimeZone = state.workTimeZoneByWorkId[workId];
    return state.workTimeZone;
  }

  let timeZone = 'America/Sao_Paulo';
  const cepDigits = String(work.cep || '').replace(/\D/g, '');
  if (cepDigits.length === 8) {
    try {
      const cepInfo = await api(`/utils/cep/${cepDigits}`);
      timeZone = resolveWorkTimeZoneFromState(cepInfo?.state);
    } catch {
      timeZone = 'America/Sao_Paulo';
    }
  }

  state.workTimeZoneByWorkId[workId] = timeZone;
  state.workTimeZone = timeZone;
  return timeZone;
}

function timeZoneWallClockNow(timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type) => Number(parts.find((item) => item.type === type)?.value || 0);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function weekdayToJsIndex(weekday) {
  const normalized = normalizeWeekdayKey(weekday);
  if (normalized === 'SUNDAY') return 0;
  if (normalized === 'MONDAY') return 1;
  if (normalized === 'TUESDAY') return 2;
  if (normalized === 'WEDNESDAY') return 3;
  if (normalized === 'THURSDAY') return 4;
  if (normalized === 'FRIDAY') return 5;
  if (normalized === 'SATURDAY') return 6;
  return null;
}

function findWeekdayDateWithinWeekPeriod(workStartDate, weekNumber, weekday) {
  const targetWeekNumber = Math.max(1, Number.parseInt(weekNumber, 10) || 1);
  if (!workStartDate || !targetWeekNumber) return null;
  const jsWeekday = weekdayToJsIndex(weekday);
  if (jsWeekday === null) return null;
  const { startDate, endDate } = calculateWeekPeriodLocal(workStartDate, targetWeekNumber);
  const cursor = startOfDayLocalFromInput(startDate);
  const end = startOfDayLocalFromInput(endDate);
  while (cursor.getTime() <= end.getTime()) {
    if (cursor.getDay() === jsWeekday) return new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

function weekDeadlineDateByRule(week, weekday, timeText, scope = 'CURRENT_WEEK') {
  if (!week || !weekday || !isValidBrTimeText(timeText)) return null;

  const weekNumber = Number.parseInt(week.weekNumber, 10);
  const work = selectedWork();
  if (!work?.startDate || !Number.isFinite(weekNumber) || weekNumber <= 0) return null;
  const parsedTime = parseBrTimeText(timeText);
  if (!parsedTime) return null;

  let weekOffset = 0;
  if (scope === 'PREVIOUS_WEEK') weekOffset = -1;
  if (scope === 'NEXT_WEEK') weekOffset = 1;
  const targetWeekNumber = Math.max(1, weekNumber + weekOffset);

  const targetDate = findWeekdayDateWithinWeekPeriod(work.startDate, targetWeekNumber, weekday);
  if (!targetDate) return null;
  targetDate.setHours(0, 0, 0, 0);

  return new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    parsedTime.hours,
    parsedTime.minutes,
    0,
    0,
  );
}

function formatCountdownDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function renderDeadlineCountdownBox(elementId, options) {
  const el = $(elementId);
  if (!el) return;

  const {
    week,
    weekday,
    timeText,
    title,
    isClosed,
    scope = 'CURRENT_WEEK',
  } = options || {};

  if (isClosed === true) {
    el.classList.add('hidden');
    el.classList.remove('overdue');
    el.textContent = '';
    return;
  }

  if (!week || !weekday || !timeText) {
    el.classList.add('hidden');
    el.classList.remove('overdue');
    el.textContent = '';
    return;
  }

  const deadline = weekDeadlineDateByRule(week, weekday, timeText, scope);
  if (!deadline) {
    el.classList.add('hidden');
    el.classList.remove('overdue');
    el.textContent = '';
    return;
  }

  const timeZone = state.workTimeZone || 'America/Sao_Paulo';
  const nowWallClock = timeZoneWallClockNow(timeZone);
  const diffMs = deadline.getTime() - nowWallClock.getTime();
  const deadlineDateBr = formatDate(deadline);
  const weekdayPt = PT_WEEKDAY_FULL[normalizeWeekdayKey(weekday)] || normalizeWeekdayKey(weekday);
  const prefix = `${title}: ${weekdayPt}, ${deadlineDateBr} às ${timeText} (hora local da obra)`;
  const countdownText = diffMs >= 0
    ? `Tempo restante: ${formatCountdownDuration(diffMs)}`
    : `Prazo encerrado há ${formatCountdownDuration(Math.abs(diffMs))}`;

  el.classList.remove('hidden');
  el.classList.toggle('overdue', diffMs < 0);
  el.textContent = `${prefix} | ${countdownText}`;
}

function renderDeadlineCountdowns() {
  const rule = state.notificationRule || {};

  const planningWeek = consideredWeekFromFieldOrSelection() || virtualWeekByNumber(numericWeekField());
  const isPreMode = isPrePlanningMode();
  const planningClosed = isPreMode
    ? String(planningWeek?.prePlanningStatus || '').toUpperCase() === 'CLOSED'
    : String(planningWeek?.planningStatus || '').toUpperCase() === 'CLOSED';
  renderDeadlineCountdownBox('#planningDeadlineCountdown', {
    week: planningWeek,
    weekday: isPreMode ? rule.prePlanningDeadlineWeekday : rule.planningDeadlineWeekday,
    timeText: isPreMode ? rule.prePlanningDeadlineTime : rule.planningDeadlineTime,
    title: isPreMode ? 'Prazo da pré-programação' : 'Prazo da programação',
    isClosed: planningClosed,
    scope: 'PREVIOUS_WEEK',
  });

  const ppcWeek = ppcMeetingWeekSelected() || virtualWeekByNumber(ppcMeetingWeekNumberField());
  const ppcClosed = Number(ppcWeek?.id || 0) > 0
    ? (Number(state.ppcMeetingData?.weekId || 0) === Number(ppcWeek.id) && state.ppcMeetingData?.isClosed === true)
    : false;
  renderDeadlineCountdownBox('#ppcMeetingDeadlineCountdown', {
    week: ppcWeek,
    weekday: rule.ppcMeetingDeadlineWeekday,
    timeText: rule.ppcMeetingDeadlineTime,
    title: 'Prazo da lista de presença e ata',
    isClosed: ppcClosed,
    scope: 'PREVIOUS_WEEK',
  });

  const feedbackWeek = feedbackWeekSelected() || virtualWeekByNumber(feedbackWeekNumberField());
  const feedbackClosed = String(feedbackWeek?.feedbackStatus || '').toUpperCase() === 'CLOSED';
  renderDeadlineCountdownBox('#feedbackDeadlineCountdown', {
    week: feedbackWeek,
    weekday: rule.feedbackDeadlineWeekday,
    timeText: rule.feedbackDeadlineTime,
    title: 'Prazo do feedback',
    isClosed: feedbackClosed,
    scope: 'CURRENT_WEEK',
  });

  const qualityWeek = qualityWeekSelected() || virtualWeekByNumber(qualityWeekNumberField());
  const qualityClosed = String(qualityWeek?.qualityStatus || '').toUpperCase() === 'CLOSED';
  renderDeadlineCountdownBox('#qualityDeadlineCountdown', {
    week: qualityWeek,
    weekday: rule.qualityDeadlineWeekday || rule.feedbackDeadlineWeekday,
    timeText: rule.qualityDeadlineTime || rule.feedbackDeadlineTime,
    title: 'Prazo da qualidade percebida',
    isClosed: qualityClosed,
    scope: 'CURRENT_WEEK',
  });
}

function startDeadlineCountdownTicker() {
  if (state.deadlineCountdownTimer) clearInterval(state.deadlineCountdownTimer);
  renderDeadlineCountdowns();
  state.deadlineCountdownTimer = setInterval(() => {
    renderDeadlineCountdowns();
  }, 1000);
}

function todayBrDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

function isFilled(value) {
  return String(value || '').trim().length > 0;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNumberBr2(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercentBr2(value) {
  return `${formatNumberBr2(value)}%`;
}

function formatDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function sanitizeFileLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSheetDateText(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function parseSheetDateInput(value) {
  const normalized = normalizeSheetDateText(value);
  if (!normalized) return null;
  return parseBrDate(normalized);
}

function formatSheetDateMultiline(value) {
  if (!value) return '';
  const normalized = normalizeSheetDateText(value);
  if (normalized) {
    const parsed = parseBrDate(normalized);
    if (parsed) {
      return normalized.replace(/^(\d{2}\/\d{2}\/)(\d{4})$/, '$1\n$2');
    }
  }
  const singleLine = formatDateInput(value);
  if (!singleLine) return '';
  return singleLine.replace(/^(\d{2}\/\d{2}\/)(\d{4})$/, '$1\n$2');
}

function contractorDisplay(item) {
  return `${item.name} (${item.laborType || '-'})`;
}

function normalizeLaborType(value) {
  return String(value || '').trim().toLowerCase();
}

function contractorsForLaborType(laborType) {
  const normalized = normalizeLaborType(laborType);
  if (!normalized) return [...state.contractors];
  return state.contractors.filter((item) => normalizeLaborType(item.laborType) === normalized);
}

function zoneLevel1Marker(level1Name) {
  return `${ZONE_LEVEL1_PREFIX}${String(level1Name || '').trim()}`;
}

function isZoneLevel1Row(location) {
  return String(location?.level2 || '').startsWith(ZONE_LEVEL1_PREFIX);
}

function displayLocationLevel2(location) {
  if (!location) return '-';
  return isZoneLevel1Row(location) ? '-' : (location.level2 || '-');
}

function hasAnyRole(roles) {
  return roles.some((role) => state.currentRoles.has(role));
}

function weekStatusPt(status) {
  const code = String(status || '').toUpperCase();
  if (code === 'OPEN') return 'Aberto';
  if (code === 'CLOSED') return 'Fechado';
  return code;
}

async function api(path, options = {}) {
  const init = { ...options, headers: { ...(options.headers || {}) } };
  if (state.token) init.headers.Authorization = `Bearer ${state.token}`;
  if (init.body && typeof init.body !== 'string') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(init.body);
  }

  const response = await fetch(path, init);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function apiBlob(path, options = {}) {
  const init = { ...options, headers: { ...(options.headers || {}) } };
  if (state.token) init.headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, init);
  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return response.blob();
}

function saveBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitizeDownloadFileName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    || 'sem-nome';
}

function weatherEmoji(icon) {
  const code = String(icon || '').toUpperCase();
  if (code === 'SUNNY') return '☀️';
  if (code === 'CLOUDY') return '☁️';
  if (code === 'RAIN') return '🌧️';
  if (code === 'STORM') return '⛈️';
  return '—';
}

function weatherPt(icon) {
  const code = String(icon || '').toUpperCase();
  if (code === 'SUNNY') return 'Sol';
  if (code === 'CLOUDY') return 'Nublado';
  if (code === 'RAIN') return 'Chuva';
  if (code === 'STORM') return 'Temporal';
  return 'Sem dado';
}

function formatRainInfo(precipitationMm) {
  const mm = Number(precipitationMm);
  if (!Number.isFinite(mm)) return 'Chuva: -';
  return `Chuva: ${mm.toFixed(1)} mm/h`;
}

function formatRainProbabilityInfo(precipitationProbabilityPct) {
  const pct = Number(precipitationProbabilityPct);
  if (!Number.isFinite(pct)) return 'Prob. chuva: -';
  return `Prob. chuva: ${pct.toFixed(0)}%`;
}

function activeWeek() {
  return state.weeks.find((item) => item.id === state.selectedWeekId) || null;
}

function selectedWork() {
  return state.availableWorks.find((item) => Number(item.id) === Number(state.selectedWorkId))
    || state.userWorks.find((item) => Number(item.id) === Number(state.selectedWorkId))
    || null;
}

function selectedWorkAddress() {
  const work = selectedWork();
  if (!work) return '-';
  const parts = [
    work.street,
    work.number,
    work.complement,
    work.neighborhood,
    work.city,
    work.state,
    work.cep,
  ].map((item) => String(item || '').trim()).filter(Boolean);
  return parts.length ? parts.join(' | ') : '-';
}

function summaryKpiCardHtml(label, value, helper = '', variant = '') {
  return `
    <div class="summary-kpi ${variant}">
      <label>${escapeHtml(label)}</label>
      <strong>${escapeHtml(value)}</strong>
      ${helper ? `<small>${escapeHtml(helper)}</small>` : ''}
    </div>
  `;
}

function planningModeIntroCopy() {
  if (isPrePlanningMode()) {
    return {
      title: 'Pré-programação da semana',
      text: 'Monte a primeira versão da semana seguinte, trazendo pendências e reservas anteriores para a conversa com os empreiteiros. Aqui faz sentido organizar o pacote e sinalizar o que ainda precisa ser validado na reunião de PPC.',
    };
  }
  return {
    title: 'Programação da semana',
    text: 'Aqui entra a versão validada da semana. Use esta etapa para ajustar a programação após a reunião de PPC e fechar o pacote que vai gerar as atividades previstas, PDFs e controles da semana.',
  };
}

function buildPlanningSummaryHtml(tasks = [], drafts = []) {
  const weekContext = planningWeekContext();
  const allRows = [
    ...drafts.map((item) => ({ ...item, __draft: true })),
    ...tasks,
  ];
  const total = allRows.length;
  const pending = tasks.filter((task) => taskDisplayStatusCode(task, weekContext, false) === 'PENDENTE').length;
  const reserve = allRows.filter((task) => String(task.status || '').toUpperCase() === 'RESERVA').length;
  const rework = allRows.filter((task) => String(task.status || '').toUpperCase() === 'RETRABALHO').length;
  return [
    summaryKpiCardHtml('Total de Linhas', String(total), 'Inclui linhas novas ainda não salvas.', 'info'),
    summaryKpiCardHtml('Pendências', String(pending), 'Vieram de semanas anteriores e ficam travadas nos campos críticos.', pending ? 'warning' : 'success'),
    summaryKpiCardHtml('Reservas', String(reserve), 'Podem continuar como reserva ou virar planejada na nova semana.', reserve ? 'info' : 'success'),
    summaryKpiCardHtml('Retrabalhos', String(rework), 'Mostra quantas atividades já entraram com status de retrabalho.', rework ? 'danger' : 'success'),
  ].join('');
}

function renderPlanningLegend() {
  const box = $('#planningLegendBox');
  if (!box) return;
  box.innerHTML = `
    <p><strong>Como ler a planilha desta etapa</strong></p>
    <ul>
      <li><strong>Pendente:</strong> veio de semana anterior, mantém tarefa e locais travados para preservar o histórico.</li>
      <li><strong>Reserva:</strong> volta para a semana seguinte como reserva, mas o status pode ser ajustado para <em>Planejada</em> quando fizer sentido.</li>
      <li><strong>Rascunho:</strong> linha azul clara criada localmente e ainda não salva.</li>
      <li><strong>Semana de origem:</strong> ajuda a entender de onde cada atividade veio e evita perder o contexto no meio da programação.</li>
    </ul>
  `;
}

function homeQuickActionsData() {
  const current = suggestedCurrentWeekNumberForCurrentWork();
  if (!current) return [];
  const preWeek = workWeekByNumber(current + 1);
  const feedbackWeek = workWeekByNumber(Math.max(1, current - 1));
  const actions = [];

  if (preWeek && String(preWeek.prePlanningStatus || '').toUpperCase() !== 'CLOSED') {
    actions.push({
      title: `Fechar Pré-programação da Semana ${preWeek.weekNumber}`,
      text: 'Essa costuma ser a primeira entrega da semana seguinte. Vale revisar pendências, reservas e empreiteiros ativos.',
      dataset: { main: 'preprogramacao' },
    });
  } else if (preWeek && preWeek.ppcMeeting?.isClosed !== true) {
    actions.push({
      title: `Conduzir Reunião de PPC da Semana ${preWeek.weekNumber}`,
      text: 'A pré-programação já está pronta. Agora faz sentido fechar presença, ata e validar os ajustes com os empreiteiros.',
      dataset: { main: 'reuniaoppc' },
    });
  } else if (preWeek && String(preWeek.planningStatus || '').toUpperCase() !== 'CLOSED') {
    actions.push({
      title: `Finalizar Programação da Semana ${preWeek.weekNumber}`,
      text: 'A reunião já foi encerrada. Falta consolidar a versão final que alimenta atividades previstas, PDFs e envios.',
      dataset: { main: 'programacao' },
    });
  }

  if (feedbackWeek && String(feedbackWeek.feedbackStatus || '').toUpperCase() !== 'CLOSED') {
    actions.push({
      title: `Preencher Feedback da Semana ${feedbackWeek.weekNumber}`,
      text: 'Essa etapa fecha o que realmente aconteceu em campo e alimenta relatórios, pendências e histórico.',
      dataset: { main: 'feedback' },
    });
  } else if (feedbackWeek && String(feedbackWeek.qualityStatus || '').toUpperCase() !== 'CLOSED') {
    actions.push({
      title: `Concluir Qualidade Percebida da Semana ${feedbackWeek.weekNumber}`,
      text: 'Com o feedback fechado, falta registrar a leitura qualitativa dos empreiteiros da semana.',
      dataset: { main: 'qualidade' },
    });
  }

  if (!actions.length) {
    actions.push({
      title: 'Fluxo da obra em dia',
      text: 'As etapas próximas já estão fechadas. Você pode seguir para relatórios, histórico ou revisar os cadastros da obra.',
      dataset: { main: 'gestao', dashboard: 'relatorio' },
    });
  }

  return actions;
}

function renderWorkWelcomeActionCards() {
  const container = $('#obraHomeActionCards');
  if (!container) return;
  const cards = homeQuickActionsData();
  container.innerHTML = cards.map((card) => `
    <div class="obra-home-action-card">
      <strong>${escapeHtml(card.title)}</strong>
      <p>${escapeHtml(card.text)}</p>
      <button
        type="button"
        class="obra-home-link"
        data-work-home-link="${escapeHtml(card.dataset.main || '')}"
        ${card.dataset.dashboard ? `data-work-home-dashboard="${escapeHtml(card.dataset.dashboard)}"` : ''}
        ${card.dataset.obra ? `data-work-home-obra="${escapeHtml(card.dataset.obra)}"` : ''}
      >Abrir</button>
    </div>
  `).join('');
}

function renderWorkWelcomePanel() {
  const work = selectedWork();
  const titleEl = $('#obraHomeTitle');
  const addressEl = $('#obraHomeAddress');
  const logoEl = $('#obraHomeLogo');
  const fallbackEl = $('#obraHomeLogoFallback');
  const statusBody = $('#obraHomeStatusBody');
  if (!titleEl || !addressEl || !logoEl || !fallbackEl) return;

  titleEl.textContent = work?.name || 'Obra não selecionada';
  addressEl.textContent = selectedWorkAddress();

  const logoPath = String(state.appConfig?.logoPath || '').trim();
  if (logoPath) {
    logoEl.src = logoPath;
    logoEl.classList.remove('hidden');
    fallbackEl.classList.add('hidden');
  } else {
    logoEl.removeAttribute('src');
    logoEl.classList.add('hidden');
    fallbackEl.classList.remove('hidden');
  }

  if (statusBody) renderWorkWelcomeStatusTable();
  renderWorkWelcomeActionCards();
  renderTopWorkflowStrip();
}

function workWeekByNumber(weekNumber) {
  const normalized = Number.parseInt(weekNumber, 10);
  if (!normalized || normalized <= 0) return null;
  return state.weeks.find((item) => Number(item.weekNumber) === normalized)
    || virtualWeekByNumber(normalized);
}

function homeTrackedWeeks() {
  const current = suggestedCurrentWeekNumberForCurrentWork();
  if (!current) return [];
  return [-2, -1, 0, 1]
    .map((offset) => {
      const weekNumber = Math.max(1, current + offset);
      const week = workWeekByNumber(weekNumber);
      return {
        label: offset === 0 ? 'Semana Atual' : `Semana ${offset > 0 ? '+' : ''}${offset}`,
        weekNumber,
        week,
      };
    })
    .filter((row, index, arr) => arr.findIndex((item) => item.weekNumber === row.weekNumber) === index);
}

function homeStageStatus(week, stageKey) {
  const rule = state.notificationRule || {};
  const statusMap = {
    prePlanning: {
      isClosed: String(week?.prePlanningStatus || '').toUpperCase() === 'CLOSED',
      closedAt: week?.prePlanningClosedAt || null,
      weekday: rule.prePlanningDeadlineWeekday,
      timeText: rule.prePlanningDeadlineTime,
      scope: 'PREVIOUS_WEEK',
    },
    ppcMeeting: {
      isClosed: week?.ppcMeeting?.isClosed === true,
      closedAt: week?.ppcMeeting?.closedAt || null,
      weekday: rule.ppcMeetingDeadlineWeekday,
      timeText: rule.ppcMeetingDeadlineTime,
      scope: 'PREVIOUS_WEEK',
    },
    planning: {
      isClosed: String(week?.planningStatus || '').toUpperCase() === 'CLOSED',
      closedAt: week?.planningClosedAt || null,
      weekday: rule.planningDeadlineWeekday,
      timeText: rule.planningDeadlineTime,
      scope: 'PREVIOUS_WEEK',
    },
    feedback: {
      isClosed: String(week?.feedbackStatus || '').toUpperCase() === 'CLOSED',
      closedAt: week?.feedbackClosedAt || null,
      weekday: rule.feedbackDeadlineWeekday,
      timeText: rule.feedbackDeadlineTime,
      scope: 'CURRENT_WEEK',
    },
    quality: {
      isClosed: String(week?.qualityStatus || '').toUpperCase() === 'CLOSED',
      closedAt: week?.qualityClosedAt || null,
      weekday: rule.qualityDeadlineWeekday || rule.feedbackDeadlineWeekday,
      timeText: rule.qualityDeadlineTime || rule.feedbackDeadlineTime,
      scope: 'CURRENT_WEEK',
    },
  };

  const config = statusMap[stageKey];
  if (!config) return { mark: '-', variant: 'unknown', title: 'Etapa não mapeada.' };
  const deadline = weekDeadlineDateByRule(week, config.weekday, config.timeText, config.scope);
  const nowWallClock = timeZoneWallClockNow(state.workTimeZone || 'America/Sao_Paulo');
  const todayKey = dateKeyLocal(nowWallClock);
  const deadlineKey = dateKeyLocal(deadline);

  if (config.isClosed) {
    const closedAt = config.closedAt ? new Date(config.closedAt) : null;
    const onTime = !deadline || !closedAt || closedAt.getTime() <= deadline.getTime();
    return {
      mark: 'V',
      variant: onTime ? 'ok' : 'late',
      title: onTime ? 'Etapa fechada no prazo.' : 'Etapa fechada fora do prazo.',
    };
  }

  if (!deadline) {
    return {
      mark: 'X',
      variant: 'unknown',
      title: 'Prazo não definido para esta etapa.',
    };
  }

  if (todayKey === deadlineKey) {
    return {
      mark: 'X',
      variant: 'today',
      title: 'Prazo vence hoje.',
    };
  }

  if (nowWallClock.getTime() > deadline.getTime()) {
    return {
      mark: 'X',
      variant: 'late',
      title: 'Prazo vencido.',
    };
  }

  return {
    mark: 'X',
    variant: 'ok',
    title: 'Etapa ainda dentro do prazo.',
  };
}

function renderWorkWelcomeStatusTable() {
  const body = $('#obraHomeStatusBody');
  if (!body) return;
  const rows = homeTrackedWeeks();
  body.innerHTML = '';

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8">Sem dados suficientes para montar o painel das semanas.</td></tr>';
    return;
  }

  rows.forEach(({ label, weekNumber, week }) => {
    const startText = formatDate(week?.startDate);
    const endText = formatDate(week?.endDate);
    const stages = [
      homeStageStatus(week, 'prePlanning'),
      homeStageStatus(week, 'ppcMeeting'),
      homeStageStatus(week, 'planning'),
      homeStageStatus(week, 'feedback'),
      homeStageStatus(week, 'quality'),
    ];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="obra-home-status-week">${escapeHtml(label)}<br><small>Sem. ${escapeHtml(String(weekNumber))}</small></td>
      <td class="obra-home-status-date">${escapeHtml(startText)}</td>
      <td class="obra-home-status-date">${escapeHtml(endText)}</td>
      ${stages.map((stage) => (
        `<td class="obra-home-stage obra-home-stage--${escapeHtml(stage.variant)}" title="${escapeHtml(stage.title)}">${escapeHtml(stage.mark)}</td>`
      )).join('')}
    `;
    body.appendChild(tr);
  });
}

function topWorkflowTrackedWeeks() {
  const current = suggestedCurrentWeekNumberForCurrentWork();
  if (!current) return [];
  return [0, 1]
    .map((offset) => {
      const weekNumber = Math.max(1, current + offset);
      const week = workWeekByNumber(weekNumber);
      return {
        weekNumber,
        week,
        label: offset === 0 ? 'Semana atual' : 'Próxima semana',
      };
    })
    .filter((item, index, arr) => arr.findIndex((row) => row.weekNumber === item.weekNumber) === index);
}

async function navigateFromWorkflowStage(weekNumber, stageKey) {
  const work = selectedWork();
  if (!work) return;
  const weekText = String(weekNumber || '');
  if (!weekText) return;

  const applyWeekToInput = (selector) => {
    const input = document.querySelector(selector);
    if (input) {
      input.value = weekText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return input;
  };

  const scrollToPrimaryCard = () => {
    const target = document.querySelector('.planning-control-card, .feedback-card, .quality-card, .ppc-meeting-card, .dashboard-card, .work-welcome-card');
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  state.workflowNavigationInProgress = true;
  try {
    if (stageKey === 'prePlanning') {
      applyWeekToInput('#weekNumber');
      selectTab('preprogramacao');
      applyWeekToInput('#weekNumber');
      await handleWeekRefresh();
      scrollToPrimaryCard();
      return;
    }
    if (stageKey === 'ppcMeeting') {
      applyWeekToInput('#ppcMeetingWeekNumber');
      selectTab('reuniaoppc');
      applyWeekToInput('#ppcMeetingWeekNumber');
      await refreshPpcMeetingTab({ useDefaultNext: false, silent: true });
      scrollToPrimaryCard();
      return;
    }
    if (stageKey === 'planning') {
      applyWeekToInput('#weekNumber');
      selectTab('programacao');
      applyWeekToInput('#weekNumber');
      await handleWeekRefresh();
      scrollToPrimaryCard();
      return;
    }
    if (stageKey === 'feedback') {
      applyWeekToInput('#feedbackWeekNumber');
      selectTab('feedback');
      applyWeekToInput('#feedbackWeekNumber');
      await refreshFeedbackTab({ useDefaultPrevious: false, silent: true });
      scrollToPrimaryCard();
      return;
    }
    if (stageKey === 'quality') {
      applyWeekToInput('#qualityWeekNumber');
      selectTab('qualidade');
      applyWeekToInput('#qualityWeekNumber');
      await refreshQualityTab({ useDefaultCurrent: false, silent: true });
      scrollToPrimaryCard();
    }
  } catch (error) {
    const labels = {
      prePlanning: 'pré-programação',
      ppcMeeting: 'reunião de PPC',
      planning: 'programação',
      feedback: 'feedback',
      quality: 'qualidade percebida',
    };
    setStatus(`Erro ao abrir ${labels[stageKey] || 'etapa'}: ${error.message}`, true);
  } finally {
    state.workflowNavigationInProgress = false;
  }
}

function renderTopWorkflowStrip() {
  const host = $('#topWorkflowStrip');
  if (!host) return;
  if (!state.user || !state.selectedWorkId) {
    host.innerHTML = '';
    host.classList.add('hidden');
    return;
  }
  const rows = topWorkflowTrackedWeeks();
  if (!rows.length) {
    host.innerHTML = '';
    host.classList.add('hidden');
    return;
  }
  const stageMap = [
    ['prePlanning', 'Pré'],
    ['ppcMeeting', 'Reunião'],
    ['planning', 'Prog.'],
    ['feedback', 'Feedback'],
    ['quality', 'Qualid.'],
  ];
  host.classList.remove('hidden');
  host.innerHTML = rows.map(({ label, weekNumber, week }) => `
    <div class="top-workflow-card">
      <h4>${escapeHtml(label)} - Sem. ${escapeHtml(String(weekNumber))}</h4>
      <small>${escapeHtml(formatDate(week?.startDate))} a ${escapeHtml(formatDate(week?.endDate))}</small>
      <div class="top-workflow-stages">
        ${stageMap.map(([stageKey, stageLabel]) => {
          const stage = homeStageStatus(week, stageKey);
          return `
            <button
              type="button"
              class="top-workflow-stage ${escapeHtml(stage.variant)}"
              data-workflow-week="${escapeHtml(String(weekNumber))}"
              data-workflow-stage="${escapeHtml(stageKey)}"
              title="${escapeHtml(stage.title)}"
            >
              <strong>${escapeHtml(stageLabel)}</strong>
              <span>${escapeHtml(stage.mark)}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

}

function startOfDayLocalFromInput(value) {
  const key = dateKeyLocal(value);
  const fromKey = dateFromKeyLocal(key);
  if (fromKey) return fromKey;
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function nextMondayAfterDateLocal(dateInput) {
  const date = startOfDayLocalFromInput(dateInput);
  const day = date.getDay(); // 0=Dom, 1=Seg
  let diff = (8 - day) % 7;
  if (diff === 0) diff = 7;
  date.setDate(date.getDate() + diff);
  return date;
}

function mondayOnOrBeforeDateLocal(dateInput) {
  const date = startOfDayLocalFromInput(dateInput);
  const day = date.getDay(); // 0=Dom, 1=Seg
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

function calculateWeek1EndDateLocal(week1StartDate) {
  const endDate = new Date(week1StartDate);
  const day = endDate.getDay();
  const toSaturday = (6 - day + 7) % 7;
  endDate.setDate(endDate.getDate() + toSaturday);

  const week2Start = nextMondayAfterDateLocal(week1StartDate);
  if (endDate.getTime() >= week2Start.getTime()) {
    endDate.setTime(week2Start.getTime());
    endDate.setDate(endDate.getDate() - 1);
  }
  return endDate;
}

function calculateWeekPeriodLocal(workStartDate, weekNumber) {
  const normalizedWeekNumber = Math.max(1, Number.parseInt(weekNumber, 10) || 1);
  const week1Start = startOfDayLocalFromInput(workStartDate);
  let startDate = new Date(week1Start);

  if (normalizedWeekNumber >= 2) {
    const week2Start = nextMondayAfterDateLocal(week1Start);
    startDate = new Date(week2Start);
    startDate.setDate(startDate.getDate() + ((normalizedWeekNumber - 2) * 7));
  }

  let endDate;
  if (normalizedWeekNumber === 1) {
    endDate = calculateWeek1EndDateLocal(startDate);
  } else {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5);
  }
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

function calculateWeekNumberForDate(workStartDate, targetDate) {
  const week1Start = startOfDayLocalFromInput(workStartDate);
  const week2Start = nextMondayAfterDateLocal(week1Start);
  const target = startOfDayLocalFromInput(targetDate);

  if (target.getTime() < week2Start.getTime()) return 1;

  const targetWeekMonday = mondayOnOrBeforeDateLocal(target);
  if (targetWeekMonday.getTime() < week2Start.getTime()) return 1;

  const diffDays = Math.floor((targetWeekMonday.getTime() - week2Start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(2, Math.floor(diffDays / 7) + 2);
}

function nextMondayFromDate(dateInput) {
  const base = new Date(dateInput);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay(); // 0=Dom, 1=Seg, ... 6=Sáb
  let daysToAdd = (8 - day) % 7;
  if (daysToAdd === 0) daysToAdd = 7; // se hoje é segunda, próxima segunda = +7 dias
  base.setDate(base.getDate() + daysToAdd);
  return base;
}

function refreshTaskDayOptions() {
  const saturdayLabel = $('#saturdayDayOption');
  const saturdayInput = document.querySelector('input[data-day][value="SATURDAY"]');
  if (!saturdayLabel || !saturdayInput) return;
  saturdayLabel.classList.remove('hidden');
  saturdayInput.disabled = false;
  syncTaskDatesFromDayCheckboxes();
}

function updateWeekFormPreview() {
  const work = selectedWork();
  const weekNumber = Number.parseInt($('#weekNumber').value, 10);
  if (!work || !work.startDate || Number.isNaN(weekNumber) || weekNumber <= 0) {
    $('#weekStartPreview').value = '';
    $('#weekEndPreview').value = '';
    updateWeekPeriodInfo();
    refreshTaskDayOptions();
    syncWeekControlButtons();
    renderDeadlineCountdowns();
    return;
  }

  const { startDate, endDate } = calculateWeekPeriodLocal(work.startDate, weekNumber);
  $('#weekStartPreview').value = formatDate(startDate);
  $('#weekEndPreview').value = formatDate(endDate);
  $('#weekPeriodInfo').textContent = `Período calculado: ${formatDate(startDate)} até ${formatDate(endDate)}.`;
  refreshTaskDayOptions();
  syncWeekControlButtons();
  renderDeadlineCountdowns();
}

function updateExpectedWeekPreview() {
  const weekNumber = expectedWeekNumberField();
  const work = selectedWork();
  const startEl = $('#expectedWeekStart');
  const endEl = $('#expectedWeekEnd');
  if (!startEl || !endEl) return;

  if (!work?.startDate || !weekNumber) {
    startEl.value = '';
    endEl.value = '';
    return;
  }

  const { startDate, endDate } = calculateWeekPeriodLocal(work.startDate, weekNumber);
  startEl.value = formatDate(startDate);
  endEl.value = formatDate(endDate);
}

function ppcMeetingWeekNumberField() {
  const el = $('#ppcMeetingWeekNumber');
  if (!el) return null;
  const value = Number.parseInt(el.value || '', 10);
  if (Number.isNaN(value) || value <= 0) return null;
  return value;
}

function updatePpcMeetingWeekPreview() {
  const weekNumber = ppcMeetingWeekNumberField();
  const work = selectedWork();
  const startEl = $('#ppcMeetingWeekStart');
  const endEl = $('#ppcMeetingWeekEnd');
  if (!startEl || !endEl) return;

  if (!work?.startDate || !weekNumber) {
    startEl.value = '';
    endEl.value = '';
    renderQualityPdfButton();
    renderDeadlineCountdowns();
    return;
  }

  const { startDate, endDate } = calculateWeekPeriodLocal(work.startDate, weekNumber);
  startEl.value = formatDate(startDate);
  endEl.value = formatDate(endDate);
  renderQualityPdfButton();
  renderDeadlineCountdowns();
}

function suggestNextWeekNumber() {
  const work = selectedWork();
  if (!work || !work.startDate) return;
  const suggestedDate = nextMondayFromDate(new Date());
  const suggested = calculateWeekNumberForDate(work.startDate, suggestedDate);
  $('#weekNumber').value = String(suggested);
}

function suggestedNextWeekNumberForCurrentWork() {
  const work = selectedWork();
  if (!work || !work.startDate) return null;
  const suggestedDate = nextMondayFromDate(new Date());
  return calculateWeekNumberForDate(work.startDate, suggestedDate);
}

function suggestedFeedbackWeekNumberForCurrentWork() {
  const suggestedNext = suggestedNextWeekNumberForCurrentWork();
  if (!suggestedNext) return null;
  return Math.max(1, suggestedNext - 1);
}

function suggestedCurrentWeekNumberForCurrentWork() {
  const work = selectedWork();
  if (!work || !work.startDate) return null;
  return calculateWeekNumberForDate(work.startDate, new Date());
}

function numericWeekField() {
  const value = Number.parseInt($('#weekNumber').value, 10);
  if (Number.isNaN(value) || value <= 0) return null;
  return value;
}

function expectedWeekNumberField() {
  const el = $('#expectedWeekNumber');
  if (!el) return null;
  const value = Number.parseInt(el.value, 10);
  if (Number.isNaN(value) || value <= 0) return null;
  return value;
}

function feedbackWeekNumberField() {
  const el = $('#feedbackWeekNumber');
  if (!el) return null;
  const value = Number.parseInt(el.value, 10);
  if (Number.isNaN(value) || value <= 0) return null;
  return value;
}

function updateFeedbackWeekPreview() {
  const weekNumber = feedbackWeekNumberField();
  const work = selectedWork();
  const startEl = $('#feedbackWeekStart');
  const endEl = $('#feedbackWeekEnd');
  if (!startEl || !endEl) return;

  if (!work?.startDate || !weekNumber) {
    startEl.value = '';
    endEl.value = '';
    renderFeedbackWeekdayHeaders();
    syncFeedbackComparisonPdfButton();
    renderDeadlineCountdowns();
    return;
  }

  const { startDate, endDate } = calculateWeekPeriodLocal(work.startDate, weekNumber);
  startEl.value = formatDate(startDate);
  endEl.value = formatDate(endDate);
  renderFeedbackWeekdayHeaders();
  syncFeedbackComparisonPdfButton();
  renderDeadlineCountdowns();
}

function qualityWeekNumberField() {
  const el = $('#qualityWeekNumber');
  if (!el) return null;
  const value = Number.parseInt(el.value || '', 10);
  if (Number.isNaN(value) || value <= 0) return null;
  return value;
}

function qualityWeekSelected() {
  const weekNumber = qualityWeekNumberField();
  if (!weekNumber) return null;
  return state.weeks.find((item) => Number(item.weekNumber) === Number(weekNumber)) || null;
}

function updateQualityWeekPreview() {
  const weekNumber = qualityWeekNumberField();
  const work = selectedWork();
  const startEl = $('#qualityWeekStart');
  const endEl = $('#qualityWeekEnd');
  if (!startEl || !endEl) return;

  if (!work?.startDate || !weekNumber) {
    startEl.value = '';
    endEl.value = '';
    renderDeadlineCountdowns();
    return;
  }

  const { startDate, endDate } = calculateWeekPeriodLocal(work.startDate, weekNumber);
  startEl.value = formatDate(startDate);
  endEl.value = formatDate(endDate);
  renderDeadlineCountdowns();
}

function renderFeedbackWeekdayHeaders() {
  const map = {
    MONDAY: { id: '#feedbackHeadMon', label: 'Seg' },
    TUESDAY: { id: '#feedbackHeadTue', label: 'Ter' },
    WEDNESDAY: { id: '#feedbackHeadWed', label: 'Qua' },
    THURSDAY: { id: '#feedbackHeadThu', label: 'Qui' },
    FRIDAY: { id: '#feedbackHeadFri', label: 'Sex' },
    SATURDAY: { id: '#feedbackHeadSat', label: 'Sáb' },
  };

  const weekDays = weekDisplayWeatherDays(activeWeek());
  const byWeekday = new Map(
    weekDays.map((item) => [String(item.weekday || '').toUpperCase(), item]),
  );

  Object.entries(map).forEach(([weekday, config]) => {
    const el = $(config.id);
    if (!el) return;
    const dateText = formatDayMonth(byWeekday.get(weekday)?.dayDate || null);
    el.innerHTML = `<span>${config.label}</span><small>${dateText}</small>`;
  });
}

async function syncSelectedWeekFromWeekFieldIfNeeded() {
  const typedWeekNumber = numericWeekField();
  if (!typedWeekNumber) return activeWeek();
  const existing = state.weeks.find((item) => Number(item.weekNumber) === typedWeekNumber);
  if (!existing) return null;
  if (Number(existing.id) === Number(state.selectedWeekId)) return existing;

  state.selectedWeekId = existing.id;
  state.sheetDraftRows = [];
  await loadWeeks();
  await loadTasksAndDashboard();
  return state.weeks.find((item) => Number(item.id) === Number(existing.id)) || existing;
}

function syncWeekFieldWithSelectedWeek() {
  const week = activeWeek();
  if (!week) return;
  $('#weekNumber').value = String(week.weekNumber);
  updateWeekFormPreview();
}

function consideredWeekFromFieldOrSelection() {
  const typedWeekNumber = numericWeekField();
  if (typedWeekNumber) {
    return state.weeks.find((item) => Number(item.weekNumber) === typedWeekNumber) || null;
  }
  return activeWeek();
}

function weekStatusLabel(week) {
  if (!week) return 'Não aberta';
  const statusField = planningModeStatusField();
  const status = String(week[statusField] || '').toUpperCase();
  if (status === 'OPEN') return 'Aberta';
  if (!isPrePlanningMode() && status === 'CLOSED' && week.hasPendingReopenRequest) return 'Com solicitação de abertura';
  if (status === 'CLOSED') return 'Fechada';
  return status || '-';
}

function weekStatusVariant(week) {
  if (!week) return 'not-open';
  const statusField = planningModeStatusField();
  const status = String(week[statusField] || '').toUpperCase();
  if (status === 'OPEN') return 'open';
  if (!isPrePlanningMode() && status === 'CLOSED' && week.hasPendingReopenRequest) return 'pending-reopen';
  if (status === 'CLOSED') return 'closed';
  return 'unknown';
}

function renderWeekStatusInfo() {
  const el = $('#weekStatusInfo');
  if (!el) return;
  const week = consideredWeekFromFieldOrSelection();
  const variant = weekStatusVariant(week);
  el.className = `week-status week-status--${variant}`;
  const labelPrefix = isPrePlanningMode() ? 'Status da pré-programação' : 'Status da semana';
  el.textContent = `${labelPrefix}: ${weekStatusLabel(week)}.`;
}

function syncWeekControlButtons() {
  const openBtn = $('#openWeekBtn');
  const closeBtn = $('#closePlanningBtn');
  const reopenBtn = $('#reopenBtn');
  if (!openBtn || !closeBtn || !reopenBtn) return;
  openBtn.classList.add('hidden');

  const canEdit = hasAnyRole(EDIT_ROLES);
  const preMode = isPrePlanningMode();
  if (!canEdit) {
    closeBtn.classList.add('hidden');
    reopenBtn.classList.add('hidden');
    renderWeekStatusInfo();
    return;
  }

  const typedWeekNumber = numericWeekField();
  if (!typedWeekNumber) {
    closeBtn.classList.add('hidden');
    reopenBtn.classList.add('hidden');
    renderWeekStatusInfo();
    return;
  }

  const week = consideredWeekFromFieldOrSelection();
  if (!week) {
    closeBtn.classList.add('hidden');
    reopenBtn.classList.add('hidden');
    renderWeekStatusInfo();
    return;
  }

  const statusField = planningModeStatusField();
  const planningStatus = String(week[statusField] || '').toUpperCase();
  if (preMode) {
    reopenBtn.textContent = 'Reabrir pré-programação';
  } else {
    reopenBtn.textContent = hasAnyRole(['ADMIN', 'CONTROLLER']) ? 'Reabrir semana' : 'Solicitar abertura';
  }
  openBtn.classList.add('hidden');
  const planningPrereqsReady = String(week.prePlanningStatus || '').toUpperCase() === 'CLOSED'
    && String(week?.ppcMeeting?.isClosed || '').toLowerCase() === 'true';
  closeBtn.classList.toggle('hidden', planningStatus !== 'OPEN');
  closeBtn.disabled = planningStatus !== 'OPEN' || (!preMode && !planningPrereqsReady);
  const canReopenPre = preMode && hasAnyRole(['ADMIN']) && planningStatus === 'CLOSED';
  const canReopenPlanning = !preMode && planningStatus === 'CLOSED';
  reopenBtn.classList.toggle('hidden', !(canReopenPre || canReopenPlanning));
  renderWeekStatusInfo();
}

function parseIsoDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(String(value || '').trim());
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function dateKeyLocal(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const raw = value.trim();
    const isoKey = parseIsoDateKey(raw);
    if (isoKey) return isoKey;
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKeyLocal(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function holidayDateKeySet() {
  return new Set(
    (state.holidays || [])
      .map((item) => dateKeyLocal(item.dayDate))
      .filter(Boolean),
  );
}

function isHolidayDate(value) {
  if (!value) return false;
  const key = dateKeyLocal(value);
  if (!key) return false;
  return holidayDateKeySet().has(key);
}

function holidayDatesFromPlannedDays(plannedDays) {
  const holidayKeys = holidayDateKeySet();
  if (!holidayKeys.size) return [];
  const keys = (plannedDays || [])
    .map((item) => dateKeyLocal(item?.plannedDate))
    .filter((key) => key && holidayKeys.has(key));
  const unique = [...new Set(keys)];
  return unique.map((key) => {
    const date = dateFromKeyLocal(key);
    return date ? formatDate(date) : key;
  });
}

function compareDateOnlyLocal(a, b) {
  const keyA = dateKeyLocal(a);
  const keyB = dateKeyLocal(b);
  if (!keyA || !keyB) return 0;
  if (keyA < keyB) return -1;
  if (keyA > keyB) return 1;
  return 0;
}

const JS_WEEKDAY = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function weekCalendarDays(week = activeWeek()) {
  if (!week) return [];
  const startKey = dateKeyLocal(week.startDate);
  const endKey = dateKeyLocal(week.endDate);
  const start = dateFromKeyLocal(startKey);
  const end = dateFromKeyLocal(endKey);
  if (!start || !end) return [];
  end.setHours(23, 59, 59, 999);

  const rows = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (compareDateOnlyLocal(cursor, end) <= 0) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 6) {
      const weekday = JS_WEEKDAY[day];

      rows.push({
        weekday,
        dayDate: new Date(cursor),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

function planningWeekContext() {
  const typedWeekNumber = numericWeekField();
  if (typedWeekNumber) {
    const existing = state.weeks.find((item) => Number(item.weekNumber) === typedWeekNumber);
    if (existing) return existing;

    const work = selectedWork();
    if (work?.startDate) {
      const { startDate, endDate } = calculateWeekPeriodLocal(work.startDate, typedWeekNumber);
      return {
        startDate,
        endDate,
        weatherDays: [],
      };
    }
  }
  return activeWeek();
}

function expectedWeekContext() {
  if (state.expectedWeekId) {
    const byId = state.weeks.find((item) => Number(item.id) === Number(state.expectedWeekId));
    if (byId) return byId;
  }
  if (state.expectedWeekNumber) {
    const byNumber = state.weeks.find((item) => Number(item.weekNumber) === Number(state.expectedWeekNumber));
    if (byNumber) return byNumber;
    const work = selectedWork();
    if (work?.startDate) {
      const { startDate, endDate } = calculateWeekPeriodLocal(work.startDate, state.expectedWeekNumber);
      return { startDate, endDate, weatherDays: [] };
    }
  }
  return activeWeek();
}

function taskEarliestPlannedDate(task) {
  const byDays = (task?.plannedDays || [])
    .map((item) => dateFromKeyLocal(dateKeyLocal(item?.plannedDate)))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  if (byDays.length) return byDays[0];

  const fromStart = dateFromKeyLocal(dateKeyLocal(task?.plannedStart));
  if (fromStart) return fromStart;

  const fromEnd = dateFromKeyLocal(dateKeyLocal(task?.plannedEnd));
  if (fromEnd) return fromEnd;

  return null;
}

function taskDisplayStatusCode(task, weekContext, isDraft = false) {
  const rawStatus = String(task?.status || 'PLANNED').toUpperCase();
  if (isDraft) {
    if (rawStatus === 'CANCELLED') return 'CANCELADA';
    if (rawStatus === 'RETRABALHO') return 'RETRABALHO';
    if (rawStatus === 'RESERVA') return 'RESERVA';
    return 'PLANEJADA';
  }
  if (task?.isUnplanned) return 'NAO_PLANEJADA';
  if (rawStatus === 'CANCELLED') return 'CANCELADA';
  if (Number(task?.originWeekId) !== Number(task?.currentWeekId)) return 'PENDENTE';

  const weekStart = dateFromKeyLocal(dateKeyLocal(weekContext?.startDate));
  const earliestPlanned = taskEarliestPlannedDate(task);
  if (weekStart && earliestPlanned && earliestPlanned.getTime() < weekStart.getTime()) return 'PENDENTE';

  if (rawStatus === 'RETRABALHO') return 'RETRABALHO';
  if (rawStatus === 'RESERVA') return 'RESERVA';
  return 'PLANEJADA';
}

function planningStatusLabelFromCode(code) {
  const key = String(code || '').toUpperCase();
  if (key === 'PENDENTE') return 'Pendente';
  if (key === 'CANCELADA') return 'Cancelada';
  if (key === 'NAO_PLANEJADA') return 'Não planejada';
  if (key === 'RETRABALHO') return 'Retrabalho';
  if (key === 'RESERVA') return 'Reserva';
  return 'Planejada';
}

function auditEventLabel(eventType) {
  const key = String(eventType || '').trim().toUpperCase();
  const labels = {
    USER_LOGIN: 'Login',
    PRE_PLANNING_CLOSED: 'Pré-programação fechada',
    PRE_PLANNING_REOPENED: 'Pré-programação reaberta',
    PPC_MEETING_CLOSED: 'Reunião fechada',
    PPC_MEETING_REOPENED: 'Reunião reaberta',
    PLANNING_CLOSED: 'Programação fechada',
    FEEDBACK_REOPENED: 'Feedback reaberto',
    PERCEIVED_QUALITY_SAVED: 'Qualidade salva',
    PERCEIVED_QUALITY_CLOSED: 'Qualidade fechada',
    PERCEIVED_QUALITY_REOPENED: 'Qualidade reaberta',
    TASK_CREATED: 'Atividade criada',
    PRE_TASK_CREATED: 'Atividade criada na pré-programação',
    TASK_CANCELLED: 'Atividade cancelada',
    PRE_TASK_CANCELLED: 'Atividade cancelada na pré-programação',
    USER_CREATED: 'Usuário criado',
    WORK_CREATED: 'Obra criada',
    WORK_UPDATED: 'Obra atualizada',
    HOLIDAY_CALENDAR_PDF_EXPORTED: 'Calendário exportado',
  };
  return labels[key] || key.replace(/_/g, ' ');
}

function sheetStatusOptionsHtml(selectedStatus, mode = 'default') {
  const current = String(selectedStatus || 'PLANNED').toUpperCase();
  const options = mode === 'reserve-pending'
    ? [
      ['PLANNED', 'Planejada'],
      ['RESERVA', 'Reserva'],
    ]
    : [
      ['PLANNED', 'Planejada'],
      ['RETRABALHO', 'Retrabalho'],
      ['RESERVA', 'Reserva'],
    ];
  return options
    .map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function weekDisplayWeatherDays(week = activeWeek()) {
  const calendar = weekCalendarDays(week);
  const weatherRows = Array.isArray(week?.weatherDays) ? week.weatherDays : [];
  const extras = state.weatherExtrasByWeekId[Number(week?.id)] || {};
  return calendar.map((day) => {
    const weather = weatherRows.find((item) => (
      String(item.weekday || '').toUpperCase() === day.weekday
      && compareDateOnlyLocal(item.dayDate, day.dayDate) === 0
    )) || null;
    const key = dateKeyLocal(day.dayDate);
    const extra = extras[key] || null;
    return {
      ...day,
      icon: weather?.icon || 'UNKNOWN',
      tempMinC: weather?.tempMinC ?? null,
      tempMaxC: weather?.tempMaxC ?? null,
      precipitationMm: weather?.precipitationMm ?? extra?.precipitationMm ?? null,
      precipitationProbabilityPct: weather?.precipitationProbabilityPct ?? extra?.precipitationProbabilityPct ?? null,
    };
  });
}

function weekDisplayWeatherDaysWithSunday(week = activeWeek()) {
  const base = weekDisplayWeatherDays(week);
  if (!week?.startDate) return base;

  const monday = dateFromKeyLocal(dateKeyLocal(week.startDate));
  if (!monday) return base;
  if (monday.getDay() !== 1) return base;

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() - 1);
  const sundayKey = dateKeyLocal(sunday);
  const weatherRows = Array.isArray(week?.weatherDays) ? week.weatherDays : [];
  const extras = state.weatherExtrasByWeekId[Number(week?.id)] || {};
  const weather = weatherRows.find((item) => compareDateOnlyLocal(item.dayDate, sunday) === 0) || null;
  const extra = extras[sundayKey] || null;

  const sundayRow = {
    weekday: 'SUNDAY',
    dayDate: sunday,
    icon: weather?.icon || 'UNKNOWN',
    tempMinC: weather?.tempMinC ?? null,
    tempMaxC: weather?.tempMaxC ?? null,
    precipitationMm: weather?.precipitationMm ?? extra?.precipitationMm ?? null,
    precipitationProbabilityPct: weather?.precipitationProbabilityPct ?? extra?.precipitationProbabilityPct ?? null,
  };

  return [sundayRow, ...base];
}

function applyWeatherFetchExtras(weekId, weatherDays) {
  const normalizedWeekId = Number(weekId);
  if (!normalizedWeekId || !Array.isArray(weatherDays)) return;

  const perDate = {};
  weatherDays.forEach((row) => {
    const key = dateKeyLocal(row.dayDate);
    if (!key) return;
    const precipitationMm = Number(row.precipitationMm);
    const precipitationProbabilityPct = Number(row.precipitationProbabilityPct);
    perDate[key] = {
      precipitationMm: Number.isFinite(precipitationMm) ? precipitationMm : null,
      precipitationProbabilityPct: Number.isFinite(precipitationProbabilityPct) ? precipitationProbabilityPct : null,
    };
  });
  state.weatherExtrasByWeekId[normalizedWeekId] = perDate;
}

function applyCachedWeatherExtrasToWeeks() {
  state.weeks.forEach((week) => {
    const extras = state.weatherExtrasByWeekId[Number(week.id)];
    if (!extras || !Array.isArray(week.weatherDays)) return;
    week.weatherDays = week.weatherDays.map((row) => {
      const key = dateKeyLocal(row.dayDate);
      const extra = extras[key];
      if (!extra) return row;
      return {
        ...row,
        precipitationMm: row.precipitationMm ?? extra.precipitationMm ?? null,
        precipitationProbabilityPct: row.precipitationProbabilityPct ?? extra.precipitationProbabilityPct ?? null,
      };
    });
  });
}

function weekDayMap(week = activeWeek()) {
  const map = new Map();
  weekCalendarDays(week).forEach((day) => {
    map.set(String(day.weekday || '').toUpperCase(), day);
  });
  return map;
}

function refreshCurrentRoles() {
  const roles = (state.user?.assignments || [])
    .filter((a) => Number(a.workId) === Number(state.selectedWorkId))
    .map((a) => a.role);
  if (state.isAdmin) roles.push('ADMIN');
  state.currentRoles = new Set(roles);
}

function updateSessionInfo() {
  const logoutBtn = $('#logoutBtn');
  if (!state.user) {
    $('#sessionInfo').textContent = 'Sem sessão';
    if (logoutBtn) logoutBtn.classList.add('hidden');
    renderTopWorkflowStrip();
    return;
  }
  const roles = [...state.currentRoles].join(', ');
  $('#sessionInfo').textContent = `${state.user.name} (${roles || 'sem perfil'})`;
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  renderTopWorkflowStrip();
}

function renderMainWorkSelect() {
  const select = $('#workSelect');
  select.innerHTML = '';
  state.availableWorks.forEach((work) => {
    const option = document.createElement('option');
    option.value = String(work.id);
    option.textContent = `${work.name} (${work.cep})`;
    select.appendChild(option);
  });

  if (state.selectedWorkId) {
    select.value = String(state.selectedWorkId);
  } else if (state.availableWorks.length > 0) {
    state.selectedWorkId = state.availableWorks[0].id;
    select.value = String(state.selectedWorkId);
  }
}

function openGateway() {
  $('#loginView').classList.add('hidden');
  $('#appView').classList.add('hidden');
  $('#gatewayView').classList.remove('hidden');
  resetSaveReminderTicker();

  $('#adminGateway').classList.toggle('hidden', !state.isAdmin);
  $('#nonAdminGateway').classList.toggle('hidden', state.isAdmin);

  if (state.isAdmin) {
    $('#gatewayTitle').textContent = 'Entrada do Administrador';
    $('#gatewaySubtitle').textContent = 'Escolha entre acesso à obra ou cadastros.';
    resetAdminStartChoice();
    resetAdminChoice();
    showAdminGatewayStep('start');
    fillGatewayAdminWorkSelect();
  } else {
    $('#gatewayTitle').textContent = 'Entrada por Obra';
    $('#gatewaySubtitle').textContent = 'Selecione a obra que você tem acesso e prossiga.';
    fillGatewayUserWorkSelect();
  }
  refreshSideNavVisibility();
}

function fillGatewayAdminWorkSelect() {
  const select = $('#gatewayAdminWorkSelect');
  select.innerHTML = '';
  state.availableWorks.forEach((work) => {
    const option = document.createElement('option');
    option.value = String(work.id);
    option.textContent = `${work.name} (${work.cep})`;
    select.appendChild(option);
  });
}

function fillGatewayUserWorkSelect() {
  const select = $('#gatewayUserWorkSelect');
  select.innerHTML = '';
  state.userWorks.forEach((work) => {
    const option = document.createElement('option');
    option.value = String(work.id);
    option.textContent = `${work.name} (${work.cep})`;
    select.appendChild(option);
  });
}

function showAdminGatewayStep(step) {
  $('#adminStartStep').classList.toggle('hidden', step !== 'start');
  $('#adminWorkChoiceStep').classList.toggle('hidden', step !== 'workChoice');
  $('#adminSelectStep').classList.toggle('hidden', step !== 'select');
  $('#adminCreateStep').classList.toggle('hidden', step !== 'create');
}

function resetGatewayCreateForm() {
  $('#gatewayCreateForm').reset();
  if ($('#gatewayWorkPpcTargetPct')) $('#gatewayWorkPpcTargetPct').value = '80';
}

function selectedAdminChoice() {
  const selected = document.querySelector('input[name="adminEntryChoice"]:checked');
  return selected ? selected.value : null;
}

function selectedAdminStartChoice() {
  const selected = document.querySelector('input[name="adminStartChoice"]:checked');
  return selected ? selected.value : null;
}

function resetAdminStartChoice() {
  $$('input[name="adminStartChoice"]').forEach((input) => {
    input.checked = false;
  });
}

function resetAdminChoice() {
  $$('input[name="adminEntryChoice"]').forEach((input) => {
    input.checked = false;
  });
}

function splitUserNameCompany(raw) {
  const text = String(raw || '').trim();
  const idx = text.indexOf(' | ');
  if (idx < 0) return { name: text, company: '' };
  return {
    name: text.slice(0, idx).trim(),
    company: text.slice(idx + 3).trim(),
  };
}

function showCadastroView(view) {
  state.cadastroView = view;
  $('#cadastroMenuView').classList.toggle('hidden', view !== 'menu');
  $('#cadastroUsersView').classList.toggle('hidden', view !== 'users');
  $('#cadastroWorksView').classList.toggle('hidden', view !== 'works');
  $('#cadastroContractorsView').classList.toggle('hidden', view !== 'contractors');
  $('#cadastroCausesView').classList.toggle('hidden', view !== 'causes');
  $('#cadastroGroupsView').classList.toggle('hidden', view !== 'groups');
  $('#cadastroLaborTypesView').classList.toggle('hidden', view !== 'laborTypes');
  $('#cadastroCompanyView').classList.toggle('hidden', view !== 'company');
  if (view === 'users') selectUserCadastroTab(state.cadastroUsersTab || 'users');
  if (view === 'company') renderCompanyForm();
}

function selectObraCadastroTab(name) {
  state.obraCadastroTab = name;
  $$('.obra-cadastro-tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.obraCadastroTab === name);
  });
  $$('.obra-cadastro-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.obraCadastroPanel !== name);
    panel.classList.toggle('active', panel.dataset.obraCadastroPanel === name);
  });
  renderSideNavActiveState();
}

function selectUserCadastroTab(name) {
  state.cadastroUsersTab = name;
  $$('.user-cadastro-tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.userCadastroTab === name);
  });
  $$('.user-cadastro-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.userCadastroPanel !== name);
    panel.classList.toggle('active', panel.dataset.userCadastroPanel === name);
  });
}

function selectDashboardSubtab(name) {
  state.dashboardTab = name;
  $$('.dashboard-subtab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.dashboardTab === name);
  });
  $$('.dashboard-subtab-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.dashboardPanel !== name);
    panel.classList.toggle('active', panel.dataset.dashboardPanel === name);
  });
  if (activeTabName() === 'gestao') {
    refreshDashboardBySubtab({ useDefault: true, silent: true })
      .catch((error) => setStatus(`Erro ao atualizar dashboards: ${error.message}`, true));
  }
  renderSideNavActiveState();
}

function activeTabName() {
  const active = document.querySelector('[data-tab].active');
  return active ? active.dataset.tab : null;
}

function isPlanningTab(tabName = activeTabName()) {
  return tabName === 'programacao' || tabName === 'preprogramacao';
}

function isPrePlanningMode() {
  return activeTabName() === 'preprogramacao';
}

function planningPanelNameForTab(tabName) {
  return tabName === 'preprogramacao' ? 'programacao' : tabName;
}

function planningModeStatusField() {
  return isPrePlanningMode() ? 'prePlanningStatus' : 'planningStatus';
}

function planningTaskCollectionPath(weekId) {
  return isPrePlanningMode()
    ? `/weeks/${weekId}/pre-tasks`
    : `/weeks/${weekId}/tasks`;
}

function planningTaskItemPath(taskId) {
  return isPrePlanningMode()
    ? `/pre-tasks/${taskId}`
    : `/tasks/${taskId}`;
}

function planningTaskImportFromGroupPath(weekId) {
  return isPrePlanningMode()
    ? `/weeks/${weekId}/pre-tasks/from-group`
    : `/weeks/${weekId}/tasks/from-group`;
}

function planningCloseActionPath(weekId) {
  return isPrePlanningMode()
    ? `/weeks/${weekId}/close-pre-planning`
    : `/weeks/${weekId}/close-planning`;
}

function planningModeLabel() {
  return isPrePlanningMode() ? 'Pré-programação' : 'Programação';
}

function syncPlanningModeUi() {
  const preMode = isPrePlanningMode();
  const controlTitle = $('#planningControlTitle');
  const weatherTitle = $('#planningWeatherTitle');
  const sheetTitle = $('#planningSheetTitle');
  const closeBtn = $('#closePlanningBtn');
  const reopenBtn = $('#reopenBtn');
  const exportExcelBtn = $('#exportWeekExcelBtn');
  const importExcelBtn = $('#importWeekExcelBtn');

  if (controlTitle) controlTitle.textContent = preMode ? 'Abertura e controle da pré-programação' : 'Abertura e controle da semana';
  if (weatherTitle) weatherTitle.textContent = preMode ? 'Previsão do tempo (domingo a sábado)' : 'Previsão do tempo (domingo a sábado)';
  if (sheetTitle) sheetTitle.textContent = preMode ? 'Planilha da pré-programação' : 'Planilha da semana';
  if (closeBtn) closeBtn.textContent = preMode ? 'Fechar pré-programação' : 'Fechar planejamento';
  if (reopenBtn) reopenBtn.classList.toggle('hidden', preMode);
  if (exportExcelBtn) exportExcelBtn.classList.remove('hidden');
  if (importExcelBtn) importExcelBtn.classList.remove('hidden');
  const exportTxtBtn = $('#exportWeekTxtBtn');
  const importTxtBtn = $('#importWeekTxtBtn');
  if (exportTxtBtn) exportTxtBtn.classList.remove('hidden');
  if (importTxtBtn) importTxtBtn.classList.remove('hidden');
  renderDeadlineCountdowns();
}

function refreshFilterContractorOptions() {
  // Filtros estilo planilha (texto por coluna): não há lista de empreiteiro neste modo.
}

function planningTaskFilterMatch(task, weekContext) {
  const contractorFilter = normalizeSearchText(state.planningFilters.contractor);
  const location1Filter = normalizeSearchText(state.planningFilters.location1);
  const location2Filter = normalizeSearchText(state.planningFilters.location2);
  const taskFilter = normalizeSearchText(state.planningFilters.task);
  const monFilter = String(state.planningFilters.mon || '').trim().toLowerCase();
  const tueFilter = String(state.planningFilters.tue || '').trim().toLowerCase();
  const wedFilter = String(state.planningFilters.wed || '').trim().toLowerCase();
  const thuFilter = String(state.planningFilters.thu || '').trim().toLowerCase();
  const friFilter = String(state.planningFilters.fri || '').trim().toLowerCase();
  const satFilter = String(state.planningFilters.sat || '').trim().toLowerCase();
  const statusFilterRaw = String(state.planningFilters.status || '').trim().toUpperCase();
  const statusFilter = statusFilterRaw === 'PLANNED' ? 'PLANEJADA' : statusFilterRaw;
  const displayStatus = String(taskDisplayStatusCode(task, weekContext, false) || '').toUpperCase();
  const rawStatus = String(task.status || '').toUpperCase();
  const plannedDaysSet = new Set((task.plannedDays || []).map((d) => String(d.weekday || '').toUpperCase()));
  const dayMatch = (filterValue, weekday) => {
    if (!filterValue) return true;
    const checked = plannedDaysSet.has(weekday);
    if (filterValue === 'checked') return checked;
    if (filterValue === 'unchecked') return !checked;
    return true;
  };
  if (statusFilter && displayStatus !== statusFilter && rawStatus !== statusFilter) return false;
  if (contractorFilter && !normalizeSearchText(task.contractor?.name || '').includes(contractorFilter)) return false;
  if (location1Filter && !normalizeSearchText(task.location?.level1 || task.locationLevel1 || '').includes(location1Filter)) return false;
  if (location2Filter && !normalizeSearchText(displayLocationLevel2(task.location) === '-' ? '' : (task.location?.level2 || task.locationLevel2 || '')).includes(location2Filter)) return false;
  if (taskFilter && !normalizeSearchText(task.description || '').includes(taskFilter)) return false;
  if (!dayMatch(monFilter, 'MONDAY')) return false;
  if (!dayMatch(tueFilter, 'TUESDAY')) return false;
  if (!dayMatch(wedFilter, 'WEDNESDAY')) return false;
  if (!dayMatch(thuFilter, 'THURSDAY')) return false;
  if (!dayMatch(friFilter, 'FRIDAY')) return false;
  if (!dayMatch(satFilter, 'SATURDAY')) return false;
  return true;
}

function feedbackTaskFilterMatch(task, feedbackStatus, row) {
  const contractorFilter = normalizeSearchText(state.feedbackFilters.contractor);
  const location1Filter = normalizeSearchText(state.feedbackFilters.location1);
  const location2Filter = normalizeSearchText(state.feedbackFilters.location2);
  const taskFilter = normalizeSearchText(state.feedbackFilters.task);
  const causeGroupFilter = normalizeSearchText(state.feedbackFilters.causeGroup);
  const causeFilter = normalizeSearchText(state.feedbackFilters.cause);
  const commentFilter = normalizeSearchText(state.feedbackFilters.comment);
  const statusFilter = String(state.feedbackFilters.status || '').trim().toUpperCase();
  if (statusFilter && String(feedbackStatus || '').toUpperCase() !== statusFilter) return false;
  const contractorText = row?.querySelector('.fb-contractor')?.selectedOptions?.[0]?.textContent
    || row?.querySelector('.fb-unplanned-contractor')?.selectedOptions?.[0]?.textContent
    || task.contractor?.name
    || '';
  if (contractorFilter && !normalizeSearchText(contractorText).includes(contractorFilter)) return false;
  if (location1Filter && !normalizeSearchText(task.location?.level1 || '').includes(location1Filter)) return false;
  if (location2Filter && !normalizeSearchText(displayLocationLevel2(task.location) === '-' ? '' : (task.location?.level2 || '')).includes(location2Filter)) return false;
  if (taskFilter && !normalizeSearchText(task.description || '').includes(taskFilter)) return false;
  const comment = row?.querySelector('.fb-comment')?.value || '';
  const causeGroupText = row?.querySelector('.fb-cause-group')?.selectedOptions?.[0]?.textContent || '';
  const causeText = row?.querySelector('.fb-cause')?.selectedOptions?.[0]?.textContent || '';
  if (causeGroupFilter && !normalizeSearchText(causeGroupText).includes(causeGroupFilter)) return false;
  if (causeFilter && !normalizeSearchText(causeText).includes(causeFilter)) return false;
  if (commentFilter && !normalizeSearchText(comment).includes(commentFilter)) return false;
  return true;
}

function expectedTaskFilterMatch(task, weekContext) {
  const contractorFilter = normalizeSearchText(state.expectedFilters.contractor);
  const supervisorFilter = normalizeSearchText(state.expectedFilters.supervisor);
  const laborFilter = normalizeSearchText(state.expectedFilters.labor);
  const location1Filter = normalizeSearchText(state.expectedFilters.location1);
  const location2Filter = normalizeSearchText(state.expectedFilters.location2);
  const taskFilter = normalizeSearchText(state.expectedFilters.task);
  const statusFilterRaw = String(state.expectedFilters.status || '').trim().toUpperCase();
  const statusFilter = statusFilterRaw === 'PLANNED' ? 'PLANEJADA' : statusFilterRaw;
  const displayStatus = String(taskDisplayStatusCode(task, weekContext, false) || '').toUpperCase();
  const rawStatus = String(task.status || '').toUpperCase();
  if (statusFilter && displayStatus !== statusFilter && rawStatus !== statusFilter) return false;
  if (contractorFilter && !normalizeSearchText(task.contractor?.name || '').includes(contractorFilter)) return false;
  if (supervisorFilter && !normalizeSearchText(task.supervisor || '').includes(supervisorFilter)) return false;
  if (laborFilter && !normalizeSearchText(task.contractor?.function?.name || '').includes(laborFilter)) return false;
  if (location1Filter && !normalizeSearchText(task.location?.level1 || task.locationLevel1 || '').includes(location1Filter)) return false;
  if (location2Filter && !normalizeSearchText(displayLocationLevel2(task.location) === '-' ? '' : (task.location?.level2 || task.locationLevel2 || '')).includes(location2Filter)) return false;
  if (taskFilter && !normalizeSearchText(task.description || '').includes(taskFilter)) return false;
  return true;
}

function cadastroContextActive() {
  return state.appMode === 'cadastros' || activeTabName() === 'cadastros';
}

function refreshNavigationVisibility() {
  const isCadastroContext = cadastroContextActive();
  const hideMainTabs = isCadastroContext || state.appMode === 'cadastros';
  const isObraMode = state.appMode === 'obra';
  const cadastroTabBtn = document.querySelector('[data-tab="cadastros"]');
  const cadastroPanel = document.querySelector('[data-tab-panel="cadastros"]');
  const obraCadastrosTabBtn = document.querySelector('[data-tab="cadastrosObra"]');
  const obraCadastrosPanel = document.querySelector('[data-tab-panel="cadastrosObra"]');
  if (cadastroTabBtn) cadastroTabBtn.classList.toggle('hidden', isObraMode);
  if (cadastroPanel) cadastroPanel.classList.toggle('hidden', isObraMode);
  if (obraCadastrosTabBtn) obraCadastrosTabBtn.classList.toggle('hidden', !isObraMode);
  if (obraCadastrosPanel) obraCadastrosPanel.classList.toggle('hidden', !isObraMode);
  if (isObraMode && activeTabName() === 'cadastros') {
    selectTab('obrahome');
    return;
  }
  if (!isObraMode && activeTabName() === 'cadastrosObra') {
    selectTab('cadastros');
    return;
  }

  $('#topFilters').classList.add('hidden');
  $('#mainTabs').classList.toggle('hidden', hideMainTabs);
  const cadastroHeaderNav = $('#cadastroHeaderNav');
  if (cadastroHeaderNav) cadastroHeaderNav.classList.toggle('hidden', false);
  syncPlanningModeUi();
  refreshSideNavVisibility();
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 1100px)').matches;
}

function setupTypeAheadSelectFilter() {
  let buffer = '';
  let lastAt = 0;
  let hintTimer = null;
  const ensureHint = () => {
    let el = document.getElementById('selectTypeaheadHint');
    if (!el) {
      el = document.createElement('div');
      el.id = 'selectTypeaheadHint';
      el.className = 'select-typeahead-hint hidden';
      document.body.appendChild(el);
    }
    return el;
  };
  const showHint = (target, text) => {
    const el = ensureHint();
    if (!text) {
      el.classList.add('hidden');
      return;
    }
    const rect = target.getBoundingClientRect();
    el.textContent = text;
    el.style.left = `${Math.max(8, rect.left)}px`;
    el.style.top = `${Math.max(8, rect.top - 28)}px`;
    el.classList.remove('hidden');
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => el.classList.add('hidden'), 1200);
  };
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Backspace') {
      buffer = buffer.slice(0, -1);
      showHint(target, buffer);
      return;
    }
    if (event.key === 'Escape') {
      buffer = '';
      showHint(target, '');
      return;
    }
    if (event.key.length !== 1) return;
    const now = Date.now();
    if ((now - lastAt) > 900) buffer = '';
    lastAt = now;
    buffer += event.key;
    showHint(target, buffer);
    const needle = normalizeSearchText(buffer);
    if (!needle) return;
    const options = [...target.options].filter((opt) => !opt.disabled && String(opt.value || '').trim() !== '');
    const match = options.find((opt) => normalizeSearchText(opt.textContent).includes(needle));
    if (match) {
      target.value = match.value;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      event.preventDefault();
    }
  });
  document.addEventListener('focusout', (event) => {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const el = document.getElementById('selectTypeaheadHint');
    if (el) el.classList.add('hidden');
    buffer = '';
  });
}

function openSideNavMobile() {
  document.body.classList.add('side-nav-mobile-open');
  const backdrop = $('#sideNavBackdrop');
  if (backdrop) backdrop.classList.remove('hidden');
}

function closeSideNavMobile() {
  document.body.classList.remove('side-nav-mobile-open');
  const backdrop = $('#sideNavBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

function renderSideNavActiveState() {
  const currentMain = activeTabName();
  const dashboardSubtab = ['relatorio', 'historico', 'governanca'].includes(state.dashboardTab)
    ? state.dashboardTab
    : 'relatorio';
  const obraSubtab = state.obraCadastroTab || 'zoneamento';
  const cadastroSubview = state.cadastroView || 'users';
  const userTab = state.cadastroUsersTab || 'users';

  $$('.side-nav-item').forEach((button) => {
    const main = String(button.dataset.sideMain || '');
    const dashboard = String(button.dataset.sideDashboard || '');
    const obra = String(button.dataset.sideObra || '');
    const cadastro = String(button.dataset.sideCadastro || '');
    const sideUserTab = String(button.dataset.sideUserTab || '');
    let isActive = currentMain === main;

    if (main === 'gestao' && dashboard) {
      isActive = currentMain === 'gestao' && dashboardSubtab === dashboard;
    }
    if (main === 'cadastrosObra' && obra) {
      isActive = currentMain === 'cadastrosObra' && obraSubtab === obra;
    }
    if (main === 'cadastros' && cadastro) {
      if (cadastro === 'users' && sideUserTab) {
        isActive = currentMain === 'cadastros' && cadastroSubview === 'users' && userTab === sideUserTab;
      } else {
        isActive = currentMain === 'cadastros' && cadastroSubview === cadastro;
      }
    }
    button.classList.toggle('active', isActive);
  });
}

function refreshSideNavVisibility() {
  const appView = $('#appView');
  const sideNav = $('#sideNav');
  const sideToggle = $('#sideNavToggleBtn');
  const appVisible = appView && !appView.classList.contains('hidden');
  if (!sideNav || !sideToggle) return;

  sideNav.classList.toggle('hidden', !appVisible);
  if (!appVisible) {
    closeSideNavMobile();
    document.body.classList.remove('side-nav-expanded');
  }

  sideToggle.classList.toggle('hidden', !appVisible || !isMobileViewport());

  const isObraMode = state.appMode === 'obra';
  $$('[data-side-mode="obra"]').forEach((section) => section.classList.toggle('hidden', !isObraMode));
  $$('[data-side-mode="cadastros"]').forEach((section) => section.classList.toggle('hidden', isObraMode));

  const canDashboard = hasAnyRole(DASHBOARD_ROLES);
  $$('[data-side-requires-dashboard]').forEach((section) => section.classList.toggle('hidden', !isObraMode || !canDashboard));

  if (!isMobileViewport()) {
    closeSideNavMobile();
  }

  renderSideNavActiveState();
}

function handleSideNavItemClick(event) {
  const button = event.target.closest('.side-nav-item');
  if (!button) return;

  const action = String(button.dataset.sideAction || '');
  const main = String(button.dataset.sideMain || '');
  const dashboard = String(button.dataset.sideDashboard || '');
  const obra = String(button.dataset.sideObra || '');
  const cadastro = String(button.dataset.sideCadastro || '');
  const sideUserTab = String(button.dataset.sideUserTab || '');
  if (action === 'back-start') {
    backToStart();
    if (isMobileViewport()) closeSideNavMobile();
    return;
  }
  if (!main) return;

  if (dashboard) {
    selectTab('gestao');
    selectDashboardSubtab(dashboard);
  } else if (obra) {
    selectTab('cadastrosObra');
    selectObraCadastroTab(obra);
  } else if (main === 'cadastros' && cadastro) {
    selectTab('cadastros');
    showCadastroView(cadastro);
    if (cadastro === 'users' && sideUserTab) {
      selectUserCadastroTab(sideUserTab);
    }
  } else {
    selectTab(main);
  }

  renderSideNavActiveState();
  if (isMobileViewport()) closeSideNavMobile();
}

function handleWorkHomeLinkClick(event) {
  const button = event.target.closest('.obra-home-link');
  if (!button) return;
  const main = String(button.dataset.workHomeLink || '').trim();
  const dashboard = String(button.dataset.workHomeDashboard || '').trim();
  const obra = String(button.dataset.workHomeObra || '').trim();
  if (!main) return;

  if (dashboard) {
    selectTab('gestao');
    selectDashboardSubtab(dashboard);
    return;
  }
  if (obra) {
    selectTab('cadastrosObra');
    selectObraCadastroTab(obra);
    return;
  }
  selectTab(main);
}

function handleTopWorkflowStageClick(event) {
  const button = event.target.closest('[data-workflow-stage]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  navigateFromWorkflowStage(
    Number(button.getAttribute('data-workflow-week') || 0),
    String(button.getAttribute('data-workflow-stage') || ''),
  ).catch((error) => {
    setStatus(`Erro ao abrir etapa da semana: ${error.message}`, true);
  });
}

function applyAppMode() {
  const isCadastroOnly = state.appMode === 'cadastros';
  refreshNavigationVisibility();

  if (isCadastroOnly) {
    selectTab('cadastros');
  }
}

function renderContractors() {
  const body = $('#contractorsBody');
  const select = $('#taskContractor');
  const canEdit = hasAnyRole(EDIT_ROLES);
  const previousSelected = Number(select.value) || null;
  body.innerHTML = '';
  select.innerHTML = '<option value="">Empreiteiro</option>';

  state.contractors.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.supervisor || '-'}</td>
      <td>${item.communicationEmail || '-'}</td>
      <td>${normalizePhoneDigits(item.phone || '', 11) || '-'}</td>
      <td>${item.laborType || '-'}</td>
      <td>
        ${canEdit ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-contractor-edit="${item.id}">✎</button><button type="button" class="icon-btn delete" data-contractor-delete="${item.id}">X</button></div>` : '-'}
      </td>
    `;
    body.appendChild(tr);

    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = contractorDisplay(item);
    select.appendChild(option);
  });

  if (previousSelected && state.contractors.some((item) => Number(item.id) === previousSelected)) {
    select.value = String(previousSelected);
  }
  handleTaskContractorChange();

  syncContractorFormMode();
}

function syncContractorFormMode() {
  const editing = Boolean(state.editingContractorId);
  const submitBtn = $('#contractorSubmitBtn');
  const title = $('#contractorModalTitle');
  if (submitBtn) submitBtn.textContent = editing ? 'Salvar Empreiteiro' : 'Salvar Empreiteiro';
  if (title) title.textContent = editing ? 'Editar Empreiteiro' : 'Cadastrar Empreiteiro';
}

function resetContractorForm() {
  state.editingContractorId = null;
  $('#contractorForm')?.reset();
  const phoneInput = $('#contractorPhone');
  if (phoneInput) phoneInput.value = '';
  syncContractorFormMode();
}

function openContractorModal(editing = false) {
  syncContractorFormMode();
  $('#contractorValidationModal')?.classList.add('hidden');
  if (!editing) resetContractorForm();
  $('#contractorModal')?.classList.remove('hidden');
}

function closeContractorModal() {
  $('#contractorModal')?.classList.add('hidden');
  resetContractorForm();
}

function openContractorValidationModal(message) {
  const messageEl = $('#contractorValidationMessage');
  if (messageEl) messageEl.textContent = message || 'Não é possível cadastrar novo empreiteiro. Faltam dados!';
  $('#contractorValidationModal')?.classList.remove('hidden');
}

function closeContractorValidationModal() {
  $('#contractorValidationModal')?.classList.add('hidden');
}

function zoneLevel1Names() {
  return state.locations
    .filter((item) => isZoneLevel1Row(item))
    .map((item) => String(item.level1 || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function populateZoneLevel2ParentOptions(selectedValue = '') {
  const select = $('#zoneLevel2Parent');
  if (!select) return;
  const previousSelected = String(selectedValue || select.value || '').trim();
  const level1Names = zoneLevel1Names();
  select.innerHTML = '<option value="">Selecione o Nível 1</option>';
  level1Names.forEach((level1) => {
    const option = document.createElement('option');
    option.value = level1;
    option.textContent = level1;
    select.appendChild(option);
  });
  if (previousSelected && level1Names.includes(previousSelected)) {
    select.value = previousSelected;
  }
  select.disabled = level1Names.length === 0;
}

function renderTaskLocationLevel2Options() {
  const level1 = $('#taskLocation1').value.trim();
  const level2Select = $('#taskLocation2');
  const previousLevel2 = level2Select.value;
  level2Select.innerHTML = '<option value="">Local Nível 2</option>';
  if (!level1) return;

  const level2Rows = state.locations
    .filter((item) => !isZoneLevel1Row(item) && String(item.level1 || '').trim() === level1)
    .map((item) => String(item.level2 || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  [...new Set(level2Rows)].forEach((level2) => {
    const option = document.createElement('option');
    option.value = level2;
    option.textContent = level2;
    level2Select.appendChild(option);
  });

  if (previousLevel2 && [...level2Select.options].some((option) => option.value === previousLevel2)) {
    level2Select.value = previousLevel2;
  }
}

function renderTaskLocationSelectors() {
  const level1Select = $('#taskLocation1');
  const previousLevel1 = level1Select.value;
  level1Select.innerHTML = '<option value="">Local Nível 1</option>';

  zoneLevel1Names().forEach((level1) => {
    const option = document.createElement('option');
    option.value = level1;
    option.textContent = level1;
    level1Select.appendChild(option);
  });

  if (previousLevel1 && [...level1Select.options].some((option) => option.value === previousLevel1)) {
    level1Select.value = previousLevel1;
  }
  renderTaskLocationLevel2Options();
}

function handleTaskContractorChange() {
  const contractorId = Number($('#taskContractor').value);
  const contractor = state.contractors.find((item) => Number(item.id) === contractorId);
  $('#taskSupervisor').value = contractor?.supervisor || '';
}

function renderObraZoneamento() {
  const body = $('#zoneamentoBody');
  const canEdit = hasAnyRole(EDIT_ROLES);
  body.innerHTML = '';

  const level1List = zoneLevel1Names();

  const childrenByParent = new Map();
  state.locations
    .filter((item) => !isZoneLevel1Row(item))
    .forEach((item) => {
      const parent = String(item.level1 || '').trim();
      const child = String(item.level2 || '').trim();
      if (!parent || !child) return;
      if (!level1List.includes(parent)) return;
      if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
      childrenByParent.get(parent).push(child);
    });

  level1List.forEach((level1) => {
    const level1Marker = state.locations.find((item) => isZoneLevel1Row(item) && String(item.level1 || '').trim() === level1);
    const collapsed = state.zoneCollapsedParents.has(level1);
    const trN1 = document.createElement('tr');
    trN1.className = 'tree-level-1';
    trN1.innerHTML = `
      <td>
        <button
          type="button"
          class="icon-btn zone-toggle"
          data-zone-toggle-parent="${escapeHtml(level1)}"
          title="${collapsed ? 'Expandir itens de Nível 2' : 'Aglutinar itens de Nível 2'}"
        >${collapsed ? '▸' : '▾'}</button>
      </td>
      <td>N1</td>
      <td>${level1}</td>
      <td>
        ${canEdit && level1Marker ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-zone-level1-edit="${level1Marker.id}">✎</button><button type="button" class="icon-btn delete" data-zone-level1-delete="${level1Marker.id}">X</button></div>` : '-'}
      </td>
    `;
    body.appendChild(trN1);

    const children = [...new Set(childrenByParent.get(level1) || [])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    children.forEach((level2) => {
      const row = state.locations.find((item) => !isZoneLevel1Row(item) && item.level1 === level1 && item.level2 === level2);
      const trN2 = document.createElement('tr');
      trN2.className = 'tree-level-2';
      trN2.classList.toggle('hidden', collapsed);
      trN2.innerHTML = `
        <td></td>
        <td>N2</td>
        <td>${level2}</td>
        <td>
          ${canEdit && row ? `<div class="actions-inline"><button type="button" class="icon-btn delete" data-zone-level2-delete="${row.id}">X</button></div>` : '-'}
        </td>
      `;
      body.appendChild(trN2);
    });
  });

  renderTaskLocationSelectors();
  populateZoneLevel2ParentOptions();
  syncZoneLevel1FormMode();
  syncZoneLevel2FormMode();
  syncZoneLevel1EditModal();
}

function syncObraHolidayFormMode() {
  const editing = Boolean(state.editingObraHolidayId);
  $('#obraHolidaySubmitBtn').textContent = editing ? 'Salvar feriado' : 'Cadastrar feriado';
  $('#obraHolidayCancelEditBtn').classList.toggle('hidden', !editing);
}

function resetObraHolidayForm() {
  state.editingObraHolidayId = null;
  $('#obraHolidayForm').reset();
  syncObraHolidayFormMode();
}

function resetObraDeadlineRuleForm() {
  state.notificationRule = null;
  const form = $('#obraDeadlineRuleForm');
  if (form) form.reset();
  renderObraDeadlineRuleForm();
}

function resetObraPerceivedQualityForm() {
  state.perceivedQualityConfig = null;
  const form = $('#obraPerceivedQualityForm');
  if (form) form.reset();
  renderObraPerceivedQualityForm();
}

function renderObraDeadlineRuleForm() {
  const form = $('#obraDeadlineRuleForm');
  const hint = $('#obraDeadlineRuleHint');
  if (!form || !hint) return;

  const canManage = hasAnyRole(DEADLINE_ROLES);
  const rule = state.notificationRule || {};
  $('#prePlanningDeadlineWeekday').value = rule.prePlanningDeadlineWeekday || '';
  $('#prePlanningDeadlineTime').value = normalizeBrTimeInput(rule.prePlanningDeadlineTime || '');
  $('#ppcMeetingDeadlineWeekday').value = rule.ppcMeetingDeadlineWeekday || '';
  $('#ppcMeetingDeadlineTime').value = normalizeBrTimeInput(rule.ppcMeetingDeadlineTime || '');
  $('#planningDeadlineWeekday').value = rule.planningDeadlineWeekday || '';
  $('#planningDeadlineTime').value = normalizeBrTimeInput(rule.planningDeadlineTime || '');
  $('#feedbackDeadlineWeekday').value = rule.feedbackDeadlineWeekday || '';
  $('#feedbackDeadlineTime').value = normalizeBrTimeInput(rule.feedbackDeadlineTime || '');
  $('#qualityDeadlineWeekday').value = rule.qualityDeadlineWeekday || '';
  $('#qualityDeadlineTime').value = normalizeBrTimeInput(rule.qualityDeadlineTime || '');

  form.classList.toggle('hidden', !canManage);
  hint.textContent = canManage
    ? 'Defina dia e hora limite para os fechamentos da obra.'
    : 'Somente Administrador e Controller podem editar estes prazos.';
  renderDeadlineCountdowns();
}

function renderObraPerceivedQualityForm() {
  const form = $('#obraPerceivedQualityForm');
  const hint = $('#obraPerceivedQualityHint');
  if (!form || !hint) return;

  const canManage = hasAnyRole(EDIT_ROLES);
  const cfg = state.perceivedQualityConfig || {};

  $('#qpDeadlineRegularPct').value = cfg.deadlineRegularPct ?? '';
  $('#qpDeadlineGoodPct').value = cfg.deadlineGoodPct ?? '';
  $('#qpQualityRegularScore').value = cfg.qualityRegularScore ?? '';
  $('#qpQualityGoodScore').value = cfg.qualityGoodScore ?? '';
  $('#qpCollabPresenceImpactScore').value = cfg.collaborationPresenceImpactScore ?? '';
  $('#qpCollabRegularScore').value = cfg.collaborationRegularScore ?? '';
  $('#qpCollabGoodScore').value = cfg.collaborationGoodScore ?? '';
  $('#qpSafetyRegularScore').value = cfg.safetyRegularScore ?? '';
  $('#qpSafetyGoodScore').value = cfg.safetyGoodScore ?? '';
  $('#qpCleaningRegularScore').value = cfg.cleaningRegularScore ?? '';
  $('#qpCleaningGoodScore').value = cfg.cleaningGoodScore ?? '';

  form.classList.toggle('hidden', !canManage);
  hint.textContent = canManage
    ? 'Defina os parâmetros e faixas da Qualidade Percebida desta obra.'
    : 'Somente Administrador, Engenharia e Controller podem editar estes parâmetros.';
}

function renderObraHolidays() {
  const body = $('#obraHolidaysBody');
  if (!body) return;
  const canEdit = hasAnyRole(EDIT_ROLES);
  body.innerHTML = '';

  const ordered = [...(state.holidays || [])].sort((a, b) => {
    const keyA = dateKeyLocal(a.dayDate);
    const keyB = dateKeyLocal(b.dayDate);
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    return Number(a.id) - Number(b.id);
  });

  ordered.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(item.dayDate)}</td>
      <td>${escapeHtml(item.description || '-')}</td>
      <td>
        ${canEdit ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-holiday-edit="${item.id}">✎</button><button type="button" class="icon-btn delete" data-holiday-delete="${item.id}">X</button></div>` : '-'}
      </td>
    `;
    body.appendChild(tr);
  });

  if (!ordered.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3">Nenhum feriado cadastrado para esta obra.</td>';
    body.appendChild(tr);
  }

  syncObraHolidayFormMode();
}

function syncZoneLevel1FormMode() {
  const editing = Boolean(state.editingZoneLevel1Id);
  $('#zoneLevel1SubmitBtn').textContent = editing ? 'Salvar Nível 1' : 'Cadastrar Nível 1';
  $('#zoneLevel1CancelEditBtn').classList.toggle('hidden', !editing);
}

function resetZoneLevel1Form() {
  state.editingZoneLevel1Id = null;
  $('#zoneLevel1Form').reset();
  syncZoneLevel1FormMode();
}

function syncZoneLevel2FormMode() {
  const editing = Boolean(state.editingZoneLevel2Id);
  $('#zoneLevel2SubmitBtn').textContent = editing ? 'Salvar Nível 2' : 'Cadastrar Nível 2';
  $('#zoneLevel2CancelEditBtn').classList.toggle('hidden', !editing);
}

function resetZoneLevel2Form() {
  state.editingZoneLevel2Id = null;
  $('#zoneLevel2Form').reset();
  populateZoneLevel2ParentOptions();
  syncZoneLevel2FormMode();
}

function appendZoneLevel2ModalLine(value = '') {
  const list = $('#zoneLevel1EditLevel2Lines');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'zone-level2-line-row';
  row.innerHTML = `
    <input type="text" class="zone-level2-line" placeholder="Item de Nível 2" value="${escapeHtml(value)}" />
    <button type="button" class="secondary compact zone-level2-remove-line">Remover</button>
  `;
  list.appendChild(row);
}

function syncZoneLevel1EditModal() {
  const modal = $('#zoneLevel1EditModal');
  const saveBtn = $('#zoneLevel1EditSaveBtn');
  if (!modal || !saveBtn) return;
  const editing = Boolean(state.editingZoneLevel1ModalId);
  modal.classList.toggle('hidden', !editing);
  saveBtn.disabled = !editing;
}

function closeZoneLevel1EditModal() {
  state.editingZoneLevel1ModalId = null;
  const nameInput = $('#zoneLevel1EditName');
  const bulkInput = $('#zoneLevel1EditLevel2Bulk');
  const lines = $('#zoneLevel1EditLevel2Lines');
  if (nameInput) nameInput.value = '';
  if (bulkInput) bulkInput.value = '';
  if (lines) lines.innerHTML = '';
  syncZoneLevel1EditModal();
}

function renderObraContractors() {
  const body = $('#obraContractorsBody');
  const functionFilter = $('#obraContractorFunctionFilter');
  const catalogSelect = $('#obraContractorCatalogSelect');
  const canEdit = hasAnyRole(EDIT_ROLES);
  body.innerHTML = '';
  functionFilter.innerHTML = '<option value="">Filtrar por tipo de mão de obra</option>';
  catalogSelect.innerHTML = '<option value="">Selecione empreiteiro do cadastro geral</option>';

  state.contractorFunctions.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = item.name;
    functionFilter.appendChild(option);
  });
  functionFilter.value = state.contractorCatalogFilter || '';

  state.contractorCatalog.forEach((item) => {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = `${item.name} - ${item.laborType || '-'}`;
    catalogSelect.appendChild(option);
  });

  state.contractors.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.supervisor || '-'}</td>
      <td>${item.communicationEmail || '-'}</td>
      <td>${item.phone || '-'}</td>
      <td>${item.laborType || '-'}</td>
      <td>
        ${canEdit ? `<div class="actions-inline"><button type="button" class="icon-btn delete" data-obra-contractor-delete="${item.id}">X</button></div>` : '-'}
      </td>
    `;
    body.appendChild(tr);
  });
}

function syncObraTaskGroupItemFormMode() {
  const editing = Boolean(state.editingObraTaskGroupItemId);
  $('#obraTaskGroupItemSubmitBtn').textContent = editing ? 'Salvar tarefa do grupo' : 'Adicionar tarefa no grupo';
  $('#obraTaskGroupItemCancelEditBtn').classList.toggle('hidden', !editing);
}

function syncObraTaskGroupFormMode() {
  const editing = Boolean(state.editingObraTaskGroupId);
  $('#obraTaskGroupSubmitBtn').textContent = editing ? 'Salvar grupo' : 'Cadastrar grupo';
  $('#obraTaskGroupCancelEditBtn').classList.toggle('hidden', !editing);
}

function resetObraTaskGroupForm() {
  state.editingObraTaskGroupId = null;
  $('#obraTaskGroupForm').reset();
  syncObraTaskGroupFormMode();
}

function resetObraTaskGroupItemForm() {
  state.editingObraTaskGroupItemId = null;
  $('#obraTaskGroupItemForm').reset();
  syncObraTaskGroupItemFormMode();
}

function renderObraTaskGroups() {
  const templateSelect = $('#obraTaskGroupTemplateSelect');
  const select = $('#obraTaskGroupSelect');
  const body = $('#obraTaskGroupItemsBody');
  const previousTemplate = Number(templateSelect.value) || null;
  const previousSelected = Number(select.value) || null;
  const canEdit = hasAnyRole(EDIT_ROLES);
  templateSelect.innerHTML = '<option value="">Selecione grupo do cadastro geral</option>';
  select.innerHTML = '<option value="">Selecione o grupo</option>';
  body.innerHTML = '';

  state.taskGroupTemplates.forEach((group) => {
    const option = document.createElement('option');
    option.value = String(group.id);
    const origin = group.originWork?.name || 'Cadastro geral';
    option.textContent = `${group.name} (${origin})`;
    templateSelect.appendChild(option);
  });
  if (previousTemplate && [...templateSelect.options].some((opt) => Number(opt.value) === previousTemplate)) {
    templateSelect.value = String(previousTemplate);
  }

  const groups = state.taskGroups.filter((group) => Number(group.workId) === Number(state.selectedWorkId));
  groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = String(group.id);
    option.textContent = group.name;
    select.appendChild(option);

    const trGroup = document.createElement('tr');
    trGroup.className = 'tree-level-1';
    trGroup.innerHTML = `
      <td>1</td>
      <td>${group.name}</td>
      <td>-</td>
      <td>
        ${canEdit ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-obra-group-edit="${group.id}">✎</button><button type="button" class="icon-btn delete" data-obra-group-delete="${group.id}">X</button></div>` : '-'}
      </td>
    `;
    body.appendChild(trGroup);

    (group.items || [])
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .forEach((item) => {
        const tr = document.createElement('tr');
        tr.className = 'tree-level-2';
        tr.innerHTML = `
          <td>2</td>
          <td>${item.description}</td>
          <td>${item.laborType || '-'}</td>
          <td>
            ${canEdit ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-obra-group-item-edit="${item.id}">✎</button><button type="button" class="icon-btn delete" data-obra-group-item-delete="${item.id}">X</button></div>` : '-'}
          </td>
        `;
        body.appendChild(tr);
      });
  });

  const selected = previousSelected || (groups[0]?.id || null);
  if (selected) select.value = String(selected);
  syncObraTaskGroupFormMode();
  syncObraTaskGroupItemFormMode();
}

function renderCauses() {
  const select = $('#feedbackCause');
  const body = $('#causesBody');
  const parentSelect = $('#causeParentCategory');
  const canEdit = hasAnyRole(EDIT_ROLES);
  if (select) {
    select.innerHTML = '<option value="">Causa do não cumprimento</option>';
  }
  parentSelect.innerHTML = '<option value="">Selecione a totalizadora</option>';
  body.innerHTML = '';

  const totalizers = state.causes
    .filter((cause) => Number(cause.level) === 1)
    .sort((a, b) => String(a.category || '').localeCompare(String(b.category || ''), 'pt-BR'));

  totalizers.forEach((cause) => {
    const option = document.createElement('option');
    option.value = cause.category;
    option.textContent = cause.category;
    parentSelect.appendChild(option);
  });

  const byCategory = new Map();
  totalizers.forEach((cause) => {
    if (!byCategory.has(cause.category)) byCategory.set(cause.category, { totalizer: cause, items: [] });
  });
  state.causes
    .filter((cause) => Number(cause.level) !== 1)
    .forEach((cause) => {
      const key = cause.category || 'Geral';
      if (!byCategory.has(key)) byCategory.set(key, { totalizer: null, items: [] });
      byCategory.get(key).items.push(cause);
    });

  [...byCategory.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .forEach(([category, pack]) => {
      const groupRow = document.createElement('tr');
      groupRow.className = 'tree-level-1';
      groupRow.innerHTML = `
        <td>N1</td>
        <td>${pack.totalizer ? category : '(Totalizadora não cadastrada)'}</td>
        <td class="cause-specific-col">-</td>
        <td>
          ${canEdit && pack.totalizer ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-cause-edit="${pack.totalizer.id}">✎</button><button type="button" class="icon-btn delete" data-cause-delete="${pack.totalizer.id}">X</button></div>` : '-'}
        </td>
      `;
      body.appendChild(groupRow);

      pack.items
        .sort((a, b) => String(a.cause || '').localeCompare(String(b.cause || ''), 'pt-BR'))
        .forEach((cause) => {
          const tr = document.createElement('tr');
          tr.className = 'tree-level-2';
          tr.innerHTML = `
            <td>N2</td>
            <td>${cause.cause || cause.description}</td>
            <td class="cause-specific-col">${cause.contractorSpecific ? 'Sim' : 'Não'}</td>
            <td>
              ${canEdit ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-cause-edit="${cause.id}">✎</button><button type="button" class="icon-btn delete" data-cause-delete="${cause.id}">X</button></div>` : '-'}
            </td>
          `;
          body.appendChild(tr);

          if (select) {
            const fbOption = document.createElement('option');
            fbOption.value = String(cause.id);
            fbOption.textContent = `${cause.category} - ${cause.cause || cause.description}${cause.contractorSpecific ? ' [Empreiteiro]' : ''}`;
            select.appendChild(fbOption);
          }
        });
    });

  syncCauseFormMode();
}

function syncCauseFormMode() {
  const editing = Boolean(state.editingCauseId);
  $('#causeSubmitBtn').textContent = editing ? 'Salvar causa' : 'Cadastrar causa';
  $('#causeCancelEditBtn').classList.toggle('hidden', !editing);
}

function applyCauseLevelUi() {
  const level = $('#causeLevel').value;
  const isLevel2 = level === '2';
  const checkbox = $('#causeContractorSpecific');
  $('#causeParentCategory').classList.toggle('hidden', !isLevel2);
  if (checkbox) {
    checkbox.disabled = !isLevel2;
    if (!isLevel2) checkbox.checked = false;
  }
}

function resetCauseForm() {
  state.editingCauseId = null;
  $('#causeForm').reset();
  $('#causeLevel').value = '1';
  $('#causeContractorSpecific').checked = false;
  applyCauseLevelUi();
  syncCauseFormMode();
}

function renderUsers() {
  const body = $('#usersBody');
  if (!body) return;
  const canEdit = state.isAdmin;
  body.innerHTML = '';
  state.users.forEach((item) => {
    const roleLabel = (item.roles || []).map((role) => ROLE_PT[role] || role).join(', ') || '-';
    const worksText = (item.works || []).map((work) => work.name).join(', ') || '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name || '-'}</td>
      <td>${item.company || '-'}</td>
      <td>${item.email || '-'}</td>
      <td>${roleLabel}</td>
      <td>${worksText}</td>
      <td>
        ${canEdit ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-user-edit="${item.id}">✎</button></div>` : '-'}
      </td>
    `;
    body.appendChild(tr);
  });
}

function resetUserForm() {
  state.editingUserId = null;
  state.editingUserWorkIds = [];
}

function renderUserModalWorksList(selectedIds = []) {
  const container = $('#userModalWorksList');
  if (!container) return;
  const selected = new Set((selectedIds || []).map((id) => Number(id)));
  container.innerHTML = '';
  state.availableWorks
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .forEach((work) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${work.id}" ${selected.has(Number(work.id)) ? 'checked' : ''} /> ${escapeHtml(work.name)} (${escapeHtml(work.cep || '-')})`;
      container.appendChild(label);
    });
}

function selectedUserModalWorkIds() {
  return $$('#userModalWorksList input[type="checkbox"]:checked')
    .map((input) => Number(input.value))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function openUserModal(options = {}) {
  const modal = $('#userModal');
  if (!modal) return;
  const editingUser = options.user || null;
  resetUserForm();
  $('#userModalError')?.classList.add('hidden');
  if (editingUser) {
    state.editingUserId = editingUser.id;
    state.editingUserWorkIds = (editingUser.works || []).map((work) => Number(work.id));
    $('#userModalTitle').textContent = 'Editar Usuário';
    $('#userModalName').value = editingUser.name || '';
    $('#userModalCompany').value = editingUser.company || '';
    $('#userModalEmail').value = editingUser.email || '';
    $('#userModalPassword').value = '';
    $('#userModalPassword').required = false;
    $('#userModalRole').value = (editingUser.roles || [])[0] || '';
    renderUserModalWorksList(state.editingUserWorkIds);
  } else {
    $('#userModalTitle').textContent = 'Cadastrar Usuário';
    $('#userModalForm').reset();
    $('#userModalPassword').required = true;
    renderUserModalWorksList([]);
  }
  modal.classList.remove('hidden');
}

function closeUserModal() {
  const modal = $('#userModal');
  if (modal) modal.classList.add('hidden');
  $('#userModalError')?.classList.add('hidden');
  $('#userModalForm')?.reset();
  resetUserForm();
}

function selectedPermissionKeysFromForm() {
  return $$('input[data-permission-key]:checked')
    .map((input) => String(input.dataset.permissionKey || '').trim())
    .filter(Boolean);
}

function renderPermissionCatalog(selectedKeys = []) {
  const wrap = $('#permissionCatalogWrap');
  if (!wrap) return;
  const selected = new Set(selectedKeys);
  wrap.innerHTML = '';

  if (!state.permissionCatalog.length) {
    wrap.textContent = 'Catálogo de permissões indisponível.';
    return;
  }

  const modules = new Map();
  state.permissionCatalog.forEach((item) => {
    const moduleName = String(item.module || 'Outros');
    if (!modules.has(moduleName)) modules.set(moduleName, []);
    modules.get(moduleName).push(item);
  });

  const summary = document.createElement('small');
  summary.className = 'subtle';
  summary.textContent = 'Marque as permissões que o perfil poderá executar.';
  wrap.appendChild(summary);

  const modulesGrid = document.createElement('div');
  modulesGrid.className = 'permission-modules-grid';
  [...modules.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .forEach(([moduleName, permissions]) => {
      const card = document.createElement('section');
      card.className = 'permission-module';

      const title = document.createElement('h4');
      title.textContent = moduleName;
      card.appendChild(title);

      permissions
        .slice()
        .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR'))
        .forEach((permission) => {
          const label = document.createElement('label');
          label.className = 'permission-check';
          label.innerHTML = `
            <input type="checkbox" data-permission-key="${escapeHtml(permission.key)}" ${selected.has(permission.key) ? 'checked' : ''} />
            <span>
              <strong>${escapeHtml(permission.label || permission.key)}</strong><br />
              <small>${escapeHtml(permission.description || '')}</small>
            </span>
          `;
          card.appendChild(label);
        });

      modulesGrid.appendChild(card);
    });
  wrap.appendChild(modulesGrid);
}

function renderPermissionProfiles() {
  const body = $('#permissionProfilesBody');
  if (!body) return;
  const canEdit = hasAnyRole(ADMIN_ONLY_ROLES);
  body.innerHTML = '';

  state.permissionProfiles
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .forEach((profile) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(profile.name || '-')}</td>
        <td>${escapeHtml(ROLE_PT[profile.baseRole] || profile.baseRole || '-')}</td>
        <td>${escapeHtml(profile.description || '-')}</td>
        <td>${Array.isArray(profile.permissionKeys) ? profile.permissionKeys.length : 0}</td>
        <td>${profile.isSystem ? 'Sistema' : 'Customizado'}</td>
        <td>
          ${canEdit ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-permission-profile-edit="${profile.id}">✎</button>${profile.isSystem ? '' : `<button type="button" class="icon-btn delete" data-permission-profile-delete="${profile.id}">X</button>`}</div>` : '-'}
        </td>
      `;
      body.appendChild(tr);
    });

  syncPermissionProfileFormMode();
}

function syncPermissionProfileFormMode() {
  const editing = Boolean(state.editingPermissionProfileId);
  const submit = $('#permissionProfileSubmitBtn');
  const cancelBtn = $('#permissionProfileCancelEditBtn');
  if (submit) submit.textContent = editing ? 'Salvar perfil' : 'Cadastrar perfil';
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !editing);
}

function resetPermissionProfileForm() {
  state.editingPermissionProfileId = null;
  const form = $('#permissionProfileForm');
  if (form) form.reset();
  renderPermissionCatalog([]);
  syncPermissionProfileFormMode();
}

function renderWorksCatalog() {
  const body = $('#worksBody');
  const canDelete = hasAnyRole(ADMIN_ONLY_ROLES);
  const canEdit = hasAnyRole(ADMIN_ONLY_ROLES);
  if (!body) return;
  body.innerHTML = '';
  state.availableWorks.forEach((work) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${work.name}</td>
      <td>${work.cep || '-'}</td>
      <td>${work.address || '-'}</td>
      <td>${formatDate(work.startDate)}</td>
      <td>
        ${canDelete ? `<div class="actions-inline">${canEdit ? `<button type="button" class="icon-btn edit" data-work-edit="${work.id}">✎</button>` : ''}<button type="button" class="icon-btn delete" data-work-delete="${work.id}">X</button></div>` : '-'}
      </td>
    `;
    body.appendChild(tr);
  });
}

function resetWorkForm() {
  state.editingWorkId = null;
  const form = $('#cadastroWorkForm');
  if (form) form.reset();
  if ($('#cadastroWorkPpcTargetPct')) $('#cadastroWorkPpcTargetPct').value = '80';
}

function parseWorkAddressParts(addressText) {
  const text = String(addressText || '').trim();
  if (!text) {
    return {
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      complement: '',
    };
  }
  const pattern = /^(.*?),\s*(.*?)\s*-\s*(.*?),\s*(.*?)\/([A-Za-z]{2})(?:\s*\((.*?)\))?$/;
  const match = pattern.exec(text);
  if (!match) {
    return {
      street: text,
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      complement: '',
    };
  }
  return {
    street: String(match[1] || '').trim(),
    number: String(match[2] || '').trim(),
    neighborhood: String(match[3] || '').trim(),
    city: String(match[4] || '').trim(),
    state: String(match[5] || '').trim(),
    complement: String(match[6] || '').trim(),
  };
}

function openWorkValidationModal() {
  $('#workValidationModal')?.classList.remove('hidden');
}

function closeWorkValidationModal() {
  $('#workValidationModal')?.classList.add('hidden');
}

function openWorkModal(editing = false) {
  const title = $('#workModalTitle');
  const submit = $('#cadastroWorkSubmitBtn');
  if (title) title.textContent = editing ? 'Editar Obra' : 'Cadastrar Obra';
  if (submit) submit.textContent = editing ? 'Salvar Obra' : 'Salvar Obra';
  $('#workModal')?.classList.remove('hidden');
}

function closeWorkModal() {
  $('#workModal')?.classList.add('hidden');
  resetWorkForm();
}

function buildCompanyAddressFromFields(fields) {
  const street = String(fields.street || '').trim();
  const number = String(fields.number || '').trim();
  const complement = String(fields.complement || '').trim();
  const neighborhood = String(fields.neighborhood || '').trim();
  const city = String(fields.city || '').trim();
  const stateUf = String(fields.stateUf || '').trim();
  const cep = String(fields.cep || '').trim();

  const streetPart = [street, number].filter(Boolean).join(', ');
  const complementPart = complement ? `, ${complement}` : '';
  const neighborhoodPart = neighborhood ? ` - ${neighborhood}` : '';
  const cityStatePart = [city, stateUf].filter(Boolean).join('/');
  const cityStateSuffix = cityStatePart ? ` - ${cityStatePart}` : '';
  const cepSuffix = cep ? ` - CEP ${cep}` : '';

  return `${streetPart}${complementPart}${neighborhoodPart}${cityStateSuffix}${cepSuffix}`.trim();
}

function setCompanyLogoPreview(src) {
  const previewEl = $('#companyLogoPreview');
  if (!previewEl) return;
  const value = String(src || '').trim();
  if (value && value.startsWith('data:image/')) {
    previewEl.src = value;
    previewEl.classList.remove('hidden');
    return;
  }
  previewEl.removeAttribute('src');
  previewEl.classList.add('hidden');
}

function renderCompanyHeaderPreview() {
  const previewEl = $('#companyHeaderPreview');
  if (!previewEl) return;
  const currentLogo = $('#companyLogoPreview')?.getAttribute('src') || String(state.appConfig?.logoPath || '').trim();
  const companyName = $('#companyName')?.value?.trim() || state.appConfig?.companyName || 'Nome da construtora';
  const companyCnpj = $('#companyCnpj')?.value?.trim() || state.appConfig?.companyCnpj || 'CNPJ não informado';
  const companySite = $('#companySite')?.value?.trim() || state.appConfig?.companySite || 'Site não informado';
  const companyAddress = buildCompanyAddressFromFields({
    street: $('#companyStreet')?.value?.trim() || state.appConfig?.companyStreet || '',
    number: $('#companyNumber')?.value?.trim() || state.appConfig?.companyNumber || '',
    complement: $('#companyComplement')?.value?.trim() || state.appConfig?.companyComplement || '',
    neighborhood: $('#companyNeighborhood')?.value?.trim() || state.appConfig?.companyNeighborhood || '',
    city: $('#companyCity')?.value?.trim() || state.appConfig?.companyCity || '',
    stateUf: $('#companyState')?.value?.trim() || state.appConfig?.companyState || '',
    cep: $('#companyCep')?.value?.trim() || state.appConfig?.companyCep || '',
  }) || 'Endereço da construtora';

  previewEl.innerHTML = `
    <div class="company-header-preview-card">
      <div class="company-header-preview-logo">
        ${currentLogo ? `<img src="${escapeHtml(currentLogo)}" alt="Logo da construtora" />` : '<div class="company-header-preview-fallback">PPC</div>'}
      </div>
      <div class="company-header-preview-copy">
        <strong>${escapeHtml(companyName)}</strong>
        <small>${escapeHtml(companyCnpj)}</small>
        <small>${escapeHtml(companyAddress)}</small>
        <small>${escapeHtml(companySite)}</small>
      </div>
    </div>
  `;
}

function renderCompanyForm() {
  const cfg = state.appConfig || {};
  const nameEl = $('#companyName');
  const cnpjEl = $('#companyCnpj');
  const cepEl = $('#companyCep');
  const streetEl = $('#companyStreet');
  const neighborhoodEl = $('#companyNeighborhood');
  const cityEl = $('#companyCity');
  const stateEl = $('#companyState');
  const numberEl = $('#companyNumber');
  const complementEl = $('#companyComplement');
  const siteEl = $('#companySite');
  const logoEl = $('#companyLogo');
  const logoInfoEl = $('#companyLogoInfo');
  if (
    !nameEl
    || !cnpjEl
    || !cepEl
    || !streetEl
    || !neighborhoodEl
    || !cityEl
    || !stateEl
    || !numberEl
    || !complementEl
    || !siteEl
    || !logoEl
    || !logoInfoEl
  ) return;

  nameEl.value = cfg.companyName || '';
  cnpjEl.value = cfg.companyCnpj || '';
  cepEl.value = cfg.companyCep || '';
  streetEl.value = cfg.companyStreet || '';
  neighborhoodEl.value = cfg.companyNeighborhood || '';
  cityEl.value = cfg.companyCity || '';
  stateEl.value = cfg.companyState || '';
  numberEl.value = cfg.companyNumber || '';
  complementEl.value = cfg.companyComplement || '';
  siteEl.value = cfg.companySite || '';
  logoEl.value = '';
  logoInfoEl.textContent = cfg.logoPath ? 'Logo atual: imagem carregada.' : 'Logo atual: não informado.';
  setCompanyLogoPreview(cfg.logoPath || '');
  renderCompanyHeaderPreview();
}

async function loadAppConfig() {
  try {
    state.appConfig = await api('/app-config');
  } catch {
    state.appConfig = null;
  }
  renderCompanyForm();
}

function closeCompanySavedModal() {
  const modal = $('#companySavedModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openCompanySavedModal(message = 'Cadastro Salvo') {
  const modal = $('#companySavedModal');
  const messageEl = $('#companySavedMessage');
  if (!modal || !messageEl) return;
  messageEl.textContent = message;
  modal.classList.remove('hidden');
}

function closeObraDeadlineSavedModal() {
  const modal = $('#obraDeadlineSavedModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openObraDeadlineSavedModal() {
  const modal = $('#obraDeadlineSavedModal');
  if (!modal) return;
  modal.classList.remove('hidden');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

function handleCompanyLogoSelection() {
  const input = $('#companyLogo');
  const logoInfoEl = $('#companyLogoInfo');
  if (!input || !logoInfoEl) return;
  const file = input.files && input.files[0];
  if (!file) {
    logoInfoEl.textContent = state.appConfig?.logoPath ? 'Logo atual: imagem carregada.' : 'Logo atual: não informado.';
    setCompanyLogoPreview(state.appConfig?.logoPath || '');
    renderCompanyHeaderPreview();
    return;
  }
  if (!String(file.type || '').toLowerCase().startsWith('image/')) {
    input.value = '';
    logoInfoEl.textContent = 'Arquivo inválido. Selecione uma imagem.';
    setCompanyLogoPreview(state.appConfig?.logoPath || '');
    renderCompanyHeaderPreview();
    return;
  }
  logoInfoEl.textContent = `Logo selecionada: ${file.name}`;
  readFileAsDataUrl(file)
    .then((dataUrl) => {
      setCompanyLogoPreview(dataUrl);
      renderCompanyHeaderPreview();
    })
    .catch(() => {
      logoInfoEl.textContent = 'Falha ao carregar miniatura do logo.';
      setCompanyLogoPreview(state.appConfig?.logoPath || '');
      renderCompanyHeaderPreview();
    });
}

function renderLaborTypes() {
  const contractorFunctionSelect = $('#contractorFunction');
  const body = $('#laborTypesBody');
  const taskGroupLaborType = $('#taskGroupItemLaborType');
  const obraTaskGroupLaborType = $('#obraTaskGroupItemLaborType');
  const canEdit = hasAnyRole(EDIT_ROLES);
  const previousContractorFunction = contractorFunctionSelect.value;
  const previousTaskGroupLaborType = taskGroupLaborType.value;
  const previousObraTaskGroupLaborType = obraTaskGroupLaborType.value;
  contractorFunctionSelect.innerHTML = '<option value="">Tipo de mão de obra</option>';
  body.innerHTML = '';
  taskGroupLaborType.innerHTML = '<option value="">Tipo de mão de obra</option>';
  obraTaskGroupLaborType.innerHTML = '<option value="">Tipo de mão de obra</option>';
  state.contractorFunctions.forEach((item) => {
    const contractorOption = document.createElement('option');
    contractorOption.value = item.name;
    contractorOption.textContent = item.name;
    contractorFunctionSelect.appendChild(contractorOption);
    const optionSelect = document.createElement('option');
    optionSelect.value = item.name;
    optionSelect.textContent = item.name;
    taskGroupLaborType.appendChild(optionSelect);
    obraTaskGroupLaborType.appendChild(optionSelect.cloneNode(true));

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>
        ${canEdit ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-labor-edit="${item.id}">✎</button><button type="button" class="icon-btn delete" data-labor-delete="${item.id}">X</button></div>` : '-'}
      </td>
    `;
    body.appendChild(tr);
  });
  if (!state.contractorFunctions.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="2">Nenhum tipo de mão de obra cadastrado.</td>';
    body.appendChild(tr);
  }
  if (previousContractorFunction && [...contractorFunctionSelect.options].some((option) => option.value === previousContractorFunction)) {
    contractorFunctionSelect.value = previousContractorFunction;
  }
  if (previousTaskGroupLaborType && [...taskGroupLaborType.options].some((option) => option.value === previousTaskGroupLaborType)) {
    taskGroupLaborType.value = previousTaskGroupLaborType;
  }
  if (previousObraTaskGroupLaborType && [...obraTaskGroupLaborType.options].some((option) => option.value === previousObraTaskGroupLaborType)) {
    obraTaskGroupLaborType.value = previousObraTaskGroupLaborType;
  }

  syncLaborTypeFormMode();
}

function renderTaskGroups() {
  const select = $('#taskGroupSelect');
  const body = $('#taskGroupItemsBody');
  const previousSelected = Number(select.value) || null;
  const canEdit = hasAnyRole(EDIT_ROLES);
  const isGlobalContext = state.appMode === 'cadastros';
  select.innerHTML = '<option value="">Selecione o grupo</option>';
  body.innerHTML = '';

  state.taskGroups.forEach((group) => {
    const editableGroup = isGlobalContext ? group.workId === null : Number(group.workId) === Number(state.selectedWorkId);
    if (editableGroup) {
      const option = document.createElement('option');
      option.value = String(group.id);
      option.textContent = group.name;
      select.appendChild(option);
    }

    const groupRow = document.createElement('tr');
    groupRow.className = 'tree-level-1';
    groupRow.innerHTML = `
      <td>1</td>
      <td>${group.name}</td>
      <td>-</td>
      <td>
        ${canEdit && editableGroup ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-group-edit="${group.id}">✎</button><button type="button" class="icon-btn delete" data-group-delete="${group.id}">X</button></div>` : '-'}
      </td>
    `;
    body.appendChild(groupRow);

    (group.items || [])
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .forEach((item) => {
        const tr = document.createElement('tr');
        tr.className = 'tree-level-2';
        tr.innerHTML = `
          <td>2</td>
          <td>${item.description}</td>
          <td>${item.laborType || '-'}</td>
          <td>
            ${canEdit && editableGroup ? `<div class="actions-inline"><button type="button" class="icon-btn edit" data-group-item-edit="${item.id}">✎</button><button type="button" class="icon-btn delete" data-group-item-delete="${item.id}">X</button></div>` : '-'}
          </td>
        `;
        body.appendChild(tr);
      });
  });

  const firstSelectable = state.taskGroups.find((group) => Number(group.workId) === Number(state.selectedWorkId));
  const firstGlobalSelectable = state.taskGroups.find((group) => group.workId === null);
  const fallback = isGlobalContext ? firstGlobalSelectable : firstSelectable;
  const selected = previousSelected || (fallback?.id || null);
  if (selected) select.value = String(selected);
  syncTaskGroupFormMode();
  syncTaskGroupItemFormMode();
}

function syncTaskGroupFormMode() {
  const editing = Boolean(state.editingTaskGroupId);
  $('#taskGroupSubmitBtn').textContent = editing ? 'Salvar grupo' : 'Cadastrar grupo';
  $('#taskGroupCancelEditBtn').classList.toggle('hidden', !editing);
}

function resetTaskGroupForm() {
  state.editingTaskGroupId = null;
  $('#taskGroupForm').reset();
  syncTaskGroupFormMode();
}

function syncTaskGroupItemFormMode() {
  const editing = Boolean(state.editingTaskGroupItemId);
  $('#taskGroupItemSubmitBtn').textContent = editing ? 'Salvar tarefa do grupo' : 'Adicionar tarefa no grupo';
  $('#taskGroupItemCancelEditBtn').classList.toggle('hidden', !editing);
}

function resetTaskGroupItemForm() {
  state.editingTaskGroupItemId = null;
  $('#taskGroupItemForm').reset();
  syncTaskGroupItemFormMode();
}

function syncLaborTypeFormMode() {
  const editing = Boolean(state.editingLaborTypeId);
  $('#contractorFunctionSubmitBtn').textContent = editing ? 'Salvar tipo' : 'Cadastrar tipo';
  $('#contractorFunctionCancelEditBtn').classList.toggle('hidden', !editing);
}

function resetLaborTypeForm() {
  state.editingLaborTypeId = null;
  $('#contractorFunctionForm').reset();
  syncLaborTypeFormMode();
}

function updateWeekPeriodInfo() {
  const week = activeWeek();
  if (!week) {
    $('#weekPeriodInfo').textContent = 'A semana é calculada automaticamente a partir da data de início da obra (segunda a sábado).';
    return;
  }
  $('#weekPeriodInfo').textContent = `Período calculado: ${formatDate(week.startDate)} até ${formatDate(week.endDate)}.`;
}

function renderWeeks() {
  const select = $('#weekSelect');
  select.innerHTML = '';
  state.weeks.forEach((week) => {
    const option = document.createElement('option');
    option.value = String(week.id);
    option.textContent = `Semana ${week.weekNumber} (${weekStatusPt(week.planningStatus)}/${weekStatusPt(week.feedbackStatus)})`;
    select.appendChild(option);
  });

  if (state.weeks.length > 0) {
    if (!state.selectedWeekId || !state.weeks.some((w) => w.id === state.selectedWeekId)) {
      state.selectedWeekId = state.weeks[state.weeks.length - 1].id;
    }
    select.value = String(state.selectedWeekId);
  } else {
    state.selectedWeekId = null;
  }

  updateWeekPeriodInfo();
  refreshTaskDayOptions();
  syncWeekControlButtons();
  const feedbackWeekInput = $('#feedbackWeekNumber');
  if (feedbackWeekInput && !feedbackWeekInput.value) {
    const suggestedFeedback = suggestedFeedbackWeekNumberForCurrentWork();
    if (suggestedFeedback) feedbackWeekInput.value = String(suggestedFeedback);
  }
}

function planningHolidayWeekdays(week = planningWeekContext()) {
  const holidays = holidayDateKeySet();
  if (!holidays.size) return new Set();
  const days = weekCalendarDays(week);
  const set = new Set();
  days.forEach((day) => {
    const key = dateKeyLocal(day.dayDate);
    if (key && holidays.has(key)) set.add(String(day.weekday || '').toUpperCase());
  });
  return set;
}

function applyPlanningHolidayHighlights() {
  const weekdayColumnsByTable = {
    '.plan-table': {
      MONDAY: 9,
      TUESDAY: 10,
      WEDNESDAY: 11,
      THURSDAY: 12,
      FRIDAY: 13,
      SATURDAY: 14,
    },
    '.feedback-table': {
      MONDAY: 10,
      TUESDAY: 11,
      WEDNESDAY: 12,
      THURSDAY: 13,
      FRIDAY: 14,
      SATURDAY: 15,
    },
  };
  const planningHolidayWeekdaysSet = planningHolidayWeekdays(planningWeekContext());
  const feedbackWeek = feedbackWeekSelected() || virtualWeekByNumber(feedbackWeekNumberField()) || planningWeekContext();
  const feedbackHolidayWeekdaysSet = planningHolidayWeekdays(feedbackWeek);
  const markTableHolidayColumns = (tableSelector, columnClass, weekdayColumns) => {
    const table = document.querySelector(tableSelector);
    if (!table) return;
    table.querySelectorAll(`.${columnClass}`).forEach((cell) => cell.classList.remove(columnClass));
    Object.entries(weekdayColumns).forEach(([weekday, column]) => {
      const holidayWeekdays = tableSelector === '.feedback-table'
        ? feedbackHolidayWeekdaysSet
        : planningHolidayWeekdaysSet;
      if (!holidayWeekdays.has(weekday)) return;
      const header = table.querySelector(`thead tr th:nth-child(${column})`);
      if (header) header.classList.add(columnClass);
      table.querySelectorAll(`tbody tr td:nth-child(${column})`).forEach((cell) => {
        cell.classList.add(columnClass);
      });
    });
  };

  markTableHolidayColumns('.plan-table', 'plan-day-holiday', weekdayColumnsByTable['.plan-table']);
  markTableHolidayColumns('.feedback-table', 'feedback-day-holiday', weekdayColumnsByTable['.feedback-table']);
}

function renderWeather() {
  const strip = $('#weatherStrip');
  const inlineStrip = $('#planningWeatherInlineStrip');
  const titleEl = $('#planningWeatherTitle');
  const rows = weekDisplayWeatherDaysWithSunday(planningWeekContext());
  if (strip) strip.innerHTML = '';
  if (inlineStrip) inlineStrip.innerHTML = '';
  if (titleEl) {
    titleEl.textContent = 'Previsão do tempo (domingo a sábado)';
  }
  if (!rows.length) {
    if (strip) strip.innerHTML = '<p>Sem previsão para a semana selecionada.</p>';
    if (inlineStrip) inlineStrip.innerHTML = '<div class="weather-inline-empty">Sem previsão para a semana selecionada.</div>';
    applyPlanningHolidayHighlights();
    renderWeatherMiniThumb();
    renderPpcMeetingWeatherMini();
    return;
  }

  rows.forEach((day) => {
    const isHoliday = isHolidayDate(day.dayDate);
    if (strip) {
      const card = document.createElement('div');
      card.className = `weather-card${isHoliday ? ' is-holiday' : ''}`;
      card.innerHTML = `
        <strong>${PT_WEEKDAY[day.weekday] || day.weekday}</strong>
        <small>${formatDate(day.dayDate)}</small>
        <div>${weatherEmoji(day.icon)} ${weatherPt(day.icon)}</div>
        <small>Mín ${day.tempMinC ?? '-'}°C / Máx ${day.tempMaxC ?? '-'}°C</small>
        <small>${formatRainProbabilityInfo(day.precipitationProbabilityPct)}</small>
        <small>${formatRainInfo(day.precipitationMm)}</small>
        ${isHoliday ? '<small class="weather-holiday-tag">Feriado</small>' : ''}
      `;
      strip.appendChild(card);
    }
    if (inlineStrip) {
      const item = document.createElement('div');
      item.className = `weather-inline-item${isHoliday ? ' is-holiday' : ''}`;
      item.innerHTML = `
        <strong>${PT_WEEKDAY[day.weekday] || day.weekday}</strong>
        <small>${weatherEmoji(day.icon)} ${day.tempMinC ?? '-'}°/${day.tempMaxC ?? '-'}°</small>
        <small>${formatRainProbabilityInfo(day.precipitationProbabilityPct)}</small>
        <small>${formatRainInfo(day.precipitationMm)}</small>
      `;
      inlineStrip.appendChild(item);
    }
  });
  const inlineWrap = $('#planningWeatherInline');
  if (inlineWrap) {
    const stickyHeight = Math.max(58, Math.ceil(inlineWrap.offsetHeight || 58));
    document.documentElement.style.setProperty('--planning-weather-sticky-height', `${stickyHeight}px`);
  }
  applyPlanningHolidayHighlights();
  renderWeatherMiniThumb();
  renderPpcMeetingWeatherMini();
}

function renderWeatherMiniThumb() {
  const mini = $('#weatherMiniThumb');
  if (!mini) return;
  mini.classList.add('hidden');
  mini.innerHTML = '';
}

function ppcMeetingWeekContext() {
  return ppcMeetingWeekSelected() || virtualWeekByNumber(ppcMeetingWeekNumberField()) || planningWeekContext();
}

function renderPpcMeetingWeatherMini() {
  const strip = $('#ppcMeetingWeatherStrip');
  if (!strip) return;
  strip.innerHTML = '';
  const rows = weekDisplayWeatherDaysWithSunday(ppcMeetingWeekContext());
  if (!rows.length) {
    strip.innerHTML = '<div class="weather-inline-empty">Sem previsão para a semana selecionada.</div>';
    return;
  }
  rows.forEach((day) => {
    const isHoliday = isHolidayDate(day.dayDate);
    const item = document.createElement('div');
    item.className = `weather-inline-item${isHoliday ? ' is-holiday' : ''}`;
    item.innerHTML = `
      <strong>${PT_WEEKDAY[day.weekday] || day.weekday}</strong>
      <small>${formatDate(day.dayDate)}</small>
      <small>${weatherEmoji(day.icon)} ${day.tempMinC ?? '-'}°/${day.tempMaxC ?? '-'}°</small>
      <small>${formatRainProbabilityInfo(day.precipitationProbabilityPct)}</small>
      <small>${formatRainInfo(day.precipitationMm)}</small>
    `;
    strip.appendChild(item);
  });
}

function renderPpcMeetingMiniCalendar() {
  const host = $('#ppcMeetingMiniCalendar');
  const input = $('#ppcMeetingDate');
  if (!host || !input) return;
  const week = ppcMeetingWeekContext();
  if (!week) {
    host.classList.add('hidden');
    host.innerHTML = '';
    return;
  }
  host.classList.remove('hidden');

  const selectedDate = parseBrDate(input.value) || parseBrDate(formatDateBrLocalFromIso(new Date())) || new Date();
  const baseDate = selectedDate instanceof Date ? selectedDate : new Date();
  if (!state.ppcMeetingCalendarView || Number.isNaN(new Date(state.ppcMeetingCalendarView).getTime())) {
    state.ppcMeetingCalendarView = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1).toISOString();
  }
  const viewDate = new Date(state.ppcMeetingCalendarView);
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);
  const today = new Date();

  const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const dayDate = new Date(gridStart);
    dayDate.setDate(gridStart.getDate() + i);
    days.push(dayDate);
  }

  host.innerHTML = `
    <div class="meeting-mini-calendar__header">
      <div class="meeting-mini-calendar__title">${PT_MONTH_FULL[viewMonth]} ${viewYear}</div>
      <div class="meeting-mini-calendar__nav">
        <button type="button" data-calendar-nav="-1" aria-label="Mês anterior">‹</button>
        <button type="button" data-calendar-nav="1" aria-label="Próximo mês">›</button>
      </div>
    </div>
    <div class="meeting-mini-calendar__weekdays">
      ${weekdayLabels.map((label) => `<span>${label}</span>`).join('')}
    </div>
    <div class="meeting-mini-calendar__grid">
      ${days.map((dayDate) => {
        const isOutside = dayDate.getMonth() !== viewMonth;
        const isToday = dateKeyLocal(dayDate) === dateKeyLocal(today);
        const isSelected = dateKeyLocal(dayDate) === dateKeyLocal(baseDate);
        const cls = [
          'meeting-mini-calendar__day',
          isOutside ? 'is-outside' : '',
          isToday ? 'is-today' : '',
          isSelected ? 'is-selected' : '',
        ].filter(Boolean).join(' ');
        return `<button type="button" class="${cls}" data-calendar-date="${formatIsoDateInputFromValue(dayDate)}">${dayDate.getDate()}</button>`;
      }).join('')}
    </div>
  `;

  host.querySelectorAll('[data-calendar-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.getAttribute('data-calendar-nav') || 0);
      const nextView = new Date(viewYear, viewMonth + step, 1);
      state.ppcMeetingCalendarView = nextView.toISOString();
      renderPpcMeetingMiniCalendar();
    });
  });

  host.querySelectorAll('[data-calendar-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const iso = btn.getAttribute('data-calendar-date') || '';
      const picked = iso ? new Date(`${iso}T12:00:00`) : null;
      if (!picked || Number.isNaN(picked.getTime())) return;
      input.value = formatDateBrLocalFromIso(picked);
      state.ppcMeetingCalendarView = new Date(picked.getFullYear(), picked.getMonth(), 1).toISOString();
      renderPpcMeetingMiniCalendar();
    });
  });
}

function setupWeatherMiniThumbObserver() {
  if (state.weatherMiniObserver) return;
  const strip = $('#weatherStrip');
  if (!strip || typeof IntersectionObserver === 'undefined') return;
  state.weatherMiniObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    state.weatherStripVisible = entry?.isIntersecting !== false;
    renderWeatherMiniThumb();
  }, { threshold: 0.05 });
  state.weatherMiniObserver.observe(strip);
}

function weatherMiniStorageKey() {
  return `ppc-weather-mini-pos-${Number(state.selectedWorkId) || 0}`;
}

function loadWeatherMiniThumbPosition() {
  if (state.weatherMiniPosition) return state.weatherMiniPosition;
  try {
    const raw = window.localStorage.getItem(weatherMiniStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Number.isFinite(parsed?.left) && Number.isFinite(parsed?.top)) {
      state.weatherMiniPosition = { left: parsed.left, top: parsed.top };
      return state.weatherMiniPosition;
    }
  } catch {
    // ignora armazenamento corrompido
  }
  return null;
}

function persistWeatherMiniThumbPosition(position) {
  state.weatherMiniPosition = position;
  try {
    window.localStorage.setItem(weatherMiniStorageKey(), JSON.stringify(position));
  } catch {
    // ignora falha de persistência local
  }
}

function applyWeatherMiniThumbPosition() {
  const mini = $('#weatherMiniThumb');
  if (!mini) return;
  const pos = loadWeatherMiniThumbPosition();
  if (pos?.left != null && pos?.top != null) {
    mini.style.left = `${pos.left}px`;
    mini.style.top = `${pos.top}px`;
    mini.style.transform = 'none';
    return;
  }
  mini.style.left = '';
  mini.style.top = '';
  mini.style.transform = '';
}

function setupWeatherMiniThumbDrag() {
  const mini = $('#weatherMiniThumb');
  if (!mini || mini.dataset.dragBound === 'true') return;
  mini.dataset.dragBound = 'true';

  let dragState = null;
  const startDrag = (event) => {
    const handle = event.target.closest('.weather-mini-title');
    if (!handle) return;
    const pointer = 'touches' in event ? event.touches[0] : event;
    const rect = mini.getBoundingClientRect();
    dragState = {
      offsetX: pointer.clientX - rect.left,
      offsetY: pointer.clientY - rect.top,
    };
    mini.style.transform = 'none';
    event.preventDefault();
  };
  const moveDrag = (event) => {
    if (!dragState) return;
    const pointer = 'touches' in event ? event.touches[0] : event;
    const width = mini.offsetWidth || 260;
    const height = mini.offsetHeight || 80;
    const nextLeft = Math.min(
      Math.max(8, pointer.clientX - dragState.offsetX),
      Math.max(8, window.innerWidth - width - 8),
    );
    const nextTop = Math.min(
      Math.max(88, pointer.clientY - dragState.offsetY),
      Math.max(88, window.innerHeight - height - 8),
    );
    mini.style.left = `${nextLeft}px`;
    mini.style.top = `${nextTop}px`;
    persistWeatherMiniThumbPosition({ left: nextLeft, top: nextTop });
    event.preventDefault();
  };
  const endDrag = () => {
    dragState = null;
  };

  mini.addEventListener('mousedown', startDrag);
  mini.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('touchmove', moveDrag, { passive: false });
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchend', endDrag);
}

function taskOriginWeekNumber(task) {
  return task?.originWeek?.weekNumber || '';
}

function normalizeDraftSequenceNumbers() {
  let seq = Math.max(0, ...state.tasks.map((item) => Number(item.sequenceNumber) || 0)) + 1;
  state.sheetDraftRows.forEach((item) => {
    item.sequenceNumber = seq++;
  });
}

function nextSheetSequenceNumber() {
  normalizeDraftSequenceNumbers();
  const existing = state.tasks.map((item) => Number(item.sequenceNumber) || 0);
  const drafts = state.sheetDraftRows.map((item) => Number(item.sequenceNumber) || 0);
  return Math.max(0, ...existing, ...drafts) + 1;
}

function syncSheetRowSequenceNumbers(rows = [...$('#tasksBody').querySelectorAll('tr[data-sheet-row-kind]')]) {
  rows.forEach((row, index) => {
    const nextValue = String(index + 1);
    const seqEl = row.querySelector('.sheet-seq');
    if (seqEl) {
      seqEl.dataset.sequenceValue = nextValue;
      seqEl.textContent = nextValue;
    }
  });
}

function buildPersistedSheetPayloadFromTask(task, sequenceNumberOverride) {
  const level1 = task.locationLevel1 || task.location?.level1 || '';
  const rawLevel2 = task.locationLevel2 || task.location?.level2 || '';
  const level2 = displayLocationLevel2(task.location) === '-' ? '' : rawLevel2;
  const originWeekNumber = task.originWeekNumber || taskOriginWeekNumber(task) || '';
  return {
    sequenceNumber: Number(sequenceNumberOverride) || Number(task.sequenceNumber) || null,
    originWeekNumber: originWeekNumber ? Number(originWeekNumber) || originWeekNumber : null,
    contractorId: Number(task.contractorId || task.contractor?.id) || null,
    supervisor: task.supervisor || task.contractor?.supervisor || null,
    locationLevel1: level1 || null,
    locationLevel2: level2 || null,
    description: String(task.description || '').trim(),
    plannedStart: task.plannedStart ? formatDate(task.plannedStart) : null,
    plannedEnd: task.plannedEnd ? formatDate(task.plannedEnd) : null,
    status: String(task.status || 'PLANNED').toUpperCase(),
    plannedDays: (task.plannedDays || [])
      .map((item) => ({ weekday: String(item?.weekday || '').toUpperCase() }))
      .filter((item) => item.weekday),
  };
}

async function resequencePersistedPlanningTasks() {
  const orderedTasks = [...state.tasks]
    .sort((a, b) => (Number(a.sequenceNumber) || 0) - (Number(b.sequenceNumber) || 0));
  let changed = false;
  for (let index = 0; index < orderedTasks.length; index += 1) {
    const task = orderedTasks[index];
    const nextSequence = index + 1;
    if ((Number(task.sequenceNumber) || 0) === nextSequence) continue;
    await api(planningTaskItemPath(task.id), {
      method: 'PUT',
      body: buildPersistedSheetPayloadFromTask(task, nextSequence),
    });
    changed = true;
  }
  return changed;
}

async function addSheetDraftRows(count) {
  const targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
  if (!targetWeek?.id) {
    setStatus('Selecione uma semana para adicionar linhas.', true);
    return;
  }
  const qty = Math.max(1, Number(count) || 1);
  let seq = nextSheetSequenceNumber();
  const originWeekNumber = targetWeek.weekNumber || numericWeekField() || '';
  for (let i = 0; i < qty; i += 1) {
    state.sheetDraftRows.push({
      draftId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`,
      sequenceNumber: seq++,
      originWeekNumber,
      contractorId: null,
      contractorLaborType: '',
      supervisor: '',
      locationLevel1: '',
      locationLevel2: '',
      description: '',
      plannedStart: '',
      plannedEnd: '',
      status: 'PLANNED',
      plannedDays: [],
    });
  }
  normalizeDraftSequenceNumbers();
  markScreenDirty('planning');
  renderTasks();
  setStatus(`${qty} linha(s) em branco adicionada(s) na planilha.`);
}

function shiftSheetSequenceNumbersAfter(sequenceNumber) {
  const base = Number(sequenceNumber) || 0;
  state.tasks.forEach((item) => {
    const current = Number(item.sequenceNumber) || 0;
    if (current > base) item.sequenceNumber = current + 1;
  });
  state.sheetDraftRows.forEach((item) => {
    const current = Number(item.sequenceNumber) || 0;
    if (current > base) item.sequenceNumber = current + 1;
  });
}

function createDraftFromSheetRow(row) {
  const payload = getSheetRowPayload(row);
  const sourceSequence = Number.parseInt(
    row.querySelector('.sheet-seq')?.dataset.sequenceValue || row.querySelector('.sheet-seq')?.textContent || '',
    10,
  ) || nextSheetSequenceNumber();
  shiftSheetSequenceNumbersAfter(sourceSequence);
  const contractorId = Number(payload.contractorId) || null;
  const contractor = (state.contractors || []).find((item) => Number(item.id) === contractorId) || null;
  state.sheetDraftRows.push({
    draftId: `${Date.now()}-dup-${Math.random().toString(36).slice(2, 8)}`,
    sequenceNumber: sourceSequence + 1,
    originWeekNumber: Number.parseInt((row.querySelector('.sheet-origin-week')?.textContent || '').trim(), 10) || (activeWeek()?.weekNumber || numericWeekField() || ''),
    contractorId,
    contractorLaborType: contractor?.function?.name || contractor?.laborType || '',
    supervisor: payload.supervisor || contractor?.supervisor || '',
    locationLevel1: payload.locationLevel1 || '',
    locationLevel2: payload.locationLevel2 || '',
    description: payload.description || '',
    plannedStart: payload.plannedStart || '',
    plannedEnd: payload.plannedEnd || '',
    status: String(payload.status || 'PLANNED').toUpperCase(),
    plannedDays: Array.isArray(payload.plannedDays) ? payload.plannedDays.map((item) => ({ ...item })) : [],
  });
  markScreenDirty('planning');
  renderTasks();
  setStatus('Linha duplicada na planilha.');
}

function contractorOptionsHtml(selectedId, laborType = '') {
  const selected = selectedId == null ? '' : String(selectedId);
  const filtered = contractorsForLaborType(laborType);
  const options = filtered.map((item) => {
    const value = String(item.id);
    return `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(item.name || contractorDisplay(item))}</option>`;
  }).join('');
  const selectedContractor = state.contractors.find((item) => String(item.id) === selected);
  const selectedMissing = Boolean(selected && selectedContractor && !filtered.some((item) => String(item.id) === selected));
  const selectedFallbackOption = selectedMissing
    ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selectedContractor.name || contractorDisplay(selectedContractor))}</option>`
    : '';
  const placeholder = laborType
    ? (filtered.length ? `Selecione (${laborType})` : `Sem empreiteiro para ${laborType}`)
    : '-';
  return `<option value="">${escapeHtml(placeholder)}</option>${selectedFallbackOption}${options}`;
}

function contractorLaborTypeLabel(contractorId, fallbackLaborType = '') {
  const parsed = Number.parseInt(contractorId || '', 10);
  const contractor = state.contractors.find((item) => Number(item.id) === parsed);
  const laborType = contractor?.laborType || fallbackLaborType || '';
  return laborType ? `(${laborType})` : '(-)';
}

function locationLevel1OptionsHtml(selectedLevel1) {
  const selected = String(selectedLevel1 || '').trim();
  const level1List = zoneLevel1Names();
  const options = level1List.map((level1) => (
    `<option value="${escapeHtml(level1)}"${level1 === selected ? ' selected' : ''}>${escapeHtml(level1)}</option>`
  )).join('');
  const selectedMissing = Boolean(selected && !level1List.includes(selected));
  const selectedFallbackOption = selectedMissing
    ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`
    : '';
  return `<option value="">-</option>${selectedFallbackOption}${options}`;
}

function locationLevel2OptionsHtml(level1, selectedLevel2) {
  const selected = String(selectedLevel2 || '').trim();
  const normalizedL1 = String(level1 || '').trim();
  const level2List = state.locations
    .filter((item) => !isZoneLevel1Row(item) && String(item.level1 || '').trim() === normalizedL1)
    .map((item) => String(item.level2 || '').trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const options = level2List
    .map((level2) => `<option value="${escapeHtml(level2)}"${level2 === selected ? ' selected' : ''}>${escapeHtml(level2)}</option>`)
    .join('');
  const selectedMissing = Boolean(selected && !level2List.includes(selected));
  const selectedFallbackOption = selectedMissing
    ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`
    : '';
  return `<option value="">-</option>${selectedFallbackOption}${options}`;
}

function availableImportGroupsBySource(source) {
  if (source === 'geral') return state.taskGroupTemplates || [];
  return (state.taskGroups || []).filter((group) => Number(group.workId) === Number(state.selectedWorkId));
}

function renderImportGroupSelect() {
  const source = $('#importGroupSource')?.value || 'obra';
  const select = $('#importGroupSelect');
  if (!select) return;
  const previous = Number(select.value) || null;
  select.innerHTML = '<option value="">Selecione o grupo</option>';
  availableImportGroupsBySource(source).forEach((group) => {
    const option = document.createElement('option');
    option.value = String(group.id);
    option.textContent = group.name;
    select.appendChild(option);
  });
  if (previous && [...select.options].some((opt) => Number(opt.value) === previous)) {
    select.value = String(previous);
  }
}

function renderSheetTaskRow(task, canEdit, _canCancel, isDraft = false) {
  const plannedDaySet = new Set((task.plannedDays || []).map((d) => String(d.weekday || '').toUpperCase()));
  const status = taskDisplayStatusCode(task, planningWeekContext(), isDraft);
  const storedStatus = String(task.status || 'PLANNED').toUpperCase();
  const visualStatus = isDraft ? 'RASCUNHO' : status;
  const rowClass = isDraft
    ? 'sheet-row-draft'
    : (status === 'PENDENTE' ? 'sheet-row-pending' : (storedStatus === 'RESERVA' ? 'sheet-row-reserve' : ''));
  const editable = canEdit;
  const disabled = editable ? '' : 'disabled';
  const lockPendingFields = status === 'PENDENTE';
  const pendingLockDisabled = (!editable || lockPendingFields) ? 'disabled' : '';
  const level1 = task.locationLevel1 || task.location?.level1 || '';
  const level2 = isDraft
    ? (task.locationLevel2 || '')
    : (displayLocationLevel2(task.location) === '-' ? '' : (task.location?.level2 || ''));
  const originWeekNumber = task.originWeekNumber || taskOriginWeekNumber(task) || '';
  const originWeekDisplay = `<span class="sheet-origin-week">${escapeHtml(originWeekNumber)}</span>`;
  const sequenceInput = `<span class="sheet-seq" data-sequence-value="${escapeHtml(task.sequenceNumber)}">${escapeHtml(task.sequenceNumber)}</span>`;
  const laborType = task.contractorLaborType || '';
  const selectedContractorId = task.contractorId || task.contractor?.id || '';
  const contractorSelect = `<select class="sheet-contractor" data-labor-type="${escapeHtml(laborType)}" ${disabled}>${contractorOptionsHtml(selectedContractorId, laborType)}</select>`;
  const contractorLaborLine = `<small class="sheet-contractor-labor">${escapeHtml(contractorLaborTypeLabel(selectedContractorId, laborType))}</small>`;
  const supervisorInput = `<input type="hidden" class="sheet-supervisor" value="${escapeHtml(task.supervisor || '')}" />`;
  const location1Select = `<select class="sheet-location1 ${lockPendingFields ? 'sheet-locked-cell' : ''}" ${pendingLockDisabled}>${locationLevel1OptionsHtml(level1)}</select>`;
  const location2Select = `<select class="sheet-location2 ${lockPendingFields ? 'sheet-locked-cell' : ''}" ${pendingLockDisabled}>${locationLevel2OptionsHtml(level1, level2)}</select>`;
  const descriptionInput = `<textarea class="sheet-desc ${lockPendingFields ? 'sheet-locked-cell' : ''}" rows="2" ${pendingLockDisabled}>${escapeHtml(task.description || '')}</textarea>`;
  const plannedStartValue = formatSheetDateMultiline(task.plannedStart);
  const plannedEndValue = formatSheetDateMultiline(task.plannedEnd);
  const plannedStartInput = `<textarea class="sheet-start" rows="2" placeholder="DD/MM/\nAAAA" ${disabled}>${escapeHtml(plannedStartValue)}</textarea>`;
  const plannedEndInput = `<textarea class="sheet-end" rows="2" placeholder="DD/MM/\nAAAA" ${disabled}>${escapeHtml(plannedEndValue)}</textarea>`;
  const dayCells = SHEET_WEEKDAYS.map((weekday) => (
    `<input type="checkbox" class="sheet-day" data-weekday="${weekday}" ${plannedDaySet.has(weekday) ? 'checked' : ''} ${disabled} />`
  ));
  const pendingReserveEditable = status === 'PENDENTE' && storedStatus === 'RESERVA';
  const statusSelect = `<select class="sheet-status" ${disabled}>${sheetStatusOptionsHtml(storedStatus, pendingReserveEditable ? 'reserve-pending' : 'default')}</select>`;
  const statusCell = (editable && status !== 'NAO_PLANEJADA' && (status !== 'PENDENTE' || pendingReserveEditable))
    ? statusSelect
    : `<span class="status-chip status-${status}">${planningStatusLabelFromCode(status)}</span>`;

  const actions = [];
  if (editable) {
    actions.push('<button type="button" class="secondary" data-sheet-duplicate="1">Duplicar</button>');
    if (isDraft) {
      actions.push(`<button type="button" class="secondary" data-sheet-delete-draft="${escapeHtml(task.draftId)}">Excluir</button>`);
    } else {
      const canDelete = Number(task.originWeekId) === Number(task.currentWeekId);
      if (canDelete) actions.push(`<button type="button" class="secondary" data-sheet-delete-task="${task.id}">Excluir</button>`);
      const canCancelCarried = isPrePlanningMode()
        ? (!canDelete && storedStatus !== 'CANCELLED')
        : (!canDelete && status === 'PENDENTE' && storedStatus !== 'RESERVA' && storedStatus !== 'CANCELLED');
      if (canCancelCarried) {
        const cancelAttr = isPrePlanningMode() ? 'data-sheet-cancel-pre-task' : 'data-sheet-cancel-task';
        actions.push(`<button type="button" class="secondary" ${cancelAttr}="${task.id}">Excluir</button>`);
      }
    }
  }
  if (!actions.length) actions.push('-');

  return `
    <tr class="${rowClass}" data-sheet-row-kind="${isDraft ? 'draft' : 'task'}" data-sheet-editable="${editable ? '1' : '0'}" data-sheet-status-base="${escapeHtml(storedStatus)}" data-sheet-status-code="${escapeHtml(visualStatus)}" ${isDraft ? `data-draft-id="${escapeHtml(task.draftId)}"` : `data-task-id="${task.id}"`}>
      <td>${sequenceInput}</td>
      <td>${originWeekDisplay}</td>
      <td><div class="sheet-contractor-cell">${contractorSelect}${contractorLaborLine}${supervisorInput}</div></td>
      <td>${location1Select}</td>
      <td>${location2Select}</td>
      <td>${descriptionInput}</td>
      <td>${plannedStartInput}</td>
      <td>${plannedEndInput}</td>
      <td>${dayCells[0]}</td>
      <td>${dayCells[1]}</td>
      <td>${dayCells[2]}</td>
      <td>${dayCells[3]}</td>
      <td>${dayCells[4]}</td>
      <td>${dayCells[5]}</td>
      <td>${statusCell}</td>
      <td><div class="actions-inline">${actions.join('')}</div></td>
    </tr>
  `;
}

function renderExpectedTasksTable(tasksOverride = null, options = {}) {
  const expectedBody = $('#expectedTasksBody');
  const stateMessage = $('#expectedStateMessage');
  if (!expectedBody) return;
  expectedBody.innerHTML = '';
  const weekContext = expectedWeekContext();
  const tasks = Array.isArray(tasksOverride)
    ? tasksOverride
    : (state.expectedWeekId ? state.expectedTasks : state.tasks);
  const filteredTasks = tasks.filter((task) => expectedTaskFilterMatch(task, weekContext));

  filteredTasks.forEach((task) => {
    const plannedDaySet = new Set((task.plannedDays || []).map((d) => String(d.weekday || '').toUpperCase()));
    const dayCells = SHEET_WEEKDAYS.map((weekday) => (
      `<input type="checkbox" disabled ${plannedDaySet.has(weekday) ? 'checked' : ''} />`
    ));
    const status = planningStatusLabelFromCode(taskDisplayStatusCode(task, weekContext, false));
    const trExpected = document.createElement('tr');
    trExpected.innerHTML = `
      <td>${escapeHtml(task.sequenceNumber)}</td>
      <td>${escapeHtml(task.contractor?.name || '-')}</td>
      <td>${escapeHtml(task.supervisor || '-')}</td>
      <td>${escapeHtml(task.contractor?.function?.name || '-')}</td>
      <td>${escapeHtml(task.location?.level1 || task.locationLevel1 || '-')}</td>
      <td>${escapeHtml(displayLocationLevel2(task.location) === '-' ? '' : (task.location?.level2 || task.locationLevel2 || ''))}</td>
      <td>${escapeHtml(task.description || '-')}</td>
      <td>${formatDate(task.plannedStart)}</td>
      <td>${formatDate(task.plannedEnd)}</td>
      <td>${dayCells[0]}</td>
      <td>${dayCells[1]}</td>
      <td>${dayCells[2]}</td>
      <td>${dayCells[3]}</td>
      <td>${dayCells[4]}</td>
      <td>${dayCells[5]}</td>
      <td>${escapeHtml(status)}</td>
    `;
    expectedBody.appendChild(trExpected);
  });

  if (!expectedBody.children.length) {
    const tr = document.createElement('tr');
    const hasFilter = Boolean(
      Object.values(state.expectedFilters || {}).some((value) => String(value || '').trim().length > 0),
    );
    const message = hasFilter
      ? 'Nenhuma atividade corresponde aos filtros aplicados.'
      : (options.emptyMessage || 'Sem atividades previstas para a semana selecionada.');
    tr.innerHTML = `<td colspan="16">${message}</td>`;
    expectedBody.appendChild(tr);
    if (stateMessage) stateMessage.textContent = message;
    return;
  }

  if (stateMessage) {
    stateMessage.textContent = `${filteredTasks.length} atividade(s) listada(s) para a semana selecionada.`;
  }
}

function expectedWeekSelected() {
  if (state.expectedWeekId) {
    return state.weeks.find((item) => Number(item.id) === Number(state.expectedWeekId)) || null;
  }
  const weekNumber = expectedWeekNumberField();
  if (!weekNumber) return null;
  return state.weeks.find((item) => Number(item.weekNumber) === Number(weekNumber)) || null;
}

function feedbackWeekSelected() {
  const weekNumber = feedbackWeekNumberField();
  if (!weekNumber) return null;
  return state.weeks.find((item) => Number(item.weekNumber) === Number(weekNumber)) || null;
}

function syncFeedbackComparisonPdfButton() {
  const btn = $('#feedbackComparisonPdfBtn');
  if (!btn) return;
  const week = feedbackWeekSelected();
  if (!week) {
    btn.disabled = true;
    btn.textContent = 'Gerar PDF comparativo da semana';
    return;
  }
  const feedbackClosed = String(week.feedbackStatus || '').toUpperCase() === 'CLOSED';
  btn.disabled = !feedbackClosed;
  btn.textContent = `Gerar PDF comparativo da Semana ${week.weekNumber}`;
}

function renderExpectedExportActions(week, tasks) {
  const panel = $('#expectedExportPanel');
  const excelBtn = $('#expectedExportExcelBtn');
  const pdfBox = $('#expectedPdfButtons');
  const emailBtn = $('#expectedSendEmailBtn');
  const emailInfo = $('#expectedEmailInfo');
  if (!panel || !excelBtn || !pdfBox || !emailBtn || !emailInfo) return;

  const isClosed = String(week?.planningStatus || '').toUpperCase() === 'CLOSED';
  panel.classList.toggle('hidden', !isClosed);
  excelBtn.disabled = !isClosed;
  emailBtn.disabled = !isClosed;
  pdfBox.innerHTML = '';
  state.expectedEmailContractors = [];
  emailInfo.textContent = 'Selecione os empreiteiros para envio do PDF de atividades previstas da semana.';

  if (!isClosed) return;

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'secondary';
  allBtn.dataset.expectedPdfAllWeek = String(week.id);
  allBtn.textContent = `Gerar PDF geral da Semana ${week.weekNumber}`;
  pdfBox.appendChild(allBtn);

  const byContractor = new Map();
  (tasks || []).forEach((task) => {
    const contractor = task.contractor || null;
    const id = contractor?.id;
    if (!id) return;
    if (!byContractor.has(id)) byContractor.set(id, contractor);
  });

  [...byContractor.values()]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .forEach((contractor) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secondary';
      btn.dataset.expectedPdfContractorId = String(contractor.id);
      btn.dataset.expectedPdfContractorName = contractor.name || '';
      btn.textContent = `Gerar PDF empreiteiro ${contractor.name || ''}`;
      pdfBox.appendChild(btn);
    });

  state.expectedEmailContractors = [...byContractor.values()]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .map((contractor) => ({
      id: contractor.id,
      name: contractor.name || '-',
      laborType: contractor.laborType || contractor.function?.name || '-',
    }));

  emailBtn.disabled = !state.expectedEmailContractors.length;
  if (!state.expectedEmailContractors.length) {
    emailInfo.textContent = 'Sem empreiteiros com atividades validadas para envio nesta semana.';
  } else {
    emailInfo.textContent = `Empreiteiros disponíveis para envio: ${state.expectedEmailContractors.length}.`;
  }

  if (!pdfBox.children.length) {
    const info = document.createElement('small');
    info.textContent = 'Sem empreiteiros vinculados às atividades desta semana.';
    pdfBox.appendChild(info);
  }
}

function ppcMeetingWeekSelected() {
  if (state.ppcMeetingWeekId) {
    return state.weeks.find((item) => Number(item.id) === Number(state.ppcMeetingWeekId)) || null;
  }
  const weekNumber = ppcMeetingWeekNumberField();
  if (!weekNumber) return null;
  return state.weeks.find((item) => Number(item.weekNumber) === Number(weekNumber)) || null;
}

function ppcMeetingContractorRows(meeting) {
  return Array.isArray(meeting?.attendance)
    ? meeting.attendance.slice().sort((a, b) => String(a.contractorName || '').localeCompare(String(b.contractorName || ''), 'pt-BR'))
    : [];
}

function renderPpcMeetingAddContractorOptions() {
  const select = $('#ppcMeetingAddContractorSelect');
  if (!select) return;
  const currentIds = new Set(
    ppcMeetingContractorRows(state.ppcMeetingData).map((row) => Number(row.contractorId || 0)).filter(Boolean),
  );
  const available = (state.contractors || [])
    .filter((contractor) => !currentIds.has(Number(contractor.id)))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

  select.innerHTML = '<option value="">Selecione um empreiteiro</option>';
  available.forEach((contractor) => {
    const option = document.createElement('option');
    option.value = String(contractor.id);
    option.textContent = contractor.name || '-';
    select.appendChild(option);
  });
  select.disabled = available.length === 0;
}

function addContractorToPpcMeeting() {
  const select = $('#ppcMeetingAddContractorSelect');
  if (!select || !state.ppcMeetingData) return;
  const contractorId = Number.parseInt(select.value || '', 10);
  if (!contractorId) return;
  const contractor = (state.contractors || []).find((item) => Number(item.id) === contractorId);
  if (!contractor) return;
  if (!Array.isArray(state.ppcMeetingData.attendance)) state.ppcMeetingData.attendance = [];
  if (state.ppcMeetingData.attendance.some((row) => Number(row.contractorId) === contractorId)) return;
  state.ppcMeetingData.attendance.push({
    contractorId,
    contractorName: contractor.name || '-',
    laborType: contractor.function?.name || contractor.laborType || '-',
    supervisor: contractor.supervisor || '',
    communicationEmail: contractor.communicationEmail || '',
    phone: contractor.phone || '',
    present: false,
    suggested: false,
    optional: false,
    manual: true,
  });
  renderPpcMeetingTab();
  setStatus(`Empreiteiro ${contractor.name || contractorId} incluído na reunião.`);
}

function removeContractorFromPpcMeeting(contractorId) {
  if (!state.ppcMeetingData || !Array.isArray(state.ppcMeetingData.attendance)) return;
  state.ppcMeetingData.attendance = state.ppcMeetingData.attendance.filter((row) => Number(row.contractorId) !== Number(contractorId));
  renderPpcMeetingTab();
  setStatus('Empreiteiro retirado da reunião.');
}

function renderPpcMeetingTab() {
  const preBody = $('#ppcMeetingPreContractorsBody');
  const attendanceBody = $('#ppcMeetingAttendanceBody');
  const dateInput = $('#ppcMeetingDate');
  const timeInput = $('#ppcMeetingTime');
  const minutesEl = $('#ppcMeetingMinutes');
  const savePreBtn = $('#ppcMeetingSavePreBtn');
  const savePostBtn = $('#ppcMeetingSavePostBtn');
  const closeBtn = $('#ppcMeetingCloseBtn');
  const reopenBtn = $('#ppcMeetingReopenBtn');
  const exportPreMinutesBtn = $('#ppcMeetingPreExportMinutesPdfBtn');
  const exportMinutesBtn = $('#ppcMeetingExportMinutesPdfBtn');
  const sendMinutesBtn = $('#ppcMeetingSendMinutesEmailBtn');
  const exportAllPreBtn = $('#ppcMeetingPreExportAllPdfBtn');
  const addContractorSelect = $('#ppcMeetingAddContractorSelect');
  const addContractorBtn = $('#ppcMeetingAddContractorBtn');
  const closedInfoEl = $('#ppcMeetingClosedInfo');
  const checklistEl = $('#ppcMeetingChecklistBox');
  if (!preBody || !attendanceBody || !dateInput || !timeInput || !minutesEl) return;

  preBody.innerHTML = '';
  attendanceBody.innerHTML = '';
  const meeting = state.ppcMeetingData;
  const week = ppcMeetingWeekSelected();
  if (!week || !meeting) {
    preBody.innerHTML = '<tr><td colspan="4">Selecione uma semana e clique em Atualizar.</td></tr>';
    attendanceBody.innerHTML = '<tr><td colspan="3">Selecione uma semana e clique em Atualizar.</td></tr>';
    dateInput.value = '';
    timeInput.value = '';
    if ($('#ppcMeetingDatePicker')) {
      $('#ppcMeetingDatePicker').value = '';
      $('#ppcMeetingDatePicker').disabled = true;
    }
    minutesEl.value = '';
    if (savePreBtn) savePreBtn.disabled = true;
    if (savePostBtn) savePostBtn.disabled = true;
    if (closeBtn) closeBtn.disabled = true;
    if (reopenBtn) {
      reopenBtn.disabled = true;
      reopenBtn.classList.add('hidden');
    }
    if (exportPreMinutesBtn) exportPreMinutesBtn.disabled = true;
    if (exportMinutesBtn) exportMinutesBtn.disabled = true;
    if (sendMinutesBtn) sendMinutesBtn.disabled = true;
    if (exportAllPreBtn) exportAllPreBtn.disabled = true;
    if (addContractorSelect) addContractorSelect.disabled = true;
    if (addContractorBtn) addContractorBtn.disabled = true;
    if ($('#ppcMeetingWeatherStrip')) {
      $('#ppcMeetingWeatherStrip').innerHTML = '<div class="weather-inline-empty">Sem previsão para a semana selecionada.</div>';
    }
    renderPpcMeetingMiniCalendar();
    if (closedInfoEl) closedInfoEl.textContent = '';
    if (checklistEl) checklistEl.innerHTML = '';
    return;
  }

  const prePlanningClosed = String(week.prePlanningStatus || '').toUpperCase() === 'CLOSED';
  const closed = meeting.isClosed === true;
  const dateSource = meeting.meetingAt || meeting.suggestedMeetingAt || null;
  const datePicker = $('#ppcMeetingDatePicker');
  dateInput.value = formatDateBrLocalFromIso(dateSource);
  timeInput.value = formatTimeLocalFromIso(dateSource);
  if (datePicker) {
    datePicker.value = formatIsoDateInputFromValue(dateSource);
    datePicker.disabled = closed || !prePlanningClosed;
  }
  state.ppcMeetingCalendarView = (() => {
    const parsed = parseBrDate(formatDateBrLocalFromIso(dateSource)) || parseBrDate(dateInput.value);
    const base = parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1).toISOString();
  })();
  minutesEl.value = String(meeting.minutes || '');
  dateInput.disabled = closed || !prePlanningClosed;
  timeInput.disabled = closed || !prePlanningClosed;
  minutesEl.disabled = closed || !prePlanningClosed;

  if (savePreBtn) savePreBtn.disabled = closed || !prePlanningClosed;
  if (savePostBtn) savePostBtn.disabled = closed || !prePlanningClosed;
  if (closeBtn) closeBtn.disabled = closed || !prePlanningClosed;
  if (closeBtn) closeBtn.classList.toggle('hidden', closed || !hasAnyRole(EDIT_ROLES));
  if (reopenBtn) {
    const canReopen = hasAnyRole(ADMIN_ONLY_ROLES) && closed;
    reopenBtn.classList.toggle('hidden', !canReopen);
    reopenBtn.disabled = !canReopen;
  }
  if (exportPreMinutesBtn) exportPreMinutesBtn.disabled = !prePlanningClosed;
  if (exportMinutesBtn) exportMinutesBtn.disabled = !closed;
  if (sendMinutesBtn) sendMinutesBtn.disabled = !closed;
  if (exportAllPreBtn) exportAllPreBtn.disabled = !prePlanningClosed;
  if (addContractorBtn) addContractorBtn.disabled = closed || !prePlanningClosed;
  if (closedInfoEl) {
    if (!prePlanningClosed) {
      closedInfoEl.className = 'ppc-meeting-status ppc-meeting-status--blocked';
      closedInfoEl.textContent = 'Você precisa fechar a pré-programação primeiro';
    } else if (closed) {
      const closedAt = formatDateTimeBr(meeting.closedAt);
      const closedBy = meeting.closedByName ? ` por ${meeting.closedByName}` : '';
      closedInfoEl.className = 'ppc-meeting-status ppc-meeting-status--closed';
      closedInfoEl.textContent = `Reunião fechada em ${closedAt}${closedBy}.`;
    } else {
      closedInfoEl.className = 'ppc-meeting-status ppc-meeting-status--open';
      closedInfoEl.textContent = 'Reunião ainda não fechada.';
    }
  }

  const rows = ppcMeetingContractorRows(meeting);
  renderPpcMeetingAddContractorOptions();
  if (addContractorSelect) {
    addContractorSelect.disabled = closed || !prePlanningClosed || addContractorSelect.options.length <= 1;
  }
  renderPpcMeetingWeatherMini();
  renderPpcMeetingMiniCalendar();
  if (checklistEl) {
    const dateFilled = Boolean(dateInput.value && timeInput.value);
    checklistEl.innerHTML = `<div class="ppc-checklist-grid">${[
      {
        title: 'Pré-programação',
        helper: prePlanningClosed ? 'Etapa anterior concluída.' : 'Ainda falta fechar a etapa anterior.',
        variant: prePlanningClosed ? 'ok' : 'blocked',
      },
      {
        title: 'Data e hora',
        helper: dateFilled ? 'Reunião agendada para esta semana.' : 'Preencha a data e o horário da reunião.',
        variant: dateFilled ? 'ok' : 'waiting',
      },
      {
        title: 'Empreiteiros ativos',
        helper: rows.length ? `${rows.length} empreiteiro(s) listado(s) para a semana.` : 'Nenhum empreiteiro listado para esta reunião.',
        variant: rows.length ? 'ok' : 'waiting',
      },
      {
        title: 'Fechamento',
        helper: closed ? 'A lista de presença e a ata já foram encerradas.' : 'A reunião ainda está aberta para preenchimento.',
        variant: closed ? 'ok' : 'waiting',
      },
    ].map((item) => `
      <div class="ppc-checklist-item ${item.variant}">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.helper)}</small>
      </div>
    `).join('')}</div>`;
  }

  if (!rows.length) {
    preBody.innerHTML = '<tr><td colspan="4">Sem empreiteiros ativos para esta semana.</td></tr>';
    attendanceBody.innerHTML = '<tr><td colspan="3">Sem empreiteiros ativos para esta semana.</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const trPre = document.createElement('tr');
    trPre.innerHTML = `
      <td>${escapeHtml(row.contractorName || '-')}</td>
      <td>${escapeHtml(row.laborType || '-')}</td>
      <td>${escapeHtml(row.communicationEmail || '-')}</td>
      <td>
        <div class="actions-inline">
          ${row.optional ? '<span class="inline-badge">Reserva</span>' : ''}
          ${row.manual ? '<span class="inline-badge inline-badge--manual">Manual</span>' : ''}
          <button type="button" class="secondary" data-ppc-pre-activity-pdf="${row.contractorId}" data-contractor-name="${escapeHtml(row.contractorName || '')}" ${prePlanningClosed ? '' : 'disabled'}>PDF atividades</button>
          <button type="button" class="secondary" data-ppc-pre-convocation-pdf="${row.contractorId}" data-contractor-name="${escapeHtml(row.contractorName || '')}" ${prePlanningClosed ? '' : 'disabled'}>PDF convocação</button>
          <button type="button" class="secondary" data-ppc-remove-contractor="${row.contractorId}" ${closed || !prePlanningClosed ? 'disabled' : ''}>Retirar</button>
        </div>
      </td>
    `;
    preBody.appendChild(trPre);

    const trAttendance = document.createElement('tr');
    trAttendance.innerHTML = `
      <td>${escapeHtml(row.contractorName || '-')}</td>
      <td>${escapeHtml(row.laborType || '-')}</td>
      <td><input type="checkbox" class="ppc-presence-checkbox" data-contractor-id="${row.contractorId}" ${row.present ? 'checked' : ''} ${(closed || !prePlanningClosed) ? 'disabled' : ''} /></td>
    `;
    attendanceBody.appendChild(trAttendance);
  });

  preBody.querySelectorAll('[data-ppc-remove-contractor]').forEach((button) => {
    button.addEventListener('click', () => {
      removeContractorFromPpcMeeting(Number(button.getAttribute('data-ppc-remove-contractor') || 0));
    });
  });
}

function feedbackDefaultStatusFromTask(task) {
  if (task?.isUnplanned) return 'EXECUTED_UNPLANNED';
  const status = String(task?.status || '').toUpperCase();
  if (status === 'EXECUTED') return 'EXECUTED';
  if (status === 'IN_PROGRESS') return 'STARTED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'NOT_STARTED';
}

function feedbackStatusOptionsHtml(selectedStatus, options = {}) {
  const unplannedOnly = options.unplannedOnly === true;
  const current = String(selectedStatus || '').toUpperCase();
  if (unplannedOnly) {
    return `<option value="EXECUTED_UNPLANNED" ${current === 'EXECUTED_UNPLANNED' ? 'selected' : ''}>Executada / Não planejada</option>`;
  }
  return [
    ['EXECUTED', 'Executada'],
    ['STARTED', 'Iniciada'],
    ['NOT_STARTED', 'Não iniciada'],
    ['CANCELLED', 'Cancelada'],
  ]
    .map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function feedbackCauseGroups() {
  const groups = new Set(
    state.causes
      .filter((cause) => Number(cause.level) === 1 && String(cause.category || '').trim())
      .map((cause) => String(cause.category || '').trim()),
  );
  state.causes
    .filter((cause) => Number(cause.level) === 2 && String(cause.category || '').trim())
    .forEach((cause) => groups.add(String(cause.category || '').trim()));
  return [...groups].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function parseFeedbackCauseDescription(description) {
  const text = String(description || '').trim();
  if (!text) return { category: '', cause: '' };
  if (text.startsWith('L1::')) {
    return { category: text.slice(4).trim(), cause: '' };
  }
  const l2Prefix = text.startsWith('L2C::') ? 'L2C::' : (text.startsWith('L2::') ? 'L2::' : '');
  const body = l2Prefix ? text.slice(l2Prefix.length).trim() : text;
  const splitIdx = body.indexOf('::');
  if (splitIdx < 0) return { category: '', cause: body.trim() };
  return {
    category: body.slice(0, splitIdx).trim(),
    cause: body.slice(splitIdx + 2).trim(),
  };
}

function feedbackCauseItemsByGroup(group) {
  const key = String(group || '').trim();
  if (!key) return [];
  return state.causes
    .filter((cause) => Number(cause.level) === 2 && String(cause.category || '').trim() === key)
    .sort((a, b) => String(a.cause || a.description || '').localeCompare(String(b.cause || b.description || ''), 'pt-BR'));
}

function feedbackCauseGroupOptionsHtml(selectedGroup) {
  const current = String(selectedGroup || '').trim();
  const groups = feedbackCauseGroups();
  const options = ['<option value="">Sem grupo</option>'];
  if (current && !groups.includes(current)) {
    options.push(`<option value="${escapeHtml(current)}" selected>${escapeHtml(current)}</option>`);
  }
  groups.forEach((group) => {
    options.push(`<option value="${escapeHtml(group)}" ${current === group ? 'selected' : ''}>${escapeHtml(group)}</option>`);
  });
  return options.join('');
}

function feedbackCauseOptionsHtml(selectedCauseId, selectedGroup = '', selectedFallbackLabel = '') {
  const selected = Number.parseInt(selectedCauseId, 10);
  const causes = feedbackCauseItemsByGroup(selectedGroup);
  const base = ['<option value="">Sem causa</option>'];
  let foundSelected = false;
  causes.forEach((cause) => {
    const id = Number(cause.id);
    const label = `${cause.cause || cause.description || '-'}`;
    if (selected === id) foundSelected = true;
    base.push(`<option value="${id}" ${selected === id ? 'selected' : ''}>${escapeHtml(label)}</option>`);
  });
  if (Number.isFinite(selected) && selected > 0 && !foundSelected) {
    const fallback = String(selectedFallbackLabel || `Causa ${selected}`).trim();
    base.push(`<option value="${selected}" selected>${escapeHtml(fallback)}</option>`);
  }
  return base.join('');
}

function weekDayMapByWeek(week) {
  return weekDayMap(week);
}

function feedbackNewSelectedDays() {
  const byWeekday = weekDayMapByWeek(activeWeek());
  return $$('input[data-feedback-new-day]:checked').map((input) => ({
    weekday: input.value,
    actualDate: byWeekday.get(input.value)?.dayDate || null,
  }));
}

function syncFeedbackNewDatesFromDayCheckboxes() {
  const byWeekday = weekDayMapByWeek(activeWeek());
  const dates = $$('input[data-feedback-new-day]:checked')
    .map((input) => byWeekday.get(input.value)?.dayDate)
    .filter(Boolean)
    .map((value) => new Date(value));

  if (!dates.length) {
    $('#feedbackNewActualStart').value = '';
    $('#feedbackNewActualEnd').value = '';
    return;
  }

  dates.sort((a, b) => a.getTime() - b.getTime());
  $('#feedbackNewActualStart').value = formatDate(dates[0]);
  $('#feedbackNewActualEnd').value = formatDate(dates[dates.length - 1]);
}

function syncFeedbackNewDayCheckboxesFromDates() {
  const weekDays = weekDisplayWeatherDays(activeWeek());
  if (!weekDays.length) {
    $$('input[data-feedback-new-day]').forEach((input) => { input.checked = false; });
    return;
  }

  let start = parseBrDate($('#feedbackNewActualStart').value.trim());
  let end = parseBrDate($('#feedbackNewActualEnd').value.trim());

  if (start && !end) {
    end = new Date(start);
    $('#feedbackNewActualEnd').value = formatDate(end);
  }
  if (!start && end) {
    start = new Date(end);
    $('#feedbackNewActualStart').value = formatDate(start);
  }
  if (!start || !end) return;
  if (start.getTime() > end.getTime()) {
    const temp = start;
    start = end;
    end = temp;
    $('#feedbackNewActualStart').value = formatDate(start);
    $('#feedbackNewActualEnd').value = formatDate(end);
  }

  $$('input[data-feedback-new-day]').forEach((input) => {
    const row = weekDays.find((item) => String(item.weekday || '').toUpperCase() === input.value);
    if (!row) {
      input.checked = false;
      return;
    }
    const rowDate = new Date(row.dayDate);
    input.checked = rowDate.getTime() >= start.getTime() && rowDate.getTime() <= end.getTime();
  });
}

function feedbackRowSelectedDays(row) {
  const byWeekday = weekDayMapByWeek(activeWeek());
  return [...row.querySelectorAll('.fb-day:checked')].map((input) => ({
    weekday: input.dataset.weekday,
    actualDate: byWeekday.get(input.dataset.weekday)?.dayDate || null,
  }));
}

function feedbackTaskExecutedDaySet(task) {
  const actualSet = new Set(
    (task.plannedDays || [])
      .filter((day) => day.actualDate)
      .map((day) => String(day.weekday || '').toUpperCase()),
  );
  if (actualSet.size) return actualSet;

  // Sem feedback executado, exibe os dias previstos da semana.
  const plannedSet = new Set(
    (task.plannedDays || [])
      .map((day) => String(day.weekday || '').toUpperCase())
      .filter(Boolean),
  );
  if (plannedSet.size) return plannedSet;

  const start = task.actualStart ? new Date(task.actualStart) : null;
  const end = task.actualEnd ? new Date(task.actualEnd) : null;
  if (!start && !end) return plannedSet;

  const weekDays = weekDisplayWeatherDays(activeWeek());
  let rangeStart = start;
  let rangeEnd = end;
  if (rangeStart && !rangeEnd) rangeEnd = new Date(rangeStart);
  if (!rangeStart && rangeEnd) rangeStart = new Date(rangeEnd);
  if (!rangeStart || !rangeEnd) return set;
  if (rangeStart.getTime() > rangeEnd.getTime()) {
    const temp = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = temp;
  }

  weekDays.forEach((day) => {
    const dayDate = new Date(day.dayDate);
    if (dayDate.getTime() >= rangeStart.getTime() && dayDate.getTime() <= rangeEnd.getTime()) {
      plannedSet.add(String(day.weekday || '').toUpperCase());
    }
  });
  return plannedSet;
}

function syncFeedbackRowDatesFromDayCheckboxes(row) {
  const byWeekday = weekDayMapByWeek(activeWeek());
  const startInput = row.querySelector('.fb-actual-start');
  const endInput = row.querySelector('.fb-actual-end');
  if (!startInput || !endInput) return;

  const dates = [...row.querySelectorAll('.fb-day:checked')]
    .map((input) => byWeekday.get(input.dataset.weekday)?.dayDate)
    .filter(Boolean)
    .map((value) => new Date(value));

  if (!dates.length) {
    startInput.value = '';
    endInput.value = '';
    return;
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  startInput.value = formatDate(dates[0]);
  endInput.value = formatDate(dates[dates.length - 1]);
}

function syncFeedbackRowDayCheckboxesFromDates(row) {
  const weekDays = weekDisplayWeatherDays(activeWeek());
  const startInput = row.querySelector('.fb-actual-start');
  const endInput = row.querySelector('.fb-actual-end');
  if (!startInput || !endInput) return;

  let start = parseBrDate(startInput.value.trim());
  let end = parseBrDate(endInput.value.trim());

  if (start && !end) {
    end = new Date(start);
    endInput.value = formatDate(end);
  }
  if (!start && end) {
    start = new Date(end);
    startInput.value = formatDate(start);
  }
  if (!start || !end) return;

  if (start.getTime() > end.getTime()) {
    const temp = start;
    start = end;
    end = temp;
    startInput.value = formatDate(start);
    endInput.value = formatDate(end);
  }

  row.querySelectorAll('.fb-day').forEach((input) => {
    const day = weekDays.find((item) => String(item.weekday || '').toUpperCase() === input.dataset.weekday);
    if (!day) {
      input.checked = false;
      return;
    }
    const dayDate = new Date(day.dayDate);
    input.checked = dayDate.getTime() >= start.getTime() && dayDate.getTime() <= end.getTime();
  });
}

function renderFeedbackNewLocationLevel2Options() {
  const level1 = $('#feedbackNewLocation1').value.trim();
  const level2Select = $('#feedbackNewLocation2');
  const previous = level2Select.value;
  level2Select.innerHTML = '<option value="">Local 2 (opcional)</option>';
  if (!level1) return;

  const level2Rows = state.locations
    .filter((item) => !isZoneLevel1Row(item) && String(item.level1 || '').trim() === level1)
    .map((item) => String(item.level2 || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  [...new Set(level2Rows)].forEach((level2) => {
    const option = document.createElement('option');
    option.value = level2;
    option.textContent = level2;
    level2Select.appendChild(option);
  });
  if (previous && [...level2Select.options].some((option) => option.value === previous)) {
    level2Select.value = previous;
  }
}

function refreshFeedbackRowLocationLevel2Options(row) {
  const level1Select = row.querySelector('.fb-unplanned-location1');
  const level2Select = row.querySelector('.fb-unplanned-location2');
  if (!level1Select || !level2Select) return;
  const level1 = level1Select.value.trim();
  const previous = level2Select.value;
  level2Select.innerHTML = locationLevel2OptionsHtml(level1, previous);
  if (previous && [...level2Select.options].some((option) => option.value === previous)) {
    level2Select.value = previous;
  }
}

function handleFeedbackNewContractorChange() {
  const contractorId = Number($('#feedbackNewContractor').value);
  const contractor = state.contractors.find((item) => Number(item.id) === contractorId);
  $('#feedbackNewSupervisor').value = contractor?.supervisor || '';
}

function renderFeedbackNewTaskForm(canFeedbackEdit) {
  const location1 = $('#feedbackNewLocation1');
  const contractor = $('#feedbackNewContractor');
  if (!location1 || !contractor) return;
  const prevL1 = location1.value;
  const prevContractor = contractor.value;

  location1.innerHTML = '<option value="">Local 1</option>';
  zoneLevel1Names().forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    location1.appendChild(option);
  });
  if (prevL1 && [...location1.options].some((o) => o.value === prevL1)) location1.value = prevL1;
  renderFeedbackNewLocationLevel2Options();

  contractor.innerHTML = '<option value="">Empreiteiro</option>';
  [...state.contractors]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item.id);
      option.textContent = contractorDisplay(item);
      contractor.appendChild(option);
    });
  if (prevContractor && [...contractor.options].some((o) => o.value === prevContractor)) {
    contractor.value = prevContractor;
  }
  handleFeedbackNewContractorChange();

  ['feedbackNewLocation1', 'feedbackNewLocation2', 'feedbackNewContractor', 'feedbackNewTask', 'feedbackNewActualStart', 'feedbackNewActualEnd', 'feedbackAddUnplannedBtn']
    .forEach((id) => {
      const el = $(`#${id}`);
      if (el) el.disabled = !canFeedbackEdit;
    });
  $$('input[data-feedback-new-day]').forEach((input) => { input.disabled = !canFeedbackEdit; });
}

function applyPlanningRowFilters() {
  const weekContext = planningWeekContext();
  const body = $('#tasksBody');
  if (body) {
    const rows = [...body.querySelectorAll('tr[data-sheet-row-kind]')];
    rows.forEach((row) => {
      if (row.dataset.sheetRowKind === 'draft') {
        row.classList.remove('row-filter-hidden');
        return;
      }
      const taskId = Number.parseInt(row.dataset.taskId || '', 10);
      const task = state.tasks.find((item) => Number(item.id) === taskId);
      if (!task) {
        row.classList.remove('row-filter-hidden');
        return;
      }
      row.classList.toggle('row-filter-hidden', !planningTaskFilterMatch(task, weekContext));
    });
  }

  const fbBody = $('#feedbackTasksBody');
  if (fbBody) {
    const rows = [...fbBody.querySelectorAll('tr[data-task-id]')];
    rows.forEach((row) => {
      const taskId = Number.parseInt(row.dataset.taskId || '', 10);
      const task = state.tasks.find((item) => Number(item.id) === taskId);
      const status = String(row.querySelector('.fb-status')?.value || row.dataset.feedbackStatus || '').toUpperCase();
      if (!task) {
        row.classList.remove('row-filter-hidden');
        return;
      }
      row.classList.toggle('row-filter-hidden', !feedbackTaskFilterMatch(task, status, row));
    });
  }
}

function refreshFeedbackRowCauseSelect(row, keepCurrentSelection = true) {
  const groupSelect = row.querySelector('.fb-cause-group');
  const causeSelect = row.querySelector('.fb-cause');
  if (!groupSelect || !causeSelect) return;
  const isReserve = row.dataset.reserve === '1';
  if (isReserve) {
    groupSelect.value = '';
    groupSelect.disabled = true;
    causeSelect.innerHTML = feedbackCauseOptionsHtml(null, '');
    causeSelect.value = '';
    causeSelect.disabled = true;
    return;
  }
  const selectedCause = keepCurrentSelection ? causeSelect.value : '';
  const group = String(groupSelect.value || '').trim();
  causeSelect.innerHTML = feedbackCauseOptionsHtml(selectedCause || null, group);
  if (!group) {
    causeSelect.value = '';
    causeSelect.disabled = true;
    return;
  }
  if (selectedCause && [...causeSelect.options].some((opt) => opt.value === selectedCause)) {
    causeSelect.value = selectedCause;
  }
}

function refreshFeedbackRowExecutionInputs(row, options = {}) {
  const clearWhenBlocked = Boolean(options?.clearWhenBlocked);
  const status = String(row.querySelector('.fb-status')?.value || '').toUpperCase();
  const isReserve = row.dataset.reserve === '1';
  const canFeedbackEdit = !$('#saveFeedbackInlineBtn')?.disabled;
  const executionBlocked = status === 'NOT_STARTED';
  const shouldDisable = !canFeedbackEdit || executionBlocked;
  const reservePending = isReserve && (status === 'NOT_STARTED' || status === 'STARTED');
  row.classList.toggle('feedback-reserve-pending', reservePending);

  row.querySelectorAll('.fb-day').forEach((input) => {
    input.disabled = shouldDisable;
    if (executionBlocked && clearWhenBlocked) input.checked = false;
  });

  const startInput = row.querySelector('.fb-actual-start');
  const endInput = row.querySelector('.fb-actual-end');
  if (startInput) {
    startInput.disabled = shouldDisable;
    if (executionBlocked && clearWhenBlocked) startInput.value = '';
  }
  if (endInput) {
    endInput.disabled = shouldDisable;
    if (executionBlocked && clearWhenBlocked) endInput.value = '';
  }
}

function applyFeedbackCauseLockByStatus(row, keepCurrentSelection = true) {
  const statusSelect = row.querySelector('.fb-status');
  const groupSelect = row.querySelector('.fb-cause-group');
  const causeSelect = row.querySelector('.fb-cause');
  if (!statusSelect || !groupSelect || !causeSelect) return;
  const status = String(statusSelect.value || '').toUpperCase();
  const isReserve = row.dataset.reserve === '1';
  const canFeedbackEdit = !$('#saveFeedbackInlineBtn')?.disabled;
  const shouldLockCause = isReserve || ['EXECUTED', 'EXECUTED_UNPLANNED', 'CANCELLED'].includes(status);

  if (shouldLockCause) {
    groupSelect.value = '';
    groupSelect.disabled = true;
    causeSelect.innerHTML = feedbackCauseOptionsHtml(null, '');
    causeSelect.value = '';
    causeSelect.disabled = true;
    return;
  }

  if (canFeedbackEdit) {
    groupSelect.disabled = false;
  }
  refreshFeedbackRowCauseSelect(row, keepCurrentSelection);
  causeSelect.disabled = isReserve || !String(groupSelect.value || '').trim();
}

function handleFeedbackGridChange(event) {
  const row = event.target.closest('#feedbackTasksBody tr[data-task-id]');
  if (!row) return;
  row.dataset.dirty = '1';
  markScreenDirty('feedback');
  const statusSelect = row.querySelector('.fb-status');
  const groupSelect = row.querySelector('.fb-cause-group');
  const causeSelect = row.querySelector('.fb-cause');
  if (!statusSelect || !groupSelect || !causeSelect) return;
  const isReserve = row.dataset.reserve === '1';

  if (event.target.classList.contains('fb-status')) {
    const status = String(statusSelect.value || '').toUpperCase();
    row.dataset.feedbackStatus = status;
    refreshFeedbackRowExecutionInputs(row, { clearWhenBlocked: true });
    applyFeedbackCauseLockByStatus(row, false);
    applyPlanningRowFilters();
    return;
  }

  if (event.target.classList.contains('fb-cause-group')) {
    refreshFeedbackRowCauseSelect(row, false);
    causeSelect.disabled = isReserve || !String(groupSelect.value || '').trim();
    applyPlanningRowFilters();
    return;
  }

  if (event.target.classList.contains('fb-day')) {
    syncFeedbackRowDatesFromDayCheckboxes(row);
    return;
  }

  if (event.target.classList.contains('fb-actual-start') || event.target.classList.contains('fb-actual-end')) {
    syncFeedbackRowDayCheckboxesFromDates(row);
    return;
  }

  if (event.target.classList.contains('fb-unplanned-location1')) {
    refreshFeedbackRowLocationLevel2Options(row);
    return;
  }

  if (event.target.classList.contains('fb-unplanned-contractor')) {
    const contractorId = Number.parseInt(event.target.value || '', 10);
    const contractor = state.contractors.find((item) => Number(item.id) === contractorId);
    if (contractor && row.dataset.unplanned === '1') {
      row.dataset.unplannedSupervisor = contractor.supervisor || '';
    }
    applyPlanningRowFilters();
    return;
  }

  if (event.target.classList.contains('fb-contractor')) {
    const contractorId = Number.parseInt(event.target.value || '', 10);
    const contractor = state.contractors.find((item) => Number(item.id) === contractorId);
    if (contractor) row.dataset.unplannedSupervisor = contractor.supervisor || '';
    applyPlanningRowFilters();
    return;
  }

  applyPlanningRowFilters();
}

function resetFeedbackNewTaskForm() {
  const form = $('#feedbackNewTaskForm');
  if (!form) return;
  form.reset();
  renderFeedbackNewLocationLevel2Options();
  handleFeedbackNewContractorChange();
}

function captureFeedbackDraftState() {
  const map = new Map();
  [...document.querySelectorAll('#feedbackTasksBody tr[data-task-id]')].forEach((row) => {
    const taskId = Number.parseInt(row.dataset.taskId || '', 10);
    if (!taskId) return;
    const status = String(row.querySelector('.fb-status')?.value || '').toUpperCase();
    const causeGroup = String(row.querySelector('.fb-cause-group')?.value || '').trim();
    const causeId = row.querySelector('.fb-cause')?.value || '';
    const comments = row.querySelector('.fb-comment')?.value || '';
    const contractorId = row.querySelector('.fb-unplanned-contractor')?.value || row.querySelector('.fb-contractor')?.value || '';
    const l1 = row.querySelector('.fb-unplanned-location1')?.value || '';
    const l2 = row.querySelector('.fb-unplanned-location2')?.value || '';
    const desc = row.querySelector('.fb-unplanned-task')?.value || '';
    const days = [...row.querySelectorAll('.fb-day:checked')].map((input) => String(input.dataset.weekday || '').toUpperCase());
    map.set(taskId, {
      status,
      causeGroup,
      causeId,
      comments,
      contractorId,
      locationLevel1: l1,
      locationLevel2: l2,
      description: desc,
      days,
    });
  });
  return map;
}

function restoreFeedbackDraftState(snapshot) {
  if (!(snapshot instanceof Map) || !snapshot.size) return;
  [...document.querySelectorAll('#feedbackTasksBody tr[data-task-id]')].forEach((row) => {
    const taskId = Number.parseInt(row.dataset.taskId || '', 10);
    if (!taskId || !snapshot.has(taskId)) return;
    const saved = snapshot.get(taskId);
    const statusSelect = row.querySelector('.fb-status');
    if (statusSelect && saved.status && [...statusSelect.options].some((o) => o.value === saved.status)) {
      statusSelect.value = saved.status;
      row.dataset.feedbackStatus = saved.status;
    }
    refreshFeedbackRowExecutionInputs(row);
    applyFeedbackCauseLockByStatus(row, true);

    const groupSelect = row.querySelector('.fb-cause-group');
    if (groupSelect) {
      const desiredGroup = String(saved.causeGroup || '').trim();
      if (desiredGroup && [...groupSelect.options].some((o) => o.value === desiredGroup)) {
        groupSelect.value = desiredGroup;
      } else if (!desiredGroup) {
        groupSelect.value = '';
      }
      refreshFeedbackRowCauseSelect(row, false);
    }

    const causeSelect = row.querySelector('.fb-cause');
    if (causeSelect) {
      const desiredCause = String(saved.causeId || '').trim();
      if (desiredCause && [...causeSelect.options].some((o) => o.value === desiredCause)) {
        causeSelect.value = desiredCause;
      } else if (!desiredCause) {
        causeSelect.value = '';
      }
    }

    const comment = row.querySelector('.fb-comment');
    if (comment) comment.value = saved.comments || '';

    const contractorSelect = row.querySelector('.fb-unplanned-contractor') || row.querySelector('.fb-contractor');
    if (contractorSelect && saved.contractorId && [...contractorSelect.options].some((o) => o.value === saved.contractorId)) {
      contractorSelect.value = saved.contractorId;
    }
    const l1 = row.querySelector('.fb-unplanned-location1');
    if (l1) {
      l1.value = saved.locationLevel1 || '';
      refreshFeedbackRowLocationLevel2Options(row);
    }
    const l2 = row.querySelector('.fb-unplanned-location2');
    if (l2 && saved.locationLevel2 && [...l2.options].some((o) => o.value === saved.locationLevel2)) {
      l2.value = saved.locationLevel2;
    }
    const desc = row.querySelector('.fb-unplanned-task');
    if (desc && saved.description) desc.value = saved.description;

    row.querySelectorAll('.fb-day').forEach((input) => {
      input.checked = saved.days.includes(String(input.dataset.weekday || '').toUpperCase());
    });
    row.dataset.dirty = '1';
  });
  applyPlanningRowFilters();
}

function applyFeedbackBulkStatus(targetStatus) {
  const rows = [...document.querySelectorAll('#feedbackTasksBody tr[data-task-id]:not(.row-filter-hidden)')];
  rows.forEach((row) => {
    const statusSelect = row.querySelector('.fb-status');
    if (!statusSelect || statusSelect.disabled) return;
    const isUnplanned = row.dataset.unplanned === '1';
    const isReserve = row.dataset.reserve === '1';
    if (isUnplanned && targetStatus !== 'EXECUTED_UNPLANNED' && targetStatus !== 'EXECUTED') return;
    if (isReserve && targetStatus === 'CANCELLED') return;

    const mappedStatus = isUnplanned ? 'EXECUTED_UNPLANNED' : targetStatus;
    statusSelect.value = mappedStatus;
    row.dataset.feedbackStatus = mappedStatus;
    row.dataset.dirty = '1';
    refreshFeedbackRowExecutionInputs(row, { clearWhenBlocked: true });
    applyFeedbackCauseLockByStatus(row, false);
  });
  applyPlanningRowFilters();
}

function syncUiFiltersFromInputs() {
  state.planningFilters.contractor = $('#planningFilterContractor')?.value || '';
  state.planningFilters.location1 = $('#planningFilterLocation1')?.value || '';
  state.planningFilters.location2 = $('#planningFilterLocation2')?.value || '';
  state.planningFilters.task = $('#planningFilterTask')?.value || '';
  state.planningFilters.mon = $('#planningFilterMon')?.value || '';
  state.planningFilters.tue = $('#planningFilterTue')?.value || '';
  state.planningFilters.wed = $('#planningFilterWed')?.value || '';
  state.planningFilters.thu = $('#planningFilterThu')?.value || '';
  state.planningFilters.fri = $('#planningFilterFri')?.value || '';
  state.planningFilters.sat = $('#planningFilterSat')?.value || '';
  state.planningFilters.status = $('#planningFilterStatus')?.value || '';
  state.expectedFilters.contractor = $('#expectedFilterContractor')?.value || '';
  state.expectedFilters.supervisor = $('#expectedFilterSupervisor')?.value || '';
  state.expectedFilters.labor = $('#expectedFilterLabor')?.value || '';
  state.expectedFilters.location1 = $('#expectedFilterLocation1')?.value || '';
  state.expectedFilters.location2 = $('#expectedFilterLocation2')?.value || '';
  state.expectedFilters.task = $('#expectedFilterTask')?.value || '';
  state.expectedFilters.status = $('#expectedFilterStatus')?.value || '';
  state.feedbackFilters.contractor = $('#feedbackFilterContractor')?.value || '';
  state.feedbackFilters.location1 = $('#feedbackFilterLocation1')?.value || '';
  state.feedbackFilters.location2 = $('#feedbackFilterLocation2')?.value || '';
  state.feedbackFilters.task = $('#feedbackFilterTask')?.value || '';
  state.feedbackFilters.status = $('#feedbackFilterStatus')?.value || '';
  state.feedbackFilters.causeGroup = $('#feedbackFilterCauseGroup')?.value || '';
  state.feedbackFilters.cause = $('#feedbackFilterCause')?.value || '';
  state.feedbackFilters.comment = $('#feedbackFilterComment')?.value || '';
}

function resetPlanningFilters() {
  state.planningFilters = {
    seq: '',
    originWeek: '',
    contractor: '',
    location1: '',
    location2: '',
    task: '',
    mon: '',
    tue: '',
    wed: '',
    thu: '',
    fri: '',
    sat: '',
    status: '',
  };
  if ($('#planningFilterContractor')) $('#planningFilterContractor').value = '';
  if ($('#planningFilterLocation1')) $('#planningFilterLocation1').value = '';
  if ($('#planningFilterLocation2')) $('#planningFilterLocation2').value = '';
  if ($('#planningFilterTask')) $('#planningFilterTask').value = '';
  if ($('#planningFilterMon')) $('#planningFilterMon').value = '';
  if ($('#planningFilterTue')) $('#planningFilterTue').value = '';
  if ($('#planningFilterWed')) $('#planningFilterWed').value = '';
  if ($('#planningFilterThu')) $('#planningFilterThu').value = '';
  if ($('#planningFilterFri')) $('#planningFilterFri').value = '';
  if ($('#planningFilterSat')) $('#planningFilterSat').value = '';
  if ($('#planningFilterStatus')) $('#planningFilterStatus').value = '';
  applyPlanningRowFilters();
}

function resetExpectedFilters() {
  state.expectedFilters = { seq: '', contractor: '', supervisor: '', labor: '', location1: '', location2: '', task: '', status: '' };
  if ($('#expectedFilterContractor')) $('#expectedFilterContractor').value = '';
  if ($('#expectedFilterSupervisor')) $('#expectedFilterSupervisor').value = '';
  if ($('#expectedFilterLabor')) $('#expectedFilterLabor').value = '';
  if ($('#expectedFilterLocation1')) $('#expectedFilterLocation1').value = '';
  if ($('#expectedFilterLocation2')) $('#expectedFilterLocation2').value = '';
  if ($('#expectedFilterTask')) $('#expectedFilterTask').value = '';
  if ($('#expectedFilterStatus')) $('#expectedFilterStatus').value = '';
  renderExpectedTasksTable();
}

function resetFeedbackFilters() {
  state.feedbackFilters = { seq: '', contractor: '', location1: '', location2: '', task: '', status: '', causeGroup: '', cause: '', comment: '' };
  if ($('#feedbackFilterContractor')) $('#feedbackFilterContractor').value = '';
  if ($('#feedbackFilterLocation1')) $('#feedbackFilterLocation1').value = '';
  if ($('#feedbackFilterLocation2')) $('#feedbackFilterLocation2').value = '';
  if ($('#feedbackFilterTask')) $('#feedbackFilterTask').value = '';
  if ($('#feedbackFilterStatus')) $('#feedbackFilterStatus').value = '';
  if ($('#feedbackFilterCauseGroup')) $('#feedbackFilterCauseGroup').value = '';
  if ($('#feedbackFilterCause')) $('#feedbackFilterCause').value = '';
  if ($('#feedbackFilterComment')) $('#feedbackFilterComment').value = '';
  applyPlanningRowFilters();
}

function renderTasks() {
  const body = $('#tasksBody');
  const fbBody = $('#feedbackTasksBody');
  const planningIntroTitle = $('#planningIntroTitle');
  const planningIntroText = $('#planningIntroText');
  const planningWeekSummary = $('#planningWeekSummary');
  const feedbackSummaryRow = $('#feedbackSummaryRow');
  const feedbackRulesBox = $('#feedbackRulesBox');
  const reopenFeedbackBtn = $('#reopenFeedbackWeekBtn');
  closePlanningValidationModal();
  renderFeedbackWeekdayHeaders();
  body.innerHTML = '';
  fbBody.innerHTML = '';

  const introCopy = planningModeIntroCopy();
  if (planningIntroTitle) planningIntroTitle.textContent = introCopy.title;
  if (planningIntroText) planningIntroText.textContent = introCopy.text;
  renderPlanningLegend();

  renderImportGroupSelect();
  refreshFilterContractorOptions();

  const week = activeWeek();
  const statusField = planningModeStatusField();
  const weekOpen = String(week?.[statusField] || '').toUpperCase() === 'OPEN';
  const ppcMeetingClosedForWeek = String(week?.ppcMeeting?.isClosed || '').toLowerCase() === 'true';
  const canEditPlanningStage = isPrePlanningMode() || ppcMeetingClosedForWeek;
  const canEdit = hasAnyRole(EDIT_ROLES) && weekOpen && canEditPlanningStage;
  const canFeedbackEdit = hasAnyRole(EDIT_ROLES)
    && String(week?.planningStatus || '').toUpperCase() === 'CLOSED'
    && String(week?.feedbackStatus || '').toUpperCase() !== 'CLOSED';
  const feedbackClosed = String(week?.feedbackStatus || '').toUpperCase() === 'CLOSED';
  const saveFeedbackBtn = $('#saveFeedbackInlineBtn');
  const closeFeedbackBtn = $('#closeFeedbackWeekBtn');
  if (saveFeedbackBtn) saveFeedbackBtn.disabled = !canFeedbackEdit;
  if (closeFeedbackBtn) closeFeedbackBtn.disabled = !canFeedbackEdit;
  if (closeFeedbackBtn) closeFeedbackBtn.classList.toggle('hidden', feedbackClosed || !hasAnyRole(EDIT_ROLES));
  if (reopenFeedbackBtn) {
    const canReopen = hasAnyRole(ADMIN_ONLY_ROLES) && feedbackClosed;
    reopenFeedbackBtn.classList.toggle('hidden', !canReopen);
    reopenFeedbackBtn.disabled = !canReopen;
  }
  if (!canFeedbackEdit) {
    state.closeFeedbackPending = false;
    closeFeedbackCloseConfirmModal();
  }
  renderFeedbackNewTaskForm(canFeedbackEdit);

  ['saveWeekSheetBtn', 'addRow1Btn', 'addRow3Btn', 'addRow5Btn', 'addRowCustomQty', 'addRowCustomBtn', 'importGroupSource', 'importGroupSelect', 'importGroupBtn']
    .forEach((id) => {
      const el = $(`#${id}`);
      if (el) el.disabled = !canEdit;
    });
  const sheetRows = [
    ...state.sheetDraftRows.map((draft) => ({
      sequenceNumber: Number(draft.sequenceNumber) || 0,
      html: renderSheetTaskRow(draft, canEdit, false, true),
    })),
    ...state.tasks.map((task) => ({
      sequenceNumber: Number(task.sequenceNumber) || 0,
      html: renderSheetTaskRow(task, canEdit, false, false),
    })),
  ].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  body.insertAdjacentHTML('beforeend', sheetRows.map((item) => item.html).join(''));

  state.tasks.forEach((task) => {

    const taskFeedback = (task.feedbacks || [])[0] || null;
    const feedbackStatus = String(taskFeedback?.status || feedbackDefaultStatusFromTask(task)).toUpperCase();
    const feedbackCauseId = taskFeedback?.causeId ? Number(taskFeedback.causeId) : null;
    const feedbackCauseObj = taskFeedback?.cause
      || state.causes.find((cause) => Number(cause.id) === Number(feedbackCauseId))
      || null;
    const parsedFeedbackCause = parseFeedbackCauseDescription(taskFeedback?.cause?.description || '');
    const feedbackCauseGroup = String(feedbackCauseObj?.category || parsedFeedbackCause.category || '').trim();
    const feedbackCauseFallbackLabel = String(feedbackCauseObj?.cause || parsedFeedbackCause.cause || '').trim();
    const feedbackComments = taskFeedback?.comments || '';
    const taskIsReserve = String(task.status || '').toUpperCase() === 'RESERVA';
    const feedbackLocksCause = taskIsReserve || ['EXECUTED', 'EXECUTED_UNPLANNED', 'CANCELLED'].includes(feedbackStatus);
    const isUnplanned = task.isUnplanned === true;
    const unplannedDisabled = canFeedbackEdit ? '' : 'disabled';
    const executionBlocked = feedbackStatus === 'NOT_STARTED';
    const dayDisabled = (canFeedbackEdit && !executionBlocked) ? '' : 'disabled';
    const executedDaySet = feedbackTaskExecutedDaySet(task);
    const feedbackDayCells = SHEET_WEEKDAYS.map((weekday) => (
      `<input type="checkbox" class="fb-day" data-weekday="${weekday}" ${executedDaySet.has(weekday) ? 'checked' : ''} ${dayDisabled} />`
    ));
    const locationLevel1 = String(task.location?.level1 || '').trim();
    const locationLevel2 = displayLocationLevel2(task.location) === '-' ? '' : String(task.location?.level2 || '').trim();
    const feedbackContractorCell = `<select class="${isUnplanned ? 'fb-unplanned-contractor' : 'fb-contractor'}" ${canFeedbackEdit ? '' : 'disabled'}>${contractorOptionsHtml(task.contractor?.id || task.contractorId || '', task.contractor?.function?.name || '')}</select>`;
    const feedbackLocation1Cell = isUnplanned
      ? `<select class="fb-unplanned-location1" ${unplannedDisabled}>${locationLevel1OptionsHtml(locationLevel1)}</select>`
      : escapeHtml(task.location?.level1 || '-');
    const feedbackLocation2Cell = isUnplanned
      ? `<select class="fb-unplanned-location2" ${unplannedDisabled}>${locationLevel2OptionsHtml(locationLevel1, locationLevel2)}</select>`
      : escapeHtml(locationLevel2 || '');
    const feedbackTaskCell = isUnplanned
      ? `<textarea class="fb-unplanned-task" rows="2" ${unplannedDisabled}>${escapeHtml(task.description || '')}</textarea>`
      : escapeHtml(task.description || '');
    const feedbackStatusDisabled = (isUnplanned || !canFeedbackEdit) ? 'disabled' : '';
    const feedbackStatusOptions = isUnplanned
      ? feedbackStatusOptionsHtml('EXECUTED_UNPLANNED', { unplannedOnly: true })
      : feedbackStatusOptionsHtml(feedbackStatus);
    const actionHtml = (isUnplanned && canFeedbackEdit)
      ? `<button type="button" class="secondary" data-feedback-delete-unplanned="${task.id}">Excluir</button>`
      : '-';
    const trFb = document.createElement('tr');
    trFb.dataset.taskId = String(task.id);
    trFb.dataset.taskSeq = String(task.sequenceNumber || '');
    trFb.dataset.unplanned = isUnplanned ? '1' : '0';
    trFb.dataset.reserve = taskIsReserve ? '1' : '0';
    trFb.dataset.unplannedSupervisor = String(task.supervisor || '');
    trFb.dataset.feedbackStatus = feedbackStatus;
    trFb.dataset.dirty = '0';
    trFb.innerHTML = `
      <td>${escapeHtml(task.sequenceNumber)}</td>
      <td class="feedback-cell">${feedbackContractorCell}</td>
      <td class="feedback-cell">${feedbackLocation1Cell}</td>
      <td class="feedback-cell">${feedbackLocation2Cell}</td>
      <td class="feedback-cell">${feedbackTaskCell}</td>
      <td class="feedback-cell">
        <select class="fb-status" ${feedbackStatusDisabled}>
          ${feedbackStatusOptions}
        </select>
      </td>
      <td class="feedback-cell">
        <select class="fb-cause-group" ${canFeedbackEdit && !feedbackLocksCause ? '' : 'disabled'}>
          ${feedbackCauseGroupOptionsHtml(feedbackLocksCause ? '' : feedbackCauseGroup)}
        </select>
      </td>
      <td class="feedback-cell">
        <select class="fb-cause" ${canFeedbackEdit && !feedbackLocksCause && feedbackCauseGroup ? '' : 'disabled'}>
          ${feedbackCauseOptionsHtml(
            feedbackLocksCause ? null : feedbackCauseId,
            feedbackLocksCause ? '' : feedbackCauseGroup,
            feedbackLocksCause ? '' : feedbackCauseFallbackLabel,
          )}
        </select>
      </td>
      <td class="feedback-cell">
        <textarea class="fb-comment" rows="2" placeholder="Comentário da causa" ${canFeedbackEdit ? '' : 'disabled'}>${escapeHtml(feedbackComments)}</textarea>
      </td>
      <td class="feedback-cell feedback-day-cell">${feedbackDayCells[0]}</td>
      <td class="feedback-cell feedback-day-cell">${feedbackDayCells[1]}</td>
      <td class="feedback-cell feedback-day-cell">${feedbackDayCells[2]}</td>
      <td class="feedback-cell feedback-day-cell">${feedbackDayCells[3]}</td>
      <td class="feedback-cell feedback-day-cell">${feedbackDayCells[4]}</td>
      <td class="feedback-cell feedback-day-cell">${feedbackDayCells[5]}</td>
      <td class="feedback-cell"><div class="actions-inline">${actionHtml}</div></td>
    `;
    fbBody.appendChild(trFb);
    refreshFeedbackRowExecutionInputs(trFb);
    applyFeedbackCauseLockByStatus(trFb, true);
    const shouldShowFeedback = feedbackTaskFilterMatch(task, feedbackStatus, trFb);
    trFb.classList.toggle('row-filter-hidden', !shouldShowFeedback);
  });

  if (!state.tasks.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="16">Sem tarefas para feedback nesta semana.</td>';
    fbBody.appendChild(tr);
  }

  if (planningWeekSummary) {
    planningWeekSummary.innerHTML = buildPlanningSummaryHtml(state.tasks, state.sheetDraftRows);
  }

  if (feedbackSummaryRow) {
    const statuses = state.tasks.map((task) => String(((task.feedbacks || [])[0]?.status || feedbackDefaultStatusFromTask(task) || '').toUpperCase()));
    const executed = statuses.filter((item) => item === 'EXECUTED').length;
    const started = statuses.filter((item) => item === 'STARTED').length;
    const notStarted = statuses.filter((item) => item === 'NOT_STARTED').length;
    const cancelled = statuses.filter((item) => item === 'CANCELLED').length;
    const unplanned = state.tasks.filter((task) => task.isUnplanned === true).length;
    feedbackSummaryRow.innerHTML = [
      summaryKpiCardHtml('Situação', feedbackClosed ? 'Feedback fechado' : 'Feedback em andamento', feedbackClosed ? 'A semana já foi fechada e entrou no histórico.' : 'Você pode salvar parcialmente e fechar apenas ao concluir tudo.', feedbackClosed ? 'success' : 'info'),
      summaryKpiCardHtml('Executadas', String(executed), 'Fecham o pacote como concluído.', executed ? 'success' : 'info'),
      summaryKpiCardHtml('Iniciadas', String(started), 'Exigem causa e comentário para histórico.', started ? 'warning' : 'success'),
      summaryKpiCardHtml('Não iniciadas', String(notStarted), 'Também exigem causa e comentário.', notStarted ? 'danger' : 'success'),
      summaryKpiCardHtml('Canceladas', String(cancelled), 'Não exigem causa, mas pedem comentário.', cancelled ? 'warning' : 'success'),
      summaryKpiCardHtml('Exec. não planejadas', String(unplanned), 'Entram como ocorrência de mudança na semana.', unplanned ? 'info' : 'success'),
    ].join('');
  }

  if (feedbackRulesBox) {
    feedbackRulesBox.innerHTML = `
      <p><strong>Regras rápidas do feedback</strong></p>
      <ul>
        <li><strong>Executada</strong>, <strong>Executada / Não planejada</strong> e <strong>Cancelada</strong> não abrem causa.</li>
        <li><strong>Iniciada</strong> e <strong>Não iniciada</strong> exigem grupo da causa, causa e comentário.</li>
        <li><strong>Reserva</strong> não concluída fica com fundo cinza e continua sem causa obrigatória.</li>
        <li><strong>Salvar</strong> pode ser parcial; a validação completa acontece apenas no fechamento do feedback.</li>
      </ul>
    `;
  }

  applyPlanningHolidayHighlights();
  applyPlanningRowFilters();
  renderExpectedTasksTable();
  syncFeedbackComparisonPdfButton();
}

function renderQualityPdfButton() {
  const btn = $('#qualityWeekPdfBtn');
  if (!btn) return;
  const week = qualityWeekSelected();
  const isClosed = String(week?.qualityStatus || '').toUpperCase() === 'CLOSED';
  btn.classList.toggle('hidden', !isClosed);
}

function renderQualityCompletionSummary(payload, canEdit) {
  const box = $('#qualityCompletionBox');
  if (!box) return;
  const week = qualityWeekSelected();
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (!rows.length) {
    box.innerHTML = summaryKpiCardHtml('Avaliação', 'Sem dados', 'Selecione uma semana com empreiteiros ativos.', 'info');
    return;
  }
  const completed = rows.filter((row) => (
    row.qualityScore !== null && row.qualityScore !== ''
    && row.collaborationTeamScore !== null && row.collaborationTeamScore !== ''
    && row.safetyScore !== null && row.safetyScore !== ''
    && row.cleaningScore !== null && row.cleaningScore !== ''
  )).length;
  const total = rows.length;
  const pending = Math.max(0, total - completed);
  const allFilled = pending === 0;
  const isClosed = String(week?.qualityStatus || '').toUpperCase() === 'CLOSED';
  const feedbackClosed = String(week?.feedbackStatus || '').toUpperCase() === 'CLOSED';
  const situationValue = isClosed
    ? 'Avaliação fechada'
    : (!feedbackClosed ? 'Aguardando feedback' : (allFilled ? 'Pronta para fechar' : 'Em preenchimento'));
  const situationHint = isClosed
    ? 'A semana já foi fechada e entrou no histórico.'
    : (!feedbackClosed ? 'Feche o feedback da semana para liberar esta avaliação.' : (canEdit ? 'Você ainda pode salvar ajustes antes do fechamento.' : 'A avaliação está indisponível para edição.'));
  const situationTone = isClosed ? 'success' : (!feedbackClosed ? 'warning' : (allFilled ? 'success' : 'info'));
  box.innerHTML = [
    summaryKpiCardHtml('Empreiteiros avaliados', `${completed}/${total}`, allFilled ? 'Todos os itens obrigatórios foram preenchidos.' : 'Ainda faltam avaliações para fechar a semana.', allFilled ? 'success' : 'warning'),
    summaryKpiCardHtml('Pendentes', String(pending), pending ? 'Enquanto houver pendência, o fechamento fica bloqueado.' : 'Semana pronta para fechamento.', pending ? 'danger' : 'success'),
    summaryKpiCardHtml('Situação', situationValue, situationHint, situationTone),
  ].join('');
}

function renderQualityReferenceBox() {
  const box = $('#qualityReferenceBox');
  if (!box) return;
  const cfg = state.perceivedQualityConfig || {};
  box.innerHTML = `
    <div class="quality-reference-list">
      <div class="quality-reference-row">
        <strong>Prazo (PPC)</strong>
        <small>Regular a partir de ${cfg.deadlineRegularPct ?? '-'}% | Bom a partir de ${cfg.deadlineGoodPct ?? '-'}%</small>
      </div>
      <div class="quality-reference-row">
        <strong>Qualidade</strong>
        <small>Regular a partir de ${cfg.qualityRegularScore ?? '-'} | Bom a partir de ${cfg.qualityGoodScore ?? '-'}</small>
      </div>
      <div class="quality-reference-row">
        <strong>Colaboração</strong>
        <small>Combina presença do encarregado na reunião de PPC com a nota da equipe. Impacto da presença: ${cfg.collaborationPresenceImpactScore ?? '-'} | Regular a partir de ${cfg.collaborationRegularScore ?? '-'} | Bom a partir de ${cfg.collaborationGoodScore ?? '-'}</small>
      </div>
      <div class="quality-reference-row">
        <strong>Segurança</strong>
        <small>Regular a partir de ${cfg.safetyRegularScore ?? '-'} | Bom a partir de ${cfg.safetyGoodScore ?? '-'}</small>
      </div>
      <div class="quality-reference-row">
        <strong>Limpeza</strong>
        <small>Regular a partir de ${cfg.cleaningRegularScore ?? '-'} | Bom a partir de ${cfg.cleaningGoodScore ?? '-'}</small>
      </div>
    </div>
  `;
}

function canEditQualityWeek(week = qualityWeekSelected()) {
  if (!hasAnyRole(EDIT_ROLES)) return false;
  if (!week) return false;
  if (String(week.feedbackStatus || '').toUpperCase() !== 'CLOSED') return false;
  return String(week.qualityStatus || '').toUpperCase() !== 'CLOSED';
}

function renderQualityTable(payload) {
  const body = $('#qualityBody');
  const saveBtn = $('#saveQualityBtn');
  const closeBtn = $('#closeQualityWeekBtn');
  const reopenBtn = $('#reopenQualityWeekBtn');
  if (!body) return;

  body.innerHTML = '';

  const week = qualityWeekSelected();
  const canEdit = canEditQualityWeek(week);
  const isClosed = String(week?.qualityStatus || '').toUpperCase() === 'CLOSED';
  if (saveBtn) saveBtn.disabled = !canEdit;
  if (closeBtn) closeBtn.disabled = !canEdit;
  if (closeBtn) closeBtn.classList.toggle('hidden', isClosed || !hasAnyRole(EDIT_ROLES));
  if (reopenBtn) {
    const canReopen = hasAnyRole(ADMIN_ONLY_ROLES) && isClosed;
    reopenBtn.classList.toggle('hidden', !canReopen);
    reopenBtn.disabled = !canReopen;
  }
  renderQualityPdfButton();
  renderQualityReferenceBox();

  if (!payload || !Array.isArray(payload.rows) || !payload.rows.length) {
    if (saveBtn) saveBtn.disabled = true;
    if (closeBtn) closeBtn.disabled = true;
    renderQualityCompletionSummary(null, canEdit);
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7">Sem empreiteiros ativos para avaliação nesta semana.</td>';
    body.appendChild(tr);
    return;
  }

  payload.rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.dataset.contractorId = String(row.contractorId);
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(row.contractorName || '-')}<br /><small>${escapeHtml(row.laborType || '-')}</small></td>
      <td><input class="quality-quality-score" type="number" min="0" max="10" step="1" value="${row.qualityScore ?? ''}" ${canEdit ? '' : 'disabled'} /></td>
      <td><input class="quality-collab-team-score" type="number" min="0" max="10" step="1" value="${row.collaborationTeamScore ?? ''}" ${canEdit ? '' : 'disabled'} /></td>
      <td><input class="quality-safety-score" type="number" min="0" max="10" step="1" value="${row.safetyScore ?? ''}" ${canEdit ? '' : 'disabled'} /></td>
      <td><input class="quality-cleaning-score" type="number" min="0" max="10" step="1" value="${row.cleaningScore ?? ''}" ${canEdit ? '' : 'disabled'} /></td>
      <td><textarea class="quality-comments" rows="2" ${canEdit ? '' : 'disabled'}>${escapeHtml(row.comments || '')}</textarea></td>
    `;
    body.appendChild(tr);
  });
  renderQualityCompletionSummary(payload, canEdit);
}

function parseQualityGridScore(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 0 || num > 10) return null;
  return num;
}

function collectQualityItemsFromGrid() {
  const rows = [...document.querySelectorAll('#qualityBody tr[data-contractor-id]')];
  const payload = [];
  const invalid = [];

  rows.forEach((row, index) => {
    const contractorId = Number.parseInt(row.dataset.contractorId || '', 10);
    const qualityScoreRaw = row.querySelector('.quality-quality-score')?.value ?? '';
    const collabTeamRaw = row.querySelector('.quality-collab-team-score')?.value ?? '';
    const safetyRaw = row.querySelector('.quality-safety-score')?.value ?? '';
    const cleaningRaw = row.querySelector('.quality-cleaning-score')?.value ?? '';
    const comments = row.querySelector('.quality-comments')?.value ?? '';

    const qualityScore = parseQualityGridScore(qualityScoreRaw);
    const collaborationTeamScore = parseQualityGridScore(collabTeamRaw);
    const safetyScore = parseQualityGridScore(safetyRaw);
    const cleaningScore = parseQualityGridScore(cleaningRaw);

    if ((String(qualityScoreRaw).trim() && qualityScore === null)
      || (String(collabTeamRaw).trim() && collaborationTeamScore === null)
      || (String(safetyRaw).trim() && safetyScore === null)
      || (String(cleaningRaw).trim() && cleaningScore === null)) {
      invalid.push(`Linha ${index + 1}: use apenas notas inteiras de 0 a 10.`);
      return;
    }

    payload.push({
      contractorId,
      qualityScore,
      collaborationTeamScore,
      safetyScore,
      cleaningScore,
      comments: String(comments || '').trim() || null,
    });
  });

  return { payload, invalid };
}

function validateQualityCloseFromScreen() {
  const reasons = [];
  const lines = [];
  const week = qualityWeekSelected();

  if (!week) {
    reasons.push('Selecione uma semana válida para fechar a Qualidade Percebida.');
    return { ok: false, reasons, lines };
  }

  if (String(week.feedbackStatus || '').toUpperCase() !== 'CLOSED') {
    reasons.push('Não é possível fechar a Qualidade Percebida sem fechar o feedback da semana.');
  }

  if (!state.perceivedQualityConfig) {
    reasons.push('Não é possível fechar a Qualidade Percebida sem cadastrar os parâmetros em Cadastros da Obra > Qualidade Percebida.');
  }

  const rows = [...document.querySelectorAll('#qualityBody tr[data-contractor-id]')];
  if (!rows.length) {
    reasons.push('Não há empreiteiros ativos nesta semana para avaliação.');
  }
  rows.forEach((row, index) => {
    const contractorName = row.querySelector('td:nth-child(2)')?.textContent?.trim() || `Linha ${index + 1}`;
    const qualityScore = parseQualityGridScore(row.querySelector('.quality-quality-score')?.value ?? '');
    const collabTeam = parseQualityGridScore(row.querySelector('.quality-collab-team-score')?.value ?? '');
    const safety = parseQualityGridScore(row.querySelector('.quality-safety-score')?.value ?? '');
    const cleaning = parseQualityGridScore(row.querySelector('.quality-cleaning-score')?.value ?? '');
    const missing = [];
    if (qualityScore === null) missing.push('Qualidade');
    if (collabTeam === null) missing.push('Colaboração (equipe)');
    if (safety === null) missing.push('Segurança');
    if (cleaning === null) missing.push('Limpeza');
    if (missing.length) {
      lines.push(`Linha ${index + 1} (${contractorName}): faltando ${missing.join(', ')}.`);
    }
  });

  if (lines.length) {
    reasons.push('Existem itens obrigatórios sem preenchimento.');
  }

  return { ok: reasons.length === 0 && lines.length === 0, reasons, lines };
}

async function refreshQualityTab(options = {}) {
  const useDefaultCurrent = options.useDefaultCurrent === true;
  const silent = options.silent === true;
  const weekInput = $('#qualityWeekNumber');
  if (!weekInput) return;

  if (useDefaultCurrent) {
    const suggested = suggestedCurrentWeekNumberForCurrentWork();
    if (suggested) weekInput.value = String(suggested);
  }

  const weekNumber = qualityWeekNumberField();
  updateQualityWeekPreview();

  if (!weekNumber) {
    state.qualityWeekId = null;
    state.qualityWeekNumber = null;
    state.qualityData = null;
    renderQualityTable(null);
    if (!silent) setStatus('Informe o número da semana para carregar a Qualidade Percebida.', true);
    return;
  }

  const week = state.weeks.find((item) => Number(item.weekNumber) === Number(weekNumber));
  if (!week) {
    state.qualityWeekId = null;
    state.qualityWeekNumber = weekNumber;
    state.qualityData = null;
    renderQualityTable(null);
    if (!silent) setStatus(`Semana ${weekNumber} ainda não está disponível.`, true);
    return;
  }

  const data = await api(`/weeks/${week.id}/perceived-quality`);
  state.qualityWeekId = week.id;
  state.qualityWeekNumber = week.weekNumber;
  state.qualityData = data || null;
  renderQualityTable(state.qualityData);
  clearScreenDirty('quality');
  if (!silent) setStatus(`Qualidade Percebida atualizada. Semana considerada ${week.weekNumber}.`);
}

async function handleQualitySave(options = {}) {
  if (state.qualitySaveInProgress) return false;
  try {
    state.qualitySaveInProgress = true;
    setQualitySavingLock(true);
    if (!options.autosave) openGenericSaveProgressModal(12, 'Validando notas e comentários...', 'Salvando qualidade percebida');
    const week = qualityWeekSelected();
    if (!week?.id) {
      setStatus('Selecione uma semana válida na aba Qualidade Percebida.', true);
      return false;
    }
    if (!canEditQualityWeek(week)) {
      setStatus('A Qualidade Percebida desta semana já está fechada ou sem permissão para edição.', true);
      return false;
    }

    const { payload, invalid } = collectQualityItemsFromGrid();
    if (invalid.length) {
      openQualityValidationModal('Não foi possível salvar a Qualidade Percebida da semana.', invalid);
      setStatus('Não foi possível salvar: há notas inválidas na Qualidade Percebida.', true);
      return false;
    }
    if (!payload.length) {
      setStatus('Sem itens para salvar na Qualidade Percebida.', true);
      return false;
    }

    if (!options.autosave) updateGenericSaveProgress(54, 'Salvando qualidade percebida...', 'Salvando qualidade percebida');
    const saved = await api(`/weeks/${week.id}/perceived-quality`, {
      method: 'PUT',
      body: { items: payload },
    });
    state.qualityData = saved || null;
    renderQualityTable(state.qualityData);
    if (!options.autosave) updateGenericSaveProgress(100, 'Salvamento concluído.', 'Salvando qualidade percebida');
    clearScreenDirty('quality');
    if (options.autosave) {
      showToast('Rascunho da qualidade percebida salvo automaticamente.', { kind: 'success', durationMs: 3200 });
    } else {
      setStatus(`Qualidade Percebida da Semana ${week.weekNumber} salva.`);
    }
    return true;
  } catch (error) {
    const message = translateApiError(error.message, 'Erro ao salvar Qualidade Percebida');
    if (options.autosave) {
      showToast(message, { kind: 'reminder', durationMs: 5200 });
    } else {
      setStatus(message, true);
    }
    return false;
  } finally {
    state.qualitySaveInProgress = false;
    setQualitySavingLock(false);
    if (!options.autosave) {
      window.setTimeout(() => closeGenericSaveProgressModal(), 250);
    }
  }
}

async function handleQualityClose() {
  try {
    const week = qualityWeekSelected();
    if (!week?.id) {
      setStatus('Selecione uma semana válida na aba Qualidade Percebida.', true);
      return;
    }
    if (!canEditQualityWeek(week)) {
      setStatus('A Qualidade Percebida desta semana já está fechada ou sem permissão para edição.', true);
      return;
    }

    const localValidation = validateQualityCloseFromScreen();
    if (!localValidation.ok) {
      openQualityValidationModal(
        'Não é possível fechar a Qualidade Percebida da semana.',
        [...localValidation.reasons, ...localValidation.lines],
      );
      setStatus('Não foi possível fechar a Qualidade Percebida da semana.', true);
      return;
    }

    const saved = await handleQualitySave();
    if (!saved) return;

    await api(`/weeks/${week.id}/perceived-quality/close`, { method: 'POST' });
    await loadWeeks();
    await refreshQualityTab({ useDefaultCurrent: false, silent: true });
    setStatus(`Qualidade Percebida da Semana ${week.weekNumber} fechada.`);
  } catch (error) {
    openQualityValidationModal(
      'Não foi possível fechar a Qualidade Percebida da semana.',
      [translateApiError(error.message, 'Falha no fechamento')],
    );
    setStatus(translateApiError(error.message, 'Erro ao fechar Qualidade Percebida'), true);
  }
}

async function handleQualityReopen() {
  const week = qualityWeekSelected();
  if (!week?.id) return;
  try {
    await api(`/weeks/${week.id}/perceived-quality/reopen`, { method: 'POST' });
    await loadWeeks();
    await refreshQualityTab({ useDefaultCurrent: false, silent: true });
    setStatus(`Qualidade percebida da semana ${week.weekNumber} reaberta com sucesso.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao reabrir Qualidade Percebida'), true);
  }
}

async function handleQualityPdfExport() {
  try {
    const week = qualityWeekSelected();
    if (!week?.id) {
      setStatus('Selecione uma semana válida na aba Qualidade Percebida.', true);
      return;
    }
    if (String(week.qualityStatus || '').toUpperCase() !== 'CLOSED') {
      setStatus('O PDF da Qualidade Percebida só é liberado após o fechamento da semana.', true);
      return;
    }

    const blob = await apiBlob(`/weeks/${week.id}/perceived-quality/export/pdf`);
    const filename = `PPC-Qualidade-Percebida-Semana-${week.weekNumber}.pdf`;
    saveBlobDownload(blob, filename);
    setStatus(`PDF da Qualidade Percebida da Semana ${week.weekNumber} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF da Qualidade Percebida'), true);
  }
}

function dashboardWeekNumberField() {
  const el = $('#dashboardWeekNumber');
  if (!el) return null;
  const value = Number.parseInt(el.value || '', 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function dashboardWeekSelected() {
  const weekNumber = dashboardWeekNumberField();
  if (!weekNumber) return null;
  return state.weeks.find((item) => Number(item.weekNumber) === Number(weekNumber)) || null;
}

function updateDashboardWeekPreview() {
  const week = dashboardWeekSelected();
  const startEl = $('#dashboardWeekStart');
  const endEl = $('#dashboardWeekEnd');
  if (!startEl || !endEl) return;
  if (!week) {
    startEl.value = '';
    endEl.value = '';
    return;
  }
  startEl.value = formatDate(week.startDate);
  endEl.value = formatDate(week.endDate);
}

function dashboardBarRowsHtml(items, valueFormatter = (value) => `${Number(value || 0).toFixed(2)}%`, options = {}) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return '<div class="chart-bar-label">Sem dados para exibir.</div>';
  const hasTarget = Number.isFinite(Number(options?.targetPct));
  const targetPct = hasTarget ? Math.max(0, Math.min(100, Number(options.targetPct))) : 0;
  return rows.map((item) => {
    const label = escapeHtml(String(item.label || 'Item'));
    const color = String(item.color || '#2f8f65');
    const pct = Math.max(0, Math.min(100, Number(item.pct || 0)));
    return `
      <div class="chart-bar-row">
        <div class="chart-bar-label">${label}</div>
        <div class="chart-bar-track${hasTarget ? ' with-target' : ''}">
          ${hasTarget ? `<div class="chart-bar-target" style="left: ${targetPct.toFixed(2)}%;"></div>` : ''}
          <div class="chart-bar-fill" style="width: ${pct.toFixed(2)}%; background: ${color};"></div>
        </div>
        <div class="chart-bar-value">${escapeHtml(valueFormatter(item.pct, item))}</div>
      </div>
    `;
  }).join('');
}

function renderDashboard(data) {
  const kpi = $('#dashboardPpcKpiRow');
  const causes = $('#causesList');
  const contractorRawBars = $('#dashboardContractorRawBars');
  const contractorRawMetaLabel = $('#dashboardContractorRawMetaLabel');
  const contractorBars = $('#dashboardContractorBars');
  const contractorMetaLabel = $('#dashboardContractorMetaLabel');
  const laborTypeBars = $('#dashboardLaborTypeBars');
  const laborTypeMetaLabel = $('#dashboardLaborTypeMetaLabel');
  const rankingBody = $('#dashboardRankingBody');
  const perceivedQualityBody = $('#dashboardPerceivedQualityBody');
  const accessBody = $('#dashboardAccessBody');
  const formatNumberBr2 = (value) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatPercentBr2 = (value) => `${formatNumberBr2(value)}%`;
  const qualityCellHtml = (band, score, isPct = false) => {
    const normalized = String(band || '-').toUpperCase();
    const mood = normalized === 'BOM' ? 'good' : (normalized === 'REGULAR' ? 'regular' : (normalized === 'RUIM' ? 'bad' : 'none'));
    const face = mood === 'good' ? ':)' : (mood === 'regular' ? ':|' : (mood === 'bad' ? ':(' : '•'));
    const scoreText = (score === null || score === undefined || score === '')
      ? '-'
      : (isPct ? formatPercentBr2(score) : formatNumberBr2(score));
    return `<span class="dashboard-face ${mood}">${face}</span> <span>${escapeHtml(scoreText)}</span>`;
  };

  [kpi, causes, contractorRawBars, contractorRawMetaLabel, contractorBars, contractorMetaLabel, laborTypeBars, laborTypeMetaLabel, rankingBody, perceivedQualityBody, accessBody].forEach((el) => {
    if (el) el.innerHTML = '';
  });

  if (!data || !data.summary) {
    if (kpi) kpi.innerHTML = '<div class="kpi"><label>Sem dados</label><strong>-</strong></div>';
    if (causes) causes.innerHTML = '<li>Sem permissão ou sem dados.</li>';
    if (contractorRawBars) contractorRawBars.innerHTML = '<div class="chart-bar-label">Sem dados.</div>';
    if (contractorBars) contractorBars.innerHTML = '<div class="chart-bar-label">Sem dados.</div>';
    if (laborTypeBars) laborTypeBars.innerHTML = '<div class="chart-bar-label">Sem dados.</div>';
    if (contractorRawMetaLabel) contractorRawMetaLabel.textContent = '';
    if (contractorMetaLabel) contractorMetaLabel.textContent = '';
    if (laborTypeMetaLabel) laborTypeMetaLabel.textContent = '';
    if (rankingBody) rankingBody.innerHTML = '<tr><td colspan="6">Sem dados.</td></tr>';
    if (perceivedQualityBody) perceivedQualityBody.innerHTML = '<tr><td colspan="6">Sem dados.</td></tr>';
    if (accessBody) accessBody.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
    return;
  }

  const metrics = data.metrics || {};
  const accesses = data.accesses || {};
  const ppcTargetPct = Number(data?.settings?.ppcTargetPct || 80);
  const ppcBox = data.ppcBox || {};
  const planned = Number(ppcBox.planned || 0);
  const executedPlanned = Number(ppcBox.executedPlanned || 0);
  const ppcPct = Number(ppcBox.ppcPct || (planned ? ((executedPlanned / planned) * 100) : 0));
  const ppcBelowTarget = ppcPct < ppcTargetPct;
  const nonConcluded = Number(ppcBox.nonConcluded || 0);
  const cancelled = Number(ppcBox.cancelled || 0);
  const unplannedExecuted = Number(ppcBox.unplannedExecuted || Number(metrics?.totals?.unplannedExecuted || 0));

  if (kpi) {
    kpi.innerHTML = `
      <div class="kpi kpi-ppc-main ${ppcBelowTarget ? 'below-target' : 'above-target'}">
        <label>% PPC</label>
        <strong>${formatPercentBr2(ppcPct)}</strong>
        <small>${ppcBelowTarget ? 'Abaixo da meta da obra' : 'Acima da meta da obra'}</small>
      </div>
      <div class="kpi"><label>Número de atividades planejadas</label><strong>${Number(planned)}</strong></div>
      <div class="kpi"><label>Número de atividades executadas</label><strong>${Number(executedPlanned)}</strong></div>
      <div class="kpi"><label>Número de atividades não concluídas</label><strong>${Number(nonConcluded)}</strong></div>
      <div class="kpi"><label>Número de atividades canceladas</label><strong>${Number(cancelled)}</strong></div>
      <div class="kpi"><label>Número de atividades executadas e não planejadas</label><strong>${Number(unplannedExecuted)}</strong></div>
    `;
  }

  if (contractorRawBars) {
    const contractorItems = Array.isArray(data.contractorPpcRows) && data.contractorPpcRows.length
      ? data.contractorPpcRows
      : [];
    if (contractorRawMetaLabel) {
      contractorRawMetaLabel.textContent = `PPC bruto da semana: atividades planejadas executadas / atividades planejadas. Meta da obra: ${formatPercentBr2(ppcTargetPct)}.`;
    }
    contractorRawBars.innerHTML = dashboardBarRowsHtml(
      contractorItems.map((item) => ({
        label: item.contractor,
        pct: Number(item.executionPct || 0),
        color: '#2477c4',
      })),
      (value) => formatPercentBr2(value),
      { targetPct: ppcTargetPct },
    );
  }

  if (contractorBars) {
    const contractorItems = Array.isArray(data.contractorRanking) && data.contractorRanking.length
      ? data.contractorRanking
      : [];
    if (contractorMetaLabel) {
      contractorMetaLabel.textContent = 'Performance ajustada: 100% - % de não cumprimento por causa específica do empreiteiro.';
    }
    contractorBars.innerHTML = dashboardBarRowsHtml(
      contractorItems.map((item) => ({
        label: item.contractor,
        pct: Number(item.performancePct || 0),
        color: '#2f8f65',
      })),
      (value) => formatPercentBr2(value),
    );
  }

  if (laborTypeBars) {
    const laborTypeItems = Array.isArray(data.laborTypePpcRows) ? data.laborTypePpcRows : [];
    if (laborTypeMetaLabel) {
      laborTypeMetaLabel.textContent = `Meta PPC da obra: ${formatPercentBr2(ppcTargetPct)} (linha vertical)`;
    }
    laborTypeBars.innerHTML = dashboardBarRowsHtml(
      laborTypeItems.map((item) => ({
        label: item.laborType,
        pct: Number(item.executionPct || 0),
        color: '#2477c4',
      })),
      (value) => formatPercentBr2(value),
      { targetPct: ppcTargetPct },
    );
  }

  if (causes) {
    const groupedRows = (Array.isArray(data?.metrics?.groupedCauses) ? data.metrics.groupedCauses : []);
    groupedRows.forEach((item) => {
      const li = document.createElement('li');
      if (String(item.type) === 'CATEGORY') {
        li.className = 'cause-item-category';
        li.innerHTML = `<strong>${escapeHtml(String(item.category || '-'))}</strong> <span>${Number(item.count || 0)} ocorrência(s) | ${formatPercentBr2(Number(item.pct || 0))}</span>`;
      } else {
        li.className = 'cause-item-child';
        li.innerHTML = `<span><span class="cause-item-arrow">↳</span>${escapeHtml(String(item.cause || '-'))}</span> <span>${Number(item.count || 0)} ocorrência(s) | ${formatPercentBr2(Number(item.pct || 0))}</span>`;
      }
      causes.appendChild(li);
    });
    if (!causes.children.length) causes.innerHTML = '<li>Sem causas registradas.</li>';
  }

  if (rankingBody) {
    (data.contractorRanking || []).forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(row.contractor || '-')}</td>
        <td>${Number(row.planned || 0)}</td>
        <td>${Number(row.nonComplianceSpecific || 0)}</td>
        <td>${formatPercentBr2(Number(row.nonCompliancePct || 0))}</td>
        <td>${formatPercentBr2(Number(row.performancePct || 0))}</td>
      `;
      rankingBody.appendChild(tr);
    });
    if (!rankingBody.children.length) {
      rankingBody.innerHTML = '<tr><td colspan="6">Sem dados de ranking na semana.</td></tr>';
    }
  }

  if (perceivedQualityBody) {
    (data?.perceivedQuality?.rows || []).forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(row.contractorName || '-')}</td>
        <td>${qualityCellHtml(row.ppcBand, row.ppcPct, true)}</td>
        <td>${qualityCellHtml(row.collaborationBand, row.collaborationScore, false)}</td>
        <td>${qualityCellHtml(row.cleaningBand, row.cleaningScore, false)}</td>
        <td>${qualityCellHtml(row.qualityBand, row.qualityScore, false)}</td>
        <td>${qualityCellHtml(row.safetyBand, row.safetyScore, false)}</td>
      `;
      perceivedQualityBody.appendChild(tr);
    });
    if (!perceivedQualityBody.children.length) {
      perceivedQualityBody.innerHTML = '<tr><td colspan="6">Sem dados de qualidade percebida na semana.</td></tr>';
    }
  }

  if (accessBody) {
    const users = accesses.users || [];
    users.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.userName || '-')}</td>
        <td>${escapeHtml(item.email || '-')}</td>
        <td>${Number(item.count || 0)}</td>
      `;
      accessBody.appendChild(tr);
    });
    if (!accessBody.children.length) {
      accessBody.innerHTML = '<tr><td colspan="3">Sem acessos registrados na semana.</td></tr>';
    }
  }
}

function renderDashboardHistory(data) {
  const kpi = $('#historyKpiRow');
  const coverageNotice = $('#historyCoverageNotice');
  const governance = $('#historyGovernanceKpis');
  const trendBars = $('#historyTrendBars');
  const monthlyPerfBars = $('#historyMonthlyPerformanceBars');
  const monthlyEvolutionBars = $('#historyMonthlyEvolutionBars');
  const planningQualityBars = $('#historyPlanningQualityBars');
  const contractorBody = $('#historyContractorBody');
  const zoneBody = $('#historyZoneHeatBody');
  const monthlyGlobalBody = $('#historyMonthlyGlobalBody');
  const monthlyContractorBody = $('#historyMonthlyContractorBody');
  const causesList = $('#historyCausesList');
  const laborTypeBody = $('#historyLaborTypeBody');
  const reliabilityBody = $('#historyReliabilityBody');
  const governanceIntro = $('#historyGovernanceIntro');
  const weeklyIntro = $('#historyWeeklyIntro');
  const monthlyIntro = $('#historyMonthlyIntro');
  const evolutionIntro = $('#historyEvolutionIntro');
  const planningQualityIntro = $('#historyPlanningQualityIntro');

  if (governanceIntro) {
    governanceIntro.textContent = 'Aqui a leitura é executiva: quantas semanas cumpriram prazo, quantas ficaram fora do combinado e onde o fluxo de gestão da obra está pedindo mais atenção.';
  }
  if (weeklyIntro) {
    weeklyIntro.textContent = 'Esta visão mostra o comportamento semana a semana do PPC e ajuda a perceber variações curtas, rupturas de padrão e semanas fora da curva.';
  }
  if (monthlyIntro) {
    monthlyIntro.textContent = 'A consolidação mensal suaviza oscilações pontuais e ajuda a comparar períodos maiores da obra com mais clareza gerencial.';
  }
  if (evolutionIntro) {
    evolutionIntro.textContent = 'Aqui entram as contagens acumuladas do histórico: o objetivo é enxergar volume, distribuição e impacto das mudanças que aconteceram nas semanas da obra.';
  }
  if (planningQualityIntro) {
    planningQualityIntro.textContent = 'Estes gráficos e tabelas mostram quanto o plano inicial permaneceu estável até a versão final e até a execução, medindo a consistência do processo de planejamento.';
  }

  [kpi, governance, trendBars, monthlyPerfBars, monthlyEvolutionBars, planningQualityBars, contractorBody, zoneBody, monthlyGlobalBody, monthlyContractorBody, causesList, laborTypeBody, reliabilityBody].forEach((el) => {
    if (el) el.innerHTML = '';
  });
  if (coverageNotice) {
    coverageNotice.textContent = '';
    coverageNotice.classList.add('hidden');
  }

  if (!data || !data.totals) {
    if (kpi) kpi.innerHTML = '<div class="kpi"><label>Sem dados</label><strong>-</strong></div>';
    if (governance) governance.innerHTML = '<div class="kpi"><label>Governança</label><strong>-</strong></div>';
    if (trendBars) trendBars.innerHTML = '<div class="chart-bar-label">Sem dados históricos.</div>';
    if (monthlyPerfBars) monthlyPerfBars.innerHTML = '<div class="chart-bar-label">Sem dados históricos.</div>';
    if (monthlyEvolutionBars) monthlyEvolutionBars.innerHTML = '<div class="chart-bar-label">Sem dados históricos.</div>';
    if (planningQualityBars) planningQualityBars.innerHTML = '<div class="chart-bar-label">Sem dados históricos.</div>';
    if (contractorBody) contractorBody.innerHTML = '<tr><td colspan="7">Sem dados.</td></tr>';
    if (zoneBody) zoneBody.innerHTML = '<tr><td colspan="5">Sem dados.</td></tr>';
    if (monthlyGlobalBody) monthlyGlobalBody.innerHTML = '<tr><td colspan="4">Sem dados.</td></tr>';
    if (monthlyContractorBody) monthlyContractorBody.innerHTML = '<tr><td colspan="7">Sem dados.</td></tr>';
    if (causesList) causesList.innerHTML = '<li>Sem causas registradas.</li>';
    if (laborTypeBody) laborTypeBody.innerHTML = '<tr><td colspan="4">Sem dados.</td></tr>';
    if (reliabilityBody) reliabilityBody.innerHTML = '<tr><td colspan="6">Sem dados.</td></tr>';
    return;
  }

  const totals = data.totals || {};
  const gov = data.governance || {};
  const weeklyTrend = Array.isArray(data.weeklyTrend) ? data.weeklyTrend : [];
  const monthlyGlobal = Array.isArray(data.monthly?.global) ? data.monthly.global : [];
  const ppcTargetPct = Number(data.settings?.ppcTargetPct ?? data.work?.ppcTargetPct ?? 80);
  const planned = Number(totals.planned || 0);
  const executed = Number(totals.executed || 0);
  const ppcPct = Number(totals.ppcExecutionPct || 0);
  const avgPlannedPerWeek = Number(totals.avgPlannedPerWeek || 0);

  if (coverageNotice) {
    const message = data.coverage?.message || '';
    if (message) {
      coverageNotice.textContent = message;
      coverageNotice.classList.remove('hidden');
    }
  }

  if (kpi) {
    kpi.innerHTML = `
      <div class="kpi"><label>Média atendimento PPC</label><strong>${ppcPct.toFixed(2)}%</strong></div>
      <div class="kpi"><label>Total planejadas</label><strong>${planned}</strong></div>
      <div class="kpi"><label>Média atividades/semana</label><strong>${avgPlannedPerWeek.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
      <div class="kpi"><label>Executadas</label><strong>${executed}</strong></div>
      <div class="kpi"><label>Canceladas</label><strong>${Number(totals.cancelled || 0)}</strong></div>
      <div class="kpi"><label>Iniciadas</label><strong>${Number(totals.started || 0)}</strong></div>
      <div class="kpi"><label>Não iniciadas</label><strong>${Number(totals.notStarted || 0)}</strong></div>
      <div class="kpi"><label>Executadas não planejadas</label><strong>${Number(totals.unplannedExecuted || 0)}</strong></div>
    `;
  }

  if (governance) {
    governance.innerHTML = `
      <div class="kpi"><label>Semanas analisadas</label><strong>${Number(gov.totalWeeks || 0)}</strong></div>
      <div class="kpi"><label>Plan. no prazo</label><strong>${Number(gov.planningOnTimeWeeks || 0)} (${Number(gov.planningOnTimePctTotal || 0).toFixed(2)}%)</strong></div>
      <div class="kpi"><label>Feedback no prazo</label><strong>${Number(gov.feedbackOnTimeWeeks || 0)} (${Number(gov.feedbackOnTimePctTotal || 0).toFixed(2)}%)</strong></div>
      <div class="kpi"><label>Plan. fora do prazo</label><strong>${Number(gov.planningLateWeeks || 0)}</strong></div>
      <div class="kpi"><label>Feedback fora do prazo</label><strong>${Number(gov.feedbackLateWeeks || 0)}</strong></div>
      <div class="kpi"><label>Reaberturas aprovadas</label><strong>${Number(gov.approvedReopenRequests || 0)}</strong></div>
    `;
  }

  if (trendBars) {
    const trendItems = weeklyTrend.slice().sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber)).map((item) => ({
      label: `Sem ${item.weekNumber} (${item.monthLabel || '-'})`,
      pct: Number(item.ppc || 0),
      color: '#2f8f65',
    }));
    trendBars.innerHTML = `
      <div class="chart-bar-label">Média histórica: ${ppcPct.toFixed(2)}% | Meta: ${ppcTargetPct.toFixed(2)}%</div>
      ${dashboardBarRowsHtml(trendItems)}
    `;
  }

  if (monthlyPerfBars) {
    const monthlyItems = monthlyGlobal.map((item) => ({
      label: `${item.monthLabel || '-'} (Meta ${ppcTargetPct.toFixed(2)}%)`,
      pct: Number(item.avgPpc || 0),
      color: '#2f8f65',
    }));
    const monthlyAvg = monthlyItems.length
      ? (monthlyItems.reduce((acc, item) => acc + Number(item.pct || 0), 0) / monthlyItems.length)
      : 0;
    monthlyPerfBars.innerHTML = `
      <div class="chart-bar-label">Média histórica: ${monthlyAvg.toFixed(2)}% | Meta: ${ppcTargetPct.toFixed(2)}%</div>
      ${dashboardBarRowsHtml(monthlyItems)}
    `;
  }

  if (planningQualityBars) {
    const qualityItems = weeklyTrend.map((item) => ({
      label: `Sem ${item.weekNumber}`,
      pct: Number(item.planningQualityPct || 0),
      color: '#2563eb',
    }));
    planningQualityBars.innerHTML = `
      <div class="chart-bar-label">Qualidade = 1 - (canceladas + executadas não planejadas) / planejadas</div>
      ${dashboardBarRowsHtml(qualityItems)}
    `;
  }

  const asCountRows = (rows, key, labelPrefix, color) => {
    const maxValue = Math.max(1, ...rows.map((item) => Number(item[key] || 0)));
    return rows.map((item) => {
      const value = Number(item[key] || 0);
      return {
        label: `${labelPrefix} ${item.monthLabel || `Sem ${item.weekNumber || '-'}`}`,
        pct: (value / maxValue) * 100,
        value,
        color,
      };
    });
  };

  if (monthlyEvolutionBars) {
    const rows = monthlyGlobal;
    const items = [
      ...asCountRows(rows, 'planned', 'Plan |', '#2f8f65'),
      ...rows.map((item) => {
        const value = Number((item.started || 0) + (item.notStarted || 0));
        const max = Math.max(1, ...rows.map((r) => Number((r.started || 0) + (r.notStarted || 0))));
        return { label: `N/Exec | ${item.monthLabel || '-'}`, pct: (value / max) * 100, value, color: '#d97706' };
      }),
      ...asCountRows(rows, 'cancelled', 'Canc |', '#db5757'),
      ...asCountRows(rows, 'unplannedExecuted', 'N/P Exec |', '#2477c4'),
    ];
    monthlyEvolutionBars.innerHTML = dashboardBarRowsHtml(items, (value, item) => `${Number(item?.value || 0)}`);
  }

  if (contractorBody) {
    (data.contractors || []).forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(item.contractor || '-')}</td>
        <td>${Number(item.planned || 0)}</td>
        <td>${Number(item.executed || 0)}</td>
        <td>${Number(item.cancelled || 0)}</td>
        <td>${Number(item.unplannedExecuted || 0)}</td>
        <td>${Number(item.executionPct || 0).toFixed(2)}%</td>
      `;
      contractorBody.appendChild(tr);
    });
    if (!contractorBody.children.length) contractorBody.innerHTML = '<tr><td colspan="7">Sem dados por empreiteiro.</td></tr>';
  }

  if (zoneBody) {
    (data.zones || []).forEach((item, idx) => {
      const pct = Number(item.executionPct || 0);
      let bg = '#e8f5e9';
      if (pct < 50) bg = '#ffe9e9';
      else if (pct < 75) bg = '#fff6dd';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="text-align:center; vertical-align:middle;">${idx + 1}</td>
        <td style="text-align:center; vertical-align:middle;">${escapeHtml(item.zone1 || '-')}</td>
        <td style="text-align:center; vertical-align:middle;">${Number(item.executedPlanned || 0)}/${Number(item.planned || 0)}</td>
        <td style="text-align:center; vertical-align:middle;">${Number(item.totalActivities || 0)}</td>
        <td style="background:${bg}; font-weight:700; text-align:center; vertical-align:middle;">${pct.toFixed(2)}%</td>
      `;
      zoneBody.appendChild(tr);
    });
    if (!zoneBody.children.length) zoneBody.innerHTML = '<tr><td colspan="5">Sem dados por zona.</td></tr>';
  }

  if (monthlyGlobalBody) {
    (data.monthly?.global || []).forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.monthLabel || '-')}</td>
        <td>${Number(item.weeks || 0)}</td>
        <td>${Number(item.avgExecutedPlannedPct || 0).toFixed(2)}%</td>
        <td>${Number(item.avgPpc || 0).toFixed(2)}%</td>
      `;
      monthlyGlobalBody.appendChild(tr);
    });
    if (!monthlyGlobalBody.children.length) monthlyGlobalBody.innerHTML = '<tr><td colspan="4">Sem dados mensais.</td></tr>';
  }

  if (monthlyContractorBody) {
    (data.monthly?.contractors || []).forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.monthLabel || '-')}</td>
        <td>${escapeHtml(item.contractor || '-')}</td>
        <td>${Number(item.weeks || 0)}</td>
        <td>${Number(item.avgExecutedPct || 0).toFixed(2)}%</td>
        <td>${Number(item.planned || 0)}</td>
        <td>${Number(item.executed || 0)}</td>
        <td>${Number(item.cancelled || 0)}</td>
      `;
      monthlyContractorBody.appendChild(tr);
    });
    if (!monthlyContractorBody.children.length) monthlyContractorBody.innerHTML = '<tr><td colspan="7">Sem dados mensais por empreiteiro.</td></tr>';
  }

  if (causesList) {
    (data.causeImpact?.rows || []).forEach((item) => {
      const li = document.createElement('li');
      if (item.type === 'CATEGORY') {
        li.textContent = `${item.category}: ${Number(item.pct || 0).toFixed(2)}% (${Number(item.count || 0)})`;
        li.style.fontWeight = '700';
      } else {
        li.textContent = `  - ${item.cause}: ${Number(item.pct || 0).toFixed(2)}% (${Number(item.count || 0)})`;
      }
      causesList.appendChild(li);
    });
    if (!causesList.children.length) causesList.innerHTML = '<li>Sem causas registradas.</li>';
  }

  if (laborTypeBody) {
    (data.laborTypes || []).forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.laborType || '-')}</td>
        <td>${Number(item.planned || 0)}</td>
        <td>${Number(item.executed || 0)}</td>
        <td>${Number(item.executionPct || 0).toFixed(2)}%</td>
      `;
      laborTypeBody.appendChild(tr);
    });
    if (!laborTypeBody.children.length) laborTypeBody.innerHTML = '<tr><td colspan="4">Sem dados por tipo de mão de obra.</td></tr>';
  }

  if (reliabilityBody) {
    (data.contractorReliability || []).forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(item.contractor || '-')}</td>
        <td>${Number(item.weeksActive || 0)}</td>
        <td>${Number(item.weeksAboveTarget || 0)}</td>
        <td>${Number(item.reliabilityPct || 0).toFixed(2)}%</td>
        <td>${Number(item.avgExecutionPct || 0).toFixed(2)}%</td>
      `;
      reliabilityBody.appendChild(tr);
    });
    if (!reliabilityBody.children.length) reliabilityBody.innerHTML = '<tr><td colspan="6">Sem dados de confiabilidade por empreiteiro.</td></tr>';
  }
}

function renderDashboardGovernance(rows) {
  const body = $('#dashboardGovernanceAuditBody');
  if (!body) return;
  body.innerHTML = '';
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="4">Sem registros recentes para esta obra.</td></tr>';
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(formatDateTimeBr(row.createdAt))}</td>
      <td>${escapeHtml(row.user?.name || row.user?.email || 'Sistema')}</td>
      <td>${escapeHtml(auditEventLabel(row.eventType))}</td>
      <td>${escapeHtml(row.description || '-')}</td>
    `;
    body.appendChild(tr);
  });
}

async function refreshDashboardHistoryTab(options = {}) {
  const useDefault = options.useDefault !== false;
  const silent = options.silent === true;

  if (!state.selectedWorkId) {
    renderDashboardHistory(null);
    return;
  }

  let weekNumber = dashboardWeekNumberField();
  if (!weekNumber && useDefault) {
    const closedWeeks = (state.weeks || []).filter((item) => (
      String(item.feedbackStatus || '').toUpperCase() === 'CLOSED'
      && String(item.qualityStatus || '').toUpperCase() === 'CLOSED'
    ));
    const fallbackWeek = closedWeeks.length
      ? closedWeeks[closedWeeks.length - 1]
      : ((state.weeks || []).length ? state.weeks[state.weeks.length - 1] : null);
    if (fallbackWeek) {
      $('#dashboardWeekNumber').value = String(fallbackWeek.weekNumber);
      weekNumber = Number(fallbackWeek.weekNumber);
    }
  }

  updateDashboardWeekPreview();
  if (!weekNumber) {
    renderDashboardHistory(null);
    if (!silent) setStatus('Informe uma semana para carregar o histórico.', true);
    return;
  }

  const week = (state.weeks || []).find((item) => Number(item.weekNumber) === Number(weekNumber));
  if (!week) {
    renderDashboardHistory(null);
    if (!silent) setStatus(`Semana ${weekNumber} não encontrada para a obra selecionada.`, true);
    return;
  }

  state.dashboardWeekId = week.id;
  state.dashboardWeekNumber = week.weekNumber;
  const history = await api(`/works/${state.selectedWorkId}/dashboard/history/weeks/${week.id}`);
  renderDashboardHistory(history);
  const effectiveWeek = Number(history?.selectedWeek?.weekNumber || week.weekNumber);
  if (Number.isFinite(effectiveWeek) && effectiveWeek > 0) {
    const weekField = $('#dashboardWeekNumber');
    if (weekField && Number.parseInt(weekField.value || '', 10) !== effectiveWeek) {
      weekField.value = String(effectiveWeek);
      updateDashboardWeekPreview();
    }
    const effectiveWeekObj = (state.weeks || []).find((item) => Number(item.weekNumber) === effectiveWeek);
    if (effectiveWeekObj) {
      state.dashboardWeekId = effectiveWeekObj.id;
      state.dashboardWeekNumber = effectiveWeekObj.weekNumber;
    }
  }
  if (!silent) {
    setStatus(`Histórico acumulado atualizado até a Semana ${effectiveWeek}.`);
  }
}

async function refreshDashboardGovernanceTab(options = {}) {
  const silent = options.silent === true;
  if (!state.selectedWorkId) {
    renderDashboardGovernance(null);
    return;
  }
  if (!hasAnyRole(ADMIN_ONLY_ROLES)) {
    renderDashboardGovernance([]);
    if (!silent) setStatus('A aba de governança é exclusiva do administrador.', true);
    return;
  }
  const rows = await api(`/works/${state.selectedWorkId}/audit?limit=50`);
  renderDashboardGovernance(rows);
  if (!silent) {
    setStatus('Governança atualizada com os últimos 50 registros da obra.');
  }
}

async function refreshDashboardBySubtab(options = {}) {
  const currentSubtab = ['relatorio', 'historico', 'governanca'].includes(state.dashboardTab)
    ? state.dashboardTab
    : 'relatorio';
  if (state.dashboardTab !== currentSubtab) state.dashboardTab = currentSubtab;
  if (currentSubtab === 'historico') {
    await refreshDashboardHistoryTab(options);
    return;
  }
  if (currentSubtab === 'governanca') {
    await refreshDashboardGovernanceTab(options);
    return;
  }
  await refreshDashboardTab(options);
}

async function refreshDashboardTab(options = {}) {
  const useDefault = options.useDefault !== false;
  const silent = options.silent === true;

  if (!state.selectedWorkId) {
    renderDashboard(null);
    return;
  }

  let weekNumber = dashboardWeekNumberField();
  if (!weekNumber && useDefault) {
    const closedWeeks = (state.weeks || []).filter((item) => String(item.feedbackStatus || '').toUpperCase() === 'CLOSED');
    const fallbackWeek = closedWeeks.length
      ? closedWeeks[closedWeeks.length - 1]
      : ((state.weeks || []).length ? state.weeks[state.weeks.length - 1] : null);
    if (fallbackWeek) {
      $('#dashboardWeekNumber').value = String(fallbackWeek.weekNumber);
      weekNumber = Number(fallbackWeek.weekNumber);
    }
  }

  updateDashboardWeekPreview();
  if (!weekNumber) {
    renderDashboard(null);
    if (!silent) setStatus('Informe uma semana para carregar os dashboards.', true);
    return;
  }

  const week = (state.weeks || []).find((item) => Number(item.weekNumber) === Number(weekNumber));
  if (!week) {
    renderDashboard(null);
    if (!silent) setStatus(`Semana ${weekNumber} não encontrada para a obra selecionada.`, true);
    return;
  }

  state.dashboardWeekId = week.id;
  state.dashboardWeekNumber = week.weekNumber;
  const dashboard = await api(`/works/${state.selectedWorkId}/dashboard/weeks/${week.id}`);
  renderDashboard(dashboard);
  if (!silent) setStatus(`Dashboards atualizados para a semana ${week.weekNumber}.`);
}

async function loadUsersForCadastroOverview() {
  const works = (state.availableWorks || []).slice();
  const usersById = new Map();
  const now = new Date();

  for (const work of works) {
    let rows = [];
    try {
      // eslint-disable-next-line no-await-in-loop
      rows = await api(`/works/${work.id}/users`);
    } catch {
      rows = [];
    }
    rows.forEach((row) => {
      const id = Number(row.id);
      if (!id) return;
      if (!usersById.has(id)) {
        usersById.set(id, {
          id,
          name: row.name || '',
          company: row.company || '',
          email: row.email || '',
          roles: [],
          works: [],
          workRoleByWorkId: {},
        });
      }
      const entry = usersById.get(id);
      if (!entry.works.some((item) => Number(item.id) === Number(work.id))) {
        entry.works.push({ id: work.id, name: work.name || `Obra ${work.id}` });
      }

      const activeAssignments = (row.assignments || [])
        .filter((assignment) => assignment.isActiveNow)
        .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
      const activeAssignment = activeAssignments[0] || (row.assignments || [])[0] || null;
      if (activeAssignment?.role && !entry.roles.includes(activeAssignment.role)) {
        entry.roles.push(activeAssignment.role);
      }
      if (activeAssignment?.id) {
        entry.workRoleByWorkId[Number(work.id)] = Number(activeAssignment.id);
      }
    });
  }

  return [...usersById.values()]
    .map((item) => ({
      ...item,
      roles: [...new Set(item.roles)],
      works: item.works.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')),
    }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

function applyUiPermissions() {
  const canEdit = hasAnyRole(EDIT_ROLES);
  const canDashboard = hasAnyRole(DASHBOARD_ROLES);
  const isAdminContext = hasAnyRole(ADMIN_ONLY_ROLES);
  const canManageDeadlines = hasAnyRole(DEADLINE_ROLES);

  if ($('#userForm')) $('#userForm').classList.toggle('hidden', true);
  if ($('#permissionProfileForm')) $('#permissionProfileForm').classList.toggle('hidden', !isAdminContext);
  if ($('#openCadastroUsersBtn')) $('#openCadastroUsersBtn').classList.toggle('hidden', !isAdminContext);
  if ($('#openCadastroWorksBtn')) $('#openCadastroWorksBtn').classList.toggle('hidden', !isAdminContext);
  if ($('#openCadastroCompanyBtn')) $('#openCadastroCompanyBtn').classList.toggle('hidden', !isAdminContext);
  $('#cadastroWorkForm').classList.toggle('hidden', !isAdminContext);
  $('#companyForm').classList.toggle('hidden', !isAdminContext);
  if ($('#openCadastroLaborTypesBtn')) $('#openCadastroLaborTypesBtn').classList.toggle('hidden', !canEdit);
  $('#contractorFunctionForm').classList.toggle('hidden', !canEdit);
  $('#contractorForm').classList.toggle('hidden', !canEdit);
  if ($('#openContractorModalBtn')) $('#openContractorModalBtn').classList.toggle('hidden', !canEdit);
  $('#obraContractorImportForm').classList.toggle('hidden', !canEdit);
  $('#causeForm').classList.toggle('hidden', !canEdit);
  $('#taskGroupForm').classList.toggle('hidden', !canEdit);
  $('#taskGroupItemForm').classList.toggle('hidden', !canEdit);
  $('#obraTaskGroupImportForm').classList.toggle('hidden', !canEdit);
  $('#obraTaskGroupForm').classList.toggle('hidden', !canEdit);
  $('#obraTaskGroupItemForm').classList.toggle('hidden', !canEdit);
  $('#obraHolidayForm').classList.toggle('hidden', !canEdit);
  $('#obraDeadlineRuleForm').classList.toggle('hidden', !canManageDeadlines);
  $('#obraPerceivedQualityForm').classList.toggle('hidden', !canEdit);
  $('#zoneLevel1Form').classList.toggle('hidden', !canEdit);
  $('#zoneLevel2Form').classList.toggle('hidden', !canEdit);
  $('#weekForm').classList.toggle('hidden', !canEdit);
  $('#weekActionRow').classList.toggle('hidden', !canEdit);
  $('#taskForm').classList.toggle('hidden', !canEdit);
  $('#feedbackForm').classList.toggle('hidden', !canEdit);
  $('#saveFeedbackInlineBtn').classList.toggle('hidden', !canEdit);
  $('#closeFeedbackWeekBtn').classList.toggle('hidden', !canEdit);
  if ($('#reopenFeedbackWeekBtn')) $('#reopenFeedbackWeekBtn').classList.toggle('hidden', !hasAnyRole(ADMIN_ONLY_ROLES));
  $('#feedbackNewTaskForm').classList.toggle('hidden', !canEdit);
  $('#saveQualityBtn').classList.toggle('hidden', !canEdit);
  $('#closeQualityWeekBtn').classList.toggle('hidden', !canEdit);
  if ($('#reopenQualityWeekBtn')) $('#reopenQualityWeekBtn').classList.toggle('hidden', !hasAnyRole(ADMIN_ONLY_ROLES));

  $('#openWeekBtn').disabled = !canEdit;
  $('#weekRefreshBtn').disabled = !canEdit;
  $('#closePlanningBtn').disabled = !canEdit;
  $('#reopenBtn').disabled = !canEdit;
  $('#importWeekExcelBtn').disabled = !canEdit;
  if ($('#importWeekTxtBtn')) $('#importWeekTxtBtn').disabled = !canEdit;
  if ($('#exportWeekTxtBtn')) $('#exportWeekTxtBtn').disabled = !canEdit;
  $('#saveWeekSheetBtn').disabled = !canEdit;
  $('#addRow1Btn').disabled = !canEdit;
  $('#addRow3Btn').disabled = !canEdit;
  $('#addRow5Btn').disabled = !canEdit;
  if ($('#addRowCustomQty')) $('#addRowCustomQty').disabled = !canEdit;
  if ($('#addRowCustomBtn')) $('#addRowCustomBtn').disabled = !canEdit;
  $('#importGroupSource').disabled = !canEdit;
  $('#importGroupSelect').disabled = !canEdit;
  $('#importGroupBtn').disabled = !canEdit;
  $('#saveFeedbackInlineBtn').disabled = !canEdit;
  $('#closeFeedbackWeekBtn').disabled = !canEdit;
  if ($('#reopenFeedbackWeekBtn')) $('#reopenFeedbackWeekBtn').disabled = !hasAnyRole(ADMIN_ONLY_ROLES);
  if ($('#feedbackBulkExecutedBtn')) $('#feedbackBulkExecutedBtn').disabled = !canEdit;
  if ($('#feedbackBulkStartedBtn')) $('#feedbackBulkStartedBtn').disabled = !canEdit;
  if ($('#feedbackBulkNotStartedBtn')) $('#feedbackBulkNotStartedBtn').disabled = !canEdit;
  $('#saveQualityBtn').disabled = !canEdit;
  $('#closeQualityWeekBtn').disabled = !canEdit;
  if ($('#reopenQualityWeekBtn')) $('#reopenQualityWeekBtn').disabled = !hasAnyRole(ADMIN_ONLY_ROLES);
  if ($('#ppcMeetingSavePreBtn')) $('#ppcMeetingSavePreBtn').disabled = !canEdit;
  if ($('#ppcMeetingSavePostBtn')) $('#ppcMeetingSavePostBtn').disabled = !canEdit;
  if ($('#ppcMeetingCloseBtn')) $('#ppcMeetingCloseBtn').disabled = !canEdit;
  if ($('#ppcMeetingReopenBtn')) $('#ppcMeetingReopenBtn').disabled = !hasAnyRole(ADMIN_ONLY_ROLES);
  if ($('#ppcMeetingPreSendAllEmailBtn')) $('#ppcMeetingPreSendAllEmailBtn').disabled = !canEdit;
  if ($('#ppcMeetingSendMinutesEmailBtn')) $('#ppcMeetingSendMinutesEmailBtn').disabled = !canEdit;
  $('#dashboardWeekNumber').disabled = !canDashboard;
  $('#dashboardWeekRefreshBtn').disabled = !canDashboard;
  $('#dashboardLastWeekReportPdfBtn').disabled = !canDashboard;
  if ($('#dashboardHistoryPdfBtn')) $('#dashboardHistoryPdfBtn').disabled = !canDashboard;
  if ($('#dashboardGovernanceTabBtn')) $('#dashboardGovernanceTabBtn').classList.toggle('hidden', !isAdminContext);
  if ($('#sideGovernanceBtn')) $('#sideGovernanceBtn').classList.toggle('hidden', !isAdminContext);
  if (!isAdminContext && state.dashboardTab === 'governanca') state.dashboardTab = 'relatorio';

  const dashboardTab = document.querySelector('[data-tab="gestao"]');
  dashboardTab.classList.toggle('hidden', !canDashboard);
  if (!canDashboard && dashboardTab.classList.contains('active')) {
    selectTab('programacao');
  }
  renderObraDeadlineRuleForm();
  renderQualityTable(state.qualityData);
  refreshSideNavVisibility();
  syncWeekControlButtons();
}

async function loadReferenceData() {
  if (state.isAdmin) {
    state.availableWorks = await api('/works?all=true');
  } else {
    state.availableWorks = state.userWorks;
  }

  if (!state.selectedWorkId && state.availableWorks.length > 0) {
    state.selectedWorkId = state.availableWorks[0].id;
  }
  if (Number(state.zoneCollapsedWorkId) !== Number(state.selectedWorkId || 0)) {
    state.zoneCollapsedParents = new Set();
    state.zoneCollapsedWorkId = Number(state.selectedWorkId || 0);
  }
  renderMainWorkSelect();

  if (!state.selectedWorkId) {
    state.sheetDraftRows = [];
    state.expectedWeekId = null;
    state.expectedWeekNumber = null;
    state.expectedTasks = [];
    state.expectedEmailContractors = [];
    state.qualityWeekId = null;
    state.qualityWeekNumber = null;
    state.qualityData = null;
    state.ppcMeetingWeekId = null;
    state.ppcMeetingWeekNumber = null;
    state.ppcMeetingData = null;
    state.dashboardWeekId = null;
    state.dashboardWeekNumber = null;
    if (state.appMode === 'cadastros' && state.isAdmin) {
      try {
        state.contractors = await api('/global/contractors');
      } catch {
        state.contractors = [];
      }
    } else {
      state.contractors = [];
    }
    state.locations = [];
    state.causes = [];
    state.holidays = [];
    state.contractorFunctions = [];
    state.taskGroups = [];
    state.contractorCatalog = [];
    state.taskGroupTemplates = [];
    state.notificationRule = null;
    state.perceivedQualityConfig = null;
    state.contractorCatalogFilter = '';
    state.users = [];
    if (state.isAdmin) {
      try {
        state.permissionCatalog = await api('/permissions/catalog');
      } catch {
        state.permissionCatalog = [];
      }
      try {
        state.permissionProfiles = await api('/permission-profiles');
      } catch {
        state.permissionProfiles = [];
      }
    } else {
      state.permissionCatalog = [];
      state.permissionProfiles = [];
    }
    state.workProfileAssignments = [];
    state.effectivePermissions = [];
    resetUserForm();
    resetPermissionProfileForm();
    resetCauseForm();
    resetTaskGroupForm();
    resetTaskGroupItemForm();
    resetLaborTypeForm();
    resetObraTaskGroupForm();
    resetZoneLevel1Form();
    resetZoneLevel2Form();
    resetObraTaskGroupItemForm();
    resetObraHolidayForm();
    renderUsers();
    renderPermissionProfiles();
    renderWorksCatalog();
    renderContractors();
    renderObraZoneamento();
    renderObraContractors();
    renderCauses();
    renderLaborTypes();
    renderTaskGroups();
    renderObraTaskGroups();
    renderObraHolidays();
    renderObraDeadlineRuleForm();
    renderObraPerceivedQualityForm();
    renderPermissionCatalog([]);
    updateExpectedWeekPreview();
    updatePpcMeetingWeekPreview();
    updateQualityWeekPreview();
    updateDashboardWeekPreview();
    renderExpectedTasksTable([], { emptyMessage: 'Selecione uma obra para visualizar atividades previstas.' });
    renderExpectedExportActions(null, []);
    renderQualityTable(null);
    renderPpcMeetingTab();
    renderDashboard(null);
    renderDashboardHistory(null);
    return;
  }

  const contractorsEndpoint = state.appMode === 'cadastros'
    ? '/global/contractors'
    : `/works/${state.selectedWorkId}/contractors?importedOnly=true`;
  const taskGroupsEndpoint = state.appMode === 'cadastros'
    ? '/global/task-groups'
    : `/works/${state.selectedWorkId}/task-groups`;
  const [contractors, locations, causes, contractorFunctions, taskGroups, holidays, perceivedQualityConfig] = await Promise.all([
    api(contractorsEndpoint),
    api(`/works/${state.selectedWorkId}/locations`),
    api(`/works/${state.selectedWorkId}/causes`),
    api(`/works/${state.selectedWorkId}/contractor-functions`),
    api(taskGroupsEndpoint),
    api(`/works/${state.selectedWorkId}/holidays`).catch(() => []),
    api(`/works/${state.selectedWorkId}/perceived-quality-config`).catch(() => null),
  ]);

  state.contractors = contractors;
  state.locations = locations;
  state.causes = causes;
  state.contractorFunctions = contractorFunctions;
  state.taskGroups = taskGroups;
  state.holidays = Array.isArray(holidays) ? holidays : [];
  state.perceivedQualityConfig = perceivedQualityConfig || null;
  if (state.contractorCatalogFilter && !state.contractorFunctions.some((item) => item.name === state.contractorCatalogFilter)) {
    state.contractorCatalogFilter = '';
  }

  if (hasAnyRole(EDIT_ROLES) && state.appMode === 'obra') {
    const query = state.contractorCatalogFilter
      ? `?functionName=${encodeURIComponent(state.contractorCatalogFilter)}`
      : '';
    const [catalog, templates] = await Promise.all([
      api(`/works/${state.selectedWorkId}/contractors/catalog${query}`).catch(() => []),
      api(`/works/${state.selectedWorkId}/task-groups/templates`).catch(() => []),
    ]);
    state.contractorCatalog = Array.isArray(catalog) ? catalog : [];
    state.taskGroupTemplates = Array.isArray(templates) ? templates : [];
  } else {
    state.contractorCatalog = [];
    state.taskGroupTemplates = [];
  }

  if (state.appMode === 'obra') {
    try {
      state.notificationRule = await api(`/works/${state.selectedWorkId}/notification-rule`);
    } catch {
      state.notificationRule = null;
    }
  } else {
    state.notificationRule = null;
  }

  if (state.editingContractorId && !state.contractors.some((c) => c.id === state.editingContractorId)) {
    resetContractorForm();
  }
  if (state.editingCauseId && !state.causes.some((c) => c.id === state.editingCauseId)) {
    resetCauseForm();
  }
  if (state.editingZoneLevel1Id && !state.locations.some((item) => item.id === state.editingZoneLevel1Id)) {
    resetZoneLevel1Form();
  }
  if (state.editingZoneLevel2Id && !state.locations.some((item) => item.id === state.editingZoneLevel2Id)) {
    resetZoneLevel2Form();
  }
  if (state.editingZoneLevel1ModalId && !state.locations.some((item) => item.id === state.editingZoneLevel1ModalId)) {
    closeZoneLevel1EditModal();
  }
  if (state.editingObraTaskGroupItemId) {
    const hasObraItem = state.taskGroups
      .filter((group) => Number(group.workId) === Number(state.selectedWorkId))
      .some((group) => (group.items || []).some((item) => item.id === state.editingObraTaskGroupItemId));
    if (!hasObraItem) resetObraTaskGroupItemForm();
  }
  if (state.editingObraTaskGroupId) {
    const hasObraGroup = state.taskGroups
      .filter((group) => Number(group.workId) === Number(state.selectedWorkId))
      .some((group) => group.id === state.editingObraTaskGroupId);
    if (!hasObraGroup) resetObraTaskGroupForm();
  }
  if (state.editingObraHolidayId && !state.holidays.some((item) => Number(item.id) === Number(state.editingObraHolidayId))) {
    resetObraHolidayForm();
  }
  if (state.editingTaskGroupItemId) {
    const hasItem = state.taskGroups.some((group) => (group.items || []).some((item) => item.id === state.editingTaskGroupItemId));
    if (!hasItem) resetTaskGroupItemForm();
  }
  if (state.editingTaskGroupId) {
    const hasGroup = state.taskGroups.some((group) => (
      group.id === state.editingTaskGroupId
      && (state.appMode === 'cadastros'
        ? group.workId === null
        : Number(group.workId) === Number(state.selectedWorkId))
    ));
    if (!hasGroup) resetTaskGroupForm();
  }
  if (state.editingLaborTypeId && !state.contractorFunctions.some((item) => item.id === state.editingLaborTypeId)) {
    resetLaborTypeForm();
  }

  if (state.isAdmin && state.appMode === 'cadastros') {
    state.users = await loadUsersForCadastroOverview();
  } else {
    try {
      state.users = await api(`/works/${state.selectedWorkId}/users`);
    } catch {
      state.users = [];
    }
  }

  try {
    state.effectivePermissions = (await api(`/works/${state.selectedWorkId}/effective-permissions`))?.permissions || [];
  } catch {
    state.effectivePermissions = [];
  }

  if (state.isAdmin) {
    try {
      state.permissionCatalog = await api('/permissions/catalog');
    } catch {
      state.permissionCatalog = [];
    }
    try {
      state.permissionProfiles = await api('/permission-profiles');
    } catch {
      state.permissionProfiles = [];
    }
    try {
      state.workProfileAssignments = await api(`/works/${state.selectedWorkId}/profile-assignments`);
    } catch {
      state.workProfileAssignments = [];
    }
  } else {
    state.permissionCatalog = [];
    state.permissionProfiles = [];
    state.workProfileAssignments = [];
  }

  if (state.editingUserId && !state.users.some((u) => u.id === state.editingUserId)) {
    resetUserForm();
  }
  if (state.editingPermissionProfileId && !state.permissionProfiles.some((profile) => profile.id === state.editingPermissionProfileId)) {
    resetPermissionProfileForm();
  }
  renderUsers();
  renderPermissionCatalog(selectedPermissionKeysFromForm());
  renderPermissionProfiles();
  renderWorksCatalog();
  renderContractors();
  renderObraZoneamento();
  renderObraContractors();
  renderCauses();
  renderLaborTypes();
  renderTaskGroups();
  renderObraTaskGroups();
  renderObraHolidays();
  renderObraDeadlineRuleForm();
  renderObraPerceivedQualityForm();
  renderQualityTable(state.qualityData);
}

async function fetchWeatherForWeek(weekId, options = {}) {
  const targetWeekId = Number(weekId);
  if (!targetWeekId) return null;
  const silent = options.silent !== false;
  const showErrorStatus = options.showErrorStatus === true;
  try {
    const weatherFetch = await api(`/weeks/${targetWeekId}/weather/fetch`, { method: 'POST' });
    if (weatherFetch?.weatherDays) {
      applyWeatherFetchExtras(targetWeekId, weatherFetch.weatherDays);
      applyCachedWeatherExtrasToWeeks();
      if (options.render !== false) renderWeather();
    }
    return weatherFetch;
  } catch (error) {
    if (!silent || showErrorStatus) {
      setStatus(`Não foi possível atualizar a previsão do tempo: ${error.message}`, true);
    }
    return null;
  }
}

async function loadWeeks() {
  state.weeks = await api(`/works/${state.selectedWorkId}/weeks`);
  applyCachedWeatherExtrasToWeeks();
  renderWeeks();
  if (state.selectedWeekId && !state.weatherExtrasByWeekId[Number(state.selectedWeekId)]) {
    await fetchWeatherForWeek(state.selectedWeekId, { silent: true, render: false });
  }
  if (!numericWeekField()) {
    suggestNextWeekNumber();
  }
  updateWeekFormPreview();
  updateExpectedWeekPreview();
  updatePpcMeetingWeekPreview();
  updateFeedbackWeekPreview();
  updateQualityWeekPreview();
  updateDashboardWeekPreview();
  syncPlanningModeUi();
  renderWeather();
  renderWorkWelcomePanel();
}

async function loadTasksAndDashboard() {
  if (!state.selectedWeekId) {
    state.sheetDraftRows = [];
    state.tasks = [];
    renderTasks();
    if (hasAnyRole(DASHBOARD_ROLES) && activeTabName() === 'gestao') {
      await refreshDashboardBySubtab({ useDefault: true, silent: true });
    } else {
      renderDashboard(null);
      renderDashboardHistory(null);
    }
    return;
  }

  state.tasks = await api(planningTaskCollectionPath(state.selectedWeekId));
  renderTasks();

  if (hasAnyRole(DASHBOARD_ROLES)) {
    if (activeTabName() === 'gestao') {
      await refreshDashboardBySubtab({ useDefault: true, silent: true });
    } else {
      renderDashboard(null);
      renderDashboardHistory(null);
    }
  } else {
    renderDashboard(null);
    renderDashboardHistory(null);
  }
}

async function ensureWeekExists(weekNumber, options = {}) {
  const normalizedWeekNumber = Number.parseInt(weekNumber, 10);
  const silent = options.silent === true;
  if (!state.selectedWorkId || !Number.isFinite(normalizedWeekNumber) || normalizedWeekNumber <= 0) return null;

  let found = state.weeks.find((item) => Number(item.weekNumber) === normalizedWeekNumber) || null;
  if (found) return found;

  try {
    const created = await api(`/works/${state.selectedWorkId}/weeks`, {
      method: 'POST',
      body: { weekNumber: normalizedWeekNumber },
    });
    await fetchWeatherForWeek(created.id, { silent: true, render: false });
    await loadWeeks();
    found = state.weeks.find((item) => Number(item.weekNumber) === normalizedWeekNumber) || created;
    if (!silent) setStatus(`Semana ${normalizedWeekNumber} aberta automaticamente.`);
    return found;
  } catch (error) {
    if (String(error.message || '').includes('week_already_exists')) {
      await loadWeeks();
      return state.weeks.find((item) => Number(item.weekNumber) === normalizedWeekNumber) || null;
    }
    if (!silent) setStatus(`Não foi possível abrir automaticamente a semana ${normalizedWeekNumber}.`, true);
    return null;
  }
}

async function autoLoadProgramacaoTab(options = {}) {
  const silent = options.silent === true;
  const useDefaultNext = options.useDefaultNext === true;
  const autoCreateMissingWeek = options.autoCreateMissingWeek === true;
  if (state.appMode !== 'obra' || !state.selectedWorkId) return;

  if (useDefaultNext) {
    suggestNextWeekNumber();
    updateWeekFormPreview();
  } else if (!numericWeekField()) {
    suggestNextWeekNumber();
    updateWeekFormPreview();
  }

  const typedWeekNumber = numericWeekField();
  if (!typedWeekNumber) return;

  let targetWeek = state.weeks.find((item) => Number(item.weekNumber) === typedWeekNumber);
  if (!targetWeek && autoCreateMissingWeek) {
    targetWeek = await ensureWeekExists(typedWeekNumber, { silent: true });
  }
  if (!targetWeek) {
    state.selectedWeekId = null;
    state.sheetDraftRows = [];
    await loadTasksAndDashboard();
    renderWeather();
    if (!silent) setStatus(`Semana ${typedWeekNumber} ainda não está disponível.`);
    return;
  }

  if (Number(targetWeek.id) !== Number(state.selectedWeekId)) {
    state.selectedWeekId = targetWeek.id;
    state.sheetDraftRows = [];
  }

  let weatherFetch = null;
  weatherFetch = await fetchWeatherForWeek(state.selectedWeekId, { silent: true, render: false });

  await loadWeeks();
  syncWeekFieldWithSelectedWeek();
  if (weatherFetch?.weatherDays) {
    renderWeather();
  }
  syncTaskDayCheckboxesFromDates();
  await loadTasksAndDashboard();

  if (!silent) {
    setStatus(`Programação carregada automaticamente. Semana considerada ${typedWeekNumber}.`);
  }
}

async function refreshContext() {
  refreshCurrentRoles();
  updateSessionInfo();
  applyAppMode();
  applyUiPermissions();
  renderMainWorkSelect();
  await loadReferenceData();
  await ensureSelectedWorkTimeZone();
  await loadAppConfig();
  renderWorkWelcomePanel();

  if (state.appMode === 'cadastros') {
    state.sheetDraftRows = [];
    state.weeks = [];
    state.selectedWeekId = null;
    state.tasks = [];
    state.expectedWeekId = null;
    state.expectedWeekNumber = null;
    state.expectedTasks = [];
    state.expectedEmailContractors = [];
    state.qualityWeekId = null;
    state.qualityWeekNumber = null;
    state.qualityData = null;
    state.ppcMeetingWeekId = null;
    state.ppcMeetingWeekNumber = null;
    state.ppcMeetingData = null;
    renderWeeks();
    renderTasks();
    updateExpectedWeekPreview();
    updatePpcMeetingWeekPreview();
    updateFeedbackWeekPreview();
    updateQualityWeekPreview();
    renderExpectedTasksTable([], { emptyMessage: 'Selecione uma obra para visualizar atividades previstas.' });
    renderExpectedExportActions(null, []);
    renderQualityTable(null);
    renderPpcMeetingTab();
    renderDashboard(null);
    renderDashboardHistory(null);
    renderDashboardGovernance(null);
    renderDeadlineCountdowns();
    return;
  }

  await loadWeeks();
  await loadTasksAndDashboard();
  if (isPlanningTab(activeTabName())) {
    await autoLoadProgramacaoTab({ silent: true, useDefaultNext: true, autoCreateMissingWeek: true });
  }
  if (activeTabName() === 'feedback') {
    await refreshFeedbackTab({ useDefaultPrevious: true, silent: true });
  }
  if (activeTabName() === 'reuniaoppc') {
    await refreshPpcMeetingTab({ useDefaultNext: true, autoCreateMissingWeek: true, silent: true });
  }
  if (activeTabName() === 'qualidade') {
    await refreshQualityTab({ useDefaultCurrent: true, silent: true });
  }
  renderDeadlineCountdowns();
}

function selectTab(name) {
  const panelName = planningPanelNameForTab(name);
  $$('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
  $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.tabPanel === panelName));
  resetSaveReminderTicker();
  refreshNavigationVisibility();
  renderSideNavActiveState();
  syncPlanningModeUi();
  if (name === 'obrahome') {
    renderWorkWelcomePanel();
  }
  if (state.workflowNavigationInProgress) {
    renderWeatherMiniThumb();
    return;
  }
  if (name === 'atividades') {
    refreshExpectedActivitiesTab({ useDefaultNext: true, silent: true })
      .catch((error) => setStatus(`Erro ao atualizar atividades previstas: ${error.message}`, true));
  }
  if (isPlanningTab(name)) {
    autoLoadProgramacaoTab({ silent: true, useDefaultNext: true, autoCreateMissingWeek: true })
      .catch((error) => setStatus(`Erro ao carregar programação automática: ${error.message}`, true));
  }
  if (name === 'feedback') {
    refreshFeedbackTab({ useDefaultPrevious: true, silent: true })
      .catch((error) => setStatus(`Erro ao carregar feedback da semana: ${error.message}`, true));
  }
  if (name === 'qualidade') {
    refreshQualityTab({ useDefaultCurrent: true, silent: true })
      .catch((error) => setStatus(`Erro ao carregar qualidade percebida da semana: ${error.message}`, true));
  }
  if (name === 'reuniaoppc') {
    refreshPpcMeetingTab({ useDefaultNext: true, autoCreateMissingWeek: true, silent: true })
      .catch((error) => setStatus(`Erro ao carregar reunião de PPC: ${error.message}`, true));
  }
  if (name === 'gestao') {
    refreshDashboardBySubtab({ useDefault: true, silent: true })
      .catch((error) => setStatus(`Erro ao atualizar dashboards: ${error.message}`, true));
  }
  renderWeatherMiniThumb();
}

async function handleLogin(event) {
  event.preventDefault();
  try {
    const login = await api('/auth/login', {
      method: 'POST',
      body: {
        email: $('#email').value.trim(),
        password: $('#password').value.trim(),
      },
    });

    state.token = login.token;
    state.user = await api('/auth/me');
    state.appMode = 'obra';
    state.userWorks = await api('/works');
    state.isAdmin = (state.user.assignments || []).some((a) => a.role === 'ADMIN');
    state.availableWorks = state.isAdmin ? await api('/works?all=true') : state.userWorks;

    if (!state.availableWorks.length) {
      throw new Error('Nenhuma obra disponível para este usuário.');
    }

    openGateway();
    setStatus('Escolha uma opção e prossiga.');
  } catch (error) {
    setStatus(`Falha no login: ${error.message}`, true);
  }
}

async function lookupCep() {
  const cep = $('#gatewayWorkCep').value.trim();
  if (!cep) return setStatus('Informe o CEP para validar.', true);

  try {
    const info = await api(`/utils/cep/${cep}`);
    $('#gatewayWorkCep').value = info.cep;
    $('#gatewayWorkStreet').value = info.street || '';
    $('#gatewayWorkNeighborhood').value = info.neighborhood || '';
    $('#gatewayWorkCity').value = info.city || '';
    $('#gatewayWorkState').value = info.state || '';
    setStatus('CEP validado com sucesso.');
  } catch (error) {
    setStatus(`CEP inválido ou não encontrado: ${error.message}`, true);
  }
}

async function lookupCadastroWorkCep() {
  const cep = $('#cadastroWorkCep').value.trim();
  if (!cep) return setStatus('Informe o CEP para validar.', true);

  try {
    const info = await api(`/utils/cep/${cep}`);
    $('#cadastroWorkCep').value = info.cep;
    $('#cadastroWorkStreet').value = info.street || '';
    $('#cadastroWorkNeighborhood').value = info.neighborhood || '';
    $('#cadastroWorkCity').value = info.city || '';
    $('#cadastroWorkState').value = info.state || '';
    setStatus('CEP validado com sucesso.');
  } catch (error) {
    setStatus(`CEP inválido ou não encontrado: ${error.message}`, true);
  }
}

async function lookupCompanyCep() {
  const cep = $('#companyCep').value.trim();
  if (!cep) return setStatus('Informe o CEP para validar.', true);

  try {
    const info = await api(`/utils/cep/${cep}`);
    $('#companyCep').value = info.cep;
    $('#companyStreet').value = info.street || '';
    $('#companyNeighborhood').value = info.neighborhood || '';
    $('#companyCity').value = info.city || '';
    $('#companyState').value = info.state || '';
    setStatus('CEP da construtora validado com sucesso.');
  } catch (error) {
    setStatus(`CEP da construtora inválido ou não encontrado: ${error.message}`, true);
  }
}

async function proceedAdminBySelection() {
  const selected = Number($('#gatewayAdminWorkSelect').value);
  if (!selected) return setStatus('Selecione uma obra.', true);
  state.appMode = 'obra';
  state.selectedWorkId = selected;
  state.weatherMiniPosition = null;
  state.selectedWeekId = null;
  state.weeks = [];
  state.qualityWeekId = null;
  state.qualityWeekNumber = null;
  state.qualityData = null;
  $('#gatewayView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  selectTab('obrahome');
  showCadastroView('users');
  await refreshContext();
  setStatus('Acesso à obra carregado.');
}

async function proceedAdminByCreation() {
  const startDateText = $('#gatewayWorkStartDate').value.trim();
  const parsed = parseBrDate(startDateText);
  if (!parsed) return setStatus('Data de início inválida. Use DD/MM/AAAA.', true);
  const targetPct = Number.parseFloat($('#gatewayWorkPpcTargetPct').value || '80');
  if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct > 100) {
    return setStatus('Meta PPC (%) inválida. Informe valor entre 0 e 100.', true);
  }
  const requiredFields = [
    ['Nome da obra', $('#gatewayWorkName').value],
    ['CEP', $('#gatewayWorkCep').value],
    ['Rua/Avenida', $('#gatewayWorkStreet').value],
    ['Bairro', $('#gatewayWorkNeighborhood').value],
    ['Cidade', $('#gatewayWorkCity').value],
    ['Estado', $('#gatewayWorkState').value],
    ['Número', $('#gatewayWorkNumber').value],
    ['Complemento', $('#gatewayWorkComplement').value],
    ['Meta PPC (%)', $('#gatewayWorkPpcTargetPct').value],
  ];
  const missing = requiredFields.find(([, value]) => !isFilled(value));
  if (missing) return setStatus(`Preencha o campo obrigatório: ${missing[0]}.`, true);

  try {
    const created = await api('/works', {
      method: 'POST',
      body: {
        name: $('#gatewayWorkName').value.trim(),
        cep: $('#gatewayWorkCep').value.trim(),
        street: $('#gatewayWorkStreet').value.trim(),
        neighborhood: $('#gatewayWorkNeighborhood').value.trim(),
        city: $('#gatewayWorkCity').value.trim(),
        state: $('#gatewayWorkState').value.trim(),
        number: $('#gatewayWorkNumber').value.trim(),
        complement: $('#gatewayWorkComplement').value.trim(),
        ppcTargetPct: targetPct,
        startDate: startDateText,
      },
    });

    state.availableWorks = await api('/works?all=true');
    state.userWorks = await api('/works');
    state.appMode = 'obra';
    state.selectedWorkId = created.id;
    state.weatherMiniPosition = null;
    state.selectedWeekId = null;
    state.weeks = [];
    state.qualityWeekId = null;
    state.qualityWeekNumber = null;
    state.qualityData = null;

    $('#gatewayView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    selectTab('obrahome');
    showCadastroView('users');
    await refreshContext();
    resetGatewayCreateForm();
    setStatus('Nova obra cadastrada e aberta.');
  } catch (error) {
    setStatus(`Erro ao criar obra: ${error.message}`, true);
  }
}

async function handleCadastroWorkCreate(event) {
  event.preventDefault();
  const editingId = state.editingWorkId;
  const startDateText = $('#cadastroWorkStartDate').value.trim();
  const targetPct = Number.parseFloat($('#cadastroWorkPpcTargetPct').value || '80');
  if (!editingId && !parseBrDate(startDateText)) {
    openWorkValidationModal();
    return;
  }
  if (editingId && startDateText && !parseBrDate(startDateText)) {
    openWorkValidationModal();
    return;
  }
  if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct > 100) {
    openWorkValidationModal();
    return;
  }
  const requiredFields = [
    ['Nome da obra', $('#cadastroWorkName').value],
    ['CEP', $('#cadastroWorkCep').value],
    ['Rua/Avenida', $('#cadastroWorkStreet').value],
    ['Bairro', $('#cadastroWorkNeighborhood').value],
    ['Cidade', $('#cadastroWorkCity').value],
    ['Estado', $('#cadastroWorkState').value],
    ['Número', $('#cadastroWorkNumber').value],
    ['Complemento', $('#cadastroWorkComplement').value],
    ['Meta PPC (%)', $('#cadastroWorkPpcTargetPct').value],
    ['Data de início', startDateText],
  ];
  const missing = requiredFields.find(([, value]) => !isFilled(value));
  if (missing) {
    openWorkValidationModal();
    return;
  }

  try {
    const payload = {
      name: $('#cadastroWorkName').value.trim(),
      cep: $('#cadastroWorkCep').value.trim(),
      street: $('#cadastroWorkStreet').value.trim(),
      neighborhood: $('#cadastroWorkNeighborhood').value.trim(),
      city: $('#cadastroWorkCity').value.trim(),
      state: $('#cadastroWorkState').value.trim(),
      number: $('#cadastroWorkNumber').value.trim(),
      complement: $('#cadastroWorkComplement').value.trim(),
      ppcTargetPct: targetPct,
    };
    if (startDateText) payload.startDate = startDateText;

    const created = await api(editingId ? `/works/${editingId}` : '/works', {
      method: editingId ? 'PUT' : 'POST',
      body: payload,
    });

    closeWorkModal();
    state.selectedWorkId = created.id;
    state.userWorks = await api('/works');
    state.availableWorks = await api('/works?all=true');
    await refreshContext();
    showCadastroView('works');
    setStatus(editingId ? 'Obra atualizada com sucesso.' : 'Obra cadastrada com sucesso.');
  } catch (error) {
    setStatus(`Erro ao salvar obra: ${error.message}`, true);
  }
}

function proceedAdminChoice() {
  const choice = selectedAdminChoice();
  if (!choice) {
    setStatus('Escolha uma opção para prosseguir.', true);
    return;
  }
  if (choice === 'create') {
    showAdminGatewayStep('create');
    resetGatewayCreateForm();
    return;
  }
  showAdminGatewayStep('select');
}

async function proceedAdminStart() {
  const choice = selectedAdminStartChoice();
  if (!choice) {
    setStatus('Escolha uma opção para prosseguir.', true);
    return;
  }

  if (choice === 'work') {
    state.appMode = 'obra';
    fillGatewayAdminWorkSelect();
    showAdminGatewayStep('select');
    return;
  }

  if (!state.availableWorks.length) {
    setStatus('Sem obra cadastrada para acessar cadastros.', true);
    return;
  }

  state.appMode = 'cadastros';
  state.selectedWorkId = state.selectedWorkId || state.availableWorks[0].id;
  $('#gatewayView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  selectTab('cadastros');
  showCadastroView('users');
  await refreshContext();
  setStatus('Cadastros carregados.');
}

async function proceedUserBySelection() {
  const selected = Number($('#gatewayUserWorkSelect').value);
  if (!selected) return setStatus('Selecione uma obra.', true);
  state.appMode = 'obra';
  state.selectedWorkId = selected;
  state.weatherMiniPosition = null;
  state.selectedWeekId = null;
  state.weeks = [];
  state.qualityWeekId = null;
  state.qualityWeekNumber = null;
  state.qualityData = null;
  $('#gatewayView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  selectTab('obrahome');
  await refreshContext();
  setStatus('Acesso à obra carregado.');
}

function backToStart() {
  openGateway();
  setStatus('Escolha entre Acesso à obra e Cadastros.');
}

async function handleWorkChange() {
  state.selectedWorkId = Number($('#workSelect').value);
  state.weatherMiniPosition = null;
  state.selectedWeekId = null;
  state.sheetDraftRows = [];
  state.expectedWeekId = null;
  state.expectedWeekNumber = null;
  state.expectedTasks = [];
  state.expectedEmailContractors = [];
  state.qualityWeekId = null;
  state.qualityWeekNumber = null;
  state.qualityData = null;
  state.ppcMeetingWeekId = null;
  state.ppcMeetingWeekNumber = null;
  state.ppcMeetingData = null;
  showCadastroView('users');
  try {
    await refreshContext();
    setStatus('Obra alterada.');
  } catch (error) {
    setStatus(`Erro ao trocar obra: ${error.message}`, true);
  }
}

async function handleWeekChange() {
  state.selectedWeekId = Number($('#weekSelect').value);
  state.sheetDraftRows = [];
  try {
    if (state.selectedWeekId) {
      await fetchWeatherForWeek(state.selectedWeekId, { silent: true, render: false });
    }
    await loadWeeks();
    syncWeekFieldWithSelectedWeek();
    renderWeather();
    syncTaskDayCheckboxesFromDates();
    await loadTasksAndDashboard();
    setStatus('Semana alterada.');
  } catch (error) {
    setStatus(`Erro ao trocar semana: ${error.message}`, true);
  }
}

async function handleWeekNumberChange() {
  updateWeekFormPreview();
  const weekNumber = numericWeekField();
  if (!weekNumber) return;
  const existing = state.weeks.find((item) => Number(item.weekNumber) === weekNumber);
  if (!existing) return;
  if (Number(existing.id) === Number(state.selectedWeekId)) {
    syncWeekFieldWithSelectedWeek();
    syncTaskDayCheckboxesFromDates();
    return;
  }

  state.selectedWeekId = existing.id;
  state.sheetDraftRows = [];
  try {
    await fetchWeatherForWeek(state.selectedWeekId, { silent: true, render: false });
    await loadWeeks();
    syncWeekFieldWithSelectedWeek();
    renderWeather();
    syncTaskDayCheckboxesFromDates();
    await loadTasksAndDashboard();
    setStatus(`Semana ${weekNumber} selecionada para programação.`);
  } catch (error) {
    setStatus(`Erro ao selecionar semana ${weekNumber}: ${error.message}`, true);
  }
}

function handleWeekNumberTyping() {
  updateWeekFormPreview();
  renderWeather();
  syncTaskDayCheckboxesFromDates();
}

async function handleContractorCreate(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  try {
    const contractorName = $('#contractorName').value.trim();
    const contractorSupervisor = $('#contractorSupervisor').value.trim();
    const contractorEmail = $('#contractorEmail').value.trim();
    const contractorPhone = normalizePhoneDigits($('#contractorPhone').value.trim(), 11);
    const contractorFunction = $('#contractorFunction').value.trim();
    if (
      !isFilled(contractorName)
      || !isFilled(contractorSupervisor)
      || !isFilled(contractorEmail)
      || !isFilled(contractorPhone)
      || !isFilled(contractorFunction)
    ) {
      openContractorValidationModal('Não é possível cadastrar novo empreiteiro. Faltam dados!');
      return;
    }
    if (contractorPhone.length !== 10 && contractorPhone.length !== 11) {
      openContractorValidationModal('Telefone inválido. Informe somente números com DDD (10 ou 11 dígitos).');
      return;
    }
    $('#contractorPhone').value = contractorPhone;
    const payload = {
      name: contractorName,
      supervisor: contractorSupervisor,
      communicationEmail: contractorEmail,
      phone: contractorPhone,
      functionName: contractorFunction,
    };
    const editingId = state.editingContractorId;
    const contractorEndpoint = state.appMode === 'cadastros'
      ? (editingId ? `/global/contractors/${editingId}` : '/global/contractors')
      : (editingId ? `/works/${state.selectedWorkId}/contractors/${editingId}` : `/works/${state.selectedWorkId}/contractors`);
    await api(contractorEndpoint, {
      method: editingId ? 'PUT' : 'POST',
      body: {
        ...payload,
        workId: state.selectedWorkId || null,
      },
    });
    closeContractorModal();
    await loadReferenceData();
    setStatus(editingId ? 'Empreiteiro atualizado.' : 'Empreiteiro cadastrado.');
  } catch (error) {
    openContractorValidationModal(translateApiError(error.message, 'Erro ao cadastrar empreiteiro'));
  }
}

async function handleZoneLevel1Create(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  const level1 = $('#zoneLevel1Name').value.trim();
  if (!level1) return setStatus('Informe o item de Nível 1.', true);

  const editingId = state.editingZoneLevel1Id;
  const editingItem = editingId ? state.locations.find((item) => item.id === editingId) : null;
  const exists = zoneLevel1Names().some((name) => (
    name.toLowerCase() === level1.toLowerCase()
    && (!editingItem || String(editingItem.level1 || '').toLowerCase() !== name.toLowerCase())
  ));
  if (exists) return setStatus('Este item de Nível 1 já existe.', true);

  try {
    if (editingId) {
      await api(`/works/${state.selectedWorkId}/locations/${editingId}`, {
        method: 'PUT',
        body: { level: 1, name: level1 },
      });
      resetZoneLevel1Form();
    } else {
      await api(`/works/${state.selectedWorkId}/locations`, {
        method: 'POST',
        body: { level1, level2: zoneLevel1Marker(level1) },
      });
      resetZoneLevel1Form();
    }
    await loadReferenceData();
    setStatus(editingId ? 'Nível 1 atualizado.' : 'Nível 1 cadastrado.');
  } catch (error) {
    if (String(error.message).includes('location_in_use')) {
      setStatus('Não é possível editar este item: já existe histórico vinculado.', true);
      return;
    }
    setStatus(`Erro ao cadastrar Nível 1: ${translateApiError(error.message, 'Erro ao cadastrar Nível 1')}`, true);
  }
}

async function handleZoneLevel2Create(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  const parent = $('#zoneLevel2Parent').value.trim();
  const level2 = $('#zoneLevel2Name').value.trim();
  if (!parent) return setStatus('Selecione o item de Nível 1.', true);
  if (!level2) return setStatus('Informe o item de Nível 2.', true);
  const editingId = state.editingZoneLevel2Id;

  const validParent = zoneLevel1Names().includes(parent);
  if (!validParent) return setStatus('Nível 1 inválido para vínculo.', true);
  const duplicate = state.locations.some((item) => (
    !isZoneLevel1Row(item)
    && item.level1 === parent
    && String(item.level2 || '').toLowerCase() === level2.toLowerCase()
    && (!editingId || item.id !== editingId)
  ));
  if (duplicate) return setStatus('Este item de Nível 2 já existe neste Nível 1.', true);

  try {
    if (editingId) {
      await api(`/works/${state.selectedWorkId}/locations/${editingId}`, {
        method: 'PUT',
        body: { level: 2, name: level2, parentLevel1: parent },
      });
      resetZoneLevel2Form();
    } else {
      await api(`/works/${state.selectedWorkId}/locations`, {
        method: 'POST',
        body: { level1: parent, level2 },
      });
      resetZoneLevel2Form();
    }
    await loadReferenceData();
    setStatus(editingId ? 'Nível 2 atualizado.' : 'Nível 2 cadastrado e vinculado ao Nível 1.');
  } catch (error) {
    if (String(error.message).includes('location_in_use')) {
      setStatus('Não é possível editar este item: já existe histórico vinculado.', true);
      return;
    }
    setStatus(`Erro ao cadastrar Nível 2: ${translateApiError(error.message, 'Erro ao cadastrar Nível 2')}`, true);
  }
}

async function handleZoneLevel1EditModalSave() {
  if (!state.selectedWorkId || !state.editingZoneLevel1ModalId) return;
  const markerId = Number(state.editingZoneLevel1ModalId);
  const marker = state.locations.find((item) => item.id === markerId);
  if (!marker) {
    setStatus('Item de Nível 1 não encontrado para edição.', true);
    closeZoneLevel1EditModal();
    return;
  }

  const oldLevel1 = String(marker.level1 || '').trim();
  const newLevel1 = String($('#zoneLevel1EditName')?.value || '').trim();
  if (!newLevel1) {
    setStatus('Informe o nome do Nível 1.', true);
    return;
  }

  const duplicatedParent = zoneLevel1Names().some((name) => (
    String(name || '').toLowerCase() === newLevel1.toLowerCase() && String(name || '') !== oldLevel1
  ));
  if (duplicatedParent) {
    setStatus('Já existe outro item de Nível 1 com esse nome.', true);
    return;
  }

  const bulk = String($('#zoneLevel1EditLevel2Bulk')?.value || '');
  const lineValues = [...document.querySelectorAll('#zoneLevel1EditLevel2Lines .zone-level2-line')]
    .map((input) => String(input.value || '').trim());
  const candidateNames = [
    ...bulk.split(/\r?\n/g).map((line) => String(line || '').trim()),
    ...lineValues,
  ].filter(Boolean);

  const uniqueNames = [...new Set(candidateNames.map((name) => name.replace(/\s+/g, ' ').trim()))];
  const existingChildrenNormalized = new Set(
    state.locations
      .filter((item) => !isZoneLevel1Row(item) && String(item.level1 || '').trim() === oldLevel1)
      .map((item) => String(item.level2 || '').trim().toLowerCase()),
  );
  const additions = uniqueNames.filter((name) => !existingChildrenNormalized.has(name.toLowerCase()));

  try {
    if (newLevel1 !== oldLevel1) {
      await api(`/works/${state.selectedWorkId}/locations/${markerId}`, {
        method: 'PUT',
        body: { level: 1, name: newLevel1 },
      });
      await loadReferenceData();
    }

    for (const level2 of additions) {
      await api(`/works/${state.selectedWorkId}/locations`, {
        method: 'POST',
        body: { level1: newLevel1, level2 },
      });
    }

    await loadReferenceData();
    closeZoneLevel1EditModal();
    setStatus('Zoneamento atualizado com sucesso.');
  } catch (error) {
    if (String(error.message).includes('location_in_use')) {
      setStatus('Não é possível renomear este Nível 1: já existe histórico vinculado.', true);
      return;
    }
    setStatus(`Erro ao salvar edição do Zoneamento: ${translateApiError(error.message, 'Erro ao salvar edição do Zoneamento')}`, true);
  }
}

async function handleObraHolidaySubmit(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  const dayDate = normalizeBrDateInput($('#obraHolidayDate').value.trim());
  $('#obraHolidayDate').value = dayDate;
  const description = $('#obraHolidayDescription').value.trim();
  if (!parseBrDate(dayDate)) {
    setStatus('Data de feriado inválida. Use DD/MM/AAAA.', true);
    return;
  }
  if (!description) {
    setStatus('Descrição do feriado é obrigatória.', true);
    return;
  }

  const editingId = state.editingObraHolidayId;
  try {
    await api(editingId
      ? `/works/${state.selectedWorkId}/holidays/${editingId}`
      : `/works/${state.selectedWorkId}/holidays`, {
      method: editingId ? 'PUT' : 'POST',
      body: {
        dayDate,
        description,
      },
    });
    resetObraHolidayForm();
    await loadReferenceData();
    renderWeather();
    renderTasks();
    setStatus(editingId ? 'Feriado atualizado.' : 'Feriado cadastrado.');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao salvar feriado'), true);
  }
}

function handleObraHolidayDateInput() {
  const input = $('#obraHolidayDate');
  if (!input) return;
  input.value = normalizeBrDateInput(input.value);
}

async function handleObraHolidayRowAction(event) {
  const editBtn = event.target.closest('button[data-holiday-edit]');
  if (editBtn) {
    const holidayId = Number(editBtn.dataset.holidayEdit);
    const item = (state.holidays || []).find((row) => Number(row.id) === holidayId);
    if (!item) return;
    state.editingObraHolidayId = holidayId;
    $('#obraHolidayDate').value = formatDate(item.dayDate);
    $('#obraHolidayDescription').value = item.description || '';
    syncObraHolidayFormMode();
    return;
  }

  const deleteBtn = event.target.closest('button[data-holiday-delete]');
  if (!deleteBtn) return;
  const holidayId = Number(deleteBtn.dataset.holidayDelete);
  if (!holidayId) return;
  try {
    await api(`/works/${state.selectedWorkId}/holidays/${holidayId}`, { method: 'DELETE' });
    if (state.editingObraHolidayId === holidayId) resetObraHolidayForm();
    await loadReferenceData();
    renderWeather();
    renderTasks();
    setStatus('Feriado excluído da obra.');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao excluir feriado'), true);
  }
}

async function handleObraHolidayCalendarPdfExport() {
  if (!state.selectedWorkId) return;
  try {
    const blob = await apiBlob(`/works/${state.selectedWorkId}/holidays/calendar/pdf`);
    const work = selectedWork();
    const workPart = sanitizeFileLabel(work?.name || 'Obra');
    const filename = `PPC-Calendario-Feriados-${workPart}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('PDF de calendário de feriados gerado com sucesso.');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF do calendário de feriados'), true);
  }
}

async function handleObraDeadlineRuleSave(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  if (!hasAnyRole(DEADLINE_ROLES)) {
    setStatus('Somente Administrador e Controller podem salvar os prazos da obra.', true);
    return;
  }

  const prePlanningDeadlineWeekday = normalizeWeekdayKey($('#prePlanningDeadlineWeekday').value);
  const prePlanningDeadlineTime = normalizeBrTimeInput($('#prePlanningDeadlineTime').value);
  const ppcMeetingDeadlineWeekday = normalizeWeekdayKey($('#ppcMeetingDeadlineWeekday').value);
  const ppcMeetingDeadlineTime = normalizeBrTimeInput($('#ppcMeetingDeadlineTime').value);
  const planningDeadlineWeekday = normalizeWeekdayKey($('#planningDeadlineWeekday').value);
  const planningDeadlineTime = normalizeBrTimeInput($('#planningDeadlineTime').value);
  const feedbackDeadlineWeekday = normalizeWeekdayKey($('#feedbackDeadlineWeekday').value);
  const feedbackDeadlineTime = normalizeBrTimeInput($('#feedbackDeadlineTime').value);
  const qualityDeadlineWeekday = normalizeWeekdayKey($('#qualityDeadlineWeekday').value);
  const qualityDeadlineTime = normalizeBrTimeInput($('#qualityDeadlineTime').value);

  $('#prePlanningDeadlineTime').value = prePlanningDeadlineTime;
  $('#ppcMeetingDeadlineTime').value = ppcMeetingDeadlineTime;
  $('#planningDeadlineTime').value = planningDeadlineTime;
  $('#feedbackDeadlineTime').value = feedbackDeadlineTime;
  $('#qualityDeadlineTime').value = qualityDeadlineTime;

  if (
    !prePlanningDeadlineWeekday
    || !prePlanningDeadlineTime
    || !ppcMeetingDeadlineWeekday
    || !ppcMeetingDeadlineTime
    || !planningDeadlineWeekday
    || !planningDeadlineTime
    || !feedbackDeadlineWeekday
    || !feedbackDeadlineTime
    || !qualityDeadlineWeekday
    || !qualityDeadlineTime
  ) {
    setStatus('Preencha dia e hora para todos os prazos da obra.', true);
    return;
  }

  if (
    !isValidBrTimeText(prePlanningDeadlineTime)
    || !isValidBrTimeText(ppcMeetingDeadlineTime)
    || !isValidBrTimeText(planningDeadlineTime)
    || !isValidBrTimeText(feedbackDeadlineTime)
    || !isValidBrTimeText(qualityDeadlineTime)
  ) {
    setStatus('Horário inválido. Use sempre o padrão brasileiro de 24h (HH:MM).', true);
    return;
  }

  try {
    const saved = await api(`/works/${state.selectedWorkId}/notification-rule`, {
      method: 'PUT',
      body: {
        prePlanningDeadlineWeekday,
        prePlanningDeadlineTime,
        ppcMeetingDeadlineWeekday,
        ppcMeetingDeadlineTime,
        planningDeadlineWeekday,
        planningDeadlineTime,
        feedbackDeadlineWeekday,
        feedbackDeadlineTime,
        qualityDeadlineWeekday,
        qualityDeadlineTime,
        emailRecipients: state.notificationRule?.emailRecipients || '',
        enabled: typeof state.notificationRule?.enabled === 'boolean' ? state.notificationRule.enabled : true,
      },
    });
    state.notificationRule = saved || null;
    renderObraDeadlineRuleForm();
    closeObraDeadlineSavedModal();
    openObraDeadlineSavedModal();
    setStatus('Prazos salvos.');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao salvar prazos da obra'), true);
  }
}

function parseQualityNumberInput(selector, { integer = false } = {}) {
  const raw = String($(selector)?.value || '').trim().replace(',', '.');
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (integer && !Number.isInteger(value)) return null;
  return value;
}

async function handleObraPerceivedQualitySave(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  if (!hasAnyRole(EDIT_ROLES)) {
    setStatus('Somente Administrador, Engenharia e Controller podem salvar os parâmetros de qualidade percebida.', true);
    return;
  }

  const payload = {
    deadlineRegularPct: parseQualityNumberInput('#qpDeadlineRegularPct'),
    deadlineGoodPct: parseQualityNumberInput('#qpDeadlineGoodPct'),
    qualityRegularScore: parseQualityNumberInput('#qpQualityRegularScore', { integer: true }),
    qualityGoodScore: parseQualityNumberInput('#qpQualityGoodScore', { integer: true }),
    collaborationPresenceImpactScore: parseQualityNumberInput('#qpCollabPresenceImpactScore', { integer: true }),
    collaborationRegularScore: parseQualityNumberInput('#qpCollabRegularScore', { integer: true }),
    collaborationGoodScore: parseQualityNumberInput('#qpCollabGoodScore', { integer: true }),
    safetyRegularScore: parseQualityNumberInput('#qpSafetyRegularScore', { integer: true }),
    safetyGoodScore: parseQualityNumberInput('#qpSafetyGoodScore', { integer: true }),
    cleaningRegularScore: parseQualityNumberInput('#qpCleaningRegularScore', { integer: true }),
    cleaningGoodScore: parseQualityNumberInput('#qpCleaningGoodScore', { integer: true }),
  };

  const allFilled = Object.values(payload).every((value) => value !== null);
  if (!allFilled) {
    setStatus('Preencha todos os campos da Qualidade Percebida.', true);
    return;
  }

  if (
    payload.deadlineRegularPct < 0 || payload.deadlineRegularPct > 100
    || payload.deadlineGoodPct < 0 || payload.deadlineGoodPct > 100
    || payload.deadlineGoodPct < payload.deadlineRegularPct
  ) {
    setStatus('Faixas de Prazo inválidas. Use valores entre 0 e 100 e mantenha Bom maior ou igual a Regular.', true);
    return;
  }

  const scorePairs = [
    [payload.qualityRegularScore, payload.qualityGoodScore],
    [payload.collaborationRegularScore, payload.collaborationGoodScore],
    [payload.safetyRegularScore, payload.safetyGoodScore],
    [payload.cleaningRegularScore, payload.cleaningGoodScore],
  ];
  const invalidScores = scorePairs.some(([regular, good]) => regular < 0 || regular > 10 || good < 0 || good > 10 || good < regular);
  if (invalidScores || payload.collaborationPresenceImpactScore < 0 || payload.collaborationPresenceImpactScore > 10) {
    setStatus('Notas inválidas. Use valores inteiros entre 0 e 10 e mantenha Bom maior ou igual a Regular.', true);
    return;
  }

  try {
    const saved = await api(`/works/${state.selectedWorkId}/perceived-quality-config`, {
      method: 'PUT',
      body: payload,
    });
    state.perceivedQualityConfig = saved || null;
    renderObraPerceivedQualityForm();
    setStatus('Parâmetros de Qualidade Percebida salvos.');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao salvar parâmetros de Qualidade Percebida'), true);
  }
}

async function handleObraContractorFilterChange() {
  state.contractorCatalogFilter = $('#obraContractorFunctionFilter').value.trim();
  if (!state.selectedWorkId || !hasAnyRole(EDIT_ROLES)) return;
  try {
    const query = state.contractorCatalogFilter
      ? `?functionName=${encodeURIComponent(state.contractorCatalogFilter)}`
      : '';
    state.contractorCatalog = await api(`/works/${state.selectedWorkId}/contractors/catalog${query}`);
    renderObraContractors();
  } catch (error) {
    setStatus(`Erro ao carregar catálogo de empreiteiros: ${error.message}`, true);
  }
}

async function handleObraContractorImport(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  const functionName = $('#obraContractorFunctionFilter').value.trim();
  const sourceContractorId = Number($('#obraContractorCatalogSelect').value);
  if (!functionName) {
    setStatus('Selecione o tipo de mão de obra para filtrar.', true);
    return;
  }
  if (!sourceContractorId) {
    setStatus('Selecione o empreiteiro do cadastro geral.', true);
    return;
  }
  try {
    await api(`/works/${state.selectedWorkId}/contractors/import`, {
      method: 'POST',
      body: {
        sourceContractorId,
      },
    });
    await loadReferenceData();
    $('#obraContractorCatalogSelect').value = '';
    setStatus('Empreiteiro carregado para a obra.');
  } catch (error) {
    if (String(error.message).includes('source_must_be_general')) {
      setStatus('Somente empreiteiros do cadastro geral podem ser importados.', true);
      return;
    }
    if (String(error.message).includes('contractor_name_conflict')) {
      setStatus('Já existe empreiteiro com este nome na obra. Ajuste o cadastro geral ou remova o conflito.', true);
      return;
    }
    if (String(error.message).includes('contractor_already_in_work')) {
      setStatus('Este empreiteiro já está cadastrado na obra.', true);
      return;
    }
    setStatus(`Erro ao importar empreiteiro: ${error.message}`, true);
  }
}

async function handleObraTaskGroupImport(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  const templateGroupId = Number($('#obraTaskGroupTemplateSelect').value);
  if (!templateGroupId) {
    setStatus('Selecione um grupo geral para importar.', true);
    return;
  }
  try {
    await api(`/works/${state.selectedWorkId}/task-groups/import-template`, {
      method: 'POST',
      body: { templateGroupId },
    });
    $('#obraTaskGroupTemplateSelect').value = '';
    await loadReferenceData();
    setStatus('Grupo geral carregado para a obra.');
  } catch (error) {
    setStatus(`Erro ao importar grupo: ${error.message}`, true);
  }
}

async function handleObraTaskGroupCreate(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  const name = $('#obraTaskGroupName').value.trim();
  if (!name) return setStatus('Informe o nome do grupo.', true);
  const editingId = state.editingObraTaskGroupId;
  try {
    await api(editingId
      ? `/works/${state.selectedWorkId}/task-groups/${editingId}`
      : `/works/${state.selectedWorkId}/task-groups`, {
      method: editingId ? 'PUT' : 'POST',
      body: { name },
    });
    resetObraTaskGroupForm();
    await loadReferenceData();
    setStatus(editingId ? 'Grupo de atividades atualizado.' : 'Grupo de atividades cadastrado.');
  } catch (error) {
    setStatus(`Erro ao salvar grupo: ${error.message}`, true);
  }
}

async function handleObraTaskGroupItemCreate(event) {
  event.preventDefault();
  const taskGroupId = Number($('#obraTaskGroupSelect').value);
  if (!taskGroupId) return setStatus('Selecione o grupo de atividades.', true);
  const laborType = $('#obraTaskGroupItemLaborType').value.trim();
  if (!laborType) return setStatus('Selecione o tipo de mão de obra cadastrado.', true);
  const description = $('#obraTaskGroupItemDesc').value.trim();
  if (!description) return setStatus('Informe a descrição da tarefa do grupo.', true);
  try {
    const editingId = state.editingObraTaskGroupItemId;
    await api(editingId ? `/task-group-items/${editingId}` : `/task-groups/${taskGroupId}/items`, {
      method: editingId ? 'PUT' : 'POST',
      body: {
        taskGroupId,
        taskDescription: description,
        laborType,
      },
    });
    resetObraTaskGroupItemForm();
    $('#obraTaskGroupSelect').value = String(taskGroupId);
    await loadReferenceData();
    $('#obraTaskGroupSelect').value = String(taskGroupId);
    renderObraTaskGroups();
    setStatus(editingId ? 'Tarefa do grupo atualizada.' : 'Tarefa adicionada ao grupo.');
  } catch (error) {
    setStatus(`Erro ao salvar tarefa no grupo: ${error.message}`, true);
  }
}

async function handleUserModalSave(event) {
  event.preventDefault();
  if (!state.isAdmin) return;

  try {
    const editingId = state.editingUserId || null;
    const name = $('#userModalName').value.trim();
    const company = $('#userModalCompany').value.trim();
    const email = $('#userModalEmail').value.trim();
    const password = $('#userModalPassword').value.trim();
    const role = $('#userModalRole').value.trim();
    const selectedWorkIds = selectedUserModalWorkIds();
    const modalError = $('#userModalError');

    const hasMissing = (
      !isFilled(name)
      || !isFilled(company)
      || !isFilled(email)
      || !isFilled(role)
      || selectedWorkIds.length === 0
      || (!editingId && !isFilled(password))
    );
    if (hasMissing) {
      if (modalError) {
        modalError.textContent = 'Não é permitido salvar, pois faltam informações';
        modalError.classList.remove('hidden');
      }
      return;
    }

    if (modalError) modalError.classList.add('hidden');

    if (!editingId) {
      for (const workId of selectedWorkIds) {
        // eslint-disable-next-line no-await-in-loop
        await api(`/works/${workId}/users`, {
          method: 'POST',
          body: {
            name,
            company,
            email,
            password,
            role,
          },
        });
      }
      closeUserModal();
      await loadReferenceData();
      setStatus('Usuário cadastrado com sucesso.');
      return;
    }

    const editedUser = state.users.find((item) => Number(item.id) === Number(editingId));
    const currentlyLinkedWorkIds = new Set((editedUser?.works || []).map((work) => Number(work.id)));

    for (const workId of selectedWorkIds) {
      if (currentlyLinkedWorkIds.has(Number(workId))) {
        const assignmentId = editedUser?.workRoleByWorkId?.[Number(workId)] || null;
        const payload = {
          name,
          company,
          email,
          role,
        };
        if (assignmentId) payload.assignmentId = assignmentId;
        if (password) payload.password = password;
        // eslint-disable-next-line no-await-in-loop
        await api(`/works/${workId}/users/${editingId}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        // eslint-disable-next-line no-await-in-loop
        await api(`/works/${workId}/users`, {
          method: 'POST',
          body: {
            name,
            company,
            email,
            password,
            role,
          },
        });
      }
    }

    for (const previousWorkId of currentlyLinkedWorkIds) {
      if (selectedWorkIds.includes(previousWorkId)) continue;
      // eslint-disable-next-line no-await-in-loop
      await api(`/works/${previousWorkId}/users/${editingId}`, {
        method: 'DELETE',
      });
    }

    closeUserModal();
    await loadReferenceData();
    setStatus('Usuário atualizado com sucesso.');
  } catch (error) {
    const modalError = $('#userModalError');
    if (modalError) {
      modalError.textContent = translateApiError(error.message, 'Erro ao salvar usuário');
      modalError.classList.remove('hidden');
    } else {
      setStatus(`Erro ao salvar usuário: ${error.message}`, true);
    }
  }
}

async function handlePermissionProfileSubmit(event) {
  event.preventDefault();
  if (!state.isAdmin) return setStatus('Apenas administrador pode gerenciar perfis.', true);

  const name = $('#permissionProfileName').value.trim();
  const baseRole = $('#permissionProfileBaseRole').value.trim();
  const description = $('#permissionProfileDescription').value.trim();
  const permissionKeys = selectedPermissionKeysFromForm();

  if (!isFilled(name) || !isFilled(baseRole) || !isFilled(description)) {
    setStatus('Preencha nome, papel base e descrição do perfil.', true);
    return;
  }
  if (permissionKeys.length === 0) {
    setStatus('Selecione ao menos uma permissão para o perfil.', true);
    return;
  }

  try {
    if (state.editingPermissionProfileId) {
      await api(`/permission-profiles/${state.editingPermissionProfileId}`, {
        method: 'PUT',
        body: { name, baseRole, description, permissionKeys },
      });
      setStatus('Perfil de permissionamento atualizado.');
    } else {
      await api('/permission-profiles', {
        method: 'POST',
        body: { name, baseRole, description, permissionKeys },
      });
      setStatus('Perfil de permissionamento cadastrado.');
    }
    await loadReferenceData();
    resetPermissionProfileForm();
    selectUserCadastroTab('profiles');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao salvar perfil de permissionamento'), true);
  }
}

async function handleCompanySave(event) {
  event.preventDefault();
  if (!state.isAdmin) return setStatus('Apenas administrador pode salvar o cadastro da construtora.', true);

  const companyName = $('#companyName').value.trim();
  const companyCnpj = $('#companyCnpj').value.trim();
  const companyCep = $('#companyCep').value.trim();
  const companyStreet = $('#companyStreet').value.trim();
  const companyNeighborhood = $('#companyNeighborhood').value.trim();
  const companyCity = $('#companyCity').value.trim();
  const companyState = $('#companyState').value.trim();
  const companyNumber = $('#companyNumber').value.trim();
  const companyComplement = $('#companyComplement').value.trim();
  const companySite = $('#companySite').value.trim();
  const logoInput = $('#companyLogo');
  const companyAddress = buildCompanyAddressFromFields({
    street: companyStreet,
    number: companyNumber,
    complement: companyComplement,
    neighborhood: companyNeighborhood,
    city: companyCity,
    stateUf: companyState,
    cep: companyCep,
  });

  const requiredFields = [
    ['Nome da construtora', companyName],
    ['CNPJ', companyCnpj],
    ['CEP', companyCep],
    ['Rua/Avenida', companyStreet],
    ['Bairro', companyNeighborhood],
    ['Cidade', companyCity],
    ['Estado', companyState],
    ['Número', companyNumber],
    ['Site', companySite],
  ];
  const missing = requiredFields.find(([, value]) => !isFilled(value));
  if (missing) return setStatus(`Preencha o campo obrigatório: ${missing[0]}.`, true);

  try {
    let logoPath = state.appConfig?.logoPath || null;
    const logoFile = logoInput?.files && logoInput.files[0] ? logoInput.files[0] : null;
    if (logoFile) {
      if (!String(logoFile.type || '').toLowerCase().startsWith('image/')) {
        setStatus('O logo deve ser um arquivo de imagem.', true);
        return;
      }
      logoPath = await readFileAsDataUrl(logoFile);
    }

    state.appConfig = await api('/app-config', {
      method: 'PUT',
      body: {
        companyName,
        companyCnpj,
        companyAddress,
        companyCep,
        companyStreet,
        companyNeighborhood,
        companyCity,
        companyState,
        companyNumber,
        companyComplement,
        companySite,
        logoPath,
      },
    });
    renderCompanyForm();
    setStatus('Cadastro da construtora salvo.');
    openCompanySavedModal('Cadastro Salvo');
  } catch (error) {
    setStatus(`Erro ao salvar cadastro da construtora: ${error.message}`, true);
  }
}

async function handleCauseCreate(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  try {
    const level = Number($('#causeLevel').value);
    const rawDetail = $('#causeDetail').value.trim();
    const detail = level === 1 ? rawDetail.toLocaleUpperCase('pt-BR') : rawDetail;
    const contractorSpecific = level === 2 && $('#causeContractorSpecific').checked === true;
    if (!detail) return setStatus('Informe a descrição da causa/totalizadora.', true);
    if (level === 2 && !$('#causeParentCategory').value.trim()) {
      return setStatus('Selecione a totalizadora para a causa nível 2.', true);
    }

    const payload = level === 1
      ? { level, description: detail }
      : { level, category: $('#causeParentCategory').value.trim(), cause: detail, contractorSpecific };

    const editingId = state.editingCauseId;
    await api(editingId
      ? `/works/${state.selectedWorkId}/causes/${editingId}`
      : `/works/${state.selectedWorkId}/causes`, {
      method: editingId ? 'PUT' : 'POST',
      body: payload,
    });
    resetCauseForm();
    await loadReferenceData();
    setStatus(editingId ? 'Causa atualizada.' : 'Causa cadastrada.');
  } catch (error) {
    if (String(error.message).includes('parent_totalizer_not_found')) {
      setStatus('Totalizadora não encontrada para causa nível 2.', true);
      return;
    }
    if (String(error.message).includes('cause_already_exists')) {
      setStatus('Esta causa já está cadastrada.', true);
      return;
    }
    setStatus(`Erro ao cadastrar causa: ${error.message}`, true);
  }
}

async function handleTaskGroupCreate(event) {
  event.preventDefault();
  const name = $('#taskGroupName').value.trim();
  if (!name) return setStatus('Informe o nome do grupo.', true);
  const editingId = state.editingTaskGroupId;
  const isGlobalContext = state.appMode === 'cadastros';
  if (!isGlobalContext && !state.selectedWorkId) return;
  try {
    const endpoint = isGlobalContext
      ? (editingId ? `/global/task-groups/${editingId}` : '/global/task-groups')
      : (editingId ? `/works/${state.selectedWorkId}/task-groups/${editingId}` : `/works/${state.selectedWorkId}/task-groups`);
    await api(endpoint, {
      method: editingId ? 'PUT' : 'POST',
      body: { name },
    });
    resetTaskGroupForm();
    await loadReferenceData();
    setStatus(editingId ? 'Grupo de atividades atualizado.' : 'Grupo de atividades cadastrado.');
  } catch (error) {
    setStatus(`Erro ao salvar grupo: ${error.message}`, true);
  }
}

async function handleTaskGroupItemCreate(event) {
  event.preventDefault();
  const taskGroupId = Number($('#taskGroupSelect').value);
  if (!taskGroupId) return setStatus('Selecione o grupo de atividades.', true);
  const laborType = $('#taskGroupItemLaborType').value.trim();
  if (!laborType) return setStatus('Selecione o tipo de mão de obra cadastrado.', true);
  const description = $('#taskGroupItemDesc').value.trim();
  if (!description) return setStatus('Informe a descrição da tarefa do grupo.', true);
  const isGlobalContext = state.appMode === 'cadastros';
  try {
    const editingId = state.editingTaskGroupItemId;
    const endpoint = isGlobalContext
      ? (editingId ? `/global/task-group-items/${editingId}` : `/global/task-groups/${taskGroupId}/items`)
      : (editingId ? `/task-group-items/${editingId}` : `/task-groups/${taskGroupId}/items`);
    await api(endpoint, {
      method: editingId ? 'PUT' : 'POST',
      body: {
        taskGroupId,
        taskDescription: description,
        laborType,
      },
    });
    resetTaskGroupItemForm();
    $('#taskGroupSelect').value = String(taskGroupId);
    await loadReferenceData();
    $('#taskGroupSelect').value = String(taskGroupId);
    renderTaskGroups();
    setStatus(editingId ? 'Tarefa do grupo atualizada.' : 'Tarefa adicionada ao grupo.');
  } catch (error) {
    setStatus(`Erro ao salvar tarefa no grupo: ${error.message}`, true);
  }
}

function handleTaskGroupSelectChange() {
  renderTaskGroups();
}

async function handleWorksRowAction(event) {
  const editBtn = event.target.closest('button[data-work-edit]');
  if (editBtn) {
    const workId = Number(editBtn.dataset.workEdit);
    const work = state.availableWorks.find((w) => w.id === workId);
    if (!work) return;
    state.editingWorkId = workId;
    $('#cadastroWorkName').value = work.name || '';
    $('#cadastroWorkCep').value = work.cep || '';
    $('#cadastroWorkPpcTargetPct').value = Number(work.ppcTargetPct ?? 80).toFixed(2);
    $('#cadastroWorkStartDate').value = formatDate(work.startDate);
    const addressParts = parseWorkAddressParts(work.address || '');
    $('#cadastroWorkNumber').value = addressParts.number || '';
    $('#cadastroWorkComplement').value = addressParts.complement || '';
    try {
      const info = await api(`/utils/cep/${work.cep}`);
      $('#cadastroWorkStreet').value = info.street || '';
      $('#cadastroWorkNeighborhood').value = info.neighborhood || '';
      $('#cadastroWorkCity').value = info.city || '';
      $('#cadastroWorkState').value = info.state || '';
      if (!$('#cadastroWorkNumber').value && addressParts.number) $('#cadastroWorkNumber').value = addressParts.number;
      if (!$('#cadastroWorkComplement').value && addressParts.complement) $('#cadastroWorkComplement').value = addressParts.complement;
    } catch {
      $('#cadastroWorkStreet').value = addressParts.street || '';
      $('#cadastroWorkNeighborhood').value = addressParts.neighborhood || '';
      $('#cadastroWorkCity').value = addressParts.city || '';
      $('#cadastroWorkState').value = addressParts.state || '';
    }
    openWorkModal(true);
    return;
  }

  const deleteBtn = event.target.closest('button[data-work-delete]');
  if (!deleteBtn) return;

  const workId = Number(deleteBtn.dataset.workDelete);
  if (!workId) return;
  try {
    await api(`/works/${workId}`, { method: 'DELETE' });
    state.userWorks = await api('/works');
    state.availableWorks = state.isAdmin ? await api('/works?all=true') : state.userWorks;
    if (state.selectedWorkId === workId) {
      state.selectedWorkId = state.availableWorks[0]?.id || null;
    }
    await refreshContext();
    showCadastroView('works');
    setStatus('Obra excluída.');
  } catch (error) {
    if (String(error.message).includes('work_has_planning_history')) {
      setStatus('Não é possível excluir: a obra possui histórico de planejamento.', true);
      return;
    }
    setStatus(`Erro ao excluir obra: ${error.message}`, true);
  }
}

async function handleContractorRowAction(event) {
  const editBtn = event.target.closest('button[data-contractor-edit]');
  if (editBtn) {
    const contractorId = Number(editBtn.dataset.contractorEdit);
    const item = state.contractors.find((c) => c.id === contractorId);
    if (!item) return;
    state.editingContractorId = contractorId;
    $('#contractorName').value = item.name || '';
    $('#contractorSupervisor').value = item.supervisor || '';
    $('#contractorEmail').value = item.communicationEmail || '';
    $('#contractorPhone').value = normalizePhoneDigits(item.phone || '', 11);
    if (item.laborType) {
      const laborSelect = $('#contractorFunction');
      const exists = [...laborSelect.options].some((option) => option.value === item.laborType);
      if (!exists) {
        const option = document.createElement('option');
        option.value = item.laborType;
        option.textContent = item.laborType;
        laborSelect.appendChild(option);
      }
      laborSelect.value = item.laborType;
    } else {
      $('#contractorFunction').value = '';
    }
    openContractorModal(true);
    return;
  }

  const deleteBtn = event.target.closest('button[data-contractor-delete]');
  if (!deleteBtn) return;
  const contractorId = Number(deleteBtn.dataset.contractorDelete);
  if (!contractorId) return;
  try {
    const endpoint = state.appMode === 'cadastros'
      ? `/global/contractors/${contractorId}`
      : `/works/${state.selectedWorkId}/contractors/${contractorId}`;
    await api(endpoint, { method: 'DELETE' });
    if (state.editingContractorId === contractorId) resetContractorForm();
    await loadReferenceData();
    setStatus('Empreiteiro excluído.');
  } catch (error) {
    setStatus(`Erro ao excluir empreiteiro: ${error.message}`, true);
  }
}

async function handleObraContractorRowAction(event) {
  const deleteBtn = event.target.closest('button[data-obra-contractor-delete]');
  if (!deleteBtn) return;
  const contractorId = Number(deleteBtn.dataset.obraContractorDelete);
  if (!contractorId) return;
  try {
    const result = await api(`/works/${state.selectedWorkId}/contractors/${contractorId}`, { method: 'DELETE' });
    await loadReferenceData();
    if (result?.deselected) {
      setStatus('Empreiteiro removido apenas da obra (cadastro geral preservado).');
      return;
    }
    if (result?.archived) {
      setStatus('Empreiteiro removido das próximas semanas (histórico preservado).');
    } else {
      setStatus('Empreiteiro excluído da obra.');
    }
  } catch (error) {
    if (String(error.message).includes('contractor_in_use')) {
      setStatus('Não é possível excluir: empreiteiro em uso por usuário/grupo.', true);
      return;
    }
    setStatus(`Erro ao excluir empreiteiro: ${error.message}`, true);
  }
}

async function handleZoneamentoRowAction(event) {
  const toggleBtn = event.target.closest('button[data-zone-toggle-parent]');
  if (toggleBtn) {
    const parent = String(toggleBtn.dataset.zoneToggleParent || '').trim();
    if (!parent) return;
    if (state.zoneCollapsedParents.has(parent)) state.zoneCollapsedParents.delete(parent);
    else state.zoneCollapsedParents.add(parent);
    renderObraZoneamento();
    return;
  }

  const editLevel1Btn = event.target.closest('button[data-zone-level1-edit]');
  if (editLevel1Btn) {
    const locationId = Number(editLevel1Btn.dataset.zoneLevel1Edit);
    const item = state.locations.find((row) => row.id === locationId);
    if (!item) return;
    state.editingZoneLevel1ModalId = locationId;
    const nameInput = $('#zoneLevel1EditName');
    const bulkInput = $('#zoneLevel1EditLevel2Bulk');
    const lines = $('#zoneLevel1EditLevel2Lines');
    if (nameInput) nameInput.value = item.level1 || '';
    if (bulkInput) bulkInput.value = '';
    if (lines) lines.innerHTML = '';
    appendZoneLevel2ModalLine();
    syncZoneLevel1EditModal();
    return;
  }

  const deleteLevel1Btn = event.target.closest('button[data-zone-level1-delete]');
  if (deleteLevel1Btn) {
    const locationId = Number(deleteLevel1Btn.dataset.zoneLevel1Delete);
    if (!locationId) return;
    try {
      await api(`/works/${state.selectedWorkId}/locations/${locationId}`, { method: 'DELETE' });
      if (state.editingZoneLevel1Id === locationId) resetZoneLevel1Form();
      await loadReferenceData();
      setStatus('Item de Nível 1 excluído.');
    } catch (error) {
      if (String(error.message).includes('location_in_use')) {
        setStatus('Não é possível excluir: item com histórico vinculado.', true);
        return;
      }
      setStatus(`Erro ao excluir item de Nível 1: ${error.message}`, true);
    }
    return;
  }

  const deleteLevel2Btn = event.target.closest('button[data-zone-level2-delete]');
  if (!deleteLevel2Btn) return;
  const locationId = Number(deleteLevel2Btn.dataset.zoneLevel2Delete);
  if (!locationId) return;
  try {
    await api(`/works/${state.selectedWorkId}/locations/${locationId}`, { method: 'DELETE' });
    if (state.editingZoneLevel2Id === locationId) resetZoneLevel2Form();
    await loadReferenceData();
    setStatus('Item de Nível 2 excluído.');
  } catch (error) {
    if (String(error.message).includes('location_in_use')) {
      setStatus('Não é possível excluir: item com histórico vinculado.', true);
      return;
    }
    setStatus(`Erro ao excluir item de Nível 2: ${error.message}`, true);
  }
}

async function handleTaskGroupItemRowAction(event) {
  const isGlobalContext = state.appMode === 'cadastros';
  const editGroupBtn = event.target.closest('button[data-group-edit]');
  if (editGroupBtn) {
    const groupId = Number(editGroupBtn.dataset.groupEdit);
    const group = state.taskGroups.find((item) => (
      item.id === groupId
      && (isGlobalContext ? item.workId === null : Number(item.workId) === Number(state.selectedWorkId))
    ));
    if (!group) return;
    resetTaskGroupItemForm();
    state.editingTaskGroupId = groupId;
    $('#taskGroupName').value = group.name || '';
    syncTaskGroupFormMode();
    return;
  }

  const deleteGroupBtn = event.target.closest('button[data-group-delete]');
  if (deleteGroupBtn) {
    const groupId = Number(deleteGroupBtn.dataset.groupDelete);
    if (!groupId) return;
    try {
      const endpoint = isGlobalContext
        ? `/global/task-groups/${groupId}`
        : `/works/${state.selectedWorkId}/task-groups/${groupId}`;
      await api(endpoint, { method: 'DELETE' });
      if (state.editingTaskGroupId === groupId) resetTaskGroupForm();
      await loadReferenceData();
      renderTaskGroups();
      setStatus('Grupo de atividades excluído.');
    } catch (error) {
      setStatus(`Erro ao excluir grupo: ${error.message}`, true);
    }
    return;
  }

  const editBtn = event.target.closest('button[data-group-item-edit]');
  if (editBtn) {
    const itemId = Number(editBtn.dataset.groupItemEdit);
    let foundItem = null;
    let foundGroupId = null;
    for (const group of state.taskGroups) {
      const item = (group.items || []).find((row) => row.id === itemId);
      if (item) {
        foundItem = item;
        foundGroupId = group.id;
        break;
      }
    }
    if (!foundItem || !foundGroupId) return;
    const hasGroupOption = [...$('#taskGroupSelect').options].some((option) => Number(option.value) === Number(foundGroupId));
    if (!hasGroupOption) {
      setStatus('Este grupo é somente leitura nesta obra.', true);
      return;
    }
    state.editingTaskGroupItemId = itemId;
    $('#taskGroupSelect').value = String(foundGroupId);
    $('#taskGroupItemDesc').value = foundItem.description || '';
    $('#taskGroupItemLaborType').value = foundItem.laborType || '';
    syncTaskGroupItemFormMode();
    return;
  }

  const deleteBtn = event.target.closest('button[data-group-item-delete]');
  if (!deleteBtn) return;
  const itemId = Number(deleteBtn.dataset.groupItemDelete);
  if (!itemId) return;
  try {
    const endpoint = isGlobalContext
      ? `/global/task-group-items/${itemId}`
      : `/task-group-items/${itemId}`;
    await api(endpoint, { method: 'DELETE' });
    if (state.editingTaskGroupItemId === itemId) resetTaskGroupItemForm();
    await loadReferenceData();
    renderTaskGroups();
    setStatus('Tarefa do grupo excluída.');
  } catch (error) {
    setStatus(`Erro ao excluir tarefa do grupo: ${error.message}`, true);
  }
}

async function handleObraTaskGroupItemRowAction(event) {
  const editGroupBtn = event.target.closest('button[data-obra-group-edit]');
  if (editGroupBtn) {
    const groupId = Number(editGroupBtn.dataset.obraGroupEdit);
    const group = state.taskGroups.find((item) => item.id === groupId && Number(item.workId) === Number(state.selectedWorkId));
    if (!group) return;
    resetObraTaskGroupItemForm();
    state.editingObraTaskGroupId = groupId;
    $('#obraTaskGroupName').value = group.name || '';
    syncObraTaskGroupFormMode();
    return;
  }

  const deleteGroupBtn = event.target.closest('button[data-obra-group-delete]');
  if (deleteGroupBtn) {
    const groupId = Number(deleteGroupBtn.dataset.obraGroupDelete);
    if (!groupId) return;
    try {
      await api(`/works/${state.selectedWorkId}/task-groups/${groupId}`, { method: 'DELETE' });
      if (state.editingObraTaskGroupId === groupId) resetObraTaskGroupForm();
      await loadReferenceData();
      renderObraTaskGroups();
      setStatus('Grupo de atividades da obra excluído.');
    } catch (error) {
      setStatus(`Erro ao excluir grupo da obra: ${error.message}`, true);
    }
    return;
  }

  const editBtn = event.target.closest('button[data-obra-group-item-edit]');
  if (editBtn) {
    const itemId = Number(editBtn.dataset.obraGroupItemEdit);
    let foundItem = null;
    let foundGroupId = null;
    for (const group of state.taskGroups.filter((item) => Number(item.workId) === Number(state.selectedWorkId))) {
      const item = (group.items || []).find((row) => row.id === itemId);
      if (item) {
        foundItem = item;
        foundGroupId = group.id;
        break;
      }
    }
    if (!foundItem || !foundGroupId) return;
    resetObraTaskGroupForm();
    state.editingObraTaskGroupItemId = itemId;
    $('#obraTaskGroupSelect').value = String(foundGroupId);
    $('#obraTaskGroupItemDesc').value = foundItem.description || '';
    $('#obraTaskGroupItemLaborType').value = foundItem.laborType || '';
    syncObraTaskGroupItemFormMode();
    return;
  }

  const deleteBtn = event.target.closest('button[data-obra-group-item-delete]');
  if (!deleteBtn) return;
  const itemId = Number(deleteBtn.dataset.obraGroupItemDelete);
  if (!itemId) return;
  try {
    await api(`/task-group-items/${itemId}`, { method: 'DELETE' });
    if (state.editingObraTaskGroupItemId === itemId) resetObraTaskGroupItemForm();
    await loadReferenceData();
    renderObraTaskGroups();
    setStatus('Tarefa do grupo excluída.');
  } catch (error) {
    setStatus(`Erro ao excluir tarefa do grupo: ${error.message}`, true);
  }
}

function handleUserRowAction(event) {
  const editBtn = event.target.closest('button[data-user-edit]');
  if (!editBtn) return;

  const userId = Number(editBtn.dataset.userEdit);
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  openUserModal({ user });
}

async function handlePermissionProfileRowAction(event) {
  const editBtn = event.target.closest('button[data-permission-profile-edit]');
  if (editBtn) {
    const profileId = Number(editBtn.dataset.permissionProfileEdit);
    const profile = state.permissionProfiles.find((item) => Number(item.id) === profileId);
    if (!profile) return;
    state.editingPermissionProfileId = profile.id;
    $('#permissionProfileName').value = profile.name || '';
    $('#permissionProfileBaseRole').value = profile.baseRole || '';
    $('#permissionProfileDescription').value = profile.description || '';
    renderPermissionCatalog(profile.permissionKeys || []);
    syncPermissionProfileFormMode();
    selectUserCadastroTab('profiles');
    return;
  }

  const deleteBtn = event.target.closest('button[data-permission-profile-delete]');
  if (!deleteBtn) return;
  const profileId = Number(deleteBtn.dataset.permissionProfileDelete);
  if (!profileId) return;
  try {
    await api(`/permission-profiles/${profileId}`, { method: 'DELETE' });
    if (state.editingPermissionProfileId === profileId) resetPermissionProfileForm();
    await loadReferenceData();
    setStatus('Perfil de permissionamento excluído.');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao excluir perfil de permissionamento'), true);
  }
}

async function handleCauseRowAction(event) {
  const editBtn = event.target.closest('button[data-cause-edit]');
  if (editBtn) {
    const causeId = Number(editBtn.dataset.causeEdit);
    const cause = state.causes.find((c) => c.id === causeId);
    if (!cause) return;
    state.editingCauseId = causeId;
    $('#causeLevel').value = String(cause.level || 1);
    if (Number(cause.level) === 2 && cause.category) {
      const parentSelect = $('#causeParentCategory');
      const exists = [...parentSelect.options].some((option) => option.value === cause.category);
      if (!exists) {
        const option = document.createElement('option');
        option.value = cause.category;
        option.textContent = cause.category;
        parentSelect.appendChild(option);
      }
    }
    $('#causeParentCategory').value = cause.category || '';
    $('#causeDetail').value = Number(cause.level) === 1 ? (cause.category || '') : (cause.cause || '');
    $('#causeContractorSpecific').checked = Number(cause.level) === 2 && cause.contractorSpecific === true;
    applyCauseLevelUi();
    syncCauseFormMode();
    return;
  }

  const deleteBtn = event.target.closest('button[data-cause-delete]');
  if (!deleteBtn) return;
  const causeId = Number(deleteBtn.dataset.causeDelete);
  if (!causeId) return;
  try {
    await api(`/works/${state.selectedWorkId}/causes/${causeId}`, { method: 'DELETE' });
    if (state.editingCauseId === causeId) resetCauseForm();
    await loadReferenceData();
    setStatus('Causa excluída.');
  } catch (error) {
    if (String(error.message).includes('cause_has_children')) {
      setStatus('Não é possível excluir totalizadora com causas vinculadas.', true);
      return;
    }
    setStatus(`Erro ao excluir causa: ${error.message}`, true);
  }
}

async function handleLaborTypeCreate(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  try {
    const editingId = state.editingLaborTypeId;
    const normalizedName = $('#contractorFunctionName').value.trim().toLocaleUpperCase('pt-BR');
    if (!normalizedName) {
      setStatus('Informe o tipo de mão de obra.', true);
      return;
    }
    await api(editingId
      ? `/works/${state.selectedWorkId}/contractor-functions/${editingId}`
      : `/works/${state.selectedWorkId}/contractor-functions`, {
      method: editingId ? 'PUT' : 'POST',
      body: { name: normalizedName },
    });
    resetLaborTypeForm();
    await loadReferenceData();
    setStatus(editingId ? 'Tipo de mão de obra atualizado.' : 'Tipo de mão de obra cadastrado.');
  } catch (error) {
    if (String(error.message).includes('name_already_exists')) {
      setStatus('Já existe tipo de mão de obra com este nome.', true);
      return;
    }
    setStatus(`Erro ao salvar tipo de mão de obra: ${error.message}`, true);
  }
}

async function handleLaborTypeRowAction(event) {
  const editBtn = event.target.closest('button[data-labor-edit]');
  if (editBtn) {
    const laborId = Number(editBtn.dataset.laborEdit);
    const row = state.contractorFunctions.find((item) => item.id === laborId);
    if (!row) return;
    state.editingLaborTypeId = laborId;
    $('#contractorFunctionName').value = String(row.name || '').toLocaleUpperCase('pt-BR');
    syncLaborTypeFormMode();
    return;
  }

  const deleteBtn = event.target.closest('button[data-labor-delete]');
  if (!deleteBtn) return;
  const laborId = Number(deleteBtn.dataset.laborDelete);
  if (!laborId) return;
  try {
    await api(`/works/${state.selectedWorkId}/contractor-functions/${laborId}`, { method: 'DELETE' });
    if (state.editingLaborTypeId === laborId) resetLaborTypeForm();
    await loadReferenceData();
    setStatus('Tipo de mão de obra excluído.');
  } catch (error) {
    if (String(error.message).includes('labor_type_in_use')) {
      setStatus('Não é possível excluir: tipo de mão de obra em uso.', true);
      return;
    }
    setStatus(`Erro ao excluir tipo de mão de obra: ${error.message}`, true);
  }
}

async function handleWeekCreate(event) {
  event.preventDefault();
  if (!state.selectedWorkId) return;
  const weekNumber = Number.parseInt($('#weekNumber').value, 10);
  if (Number.isNaN(weekNumber) || weekNumber <= 0) {
    setStatus('Informe um número de semana válido.', true);
    return;
  }
  try {
    const created = await api(`/works/${state.selectedWorkId}/weeks`, {
      method: 'POST',
      body: {
        weekNumber,
      },
    });
    const weatherFetch = await fetchWeatherForWeek(created.id, { silent: true, render: false });
    const weatherOk = Boolean(weatherFetch?.weatherDays);
    state.selectedWeekId = created.id;
    state.sheetDraftRows = [];
    await loadWeeks();
    syncWeekFieldWithSelectedWeek();
    if (weatherFetch?.weatherDays) {
      renderWeather();
    }
    await loadTasksAndDashboard();
    setStatus(weatherOk
      ? `Semana ${created.weekNumber} criada e previsão do tempo atualizada automaticamente.`
      : `Semana ${created.weekNumber} criada, mas não foi possível atualizar a previsão agora.`);
  } catch (error) {
    setStatus(`Erro ao abrir semana: ${error.message}`, true);
  }
}

async function handleWeekRefresh() {
  try {
    const modeLabel = planningModeLabel();
    let targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
    if (!targetWeek?.id) {
      const typedWeekNumber = numericWeekField();
      if (typedWeekNumber) {
        targetWeek = await ensureWeekExists(typedWeekNumber, { silent: true });
        if (targetWeek?.id) {
          state.selectedWeekId = targetWeek.id;
        }
      }
    }
    if (!targetWeek?.id) {
      const msg = 'Não foi possível disponibilizar a semana informada agora.';
      setStatus(msg, true);
      openPlanningValidationModal(msg, [], { title: 'Atualização da Semana' });
      return;
    }

    const weatherFetch = await fetchWeatherForWeek(targetWeek.id, { silent: true, render: false });

    await loadWeeks();
    if (weatherFetch?.weatherDays) {
      renderWeather();
    }
    await loadTasksAndDashboard();

    const refreshedWeek = state.weeks.find((item) => Number(item.id) === Number(targetWeek.id)) || targetWeek;
    const msg = `${modeLabel} atualizada. Semana considerada ${refreshedWeek.weekNumber}.`;
    setStatus(msg);
    openPlanningValidationModal(msg, [], { title: 'Atualização da Semana' });
  } catch (error) {
    const msg = `Erro ao atualizar semana: ${error.message}`;
    setStatus(msg, true);
    openPlanningValidationModal(msg, [], { title: 'Atualização da Semana' });
  }
}

async function refreshExpectedActivitiesTab(options = {}) {
  const useDefaultNext = options.useDefaultNext === true;
  const silent = options.silent === true;
  const weekInput = $('#expectedWeekNumber');
  if (!weekInput) return;

  if (useDefaultNext) {
    const suggested = suggestedNextWeekNumberForCurrentWork();
    if (suggested) weekInput.value = String(suggested);
  }

  const weekNumber = expectedWeekNumberField();
  updateExpectedWeekPreview();
  if (!weekNumber) {
    state.expectedWeekId = null;
    state.expectedWeekNumber = null;
    state.expectedTasks = [];
    state.expectedEmailContractors = [];
    renderExpectedTasksTable([], { emptyMessage: 'Informe uma semana para visualizar atividades previstas.' });
    renderExpectedExportActions(null, []);
    if (!silent) setStatus('Informe o número da semana para atualizar atividades previstas.', true);
    return;
  }

  const week = state.weeks.find((item) => Number(item.weekNumber) === Number(weekNumber));
  if (!week) {
    state.expectedWeekId = null;
    state.expectedWeekNumber = weekNumber;
    state.expectedTasks = [];
    state.expectedEmailContractors = [];
    renderExpectedTasksTable([], { emptyMessage: `Semana ${weekNumber} ainda não está disponível.` });
    renderExpectedExportActions(null, []);
    if (!silent) setStatus(`Semana ${weekNumber} ainda não está disponível.`, true);
    return;
  }

  const planningClosed = String(week.planningStatus || '').toUpperCase() === 'CLOSED';
  if (!planningClosed) {
    state.expectedWeekId = week.id;
    state.expectedWeekNumber = week.weekNumber;
    state.expectedTasks = [];
    state.expectedEmailContractors = [];
    renderExpectedTasksTable([], {
      emptyMessage: `Atividades previstas só ficam disponíveis após o fechamento do planejamento da Semana ${week.weekNumber}.`,
    });
    renderExpectedExportActions(week, []);
    if (!silent) setStatus(`Semana ${week.weekNumber} ainda não está com planejamento fechado.`, true);
    return;
  }

  const tasks = await api(`/weeks/${week.id}/tasks`);
  state.expectedWeekId = week.id;
  state.expectedWeekNumber = week.weekNumber;
  state.expectedTasks = tasks;
  state.expectedEmailContractors = [];
  renderExpectedTasksTable(tasks);
  renderExpectedExportActions(week, tasks);
  if (!silent) setStatus(`Atividades previstas atualizadas. Semana considerada ${week.weekNumber}.`);
}

async function refreshPpcMeetingTab(options = {}) {
  const useDefaultNext = options.useDefaultNext === true;
  const autoCreateMissingWeek = options.autoCreateMissingWeek === true;
  const silent = options.silent === true;
  const weekInput = $('#ppcMeetingWeekNumber');
  if (!weekInput) return;

  if (useDefaultNext) {
    const suggested = suggestedNextWeekNumberForCurrentWork();
    if (suggested) weekInput.value = String(suggested);
  }

  const weekNumber = ppcMeetingWeekNumberField();
  updatePpcMeetingWeekPreview();
  if (!weekNumber) {
    state.ppcMeetingWeekId = null;
    state.ppcMeetingWeekNumber = null;
    state.ppcMeetingData = null;
    renderPpcMeetingTab();
    if (!silent) setStatus('Informe o número da semana para carregar a reunião de PPC.', true);
    return;
  }

  let week = state.weeks.find((item) => Number(item.weekNumber) === Number(weekNumber));
  if (!week && autoCreateMissingWeek) {
    week = await ensureWeekExists(weekNumber, { silent: true });
  }
  if (!week) {
    state.ppcMeetingWeekId = null;
    state.ppcMeetingWeekNumber = weekNumber;
    state.ppcMeetingData = null;
    renderPpcMeetingTab();
    if (!silent) setStatus(`Semana ${weekNumber} ainda não está disponível.`, true);
    return;
  }

  const meeting = await api(`/weeks/${week.id}/ppc-meeting`);
  state.ppcMeetingWeekId = week.id;
  state.ppcMeetingWeekNumber = week.weekNumber;
  state.ppcMeetingData = meeting;
  renderPpcMeetingTab();
  if (!silent) setStatus(`Reunião de PPC atualizada. Semana considerada ${week.weekNumber}.`);
}

async function refreshFeedbackTab(options = {}) {
  const useDefaultPrevious = options.useDefaultPrevious === true;
  const silent = options.silent === true;
  const weekInput = $('#feedbackWeekNumber');
  if (!weekInput) return;

  if (useDefaultPrevious) {
    const suggested = suggestedFeedbackWeekNumberForCurrentWork();
    if (suggested) {
      weekInput.value = String(suggested);
    } else if (!weekInput.value && state.weeks.length) {
      weekInput.value = String(state.weeks[state.weeks.length - 1].weekNumber);
    }
  }

  const weekNumber = feedbackWeekNumberField();
  updateFeedbackWeekPreview();
  if (!weekNumber) {
    syncFeedbackComparisonPdfButton();
    if (!silent) setStatus('Informe o número da semana para carregar o feedback.', true);
    return;
  }

  const week = state.weeks.find((item) => Number(item.weekNumber) === Number(weekNumber));
  if (!week) {
    if (!silent) setStatus(`Semana ${weekNumber} ainda não está disponível.`, true);
    const body = $('#feedbackTasksBody');
    if (body) body.innerHTML = '<tr><td colspan="16">Semana não encontrada.</td></tr>';
    const submitBtn = $('#saveFeedbackInlineBtn');
    if (submitBtn) submitBtn.disabled = true;
    const closeBtn = $('#closeFeedbackWeekBtn');
    if (closeBtn) closeBtn.disabled = true;
    syncFeedbackComparisonPdfButton();
    state.closeFeedbackPending = false;
    closeFeedbackCloseConfirmModal();
    renderFeedbackNewTaskForm(false);
    return;
  }

  if (Number(week.id) !== Number(state.selectedWeekId)) {
    state.selectedWeekId = week.id;
    state.sheetDraftRows = [];
    await loadWeeks();
  }

  await loadTasksAndDashboard();
  clearScreenDirty('feedback');
  syncFeedbackComparisonPdfButton();
  if (!silent) setStatus(`Feedback carregado. Semana considerada ${week.weekNumber}.`);
}

async function handleExpectedExportExcel() {
  try {
    const week = expectedWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida em Atividades previstas.', true);
    if (String(week.planningStatus || '').toUpperCase() !== 'CLOSED') {
      return setStatus('A exportação de atividades previstas só é permitida após fechamento do planejamento.', true);
    }
    const blob = await apiBlob(`/weeks/${week.id}/tasks/export/expected/xlsx`);
    const filename = `PPC-Semana-${week.weekNumber}-Atividades-Previstas.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Excel das atividades previstas exportado.');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao exportar atividades previstas (Excel)'), true);
  }
}

async function handleExpectedContractorPdfExport(contractorId, contractorName) {
  try {
    const week = expectedWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida em Atividades previstas.', true);
    if (String(week.planningStatus || '').toUpperCase() !== 'CLOSED') {
      return setStatus('A geração de PDF só é permitida após fechamento do planejamento.', true);
    }
    const blob = await apiBlob(`/weeks/${week.id}/tasks/export/contractor/${contractorId}/pdf`);
    const contractorPart = sanitizeFileLabel(contractorName) || `empreiteiro-${contractorId}`;
    const filename = `PPC-Semana-${week.weekNumber}-${contractorPart}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF do empreiteiro ${contractorName || contractorId} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF do empreiteiro'), true);
  }
}

async function handleExpectedWeekPdfExport() {
  try {
    const week = expectedWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida em Atividades previstas.', true);
    if (String(week.planningStatus || '').toUpperCase() !== 'CLOSED') {
      return setStatus('A geração de PDF só é permitida após fechamento do planejamento.', true);
    }
    const blob = await apiBlob(`/weeks/${week.id}/tasks/export/all/pdf`);
    const filename = `PPC-Semana-${week.weekNumber}-Todas-Atividades.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF geral da Semana ${week.weekNumber} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF geral da semana'), true);
  }
}

function closeExpectedEmailModal() {
  const modal = $('#expectedEmailModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openExpectedEmailModal() {
  const week = expectedWeekSelected();
  if (!week?.id) {
    setStatus('Selecione uma semana válida em Atividades previstas.', true);
    return;
  }
  if (String(week.planningStatus || '').toUpperCase() !== 'CLOSED') {
    setStatus('O envio por e-mail só é permitido após fechamento do planejamento da semana.', true);
    return;
  }

  const contractors = Array.isArray(state.expectedEmailContractors) ? state.expectedEmailContractors : [];
  if (!contractors.length) {
    setStatus('Sem empreiteiros com atividades validadas para envio nesta semana.', true);
    return;
  }

  const modal = $('#expectedEmailModal');
  const listEl = $('#expectedEmailContractorList');
  if (!modal || !listEl) return;
  listEl.innerHTML = '';
  contractors.forEach((row) => {
    const item = document.createElement('label');
    item.className = 'checkbox-inline';
    item.innerHTML = `<input type="checkbox" value="${row.id}" checked /> ${escapeHtml(row.name || '-')} (${escapeHtml(row.laborType || '-')})`;
    listEl.appendChild(item);
  });
  modal.classList.remove('hidden');
}

function handleExpectedEmailSendSelected() {
  const week = expectedWeekSelected();
  if (!week?.id) {
    setStatus('Selecione uma semana válida em Atividades previstas.', true);
    return;
  }
  if (String(week.planningStatus || '').toUpperCase() !== 'CLOSED') {
    setStatus('O envio por e-mail só é permitido após fechamento do planejamento da semana.', true);
    return;
  }

  const checks = [...document.querySelectorAll('#expectedEmailContractorList input[type="checkbox"]:checked')];
  if (!checks.length) {
    setStatus('Selecione ao menos um empreiteiro para envio.', true);
    return;
  }

  const selectedNames = checks
    .map((input) => Number.parseInt(input.value || '', 10))
    .filter((id) => Number.isFinite(id))
    .map((id) => state.expectedEmailContractors.find((row) => Number(row.id) === Number(id)))
    .filter(Boolean)
    .map((row) => row.name)
    .join(', ');

  closeExpectedEmailModal();
  setStatus(`Fluxo preparado: envio dos PDFs de atividades previstas para ${selectedNames}.`);
}

async function handleExpectedAttendancePdfExport() {
  try {
    const week = expectedWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida em Atividades previstas.', true);
    if (String(week.planningStatus || '').toUpperCase() !== 'CLOSED') {
      return setStatus('A geração de PDF só é permitida após fechamento do planejamento.', true);
    }
    const blob = await apiBlob(`/weeks/${week.id}/tasks/export/attendance/pdf`);
    const filename = `PPC-Semana${week.weekNumber}-Ata-Reunião.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF de ata da Semana ${week.weekNumber} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF da ata de reunião'), true);
  }
}

async function handlePrePlanningAllPdfExport() {
  try {
    const targetWeek = activeTabName() === 'reuniaoppc'
      ? ppcMeetingWeekSelected()
      : await syncSelectedWeekFromWeekFieldIfNeeded();
    if (!targetWeek?.id) return setStatus('Selecione uma semana válida para gerar PDF da pré-programação.', true);
    if (String(targetWeek.prePlanningStatus || '').toUpperCase() !== 'CLOSED') {
      setStatus('O PDF da pré-programação só é liberado após fechar a pré-programação da semana.', true);
      return;
    }
    const blob = await apiBlob(`/weeks/${targetWeek.id}/tasks/export/all/pdf?phase=pre`);
    const filename = `PPC-Pre-Programacao-Semana-${targetWeek.weekNumber}-Todas-Atividades.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF geral da Pré-programação da Semana ${targetWeek.weekNumber} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF geral da pré-programação'), true);
  }
}

async function handlePrePlanningContractorPdfExport(contractorId, contractorName) {
  try {
    const targetWeek = activeTabName() === 'reuniaoppc'
      ? ppcMeetingWeekSelected()
      : await syncSelectedWeekFromWeekFieldIfNeeded();
    if (!targetWeek?.id) return setStatus('Selecione uma semana válida para gerar PDF da pré-programação.', true);
    if (String(targetWeek.prePlanningStatus || '').toUpperCase() !== 'CLOSED') {
      setStatus('O PDF da pré-programação só é liberado após fechar a pré-programação da semana.', true);
      return;
    }
    const blob = await apiBlob(`/weeks/${targetWeek.id}/tasks/export/contractor/${contractorId}/pdf?phase=pre`);
    const contractorPart = sanitizeFileLabel(contractorName) || `empreiteiro-${contractorId}`;
    const filename = `PPC-Pre-Programacao-Semana-${targetWeek.weekNumber}-${contractorPart}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF da Pré-programação do empreiteiro ${contractorName || contractorId} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF da pré-programação por empreiteiro'), true);
  }
}

function ppcMeetingAttendancePayloadFromScreen() {
  return [...document.querySelectorAll('#ppcMeetingAttendanceBody input.ppc-presence-checkbox[data-contractor-id]')]
    .map((input) => ({
      contractorId: Number.parseInt(input.dataset.contractorId || '', 10),
      present: input.checked === true,
    }))
    .filter((item) => Number.isFinite(item.contractorId) && item.contractorId > 0);
}

async function handlePpcMeetingSavePre() {
  if (state.weekSheetSaveInProgress) return;
  try {
    state.weekSheetSaveInProgress = true;
    setMeetingSavingLock(true);
    openGenericSaveProgressModal(12, 'Validando data e hora da reunião...', 'Salvando reunião de PPC');
    const week = ppcMeetingWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida na aba Reunião de PPC.', true);
    if (String(week.prePlanningStatus || '').toUpperCase() !== 'CLOSED') {
      const message = 'Você precisa fechar a pré-programação primeiro';
      openPpcMeetingValidationModal(message);
      setStatus(message, true);
      return;
    }
    const meetingDateRaw = String($('#ppcMeetingDate')?.value || '').trim();
    const meetingTimeRaw = String($('#ppcMeetingTime')?.value || '').trim();
    if (!meetingDateRaw || !meetingTimeRaw) return setStatus('Informe data e hora da reunião de PPC.', true);
    const parsed = parseBrDateTimeToIso(meetingDateRaw, meetingTimeRaw);
    if (parsed.error) return setStatus(translateApiError(parsed.error, 'Dados de reunião inválidos'), true);
    const payload = { meetingAt: parsed.iso };
    updateGenericSaveProgress(55, 'Salvando data e hora da reunião...', 'Salvando reunião de PPC');
    await api(`/weeks/${week.id}/ppc-meeting/pre`, { method: 'PUT', body: payload });
    updateGenericSaveProgress(84, 'Recarregando reunião da semana...', 'Salvando reunião de PPC');
    await refreshPpcMeetingTab({ useDefaultNext: false, silent: true });
    updateGenericSaveProgress(100, 'Salvamento concluído.', 'Salvando reunião de PPC');
    setStatus(`Data/hora da reunião de PPC salva para a Semana ${week.weekNumber}.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao salvar dados da pré-reunião'), true);
  } finally {
    state.weekSheetSaveInProgress = false;
    setMeetingSavingLock(false);
    window.setTimeout(() => closeGenericSaveProgressModal(), 250);
  }
}

async function handlePpcMeetingPreMinutesPdfExport() {
  try {
    const week = ppcMeetingWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida na aba Reunião de PPC.', true);
    if (String(week.prePlanningStatus || '').toUpperCase() !== 'CLOSED') {
      const message = 'Você precisa fechar a pré-programação primeiro';
      openPpcMeetingValidationModal(message);
      setStatus(message, true);
      return;
    }
    const blob = await apiBlob(`/weeks/${week.id}/ppc-meeting/export/pre-minutes/pdf`);
    const filename = `PPC-Semana-${week.weekNumber}-Ata-Presenca-Pre-Reuniao.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF de ata + presença (pré-reunião) da Semana ${week.weekNumber} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF de ata + presença (pré-reunião)'), true);
  }
}

async function handlePpcMeetingSavePost() {
  if (state.weekSheetSaveInProgress) return;
  try {
    state.weekSheetSaveInProgress = true;
    setMeetingSavingLock(true);
    openGenericSaveProgressModal(12, 'Validando presença e ata...', 'Salvando reunião de PPC');
    const week = ppcMeetingWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida na aba Reunião de PPC.', true);
    if (String(week.prePlanningStatus || '').toUpperCase() !== 'CLOSED') {
      const message = 'Você precisa fechar a pré-programação primeiro';
      openPpcMeetingValidationModal(message);
      setStatus(message, true);
      return;
    }
    const minutes = String($('#ppcMeetingMinutes')?.value || '').trim();
    const attendance = ppcMeetingAttendancePayloadFromScreen();
    updateGenericSaveProgress(56, 'Salvando presença e ata...', 'Salvando reunião de PPC');
    await api(`/weeks/${week.id}/ppc-meeting/post`, {
      method: 'PUT',
      body: { minutes, attendance },
    });
    updateGenericSaveProgress(86, 'Recarregando reunião da semana...', 'Salvando reunião de PPC');
    await refreshPpcMeetingTab({ useDefaultNext: false, silent: true });
    updateGenericSaveProgress(100, 'Salvamento concluído.', 'Salvando reunião de PPC');
    setStatus(`Pós-reunião salva para a Semana ${week.weekNumber}.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao salvar presença e ata da reunião'), true);
  } finally {
    state.weekSheetSaveInProgress = false;
    setMeetingSavingLock(false);
    window.setTimeout(() => closeGenericSaveProgressModal(), 250);
  }
}

async function handlePpcMeetingClose() {
  try {
    const week = ppcMeetingWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida na aba Reunião de PPC.', true);
    if (String(week.prePlanningStatus || '').toUpperCase() !== 'CLOSED') {
      const message = 'Você precisa fechar a pré-programação primeiro';
      openPpcMeetingValidationModal(message);
      setStatus(message, true);
      return;
    }
    await handlePpcMeetingSavePost();
    await api(`/weeks/${week.id}/ppc-meeting/close`, { method: 'POST' });
    await refreshPpcMeetingTab({ useDefaultNext: false, silent: true });
    openPpcMeetingValidationModal(`Lista de presença e ata da Semana ${week.weekNumber} foram fechadas com sucesso.`, {
      title: 'Reunião de PPC Fechada',
    });
    setStatus(`Reunião de PPC da Semana ${week.weekNumber} fechada.`);
  } catch (error) {
    const code = String(error.message || '').trim();
    if (code === 'ppc_meeting_requires_pre_planning_close') {
      const message = 'Você precisa fechar a pré-programação primeiro';
      openPpcMeetingValidationModal(message);
      setStatus(message, true);
      return;
    }
    setStatus(translateApiError(code, 'Erro ao fechar reunião de PPC'), true);
  }
}

async function handlePpcMeetingReopen() {
  const week = ppcMeetingWeekSelected();
  if (!week?.id) return;
  try {
    await api(`/weeks/${week.id}/ppc-meeting/reopen`, { method: 'POST' });
    await loadWeeks();
    await refreshPpcMeetingTab({ useDefaultNext: false, silent: true });
    setStatus(`Reunião de PPC da semana ${week.weekNumber} reaberta com sucesso.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao reabrir reunião de PPC'), true);
  }
}

async function handlePpcMeetingMinutesPdfExport() {
  try {
    const week = ppcMeetingWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida na aba Reunião de PPC.', true);
    const blob = await apiBlob(`/weeks/${week.id}/ppc-meeting/export/minutes/pdf`);
    const filename = `PPC-Semana-${week.weekNumber}-Ata-Reuniao-PPC.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF da ata/lista de presença da Semana ${week.weekNumber} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF da ata/lista de presença'), true);
  }
}

async function handlePpcMeetingContractorConvocationPdf(contractorId, contractorName) {
  try {
    const week = ppcMeetingWeekSelected();
    if (!week?.id) return setStatus('Selecione uma semana válida na aba Reunião de PPC.', true);
    if (String(week.prePlanningStatus || '').toUpperCase() !== 'CLOSED') {
      const message = 'Você precisa fechar a pré-programação primeiro';
      openPpcMeetingValidationModal(message);
      setStatus(message, true);
      return;
    }
    const blob = await apiBlob(`/weeks/${week.id}/ppc-meeting/export/convocation/contractor/${contractorId}/pdf`);
    const contractorPart = sanitizeFileLabel(contractorName) || `empreiteiro-${contractorId}`;
    const filename = `PPC-Convocacao-Semana-${week.weekNumber}-${contractorPart}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF de convocação do empreiteiro ${contractorName || contractorId} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF de convocação do empreiteiro'), true);
  }
}

function handlePpcMeetingSendEmailPlaceholder(kind, contractorName = '') {
  if (kind === 'pre-selected') {
    const label = contractorName ? ` (${contractorName})` : '';
    setStatus(`Fluxo preparado: envio dos PDFs de atividades + convocação para os empreiteiros selecionados${label}.`);
    return;
  }
  if (kind === 'minutes-selected') {
    const label = contractorName ? ` (${contractorName})` : '';
    setStatus(`Fluxo preparado: envio da ata + lista de presença para os empreiteiros selecionados${label}.`);
    return;
  }
  const label = contractorName ? ` para ${contractorName}` : '';
  setStatus(`Fluxo preparado: envio de atividades + convocação em um único e-mail${label}.`);
}

function closePpcPreEmailModal() {
  const modal = $('#ppcPreEmailModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openPpcPreEmailModal() {
  const modal = $('#ppcPreEmailModal');
  const listEl = $('#ppcPreEmailContractorList');
  if (!modal || !listEl) return;
  const rows = ppcMeetingContractorRows(state.ppcMeetingData);
  if (!rows.length) {
    setStatus('Sem empreiteiros ativos para seleção de envio.', true);
    return;
  }
  listEl.innerHTML = '';
  rows.forEach((row) => {
    const item = document.createElement('label');
    item.className = 'checkbox-inline';
    item.innerHTML = `<input type="checkbox" value="${row.contractorId}" checked /> ${escapeHtml(row.contractorName || '-')} (${escapeHtml(row.laborType || '-')})`;
    listEl.appendChild(item);
  });
  modal.classList.remove('hidden');
}

function handlePpcPreEmailSendSelected() {
  const checks = [...document.querySelectorAll('#ppcPreEmailContractorList input[type="checkbox"]:checked')];
  if (!checks.length) {
    setStatus('Selecione ao menos um empreiteiro para envio.', true);
    return;
  }
  const rows = ppcMeetingContractorRows(state.ppcMeetingData);
  const selected = checks
    .map((input) => Number.parseInt(input.value || '', 10))
    .filter((id) => Number.isFinite(id))
    .map((id) => rows.find((row) => Number(row.contractorId) === Number(id)))
    .filter(Boolean)
    .map((row) => row.contractorName)
    .join(', ');
  closePpcPreEmailModal();
  handlePpcMeetingSendEmailPlaceholder('pre-selected', selected);
}

function closePpcPostEmailModal() {
  const modal = $('#ppcPostEmailModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function openPpcPostEmailModal() {
  const modal = $('#ppcPostEmailModal');
  const listEl = $('#ppcPostEmailContractorList');
  if (!modal || !listEl) return;
  const meeting = state.ppcMeetingData;
  const rows = ppcMeetingContractorRows(meeting);
  if (!rows.length) {
    setStatus('Sem empreiteiros ativos para seleção de envio.', true);
    return;
  }
  listEl.innerHTML = '';
  rows.forEach((row) => {
    const id = `ppc-post-email-${row.contractorId}`;
    const item = document.createElement('label');
    item.className = 'checkbox-inline';
    item.innerHTML = `<input type="checkbox" value="${row.contractorId}" checked id="${id}" /> ${escapeHtml(row.contractorName || '-')} (${escapeHtml(row.laborType || '-')})`;
    listEl.appendChild(item);
  });
  modal.classList.remove('hidden');
}

function handlePpcPostEmailSendSelected() {
  const checks = [...document.querySelectorAll('#ppcPostEmailContractorList input[type="checkbox"]:checked')];
  if (!checks.length) {
    setStatus('Selecione ao menos um empreiteiro para envio.', true);
    return;
  }
  const meeting = state.ppcMeetingData;
  const rows = ppcMeetingContractorRows(meeting);
  const selected = checks
    .map((input) => Number.parseInt(input.value || '', 10))
    .filter((id) => Number.isFinite(id))
    .map((id) => rows.find((row) => Number(row.contractorId) === Number(id)))
    .filter(Boolean)
    .map((row) => row.contractorName)
    .join(', ');
  closePpcPostEmailModal();
  handlePpcMeetingSendEmailPlaceholder('minutes-selected', selected);
}

function handlePpcMeetingPreContractorActions(event) {
  const activityPdfBtn = event.target.closest('button[data-ppc-pre-activity-pdf]');
  if (activityPdfBtn) {
    const contractorId = Number(activityPdfBtn.dataset.ppcPreActivityPdf);
    if (!contractorId) return;
    const contractorName = activityPdfBtn.dataset.contractorName || '';
    handlePrePlanningContractorPdfExport(contractorId, contractorName)
      .catch((error) => setStatus(`Erro ao gerar PDF de atividades: ${error.message}`, true));
    return;
  }

  const convocationPdfBtn = event.target.closest('button[data-ppc-pre-convocation-pdf]');
  if (convocationPdfBtn) {
    const contractorId = Number(convocationPdfBtn.dataset.ppcPreConvocationPdf);
    if (!contractorId) return;
    const contractorName = convocationPdfBtn.dataset.contractorName || '';
    handlePpcMeetingContractorConvocationPdf(contractorId, contractorName)
      .catch((error) => setStatus(`Erro ao gerar PDF de convocação: ${error.message}`, true));
    return;
  }

}

async function handleFeedbackComparisonPdfExport() {
  try {
    const week = feedbackWeekSelected();
    if (!week?.id) {
      setStatus('Selecione uma semana válida no Feedback para gerar o PDF comparativo.', true);
      return;
    }
    if (String(week.feedbackStatus || '').toUpperCase() !== 'CLOSED') {
      setStatus('O PDF comparativo só é liberado após fechamento do feedback da semana.', true);
      return;
    }
    const blob = await apiBlob(`/weeks/${week.id}/tasks/export/all/pdf?comparison=1`);
    const filename = `PPC-Semana-${week.weekNumber}-Comparativo-Planejado-Executado.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF comparativo da Semana ${week.weekNumber} gerado.`);
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao gerar PDF comparativo da semana'), true);
  }
}

async function handleDashboardLastWeekReportPdfExport() {
  try {
    if (!state.selectedWorkId) {
      setStatus('Selecione uma obra para gerar o relatório.', true);
      return;
    }
    const selectedWeek = dashboardWeekSelected();
    const selectedWeekNumber = selectedWeek?.weekNumber || dashboardWeekNumberField();
    const query = selectedWeekNumber ? `?weekNumber=${encodeURIComponent(String(selectedWeekNumber))}` : '';
    const blob = await apiBlob(`/works/${state.selectedWorkId}/dashboard/reports/last-week/pdf${query}`);
    const filename = selectedWeekNumber
      ? `PPC-Relatorio-Semana-${selectedWeekNumber}.pdf`
      : 'PPC-Relatorio-Ultima-Semana.pdf';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (selectedWeekNumber) {
      setStatus(`PDF do relatório da semana ${selectedWeekNumber} gerado.`);
    } else {
      setStatus('PDF do relatório da última semana gerado.');
    }
  } catch (error) {
    if (String(error.message || '').includes('no_closed_feedback_week')) {
      setStatus('Não existe semana com feedback fechado para o período selecionado.', true);
      return;
    }
    setStatus(translateApiError(error.message, 'Erro ao gerar relatório da última semana'), true);
  }
}

async function handleDashboardHistoryReportPdfExport() {
  try {
    if (!state.selectedWorkId) {
      setStatus('Selecione uma obra para gerar o relatório histórico.', true);
      return;
    }
    const selectedWeek = dashboardWeekSelected();
    const selectedWeekNumber = selectedWeek?.weekNumber || dashboardWeekNumberField();
    const query = selectedWeekNumber ? `?weekNumber=${encodeURIComponent(String(selectedWeekNumber))}` : '';
    const blob = await apiBlob(`/works/${state.selectedWorkId}/dashboard/reports/history/pdf${query}`);
    const filename = selectedWeekNumber
      ? `PPC - Histórico da Obra - Semana ${selectedWeekNumber}.pdf`
      : 'PPC - Histórico da Obra.pdf';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF histórico da obra gerado (Semana ${selectedWeekNumber || '-'})`);
  } catch (error) {
    if (String(error.message || '').includes('history_not_found')) {
      setStatus('Não há dados históricos para a semana selecionada.', true);
      return;
    }
    setStatus(translateApiError(error.message, 'Erro ao gerar relatório histórico da obra'), true);
  }
}

function selectedPlannedDays() {
  const byWeekday = weekDayMap(planningWeekContext());

  return $$('input[data-day]:checked').map((input) => ({
    weekday: input.value,
    plannedDate: byWeekday.get(input.value)?.dayDate || null,
  }));
}

function syncTaskDatesFromDayCheckboxes() {
  const byWeekday = weekDayMap(planningWeekContext());
  const dates = $$('input[data-day]:checked')
    .map((input) => byWeekday.get(input.value)?.dayDate)
    .filter(Boolean)
    .map((value) => new Date(value));

  if (!dates.length) {
    $('#taskStart').value = '';
    $('#taskEnd').value = '';
    return;
  }

  dates.sort((a, b) => a.getTime() - b.getTime());
  $('#taskStart').value = formatDate(dates[0]);
  $('#taskEnd').value = formatDate(dates[dates.length - 1]);
}

function syncTaskDayCheckboxesFromDates() {
  const weekDays = weekDisplayWeatherDays(planningWeekContext());
  if (!weekDays.length) {
    $$('input[data-day]').forEach((input) => { input.checked = false; });
    return;
  }

  let start = parseBrDate($('#taskStart').value.trim());
  let end = parseBrDate($('#taskEnd').value.trim());

  if (start && !end) {
    end = new Date(start);
    $('#taskEnd').value = formatDate(end);
  }
  if (!start && end) {
    start = new Date(end);
    $('#taskStart').value = formatDate(start);
  }
  if (!start || !end) return;

  if (start.getTime() > end.getTime()) {
    const temp = start;
    start = end;
    end = temp;
    $('#taskStart').value = formatDate(start);
    $('#taskEnd').value = formatDate(end);
  }

  $$('input[data-day]').forEach((input) => {
    const row = weekDays.find((item) => String(item.weekday || '').toUpperCase() === input.value);
    if (!row) {
      input.checked = false;
      return;
    }
    const rowDate = new Date(row.dayDate);
    input.checked = rowDate.getTime() >= start.getTime() && rowDate.getTime() <= end.getTime();
  });
}

async function handleTaskCreate(event) {
  event.preventDefault();
  if (!state.selectedWeekId) return;
  const weekNumber = numericWeekField();
  if (weekNumber) {
    const desired = state.weeks.find((item) => Number(item.weekNumber) === weekNumber);
    if (desired && Number(desired.id) !== Number(state.selectedWeekId)) {
      state.selectedWeekId = desired.id;
      await loadWeeks();
      await loadTasksAndDashboard();
    }
  }
  let startText = $('#taskStart').value.trim();
  let endText = $('#taskEnd').value.trim();
  if (startText && !parseBrDate(startText)) return setStatus('Data de início da tarefa inválida. Use DD/MM/AAAA.', true);
  if (endText && !parseBrDate(endText)) return setStatus('Data de fim da tarefa inválida. Use DD/MM/AAAA.', true);
  if (startText || endText) {
    syncTaskDayCheckboxesFromDates();
  } else {
    syncTaskDatesFromDayCheckboxes();
  }
  startText = $('#taskStart').value.trim();
  endText = $('#taskEnd').value.trim();
  const plannedDays = selectedPlannedDays();
  const holidayDates = holidayDatesFromPlannedDays(plannedDays);
  if (holidayDates.length) {
    const confirmed = window.confirm(
      `Atenção: esta atividade está planejada em feriado (${holidayDates.join(', ')}). Deseja continuar?`,
    );
    if (!confirmed) {
      setStatus('Inclusão cancelada pelo usuário por coincidência com feriado.');
      return;
    }
  }

  try {
    await api(planningTaskCollectionPath(state.selectedWeekId), {
      method: 'POST',
      body: {
        description: $('#taskDesc').value.trim(),
        contractorId: $('#taskContractor').value ? Number($('#taskContractor').value) : null,
        supervisor: $('#taskSupervisor').value.trim() || null,
        locationLevel1: $('#taskLocation1').value.trim() || null,
        locationLevel2: $('#taskLocation2').value.trim() || null,
        plannedStart: startText || null,
        plannedEnd: endText || null,
        plannedDays,
      },
    });
    $('#taskForm').reset();
    renderTaskLocationLevel2Options();
    await loadTasksAndDashboard();
    setStatus('Linha adicionada à planilha.');
  } catch (error) {
    setStatus(`Erro ao criar tarefa: ${error.message}`, true);
  }
}

async function handleFeedbackNewTaskCreate(event) {
  event.preventDefault();
  if (!state.selectedWeekId) return;
  try {
    const draftSnapshot = captureFeedbackDraftState();
    const week = activeWeek();
    if (!week) throw new Error('Semana não selecionada.');
    if (String(week.planningStatus || '').toUpperCase() !== 'CLOSED') {
      throw new Error('planning_not_closed');
    }
    if (String(week.feedbackStatus || '').toUpperCase() === 'CLOSED') {
      throw new Error('feedback_closed');
    }

    const description = $('#feedbackNewTask').value.trim();
    const contractorId = Number.parseInt($('#feedbackNewContractor').value || '', 10);
    const supervisor = $('#feedbackNewSupervisor').value.trim() || null;
    const locationLevel1 = $('#feedbackNewLocation1').value.trim() || null;
    const locationLevel2 = $('#feedbackNewLocation2').value.trim() || null;
    let actualStart = $('#feedbackNewActualStart').value.trim();
    let actualEnd = $('#feedbackNewActualEnd').value.trim();

    if (!description) throw new Error('Descrição da nova atividade é obrigatória.');
    if (!contractorId) throw new Error('Selecione o empreiteiro da nova atividade.');
    if (!locationLevel1) throw new Error('Local 1 é obrigatório para atividade executada não planejada.');

    if (actualStart && !parseBrDate(actualStart)) throw new Error('Data real de início inválida. Use DD/MM/AAAA.');
    if (actualEnd && !parseBrDate(actualEnd)) throw new Error('Data real de fim inválida. Use DD/MM/AAAA.');
    if (actualStart || actualEnd) {
      syncFeedbackNewDayCheckboxesFromDates();
      actualStart = $('#feedbackNewActualStart').value.trim();
      actualEnd = $('#feedbackNewActualEnd').value.trim();
    } else {
      syncFeedbackNewDatesFromDayCheckboxes();
      actualStart = $('#feedbackNewActualStart').value.trim();
      actualEnd = $('#feedbackNewActualEnd').value.trim();
    }

    const executedDays = feedbackNewSelectedDays();
    if (!actualStart && !actualEnd && !executedDays.length) {
      throw new Error('Informe os dias executados (checkbox) ou datas reais de início/fim.');
    }

    await api(`/weeks/${state.selectedWeekId}/feedback/unplanned-task`, {
      method: 'POST',
      body: {
        contractorId,
        supervisor,
        locationLevel1,
        locationLevel2,
        description,
        actualStart: actualStart || null,
        actualEnd: actualEnd || null,
        executedDays,
      },
    });

    resetFeedbackNewTaskForm();
    await loadWeeks();
    await loadTasksAndDashboard();
    restoreFeedbackDraftState(draftSnapshot);
    setStatus('Atividade não planejada adicionada com status Executada.');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao adicionar atividade não planejada'), true);
  }
}

async function handleFeedbackTaskAction(event) {
  const deleteBtn = event.target.closest('button[data-feedback-delete-unplanned]');
  if (!deleteBtn) return;
  if (!state.selectedWeekId) return;
  const taskId = Number.parseInt(deleteBtn.dataset.feedbackDeleteUnplanned || '', 10);
  if (!taskId) return;
  const confirmed = window.confirm('Deseja excluir esta atividade executada/não planejada?');
  if (!confirmed) return;

  try {
    await api(`/weeks/${state.selectedWeekId}/feedback/unplanned-task/${taskId}`, {
      method: 'DELETE',
    });
    await loadWeeks();
    await loadTasksAndDashboard();
    setStatus('Atividade executada/não planejada excluída.');
  } catch (error) {
    setStatus(translateApiError(error.message, 'Erro ao excluir atividade executada/não planejada'), true);
  }
}

async function handleFeedback(event, options = {}) {
  if (event?.preventDefault) event.preventDefault();
  if (state.feedbackSaveInProgress) return false;
  if (!state.selectedWeekId) return false;
  const closeWeekRequested = options.closeWeekRequested === true || state.closeFeedbackPending === true;
  state.closeFeedbackPending = false;
  if (!options.autosave) closeFeedbackValidationModal();
  try {
    state.feedbackSaveInProgress = true;
    setFeedbackSavingLock(true);
    if (!options.autosave) {
      openFeedbackSaveProgressModal(8, 'Preparando dados do feedback...');
    }
    const week = activeWeek();
    if (!week) throw new Error('Semana não selecionada.');
    if (String(week.planningStatus || '').toUpperCase() !== 'CLOSED') {
      throw new Error('planning_not_closed');
    }
    if (String(week.feedbackStatus || '').toUpperCase() === 'CLOSED') {
      throw new Error('feedback_closed');
    }

    const allRows = [...document.querySelectorAll('#feedbackTasksBody tr[data-task-id]')];
    if (!allRows.length) throw new Error('Sem tarefas para feedback nesta semana.');
    const rows = allRows;
    const items = [];
    const linesWithMissingCause = [];
    const linesWithInvalidDate = [];

    rows.forEach((row) => {
      const taskId = Number.parseInt(row.dataset.taskId || '', 10);
      const taskSeq = Number.parseInt(row.dataset.taskSeq || '', 10) || taskId;
      const isUnplanned = row.dataset.unplanned === '1';
      const isReserve = row.dataset.reserve === '1';
      const status = String(row.querySelector('.fb-status')?.value || '').toUpperCase();
      const causeGroup = String(row.querySelector('.fb-cause-group')?.value || '').trim();
      const causeRaw = row.querySelector('.fb-cause')?.value || '';
      const causeId = causeRaw ? Number.parseInt(causeRaw, 10) : null;
      const comments = row.querySelector('.fb-comment')?.value?.trim() || null;
      let actualStart = row.querySelector('.fb-actual-start')?.value?.trim() || '';
      let actualEnd = row.querySelector('.fb-actual-end')?.value?.trim() || '';

      if (actualStart || actualEnd) {
        syncFeedbackRowDayCheckboxesFromDates(row);
      } else {
        syncFeedbackRowDatesFromDayCheckboxes(row);
      }
      actualStart = row.querySelector('.fb-actual-start')?.value?.trim() || '';
      actualEnd = row.querySelector('.fb-actual-end')?.value?.trim() || '';
      let executedDays = feedbackRowSelectedDays(row);
      if (status === 'NOT_STARTED') {
        executedDays = [];
        actualStart = '';
        actualEnd = '';
      }

      if (!taskId || !status) return;
      if (closeWeekRequested && (status === 'EXECUTED' || status === 'EXECUTED_UNPLANNED' || status === 'CANCELLED' || isReserve) && causeId) {
        linesWithMissingCause.push(taskSeq);
      }
      if (closeWeekRequested && (status === 'NOT_STARTED' || status === 'STARTED') && !isReserve && (!causeGroup || !causeId)) {
        linesWithMissingCause.push(taskSeq);
      }
      if (actualStart && !parseBrDate(actualStart)) linesWithInvalidDate.push(`#${taskSeq} início`);
      if (actualEnd && !parseBrDate(actualEnd)) linesWithInvalidDate.push(`#${taskSeq} fim`);
      const contractorRaw = row.querySelector('.fb-unplanned-contractor')?.value || row.querySelector('.fb-contractor')?.value || '';
      const contractorId = contractorRaw ? Number.parseInt(contractorRaw, 10) : null;
      const unplannedLocation1 = row.querySelector('.fb-unplanned-location1')?.value?.trim() || null;
      const unplannedLocation2 = row.querySelector('.fb-unplanned-location2')?.value?.trim() || null;
      const unplannedDescription = row.querySelector('.fb-unplanned-task')?.value?.trim() || null;
      items.push({
        taskId,
        status,
        causeId: (status === 'EXECUTED' || status === 'EXECUTED_UNPLANNED' || status === 'CANCELLED' || isReserve) ? null : causeId,
        comments,
        actualStart: actualStart || null,
        actualEnd: actualEnd || null,
        executedDays,
        contractorId: Number.isNaN(contractorId) ? null : contractorId,
        supervisor: row.dataset.unplannedSupervisor || null,
        ...(isUnplanned ? {
          locationLevel1: unplannedLocation1,
          locationLevel2: unplannedLocation2,
          description: unplannedDescription,
        } : {}),
      });
    });

    if (linesWithMissingCause.length) {
      throw new Error(`cause_required_rows:${linesWithMissingCause.join(',')}`);
    }
    if (linesWithInvalidDate.length) {
      throw new Error(`invalid_date_rows:${linesWithInvalidDate.join(',')}`);
    }
    if (!items.length) throw new Error('Nenhum item de feedback foi preenchido.');

    if (!options.autosave) updateFeedbackSaveProgress(40, 'Enviando feedback para o servidor...');
    await api(`/weeks/${state.selectedWeekId}/feedback`, {
      method: 'POST',
      body: {
        closeWeek: closeWeekRequested,
        items,
      },
    });
    if (!options.autosave) updateFeedbackSaveProgress(76, 'Recarregando semana e validações...');
    await loadWeeks();
    const feedbackWeekInput = $('#feedbackWeekNumber');
    if (feedbackWeekInput) feedbackWeekInput.value = String(week.weekNumber || '');
    await refreshFeedbackTab({ useDefaultPrevious: false, silent: true });
    if (!options.autosave) updateFeedbackSaveProgress(100, 'Salvamento concluído.');
    clearScreenDirty('feedback');
    if (!options.autosave) closeFeedbackValidationModal();
    if (options.autosave) {
      showToast('Rascunho do feedback salvo automaticamente.', { kind: 'success', durationMs: 3200 });
    } else {
      setStatus(closeWeekRequested ? 'Feedback salvo e semana fechada para feedback.' : 'Feedback salvo.');
    }
    return true;
  } catch (error) {
    state.closeFeedbackPending = false;
    if (options.autosave) {
      const message = translateApiError(error.message, 'Autosalvamento do feedback pausado');
      showToast(message, { kind: 'reminder', durationMs: 5200 });
      return false;
    }
    if (String(error.message).startsWith('cause_required_rows:')) {
      const rows = String(error.message).split(':')[1] || '';
      openFeedbackValidationModal(
        'Não foi possível salvar o feedback da semana. Existem linhas com causa inválida.',
        [`Tarefas com problema: ${rows}`],
      );
      setStatus(`Erro ao salvar feedback: causas inválidas nas tarefas ${rows}. Executada, executada/não planejada e cancelada não podem ter causa; não iniciada exige grupo e causa.`, true);
      return;
    }
    if (String(error.message).startsWith('invalid_date_rows:')) {
      const rows = String(error.message).split(':')[1] || '';
      openFeedbackValidationModal(
        'Não foi possível salvar o feedback da semana. Existem datas inválidas.',
        [`Campos com problema: ${rows}`],
      );
      setStatus(`Erro ao salvar feedback: data real inválida em ${rows}. Use DD/MM/AAAA.`, true);
      return;
    }
    openFeedbackValidationModal(
      'Não foi possível salvar o feedback da semana.',
      [translateApiError(error.message, 'Falha ao salvar feedback')],
    );
    setStatus(translateApiError(error.message, 'Erro ao salvar feedback'), true);
    return false;
  } finally {
    if (!options.autosave) {
      window.setTimeout(() => {
        closeFeedbackSaveProgressModal();
      }, 250);
    }
    state.feedbackSaveInProgress = false;
    setFeedbackSavingLock(false);
  }
}

async function handleFeedbackReopen() {
  const week = feedbackWeekSelected();
  if (!week?.id) return;
  try {
    await api(`/weeks/${week.id}/feedback/reopen`, { method: 'POST' });
    await loadWeeks();
    await refreshFeedbackTab({ useDefaultPrevious: false, silent: true });
    setStatus(`Feedback da semana ${week.weekNumber} reaberto com sucesso.`);
  } catch (error) {
    const message = translateApiError(error.message, 'Erro ao reabrir feedback');
    openFeedbackValidationModal(message, []);
    setStatus(message, true);
  }
}

async function runWeekAction(action) {
  try {
    const targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
    if (!targetWeek?.id) {
      setStatus('Selecione uma semana válida para executar esta ação.', true);
      return;
    }

    if (action === 'close') {
      const preMode = isPrePlanningMode();
      if (!preMode) {
        const preClosed = String(targetWeek.prePlanningStatus || '').toUpperCase() === 'CLOSED';
        const meetingClosed = String(targetWeek?.ppcMeeting?.isClosed || '').toLowerCase() === 'true';
        if (!preClosed || !meetingClosed) {
          const message = 'Você precisa fechar a pré-programação primeiro e/ou a lista de preseção e ata';
          openPlanningValidationModal(message, [], { title: 'Fechamento bloqueado' });
          setStatus(message, true);
          return;
        }
      }
      const rows = [...$('#tasksBody').querySelectorAll('tr[data-sheet-row-kind]')];
      const rowsWithoutLocation = rows
        .map((row, index) => ({
          label: sheetRowLineLabel(row, index),
          locationLevel1: String(row.querySelector('.sheet-location1')?.value || '').trim(),
        }))
        .filter((item) => !item.locationLevel1 || item.locationLevel1 === '-')
        .map((item) => item.label);
      if (rowsWithoutLocation.length) {
        const message = 'Não é possível fechar a programação sem indicar o local de uma das tarefas';
        openPlanningValidationModal(message, rowsWithoutLocation, { title: 'Fechamento bloqueado' });
        setStatus(message, true);
        return;
      }
      await api(planningCloseActionPath(targetWeek.id), { method: 'POST' });
      await loadWeeks();
      await loadTasksAndDashboard();
      if (preMode) {
        setStatus('Pré-programação fechada e sincronizada para a Programação. PDFs disponibilizados nesta subaba.');
      } else {
        setStatus('Planejamento fechado.');
      }
      return;
    }
    if (action === 'reopen') {
      if (isPrePlanningMode()) {
        if (!hasAnyRole(['ADMIN'])) {
          setStatus('Somente o Administrador pode reabrir a pré-programação.', true);
          return;
        }
        await api(`/weeks/${targetWeek.id}/reopen-pre-planning`, { method: 'POST' });
        await loadWeeks();
        await loadTasksAndDashboard();
        setStatus('Pré-programação reaberta com sucesso.');
        return;
      }
      if (String(targetWeek?.planningStatus || '').toUpperCase() === 'OPEN') {
        setStatus('Esta semana já está aberta para edição.');
        return;
      }

      const request = await api(`/weeks/${targetWeek.id}/reopen-requests`, {
        method: 'POST',
        body: { reason: 'Solicitação enviada pela interface.' },
      });

      if (hasAnyRole(['ADMIN', 'CONTROLLER']) && request?.id) {
        await api(`/reopen-requests/${request.id}/decision`, {
          method: 'POST',
          body: { approve: true },
        });
        await loadWeeks();
        await loadTasksAndDashboard();
        setStatus('Semana reaberta com sucesso.');
        return;
      }

      await loadWeeks();
      await loadTasksAndDashboard();
      setStatus('Solicitação de abertura enviada (aguardando aprovação).');
    }
  } catch (error) {
    const code = String(error.message || '').trim();
    const message = translateApiError(code, 'Ação não concluída');
    setStatus(message, true);
    if (code === 'close_requires_location_level1'
      || code === 'planning_requires_pre_and_ppc_close'
      || code === 'pre_planning_reopen_requires_open_ppc_meeting') {
      openPlanningValidationModal(message, [], { title: 'Fechamento bloqueado' });
    }
  }
}

async function handleExportWeekExcel() {
  try {
    const targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
    if (!targetWeek?.id) return setStatus('Selecione uma semana para exportar.', true);
    const phase = isPrePlanningMode() ? 'pre' : 'planning';
    const blob = await apiBlob(`/weeks/${targetWeek.id}/tasks/export/xlsx?phase=${encodeURIComponent(phase)}`);
    const filename = isPrePlanningMode()
      ? `PPC-PreProgramacao-Semana-${targetWeek.weekNumber || targetWeek.id}.xlsx`
      : `PPC-Semana-${targetWeek.weekNumber || targetWeek.id}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Planilha exportada para Excel.');
  } catch (error) {
    setStatus(`Erro ao exportar Excel: ${error.message}`, true);
  }
}

async function handleImportWeekExcelClick() {
  const targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
  if (!targetWeek?.id) {
    setStatus('Selecione uma semana para importar tarefas.', true);
    return;
  }
  $('#importWeekExcelInput').click();
}

async function handleImportWeekExcelFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
  if (!targetWeek?.id) {
    setStatus('Selecione uma semana para importar tarefas.', true);
    event.target.value = '';
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    const fileBase64 = arrayBufferToBase64(buffer);
    const phase = isPrePlanningMode() ? 'pre' : 'planning';
    const result = await api(`/weeks/${targetWeek.id}/tasks/import/xlsx?phase=${encodeURIComponent(phase)}`, {
      method: 'POST',
      body: {
        fileName: file.name,
        fileBase64,
      },
    });
    await loadTasksAndDashboard();
    setStatus(`Importação concluída. ${result.createdCount || 0} tarefa(s) criada(s).`);
  } catch (error) {
    setStatus(`Erro ao importar Excel: ${error.message}`, true);
  } finally {
    event.target.value = '';
  }
}

function planningTasksToDelimitedText(tasks) {
  const headers = [
    '#',
    'Semana origem',
    'Empreiteiro',
    'Tipo de mão de obra',
    'Encarregado',
    'Local Nível 1',
    'Local Nível 2',
    'Tarefa',
    'Início previsto',
    'Fim previsto',
    'Seg',
    'Ter',
    'Qua',
    'Qui',
    'Sex',
    'Sáb',
    'Status',
  ];
  const rows = [headers.join(';')];
  const context = planningWeekContext();
  tasks.forEach((task) => {
    const daySet = new Set((task.plannedDays || []).map((d) => String(d.weekday || '').toUpperCase()));
    const cols = [
      task.sequenceNumber || '',
      task.originWeekNumber || task.originWeek?.weekNumber || '',
      task.contractor?.name || '',
      task.contractor?.function?.name || task.contractorLaborType || '',
      task.supervisor || '',
      task.location?.level1 || task.locationLevel1 || '',
      displayLocationLevel2(task.location) === '-' ? '' : (task.location?.level2 || task.locationLevel2 || ''),
      task.description || '',
      formatDate(task.plannedStart || ''),
      formatDate(task.plannedEnd || ''),
      daySet.has('MONDAY') ? '1' : '0',
      daySet.has('TUESDAY') ? '1' : '0',
      daySet.has('WEDNESDAY') ? '1' : '0',
      daySet.has('THURSDAY') ? '1' : '0',
      daySet.has('FRIDAY') ? '1' : '0',
      daySet.has('SATURDAY') ? '1' : '0',
      planningStatusLabelFromCode(taskDisplayStatusCode(task, context, false)),
    ];
    rows.push(cols.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(';'));
  });
  return rows.join('\r\n');
}

async function handleExportWeekTxt() {
  try {
    await syncSelectedWeekFromWeekFieldIfNeeded();
    const content = planningTasksToDelimitedText(state.tasks || []);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const week = activeWeek();
    const filename = isPrePlanningMode()
      ? `PPC-PreProgramacao-Semana-${week?.weekNumber || ''}.csv`
      : `PPC-Semana-${week?.weekNumber || ''}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Arquivo TXT/CSV exportado com sucesso.');
  } catch (error) {
    setStatus(`Erro ao exportar TXT/CSV: ${error.message}`, true);
  }
}

function parseCsvLikeLine(line, separator = ';') {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === separator) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

async function handleImportWeekTxtClick() {
  const targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
  if (!targetWeek?.id) {
    setStatus('Selecione uma semana para importar tarefas.', true);
    return;
  }
  $('#importWeekTxtInput').click();
}

async function handleImportWeekTxtFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('Arquivo sem linhas de dados.');
    const header = parseCsvLikeLine(lines[0], ';');
    const idx = Object.fromEntries(header.map((name, i) => [normalizeSearchText(name), i]));
    const get = (cols, key) => {
      const pos = idx[normalizeSearchText(key)];
      if (Number.isInteger(pos) && pos >= 0 && pos < cols.length) return cols[pos];
      return '';
    };

    const targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
    if (!targetWeek?.id) throw new Error('Selecione uma semana válida.');
    let created = 0;
    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLikeLine(lines[i], ';');
      const description = String(get(cols, 'Tarefa') || '').trim();
      if (!description) continue;
      const contractorName = String(get(cols, 'Empreiteiro') || '').trim().toLowerCase();
      const contractor = (state.contractors || []).find((c) => String(c.name || '').trim().toLowerCase() === contractorName);
      const payload = {
        sequenceNumber: Number.parseInt(String(get(cols, '#') || ''), 10) || undefined,
        originWeekNumber: Number.parseInt(String(get(cols, 'Semana origem') || ''), 10) || undefined,
        contractorId: contractor?.id || null,
        supervisor: String(get(cols, 'Encarregado') || '').trim() || null,
        locationLevel1: String(get(cols, 'Local Nível 1') || '').trim() || null,
        locationLevel2: String(get(cols, 'Local Nível 2') || '').trim() || null,
        description,
        plannedStart: String(get(cols, 'Início previsto') || '').trim() || null,
        plannedEnd: String(get(cols, 'Fim previsto') || '').trim() || null,
        status: String(get(cols, 'Status') || '').trim() || 'Planejada',
        plannedDays: [
          ['Seg', 'MONDAY'],
          ['Ter', 'TUESDAY'],
          ['Qua', 'WEDNESDAY'],
          ['Qui', 'THURSDAY'],
          ['Sex', 'FRIDAY'],
          ['Sáb', 'SATURDAY'],
        ].filter(([label]) => ['1', 'x', 'X', 'true', 'TRUE', 'sim', 'SIM'].includes(String(get(cols, label) || '').trim()))
          .map(([, weekday]) => ({ weekday })),
      };
      // eslint-disable-next-line no-await-in-loop
      await api(planningTaskCollectionPath(targetWeek.id), { method: 'POST', body: payload });
      created += 1;
    }
    await loadTasksAndDashboard();
    setStatus(`Importação TXT/CSV concluída. ${created} tarefa(s) criada(s).`);
  } catch (error) {
    setStatus(`Erro ao importar TXT/CSV: ${error.message}`, true);
  } finally {
    event.target.value = '';
  }
}

function sheetRowElementFromEventTarget(target) {
  return target.closest('tr[data-sheet-row-kind]');
}

function sheetWeekdayDateMap() {
  return weekDayMap(planningWeekContext());
}

function sheetCollectPlannedDays(row) {
  const byWeekday = sheetWeekdayDateMap();
  return [...row.querySelectorAll('.sheet-day:checked')].map((input) => ({
    weekday: input.dataset.weekday,
    plannedDate: byWeekday.get(input.dataset.weekday)?.dayDate || null,
  }));
}

function syncSheetRowDatesFromDayCheckboxes(row) {
  const byWeekday = sheetWeekdayDateMap();
  const startInput = row.querySelector('.sheet-start');
  const endInput = row.querySelector('.sheet-end');
  const dates = [...row.querySelectorAll('.sheet-day:checked')]
    .map((input) => byWeekday.get(input.dataset.weekday)?.dayDate)
    .filter(Boolean)
    .map((value) => new Date(value));

  if (!dates.length) {
    startInput.value = '';
    endInput.value = '';
    return;
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  startInput.value = formatSheetDateMultiline(dates[0]);
  endInput.value = formatSheetDateMultiline(dates[dates.length - 1]);
}

function syncSheetRowDayCheckboxesFromDates(row) {
  const weekDays = weekDisplayWeatherDays(planningWeekContext());
  const startInput = row.querySelector('.sheet-start');
  const endInput = row.querySelector('.sheet-end');

  let start = parseSheetDateInput(startInput.value);
  let end = parseSheetDateInput(endInput.value);

  if (start && !end) {
    end = new Date(start);
    endInput.value = formatSheetDateMultiline(end);
  }
  if (!start && end) {
    start = new Date(end);
    startInput.value = formatSheetDateMultiline(start);
  }
  if (!start || !end) return;

  if (start.getTime() > end.getTime()) {
    const tmp = start;
    start = end;
    end = tmp;
    startInput.value = formatSheetDateMultiline(start);
    endInput.value = formatSheetDateMultiline(end);
  }

  row.querySelectorAll('.sheet-day').forEach((input) => {
    const weekday = input.dataset.weekday;
    const day = weekDays.find((item) => String(item.weekday || '').toUpperCase() === weekday);
    if (!day) {
      input.checked = false;
      return;
    }
    const dayDate = new Date(day.dayDate);
    input.checked = dayDate.getTime() >= start.getTime() && dayDate.getTime() <= end.getTime();
  });
}

function refreshSheetRowLocation2(row) {
  const level1 = row.querySelector('.sheet-location1')?.value.trim() || '';
  const level2Select = row.querySelector('.sheet-location2');
  if (!level2Select) return;
  const previous = level2Select.value;
  level2Select.innerHTML = locationLevel2OptionsHtml(level1, previous);
  if (previous && [...level2Select.options].some((opt) => opt.value === previous)) {
    level2Select.value = previous;
  }
}

function getSheetRowPayload(row, options = {}) {
  const requireCompleteness = options.requireCompleteness === true;
  const description = row.querySelector('.sheet-desc')?.value.trim() || '';
  const plannedStart = normalizeSheetDateText(row.querySelector('.sheet-start')?.value || '');
  const plannedEnd = normalizeSheetDateText(row.querySelector('.sheet-end')?.value || '');
  if (plannedStart && !parseBrDate(plannedStart)) throw new Error('Data de início inválida (use DD/MM/AAAA).');
  if (plannedEnd && !parseBrDate(plannedEnd)) throw new Error('Data de fim inválida (use DD/MM/AAAA).');

  const contractorId = Number.parseInt(row.querySelector('.sheet-contractor')?.value || '', 10);
  const sequenceNumber = Number.parseInt(row.querySelector('.sheet-seq')?.dataset.sequenceValue || row.querySelector('.sheet-seq')?.textContent || '', 10);
  const originWeekNumber = Number.parseInt((row.querySelector('.sheet-origin-week')?.textContent || '').trim(), 10);

  const payload = {
    sequenceNumber: Number.isNaN(sequenceNumber) ? null : sequenceNumber,
    originWeekNumber: Number.isNaN(originWeekNumber) ? null : originWeekNumber,
    contractorId: Number.isNaN(contractorId) ? null : contractorId,
    supervisor: row.querySelector('.sheet-supervisor')?.value.trim() || null,
    locationLevel1: row.querySelector('.sheet-location1')?.value.trim() || null,
    locationLevel2: row.querySelector('.sheet-location2')?.value.trim() || null,
    description,
    plannedStart: plannedStart || null,
    plannedEnd: plannedEnd || null,
    status: null,
    plannedDays: sheetCollectPlannedDays(row),
  };

  const statusSelect = row.querySelector('.sheet-status');
  const statusBase = String(row.dataset.sheetStatusBase || 'PLANNED').toUpperCase();
  payload.status = statusSelect ? String(statusSelect.value || statusBase).toUpperCase() : statusBase;

  if (requireCompleteness) {
    const missing = sheetMissingRequiredFields(payload);
    if (missing.length) throw new Error(`Campos obrigatórios: ${missing.join(', ')}.`);
  }
  return payload;
}

function sheetMissingRequiredFields(payload) {
  const missing = [];
  if (!payload.contractorId) missing.push('Empreiteiro');
  if (!String(payload.locationLevel1 || '').trim() || String(payload.locationLevel1 || '').trim() === '-') missing.push('Local 1');
  if (!String(payload.description || '').trim()) missing.push('Tarefa');
  if (!Array.isArray(payload.plannedDays) || payload.plannedDays.length === 0) missing.push('Ao menos um dia de atividade');
  return missing;
}

function sheetRowLineLabel(row, index) {
  const uiLine = index + 1;
  const sequence = String(row.querySelector('.sheet-seq')?.dataset.sequenceValue || row.querySelector('.sheet-seq')?.textContent || '').trim();
  if (!sequence) return `Linha ${uiLine}`;
  return `Linha ${uiLine} (#${sequence})`;
}

function sheetDuplicateActivityIssues(operations = []) {
  const groups = new Map();
  operations.forEach((item) => {
    const payload = item?.payload || {};
    const description = normalizeSearchText(payload.description || '');
    const contractorId = Number(payload.contractorId) || 0;
    const location1 = normalizeSearchText(payload.locationLevel1 || '');
    const location2 = normalizeSearchText(payload.locationLevel2 || '');
    if (!description || !contractorId || !location1) return;
    const key = `${contractorId}__${location1}__${location2}__${description}`;
    const bucket = groups.get(key) || [];
    bucket.push(item.label);
    groups.set(key, bucket);
  });
  return [...groups.values()].filter((labels) => labels.length > 1);
}

function syncDraftStateFromRow(row) {
  const draftId = row.dataset.draftId;
  if (!draftId) return;
  const index = state.sheetDraftRows.findIndex((item) => item.draftId === draftId);
  if (index < 0) return;
  const draft = state.sheetDraftRows[index];
  draft.sequenceNumber = Number.parseInt(row.querySelector('.sheet-seq')?.dataset.sequenceValue || row.querySelector('.sheet-seq')?.textContent || '', 10) || draft.sequenceNumber;
  draft.contractorId = Number.parseInt(row.querySelector('.sheet-contractor')?.value || '', 10) || null;
  draft.supervisor = row.querySelector('.sheet-supervisor')?.value || '';
  draft.locationLevel1 = row.querySelector('.sheet-location1')?.value || '';
  draft.locationLevel2 = row.querySelector('.sheet-location2')?.value || '';
  draft.description = row.querySelector('.sheet-desc')?.value || '';
  draft.plannedStart = row.querySelector('.sheet-start')?.value || '';
  draft.plannedEnd = row.querySelector('.sheet-end')?.value || '';
  draft.status = String(row.querySelector('.sheet-status')?.value || row.dataset.sheetStatusBase || 'PLANNED').toUpperCase();
  draft.plannedDays = [...row.querySelectorAll('.sheet-day:checked')].map((input) => ({ weekday: input.dataset.weekday }));
}

async function handleSaveWeekSheet(options = {}) {
  if (state.weekSheetSaveInProgress) return;
  try {
    state.weekSheetSaveInProgress = true;
    setPlanningSavingLock(true, options.autosave ? 'Autosalvando planilha...' : 'Validando planilha...');
    const preMode = isPrePlanningMode();
    const saveBtn = $('#saveWeekSheetBtn');
    if (saveBtn) saveBtn.disabled = true;
    openPlanningSaveProgressModal(3, options.autosave ? 'Autosalvando planilha...' : 'Validando planilha...');
    const targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
    if (!targetWeek?.id) {
      setStatus('Selecione uma semana para salvar a programação.', true);
      return;
    }
    const statusField = preMode ? 'prePlanningStatus' : 'planningStatus';
    if (String(targetWeek?.[statusField] || '').toUpperCase() !== 'OPEN') {
      const message = preMode
        ? 'Pré-programação da semana está fechada. Reabra a semana para salvar alterações.'
        : 'Planejamento da semana está fechado. Reabra a semana para salvar alterações.';
      setStatus(message, true);
      openPlanningValidationModal(message, [], { title: 'Semana Fechada' });
      return;
    }
    if (!preMode && String(targetWeek?.ppcMeeting?.isClosed || '').toLowerCase() !== 'true') {
      const message = 'Você precisa fechar a pré-programação primeiro e/ou a lista de preseção e ata';
      setStatus(message, true);
      openPlanningValidationModal(message, [], { title: 'Fluxo bloqueado' });
      return;
    }

    const rows = [...$('#tasksBody').querySelectorAll('tr[data-sheet-row-kind]')];
    if (!rows.length) {
      setStatus('Não há linhas na planilha para salvar.', true);
      return;
    }
    syncSheetRowSequenceNumbers(rows);

    const issues = [];
    const operations = [];

    rows.forEach((row, index) => {
      const isDraft = row.dataset.sheetRowKind === 'draft';
      const isEditableInBatch = row.dataset.sheetEditable === '1';
      if (!isEditableInBatch) return;

      const label = sheetRowLineLabel(row, index);
      let payload;
      try {
        payload = getSheetRowPayload(row);
      } catch (error) {
        issues.push({ label, detail: error.message });
        return;
      }

      const missing = sheetMissingRequiredFields(payload);
      if (missing.length) {
        issues.push({ label, detail: missing.join(', ') });
        return;
      }

      if (isDraft) {
        operations.push({
          kind: 'draft',
          draftId: row.dataset.draftId,
          label,
          payload,
        });
        return;
      }

      const taskId = Number.parseInt(row.dataset.taskId || '', 10);
      if (!taskId) {
        issues.push({ label, detail: 'Identificador da tarefa inválido.' });
        return;
      }
      operations.push({
        kind: 'task',
        taskId,
        label,
        payload,
      });
    });

    if (!operations.length && !issues.length) {
      setStatus('Não há linhas editáveis para salvar na programação semanal.', true);
      return;
    }

    if (issues.length) {
      const labels = issues.map((item) => item.label).join(', ');
      const message = `Não foi possível salvar a programação semanal. Informações incompletas na(s) linha(s) ${labels}.`;
      openPlanningValidationModal(message, issues.map((item) => `${item.label}: ${item.detail}`));
      const first = issues[0];
      setStatus(`Salvamento bloqueado: ${first.label} com pendência em ${first.detail}.`, true);
      return;
    }

    const duplicateIssues = sheetDuplicateActivityIssues(operations);
    if (duplicateIssues.length) {
      const lines = duplicateIssues.map((labels, index) => `Duplicidade ${index + 1}: ${labels.join(', ')}`);
      const message = 'Não foi possível salvar a programação semanal. Existem atividades duplicadas para o mesmo empreiteiro, mesma descrição, mesmo Local 1 e mesmo Local 2.';
      openPlanningValidationModal(message, lines, { title: 'Atividades duplicadas' });
      setStatus('Salvamento bloqueado: existem atividades duplicadas na planilha.', true);
      return;
    }

    const holidayWarnings = operations
      .map((item) => ({
        label: item.label,
        dates: holidayDatesFromPlannedDays(item.payload?.plannedDays || []),
      }))
      .filter((item) => item.dates.length > 0);

    if (holidayWarnings.length) {
      const detail = holidayWarnings
        .map((item) => `${item.label}: ${item.dates.join(', ')}`)
        .join('\n');
      const confirmed = window.confirm(
        `Atenção: existem atividades planejadas em feriado.\n${detail}\n\nDeseja salvar mesmo assim?`,
      );
      if (!confirmed) {
        setStatus('Salvamento cancelado pelo usuário por coincidência com feriado.');
        return;
      }
    }

    closePlanningValidationModal();
    updatePlanningSaveProgress(10, 'Iniciando salvamento...');
    let createdCount = 0;
    let updatedCount = 0;
    const totalOperations = operations.length || 1;

    for (let index = 0; index < operations.length; index += 1) {
      const item = operations[index];
      updatePlanningSaveProgress(
        10 + Math.round((index / totalOperations) * 80),
        `${item.label}: salvando ${index + 1} de ${totalOperations}...`,
      );
      if (item.kind === 'draft') {
        await api(planningTaskCollectionPath(targetWeek.id), {
          method: 'POST',
          body: item.payload,
        });
        state.sheetDraftRows = state.sheetDraftRows.filter((draft) => draft.draftId !== item.draftId);
        createdCount += 1;
        continue;
      }
      await api(planningTaskItemPath(item.taskId), {
        method: 'PUT',
        body: item.payload,
      });
      updatedCount += 1;
    }

    updatePlanningSaveProgress(94, 'Recarregando dados da semana...');
    await loadTasksAndDashboard();
    updatePlanningSaveProgress(100, 'Salvamento concluído.');
    const successMessage = `${preMode ? 'Pré-programação semanal' : 'Programação semanal'} salva. ${createdCount} linha(s) criada(s) e ${updatedCount} linha(s) atualizada(s).`;
    clearScreenDirty('planning');
    if (options.autosave) {
      showToast(`Rascunho da ${preMode ? 'pré-programação' : 'programação'} salvo automaticamente.`, {
        kind: 'success',
        durationMs: 3200,
      });
    } else {
      setStatus(successMessage);
      openPlanningValidationModal(
        `Salvamento da planilha de ${preMode ? 'pré-programação' : 'programação'} concluído com sucesso.`,
        [],
        { title: 'Programação Semanal Salva' },
      );
    }
  } catch (error) {
    const errorMessage = translateApiError(error.message, 'Erro ao salvar a planilha da semana');
    if (options.autosave) {
      showToast(`Autosalvamento pausado: ${errorMessage}`, { kind: 'reminder', durationMs: 5200 });
    } else {
      setStatus(errorMessage, true);
      openPlanningValidationModal(
        errorMessage,
        [],
        { title: 'Falha no Salvamento' },
      );
    }
  } finally {
    window.setTimeout(() => {
      closePlanningSaveProgressModal();
    }, 250);
    state.weekSheetSaveInProgress = false;
    setPlanningSavingLock(false);
    const saveBtn = $('#saveWeekSheetBtn');
    if (saveBtn) {
      const week = activeWeek();
      const statusField = planningModeStatusField();
      const weekOpen = String(week?.[statusField] || '').toUpperCase() === 'OPEN';
      const canEdit = hasAnyRole(EDIT_ROLES)
        && weekOpen
        && (isPrePlanningMode() || String(week?.ppcMeeting?.isClosed || '').toLowerCase() === 'true');
      saveBtn.disabled = !canEdit;
    }
  }
}

async function deleteSheetTask(taskId) {
  await api(planningTaskItemPath(taskId), { method: 'DELETE' });
  await loadTasksAndDashboard();
  const resequenced = await resequencePersistedPlanningTasks();
  if (resequenced) await loadTasksAndDashboard();
  setStatus(`Linha #${taskId} excluída.`);
}

function removeSheetDraft(draftId) {
  state.sheetDraftRows = state.sheetDraftRows.filter((item) => item.draftId !== draftId);
  normalizeDraftSequenceNumbers();
  markScreenDirty('planning');
  renderTasks();
  setStatus('Linha de rascunho removida.');
}

async function handleImportGroupToWeek() {
  try {
    const targetWeek = await syncSelectedWeekFromWeekFieldIfNeeded();
    if (!targetWeek?.id) return setStatus('Selecione uma semana para importar grupo.', true);
    const taskGroupId = Number($('#importGroupSelect').value);
    if (!taskGroupId) return setStatus('Selecione o grupo de atividades para importar.', true);
    const source = $('#importGroupSource').value || 'obra';
    const groups = availableImportGroupsBySource(source);
    const group = groups.find((item) => Number(item.id) === taskGroupId);
    if (!group) {
      setStatus('Grupo selecionado não encontrado para a fonte escolhida.', true);
      return;
    }

    const items = (group.items || [])
      .slice()
      .sort((a, b) => (Number(a.sequenceNumber) || 0) - (Number(b.sequenceNumber) || 0));

    if (!items.length) {
      setStatus('O grupo selecionado não possui tarefas cadastradas.', true);
      return;
    }

    let seq = nextSheetSequenceNumber();
    const originWeekNumber = targetWeek.weekNumber || numericWeekField() || '';
    items.forEach((item, index) => {
      const laborType = String(item.laborType || '').trim();
      const matchingContractors = contractorsForLaborType(laborType);
      const autoContractor = matchingContractors.length === 1 ? matchingContractors[0] : null;
      state.sheetDraftRows.push({
        draftId: `${Date.now()}-import-${Math.random().toString(36).slice(2, 8)}-${index}`,
        sequenceNumber: seq++,
        originWeekNumber,
        contractorId: autoContractor?.id || null,
        contractorLaborType: laborType,
        supervisor: autoContractor?.supervisor || '',
        locationLevel1: '',
        locationLevel2: '',
        description: String(item.description || '').trim(),
        plannedStart: '',
        plannedEnd: '',
        status: 'PLANNED',
        plannedDays: [],
      });
    });
    normalizeDraftSequenceNumbers();
    markScreenDirty('planning');
    renderTasks();
    setStatus(`Grupo carregado na planilha (${items.length} linha(s)).`);
  } catch (error) {
    setStatus(`Erro ao importar grupo para a planilha: ${error.message}`, true);
  }
}

async function handleTaskAction(event) {
  const duplicateBtn = event.target.closest('button[data-sheet-duplicate]');
  if (duplicateBtn) {
    const row = sheetRowElementFromEventTarget(duplicateBtn);
    if (!row) return;
    try {
      createDraftFromSheetRow(row);
    } catch (error) {
      setStatus(`Erro ao duplicar linha: ${error.message}`, true);
    }
    return;
  }

  const cancelTaskBtn = event.target.closest('button[data-sheet-cancel-task]');
  if (cancelTaskBtn) {
    const taskId = Number(cancelTaskBtn.dataset.sheetCancelTask);
    if (!taskId) return;
    try {
      await api(`/tasks/${taskId}/cancel`, { method: 'POST' });
      await loadTasksAndDashboard();
      const resequenced = await resequencePersistedPlanningTasks();
      if (resequenced) await loadTasksAndDashboard();
      setStatus(`Atividade #${taskId} cancelada com sucesso.`);
    } catch (error) {
      setStatus(translateApiError(error.message, 'Erro ao cancelar atividade'), true);
    }
    return;
  }

  const cancelPreTaskBtn = event.target.closest('button[data-sheet-cancel-pre-task]');
  if (cancelPreTaskBtn) {
    const taskId = Number(cancelPreTaskBtn.dataset.sheetCancelPreTask);
    if (!taskId) return;
    try {
      await api(`/pre-tasks/${taskId}/cancel`, { method: 'POST' });
      await loadTasksAndDashboard();
      const resequenced = await resequencePersistedPlanningTasks();
      if (resequenced) await loadTasksAndDashboard();
      setStatus(`Atividade pendente #${taskId} cancelada com sucesso.`);
    } catch (error) {
      setStatus(translateApiError(error.message, 'Erro ao cancelar atividade pendente'), true);
    }
    return;
  }

  const deleteTaskBtn = event.target.closest('button[data-sheet-delete-task]');
  if (deleteTaskBtn) {
    const taskId = Number(deleteTaskBtn.dataset.sheetDeleteTask);
    if (!taskId) return;
    try {
      await deleteSheetTask(taskId);
    } catch (error) {
      setStatus(`Erro ao excluir linha: ${error.message}`, true);
    }
    return;
  }

  const deleteDraftBtn = event.target.closest('button[data-sheet-delete-draft]');
  if (deleteDraftBtn) {
    removeSheetDraft(deleteDraftBtn.dataset.sheetDeleteDraft);
    return;
  }
}

function handleTaskTableChange(event) {
  const row = sheetRowElementFromEventTarget(event.target);
  if (!row) return;
  markScreenDirty('planning');

  if (event.target.classList.contains('sheet-day')) {
    syncSheetRowDatesFromDayCheckboxes(row);
  }
  if (event.target.classList.contains('sheet-contractor')) {
    const contractorId = Number.parseInt(event.target.value || '', 10);
    const contractor = state.contractors.find((item) => Number(item.id) === contractorId);
    const supervisorInput = row.querySelector('.sheet-supervisor');
    if (supervisorInput && contractor && !supervisorInput.value.trim()) {
      supervisorInput.value = contractor.supervisor || '';
    }
    const laborLine = row.querySelector('.sheet-contractor-labor');
    if (laborLine) {
      laborLine.textContent = contractorLaborTypeLabel(contractorId, event.target.dataset.laborType || '');
    }
  }
  if (event.target.classList.contains('sheet-location1')) {
    refreshSheetRowLocation2(row);
  }
  if (event.target.classList.contains('sheet-start') || event.target.classList.contains('sheet-end')) {
    syncSheetRowDayCheckboxesFromDates(row);
  }

  if (row.dataset.sheetRowKind === 'draft') {
    syncDraftStateFromRow(row);
  }
}

function setDefaultWeekFields() {
  suggestNextWeekNumber();
  updateWeekFormPreview();
}

function bindEvents() {
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#sideNav').addEventListener('click', handleSideNavItemClick);
  $('#appView').addEventListener('click', handleWorkHomeLinkClick);
  $('#topWorkflowStrip')?.addEventListener('click', handleTopWorkflowStageClick);
  $('#sideNav').addEventListener('mouseenter', () => {
    if (!isMobileViewport()) document.body.classList.add('side-nav-expanded');
  });
  $('#sideNav').addEventListener('mouseleave', () => {
    if (!isMobileViewport()) document.body.classList.remove('side-nav-expanded');
  });
  $('#sideNavToggleBtn').addEventListener('click', () => {
    if (!isMobileViewport()) return;
    if (document.body.classList.contains('side-nav-mobile-open')) {
      closeSideNavMobile();
    } else {
      openSideNavMobile();
    }
  });
  $('#sideNavBackdrop').addEventListener('click', closeSideNavMobile);
  window.addEventListener('resize', () => {
    refreshSideNavVisibility();
  });

  $('#proceedAdminStart').addEventListener('click', proceedAdminStart);
  $('#proceedAdminWorkChoice').addEventListener('click', proceedAdminChoice);
  $('#backToAdminStartFromWorkChoice').addEventListener('click', () => showAdminGatewayStep('start'));
  $('#backToAdminChoiceFromSelect').addEventListener('click', () => showAdminGatewayStep('start'));
  $('#backToAdminChoiceFromCreate').addEventListener('click', () => showAdminGatewayStep('start'));
  $('#lookupCepBtn').addEventListener('click', lookupCep);
  $('#cadastroLookupCepBtn').addEventListener('click', lookupCadastroWorkCep);
  $('#companyLookupCepBtn').addEventListener('click', lookupCompanyCep);
  $('#proceedFromSelectWork').addEventListener('click', proceedAdminBySelection);
  $('#proceedFromCreateWork').addEventListener('click', proceedAdminByCreation);
  $('#proceedFromUserWork').addEventListener('click', proceedUserBySelection);

  $('#workSelect').addEventListener('change', handleWorkChange);
  $('#weekSelect').addEventListener('change', handleWeekChange);
  $('#weekNumber').addEventListener('input', handleWeekNumberTyping);
  $('#weekNumber').addEventListener('change', handleWeekNumberChange);
  $('#expectedWeekNumber').addEventListener('input', updateExpectedWeekPreview);
  $('#expectedWeekNumber').addEventListener('change', updateExpectedWeekPreview);
  $('#expectedWeekRefreshBtn').addEventListener('click', () => {
    refreshExpectedActivitiesTab({ useDefaultNext: false, silent: false })
      .catch((error) => setStatus(`Erro ao atualizar atividades previstas: ${error.message}`, true));
  });
  $('#ppcMeetingWeekNumber').addEventListener('input', updatePpcMeetingWeekPreview);
  $('#ppcMeetingWeekNumber').addEventListener('change', updatePpcMeetingWeekPreview);
  $('#ppcMeetingWeekRefreshBtn').addEventListener('click', () => {
    refreshPpcMeetingTab({ useDefaultNext: false, silent: false })
      .catch((error) => setStatus(`Erro ao atualizar reunião de PPC: ${error.message}`, true));
  });
  $('#ppcMeetingAddContractorBtn')?.addEventListener('click', addContractorToPpcMeeting);
  $('#ppcMeetingDate').addEventListener('input', () => {
    const input = $('#ppcMeetingDate');
    if (!input) return;
    input.value = normalizeBrDateInput(input.value);
    const picker = $('#ppcMeetingDatePicker');
    if (picker) {
      const parsed = parseBrDate(input.value);
      picker.value = parsed ? formatIsoDateInputFromValue(parsed) : '';
    }
    renderPpcMeetingMiniCalendar();
  });
  if ($('#ppcMeetingDatePicker')) {
    $('#ppcMeetingDatePicker').addEventListener('change', () => {
      const picker = $('#ppcMeetingDatePicker');
      const input = $('#ppcMeetingDate');
      if (!picker || !input) return;
      if (!picker.value) {
        input.value = '';
        renderPpcMeetingMiniCalendar();
        return;
      }
      const [year, month, day] = String(picker.value).split('-');
      input.value = `${day}/${month}/${year}`;
      renderPpcMeetingMiniCalendar();
    });
  }
  $('#ppcMeetingTime').addEventListener('input', () => {
    const input = $('#ppcMeetingTime');
    if (!input) return;
    input.value = normalizeBrTimeInput(input.value);
  });
  ['#prePlanningDeadlineTime', '#ppcMeetingDeadlineTime', '#planningDeadlineTime', '#feedbackDeadlineTime', '#qualityDeadlineTime']
    .forEach((selector) => {
      const input = $(selector);
      if (!input) return;
      input.addEventListener('input', () => {
        input.value = normalizeBrTimeInput(input.value);
      });
    });
  $('#feedbackWeekNumber').addEventListener('input', updateFeedbackWeekPreview);
  $('#feedbackWeekNumber').addEventListener('change', updateFeedbackWeekPreview);
  $('#feedbackWeekRefreshBtn').addEventListener('click', () => {
    refreshFeedbackTab({ useDefaultPrevious: false, silent: false })
      .catch((error) => setStatus(`Erro ao atualizar feedback da semana: ${error.message}`, true));
  });
  $('#qualityWeekNumber').addEventListener('input', updateQualityWeekPreview);
  $('#qualityWeekNumber').addEventListener('change', updateQualityWeekPreview);
  $('#qualityWeekRefreshBtn').addEventListener('click', () => {
    refreshQualityTab({ useDefaultCurrent: false, silent: false })
      .catch((error) => setStatus(`Erro ao atualizar qualidade percebida da semana: ${error.message}`, true));
  });
  $('#saveQualityBtn').addEventListener('click', () => {
    handleQualitySave().catch((error) => setStatus(`Erro ao salvar qualidade percebida: ${error.message}`, true));
  });
  $('#closeQualityWeekBtn').addEventListener('click', () => {
    handleQualityClose().catch((error) => setStatus(`Erro ao fechar qualidade percebida: ${error.message}`, true));
  });
  if ($('#reopenQualityWeekBtn')) {
    $('#reopenQualityWeekBtn').addEventListener('click', () => {
      handleQualityReopen().catch((error) => setStatus(`Erro ao reabrir qualidade percebida: ${error.message}`, true));
    });
  }
  $('#qualityWeekPdfBtn').addEventListener('click', () => {
    handleQualityPdfExport().catch((error) => setStatus(`Erro ao gerar PDF da qualidade percebida: ${error.message}`, true));
  });
  $('#closeQualityValidationBtn').addEventListener('click', closeQualityValidationModal);
  $('#qualityValidationModal').addEventListener('click', (event) => {
    if (event.target.id === 'qualityValidationModal') closeQualityValidationModal();
  });
  $('#feedbackComparisonPdfBtn').addEventListener('click', () => {
    handleFeedbackComparisonPdfExport()
      .catch((error) => setStatus(`Erro ao gerar PDF comparativo da semana: ${error.message}`, true));
  });
  $('#dashboardWeekNumber').addEventListener('input', updateDashboardWeekPreview);
  $('#dashboardWeekNumber').addEventListener('change', updateDashboardWeekPreview);
  $('#dashboardWeekRefreshBtn').addEventListener('click', () => {
    refreshDashboardBySubtab({ useDefault: false, silent: false })
      .catch((error) => setStatus(`Erro ao atualizar dashboards: ${error.message}`, true));
  });
  $('#expectedExportExcelBtn').addEventListener('click', () => {
    handleExpectedExportExcel().catch((error) => setStatus(`Erro ao exportar Excel de atividades previstas: ${error.message}`, true));
  });
  $('#expectedPdfButtons').addEventListener('click', (event) => {
    const allBtn = event.target.closest('button[data-expected-pdf-all-week]');
    if (allBtn) {
      handleExpectedWeekPdfExport()
        .catch((error) => setStatus(`Erro ao gerar PDF geral da semana: ${error.message}`, true));
      return;
    }
    const btn = event.target.closest('button[data-expected-pdf-contractor-id]');
    if (!btn) return;
    const contractorId = Number(btn.dataset.expectedPdfContractorId);
    if (!contractorId) return;
    const contractorName = btn.dataset.expectedPdfContractorName || '';
    handleExpectedContractorPdfExport(contractorId, contractorName)
      .catch((error) => setStatus(`Erro ao gerar PDF do empreiteiro: ${error.message}`, true));
  });
  $('#expectedSendEmailBtn').addEventListener('click', openExpectedEmailModal);
  $('#expectedEmailSendSelectedBtn').addEventListener('click', handleExpectedEmailSendSelected);
  $('#expectedEmailCancelBtn').addEventListener('click', closeExpectedEmailModal);
  $('#expectedEmailModal').addEventListener('click', (event) => {
    if (event.target.id === 'expectedEmailModal') closeExpectedEmailModal();
  });
  $('#ppcMeetingSavePreBtn').addEventListener('click', () => {
    handlePpcMeetingSavePre().catch((error) => setStatus(`Erro ao salvar pré-reunião: ${error.message}`, true));
  });
  $('#ppcMeetingPreExportAllPdfBtn').addEventListener('click', () => {
    handlePrePlanningAllPdfExport().catch((error) => setStatus(`Erro ao gerar PDF geral da pré-programação: ${error.message}`, true));
  });
  $('#ppcMeetingPreExportMinutesPdfBtn').addEventListener('click', () => {
    handlePpcMeetingPreMinutesPdfExport().catch((error) => setStatus(`Erro ao gerar PDF de ata + presença (pré-reunião): ${error.message}`, true));
  });
  $('#ppcMeetingPreSendAllEmailBtn').addEventListener('click', () => {
    const week = ppcMeetingWeekSelected();
    if (!week?.id) {
      setStatus('Selecione uma semana válida na aba Reunião de PPC.', true);
      return;
    }
    openPpcPreEmailModal();
  });
  $('#ppcMeetingPreContractorsBody').addEventListener('click', handlePpcMeetingPreContractorActions);
  $('#ppcPreEmailSendSelectedBtn').addEventListener('click', handlePpcPreEmailSendSelected);
  $('#ppcPreEmailCancelBtn').addEventListener('click', closePpcPreEmailModal);
  $('#ppcPreEmailModal').addEventListener('click', (event) => {
    if (event.target.id === 'ppcPreEmailModal') closePpcPreEmailModal();
  });
  $('#ppcMeetingSavePostBtn').addEventListener('click', () => {
    handlePpcMeetingSavePost().catch((error) => setStatus(`Erro ao salvar pós-reunião: ${error.message}`, true));
  });
  $('#ppcMeetingCloseBtn').addEventListener('click', () => {
    handlePpcMeetingClose().catch((error) => setStatus(`Erro ao fechar reunião de PPC: ${error.message}`, true));
  });
  if ($('#ppcMeetingReopenBtn')) {
    $('#ppcMeetingReopenBtn').addEventListener('click', () => {
      handlePpcMeetingReopen().catch((error) => setStatus(`Erro ao reabrir reunião de PPC: ${error.message}`, true));
    });
  }
  $('#ppcMeetingExportMinutesPdfBtn').addEventListener('click', () => {
    handlePpcMeetingMinutesPdfExport().catch((error) => setStatus(`Erro ao gerar PDF da ata/lista de presença: ${error.message}`, true));
  });
  $('#ppcMeetingSendMinutesEmailBtn').addEventListener('click', () => {
    const week = ppcMeetingWeekSelected();
    if (!week?.id) {
      setStatus('Selecione uma semana válida na aba Reunião de PPC.', true);
      return;
    }
    if (String(state.ppcMeetingData?.isClosed || '').toLowerCase() !== 'true') {
      setStatus('Feche a lista de presença e a ata antes de enviar por e-mail.', true);
      return;
    }
    openPpcPostEmailModal();
  });
  $('#ppcPostEmailSendSelectedBtn').addEventListener('click', handlePpcPostEmailSendSelected);
  $('#ppcPostEmailCancelBtn').addEventListener('click', closePpcPostEmailModal);
  $('#ppcPostEmailModal').addEventListener('click', (event) => {
    if (event.target.id === 'ppcPostEmailModal') closePpcPostEmailModal();
  });
  $('#dashboardLastWeekReportPdfBtn').addEventListener('click', () => {
    handleDashboardLastWeekReportPdfExport()
      .catch((error) => setStatus(`Erro ao gerar relatório da semana: ${error.message}`, true));
  });
  if ($('#dashboardHistoryPdfBtn')) {
    $('#dashboardHistoryPdfBtn').addEventListener('click', () => {
      handleDashboardHistoryReportPdfExport()
        .catch((error) => setStatus(`Erro ao gerar relatório histórico da obra: ${error.message}`, true));
    });
  }
  $('#weekRefreshBtn').addEventListener('click', () => handleWeekRefresh().catch((error) => setStatus(`Erro ao atualizar semana: ${error.message}`, true)));
  $('#openWeekBtn').addEventListener('click', () => {
    $('#weekForm').requestSubmit();
  });
  $('#taskContractor').addEventListener('change', handleTaskContractorChange);
  $('#taskLocation1').addEventListener('change', renderTaskLocationLevel2Options);
  $$('input[data-day]').forEach((input) => {
    input.addEventListener('change', syncTaskDatesFromDayCheckboxes);
  });
  $('#taskStart').addEventListener('input', syncTaskDayCheckboxesFromDates);
  $('#taskEnd').addEventListener('input', syncTaskDayCheckboxesFromDates);
  $('#refreshBtn').addEventListener('click', async () => {
    try {
      await refreshContext();
      setStatus('Dados atualizados.');
    } catch (error) {
      setStatus(`Erro ao atualizar: ${error.message}`, true);
    }
  });

  $('#contractorForm').addEventListener('submit', handleContractorCreate);
  $('#openContractorModalBtn').addEventListener('click', () => openContractorModal(false));
  $('#contractorCancelBtn').addEventListener('click', closeContractorModal);
  $('#contractorModal').addEventListener('click', (event) => {
    if (event.target.id === 'contractorModal') closeContractorModal();
  });
  $('#contractorValidationOkBtn').addEventListener('click', closeContractorValidationModal);
  $('#contractorValidationModal').addEventListener('click', (event) => {
    if (event.target.id === 'contractorValidationModal') closeContractorValidationModal();
  });
  $('#contractorPhone').addEventListener('input', () => {
    const input = $('#contractorPhone');
    if (!input) return;
    input.value = normalizePhoneDigits(input.value, 11);
  });
  $('#permissionProfileForm').addEventListener('submit', handlePermissionProfileSubmit);
  $('#permissionProfileCancelEditBtn').addEventListener('click', resetPermissionProfileForm);
  $('#openUserModalBtn').addEventListener('click', () => openUserModal());
  $('#userModalCancelBtn').addEventListener('click', closeUserModal);
  $('#userModalForm').addEventListener('submit', handleUserModalSave);
  $('#userModal').addEventListener('click', (event) => {
    if (event.target.id === 'userModal') closeUserModal();
  });
  $('#usersBackMenuBtn').addEventListener('click', () => showCadastroView('users'));
  $('#profilesBackMenuBtn').addEventListener('click', () => showCadastroView('users'));
  $('#openWorkModalBtn').addEventListener('click', () => {
    resetWorkForm();
    openWorkModal(false);
  });
  $('#cadastroWorkCancelBtn').addEventListener('click', closeWorkModal);
  $('#workModal').addEventListener('click', (event) => {
    if (event.target.id === 'workModal') closeWorkModal();
  });
  $('#workValidationOkBtn').addEventListener('click', closeWorkValidationModal);
  $('#workValidationModal').addEventListener('click', (event) => {
    if (event.target.id === 'workValidationModal') closeWorkValidationModal();
  });
  $('#cadastroWorkForm').addEventListener('submit', handleCadastroWorkCreate);
  $('#causeForm').addEventListener('submit', handleCauseCreate);
  $('#causeCancelEditBtn').addEventListener('click', resetCauseForm);
  $('#causeLevel').addEventListener('change', applyCauseLevelUi);
  $('#taskGroupForm').addEventListener('submit', handleTaskGroupCreate);
  $('#taskGroupCancelEditBtn').addEventListener('click', resetTaskGroupForm);
  $('#taskGroupItemForm').addEventListener('submit', handleTaskGroupItemCreate);
  $('#taskGroupItemCancelEditBtn').addEventListener('click', resetTaskGroupItemForm);
  $('#zoneLevel1Form').addEventListener('submit', handleZoneLevel1Create);
  $('#zoneLevel2Form').addEventListener('submit', handleZoneLevel2Create);
  $('#zoneLevel1CancelEditBtn').addEventListener('click', resetZoneLevel1Form);
  $('#zoneLevel2CancelEditBtn').addEventListener('click', resetZoneLevel2Form);
  $('#zoneLevel1EditSaveBtn').addEventListener('click', () => {
    handleZoneLevel1EditModalSave().catch((error) => setStatus(`Erro ao salvar zoneamento: ${error.message}`, true));
  });
  $('#zoneLevel1EditCancelBtn').addEventListener('click', closeZoneLevel1EditModal);
  $('#zoneLevel1EditAddLineBtn').addEventListener('click', () => appendZoneLevel2ModalLine());
  $('#zoneLevel1EditLevel2Lines').addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.zone-level2-remove-line');
    if (!removeBtn) return;
    const row = removeBtn.closest('.zone-level2-line-row');
    if (!row) return;
    row.remove();
  });
  $('#zoneLevel1EditModal').addEventListener('click', (event) => {
    if (event.target.id === 'zoneLevel1EditModal') closeZoneLevel1EditModal();
  });
  $('#obraHolidayForm').addEventListener('submit', handleObraHolidaySubmit);
  $('#obraHolidayDate').addEventListener('input', handleObraHolidayDateInput);
  $('#obraHolidayCancelEditBtn').addEventListener('click', resetObraHolidayForm);
  $('#obraHolidayCalendarPdfBtn').addEventListener('click', handleObraHolidayCalendarPdfExport);
  $('#obraDeadlineRuleForm').addEventListener('submit', handleObraDeadlineRuleSave);
  $('#obraPerceivedQualityForm').addEventListener('submit', handleObraPerceivedQualitySave);
  $('#obraDeadlineSavedOkBtn').addEventListener('click', closeObraDeadlineSavedModal);
  $('#obraDeadlineSavedModal').addEventListener('click', (event) => {
    if (event.target.id === 'obraDeadlineSavedModal') closeObraDeadlineSavedModal();
  });
  $('#obraContractorImportForm').addEventListener('submit', handleObraContractorImport);
  $('#obraContractorFunctionFilter').addEventListener('change', handleObraContractorFilterChange);
  $('#obraTaskGroupImportForm').addEventListener('submit', handleObraTaskGroupImport);
  $('#obraTaskGroupForm').addEventListener('submit', handleObraTaskGroupCreate);
  $('#obraTaskGroupCancelEditBtn').addEventListener('click', resetObraTaskGroupForm);
  $('#obraTaskGroupItemForm').addEventListener('submit', handleObraTaskGroupItemCreate);
  $('#obraTaskGroupItemCancelEditBtn').addEventListener('click', resetObraTaskGroupItemForm);
  $('#contractorFunctionForm').addEventListener('submit', handleLaborTypeCreate);
  $('#contractorFunctionCancelEditBtn').addEventListener('click', resetLaborTypeForm);
  $('#taskGroupSelect').addEventListener('change', handleTaskGroupSelectChange);
  $$('.obra-cadastro-tab-btn').forEach((button) => {
    button.addEventListener('click', () => selectObraCadastroTab(button.dataset.obraCadastroTab));
  });
  $$('.user-cadastro-tab-btn').forEach((button) => {
    button.addEventListener('click', () => selectUserCadastroTab(button.dataset.userCadastroTab));
  });
  $$('.dashboard-subtab-btn').forEach((button) => {
    button.addEventListener('click', () => selectDashboardSubtab(button.dataset.dashboardTab));
  });

  if ($('#openCadastroUsersBtn')) {
    $('#openCadastroUsersBtn').addEventListener('click', () => {
      selectUserCadastroTab('users');
      showCadastroView('users');
    });
  }
  if ($('#openCadastroWorksBtn')) $('#openCadastroWorksBtn').addEventListener('click', () => showCadastroView('works'));
  if ($('#openCadastroContractorsBtn')) $('#openCadastroContractorsBtn').addEventListener('click', () => showCadastroView('contractors'));
  if ($('#openCadastroCausesBtn')) $('#openCadastroCausesBtn').addEventListener('click', () => showCadastroView('causes'));
  if ($('#openCadastroGroupsBtn')) $('#openCadastroGroupsBtn').addEventListener('click', () => showCadastroView('groups'));
  if ($('#openCadastroLaborTypesBtn')) $('#openCadastroLaborTypesBtn').addEventListener('click', () => showCadastroView('laborTypes'));
  if ($('#openCadastroCompanyBtn')) $('#openCadastroCompanyBtn').addEventListener('click', () => showCadastroView('company'));
  $('#backCadastroWorksBtn').addEventListener('click', () => {
    closeWorkModal();
    closeWorkValidationModal();
    resetWorkForm();
    showCadastroView('users');
  });
  $('#backCadastroContractorsBtn').addEventListener('click', () => {
    closeContractorModal();
    closeContractorValidationModal();
    resetContractorForm();
    showCadastroView('users');
  });
  $('#backCadastroCausesBtn').addEventListener('click', () => {
    resetCauseForm();
    showCadastroView('users');
  });
  $('#backCadastroGroupsBtn').addEventListener('click', () => {
    resetTaskGroupForm();
    resetTaskGroupItemForm();
    showCadastroView('users');
  });
  $('#backCadastroLaborTypesBtn').addEventListener('click', () => {
    resetLaborTypeForm();
    showCadastroView('users');
  });
  $('#backCadastroCompanyBtn').addEventListener('click', () => {
    closeCompanySavedModal();
    showCadastroView('users');
  });
  $('#companyForm').addEventListener('submit', handleCompanySave);
  $('#companyLogo').addEventListener('change', handleCompanyLogoSelection);
  ['companyName', 'companyCnpj', 'companyCep', 'companyStreet', 'companyNeighborhood', 'companyCity', 'companyState', 'companyNumber', 'companyComplement', 'companySite']
    .forEach((id) => {
      const input = $(`#${id}`);
      if (input) input.addEventListener('input', renderCompanyHeaderPreview);
    });
  $('#closeCompanySavedModalBtn').addEventListener('click', closeCompanySavedModal);
  $('#companySavedModal').addEventListener('click', (event) => {
    if (event.target.id === 'companySavedModal') closeCompanySavedModal();
  });

  $('#worksBody').addEventListener('click', handleWorksRowAction);
  $('#usersBody').addEventListener('click', handleUserRowAction);
  $('#permissionProfilesBody').addEventListener('click', handlePermissionProfileRowAction);
  $('#contractorsBody').addEventListener('click', handleContractorRowAction);
  $('#zoneamentoBody').addEventListener('click', handleZoneamentoRowAction);
  $('#obraContractorsBody').addEventListener('click', handleObraContractorRowAction);
  $('#obraHolidaysBody').addEventListener('click', handleObraHolidayRowAction);
  $('#causesBody').addEventListener('click', handleCauseRowAction);
  $('#taskGroupItemsBody').addEventListener('click', handleTaskGroupItemRowAction);
  $('#obraTaskGroupItemsBody').addEventListener('click', handleObraTaskGroupItemRowAction);
  $('#laborTypesBody').addEventListener('click', handleLaborTypeRowAction);

  $('#weekForm').addEventListener('submit', handleWeekCreate);
  $('#taskForm').addEventListener('submit', handleTaskCreate);
  $('#feedbackForm').addEventListener('submit', handleFeedback);
  $('#feedbackTasksBody').addEventListener('click', handleFeedbackTaskAction);
  $('#feedbackTasksBody').addEventListener('change', handleFeedbackGridChange);
  $('#feedbackTasksBody').addEventListener('input', handleFeedbackGridChange);
  $('#qualityBody').addEventListener('change', handleQualityGridChange);
  $('#qualityBody').addEventListener('input', handleQualityGridChange);
  $('#feedbackNewTaskForm').addEventListener('submit', handleFeedbackNewTaskCreate);
  $('#feedbackBulkExecutedBtn').addEventListener('click', () => applyFeedbackBulkStatus('EXECUTED'));
  $('#feedbackBulkStartedBtn').addEventListener('click', () => applyFeedbackBulkStatus('STARTED'));
  $('#feedbackBulkNotStartedBtn').addEventListener('click', () => applyFeedbackBulkStatus('NOT_STARTED'));
  $('#closeFeedbackWeekBtn').addEventListener('click', () => {
    if ($('#closeFeedbackWeekBtn').disabled) return;
    openFeedbackCloseConfirmModal();
  });
  if ($('#reopenFeedbackWeekBtn')) {
    $('#reopenFeedbackWeekBtn').addEventListener('click', () => {
      handleFeedbackReopen().catch((error) => setStatus(`Erro ao reabrir feedback: ${error.message}`, true));
    });
  }
  $('#feedbackCloseConfirmNoBtn').addEventListener('click', () => {
    state.closeFeedbackPending = false;
    closeFeedbackCloseConfirmModal();
  });
  $('#feedbackCloseConfirmYesBtn').addEventListener('click', () => {
    if ($('#closeFeedbackWeekBtn').disabled) return;
    state.closeFeedbackPending = true;
    closeFeedbackCloseConfirmModal();
    $('#feedbackForm').requestSubmit();
  });
  $('#feedbackCloseConfirmModal').addEventListener('click', (event) => {
    if (event.target.id === 'feedbackCloseConfirmModal') {
      state.closeFeedbackPending = false;
      closeFeedbackCloseConfirmModal();
    }
  });
  $('#feedbackNewContractor').addEventListener('change', handleFeedbackNewContractorChange);
  $('#feedbackNewLocation1').addEventListener('change', renderFeedbackNewLocationLevel2Options);
  $$('input[data-feedback-new-day]').forEach((input) => {
    input.addEventListener('change', syncFeedbackNewDatesFromDayCheckboxes);
  });
  $('#feedbackNewActualStart').addEventListener('input', syncFeedbackNewDayCheckboxesFromDates);
  $('#feedbackNewActualEnd').addEventListener('input', syncFeedbackNewDayCheckboxesFromDates);

  $('#closePlanningBtn').addEventListener('click', () => runWeekAction('close'));
  $('#reopenBtn').addEventListener('click', () => runWeekAction('reopen'));
  $('#exportWeekExcelBtn').addEventListener('click', handleExportWeekExcel);
  $('#exportWeekTxtBtn').addEventListener('click', handleExportWeekTxt);
  $('#importWeekExcelBtn').addEventListener('click', () => handleImportWeekExcelClick().catch((error) => setStatus(`Erro ao preparar importação: ${error.message}`, true)));
  $('#importWeekTxtBtn').addEventListener('click', () => handleImportWeekTxtClick().catch((error) => setStatus(`Erro ao preparar importação TXT/CSV: ${error.message}`, true)));
  $('#importWeekExcelInput').addEventListener('change', handleImportWeekExcelFileChange);
  $('#importWeekTxtInput').addEventListener('change', handleImportWeekTxtFileChange);
  $('#saveWeekSheetBtn').addEventListener('click', handleSaveWeekSheet);
  $('#closePlanningValidationBtn').addEventListener('click', closePlanningValidationModal);
  $('#planningValidationModal').addEventListener('click', (event) => {
    if (event.target.id === 'planningValidationModal') closePlanningValidationModal();
  });
  $('#closePpcMeetingValidationBtn').addEventListener('click', closePpcMeetingValidationModal);
  $('#ppcMeetingValidationModal').addEventListener('click', (event) => {
    if (event.target.id === 'ppcMeetingValidationModal') closePpcMeetingValidationModal();
  });
  $('#closeFeedbackValidationBtn').addEventListener('click', closeFeedbackValidationModal);
  $('#feedbackValidationModal').addEventListener('click', (event) => {
    if (event.target.id === 'feedbackValidationModal') closeFeedbackValidationModal();
  });
  document.addEventListener('visibilitychange', () => {
    resetSaveReminderTicker();
  });
  $('#addRow1Btn').addEventListener('click', () => addSheetDraftRows(1).catch((error) => setStatus(`Erro ao adicionar linha: ${error.message}`, true)));
  $('#addRow3Btn').addEventListener('click', () => addSheetDraftRows(3).catch((error) => setStatus(`Erro ao adicionar linhas: ${error.message}`, true)));
  $('#addRow5Btn').addEventListener('click', () => addSheetDraftRows(5).catch((error) => setStatus(`Erro ao adicionar linhas: ${error.message}`, true)));
  $('#addRowCustomBtn').addEventListener('click', () => {
    const qty = Number.parseInt($('#addRowCustomQty').value || '', 10);
    if (!qty || qty < 1) {
      setStatus('Informe uma quantidade válida para adicionar linhas.', true);
      return;
    }
    addSheetDraftRows(qty).catch((error) => setStatus(`Erro ao adicionar linhas: ${error.message}`, true));
  });
  $('#importGroupSource').addEventListener('change', renderImportGroupSelect);
  $('#importGroupBtn').addEventListener('click', handleImportGroupToWeek);

  $('#tasksBody').addEventListener('click', handleTaskAction);
  $('#tasksBody').addEventListener('change', handleTaskTableChange);
  $('#tasksBody').addEventListener('input', handleTaskTableChange);
  ['planningFilterContractor', 'planningFilterLocation1', 'planningFilterLocation2', 'planningFilterTask', 'planningFilterMon', 'planningFilterTue', 'planningFilterWed', 'planningFilterThu', 'planningFilterFri', 'planningFilterSat', 'planningFilterStatus'].forEach((id) => {
    const el = $(`#${id}`);
    if (!el) return;
    el.addEventListener('input', () => {
      syncUiFiltersFromInputs();
      applyPlanningRowFilters();
    });
    el.addEventListener('change', () => {
      syncUiFiltersFromInputs();
      applyPlanningRowFilters();
    });
  });
  $('#planningFilterClearBtn').addEventListener('click', resetPlanningFilters);
  ['expectedFilterContractor', 'expectedFilterSupervisor', 'expectedFilterLabor', 'expectedFilterLocation1', 'expectedFilterLocation2', 'expectedFilterTask', 'expectedFilterStatus'].forEach((id) => {
    const el = $(`#${id}`);
    if (!el) return;
    el.addEventListener('input', () => {
      syncUiFiltersFromInputs();
      renderExpectedTasksTable();
    });
    el.addEventListener('change', () => {
      syncUiFiltersFromInputs();
      renderExpectedTasksTable();
    });
  });
  $('#expectedFilterClearBtn').addEventListener('click', resetExpectedFilters);
  ['feedbackFilterContractor', 'feedbackFilterLocation1', 'feedbackFilterLocation2', 'feedbackFilterTask', 'feedbackFilterStatus', 'feedbackFilterCauseGroup', 'feedbackFilterCause', 'feedbackFilterComment'].forEach((id) => {
    const el = $(`#${id}`);
    if (!el) return;
    el.addEventListener('input', () => {
      syncUiFiltersFromInputs();
      applyPlanningRowFilters();
    });
    el.addEventListener('change', () => {
      syncUiFiltersFromInputs();
      applyPlanningRowFilters();
    });
  });
  $('#feedbackFilterClearBtn').addEventListener('click', resetFeedbackFilters);
  $('#logoutBtn')?.addEventListener('click', performLogout);
  $$('[data-tab]').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.tab)));
}

setDefaultWeekFields();
showCadastroView('users');
bindEvents();
setupTypeAheadSelectFilter();
setupWeatherMiniThumbObserver();
setupWeatherMiniThumbDrag();
startDeadlineCountdownTicker();
resetUserForm();
resetPermissionProfileForm();
resetCauseForm();
resetTaskGroupItemForm();
resetLaborTypeForm();
resetObraHolidayForm();
resetObraDeadlineRuleForm();
resetObraPerceivedQualityForm();
resetObraTaskGroupForm();
syncFeedbackComparisonPdfButton();
updateQualityWeekPreview();
resetObraTaskGroupItemForm();
selectUserCadastroTab('users');
selectObraCadastroTab('zoneamento');
selectDashboardSubtab('relatorio');
refreshNavigationVisibility();
updateSessionInfo();
