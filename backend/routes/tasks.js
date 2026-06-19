const { Router } = require('express');
const fs = require('fs');
const XLSX = require('xlsx');
const { prisma } = require('../lib/prisma');
const { writeAudit } = require('../lib/audit');
const { ROLES, TASK_STATUS, WEEK_STATUS } = require('../lib/constants');
const { asyncHandler, parseIntId, parseDate, normalizeTaskStatus } = require('../lib/helpers');
const { authenticate, loadUser, requireWeekRoles, requireWorkRoles } = require('../lib/auth');
let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
} catch {
  PDFDocument = null;
}

const router = Router();
const LABOR_MARKER = 'LABOR:';
const ZONE_L1_PREFIX = '__ZONE_L1__::';

const PRIVILEGED = new Set([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER, ROLES.MANAGEMENT, ROLES.FOREMAN]);

async function findOrCreateLocation(workId, level1, level2) {
  const l1 = String(level1 || '').trim();
  const l2 = String(level2 || '').trim();
  if (!l1) return null;
  if (!l2) {
    const level1Marker = `${ZONE_L1_PREFIX}${l1}`;
    const existingLevel1 = await prisma.location.findUnique({
      where: { workId_level1_level2: { workId, level1: l1, level2: level1Marker } },
    });
    if (existingLevel1) return existingLevel1.id;
    const createdLevel1 = await prisma.location.create({
      data: { workId, level1: l1, level2: level1Marker },
    });
    return createdLevel1.id;
  }
  const existing = await prisma.location.findUnique({
    where: { workId_level1_level2: { workId, level1: l1, level2: l2 } },
  });
  if (existing) return existing.id;
  const created = await prisma.location.create({ data: { workId, level1: l1, level2: l2 } });
  return created.id;
}

function parseContractorSupervisor(contact) {
  const parts = String(contact || '').split('|').map((item) => item.trim()).filter(Boolean);
  for (const part of parts) {
    const [rawKey, ...rest] = part.split('=');
    const key = String(rawKey || '').trim().toUpperCase();
    const value = rest.join('=').trim();
    if (key === 'ENCARREGADO' && value) return value;
  }
  return '';
}

function parseContractorContact(contact) {
  const result = {
    supervisor: '',
    communicationEmail: '',
    phone: '',
  };
  const parts = String(contact || '').split('|').map((item) => item.trim()).filter(Boolean);
  for (const part of parts) {
    const [rawKey, ...rest] = part.split('=');
    const key = String(rawKey || '').trim().toUpperCase();
    const value = rest.join('=').trim();
    if (!value) continue;
    if (key === 'ENCARREGADO') result.supervisor = value;
    if (key === 'EMAIL') result.communicationEmail = value;
    if (key === 'TELEFONE') result.phone = value;
  }
  return result;
}

function sanitizeFileName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    || 'sem-nome';
}

function decodeImageDataUrl(dataUrl) {
  const text = String(dataUrl || '').trim();
  const match = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(text);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

function normalizeDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function taskEarliestPlannedDate(task) {
  const dates = (task.plannedDays || [])
    .map((item) => normalizeDateOnly(item.plannedDate))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length) return dates[0];
  const start = normalizeDateOnly(task.plannedStart);
  if (start) return start;
  const end = normalizeDateOnly(task.plannedEnd);
  if (end) return end;
  return null;
}

function taskStatusForWeek(task, weekStartDate) {
  if (task?.isUnplanned) return 'Não planejada';
  if (Number(task.originWeekId) !== Number(task.currentWeekId)) return 'Pendente';
  const weekStart = normalizeDateOnly(weekStartDate);
  const earliest = taskEarliestPlannedDate(task);
  if (weekStart && earliest && earliest.getTime() < weekStart.getTime()) return 'Pendente';
  const status = String(task?.status || '').toUpperCase();
  if (status === TASK_STATUS.RETRABALHO) return 'Retrabalho';
  if (status === TASK_STATUS.RESERVA) return 'Reserva';
  return 'Planejada';
}

function feedbackStatusPt(status) {
  const code = String(status || '').toUpperCase();
  if (code === 'EXECUTED') return 'Executada';
  if (code === 'EXECUTED_UNPLANNED') return 'Executada / Não planejada';
  if (code === 'STARTED') return 'Iniciada';
  if (code === 'NOT_STARTED') return 'Não iniciada';
  if (code === 'CANCELLED') return 'Cancelada';
  return '';
}

function taskFeedbackStatusLabel(task, weekStartDate) {
  const feedback = (task?.feedbacks || [])[0] || null;
  const fromFeedback = feedbackStatusPt(feedback?.status);
  if (fromFeedback) return fromFeedback;
  const status = String(task?.status || '').toUpperCase();
  if (status === TASK_STATUS.EXECUTED) return 'Executada';
  if (status === TASK_STATUS.IN_PROGRESS) return 'Iniciada';
  if (status === TASK_STATUS.CANCELLED) return 'Cancelada';
  if (task?.isUnplanned) return 'Executada / Não planejada';
  return taskStatusForWeek(task, weekStartDate);
}

function weekdayPt(weekday) {
  const map = {
    MONDAY: 'Seg',
    TUESDAY: 'Ter',
    WEDNESDAY: 'Qua',
    THURSDAY: 'Qui',
    FRIDAY: 'Sex',
    SATURDAY: 'Sáb',
    SUNDAY: 'Dom',
  };
  return map[String(weekday || '').toUpperCase()] || String(weekday || '');
}

function weekdayCodeFromDate(value) {
  const date = normalizeDateOnly(value);
  if (!date) return '';
  const map = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return map[date.getUTCDay()] || '';
}

function weatherIconPt(icon) {
  const code = String(icon || '').toUpperCase();
  if (code === 'SUNNY') return 'Ensolarado';
  if (code === 'RAIN') return 'Chuva';
  if (code === 'STORM') return 'Temporal';
  if (code === 'CLOUDY') return 'Nublado';
  return 'Sem dado';
}

function formatDateTimeBr(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function inferBrazilTimeZoneFromWork(work) {
  const address = String(work?.address || '');
  const ufMatch = /\/([A-Z]{2})(?:\)|$)/i.exec(address);
  const uf = String(ufMatch?.[1] || '').toUpperCase();
  const map = {
    AC: 'America/Rio_Branco',
    AM: 'America/Manaus',
    RR: 'America/Boa_Vista',
    RO: 'America/Porto_Velho',
    MT: 'America/Cuiaba',
    MS: 'America/Campo_Grande',
    PA: 'America/Belem',
    AP: 'America/Belem',
    TO: 'America/Araguaina',
  };
  return map[uf] || 'America/Sao_Paulo';
}

function formatDateTimeBrInTimeZone(value, timeZone) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleString('pt-BR', { timeZone });
  } catch {
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
}

async function resolvePpcMeetingAt(week) {
  if (week?.ppcMeeting?.meetingAt) return new Date(week.ppcMeeting.meetingAt);
  if (!week?.workId || !week?.weekNumber) return null;
  const previousWeek = await prisma.week.findUnique({
    where: { workId_weekNumber: { workId: week.workId, weekNumber: week.weekNumber - 1 } },
    select: {
      ppcMeeting: { select: { meetingAt: true } },
    },
  });
  if (previousWeek?.ppcMeeting?.meetingAt) {
    const base = new Date(previousWeek.ppcMeeting.meetingAt);
    base.setDate(base.getDate() + 7);
    return base;
  }
  if (!week.startDate) return null;
  const fallback = new Date(week.startDate);
  fallback.setHours(15, 0, 0, 0);
  fallback.setDate(fallback.getDate() + 2);
  return fallback;
}

function formatDateBr(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseBooleanCell(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'sim', 'x', 'ok', 's', 'y', 'yes'].includes(text);
}

function planningStatusForExport(task, currentWeekId) {
  if (task?.isUnplanned) return 'Não planejada';
  if (Number(task.originWeekId) !== Number(currentWeekId)) return 'Pendente';
  const status = String(task?.status || '').toUpperCase();
  if (status === TASK_STATUS.RETRABALHO) return 'Retrabalho';
  if (status === TASK_STATUS.RESERVA) return 'Reserva';
  return 'Programada';
}

async function ensurePlanningOpen(weekId) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    select: { planningStatus: true },
  });
  if (!week) return false;
  return week.planningStatus === WEEK_STATUS.OPEN;
}

async function ensurePlanningEditable(weekId) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    select: {
      planningStatus: true,
      ppcMeeting: { select: { isClosed: true } },
    },
  });
  if (!week) return { ok: false, error: 'week_not_found' };
  if (String(week.planningStatus || '').toUpperCase() !== WEEK_STATUS.OPEN) {
    return { ok: false, error: 'planning_closed' };
  }
  if (week.ppcMeeting?.isClosed !== true) {
    return { ok: false, error: 'planning_requires_ppc_meeting_close' };
  }
  return { ok: true };
}

async function ensurePrePlanningOpen(weekId) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    select: { prePlanningStatus: true },
  });
  if (!week) return false;
  return String(week.prePlanningStatus || '').toUpperCase() === WEEK_STATUS.OPEN;
}

async function listActiveContractorsForWeek(weekId, workId) {
  const preRows = await prisma.preTask.findMany({
    where: {
      weekId,
      contractorId: { not: null },
      status: { not: TASK_STATUS.CANCELLED },
    },
    include: {
      contractor: {
        include: { function: true },
      },
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  const sourceRows = preRows.length
    ? preRows
    : await prisma.task.findMany({
      where: {
        currentWeekId: weekId,
        contractorId: { not: null },
        status: { not: TASK_STATUS.CANCELLED },
      },
      include: {
        contractor: {
          include: { function: true },
        },
      },
      orderBy: { sequenceNumber: 'asc' },
    });

  const byId = new Map();
  sourceRows.forEach((item) => {
    const contractor = item.contractor;
    if (!contractor?.id) return;
    if (Number(contractor.workId) !== Number(workId)) return;
    if (!byId.has(contractor.id)) byId.set(contractor.id, contractor);
  });

  return [...byId.values()]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

function normalizePlanningTaskStatusInput(value) {
  const status = normalizeTaskStatus(value);
  if (status === TASK_STATUS.CANCELLED) return TASK_STATUS.CANCELLED;
  if (status === TASK_STATUS.EXECUTED || status === TASK_STATUS.IN_PROGRESS) {
    return TASK_STATUS.PLANNED;
  }
  if (status === TASK_STATUS.RETRABALHO) return TASK_STATUS.RETRABALHO;
  if (status === TASK_STATUS.RESERVA) return TASK_STATUS.RESERVA;
  return TASK_STATUS.PLANNED;
}

function samePlanningDays(a = [], b = []) {
  const left = (Array.isArray(a) ? a : [])
    .map((item) => `${String(item?.weekday || '').toUpperCase()}|${String(item?.plannedDate || '')}`)
    .sort();
  const right = (Array.isArray(b) ? b : [])
    .map((item) => `${String(item?.weekday || '').toUpperCase()}|${String(item?.plannedDate || '')}`)
    .sort();
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

async function resequencePlanningTasksForWeek(weekId, tx = prisma) {
  const rows = await tx.task.findMany({
    where: { currentWeekId: weekId },
    orderBy: [
      { sequenceNumber: 'asc' },
      { id: 'asc' },
    ],
    select: { id: true, sequenceNumber: true },
  });

  for (let index = 0; index < rows.length; index += 1) {
    const nextSequence = index + 1;
    if (Number(rows[index].sequenceNumber) === nextSequence) continue;
    // eslint-disable-next-line no-await-in-loop
    await tx.task.update({
      where: { id: rows[index].id },
      data: { sequenceNumber: nextSequence },
    });
  }
}

async function resequencePrePlanningTasksForWeek(weekId, tx = prisma) {
  const rows = await tx.preTask.findMany({
    where: {
      weekId,
      status: { not: TASK_STATUS.CANCELLED },
    },
    orderBy: [
      { sequenceNumber: 'asc' },
      { id: 'asc' },
    ],
    select: { id: true, sequenceNumber: true },
  });

  for (let index = 0; index < rows.length; index += 1) {
    const nextSequence = index + 1;
    if (Number(rows[index].sequenceNumber) === nextSequence) continue;
    // eslint-disable-next-line no-await-in-loop
    await tx.preTask.update({
      where: { id: rows[index].id },
      data: { sequenceNumber: nextSequence },
    });
  }
}

function serializePreTask(item, weekId) {
  return {
    id: item.id,
    sequenceNumber: item.sequenceNumber,
    originWeekId: item.originWeekId,
    currentWeekId: item.weekId,
    weekId: item.weekId,
    contractorId: item.contractorId,
    supervisor: item.supervisor,
    locationId: item.locationId,
    description: item.description,
    plannedStart: item.plannedStart,
    plannedEnd: item.plannedEnd,
    status: item.status || TASK_STATUS.PLANNED,
    isUnplanned: false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    contractor: item.contractor || null,
    location: item.location || null,
    originWeek: item.originWeek || null,
    plannedDays: item.plannedDays || [],
    feedbacks: [],
    _source: 'PRE_PLANNING',
    _weekId: weekId,
  };
}

router.get('/weeks/:weekId/tasks', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  const where = { currentWeekId: req.week.id };

  if (req.workRoles.has(ROLES.CONTRACTOR) && ![...req.workRoles].some((r) => PRIVILEGED.has(r))) {
    if (!req.user.contractorId) return res.json([]);
    where.contractorId = req.user.contractorId;
  }

  const items = await prisma.task.findMany({
    where,
    include: {
      contractor: { include: { function: true } },
      location: true,
      originWeek: { select: { weekNumber: true } },
      plannedDays: { orderBy: { weekday: 'asc' } },
      feedbacks: {
        where: { weekId: req.week.id },
        include: { cause: true },
      },
    },
    orderBy: { sequenceNumber: 'asc' },
  });
  return res.json(items);
}));

router.post('/weeks/:weekId/tasks', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const planningGate = await ensurePlanningEditable(req.week.id);
  if (!planningGate.ok) return res.status(409).json({ error: planningGate.error });

  const {
    sequenceNumber,
    originWeekId,
    originWeekNumber,
    contractorId,
    supervisor,
    locationId,
    locationLevel1,
    locationLevel2,
    description,
    plannedStart,
    plannedEnd,
    status,
    plannedDays = [],
  } = req.body;

  if (!description) return res.status(400).json({ error: 'description_required' });

  const maxSeq = await prisma.task.findFirst({
    where: { currentWeekId: req.week.id },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });

  let resolvedOriginWeekId = originWeekId || req.week.id;
  const parsedOriginWeekNumber = parseIntId(originWeekNumber);
  if (parsedOriginWeekNumber) {
    const origin = await prisma.week.findUnique({
      where: {
        workId_weekNumber: {
          workId: req.workId,
          weekNumber: parsedOriginWeekNumber,
        },
      },
      select: { id: true },
    });
    if (origin) resolvedOriginWeekId = origin.id;
  }

  let resolvedLocationId = locationId || null;
  if (!resolvedLocationId && locationLevel1) {
    resolvedLocationId = await findOrCreateLocation(req.workId, locationLevel1, locationLevel2);
  }

  const normalizedStatus = normalizePlanningTaskStatusInput(status);
  const normalizedPlannedStart = parseDate(plannedStart);
  const normalizedPlannedEnd = parseDate(plannedEnd);
  const normalizedPlannedDays = Array.isArray(plannedDays)
    ? plannedDays.filter((d) => d && d.weekday).map((d) => ({
      weekday: String(d.weekday).toUpperCase(),
      plannedDate: parseDate(d.plannedDate),
    }))
    : [];

  const existingEquivalent = await prisma.task.findFirst({
    where: {
      currentWeekId: req.week.id,
      sequenceNumber: parseIntId(sequenceNumber) || (maxSeq?.sequenceNumber || 0) + 1,
      originWeekId: resolvedOriginWeekId,
      contractorId: contractorId || null,
      supervisor: supervisor || null,
      locationId: resolvedLocationId,
      description,
      plannedStart: normalizedPlannedStart,
      plannedEnd: normalizedPlannedEnd,
      status: normalizedStatus,
    },
    include: { contractor: true, location: true, plannedDays: true },
  });
  if (existingEquivalent && samePlanningDays(existingEquivalent.plannedDays, normalizedPlannedDays)) {
    return res.json(existingEquivalent);
  }

  const item = await prisma.task.create({
    data: {
      sequenceNumber: parseIntId(sequenceNumber) || (maxSeq?.sequenceNumber || 0) + 1,
      originWeekId: resolvedOriginWeekId,
      currentWeekId: req.week.id,
      contractorId: contractorId || null,
      supervisor: supervisor || null,
      locationId: resolvedLocationId,
      description,
      plannedStart: normalizedPlannedStart,
      plannedEnd: normalizedPlannedEnd,
      status: normalizedStatus,
      plannedDays: {
        create: normalizedPlannedDays,
      },
    },
    include: { contractor: true, location: true, plannedDays: true },
  });

  await resequencePlanningTasksForWeek(req.week.id);

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'TASK',
    entityId: item.id,
    eventType: 'TASK_CREATED',
    description: `Tarefa ${item.sequenceNumber} criada na semana ${req.week.weekNumber}.`,
  });

  return res.status(201).json(item);
}));

router.post('/weeks/:weekId/tasks/from-group', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const planningGate = await ensurePlanningEditable(req.week.id);
  if (!planningGate.ok) return res.status(409).json({ error: planningGate.error });

  const taskGroupId = parseIntId(req.body.taskGroupId);
  if (!taskGroupId) return res.status(400).json({ error: 'taskGroupId_required' });

  const group = await prisma.taskGroup.findUnique({
    where: { id: taskGroupId },
    include: { items: { orderBy: { sequenceNumber: 'asc' } } },
  });
  if (!group) return res.status(404).json({ error: 'task_group_not_found' });
  if (group.workId && group.workId !== req.workId) {
    return res.status(400).json({ error: 'task_group_not_from_this_work' });
  }

  const maxSeq = await prisma.task.findFirst({
    where: { currentWeekId: req.week.id },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });

  let seq = (maxSeq?.sequenceNumber || 0) + 1;
  const created = [];

  for (const t of group.items) {
    let locationId = null;
    if (t.defaultLocationL1 && t.defaultLocationL2) {
      locationId = await findOrCreateLocation(req.workId, t.defaultLocationL1, t.defaultLocationL2);
    }

    const row = await prisma.task.create({
      data: {
        sequenceNumber: seq++,
        originWeekId: req.week.id,
        currentWeekId: req.week.id,
        contractorId: t.defaultContractorId || null,
        supervisor: String(t.defaultSupervisor || '').startsWith(LABOR_MARKER) ? null : (t.defaultSupervisor || null),
        locationId,
        description: t.description,
        status: TASK_STATUS.PLANNED,
      },
    });
    created.push(row);
  }

  await resequencePlanningTasksForWeek(req.week.id);

  return res.status(201).json({ count: created.length, tasks: created });
}));

router.get('/weeks/:weekId/pre-tasks', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  const where = {
    weekId: req.week.id,
    status: { not: TASK_STATUS.CANCELLED },
  };

  if (req.workRoles.has(ROLES.CONTRACTOR) && ![...req.workRoles].some((r) => PRIVILEGED.has(r))) {
    if (!req.user.contractorId) return res.json([]);
    where.contractorId = req.user.contractorId;
  }

  const items = await prisma.preTask.findMany({
    where,
    include: {
      contractor: { include: { function: true } },
      location: true,
      originWeek: { select: { weekNumber: true } },
      plannedDays: { orderBy: { weekday: 'asc' } },
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  return res.json(items.map((item) => serializePreTask(item, req.week.id)));
}));

router.post('/weeks/:weekId/pre-tasks', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const prePlanningOpen = await ensurePrePlanningOpen(req.week.id);
  if (!prePlanningOpen) return res.status(409).json({ error: 'pre_planning_closed' });

  const {
    sequenceNumber,
    originWeekId,
    originWeekNumber,
    contractorId,
    supervisor,
    locationId,
    locationLevel1,
    locationLevel2,
    description,
    plannedStart,
    plannedEnd,
    status,
    plannedDays = [],
  } = req.body;

  if (!description) return res.status(400).json({ error: 'description_required' });

  const maxSeq = await prisma.preTask.findFirst({
    where: { weekId: req.week.id },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });

  let resolvedOriginWeekId = originWeekId || req.week.id;
  const parsedOriginWeekNumber = parseIntId(originWeekNumber);
  if (parsedOriginWeekNumber) {
    const origin = await prisma.week.findUnique({
      where: {
        workId_weekNumber: {
          workId: req.workId,
          weekNumber: parsedOriginWeekNumber,
        },
      },
      select: { id: true },
    });
    if (origin) resolvedOriginWeekId = origin.id;
  }

  let resolvedLocationId = locationId || null;
  if (!resolvedLocationId && locationLevel1) {
    resolvedLocationId = await findOrCreateLocation(req.workId, locationLevel1, locationLevel2);
  }

  const normalizedStatus = normalizePlanningTaskStatusInput(status);
  const normalizedPlannedStart = parseDate(plannedStart);
  const normalizedPlannedEnd = parseDate(plannedEnd);
  const normalizedPlannedDays = Array.isArray(plannedDays)
    ? plannedDays.filter((d) => d && d.weekday).map((d) => ({
      weekday: String(d.weekday).toUpperCase(),
      plannedDate: parseDate(d.plannedDate),
    }))
    : [];

  const existingEquivalent = await prisma.preTask.findFirst({
    where: {
      weekId: req.week.id,
      sequenceNumber: parseIntId(sequenceNumber) || (maxSeq?.sequenceNumber || 0) + 1,
      originWeekId: resolvedOriginWeekId,
      contractorId: contractorId || null,
      supervisor: supervisor || null,
      locationId: resolvedLocationId,
      description,
      plannedStart: normalizedPlannedStart,
      plannedEnd: normalizedPlannedEnd,
      status: normalizedStatus,
    },
    include: {
      contractor: { include: { function: true } },
      location: true,
      originWeek: { select: { weekNumber: true } },
      plannedDays: { orderBy: { weekday: 'asc' } },
    },
  });
  if (existingEquivalent && samePlanningDays(existingEquivalent.plannedDays, normalizedPlannedDays)) {
    return res.json(serializePreTask(existingEquivalent, req.week.id));
  }

  const item = await prisma.preTask.create({
    data: {
      sequenceNumber: parseIntId(sequenceNumber) || (maxSeq?.sequenceNumber || 0) + 1,
      originWeekId: resolvedOriginWeekId,
      weekId: req.week.id,
      contractorId: contractorId || null,
      supervisor: supervisor || null,
      locationId: resolvedLocationId,
      description,
      plannedStart: normalizedPlannedStart,
      plannedEnd: normalizedPlannedEnd,
      status: normalizedStatus,
      plannedDays: {
        create: normalizedPlannedDays,
      },
    },
    include: {
      contractor: { include: { function: true } },
      location: true,
      originWeek: { select: { weekNumber: true } },
      plannedDays: { orderBy: { weekday: 'asc' } },
    },
  });

  await resequencePrePlanningTasksForWeek(req.week.id);

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'PRE_TASK',
    entityId: item.id,
    eventType: 'PRE_TASK_CREATED',
    description: `Tarefa de pré-programação ${item.sequenceNumber} criada na semana ${req.week.weekNumber}.`,
  });

  return res.status(201).json(serializePreTask(item, req.week.id));
}));

router.post('/weeks/:weekId/pre-tasks/from-group', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const prePlanningOpen = await ensurePrePlanningOpen(req.week.id);
  if (!prePlanningOpen) return res.status(409).json({ error: 'pre_planning_closed' });

  const taskGroupId = parseIntId(req.body.taskGroupId);
  if (!taskGroupId) return res.status(400).json({ error: 'taskGroupId_required' });

  const group = await prisma.taskGroup.findUnique({
    where: { id: taskGroupId },
    include: { items: { orderBy: { sequenceNumber: 'asc' } } },
  });
  if (!group) return res.status(404).json({ error: 'task_group_not_found' });
  if (group.workId && group.workId !== req.workId) {
    return res.status(400).json({ error: 'task_group_not_from_this_work' });
  }

  const maxSeq = await prisma.preTask.findFirst({
    where: { weekId: req.week.id },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });

  let seq = (maxSeq?.sequenceNumber || 0) + 1;
  const created = [];

  for (const t of group.items) {
    let locationId = null;
    if (t.defaultLocationL1 && t.defaultLocationL2) {
      // eslint-disable-next-line no-await-in-loop
      locationId = await findOrCreateLocation(req.workId, t.defaultLocationL1, t.defaultLocationL2);
    }

    // eslint-disable-next-line no-await-in-loop
    const row = await prisma.preTask.create({
      data: {
        sequenceNumber: seq++,
        originWeekId: req.week.id,
        weekId: req.week.id,
        contractorId: t.defaultContractorId || null,
        supervisor: String(t.defaultSupervisor || '').startsWith(LABOR_MARKER) ? null : (t.defaultSupervisor || null),
        locationId,
        description: t.description,
        status: TASK_STATUS.PLANNED,
      },
      include: {
        contractor: { include: { function: true } },
        location: true,
        originWeek: { select: { weekNumber: true } },
        plannedDays: { orderBy: { weekday: 'asc' } },
      },
    });
    created.push(serializePreTask(row, req.week.id));
  }

  await resequencePrePlanningTasksForWeek(req.week.id);

  return res.status(201).json({ count: created.length, tasks: created });
}));

router.put('/pre-tasks/:taskId', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const taskId = parseIntId(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'invalid_task_id' });
  const preTask = await prisma.preTask.findUnique({
    where: { id: taskId },
    include: { week: { select: { id: true, workId: true, prePlanningStatus: true } } },
  });
  if (!preTask) return res.status(404).json({ error: 'task_not_found' });
  req.preTask = preTask;
  req.params.workId = String(preTask.week.workId);
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (String(req.preTask.week.prePlanningStatus || '').toUpperCase() !== WEEK_STATUS.OPEN) {
    return res.status(409).json({ error: 'pre_planning_closed' });
  }

  const {
    contractorId,
    supervisor,
    sequenceNumber,
    locationId,
    locationLevel1,
    locationLevel2,
    description,
    plannedStart,
    plannedEnd,
    status,
    plannedDays,
  } = req.body;

  let resolvedLocationId = locationId || req.preTask.locationId;
  if (!resolvedLocationId && locationLevel1) {
    resolvedLocationId = await findOrCreateLocation(req.preTask.week.workId, locationLevel1, locationLevel2);
  }

  const hasPlannedStart = Object.prototype.hasOwnProperty.call(req.body, 'plannedStart');
  const hasPlannedEnd = Object.prototype.hasOwnProperty.call(req.body, 'plannedEnd');
  const hasDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
  const hasStatus = Object.prototype.hasOwnProperty.call(req.body, 'status');
  const hasPlannedDays = Array.isArray(plannedDays);

  const updated = await prisma.preTask.update({
    where: { id: req.preTask.id },
    data: {
      sequenceNumber: parseIntId(sequenceNumber) ?? req.preTask.sequenceNumber,
      originWeekId: req.preTask.originWeekId,
      contractorId: contractorId ?? req.preTask.contractorId,
      supervisor: supervisor ?? req.preTask.supervisor,
      locationId: resolvedLocationId || null,
      description: hasDescription ? (description || req.preTask.description) : req.preTask.description,
      plannedStart: hasPlannedStart ? (parseDate(plannedStart) || null) : req.preTask.plannedStart,
      plannedEnd: hasPlannedEnd ? (parseDate(plannedEnd) || null) : req.preTask.plannedEnd,
      status: hasStatus ? normalizePlanningTaskStatusInput(status) : req.preTask.status,
      plannedDays: hasPlannedDays ? {
        deleteMany: {},
        create: plannedDays
          .filter((d) => d && d.weekday)
          .map((d) => ({
            weekday: String(d.weekday).toUpperCase(),
            plannedDate: parseDate(d.plannedDate),
          })),
      } : undefined,
    },
    include: {
      contractor: { include: { function: true } },
      location: true,
      originWeek: { select: { weekNumber: true } },
      plannedDays: { orderBy: { weekday: 'asc' } },
    },
  });

  await resequencePrePlanningTasksForWeek(req.preTask.week.id);

  return res.json(serializePreTask(updated, req.preTask.week.id));
}));

router.delete('/pre-tasks/:taskId', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const taskId = parseIntId(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'invalid_task_id' });
  const preTask = await prisma.preTask.findUnique({
    where: { id: taskId },
    include: { week: { select: { id: true, workId: true, prePlanningStatus: true } } },
  });
  if (!preTask) return res.status(404).json({ error: 'task_not_found' });
  req.preTask = preTask;
  req.params.workId = String(preTask.week.workId);
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (String(req.preTask.week.prePlanningStatus || '').toUpperCase() !== WEEK_STATUS.OPEN) {
    return res.status(409).json({ error: 'pre_planning_closed' });
  }
  if (Number(req.preTask.originWeekId) !== Number(req.preTask.weekId)) {
    return res.status(409).json({ error: 'cannot_delete_carried_task' });
  }

  await prisma.preTaskPlannedDay.deleteMany({ where: { preTaskId: req.preTask.id } });
  await prisma.preTask.delete({ where: { id: req.preTask.id } });
  await resequencePrePlanningTasksForWeek(req.preTask.week.id);
  return res.status(204).send();
}));

router.post('/pre-tasks/:taskId/cancel', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const taskId = parseIntId(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'invalid_task_id' });
  const preTask = await prisma.preTask.findUnique({
    where: { id: taskId },
    include: { week: { select: { id: true, workId: true, prePlanningStatus: true } } },
  });
  if (!preTask) return res.status(404).json({ error: 'task_not_found' });
  req.preTask = preTask;
  req.params.workId = String(preTask.week.workId);
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (String(req.preTask.week.prePlanningStatus || '').toUpperCase() !== WEEK_STATUS.OPEN) {
    return res.status(409).json({ error: 'pre_planning_closed' });
  }
  if (Number(req.preTask.originWeekId) === Number(req.preTask.weekId)) {
    return res.status(409).json({ error: 'cannot_cancel_current_week_task' });
  }
  if (String(req.preTask.status || '').toUpperCase() === TASK_STATUS.CANCELLED) {
    return res.status(409).json({ error: 'task_already_cancelled' });
  }

  const canceled = await prisma.preTask.update({
    where: { id: req.preTask.id },
    data: { status: TASK_STATUS.CANCELLED },
    include: {
      contractor: { include: { function: true } },
      location: true,
      originWeek: { select: { weekNumber: true } },
      plannedDays: { orderBy: { weekday: 'asc' } },
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.preTask.week.workId,
    entityType: 'PRE_TASK',
    entityId: req.preTask.id,
    eventType: 'PRE_TASK_CANCELLED',
    description: `Tarefa herdada ${req.preTask.id} marcada como excluída na pré-programação, com histórico preservado.`,
  });

  await resequencePrePlanningTasksForWeek(req.preTask.week.id);

  return res.json(serializePreTask(canceled, req.preTask.week.id));
}));

router.post('/weeks/:weekId/pre-tasks/sync-to-planning', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const planningGate = await ensurePlanningEditable(req.week.id);
  if (!planningGate.ok) return res.status(409).json({ error: planningGate.error });

  const replace = req.body?.replace === true;
  const onlyIfEmpty = req.body?.onlyIfEmpty !== false;

  const [planningCount, preTasks] = await Promise.all([
    prisma.task.count({ where: { currentWeekId: req.week.id } }),
    prisma.preTask.findMany({
      where: { weekId: req.week.id, status: { not: TASK_STATUS.CANCELLED } },
      include: { plannedDays: { orderBy: { weekday: 'asc' } } },
      orderBy: { sequenceNumber: 'asc' },
    }),
  ]);

  if (!preTasks.length) {
    return res.json({ copiedCount: 0, skipped: true, reason: 'no_pre_tasks' });
  }

  if (planningCount > 0 && onlyIfEmpty) {
    return res.json({ copiedCount: 0, skipped: true, reason: 'planning_not_empty' });
  }

  if (planningCount > 0 && !replace && !onlyIfEmpty) {
    return res.status(409).json({ error: 'planning_not_empty' });
  }

  const copiedCount = await prisma.$transaction(async (tx) => {
    if (planningCount > 0) {
      const ids = (await tx.task.findMany({
        where: { currentWeekId: req.week.id },
        select: { id: true },
      })).map((item) => item.id);

      if (ids.length) {
        await tx.feedback.deleteMany({ where: { taskId: { in: ids } } });
        await tx.taskPlannedDay.deleteMany({ where: { taskId: { in: ids } } });
      }
      await tx.task.deleteMany({ where: { currentWeekId: req.week.id } });
    }

    for (const item of preTasks) {
      // eslint-disable-next-line no-await-in-loop
      await tx.task.create({
        data: {
          sequenceNumber: item.sequenceNumber,
          originWeekId: item.originWeekId || req.week.id,
          currentWeekId: req.week.id,
          contractorId: item.contractorId || null,
          supervisor: item.supervisor || null,
          locationId: item.locationId || null,
          description: item.description,
          plannedStart: item.plannedStart || null,
          plannedEnd: item.plannedEnd || null,
          status: normalizePlanningTaskStatusInput(item.status),
          plannedDays: {
            create: (item.plannedDays || []).map((day) => ({
              weekday: String(day.weekday || '').toUpperCase(),
              plannedDate: day.plannedDate || null,
            })),
          },
        },
      });
    }
    await resequencePlanningTasksForWeek(req.week.id, tx);
    return preTasks.length;
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WEEK',
    entityId: req.week.id,
    eventType: 'PRE_TO_PLANNING_SYNC',
    description: `Pré-programação sincronizada para programação da semana ${req.week.weekNumber} (${copiedCount} tarefas).`,
  });

  return res.json({
    copiedCount,
    skipped: false,
    replacedPlanning: planningCount > 0,
  });
}));

router.put('/tasks/:taskId', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const taskId = parseIntId(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'invalid_task_id' });
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { currentWeek: { select: { id: true, workId: true, planningStatus: true, ppcMeeting: { select: { isClosed: true } } } } },
  });
  if (!task) return res.status(404).json({ error: 'task_not_found' });
  req.task = task;
  req.params.workId = String(task.currentWeek.workId);
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (req.task.currentWeek.planningStatus !== WEEK_STATUS.OPEN) {
    return res.status(409).json({ error: 'planning_closed' });
  }
  if (req.task.currentWeek?.ppcMeeting?.isClosed !== true) {
    return res.status(409).json({ error: 'planning_requires_ppc_meeting_close' });
  }

  const {
    contractorId,
    supervisor,
    sequenceNumber,
    locationId,
    locationLevel1,
    locationLevel2,
    description,
    plannedStart,
    plannedEnd,
    status,
    plannedDays,
  } = req.body;

  let resolvedLocationId = locationId || req.task.locationId;
  if (!resolvedLocationId && locationLevel1) {
    resolvedLocationId = await findOrCreateLocation(req.task.currentWeek.workId, locationLevel1, locationLevel2);
  }

  const hasPlannedStart = Object.prototype.hasOwnProperty.call(req.body, 'plannedStart');
  const hasPlannedEnd = Object.prototype.hasOwnProperty.call(req.body, 'plannedEnd');
  const hasDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
  const hasStatus = Object.prototype.hasOwnProperty.call(req.body, 'status');
  const hasPlannedDays = Array.isArray(plannedDays);

  const updated = await prisma.task.update({
    where: { id: req.task.id },
    data: {
      sequenceNumber: parseIntId(sequenceNumber) ?? req.task.sequenceNumber,
      originWeekId: req.task.originWeekId,
      contractorId: contractorId ?? req.task.contractorId,
      supervisor: supervisor ?? req.task.supervisor,
      locationId: resolvedLocationId || null,
      description: hasDescription ? (description || req.task.description) : req.task.description,
      plannedStart: hasPlannedStart ? (parseDate(plannedStart) || null) : req.task.plannedStart,
      plannedEnd: hasPlannedEnd ? (parseDate(plannedEnd) || null) : req.task.plannedEnd,
      status: hasStatus ? normalizePlanningTaskStatusInput(status) : req.task.status,
      plannedDays: hasPlannedDays ? {
        deleteMany: {},
        create: plannedDays
          .filter((d) => d && d.weekday)
          .map((d) => ({
            weekday: String(d.weekday).toUpperCase(),
            plannedDate: parseDate(d.plannedDate),
          })),
      } : undefined,
    },
  });

  await resequencePlanningTasksForWeek(req.task.currentWeek.id);

  return res.json(updated);
}));

router.delete('/tasks/:taskId', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const taskId = parseIntId(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'invalid_task_id' });
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { currentWeek: { select: { id: true, workId: true, planningStatus: true, ppcMeeting: { select: { isClosed: true } } } } },
  });
  if (!task) return res.status(404).json({ error: 'task_not_found' });
  req.task = task;
  req.params.workId = String(task.currentWeek.workId);
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (req.task.currentWeek.planningStatus !== WEEK_STATUS.OPEN) {
    return res.status(409).json({ error: 'planning_closed' });
  }
  if (req.task.currentWeek?.ppcMeeting?.isClosed !== true) {
    return res.status(409).json({ error: 'planning_requires_ppc_meeting_close' });
  }
  if (Number(req.task.originWeekId) !== Number(req.task.currentWeekId)) {
    return res.status(409).json({ error: 'cannot_delete_carried_task' });
  }

  await prisma.feedback.deleteMany({ where: { taskId: req.task.id } });
  await prisma.taskPlannedDay.deleteMany({ where: { taskId: req.task.id } });
  await prisma.task.delete({ where: { id: req.task.id } });
  await resequencePlanningTasksForWeek(req.task.currentWeek.id);
  return res.status(204).send();
}));

router.post('/tasks/:taskId/cancel', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const taskId = parseIntId(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'invalid_task_id' });
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { currentWeek: { select: { id: true, workId: true, planningStatus: true, ppcMeeting: { select: { isClosed: true } } } } },
  });
  if (!task) return res.status(404).json({ error: 'task_not_found' });
  req.task = task;
  req.params.workId = String(task.currentWeek.workId);
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (String(req.task.currentWeek?.planningStatus || '').toUpperCase() !== WEEK_STATUS.OPEN) {
    return res.status(409).json({ error: 'planning_closed' });
  }
  if (req.task.currentWeek?.ppcMeeting?.isClosed !== true) {
    return res.status(409).json({ error: 'planning_requires_ppc_meeting_close' });
  }
  if (Number(req.task.originWeekId) === Number(req.task.currentWeekId)) {
    return res.status(409).json({ error: 'cannot_cancel_current_week_task' });
  }
  if (String(req.task.status || '').toUpperCase() === TASK_STATUS.RESERVA) {
    return res.status(409).json({ error: 'cannot_cancel_reserve_task' });
  }
  if (req.task.status === TASK_STATUS.CANCELLED) return res.status(409).json({ error: 'task_already_cancelled' });

  const canceled = await prisma.task.update({
    where: { id: req.task.id },
    data: {
      status: TASK_STATUS.CANCELLED,
      canceledAt: new Date(),
      canceledById: req.user.id,
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.task.currentWeek.workId,
    entityType: 'TASK',
    entityId: req.task.id,
    eventType: 'TASK_CANCELLED',
    description: `Tarefa ${req.task.id} cancelada com autorizacao.`,
  });

  await resequencePlanningTasksForWeek(req.task.currentWeek.id);

  return res.json(canceled);
}));

router.get('/weeks/:weekId/tasks/export/xlsx', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  const phase = String(req.query.phase || '').trim().toLowerCase();
  const isPrePhase = ['pre', 'preprogramacao', 'pre-programacao', 'pre_programacao'].includes(phase);
  const tasks = isPrePhase
    ? (await prisma.preTask.findMany({
      where: { weekId: req.week.id },
      include: {
        originWeek: { select: { weekNumber: true } },
        contractor: { include: { function: true } },
        location: true,
        plannedDays: true,
      },
      orderBy: { sequenceNumber: 'asc' },
    })).map((item) => ({
      ...item,
      currentWeekId: item.weekId,
    }))
    : (await prisma.task.findMany({
      where: { currentWeekId: req.week.id },
      include: {
        originWeek: { select: { weekNumber: true } },
        contractor: { include: { function: true } },
        location: true,
        plannedDays: true,
      },
      orderBy: { sequenceNumber: 'asc' },
    }));

  const rows = tasks.map((task) => {
    const byDay = new Set((task.plannedDays || []).map((day) => String(day.weekday || '').toUpperCase()));
    const isL1Marker = String(task.location?.level2 || '').startsWith(ZONE_L1_PREFIX);
    return {
      '#': task.sequenceNumber,
      'Semana origem': task.originWeek?.weekNumber || '',
      Empreiteiro: task.contractor?.name || '',
      'Tipo de mão de obra': task.contractor?.function?.name || '',
      Encarregado: task.supervisor || '',
      'Local Nível 1': task.location?.level1 || '',
      'Local Nível 2': isL1Marker ? '' : (task.location?.level2 || ''),
      Tarefa: task.description || '',
      'Início previsto': formatDateBr(task.plannedStart),
      'Fim previsto': formatDateBr(task.plannedEnd),
      Seg: byDay.has('MONDAY') ? 1 : 0,
      Ter: byDay.has('TUESDAY') ? 1 : 0,
      Qua: byDay.has('WEDNESDAY') ? 1 : 0,
      Qui: byDay.has('THURSDAY') ? 1 : 0,
      Sex: byDay.has('FRIDAY') ? 1 : 0,
      Sáb: byDay.has('SATURDAY') ? 1 : 0,
      Status: planningStatusForExport(task, req.week.id),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
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
    ],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Semana ${req.week.weekNumber}`);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', isPrePhase
    ? `attachment; filename="PPC-PreProgramacao-Semana-${req.week.weekNumber}.xlsx"`
    : `attachment; filename="PPC-Semana-${req.week.weekNumber}.xlsx"`);
  return res.send(buffer);
}));

router.get('/weeks/:weekId/tasks/export/expected/xlsx', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    select: {
      id: true,
      weekNumber: true,
      startDate: true,
      endDate: true,
      planningStatus: true,
    },
  });
  if (!week) return res.status(404).json({ error: 'week_not_found' });
  if (String(week.planningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'planning_not_closed' });
  }

  const where = { currentWeekId: req.week.id };
  if (req.workRoles.has(ROLES.CONTRACTOR) && ![...req.workRoles].some((r) => PRIVILEGED.has(r))) {
    if (!req.user.contractorId) return res.status(403).json({ error: 'forbidden' });
    where.contractorId = req.user.contractorId;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      contractor: { include: { function: true } },
      location: true,
      plannedDays: true,
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  const rows = tasks.map((task) => {
    const byDay = new Set((task.plannedDays || []).map((day) => String(day.weekday || '').toUpperCase()));
    const isL1Marker = String(task.location?.level2 || '').startsWith(ZONE_L1_PREFIX);
    return {
      '#': task.sequenceNumber,
      Empreiteiro: task.contractor?.name || '',
      Encarregado: task.supervisor || '',
      'Tipo de mão de obra': task.contractor?.function?.name || '',
      'Local 1': task.location?.level1 || '',
      'Local 2': isL1Marker ? '' : (task.location?.level2 || ''),
      Tarefa: task.description || '',
      'Início previsto': formatDateBr(task.plannedStart),
      'Fim previsto': formatDateBr(task.plannedEnd),
      Seg: byDay.has('MONDAY') ? 1 : 0,
      Ter: byDay.has('TUESDAY') ? 1 : 0,
      Qua: byDay.has('WEDNESDAY') ? 1 : 0,
      Qui: byDay.has('THURSDAY') ? 1 : 0,
      Sex: byDay.has('FRIDAY') ? 1 : 0,
      'Sáb': byDay.has('SATURDAY') ? 1 : 0,
      Status: taskStatusForWeek(task, week.startDate),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      '#',
      'Empreiteiro',
      'Encarregado',
      'Tipo de mão de obra',
      'Local 1',
      'Local 2',
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
    ],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Semana ${week.weekNumber}`);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="PPC-Semana-${week.weekNumber}-Atividades-Previstas.xlsx"`);
  return res.send(buffer);
}));

router.get('/weeks/:weekId/tasks/export/contractor/:contractorId/pdf', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  if (!PDFDocument) {
    return res.status(500).json({ error: 'pdf_dependency_missing' });
  }
  const phase = String(req.query.phase || '').trim().toLowerCase();
  const isPrePhase = ['pre', 'preprogramacao', 'pre-programacao', 'pre_programacao'].includes(phase);
  const contractorId = parseIntId(req.params.contractorId);
  if (!contractorId) return res.status(400).json({ error: 'invalid_contractor_id' });
  if (req.workRoles.has(ROLES.CONTRACTOR) && ![...req.workRoles].some((r) => PRIVILEGED.has(r))) {
    if (!req.user.contractorId || Number(req.user.contractorId) !== Number(contractorId)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }

  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    include: {
      work: true,
      weatherDays: { orderBy: { dayDate: 'asc' } },
      planningClosedBy: { select: { name: true } },
      prePlanningClosedBy: { select: { name: true } },
    },
  });
  if (!week) return res.status(404).json({ error: 'week_not_found' });
  if (isPrePhase) {
    if (String(week.prePlanningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
      return res.status(409).json({ error: 'pre_planning_not_closed' });
    }
  } else if (String(week.planningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'planning_not_closed' });
  }

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: { function: true },
  });
  if (!contractor || contractor.workId !== req.workId) {
    return res.status(404).json({ error: 'contractor_not_found_in_work' });
  }

  let tasks = [];
  if (isPrePhase) {
    const preTasks = await prisma.preTask.findMany({
      where: {
        weekId: req.week.id,
        contractorId,
      },
      include: {
        location: true,
        plannedDays: true,
        originWeek: { select: { weekNumber: true } },
      },
      orderBy: { sequenceNumber: 'asc' },
    });
    tasks = preTasks.map((item) => ({
      ...item,
      currentWeekId: item.weekId,
    }));
  } else {
    tasks = await prisma.task.findMany({
      where: {
        currentWeekId: req.week.id,
        contractorId,
      },
      include: {
        location: true,
        plannedDays: true,
        originWeek: { select: { weekNumber: true } },
      },
      orderBy: { sequenceNumber: 'asc' },
    });
  }

  const holidays = await prisma.holiday.findMany({
    where: {
      workId: req.workId,
      dayDate: {
        gte: week.startDate,
        lte: week.endDate,
      },
    },
    orderBy: [{ dayDate: 'asc' }, { id: 'asc' }],
  });

  const appConfig = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  const contact = parseContractorContact(contractor.contact);
  const printedAt = new Date();
  const contractorNameSafe = sanitizeFileName(contractor.name);
  const fileName = isPrePhase
    ? `PPC-Pre-Programacao-Semana-${week.weekNumber}-${contractorNameSafe}.pdf`
    : `PPC-Semana-${week.weekNumber}-${contractorNameSafe}.pdf`;
  const weekTitleText = isPrePhase
    ? `PPC - PRÉ-PROGRAMAÇÃO - Semana ${week.weekNumber} | ${formatDateBr(week.startDate)} a ${formatDateBr(week.endDate)}`
    : `PPC - Semana ${week.weekNumber} | ${formatDateBr(week.startDate)} a ${formatDateBr(week.endDate)}`;
  const repeatPageTitle = isPrePhase
    ? `PPC - PRÉ-PROGRAMAÇÃO - Semana ${week.weekNumber} | ${contractor.name}`
    : `PPC - Semana ${week.weekNumber} | ${contractor.name}`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 34, size: 'A4', bufferPages: true });
  doc.pipe(res);
  const tz = inferBrazilTimeZoneFromWork(week.work);
  const printedAtText = formatDateTimeBrInTimeZone(printedAt, tz);
  const closedAtText = isPrePhase
    ? formatDateTimeBrInTimeZone(week.prePlanningClosedAt, tz)
    : formatDateTimeBrInTimeZone(week.planningClosedAt, tz);
  const closedByName = isPrePhase
    ? (week.prePlanningClosedBy?.name || '')
    : (week.planningClosedBy?.name || '');
  const contractorSupervisor = contact.supervisor || parseContractorSupervisor(contractor.contact) || '-';
  const companyWebsite = appConfig?.companySite || appConfig?.companyWebsite || appConfig?.website || appConfig?.site || 'A cadastrar';
  const companyStreetNumber = [appConfig?.companyStreet, appConfig?.companyNumber].filter(Boolean).join(', ');
  const companyComplement = String(appConfig?.companyComplement || '').trim();
  const companyCityState = [appConfig?.companyCity, appConfig?.companyState].filter(Boolean).join('/');
  let companyAddressCompact = [
    companyStreetNumber ? `${companyStreetNumber}${companyComplement ? `, ${companyComplement}` : ''}` : '',
    companyCityState,
  ].filter(Boolean).join(' - ');
  if (!companyAddressCompact) {
    const rawAddress = String(appConfig?.companyAddress || '').trim();
    const parts = rawAddress
      .split(' - ')
      .map((item) => String(item || '').trim())
      .filter((item) => item && !/^CEP\b/i.test(item));
    if (parts.length >= 2) {
      companyAddressCompact = `${parts[0]} - ${parts[parts.length - 1]}`;
    } else {
      companyAddressCompact = rawAddress;
    }
  }
  if (!companyAddressCompact) companyAddressCompact = 'Não cadastrado';

  const COLORS = {
    border: '#b7cfe8',
    box: '#f2f8ff',
    boxStrong: '#dcebff',
    title: '#c8def8',
    text: '#1e3c59',
    rowA: '#f7fbff',
    rowB: '#eaf3ff',
    header: '#d4e6fb',
    checkboxA: '#d9ebff',
    checkboxB: '#cde3fb',
    holidayDay: '#ffe2e2',
    plannedBand: '#fff5c4',
    executedBand: '#d9f4d9',
  };

  const margin = 34;
  const pageBottom = () => doc.page.height - margin;
  const contentWidth = doc.page.width - (margin * 2);
  const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const weatherWeekdays = ['SUNDAY', ...weekdays];
  const dayKeyToWeekday = {
    mon: 'MONDAY',
    tue: 'TUESDAY',
    wed: 'WEDNESDAY',
    thu: 'THURSDAY',
    fri: 'FRIDAY',
    sat: 'SATURDAY',
  };
  const holidayWeekdaySet = new Set(
    (holidays || [])
      .map((item) => weekdayCodeFromDate(item.dayDate))
      .filter((weekday) => weekdays.includes(weekday)),
  );
  const holidayDayColumns = new Set(
    Object.entries(dayKeyToWeekday)
      .filter(([, weekday]) => holidayWeekdaySet.has(weekday))
      .map(([dayKey]) => dayKey),
  );

  const drawRoundBox = (x, y, w, h, fill = COLORS.box, stroke = COLORS.border, radius = 8) => {
    doc
      .save()
      .fillColor(fill)
      .strokeColor(stroke)
      .lineWidth(0.7)
      .roundedRect(x, y, w, h, radius)
      .fillAndStroke()
      .restore();
  };

  const drawInfoBox = ({
    x, y, w, h, label, value, valueAlign = 'left', compact = true,
  }) => {
    drawRoundBox(x, y, w, h);
    if (compact) {
      const labelText = `${String(label || '').trim()}:`;
      const labelX = x + 8;
      const lineY = y + ((h - 10) / 2);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.1)
        .text(labelText, labelX, lineY, { lineBreak: false });
      const labelWidth = doc.widthOfString(labelText) + 6;
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.3)
        .text(String(value || '-'), labelX + labelWidth, lineY, {
          width: w - 16 - labelWidth,
          align: valueAlign,
          lineBreak: false,
          ellipsis: true,
        });
      return;
    }
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.5)
      .text(String(label || ''), x + 8, y + 5, { width: w - 16, lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
      .text(String(value || '-'), x + 8, y + 16, { width: w - 16, align: valueAlign, lineBreak: false, ellipsis: true });
  };

  const drawTitleStrip = (y, text) => {
    const h = 28;
    drawRoundBox(margin, y, contentWidth, h, COLORS.title, COLORS.border);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
      .text(String(text || ''), margin, y + 8, { width: contentWidth, align: 'center', lineBreak: false });
    return y + h + 6;
  };

  const drawWeatherIcon = (icon, x, y, size = 16) => {
    const code = String(icon || '').toUpperCase();
    if (code === 'SUNNY') {
      doc.save().fillColor('#ffd24d').strokeColor('#d6a42e').circle(x + (size / 2), y + (size / 2), size * 0.35).fillAndStroke().restore();
      return;
    }
    const drawCloud = () => {
      doc.save().fillColor('#d7e3f3').strokeColor('#a7bcd6').lineWidth(0.6);
      doc.circle(x + size * 0.35, y + size * 0.56, size * 0.2).fillAndStroke();
      doc.circle(x + size * 0.55, y + size * 0.5, size * 0.24).fillAndStroke();
      doc.roundedRect(x + size * 0.2, y + size * 0.54, size * 0.62, size * 0.22, 3).fillAndStroke();
      doc.restore();
    };
    if (code === 'CLOUDY') {
      drawCloud();
      return;
    }
    if (code === 'RAIN') {
      drawCloud();
      doc.save().strokeColor('#3b7cc3').lineWidth(1);
      doc.moveTo(x + size * 0.36, y + size * 0.84).lineTo(x + size * 0.33, y + size * 0.98).stroke();
      doc.moveTo(x + size * 0.52, y + size * 0.84).lineTo(x + size * 0.49, y + size * 0.98).stroke();
      doc.moveTo(x + size * 0.68, y + size * 0.84).lineTo(x + size * 0.65, y + size * 0.98).stroke();
      doc.restore();
      return;
    }
    if (code === 'STORM') {
      drawCloud();
      doc.save().fillColor('#f4b73f').strokeColor('#d09a2d').lineWidth(0.8);
      doc.polygon(
        [x + size * 0.5, y + size * 0.8],
        [x + size * 0.42, y + size * 0.97],
        [x + size * 0.56, y + size * 0.97],
        [x + size * 0.47, y + size * 1.14],
      ).fillAndStroke();
      doc.restore();
      return;
    }
    drawCloud();
  };

  const drawPpcPageHeader = () => {
    let headerY = margin;
    const logoWLocal = 98;
    const logoHLocal = 64;
    const gapLocal = 8;
    const rightXLocal = margin + logoWLocal + gapLocal;
    const rightWLocal = contentWidth - logoWLocal - gapLocal;
    const rowHLocal = 26;
    const topHeaderHLocal = Math.max(logoHLocal, (rowHLocal * 2) + 20);

    drawRoundBox(margin, headerY, logoWLocal, logoHLocal);
    let logoRenderedLocal = false;
    if (appConfig?.logoPath) {
      try {
        const logoDataUrl = String(appConfig.logoPath || '').trim();
        if (logoDataUrl.startsWith('data:image/')) {
          const logoBuffer = decodeImageDataUrl(logoDataUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, margin + 6, headerY + 6, { fit: [logoWLocal - 12, logoHLocal - 12], align: 'center', valign: 'center' });
            logoRenderedLocal = true;
          }
        } else if (fs.existsSync(appConfig.logoPath)) {
          doc.image(appConfig.logoPath, margin + 6, headerY + 6, { fit: [logoWLocal - 12, logoHLocal - 12], align: 'center', valign: 'center' });
          logoRenderedLocal = true;
        }
      } catch {
        logoRenderedLocal = false;
      }
    }
    if (!logoRenderedLocal) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text('LOGO', margin, headerY + 25, { width: logoWLocal, align: 'center' });
    }

    drawRoundBox(rightXLocal, headerY, rightWLocal, rowHLocal);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
      .text(String(appConfig?.companyName || 'Não cadastrado'), rightXLocal + 8, headerY + 7, {
        width: rightWLocal - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });

    const secondRowHLocal = 30;
    const secondRowYLocal = headerY + logoHLocal - secondRowHLocal;
    const cnpjWLocal = 136;
    const addrGapLocal = 4;
    const addrXLocal = rightXLocal + cnpjWLocal + addrGapLocal;
    const addrWLocal = rightWLocal - cnpjWLocal - addrGapLocal;
    drawInfoBox({
      x: rightXLocal,
      y: secondRowYLocal,
      w: cnpjWLocal,
      h: secondRowHLocal,
      label: 'CNPJ',
      value: appConfig?.companyCnpj || 'Não cadastrado',
      compact: true,
    });
    drawRoundBox(addrXLocal, secondRowYLocal, addrWLocal, secondRowHLocal);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.2)
      .text(String(companyAddressCompact), addrXLocal + 8, secondRowYLocal + 6, {
        width: addrWLocal - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(7.0)
      .text(String(companyWebsite), addrXLocal + 8, secondRowYLocal + 18, {
        width: addrWLocal - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });

    headerY += topHeaderHLocal + 8;
    headerY = drawTitleStrip(headerY, weekTitleText);
    return headerY;
  };

  let y = margin;
  const logoW = 98;
  const logoH = 64;
  const gap = 8;
  const rightX = margin + logoW + gap;
  const rightW = contentWidth - logoW - gap;
  const rowH = 26;
  const topHeaderH = Math.max(logoH, (rowH * 2) + 20);

  drawRoundBox(margin, y, logoW, logoH);
  let logoRendered = false;
  if (appConfig?.logoPath) {
    try {
      const logoDataUrl = String(appConfig.logoPath || '').trim();
      if (logoDataUrl.startsWith('data:image/')) {
        const logoBuffer = decodeImageDataUrl(logoDataUrl);
        if (logoBuffer) {
          doc.image(logoBuffer, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
          logoRendered = true;
        }
      } else if (fs.existsSync(appConfig.logoPath)) {
        doc.image(appConfig.logoPath, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
        logoRendered = true;
      }
    } catch {
      logoRendered = false;
    }
  }
  if (!logoRendered) {
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
      .text('LOGO', margin, y + 25, { width: logoW, align: 'center' });
  }

  drawRoundBox(rightX, y, rightW, rowH);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
    .text(String(appConfig?.companyName || 'Não cadastrado'), rightX + 8, y + 7, {
      width: rightW - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  const secondRowH = 30;
  const secondRowY = y + logoH - secondRowH;
  const cnpjW = 136;
  const addrGap = 4;
  const addrX = rightX + cnpjW + addrGap;
  const addrW = rightW - cnpjW - addrGap;
  drawInfoBox({
    x: rightX,
    y: secondRowY,
    w: cnpjW,
    h: secondRowH,
    label: 'CNPJ',
    value: appConfig?.companyCnpj || 'Não cadastrado',
    compact: true,
  });
  drawRoundBox(addrX, secondRowY, addrW, secondRowH);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.2)
    .text(String(companyAddressCompact), addrX + 8, secondRowY + 6, {
      width: addrW - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  doc.font('Helvetica').fontSize(7.0)
    .text(String(companyWebsite), addrX + 8, secondRowY + 18, {
      width: addrW - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  y += topHeaderH + 8;

  y = drawTitleStrip(y, weekTitleText);

  drawInfoBox({
    x: margin,
    y,
    w: contentWidth,
    h: 22,
    label: 'Obra',
    value: week.work?.name || '-',
    compact: true,
  });
  y += 26;
  drawInfoBox({
    x: margin,
    y,
    w: contentWidth,
    h: 22,
    label: 'Endereço da obra',
    value: `${week.work?.address || '-'} | CEP ${week.work?.cep || '-'}`,
    compact: true,
  });
  y += 28;

  drawRoundBox(margin, y, contentWidth, 42);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.8)
    .text(
      `${isPrePhase ? 'Fechamento da pré-programação' : 'Fechamento do planejamento'}: ${closedAtText || '-'}${closedByName ? ` por ${closedByName}` : ''}`,
      margin + 8,
      y + 8,
      { width: contentWidth - 16, lineBreak: false },
    );
  doc.text(`Documento impresso em: ${printedAtText || '-'}`, margin + 8, y + 24, { width: contentWidth - 16, lineBreak: false });
  y += 48;

  drawRoundBox(margin, y, 300, 22);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.4)
    .text(`Empreiteiro: ${contractor.name || '-'}`, margin + 8, y + 7, {
      width: 284,
      lineBreak: false,
      ellipsis: true,
    });
  drawRoundBox(margin + 304, y, contentWidth - 304, 22);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.4)
    .text(`Encarregado: ${contractorSupervisor}`, margin + 312, y + 7, {
      width: contentWidth - 320,
      lineBreak: false,
      ellipsis: true,
    });
  y += 28;

  const weatherOuterH = 100;
  drawRoundBox(margin, y, contentWidth, weatherOuterH, COLORS.boxStrong, COLORS.border);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.2)
    .text('PREVISÃO DO TEMPO (DOMINGO A SÁBADO)', margin, y + 6, { width: contentWidth, align: 'center' });

  const weatherByWeekday = new Map((week.weatherDays || []).map((item) => [String(item.weekday || '').toUpperCase(), item]));
  const weatherCellY = y + 22;
  const weatherCellH = weatherOuterH - 32;
  const weatherCellGap = 4;
  const weatherCellW = (contentWidth - (weatherCellGap * 8)) / 7;

  weatherWeekdays.forEach((weekday, index) => {
    const item = weatherByWeekday.get(weekday) || null;
    const x = margin + weatherCellGap + (index * (weatherCellW + weatherCellGap));
    drawRoundBox(x, weatherCellY, weatherCellW, weatherCellH, index % 2 === 0 ? '#f7fbff' : '#edf5ff', COLORS.border, 6);

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(6.9)
      .text(weekdayPt(weekday), x, weatherCellY + 5, { width: weatherCellW, align: 'center', lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(6.1)
      .text(formatDateBr(item?.dayDate), x, weatherCellY + 15, { width: weatherCellW, align: 'center', lineBreak: false });

    drawWeatherIcon(item?.icon, x + ((weatherCellW - 12) / 2), weatherCellY + 22, 12);

    doc.fillColor(COLORS.text).font('Helvetica').fontSize(5.9)
      .text(`Máx ${item?.tempMaxC ?? '-'}° | Mín ${item?.tempMinC ?? '-'}°`, x + 3, weatherCellY + 43, { width: weatherCellW - 6, align: 'center', lineBreak: false, ellipsis: true });
    doc.text(`Chuva ${item?.precipitationMm ?? '-'} mm/dia`, x + 3, weatherCellY + 52, { width: weatherCellW - 6, align: 'center', lineBreak: false, ellipsis: true });
    doc.text(`Prob. ${item?.precipitationProbabilityPct ?? '-'}%`, x + 3, weatherCellY + 61, { width: weatherCellW - 6, align: 'center', lineBreak: false, ellipsis: true });
  });
  y += weatherOuterH + 8;

  const columns = [
    { key: 'seq', title: '#', width: 18 },
    { key: 'origin', title: 'Sem. origem', width: 38 },
    { key: 'l1', title: 'Local 1', width: 48 },
    { key: 'l2', title: 'Local 2', width: 44 },
    { key: 'task', title: 'Tarefa', width: 135 },
    { key: 'start', title: 'Início', width: 42 },
    { key: 'end', title: 'Fim', width: 42 },
    { key: 'mon', title: 'Seg', width: 20 },
    { key: 'tue', title: 'Ter', width: 20 },
    { key: 'wed', title: 'Qua', width: 20 },
    { key: 'thu', title: 'Qui', width: 20 },
    { key: 'fri', title: 'Sex', width: 20 },
    { key: 'sat', title: 'Sáb', width: 20 },
    { key: 'status', title: 'Status', width: 44 },
  ];
  const headerH = 21;
  const rowHData = 30;

  const drawTableHeader = (yStart) => {
    drawRoundBox(margin, yStart, contentWidth, headerH, COLORS.header, COLORS.border, 4);
    let x = margin;
    columns.forEach((col, index) => {
      if (holidayDayColumns.has(col.key)) {
        doc.save()
          .fillColor(COLORS.holidayDay)
          .rect(x + 0.4, yStart + 0.4, col.width - 0.8, headerH - 0.8)
          .fill()
          .restore();
      }
      const headerFont = 7.2;
      const headerText = String(col.title || '');
      const headerWidth = col.width - 4;
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(headerFont);
      const headerTextH = doc.heightOfString(headerText, { width: headerWidth, lineBreak: false });
      const headerY = yStart + ((headerH - headerTextH) / 2);
      doc.text(headerText, x + 2, headerY, {
        width: headerWidth,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
      if (index > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.6).moveTo(x, yStart).lineTo(x, yStart + headerH).stroke().restore();
      }
      x += col.width;
    });
    return yStart + headerH;
  };

  const drawTaskRow = (task, yStart, idx) => {
    const fill = idx % 2 === 0 ? COLORS.rowA : COLORS.rowB;
    drawRoundBox(margin, yStart, contentWidth, rowHData, fill, COLORS.border, 3);
    let x = margin;
    const byDay = new Set((task.plannedDays || []).map((d) => String(d.weekday || '').toUpperCase()));
    const isChecked = (weekday) => byDay.has(weekday);
    const isL1Marker = String(task.location?.level2 || '').startsWith(ZONE_L1_PREFIX);
    const status = taskStatusForWeek(task, week.startDate);
    const values = {
      seq: String(task.sequenceNumber || ''),
      origin: String(task.originWeek?.weekNumber || ''),
      l1: String(task.location?.level1 || '-'),
      l2: String(isL1Marker ? '' : (task.location?.level2 || '')),
      task: String(task.description || ''),
      start: formatDateBr(task.plannedStart) || '-',
      end: formatDateBr(task.plannedEnd) || '-',
      mon: isChecked('MONDAY'),
      tue: isChecked('TUESDAY'),
      wed: isChecked('WEDNESDAY'),
      thu: isChecked('THURSDAY'),
      fri: isChecked('FRIDAY'),
      sat: isChecked('SATURDAY'),
      status,
    };

    columns.forEach((col, index) => {
      if (index > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, yStart).lineTo(x, yStart + rowHData).stroke().restore();
      }
      if (['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(col.key)) {
        const dayFill = holidayDayColumns.has(col.key)
          ? COLORS.holidayDay
          : (idx % 2 === 0 ? COLORS.checkboxA : COLORS.checkboxB);
        doc.save().fillColor(dayFill).rect(x + 0.4, yStart + 0.4, col.width - 0.8, rowHData - 0.8).fill().restore();
      }
      if (col.key === 'task') {
        const fontSize = 7.2;
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(fontSize);
        const textH = doc.heightOfString(values.task, { width: col.width - 6, lineGap: 0, align: 'right' });
        const top = Math.max(yStart + 2, yStart + ((rowHData - Math.min(textH, rowHData - 4)) / 2));
        doc.text(values.task, x + 3, top, {
          width: col.width - 6,
          height: rowHData - 4,
          ellipsis: true,
          lineGap: 0,
          align: 'right',
        });
      } else if (['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(col.key)) {
        const boxSize = 8;
        const boxX = x + ((col.width - boxSize) / 2);
        const boxY = yStart + ((rowHData - boxSize) / 2);
        doc.save().strokeColor('#5e7ea1').lineWidth(0.9).rect(boxX, boxY, boxSize, boxSize).stroke().restore();
        if (values[col.key] === true) {
          doc.save().strokeColor('#244769').lineWidth(1.1)
            .moveTo(boxX + 1.2, boxY + 1.2).lineTo(boxX + boxSize - 1.2, boxY + boxSize - 1.2).stroke()
            .moveTo(boxX + boxSize - 1.2, boxY + 1.2).lineTo(boxX + 1.2, boxY + boxSize - 1.2).stroke()
            .restore();
        }
      } else {
        const fontSize = 7.0;
        const cellWidth = col.width - 4;
        const textValue = String(values[col.key] || '');
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(fontSize)
          .text(textValue, x + 2, yStart + ((rowHData - doc.heightOfString(textValue, { width: cellWidth, lineBreak: false })) / 2), {
            width: cellWidth,
            align: 'center',
            lineBreak: false,
            ellipsis: true,
          });
      }
      x += col.width;
    });
    return yStart + rowHData;
  };

  const drawTableRepeatHeader = (newPageTitle = false) => {
    if (newPageTitle) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text(repeatPageTitle, margin, margin - 4, { width: contentWidth, lineBreak: false });
    }
    return drawTableHeader(doc.y + (newPageTitle ? 6 : 0));
  };

  y = drawTableHeader(y);

  if (!tasks.length) {
    y = drawTaskRow({
      sequenceNumber: '-',
      location: { level1: '-', level2: '' },
      description: 'Sem atividades para este empreiteiro nesta semana.',
      plannedStart: null,
      plannedEnd: null,
      plannedDays: [],
      originWeekId: req.week.id,
      currentWeekId: req.week.id,
    }, y, 0);
  } else {
    tasks.forEach((task, idx) => {
      if (y + rowHData > pageBottom() - 90) {
        doc.addPage();
        y = drawTableRepeatHeader(true);
      }
      y = drawTaskRow(task, y, idx);
    });
  }

  if (y + 58 > pageBottom()) {
    doc.addPage();
    y = margin;
  }
  drawRoundBox(margin, y + 8, contentWidth, 44, COLORS.boxStrong, COLORS.border);
  doc.save().strokeColor('#7f9ec0').lineWidth(0.8)
    .moveTo(margin + 92, y + 30).lineTo(margin + contentWidth - 92, y + 30).stroke().restore();
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.1)
    .text(`${contractor.name} | ${contractorSupervisor} | Data: ____/____/________`, margin + 10, y + 34, {
      width: contentWidth - 20,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    const pageNumber = i + 1;
    doc.switchToPage(pages.start + i);
    const footerY = doc.page.height - margin - 10;
    doc.fillColor('#35597a').font('Helvetica').fontSize(8)
      .text(`${pageNumber}/${pages.count}`, margin, footerY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
  }

doc.end();
}));

router.get('/weeks/:weekId/ppc-meeting/export/convocation/contractor/:contractorId/pdf', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  if (!PDFDocument) return res.status(500).json({ error: 'pdf_dependency_missing' });
  if (String(req.week.prePlanningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'ppc_meeting_requires_pre_planning_close' });
  }

  const contractorId = parseIntId(req.params.contractorId);
  if (!contractorId) return res.status(400).json({ error: 'invalid_contractor_id' });
  if (req.workRoles.has(ROLES.CONTRACTOR) && ![...req.workRoles].some((r) => PRIVILEGED.has(r))) {
    if (!req.user.contractorId || Number(req.user.contractorId) !== Number(contractorId)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }

  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    include: {
      work: true,
      ppcMeeting: true,
    },
  });
  if (!week) return res.status(404).json({ error: 'week_not_found' });
  const meetingAt = await resolvePpcMeetingAt(week);
  if (!meetingAt) return res.status(409).json({ error: 'meeting_datetime_not_defined' });

  const activeContractors = await listActiveContractorsForWeek(req.week.id, req.workId);
  const contractor = activeContractors.find((item) => Number(item.id) === Number(contractorId));
  if (!contractor) return res.status(404).json({ error: 'contractor_not_active_in_week' });

  const preTasks = await prisma.preTask.findMany({
    where: { weekId: req.week.id, contractorId },
    orderBy: { sequenceNumber: 'asc' },
    select: { sequenceNumber: true, description: true, location: { select: { level1: true, level2: true } } },
  });

  const appConfig = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  const contact = parseContractorContact(contractor.contact);
  const tz = inferBrazilTimeZoneFromWork(week.work);
  const printedAtText = formatDateTimeBrInTimeZone(new Date(), tz);
  const meetingAtText = formatDateTimeBrInTimeZone(meetingAt, tz);
  const companyWebsite = appConfig?.companySite || appConfig?.companyWebsite || appConfig?.website || appConfig?.site || 'A cadastrar';
  const companyStreetNumber = [appConfig?.companyStreet, appConfig?.companyNumber].filter(Boolean).join(', ');
  const companyComplement = String(appConfig?.companyComplement || '').trim();
  const companyCityState = [appConfig?.companyCity, appConfig?.companyState].filter(Boolean).join('/');
  let companyAddressCompact = [
    companyStreetNumber ? `${companyStreetNumber}${companyComplement ? `, ${companyComplement}` : ''}` : '',
    companyCityState,
  ].filter(Boolean).join(' - ');
  if (!companyAddressCompact) {
    const rawAddress = String(appConfig?.companyAddress || '').trim();
    const parts = rawAddress
      .split(' - ')
      .map((item) => String(item || '').trim())
      .filter((item) => item && !/^CEP\b/i.test(item));
    if (parts.length >= 2) {
      companyAddressCompact = `${parts[0]} - ${parts[parts.length - 1]}`;
    } else {
      companyAddressCompact = rawAddress;
    }
  }
  if (!companyAddressCompact) companyAddressCompact = 'Não cadastrado';

  const fileName = `PPC-Convocacao-Reuniao-Semana-${week.weekNumber}-${sanitizeFileName(contractor.name)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 34, size: 'A4' });
  doc.pipe(res);

  const COLORS = {
    border: '#b7cfe8',
    box: '#f2f8ff',
    title: '#c8def8',
    text: '#1e3c59',
    rowA: '#f7fbff',
    rowB: '#eaf3ff',
  };

  const margin = 34;
  const contentWidth = doc.page.width - (margin * 2);
  const drawRoundBox = (x, y, w, h, fill = COLORS.box, stroke = COLORS.border, radius = 8) => {
    doc.save().fillColor(fill).strokeColor(stroke).lineWidth(0.7).roundedRect(x, y, w, h, radius).fillAndStroke().restore();
  };
  const drawInfoBox = ({
    x, y, w, h, label, value, valueAlign = 'left', compact = true,
  }) => {
    drawRoundBox(x, y, w, h);
    if (compact) {
      const labelText = `${String(label || '').trim()}:`;
      const labelX = x + 8;
      const lineY = y + ((h - 10) / 2);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.1)
        .text(labelText, labelX, lineY, { lineBreak: false });
      const labelWidth = doc.widthOfString(labelText) + 6;
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.3)
        .text(String(value || '-'), labelX + labelWidth, lineY, {
          width: w - 16 - labelWidth,
          align: valueAlign,
          lineBreak: false,
          ellipsis: true,
        });
      return;
    }
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.5)
      .text(String(label || ''), x + 8, y + 5, { width: w - 16, lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
      .text(String(value || '-'), x + 8, y + 16, { width: w - 16, align: valueAlign, lineBreak: false, ellipsis: true });
  };
  const drawTitleStrip = (y, text) => {
    drawRoundBox(margin, y, contentWidth, 28, COLORS.title, COLORS.border);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12).text(text, margin, y + 8, { width: contentWidth, align: 'center', lineBreak: false });
    return y + 34;
  };
  const drawInfoRow = (y, label, value) => {
    drawRoundBox(margin, y, contentWidth, 22);
    const labelText = `${label}:`;
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.2).text(labelText, margin + 8, y + 7, { lineBreak: false });
    const lw = doc.widthOfString(labelText) + 8;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.4).text(String(value || '-'), margin + 8 + lw, y + 7, {
      width: contentWidth - 16 - lw,
      lineBreak: false,
      ellipsis: true,
    });
    return y + 26;
  };

  const drawCompleteHeader = (title) => {
    let y = margin;
    const logoW = 98;
    const logoH = 64;
    const gap = 8;
    const rightX = margin + logoW + gap;
    const rightW = contentWidth - logoW - gap;
    const rowH = 26;
    const topHeaderH = Math.max(logoH, (rowH * 2) + 20);

    drawRoundBox(margin, y, logoW, logoH);
    let logoRendered = false;
    if (appConfig?.logoPath) {
      try {
        const logoDataUrl = String(appConfig.logoPath || '').trim();
        if (logoDataUrl.startsWith('data:image/')) {
          const logoBuffer = decodeImageDataUrl(logoDataUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
            logoRendered = true;
          }
        } else if (fs.existsSync(appConfig.logoPath)) {
          doc.image(appConfig.logoPath, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
          logoRendered = true;
        }
      } catch {
        logoRendered = false;
      }
    }
    if (!logoRendered) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text('LOGO', margin, y + 25, { width: logoW, align: 'center' });
    }

    drawRoundBox(rightX, y, rightW, rowH);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
      .text(String(appConfig?.companyName || 'Não cadastrado'), rightX + 8, y + 7, {
        width: rightW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    const secondRowH = 30;
    const secondRowY = y + logoH - secondRowH;
    const cnpjW = 136;
    const addrGap = 4;
    const addrX = rightX + cnpjW + addrGap;
    const addrW = rightW - cnpjW - addrGap;
    drawInfoBox({
      x: rightX,
      y: secondRowY,
      w: cnpjW,
      h: secondRowH,
      label: 'CNPJ',
      value: appConfig?.companyCnpj || 'Não cadastrado',
      compact: true,
    });
    drawRoundBox(addrX, secondRowY, addrW, secondRowH);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.2)
      .text(String(companyAddressCompact), addrX + 8, secondRowY + 6, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(7.0)
      .text(String(companyWebsite), addrX + 8, secondRowY + 18, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    y += topHeaderH + 8;
    y = drawTitleStrip(y, title);
    drawInfoBox({
      x: margin,
      y,
      w: contentWidth,
      h: 22,
      label: 'Obra',
      value: week.work?.name || '-',
      compact: true,
    });
    y += 26;
    drawInfoBox({
      x: margin,
      y,
      w: contentWidth,
      h: 22,
      label: 'Endereço da obra',
      value: `${week.work?.address || '-'} | CEP ${week.work?.cep || '-'}`,
      compact: true,
    });
    return y + 28;
  };

  let y = drawCompleteHeader(`CONVOCAÇÃO - REUNIÃO DE PPC - SEMANA ${week.weekNumber}`);
  y = drawInfoRow(y, 'Empreiteiro', contractor.name || '-');
  y = drawInfoRow(y, 'Encarregado', contact.supervisor || '-');
  y = drawInfoRow(y, 'E-mail', contact.communicationEmail || '-');
  y = drawInfoRow(y, 'Data e hora da reunião', meetingAtText || '-');
  y = drawInfoRow(y, 'Documento impresso em', printedAtText || '-');

  drawRoundBox(margin, y, contentWidth, 70);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.6)
    .text('Convocação', margin + 8, y + 8, { width: contentWidth - 16, align: 'left', lineBreak: false });
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.8)
    .text(
      `Solicitamos a presença do encarregado da empresa ${contractor.name || '-'} na reunião semanal de PPC em ${meetingAtText || '-'}, para validação do pacote de atividades da semana.`,
      margin + 8,
      y + 24,
      { width: contentWidth - 16, align: 'left' },
    );
  y += 78;

  drawRoundBox(margin, y, contentWidth, 24, COLORS.title, COLORS.border, 6);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.2)
    .text('ATIVIDADES DA PRÉ-PROGRAMAÇÃO DO EMPREITEIRO', margin + 8, y + 7, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });
  y += 28;

  const rows = preTasks.length
    ? preTasks
    : [{ sequenceNumber: '-', description: 'Sem atividades de pré-programação para este empreiteiro.', location: { level1: '-', level2: '' } }];

  rows.forEach((task, idx) => {
    const h = 22;
    drawRoundBox(margin, y, contentWidth, h, idx % 2 === 0 ? COLORS.rowA : COLORS.rowB, COLORS.border, 4);
    const l2raw = String(task.location?.level2 || '');
    const l2 = l2raw.startsWith(ZONE_L1_PREFIX) ? '' : l2raw;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
      .text(`#${task.sequenceNumber}`, margin + 8, y + 7, { width: 34, align: 'center', lineBreak: false });
    doc.text(String(task.location?.level1 || '-'), margin + 44, y + 7, { width: 90, align: 'center', lineBreak: false, ellipsis: true });
    doc.text(String(l2 || ''), margin + 138, y + 7, { width: 90, align: 'center', lineBreak: false, ellipsis: true });
    doc.text(String(task.description || '-'), margin + 232, y + 7, { width: contentWidth - 240, align: 'left', lineBreak: false, ellipsis: true });
    y += h + 4;
  });

doc.end();
}));

router.get('/weeks/:weekId/ppc-meeting/export/pre-minutes/pdf', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  if (!PDFDocument) return res.status(500).json({ error: 'pdf_dependency_missing' });
  if (String(req.week.prePlanningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'ppc_meeting_requires_pre_planning_close' });
  }
  if (req.workRoles.has(ROLES.CONTRACTOR) && ![...req.workRoles].some((r) => PRIVILEGED.has(r))) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    include: {
      work: true,
      ppcMeeting: true,
    },
  });
  if (!week) return res.status(404).json({ error: 'week_not_found' });
  const meetingAt = await resolvePpcMeetingAt(week);
  if (!meetingAt) return res.status(409).json({ error: 'meeting_datetime_not_defined' });

  const activeContractors = await listActiveContractorsForWeek(req.week.id, req.workId);
  const appConfig = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  const tz = inferBrazilTimeZoneFromWork(week.work);
  const printedAtText = formatDateTimeBrInTimeZone(new Date(), tz);
  const meetingAtText = formatDateTimeBrInTimeZone(meetingAt, tz);
  const companyWebsite = appConfig?.companySite || appConfig?.companyWebsite || appConfig?.website || appConfig?.site || 'A cadastrar';
  const companyStreetNumber = [appConfig?.companyStreet, appConfig?.companyNumber].filter(Boolean).join(', ');
  const companyComplement = String(appConfig?.companyComplement || '').trim();
  const companyCityState = [appConfig?.companyCity, appConfig?.companyState].filter(Boolean).join('/');
  let companyAddressCompact = [
    companyStreetNumber ? `${companyStreetNumber}${companyComplement ? `, ${companyComplement}` : ''}` : '',
    companyCityState,
  ].filter(Boolean).join(' - ');
  if (!companyAddressCompact) {
    const rawAddress = String(appConfig?.companyAddress || '').trim();
    const parts = rawAddress
      .split(' - ')
      .map((item) => String(item || '').trim())
      .filter((item) => item && !/^CEP\b/i.test(item));
    if (parts.length >= 2) {
      companyAddressCompact = `${parts[0]} - ${parts[parts.length - 1]}`;
    } else {
      companyAddressCompact = rawAddress;
    }
  }
  if (!companyAddressCompact) companyAddressCompact = 'Não cadastrado';
  const fileName = `PPC-Semana-${week.weekNumber}-Ata-Presenca-Pre-Reuniao.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 34, size: 'A4', bufferPages: true });
  doc.pipe(res);

  const COLORS = {
    border: '#b7cfe8',
    box: '#f2f8ff',
    title: '#c8def8',
    text: '#1e3c59',
    rowA: '#f7fbff',
    rowB: '#eaf3ff',
  };
  const margin = 34;
  const contentWidth = doc.page.width - (margin * 2);
  const pageBottom = () => doc.page.height - margin;

  const drawRoundBox = (x, y, w, h, fill = COLORS.box, stroke = COLORS.border, radius = 8) => {
    doc.save().fillColor(fill).strokeColor(stroke).lineWidth(0.7).roundedRect(x, y, w, h, radius).fillAndStroke().restore();
  };
  const drawInfoBox = ({
    x, y, w, h, label, value, valueAlign = 'left', compact = true,
  }) => {
    drawRoundBox(x, y, w, h);
    if (compact) {
      const labelText = `${String(label || '').trim()}:`;
      const labelX = x + 8;
      const lineY = y + ((h - 10) / 2);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.1)
        .text(labelText, labelX, lineY, { lineBreak: false });
      const labelWidth = doc.widthOfString(labelText) + 6;
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.3)
        .text(String(value || '-'), labelX + labelWidth, lineY, {
          width: w - 16 - labelWidth,
          align: valueAlign,
          lineBreak: false,
          ellipsis: true,
        });
      return;
    }
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.5)
      .text(String(label || ''), x + 8, y + 5, { width: w - 16, lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
      .text(String(value || '-'), x + 8, y + 16, { width: w - 16, align: valueAlign, lineBreak: false, ellipsis: true });
  };
  const drawTitleStrip = (y, text) => {
    drawRoundBox(margin, y, contentWidth, 28, COLORS.title, COLORS.border);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12).text(text, margin, y + 8, { width: contentWidth, align: 'center', lineBreak: false });
    return y + 34;
  };
  const drawInfoRow = (y, label, value) => {
    drawRoundBox(margin, y, contentWidth, 22);
    const labelText = `${label}:`;
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.2).text(labelText, margin + 8, y + 7, { lineBreak: false });
    const lw = doc.widthOfString(labelText) + 8;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.4).text(String(value || '-'), margin + 8 + lw, y + 7, {
      width: contentWidth - 16 - lw,
      lineBreak: false,
      ellipsis: true,
    });
    return y + 26;
  };

  const drawCompleteHeader = (title) => {
    let y = margin;
    const logoW = 98;
    const logoH = 64;
    const gap = 8;
    const rightX = margin + logoW + gap;
    const rightW = contentWidth - logoW - gap;
    const rowH = 26;
    const topHeaderH = Math.max(logoH, (rowH * 2) + 20);

    drawRoundBox(margin, y, logoW, logoH);
    let logoRendered = false;
    if (appConfig?.logoPath) {
      try {
        const logoDataUrl = String(appConfig.logoPath || '').trim();
        if (logoDataUrl.startsWith('data:image/')) {
          const logoBuffer = decodeImageDataUrl(logoDataUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
            logoRendered = true;
          }
        } else if (fs.existsSync(appConfig.logoPath)) {
          doc.image(appConfig.logoPath, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
          logoRendered = true;
        }
      } catch {
        logoRendered = false;
      }
    }
    if (!logoRendered) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text('LOGO', margin, y + 25, { width: logoW, align: 'center' });
    }

    drawRoundBox(rightX, y, rightW, rowH);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
      .text(String(appConfig?.companyName || 'Não cadastrado'), rightX + 8, y + 7, {
        width: rightW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    const secondRowH = 30;
    const secondRowY = y + logoH - secondRowH;
    const cnpjW = 136;
    const addrGap = 4;
    const addrX = rightX + cnpjW + addrGap;
    const addrW = rightW - cnpjW - addrGap;
    drawInfoBox({
      x: rightX,
      y: secondRowY,
      w: cnpjW,
      h: secondRowH,
      label: 'CNPJ',
      value: appConfig?.companyCnpj || 'Não cadastrado',
      compact: true,
    });
    drawRoundBox(addrX, secondRowY, addrW, secondRowH);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.2)
      .text(String(companyAddressCompact), addrX + 8, secondRowY + 6, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(7.0)
      .text(String(companyWebsite), addrX + 8, secondRowY + 18, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    y += topHeaderH + 8;
    y = drawTitleStrip(y, title);
    drawInfoBox({
      x: margin,
      y,
      w: contentWidth,
      h: 22,
      label: 'Obra',
      value: week.work?.name || '-',
      compact: true,
    });
    y += 26;
    drawInfoBox({
      x: margin,
      y,
      w: contentWidth,
      h: 22,
      label: 'Endereço da obra',
      value: `${week.work?.address || '-'} | CEP ${week.work?.cep || '-'}`,
      compact: true,
    });
    return y + 28;
  };

  let y = drawCompleteHeader(`ATA + LISTA DE PRESENÇA (PRÉ-REUNIÃO) - SEMANA ${week.weekNumber}`);
  drawRoundBox(margin, y, contentWidth, 32, COLORS.title, COLORS.border, 8);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12.8)
    .text(`DATA E HORA DA REUNIÃO: ${meetingAtText || '-'}`, margin + 8, y + 10, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  y += 36;
  y = drawInfoRow(y, 'Documento impresso em', printedAtText || '-');

  drawRoundBox(margin, y, contentWidth, 24, COLORS.title, COLORS.border, 6);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.2)
    .text('LISTA DE PRESENÇA (EMPREITEIROS ATIVOS DA SEMANA)', margin + 8, y + 7, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });
  y += 28;

  const columns = [
    { key: 'idx', label: '#', w: 28, align: 'center' },
    { key: 'name', label: 'Empreiteiro', w: 210, align: 'left' },
    { key: 'labor', label: 'Mão de obra', w: 118, align: 'center' },
    { key: 'supervisor', label: 'Encarregado', w: 112, align: 'center' },
    { key: 'signature', label: 'Assinatura', w: contentWidth - (28 + 210 + 118 + 112), align: 'center' },
  ];
  const rowHeight = 22;

  const drawHeader = (yPos) => {
    let x = margin;
    columns.forEach((col) => {
      drawRoundBox(x, yPos, col.w, rowHeight, COLORS.title, COLORS.border, 4);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.1)
        .text(col.label, x + 2, yPos + 7, { width: col.w - 4, align: 'center', lineBreak: false, ellipsis: true });
      x += col.w;
    });
    return yPos + rowHeight + 4;
  };

  const drawDataRow = (yPos, rowIndex, contractor) => {
    const contact = parseContractorContact(contractor.contact);
    const values = {
      idx: String(rowIndex + 1),
      name: contractor.name || '-',
      labor: contractor.function?.name || '-',
      supervisor: contact.supervisor || '-',
      signature: '',
    };
    let x = margin;
    columns.forEach((col) => {
      drawRoundBox(x, yPos, col.w, rowHeight, rowIndex % 2 === 0 ? COLORS.rowA : COLORS.rowB, COLORS.border, 4);
      if (col.key === 'signature') {
        doc.save().strokeColor('#7f9ec0').lineWidth(0.7)
          .moveTo(x + 8, yPos + rowHeight - 7)
          .lineTo(x + col.w - 8, yPos + rowHeight - 7)
          .stroke()
          .restore();
      } else {
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.1)
          .text(values[col.key], x + 3, yPos + 7, {
            width: col.w - 6,
            align: col.align,
            lineBreak: false,
            ellipsis: true,
          });
      }
      x += col.w;
    });
    return yPos + rowHeight + 4;
  };

  y = drawHeader(y);
  if (!activeContractors.length) {
    drawRoundBox(margin, y, contentWidth, 24, COLORS.rowA, COLORS.border, 4);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.6)
      .text('Sem empreiteiros ativos para esta semana.', margin + 8, y + 8, { width: contentWidth - 16, align: 'center', lineBreak: false });
    y += 28;
  } else {
    activeContractors.forEach((contractor, idx) => {
      if (y + rowHeight > pageBottom() - 120) {
        doc.addPage();
        y = margin;
        y = drawTitleStrip(y, `ATA + LISTA DE PRESENÇA (PRÉ-REUNIÃO) - SEMANA ${week.weekNumber}`);
        y = drawHeader(y);
      }
      y = drawDataRow(y, idx, contractor);
    });
  }

  const notesHeight = 176;
  if (y + notesHeight + 44 > pageBottom()) {
    doc.addPage();
    y = margin;
  }
  drawRoundBox(margin, y, contentWidth, notesHeight, COLORS.box, COLORS.border, 8);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.4)
    .text('PRINCIPAIS PONTOS DISCUTIDOS (ATA)', margin + 8, y + 8, { width: contentWidth - 16, align: 'left', lineBreak: false });
  for (let i = 0; i < 8; i += 1) {
    const lineY = y + 34 + (i * 18);
    doc.save().strokeColor('#8fb0cf').lineWidth(0.6)
      .moveTo(margin + 8, lineY)
      .lineTo(margin + contentWidth - 8, lineY)
      .stroke()
      .restore();
  }
  y += notesHeight + 10;

  drawRoundBox(margin, y, contentWidth, 30, COLORS.rowA, COLORS.border, 6);
  doc.save().strokeColor('#7f9ec0').lineWidth(0.8)
    .moveTo(margin + 220, y + 18)
    .lineTo(margin + contentWidth - 220, y + 18)
    .stroke()
    .restore();
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
    .text('Responsável da obra', margin + 10, y + 20, {
      width: contentWidth - 20,
      align: 'center',
      lineBreak: false,
    });

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    const pageNumber = i + 1;
    doc.switchToPage(pages.start + i);
    const footerY = doc.page.height - margin - 10;
    doc.fillColor('#35597a').font('Helvetica').fontSize(8)
      .text(`${pageNumber}/${pages.count}`, margin, footerY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
  }

  doc.end();
}));

router.get('/weeks/:weekId/ppc-meeting/export/minutes/pdf', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  if (!PDFDocument) return res.status(500).json({ error: 'pdf_dependency_missing' });
  if (req.workRoles.has(ROLES.CONTRACTOR) && ![...req.workRoles].some((r) => PRIVILEGED.has(r))) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    include: {
      work: true,
      ppcMeeting: {
        include: {
          closedBy: { select: { name: true } },
          attendances: {
            include: {
              contractor: {
                include: { function: true },
              },
            },
            orderBy: { contractor: { name: 'asc' } },
          },
        },
      },
    },
  });
  if (!week) return res.status(404).json({ error: 'week_not_found' });
  if (!week.ppcMeeting) return res.status(404).json({ error: 'ppc_meeting_not_found' });
  if (week.ppcMeeting.isClosed !== true) return res.status(409).json({ error: 'ppc_meeting_not_closed' });

  const appConfig = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  const tz = inferBrazilTimeZoneFromWork(week.work);
  const printedAtText = formatDateTimeBrInTimeZone(new Date(), tz);
  const meetingAtResolved = await resolvePpcMeetingAt(week);
  const meetingAtText = formatDateTimeBrInTimeZone(meetingAtResolved, tz);
  const closedAtText = formatDateTimeBrInTimeZone(week.ppcMeeting.closedAt, tz);
  const companyWebsite = appConfig?.companySite || appConfig?.companyWebsite || appConfig?.website || appConfig?.site || 'A cadastrar';
  const companyStreetNumber = [appConfig?.companyStreet, appConfig?.companyNumber].filter(Boolean).join(', ');
  const companyComplement = String(appConfig?.companyComplement || '').trim();
  const companyCityState = [appConfig?.companyCity, appConfig?.companyState].filter(Boolean).join('/');
  let companyAddressCompact = [
    companyStreetNumber ? `${companyStreetNumber}${companyComplement ? `, ${companyComplement}` : ''}` : '',
    companyCityState,
  ].filter(Boolean).join(' - ');
  if (!companyAddressCompact) {
    const rawAddress = String(appConfig?.companyAddress || '').trim();
    const parts = rawAddress
      .split(' - ')
      .map((item) => String(item || '').trim())
      .filter((item) => item && !/^CEP\b/i.test(item));
    if (parts.length >= 2) {
      companyAddressCompact = `${parts[0]} - ${parts[parts.length - 1]}`;
    } else {
      companyAddressCompact = rawAddress;
    }
  }
  if (!companyAddressCompact) companyAddressCompact = 'Não cadastrado';
  const fileName = `PPC-Semana-${week.weekNumber}-Ata-Reuniao-PPC.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 34, size: 'A4' });
  doc.pipe(res);

  const COLORS = {
    border: '#b7cfe8',
    box: '#f2f8ff',
    title: '#c8def8',
    text: '#1e3c59',
    rowA: '#f7fbff',
    rowB: '#eaf3ff',
  };
  const margin = 34;
  const contentWidth = doc.page.width - (margin * 2);
  const drawRoundBox = (x, y, w, h, fill = COLORS.box, stroke = COLORS.border, radius = 8) => {
    doc.save().fillColor(fill).strokeColor(stroke).lineWidth(0.7).roundedRect(x, y, w, h, radius).fillAndStroke().restore();
  };
  const drawInfoBox = ({
    x, y, w, h, label, value, valueAlign = 'left', compact = true,
  }) => {
    drawRoundBox(x, y, w, h);
    if (compact) {
      const labelText = `${String(label || '').trim()}:`;
      const labelX = x + 8;
      const lineY = y + ((h - 10) / 2);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.1)
        .text(labelText, labelX, lineY, { lineBreak: false });
      const labelWidth = doc.widthOfString(labelText) + 6;
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.3)
        .text(String(value || '-'), labelX + labelWidth, lineY, {
          width: w - 16 - labelWidth,
          align: valueAlign,
          lineBreak: false,
          ellipsis: true,
        });
      return;
    }
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.5)
      .text(String(label || ''), x + 8, y + 5, { width: w - 16, lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
      .text(String(value || '-'), x + 8, y + 16, { width: w - 16, align: valueAlign, lineBreak: false, ellipsis: true });
  };
  const drawTitleStrip = (y, text) => {
    drawRoundBox(margin, y, contentWidth, 28, COLORS.title, COLORS.border);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12).text(text, margin, y + 8, { width: contentWidth, align: 'center', lineBreak: false });
    return y + 34;
  };
  const drawInfoRow = (y, label, value) => {
    drawRoundBox(margin, y, contentWidth, 22);
    const labelText = `${label}:`;
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.2).text(labelText, margin + 8, y + 7, { lineBreak: false });
    const lw = doc.widthOfString(labelText) + 8;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.4).text(String(value || '-'), margin + 8 + lw, y + 7, {
      width: contentWidth - 16 - lw,
      lineBreak: false,
      ellipsis: true,
    });
    return y + 26;
  };

  const drawCompleteHeader = (title) => {
    let y = margin;
    const logoW = 98;
    const logoH = 64;
    const gap = 8;
    const rightX = margin + logoW + gap;
    const rightW = contentWidth - logoW - gap;
    const rowH = 26;
    const topHeaderH = Math.max(logoH, (rowH * 2) + 20);

    drawRoundBox(margin, y, logoW, logoH);
    let logoRendered = false;
    if (appConfig?.logoPath) {
      try {
        const logoDataUrl = String(appConfig.logoPath || '').trim();
        if (logoDataUrl.startsWith('data:image/')) {
          const logoBuffer = decodeImageDataUrl(logoDataUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
            logoRendered = true;
          }
        } else if (fs.existsSync(appConfig.logoPath)) {
          doc.image(appConfig.logoPath, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
          logoRendered = true;
        }
      } catch {
        logoRendered = false;
      }
    }
    if (!logoRendered) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text('LOGO', margin, y + 25, { width: logoW, align: 'center' });
    }

    drawRoundBox(rightX, y, rightW, rowH);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
      .text(String(appConfig?.companyName || 'Não cadastrado'), rightX + 8, y + 7, {
        width: rightW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    const secondRowH = 30;
    const secondRowY = y + logoH - secondRowH;
    const cnpjW = 136;
    const addrGap = 4;
    const addrX = rightX + cnpjW + addrGap;
    const addrW = rightW - cnpjW - addrGap;
    drawInfoBox({
      x: rightX,
      y: secondRowY,
      w: cnpjW,
      h: secondRowH,
      label: 'CNPJ',
      value: appConfig?.companyCnpj || 'Não cadastrado',
      compact: true,
    });
    drawRoundBox(addrX, secondRowY, addrW, secondRowH);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.2)
      .text(String(companyAddressCompact), addrX + 8, secondRowY + 6, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(7.0)
      .text(String(companyWebsite), addrX + 8, secondRowY + 18, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    y += topHeaderH + 8;
    y = drawTitleStrip(y, title);
    drawInfoBox({
      x: margin,
      y,
      w: contentWidth,
      h: 22,
      label: 'Obra',
      value: week.work?.name || '-',
      compact: true,
    });
    y += 26;
    drawInfoBox({
      x: margin,
      y,
      w: contentWidth,
      h: 22,
      label: 'Endereço da obra',
      value: `${week.work?.address || '-'} | CEP ${week.work?.cep || '-'}`,
      compact: true,
    });
    return y + 28;
  };

  let y = drawCompleteHeader(`ATA DE REUNIÃO DE PPC - SEMANA ${week.weekNumber}`);
  y = drawInfoRow(y, 'Data e hora da reunião', meetingAtText || '-');
  y = drawInfoRow(y, 'Fechamento da ata', `${closedAtText || '-'}${week.ppcMeeting.closedBy?.name ? ` por ${week.ppcMeeting.closedBy.name}` : ''}`);
  y = drawInfoRow(y, 'Documento impresso em', printedAtText || '-');

  drawRoundBox(margin, y, contentWidth, 24, COLORS.title, COLORS.border, 6);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.2)
    .text('LISTA DE PRESENÇA', margin + 8, y + 7, { width: contentWidth - 16, align: 'center', lineBreak: false });
  y += 28;

  const attendanceRows = (week.ppcMeeting.attendances || []).length
    ? week.ppcMeeting.attendances
    : [];

  if (!attendanceRows.length) {
    drawRoundBox(margin, y, contentWidth, 24, COLORS.rowA, COLORS.border, 4);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.6)
      .text('Sem registros de presença para esta reunião.', margin + 8, y + 8, { width: contentWidth - 16, align: 'center', lineBreak: false });
    y += 28;
  } else {
    attendanceRows.forEach((row, idx) => {
      drawRoundBox(margin, y, contentWidth, 22, idx % 2 === 0 ? COLORS.rowA : COLORS.rowB, COLORS.border, 4);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
        .text(row.contractor?.name || '-', margin + 8, y + 7, { width: 210, align: 'left', lineBreak: false, ellipsis: true });
      doc.text(row.contractor?.function?.name || '-', margin + 224, y + 7, { width: 130, align: 'center', lineBreak: false, ellipsis: true });
      doc.text(row.present ? 'Presente' : 'Ausente', margin + 360, y + 7, { width: contentWidth - 368, align: 'center', lineBreak: false, ellipsis: true });
      y += 26;
    });
  }

  const minutesText = String(week.ppcMeeting.minutes || '').trim() || 'Sem ata registrada.';
  const minutesH = Math.max(70, Math.min(240, 32 + doc.heightOfString(minutesText, { width: contentWidth - 16 })));
  if (y + minutesH > doc.page.height - margin) {
    doc.addPage();
    y = margin;
  }
  drawRoundBox(margin, y, contentWidth, minutesH, COLORS.box, COLORS.border, 8);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.4)
    .text('PRINCIPAIS PONTOS DISCUTIDOS', margin + 8, y + 8, { width: contentWidth - 16, align: 'left', lineBreak: false });
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.8)
    .text(minutesText, margin + 8, y + 24, { width: contentWidth - 16, align: 'left' });

  doc.end();
}));

router.get('/weeks/:weekId/tasks/export/all/pdf', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  if (!PDFDocument) {
    return res.status(500).json({ error: 'pdf_dependency_missing' });
  }
  const phase = String(req.query.phase || '').trim().toLowerCase();
  const isPrePhase = ['pre', 'preprogramacao', 'pre-programacao', 'pre_programacao'].includes(phase);
  const comparisonMode = ['1', 'true', 'sim', 'yes', 'comparativo']
    .includes(String(req.query.comparison || '').trim().toLowerCase());
  if (comparisonMode && isPrePhase) {
    return res.status(400).json({ error: 'comparison_not_supported_for_pre_planning' });
  }
  if (req.workRoles.has(ROLES.CONTRACTOR) && ![...req.workRoles].some((r) => PRIVILEGED.has(r))) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    include: {
      work: true,
      weatherDays: { orderBy: { dayDate: 'asc' } },
      planningClosedBy: { select: { name: true } },
      prePlanningClosedBy: { select: { name: true } },
    },
  });
  if (!week) return res.status(404).json({ error: 'week_not_found' });
  if (isPrePhase && String(week.prePlanningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'pre_planning_not_closed' });
  }
  if (!isPrePhase && String(week.planningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'planning_not_closed' });
  }
  if (!isPrePhase && comparisonMode && String(week.feedbackStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'feedback_not_closed' });
  }

  let tasks = [];
  if (isPrePhase) {
    const preTasks = await prisma.preTask.findMany({
      where: {
        weekId: req.week.id,
      },
      include: {
        contractor: { include: { function: true } },
        location: true,
        plannedDays: true,
        originWeek: { select: { weekNumber: true } },
      },
      orderBy: { sequenceNumber: 'asc' },
    });
    tasks = preTasks.map((item) => ({
      ...item,
      currentWeekId: item.weekId,
      feedbacks: [],
      isUnplanned: false,
    }));
  } else {
    tasks = await prisma.task.findMany({
      where: {
        currentWeekId: req.week.id,
      },
      include: {
        contractor: { include: { function: true } },
        location: true,
        plannedDays: true,
        feedbacks: {
          where: { weekId: req.week.id },
          select: { status: true },
        },
        originWeek: { select: { weekNumber: true } },
      },
      orderBy: { sequenceNumber: 'asc' },
    });
  }

  const holidays = await prisma.holiday.findMany({
    where: {
      workId: req.workId,
      dayDate: {
        gte: week.startDate,
        lte: week.endDate,
      },
    },
    orderBy: [{ dayDate: 'asc' }, { id: 'asc' }],
  });

  const appConfig = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  const printedAt = new Date();
  const fileName = isPrePhase
    ? `PPC-Pre-Programacao-Semana-${week.weekNumber}-Todas-Atividades.pdf`
    : (comparisonMode
      ? `PPC-Semana-${week.weekNumber}-Comparativo-Planejado-Executado.pdf`
      : `PPC-Semana-${week.weekNumber}-Todas-Atividades.pdf`);
  const reportTitle = isPrePhase
    ? `PPC - PRÉ-PROGRAMAÇÃO - Semana ${week.weekNumber} | ${formatDateBr(week.startDate)} a ${formatDateBr(week.endDate)}`
    : (comparisonMode
      ? `FEEDBACK PPC - SEMANA ${week.weekNumber} | ${formatDateBr(week.startDate)} a ${formatDateBr(week.endDate)}`
      : `PPC - Semana ${week.weekNumber} | ${formatDateBr(week.startDate)} a ${formatDateBr(week.endDate)}`);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 34, size: 'A4', bufferPages: true });
  doc.pipe(res);
  const tz = inferBrazilTimeZoneFromWork(week.work);
  const printedAtText = formatDateTimeBrInTimeZone(printedAt, tz);
  const closedAtText = formatDateTimeBrInTimeZone(
    isPrePhase ? week.prePlanningClosedAt : week.planningClosedAt,
    tz,
  );
  const closedByName = isPrePhase ? (week.prePlanningClosedBy?.name || '') : (week.planningClosedBy?.name || '');
  const closureLabel = isPrePhase ? 'Fechamento da pré-programação' : 'Fechamento do planejamento';
  const companyWebsite = appConfig?.companySite || appConfig?.companyWebsite || appConfig?.website || appConfig?.site || 'A cadastrar';
  const companyStreetNumber = [appConfig?.companyStreet, appConfig?.companyNumber].filter(Boolean).join(', ');
  const companyComplement = String(appConfig?.companyComplement || '').trim();
  const companyCityState = [appConfig?.companyCity, appConfig?.companyState].filter(Boolean).join('/');
  let companyAddressCompact = [
    companyStreetNumber ? `${companyStreetNumber}${companyComplement ? `, ${companyComplement}` : ''}` : '',
    companyCityState,
  ].filter(Boolean).join(' - ');
  if (!companyAddressCompact) {
    const rawAddress = String(appConfig?.companyAddress || '').trim();
    const parts = rawAddress
      .split(' - ')
      .map((item) => String(item || '').trim())
      .filter((item) => item && !/^CEP\b/i.test(item));
    if (parts.length >= 2) {
      companyAddressCompact = `${parts[0]} - ${parts[parts.length - 1]}`;
    } else {
      companyAddressCompact = rawAddress;
    }
  }
  if (!companyAddressCompact) companyAddressCompact = 'Não cadastrado';

  const activeContractorsMap = new Map();
  tasks.forEach((task) => {
    const contractor = task.contractor || null;
    if (!contractor?.id) return;
    const current = activeContractorsMap.get(contractor.id);
    const parsedContact = parseContractorContact(contractor.contact);
    const laborType = contractor.function?.name || '-';
    const supervisorCandidate = String(task.supervisor || parsedContact.supervisor || '').trim();
    const emailCandidate = String(parsedContact.communicationEmail || '').trim();
    const phoneCandidate = String(parsedContact.phone || '').trim();

    if (!current) {
      activeContractorsMap.set(contractor.id, {
        id: contractor.id,
        name: contractor.name || '-',
        laborType,
        supervisor: supervisorCandidate || '-',
        email: emailCandidate || '-',
        phone: phoneCandidate || '-',
      });
      return;
    }
    if ((!current.supervisor || current.supervisor === '-') && supervisorCandidate) current.supervisor = supervisorCandidate;
    if ((!current.email || current.email === '-') && emailCandidate) current.email = emailCandidate;
    if ((!current.phone || current.phone === '-') && phoneCandidate) current.phone = phoneCandidate;
    if ((!current.laborType || current.laborType === '-') && laborType && laborType !== '-') current.laborType = laborType;
  });
  const activeContractors = [...activeContractorsMap.values()].sort((a, b) => (
    String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
  ));

  const COLORS = {
    border: '#b7cfe8',
    box: '#f2f8ff',
    boxStrong: '#dcebff',
    title: '#c8def8',
    text: '#1e3c59',
    rowA: '#f7fbff',
    rowB: '#eaf3ff',
    header: '#d4e6fb',
    checkboxA: '#d9ebff',
    checkboxB: '#cde3fb',
    holidayDay: '#ffe2e2',
    plannedBand: '#fff5c4',
    executedBand: '#d9f4d9',
  };

  const margin = 34;
  const pageBottom = () => doc.page.height - margin;
  const contentWidth = doc.page.width - (margin * 2);
  const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const weatherWeekdays = ['SUNDAY', ...weekdays];
  const dayKeyToWeekday = {
    mon: 'MONDAY',
    tue: 'TUESDAY',
    wed: 'WEDNESDAY',
    thu: 'THURSDAY',
    fri: 'FRIDAY',
    sat: 'SATURDAY',
  };
  const holidayWeekdaySet = new Set(
    (holidays || [])
      .map((item) => weekdayCodeFromDate(item.dayDate))
      .filter((weekday) => weekdays.includes(weekday)),
  );
  const holidayDayColumns = new Set(
    Object.entries(dayKeyToWeekday)
      .filter(([, weekday]) => holidayWeekdaySet.has(weekday))
      .map(([dayKey]) => dayKey),
  );

  const drawRoundBox = (x, y, w, h, fill = COLORS.box, stroke = COLORS.border, radius = 8) => {
    doc
      .save()
      .fillColor(fill)
      .strokeColor(stroke)
      .lineWidth(0.7)
      .roundedRect(x, y, w, h, radius)
      .fillAndStroke()
      .restore();
  };

  const drawInfoBox = ({
    x, y, w, h, label, value, valueAlign = 'left', compact = true,
  }) => {
    drawRoundBox(x, y, w, h);
    if (compact) {
      const labelText = `${String(label || '').trim()}:`;
      const labelX = x + 8;
      const lineY = y + ((h - 10) / 2);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.1)
        .text(labelText, labelX, lineY, { lineBreak: false });
      const labelWidth = doc.widthOfString(labelText) + 6;
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.3)
        .text(String(value || '-'), labelX + labelWidth, lineY, {
          width: w - 16 - labelWidth,
          align: valueAlign,
          lineBreak: false,
          ellipsis: true,
        });
      return;
    }
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.5)
      .text(String(label || ''), x + 8, y + 5, { width: w - 16, lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
      .text(String(value || '-'), x + 8, y + 16, { width: w - 16, align: valueAlign, lineBreak: false, ellipsis: true });
  };

  const drawTitleStrip = (y, text) => {
    const h = 28;
    drawRoundBox(margin, y, contentWidth, h, COLORS.title, COLORS.border);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
      .text(String(text || ''), margin, y + 8, { width: contentWidth, align: 'center', lineBreak: false });
    return y + h + 6;
  };

  const drawWeatherIcon = (icon, x, y, size = 16) => {
    const code = String(icon || '').toUpperCase();
    if (code === 'SUNNY') {
      doc.save().fillColor('#ffd24d').strokeColor('#d6a42e').circle(x + (size / 2), y + (size / 2), size * 0.35).fillAndStroke().restore();
      return;
    }
    const drawCloud = () => {
      doc.save().fillColor('#d7e3f3').strokeColor('#a7bcd6').lineWidth(0.6);
      doc.circle(x + size * 0.35, y + size * 0.56, size * 0.2).fillAndStroke();
      doc.circle(x + size * 0.55, y + size * 0.5, size * 0.24).fillAndStroke();
      doc.roundedRect(x + size * 0.2, y + size * 0.54, size * 0.62, size * 0.22, 3).fillAndStroke();
      doc.restore();
    };
    if (code === 'CLOUDY') {
      drawCloud();
      return;
    }
    if (code === 'RAIN') {
      drawCloud();
      doc.save().strokeColor('#3b7cc3').lineWidth(1);
      doc.moveTo(x + size * 0.36, y + size * 0.84).lineTo(x + size * 0.33, y + size * 0.98).stroke();
      doc.moveTo(x + size * 0.52, y + size * 0.84).lineTo(x + size * 0.49, y + size * 0.98).stroke();
      doc.moveTo(x + size * 0.68, y + size * 0.84).lineTo(x + size * 0.65, y + size * 0.98).stroke();
      doc.restore();
      return;
    }
    if (code === 'STORM') {
      drawCloud();
      doc.save().fillColor('#f4b73f').strokeColor('#d09a2d').lineWidth(0.8);
      doc.polygon(
        [x + size * 0.5, y + size * 0.8],
        [x + size * 0.42, y + size * 0.97],
        [x + size * 0.56, y + size * 0.97],
        [x + size * 0.47, y + size * 1.14],
      ).fillAndStroke();
      doc.restore();
      return;
    }
    drawCloud();
  };

  const drawPpcPageHeader = () => {
    let headerY = margin;
    const logoWLocal = 98;
    const logoHLocal = 64;
    const gapLocal = 8;
    const rightXLocal = margin + logoWLocal + gapLocal;
    const rightWLocal = contentWidth - logoWLocal - gapLocal;
    const rowHLocal = 26;
    const topHeaderHLocal = Math.max(logoHLocal, (rowHLocal * 2) + 20);

    drawRoundBox(margin, headerY, logoWLocal, logoHLocal);
    let logoRenderedLocal = false;
    if (appConfig?.logoPath) {
      try {
        const logoDataUrl = String(appConfig.logoPath || '').trim();
        if (logoDataUrl.startsWith('data:image/')) {
          const logoBuffer = decodeImageDataUrl(logoDataUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, margin + 6, headerY + 6, { fit: [logoWLocal - 12, logoHLocal - 12], align: 'center', valign: 'center' });
            logoRenderedLocal = true;
          }
        } else if (fs.existsSync(appConfig.logoPath)) {
          doc.image(appConfig.logoPath, margin + 6, headerY + 6, { fit: [logoWLocal - 12, logoHLocal - 12], align: 'center', valign: 'center' });
          logoRenderedLocal = true;
        }
      } catch {
        logoRenderedLocal = false;
      }
    }
    if (!logoRenderedLocal) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text('LOGO', margin, headerY + 25, { width: logoWLocal, align: 'center' });
    }

    drawRoundBox(rightXLocal, headerY, rightWLocal, rowHLocal);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
      .text(String(appConfig?.companyName || 'Não cadastrado'), rightXLocal + 8, headerY + 7, {
        width: rightWLocal - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });

    const secondRowHLocal = 30;
    const secondRowYLocal = headerY + logoHLocal - secondRowHLocal;
    const cnpjWLocal = 136;
    const addrGapLocal = 4;
    const addrXLocal = rightXLocal + cnpjWLocal + addrGapLocal;
    const addrWLocal = rightWLocal - cnpjWLocal - addrGapLocal;
    drawInfoBox({
      x: rightXLocal,
      y: secondRowYLocal,
      w: cnpjWLocal,
      h: secondRowHLocal,
      label: 'CNPJ',
      value: appConfig?.companyCnpj || 'Não cadastrado',
      compact: true,
    });
    drawRoundBox(addrXLocal, secondRowYLocal, addrWLocal, secondRowHLocal);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.2)
      .text(String(companyAddressCompact), addrXLocal + 8, secondRowYLocal + 6, {
        width: addrWLocal - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(7.0)
      .text(String(companyWebsite), addrXLocal + 8, secondRowYLocal + 18, {
        width: addrWLocal - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });

    headerY += topHeaderHLocal + 8;
    headerY = drawTitleStrip(headerY, reportTitle);
    return headerY;
  };

  let y = margin;
  const logoW = 98;
  const logoH = 64;
  const gap = 8;
  const rightX = margin + logoW + gap;
  const rightW = contentWidth - logoW - gap;
  const rowH = 26;
  const topHeaderH = Math.max(logoH, (rowH * 2) + 20);

  drawRoundBox(margin, y, logoW, logoH);
  let logoRendered = false;
  if (appConfig?.logoPath) {
    try {
      const logoDataUrl = String(appConfig.logoPath || '').trim();
      if (logoDataUrl.startsWith('data:image/')) {
        const logoBuffer = decodeImageDataUrl(logoDataUrl);
        if (logoBuffer) {
          doc.image(logoBuffer, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
          logoRendered = true;
        }
      } else if (fs.existsSync(appConfig.logoPath)) {
        doc.image(appConfig.logoPath, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
        logoRendered = true;
      }
    } catch {
      logoRendered = false;
    }
  }
  if (!logoRendered) {
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
      .text('LOGO', margin, y + 25, { width: logoW, align: 'center' });
  }

  drawRoundBox(rightX, y, rightW, rowH);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
    .text(String(appConfig?.companyName || 'Não cadastrado'), rightX + 8, y + 7, {
      width: rightW - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  const secondRowH = 30;
  const secondRowY = y + logoH - secondRowH;
  const cnpjW = 136;
  const addrGap = 4;
  const addrX = rightX + cnpjW + addrGap;
  const addrW = rightW - cnpjW - addrGap;
  drawInfoBox({
    x: rightX,
    y: secondRowY,
    w: cnpjW,
    h: secondRowH,
    label: 'CNPJ',
    value: appConfig?.companyCnpj || 'Não cadastrado',
    compact: true,
  });
  drawRoundBox(addrX, secondRowY, addrW, secondRowH);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.2)
    .text(String(companyAddressCompact), addrX + 8, secondRowY + 6, {
      width: addrW - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  doc.font('Helvetica').fontSize(7.0)
    .text(String(companyWebsite), addrX + 8, secondRowY + 18, {
      width: addrW - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  y += topHeaderH + 8;

  y = drawTitleStrip(y, reportTitle);

  drawInfoBox({
    x: margin,
    y,
    w: contentWidth,
    h: 22,
    label: 'Obra',
    value: week.work?.name || '-',
    compact: true,
  });
  y += 26;
  drawInfoBox({
    x: margin,
    y,
    w: contentWidth,
    h: 22,
    label: 'Endereço da obra',
    value: `${week.work?.address || '-'} | CEP ${week.work?.cep || '-'}`,
    compact: true,
  });
  y += 28;

  drawRoundBox(margin, y, contentWidth, 42);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.8)
    .text(
      `${closureLabel}: ${closedAtText || '-'}${closedByName ? ` por ${closedByName}` : ''}`,
      margin + 8,
      y + 8,
      { width: contentWidth - 16, lineBreak: false },
    );
  doc.text(`Documento impresso em: ${printedAtText || '-'}`, margin + 8, y + 24, { width: contentWidth - 16, lineBreak: false });
  y += 48;

  const weatherOuterH = 100;
  drawRoundBox(margin, y, contentWidth, weatherOuterH, COLORS.boxStrong, COLORS.border);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.2)
    .text('PREVISÃO DO TEMPO (DOMINGO A SÁBADO)', margin, y + 6, { width: contentWidth, align: 'center' });

  const weatherByWeekday = new Map((week.weatherDays || []).map((item) => [String(item.weekday || '').toUpperCase(), item]));
  const weatherCellY = y + 22;
  const weatherCellH = weatherOuterH - 32;
  const weatherCellGap = 4;
  const weatherCellW = (contentWidth - (weatherCellGap * 8)) / 7;

  weatherWeekdays.forEach((weekday, index) => {
    const item = weatherByWeekday.get(weekday) || null;
    const x = margin + weatherCellGap + (index * (weatherCellW + weatherCellGap));
    drawRoundBox(x, weatherCellY, weatherCellW, weatherCellH, index % 2 === 0 ? '#f7fbff' : '#edf5ff', COLORS.border, 6);

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(6.9)
      .text(weekdayPt(weekday), x, weatherCellY + 5, { width: weatherCellW, align: 'center', lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(6.1)
      .text(formatDateBr(item?.dayDate), x, weatherCellY + 15, { width: weatherCellW, align: 'center', lineBreak: false });
    drawWeatherIcon(item?.icon, x + ((weatherCellW - 12) / 2), weatherCellY + 22, 12);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(5.9)
      .text(`Máx ${item?.tempMaxC ?? '-'}° | Mín ${item?.tempMinC ?? '-'}°`, x + 3, weatherCellY + 43, { width: weatherCellW - 6, align: 'center', lineBreak: false, ellipsis: true });
    doc.text(`Chuva ${item?.precipitationMm ?? '-'} mm/dia`, x + 3, weatherCellY + 52, { width: weatherCellW - 6, align: 'center', lineBreak: false, ellipsis: true });
    doc.text(`Prob. ${item?.precipitationProbabilityPct ?? '-'}%`, x + 3, weatherCellY + 61, { width: weatherCellW - 6, align: 'center', lineBreak: false, ellipsis: true });
  });
  y += weatherOuterH + 8;

  const columns = comparisonMode
    ? [
      { key: 'seq', title: '#', width: 20 },
      { key: 'origin', title: 'Sem. origem', width: 42 },
      { key: 'contractor', title: 'Empreiteiro', width: 98 },
      { key: 'l1', title: 'Local 1', width: 44 },
      { key: 'l2', title: 'Local 2', width: 44 },
      { key: 'task', title: 'Tarefa', width: 131 },
      { key: 'mon', title: 'Seg', width: 18 },
      { key: 'tue', title: 'Ter', width: 18 },
      { key: 'wed', title: 'Qua', width: 18 },
      { key: 'thu', title: 'Qui', width: 18 },
      { key: 'fri', title: 'Sex', width: 18 },
      { key: 'sat', title: 'Sáb', width: 18 },
      { key: 'status', title: 'Feedback', width: 40 },
    ]
    : [
      { key: 'seq', title: '#', width: 18 },
      { key: 'origin', title: 'Sem. origem', width: 38 },
      { key: 'contractor', title: 'Empreiteiro', width: 94 },
      { key: 'l1', title: 'Local 1', width: 42 },
      { key: 'l2', title: 'Local 2', width: 42 },
      { key: 'task', title: 'Tarefa', width: 120 },
      { key: 'mon', title: 'Seg', width: 18 },
      { key: 'tue', title: 'Ter', width: 18 },
      { key: 'wed', title: 'Qua', width: 18 },
      { key: 'thu', title: 'Qui', width: 18 },
      { key: 'fri', title: 'Sex', width: 18 },
      { key: 'sat', title: 'Sáb', width: 18 },
      { key: 'status', title: 'Status', width: 42 },
    ];
  const headerH = 21;
  const rowHData = comparisonMode ? 46 : 30;

  const drawTableHeader = (yStart) => {
    drawRoundBox(margin, yStart, contentWidth, headerH, COLORS.header, COLORS.border, 4);
    let x = margin;
    columns.forEach((col, index) => {
      if (holidayDayColumns.has(col.key)) {
        doc.save()
          .fillColor(COLORS.holidayDay)
          .rect(x + 0.4, yStart + 0.4, col.width - 0.8, headerH - 0.8)
          .fill()
          .restore();
      }
      const headerFont = 7.0;
      const headerText = String(col.title || '');
      const headerWidth = col.width - 4;
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(headerFont);
      const headerTextH = doc.heightOfString(headerText, { width: headerWidth, lineBreak: false });
      const headerY = yStart + ((headerH - headerTextH) / 2);
      doc.text(headerText, x + 2, headerY, {
        width: headerWidth,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
      if (index > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.6).moveTo(x, yStart).lineTo(x, yStart + headerH).stroke().restore();
      }
      x += col.width;
    });
    return yStart + headerH;
  };

  const drawTaskRow = (task, yStart, idx) => {
    const fill = idx % 2 === 0 ? COLORS.rowA : COLORS.rowB;
    drawRoundBox(margin, yStart, contentWidth, rowHData, fill, COLORS.border, 3);
    let x = margin;
    const allDaySet = new Set((task.plannedDays || []).map((d) => String(d.weekday || '').toUpperCase()));
    let plannedDaySet = new Set((task.plannedDays || [])
      .filter((d) => d?.plannedDate)
      .map((d) => String(d.weekday || '').toUpperCase()));
    if (!task?.isUnplanned && plannedDaySet.size === 0) {
      plannedDaySet = new Set(allDaySet);
    }
    if (task?.isUnplanned) {
      plannedDaySet = new Set();
    }
    const executedDaySet = new Set((task.plannedDays || [])
      .filter((d) => d?.actualDate)
      .map((d) => String(d.weekday || '').toUpperCase()));
    if (executedDaySet.size === 0) {
      const start = normalizeDateOnly(task.actualStart);
      const end = normalizeDateOnly(task.actualEnd);
      if (start || end) {
        const rangeStart = start || end;
        const rangeEnd = end || start;
        weekdays.forEach((weekday) => {
          const dayDate = normalizeDateOnly(weatherByWeekday.get(weekday)?.dayDate);
          if (!dayDate) return;
          if (dayDate.getTime() >= rangeStart.getTime() && dayDate.getTime() <= rangeEnd.getTime()) {
            executedDaySet.add(weekday);
          }
        });
      }
    }
    const feedbackStatusCode = String((task.feedbacks || [])[0]?.status || '').toUpperCase();
    if (feedbackStatusCode === 'NOT_STARTED') {
      executedDaySet.clear();
    }
    const isChecked = (weekday) => allDaySet.has(weekday);
    const isL1Marker = String(task.location?.level2 || '').startsWith(ZONE_L1_PREFIX);
    const status = comparisonMode
      ? taskFeedbackStatusLabel(task, week.startDate)
      : taskStatusForWeek(task, week.startDate);
    const values = {
      seq: String(task.sequenceNumber || ''),
      origin: String(task.originWeek?.weekNumber || ''),
      contractor: String(task.contractor?.name || '-'),
      l1: String(task.location?.level1 || '-'),
      l2: String(isL1Marker ? '' : (task.location?.level2 || '')),
      task: String(task.description || ''),
      mon: isChecked('MONDAY'),
      tue: isChecked('TUESDAY'),
      wed: isChecked('WEDNESDAY'),
      thu: isChecked('THURSDAY'),
      fri: isChecked('FRIDAY'),
      sat: isChecked('SATURDAY'),
      status,
    };

    const dayColumns = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const firstDayIdx = columns.findIndex((col) => col.key === 'mon');
    const dayStartX = margin + columns.slice(0, Math.max(0, firstDayIdx)).reduce((acc, col) => acc + col.width, 0);
    const dayWidth = columns
      .filter((col) => dayColumns.includes(col.key))
      .reduce((acc, col) => acc + col.width, 0);
    if (comparisonMode && dayWidth > 0) {
      doc.save().strokeColor(COLORS.border).lineWidth(0.5)
        .moveTo(dayStartX, yStart + (rowHData / 2))
        .lineTo(dayStartX + dayWidth, yStart + (rowHData / 2))
        .stroke().restore();
    }

    const drawCheckbox = (boxX, boxY, checked) => {
      doc.save().strokeColor('#5e7ea1').lineWidth(0.9).rect(boxX, boxY, 8, 8).stroke().restore();
      if (checked !== true) return;
      doc.save().strokeColor('#244769').lineWidth(1.1)
        .moveTo(boxX + 1.2, boxY + 1.2).lineTo(boxX + 6.8, boxY + 6.8).stroke()
        .moveTo(boxX + 6.8, boxY + 1.2).lineTo(boxX + 1.2, boxY + 6.8).stroke()
        .restore();
    };

    columns.forEach((col, index) => {
      if (index > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, yStart).lineTo(x, yStart + rowHData).stroke().restore();
      }
      if (['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(col.key)) {
        if (!comparisonMode) {
          const dayFill = holidayDayColumns.has(col.key)
            ? COLORS.holidayDay
            : (idx % 2 === 0 ? COLORS.checkboxA : COLORS.checkboxB);
          doc.save().fillColor(dayFill).rect(x + 0.4, yStart + 0.4, col.width - 0.8, rowHData - 0.8).fill().restore();
        } else {
          if (holidayDayColumns.has(col.key)) {
            doc.save().fillColor(COLORS.holidayDay)
              .rect(x + 0.4, yStart + 0.4, col.width - 0.8, rowHData - 0.8).fill().restore();
          } else {
            doc.save().fillColor(COLORS.plannedBand)
              .rect(x + 0.4, yStart + 0.4, col.width - 0.8, (rowHData / 2) - 0.6).fill().restore();
            doc.save().fillColor(COLORS.executedBand)
              .rect(x + 0.4, yStart + (rowHData / 2) + 0.2, col.width - 0.8, (rowHData / 2) - 0.6).fill().restore();
          }
        }
      }
      if (col.key === 'task') {
        const fontSize = 7.1;
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(fontSize);
        const textH = doc.heightOfString(values.task, { width: col.width - 6, lineGap: 0, align: comparisonMode ? 'center' : 'right' });
        const top = Math.max(yStart + 2, yStart + ((rowHData - Math.min(textH, rowHData - 4)) / 2));
        doc.text(values.task, x + 3, top, {
          width: col.width - 6,
          height: rowHData - 4,
          ellipsis: true,
          lineGap: 0,
          align: comparisonMode ? 'center' : 'right',
        });
      } else if (['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(col.key)) {
        const boxX = x + ((col.width - 8) / 2);
        if (!comparisonMode) {
          const boxY = yStart + ((rowHData - 8) / 2);
          drawCheckbox(boxX, boxY, values[col.key] === true);
        } else {
          const weekday = ({
            mon: 'MONDAY',
            tue: 'TUESDAY',
            wed: 'WEDNESDAY',
            thu: 'THURSDAY',
            fri: 'FRIDAY',
            sat: 'SATURDAY',
          })[col.key];
          const topY = yStart + 5;
          const bottomY = yStart + rowHData - 13;
          drawCheckbox(boxX, topY, plannedDaySet.has(weekday));
          drawCheckbox(boxX, bottomY, executedDaySet.has(weekday));
        }
      } else {
        const fontSize = 7.0;
        const cellWidth = col.width - 4;
        const textValue = String(values[col.key] || '');
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(fontSize)
          .text(textValue, x + 2, yStart + ((rowHData - doc.heightOfString(textValue, { width: cellWidth, lineBreak: false })) / 2), {
            width: cellWidth,
            align: 'center',
            lineBreak: false,
            ellipsis: true,
          });
      }
      x += col.width;
    });
    return yStart + rowHData;
  };

  const drawTableRepeatHeader = (newPageTitle = false) => {
    if (newPageTitle) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text(
          comparisonMode
            ? `FEEDBACK PPC - SEMANA ${week.weekNumber} | Comparativo Planejado x Executado`
            : (isPrePhase
              ? `PPC - PRÉ-PROGRAMAÇÃO - Semana ${week.weekNumber} | Todas as atividades`
              : `PPC - Semana ${week.weekNumber} | Todas as atividades`),
          margin,
          margin - 4,
          { width: contentWidth, lineBreak: false },
        );
    }
    return drawTableHeader(doc.y + (newPageTitle ? 6 : 0));
  };

  if (comparisonMode) {
    const legendH = 24;
    drawRoundBox(margin, y, contentWidth, legendH, '#eef6ff', COLORS.border, 5);
    const boxSize = 9;
    const leftX = margin + 14;
    const centerY = y + ((legendH - boxSize) / 2);
    doc.save().fillColor(COLORS.plannedBand).strokeColor(COLORS.border).lineWidth(0.6)
      .rect(leftX, centerY, boxSize, boxSize).fillAndStroke().restore();
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.2)
      .text('Planejado (linha superior)', leftX + boxSize + 6, y + 8, {
        width: 150,
        lineBreak: false,
        ellipsis: true,
      });
    const secondX = leftX + 176;
    doc.save().fillColor(COLORS.executedBand).strokeColor(COLORS.border).lineWidth(0.6)
      .rect(secondX, centerY, boxSize, boxSize).fillAndStroke().restore();
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.2)
      .text('Executado (linha inferior)', secondX + boxSize + 6, y + 8, {
        width: 155,
        lineBreak: false,
        ellipsis: true,
      });
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.2)
      .text('Checkbox superior = planejado | inferior = executado', margin + 355, y + 8, {
        width: contentWidth - 365,
        align: 'right',
        lineBreak: false,
        ellipsis: true,
      });
    y += legendH + 4;
  }

  y = drawTableHeader(y);
  if (!tasks.length) {
    y = drawTaskRow({
      sequenceNumber: '-',
      location: { level1: '-', level2: '' },
      contractor: { name: '-' },
      description: 'Sem atividades nesta semana.',
      plannedDays: [],
      originWeekId: req.week.id,
      currentWeekId: req.week.id,
    }, y, 0);
  } else {
    tasks.forEach((task, idx) => {
      if (y + rowHData > pageBottom() - 20) {
        doc.addPage();
        y = drawTableRepeatHeader(true);
      }
      y = drawTaskRow(task, y, idx);
    });
  }

  if (holidays.length) {
    const holidayRows = holidays.map((item) => {
      const label = String(item.description || '').trim();
      return `${formatDateBr(item.dayDate)}${label ? ` - ${label}` : ''}`;
    });
    const holidayBoxH = 24 + (holidayRows.length * 12) + 10;
    if (y + holidayBoxH + 8 > pageBottom()) {
      doc.addPage();
      y = drawPpcPageHeader();
    } else {
      y += 8;
    }
    drawRoundBox(margin, y, contentWidth, holidayBoxH, COLORS.boxStrong, COLORS.border, 8);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.5)
      .text('Feriados da Semana', margin + 8, y + 7, { width: contentWidth - 16, align: 'left', lineBreak: false });
    holidayRows.forEach((line, index) => {
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
        .text(`- ${line}`, margin + 10, y + 24 + (index * 12), {
          width: contentWidth - 20,
          lineBreak: false,
          ellipsis: true,
        });
    });
    y += holidayBoxH + 6;
  }

  const drawActiveContractorsSectionTitle = (yStart) => {
    drawRoundBox(margin, yStart, contentWidth, 24, COLORS.boxStrong, COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.4)
      .text('EMPREITEIROS ATIVOS NA OBRA', margin + 8, yStart + 7, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    return yStart + 28;
  };

  const activeColumns = [
    { key: 'name', title: 'Empreiteiro', width: 148 },
    { key: 'laborType', title: 'Mão de obra', width: 92 },
    { key: 'supervisor', title: 'Encarregado', width: 95 },
    { key: 'email', title: 'Email', width: 130 },
    { key: 'phone', title: 'Telefone', width: contentWidth - (148 + 92 + 95 + 130) },
  ];
  const activeHeaderH = 20;
  const activeRowH = 20;

  const drawActiveHeader = (yStart) => {
    drawRoundBox(margin, yStart, contentWidth, activeHeaderH, COLORS.header, COLORS.border, 4);
    let x = margin;
    activeColumns.forEach((col, idx) => {
      const title = String(col.title || '');
      const textH = doc.heightOfString(title, {
        width: col.width - 4,
        lineBreak: false,
      });
      const textY = yStart + ((activeHeaderH - Math.min(textH, activeHeaderH - 4)) / 2);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.0)
        .text(title, x + 2, textY, {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, yStart).lineTo(x, yStart + activeHeaderH).stroke().restore();
      }
      x += col.width;
    });
    return yStart + activeHeaderH;
  };

  const drawActiveRow = (row, yStart, idx) => {
    drawRoundBox(margin, yStart, contentWidth, activeRowH, idx % 2 === 0 ? COLORS.rowA : COLORS.rowB, COLORS.border, 3);
    let x = margin;
    activeColumns.forEach((col, colIdx) => {
      if (colIdx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(x, yStart).lineTo(x, yStart + activeRowH).stroke().restore();
      }
      const text = String(row[col.key] || '');
      const textH = doc.heightOfString(text, {
        width: col.width - 4,
        lineBreak: false,
      });
      const textY = yStart + ((activeRowH - Math.min(textH, activeRowH - 4)) / 2);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.0)
        .text(text, x + 2, textY, {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    return yStart + activeRowH;
  };

  doc.addPage();
  y = drawPpcPageHeader();
  y = drawActiveContractorsSectionTitle(y);
  y = drawActiveHeader(y);
  if (!activeContractors.length) {
    y = drawActiveRow({
      name: 'Sem empreiteiros ativos na semana.',
      laborType: '-',
      supervisor: '-',
      email: '-',
      phone: '-',
    }, y, 0);
  } else {
    activeContractors.forEach((item, idx) => {
      if (y + activeRowH > pageBottom() - 10) {
        doc.addPage();
        y = drawPpcPageHeader();
        y = drawActiveContractorsSectionTitle(y);
        y = drawActiveHeader(y);
      }
      y = drawActiveRow(item, y, idx);
    });
  }

  const zoneMatrixByContractor = new Map(
    activeContractors.map((item) => [
      Number(item.id),
      {
        id: Number(item.id),
        name: String(item.name || '-'),
        days: {
          MONDAY: new Map(),
          TUESDAY: new Map(),
          WEDNESDAY: new Map(),
          THURSDAY: new Map(),
          FRIDAY: new Map(),
          SATURDAY: new Map(),
        },
      },
    ]),
  );

  tasks.forEach((task) => {
    const contractorId = Number(task.contractor?.id || 0);
    if (!contractorId || !zoneMatrixByContractor.has(contractorId)) return;
    const row = zoneMatrixByContractor.get(contractorId);
    const l1 = String(task.location?.level1 || '').trim() || '-';
    const rawL2 = String(task.location?.level2 || '').trim();
    const l2 = rawL2.startsWith(ZONE_L1_PREFIX) ? '' : rawL2;
    const zoneKey = `${l1}||${l2}`;
    const zoneEntry = {
      l1,
      l2,
      label: l2 ? `${l1} / ${l2}` : l1,
    };
    (task.plannedDays || []).forEach((day) => {
      const weekday = String(day.weekday || '').toUpperCase();
      if (!row.days[weekday]) return;
      row.days[weekday].set(zoneKey, zoneEntry);
    });
  });

  const zoneMatrixRows = [...zoneMatrixByContractor.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .flatMap((row) => {
      const dayPairs = {};
      weekdays.forEach((weekday) => {
        dayPairs[weekday] = [...(row.days[weekday]?.values() || [])]
          .sort((a, b) => (
            String(a.l1 || '').localeCompare(String(b.l1 || ''), 'pt-BR')
            || String(a.l2 || '').localeCompare(String(b.l2 || ''), 'pt-BR')
          ))
          .map((item) => ({
            z1: String(item.l1 || '-'),
            z2: String(item.l2 || ''),
          }));
      });
      const maxPairs = Math.max(
        1,
        ...weekdays.map((weekday) => dayPairs[weekday].length),
      );
      return Array.from({ length: maxPairs }, (_, pairIndex) => {
        const line = {
          name: row.name,
          __group: String(row.id),
        };
        weekdays.forEach((weekday) => {
          const pair = dayPairs[weekday][pairIndex] || null;
          line[`${weekday}_Z1`] = pair ? pair.z1 : '';
          line[`${weekday}_Z2`] = pair ? pair.z2 : '';
        });
        return line;
      });
    });

  const drawMatrixSectionTitle = (yStart) => {
    drawRoundBox(margin, yStart, contentWidth, 24, COLORS.boxStrong, COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.4)
      .text('DISTRIBUIÇÃO POR EMPREITEIRO E ZONA (SEGUNDA A SÁBADO)', margin + 8, yStart + 7, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    return yStart + 28;
  };

  const matrixNameW = 96;
  const matrixSubW = (contentWidth - matrixNameW) / 12;
  const matrixHeaderRow1H = 14;
  const matrixHeaderRow2H = 14;
  const matrixHeaderH = matrixHeaderRow1H + matrixHeaderRow2H;
  const matrixRowH = 22;
  const matrixDayDefs = [
    ['MONDAY', 'Seg'],
    ['TUESDAY', 'Ter'],
    ['WEDNESDAY', 'Qua'],
    ['THURSDAY', 'Qui'],
    ['FRIDAY', 'Sex'],
    ['SATURDAY', 'Sáb'],
  ];
  const matrixDataColumns = [
    { key: 'name', width: matrixNameW },
    ...matrixDayDefs.flatMap(([weekday]) => ([
      { key: `${weekday}_Z1`, width: matrixSubW },
      { key: `${weekday}_Z2`, width: matrixSubW },
    ])),
  ];
  const emptyMatrixRow = {
    name: 'Sem empreiteiros ativos na semana.',
    __group: 'empty',
  };
  matrixDayDefs.forEach(([weekday]) => {
    emptyMatrixRow[`${weekday}_Z1`] = '';
    emptyMatrixRow[`${weekday}_Z2`] = '';
  });

  const drawMatrixHeader = (yStart) => {
    drawRoundBox(margin, yStart, contentWidth, matrixHeaderH, COLORS.header, COLORS.border, 4);
    const topY = yStart;
    const splitY = yStart + matrixHeaderRow1H;
    const bottomY = yStart + matrixHeaderH;
    const thickStroke = 1.15;
    const thinStroke = 0.55;

    doc.save().strokeColor(COLORS.border).lineWidth(thinStroke);
    doc.moveTo(margin + matrixNameW, topY).lineTo(margin + matrixNameW, bottomY).stroke();
    let x = margin + matrixNameW;
    for (let i = 0; i < 12; i += 1) {
      doc.moveTo(x, splitY).lineTo(x, bottomY).stroke();
      x += matrixSubW;
    }
    x = margin + matrixNameW;
    for (let i = 0; i < 6; i += 1) {
      x += (matrixSubW * 2);
      doc.moveTo(x, topY).lineTo(x, bottomY).stroke();
    }
    doc.moveTo(margin + matrixNameW, splitY).lineTo(margin + contentWidth, splitY).stroke();
    doc.restore();
    doc.save().strokeColor(COLORS.border).lineWidth(thickStroke);
    doc.moveTo(margin + matrixNameW, topY).lineTo(margin + matrixNameW, bottomY).stroke();
    x = margin + matrixNameW;
    for (let i = 1; i < 6; i += 1) {
      x += (matrixSubW * 2);
      doc.moveTo(x, topY).lineTo(x, bottomY).stroke();
    }
    doc.restore();

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(6.9)
      .text('Empreiteiro', margin + 2, yStart + ((matrixHeaderH - 8) / 2), {
        width: matrixNameW - 4,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });

    matrixDayDefs.forEach(([weekday, label], dayIndex) => {
      const dayX = margin + matrixNameW + (dayIndex * matrixSubW * 2);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(6.9)
        .text(label, dayX + 2, yStart + 3, {
          width: (matrixSubW * 2) - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(6.5)
        .text('Zona 1', dayX + 2, splitY + 3, {
          width: matrixSubW - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      doc.text('Zona 2', dayX + matrixSubW + 2, splitY + 3, {
        width: matrixSubW - 4,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    });

    return yStart + matrixHeaderH;
  };

  const buildMatrixMergeLookup = (rowsSlice) => {
    const lookup = new Map();
    const blocks = [];
    matrixDataColumns.forEach((col) => {
      const key = String(col.key || '');
      let idx = 0;
      while (idx < rowsSlice.length) {
        const startValue = String(rowsSlice[idx][key] || '').trim();
        const startGroup = String(rowsSlice[idx].__group || '');
        if (!startValue) {
          idx += 1;
          continue;
        }
        let end = idx;
        while (end + 1 < rowsSlice.length) {
          const nextValue = String(rowsSlice[end + 1][key] || '').trim();
          const nextGroup = String(rowsSlice[end + 1].__group || '');
          if (nextValue !== startValue || nextGroup !== startGroup) break;
          end += 1;
        }
        if (end > idx) {
          blocks.push({ key, start: idx, end });
          for (let i = idx; i <= end; i += 1) {
            lookup.set(`${key}|${i}`, { start: idx, end });
          }
        }
        idx = end + 1;
      }
    });
    return { lookup, blocks };
  };

  const drawMatrixGridSlice = (rowsSlice, yStart, globalStartIndex) => {
    const totalH = rowsSlice.length * matrixRowH;
    const colStarts = [];
    const colStartMap = new Map();
    let x = margin;
    matrixDataColumns.forEach((col) => {
      colStarts.push(x);
      colStartMap.set(String(col.key || ''), x);
      x += col.width;
    });
    const { lookup: mergeLookup, blocks: mergeBlocks } = buildMatrixMergeLookup(rowsSlice);
    const thickStroke = 1.15;
    const thinStroke = 0.5;

    rowsSlice.forEach((_, localIdx) => {
      const rowY = yStart + (localIdx * matrixRowH);
      const rowFill = ((globalStartIndex + localIdx) % 2 === 0) ? COLORS.rowA : COLORS.rowB;
      doc.save().fillColor(rowFill).rect(margin, rowY, contentWidth, matrixRowH).fill().restore();
    });

    // Force a single color across merged cells (avoid striped effect inside merged blocks).
    mergeBlocks.forEach((block) => {
      const col = matrixDataColumns.find((item) => item.key === block.key);
      if (!col) return;
      const cellX = colStartMap.get(String(block.key || ''));
      const cellY = yStart + (block.start * matrixRowH);
      const cellH = ((block.end - block.start) + 1) * matrixRowH;
      const blockFill = ((globalStartIndex + block.start) % 2 === 0) ? COLORS.rowA : COLORS.rowB;
      doc.save().fillColor(blockFill).rect(cellX, cellY, col.width, cellH).fill().restore();
    });

    doc.save().strokeColor(COLORS.border).lineWidth(0.55).rect(margin, yStart, contentWidth, totalH).stroke().restore();

    colStarts.slice(1).forEach((colX) => {
      doc.save().strokeColor(COLORS.border).lineWidth(thinStroke).moveTo(colX, yStart).lineTo(colX, yStart + totalH).stroke().restore();
    });

    // Strong vertical separators: between empreiteiro/day block and between weekdays.
    doc.save().strokeColor(COLORS.border).lineWidth(thickStroke);
    doc.moveTo(margin + matrixNameW, yStart).lineTo(margin + matrixNameW, yStart + totalH).stroke();
    x = margin + matrixNameW;
    for (let i = 1; i < 6; i += 1) {
      x += (matrixSubW * 2);
      doc.moveTo(x, yStart).lineTo(x, yStart + totalH).stroke();
    }
    doc.restore();

    const drawStrongContractorBoundary = (lineY) => {
      doc.save().strokeColor(COLORS.border).lineWidth(thickStroke)
        .moveTo(margin, lineY).lineTo(margin + contentWidth, lineY).stroke().restore();
    };

    for (let boundary = 1; boundary < rowsSlice.length; boundary += 1) {
      const prevGroup = String(rowsSlice[boundary - 1].__group || '');
      const nextGroup = String(rowsSlice[boundary].__group || '');
      if (prevGroup && nextGroup && prevGroup !== nextGroup) {
        const lineY = yStart + (boundary * matrixRowH);
        drawStrongContractorBoundary(lineY);
      }
    }

    for (let boundary = 1; boundary < rowsSlice.length; boundary += 1) {
      const lineY = yStart + (boundary * matrixRowH);
      matrixDataColumns.forEach((col, colIdx) => {
        const key = String(col.key || '');
        const merge = mergeLookup.get(`${key}|${boundary - 1}`) || null;
        const mergesAcrossBoundary = Boolean(merge && merge.end >= boundary);
        if (mergesAcrossBoundary) return;
        const prevGroup = String(rowsSlice[boundary - 1].__group || '');
        const nextGroup = String(rowsSlice[boundary].__group || '');
        if (prevGroup && nextGroup && prevGroup !== nextGroup) return;
        const x1 = colStarts[colIdx];
        const x2 = x1 + col.width;
        doc.save().strokeColor(COLORS.border).lineWidth(thinStroke).moveTo(x1, lineY).lineTo(x2, lineY).stroke().restore();
      });
    }

    rowsSlice.forEach((row, localIdx) => {
      matrixDataColumns.forEach((col, colIdx) => {
        const key = String(col.key || '');
        const rawText = String(row[key] || '');
        if (!rawText.trim()) return;
        const merge = mergeLookup.get(`${key}|${localIdx}`) || null;
        if (merge && merge.start !== localIdx) return;

        const spanStart = merge ? merge.start : localIdx;
        const spanEnd = merge ? merge.end : localIdx;
        const cellY = yStart + (spanStart * matrixRowH);
        const cellH = ((spanEnd - spanStart) + 1) * matrixRowH;
        const cellX = colStarts[colIdx];
        const cellW = col.width;
        const textH = doc.heightOfString(rawText, { width: cellW - 4, lineBreak: false });
        const textY = cellY + ((cellH - Math.min(textH, cellH - 4)) / 2);
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(6.5)
          .text(rawText, cellX + 2, textY, {
            width: cellW - 4,
            align: 'center',
            lineBreak: false,
            ellipsis: true,
          });
      });
    });
  };

  doc.addPage();
  y = drawPpcPageHeader();
  y = drawMatrixSectionTitle(y);
  y = drawMatrixHeader(y);
  if (!zoneMatrixRows.length) {
    drawMatrixGridSlice([emptyMatrixRow], y, 0);
  } else {
    let cursor = 0;
    while (cursor < zoneMatrixRows.length) {
      const available = pageBottom() - 10 - y;
      const rowsFit = Math.max(1, Math.floor(available / matrixRowH));
      const slice = zoneMatrixRows.slice(cursor, cursor + rowsFit);
      drawMatrixGridSlice(slice, y, cursor);
      cursor += slice.length;
      if (cursor < zoneMatrixRows.length) {
        doc.addPage();
        y = drawPpcPageHeader();
        y = drawMatrixSectionTitle(y);
        y = drawMatrixHeader(y);
      }
    }
  }

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    const pageNumber = i + 1;
    doc.switchToPage(pages.start + i);
    const footerY = doc.page.height - margin - 10;
    doc.fillColor('#35597a').font('Helvetica').fontSize(8)
      .text(`${pageNumber}/${pages.count}`, margin, footerY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
  }

  doc.end();
}));

router.get('/weeks/:weekId/tasks/export/attendance/pdf', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  if (!PDFDocument) {
    return res.status(500).json({ error: 'pdf_dependency_missing' });
  }
  if (req.workRoles.has(ROLES.CONTRACTOR) && ![...req.workRoles].some((r) => PRIVILEGED.has(r))) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    include: {
      work: true,
      planningClosedBy: { select: { name: true } },
    },
  });
  if (!week) return res.status(404).json({ error: 'week_not_found' });
  if (String(week.planningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'planning_not_closed' });
  }

  const tasks = await prisma.task.findMany({
    where: { currentWeekId: req.week.id },
    include: {
      contractor: { include: { function: true } },
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  const appConfig = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  const printedAt = new Date();
  const fileName = `PPC-Semana${week.weekNumber}-Ata-Reunião.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 34, size: 'A4', bufferPages: true });
  doc.pipe(res);
  const tz = inferBrazilTimeZoneFromWork(week.work);
  const printedAtText = formatDateTimeBrInTimeZone(printedAt, tz);
  const closedAtText = formatDateTimeBrInTimeZone(week.planningClosedAt, tz);
  const companyWebsite = appConfig?.companySite || appConfig?.companyWebsite || appConfig?.website || appConfig?.site || 'A cadastrar';
  const companyStreetNumber = [appConfig?.companyStreet, appConfig?.companyNumber].filter(Boolean).join(', ');
  const companyComplement = String(appConfig?.companyComplement || '').trim();
  const companyCityState = [appConfig?.companyCity, appConfig?.companyState].filter(Boolean).join('/');
  let companyAddressCompact = [
    companyStreetNumber ? `${companyStreetNumber}${companyComplement ? `, ${companyComplement}` : ''}` : '',
    companyCityState,
  ].filter(Boolean).join(' - ');
  if (!companyAddressCompact) {
    const rawAddress = String(appConfig?.companyAddress || '').trim();
    const parts = rawAddress
      .split(' - ')
      .map((item) => String(item || '').trim())
      .filter((item) => item && !/^CEP\b/i.test(item));
    if (parts.length >= 2) {
      companyAddressCompact = `${parts[0]} - ${parts[parts.length - 1]}`;
    } else {
      companyAddressCompact = rawAddress;
    }
  }
  if (!companyAddressCompact) companyAddressCompact = 'Não cadastrado';

  const activeContractors = [...new Map(
    tasks
      .filter((task) => task.contractor?.id)
      .map((task) => [Number(task.contractor.id), String(task.contractor.name || '-')]),
  ).values()]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const COLORS = {
    border: '#b7cfe8',
    box: '#f2f8ff',
    boxStrong: '#dcebff',
    title: '#c8def8',
    text: '#1e3c59',
    rowA: '#f7fbff',
    rowB: '#eaf3ff',
    header: '#d4e6fb',
  };

  const margin = 34;
  const pageBottom = () => doc.page.height - margin;
  const contentWidth = doc.page.width - (margin * 2);

  const drawRoundBox = (x, y, w, h, fill = COLORS.box, stroke = COLORS.border, radius = 8) => {
    doc
      .save()
      .fillColor(fill)
      .strokeColor(stroke)
      .lineWidth(0.7)
      .roundedRect(x, y, w, h, radius)
      .fillAndStroke()
      .restore();
  };

  const drawInfoBox = ({
    x, y, w, h, label, value, valueAlign = 'left', compact = true,
  }) => {
    drawRoundBox(x, y, w, h);
    if (compact) {
      const labelText = `${String(label || '').trim()}:`;
      const labelX = x + 8;
      const lineY = y + ((h - 10) / 2);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.1)
        .text(labelText, labelX, lineY, { lineBreak: false });
      const labelWidth = doc.widthOfString(labelText) + 6;
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.3)
        .text(String(value || '-'), labelX + labelWidth, lineY, {
          width: w - 16 - labelWidth,
          align: valueAlign,
          lineBreak: false,
          ellipsis: true,
        });
      return;
    }
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.5)
      .text(String(label || ''), x + 8, y + 5, { width: w - 16, lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
      .text(String(value || '-'), x + 8, y + 16, { width: w - 16, align: valueAlign, lineBreak: false, ellipsis: true });
  };

  const drawTitleStrip = (y, text) => {
    const h = 28;
    drawRoundBox(margin, y, contentWidth, h, COLORS.title, COLORS.border);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
      .text(String(text || ''), margin, y + 8, { width: contentWidth, align: 'center', lineBreak: false });
    return y + h + 6;
  };

  const drawCommonHeader = () => {
    let y = margin;
    const logoW = 98;
    const logoH = 64;
    const gap = 8;
    const rightX = margin + logoW + gap;
    const rightW = contentWidth - logoW - gap;
    const rowH = 26;
    const topHeaderH = Math.max(logoH, (rowH * 2) + 20);

    drawRoundBox(margin, y, logoW, logoH);
    let logoRendered = false;
    if (appConfig?.logoPath) {
      try {
        const logoDataUrl = String(appConfig.logoPath || '').trim();
        if (logoDataUrl.startsWith('data:image/')) {
          const logoBuffer = decodeImageDataUrl(logoDataUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
            logoRendered = true;
          }
        } else if (fs.existsSync(appConfig.logoPath)) {
          doc.image(appConfig.logoPath, margin + 6, y + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
          logoRendered = true;
        }
      } catch {
        logoRendered = false;
      }
    }
    if (!logoRendered) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text('LOGO', margin, y + 25, { width: logoW, align: 'center' });
    }

    drawRoundBox(rightX, y, rightW, rowH);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
      .text(String(appConfig?.companyName || 'Não cadastrado'), rightX + 8, y + 7, {
        width: rightW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    const secondRowH = 30;
    const secondRowY = y + logoH - secondRowH;
    const cnpjW = 136;
    const addrGap = 4;
    const addrX = rightX + cnpjW + addrGap;
    const addrW = rightW - cnpjW - addrGap;
    drawInfoBox({
      x: rightX,
      y: secondRowY,
      w: cnpjW,
      h: secondRowH,
      label: 'CNPJ',
      value: appConfig?.companyCnpj || 'Não cadastrado',
      compact: true,
    });
    drawRoundBox(addrX, secondRowY, addrW, secondRowH);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.2)
      .text(String(companyAddressCompact), addrX + 8, secondRowY + 6, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(7.0)
      .text(String(companyWebsite), addrX + 8, secondRowY + 18, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    y += topHeaderH + 8;
    y = drawTitleStrip(y, `PPC - Semana ${week.weekNumber} | ${formatDateBr(week.startDate)} a ${formatDateBr(week.endDate)}`);

    drawInfoBox({
      x: margin,
      y,
      w: contentWidth,
      h: 22,
      label: 'Obra',
      value: week.work?.name || '-',
      compact: true,
    });
    y += 26;
    drawInfoBox({
      x: margin,
      y,
      w: contentWidth,
      h: 22,
      label: 'Endereço da obra',
      value: `${week.work?.address || '-'} | CEP ${week.work?.cep || '-'}`,
      compact: true,
    });
    y += 28;

    drawRoundBox(margin, y, contentWidth, 42);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.8)
      .text(
        `Fechamento do planejamento: ${closedAtText || '-'}${week.planningClosedBy?.name ? ` por ${week.planningClosedBy.name}` : ''}`,
        margin + 8,
        y + 8,
        { width: contentWidth - 16, lineBreak: false },
      );
    doc.text(`Documento impresso em: ${printedAtText || '-'}`, margin + 8, y + 24, { width: contentWidth - 16, lineBreak: false });
    y += 48;
    return y;
  };

  const drawAtaStrip = (yStart) => {
    drawRoundBox(margin, yStart, contentWidth, 30, COLORS.boxStrong, COLORS.border, 7);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(11.5)
      .text('ATA DE PRESENÇA', margin, yStart + 9, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
    return yStart + 36;
  };

  const drawMeetingBoxes = (yStart) => {
    const gap = 8;
    const halfW = (contentWidth - gap) / 2;
    const leftX = margin;
    const rightX = margin + halfW + gap;
    const boxH = 38;
    drawRoundBox(leftX, yStart, halfW, boxH, COLORS.box, COLORS.border, 7);
    drawRoundBox(rightX, yStart, halfW, boxH, COLORS.box, COLORS.border, 7);

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.6)
      .text('Data da reunião:', leftX + 8, yStart + 13, { width: halfW - 16, align: 'left', lineBreak: false });
    const leftLabelW = doc.widthOfString('Data da reunião:') + 8;
    doc.save().strokeColor('#7f9ec0').lineWidth(0.8)
      .moveTo(leftX + 8 + leftLabelW, yStart + 23).lineTo(leftX + halfW - 8, yStart + 23).stroke().restore();

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.6)
      .text('Responsável pela reunião:', rightX + 8, yStart + 13, { width: halfW - 16, align: 'left', lineBreak: false });
    const rightLabelW = doc.widthOfString('Responsável pela reunião:') + 8;
    doc.save().strokeColor('#7f9ec0').lineWidth(0.8)
      .moveTo(rightX + 8 + rightLabelW, yStart + 23).lineTo(rightX + halfW - 8, yStart + 23).stroke().restore();

    return yStart + boxH + 10;
  };

  const tableColumns = [
    { key: 'seq', title: '#', width: 24 },
    { key: 'contractor', title: 'Empreiteiro', width: 180 },
    { key: 'present', title: 'Responsável presente', width: 118 },
    { key: 'role', title: 'Cargo', width: 120 },
    { key: 'signature', title: 'Assinatura', width: contentWidth - (24 + 180 + 118 + 120) },
  ];
  const tableHeaderH = 22;
  const tableRowH = 28;

  const drawTableHeader = (yStart) => {
    drawRoundBox(margin, yStart, contentWidth, tableHeaderH, COLORS.header, COLORS.border, 4);
    let x = margin;
    tableColumns.forEach((col, idx) => {
      const textH = doc.heightOfString(col.title, { width: col.width - 4, lineBreak: false });
      const textY = yStart + ((tableHeaderH - Math.min(textH, tableHeaderH - 4)) / 2);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.3)
        .text(col.title, x + 2, textY, {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, yStart).lineTo(x, yStart + tableHeaderH).stroke().restore();
      }
      x += col.width;
    });
    return yStart + tableHeaderH;
  };

  const drawTableRow = (row, yStart, idx) => {
    drawRoundBox(margin, yStart, contentWidth, tableRowH, idx % 2 === 0 ? COLORS.rowA : COLORS.rowB, COLORS.border, 3);
    let x = margin;
    tableColumns.forEach((col, colIdx) => {
      if (colIdx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(x, yStart).lineTo(x, yStart + tableRowH).stroke().restore();
      }
      const text = String(row[col.key] || '');
      const textH = doc.heightOfString(text, { width: col.width - 6, lineBreak: false });
      const textY = yStart + ((tableRowH - Math.min(textH, tableRowH - 6)) / 2);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.2)
        .text(text, x + 3, textY, {
          width: col.width - 6,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    return yStart + tableRowH;
  };

  let y = drawCommonHeader();
  y = drawAtaStrip(y);
  y = drawMeetingBoxes(y);
  y = drawTableHeader(y);

  if (!activeContractors.length) {
    y = drawTableRow({
      seq: '-',
      contractor: 'Sem empreiteiros ativos na semana.',
      present: '',
      role: '',
      signature: '',
    }, y, 0);
  } else {
    activeContractors.forEach((name, idx) => {
      if (y + tableRowH > pageBottom() - 12) {
        doc.addPage();
        y = drawCommonHeader();
        y = drawAtaStrip(y);
        y = drawTableHeader(y);
      }
      y = drawTableRow({
        seq: String(idx + 1),
        contractor: name,
        present: '',
        role: '',
        signature: '',
      }, y, idx);
    });
  }

  const signerBoxH = 36;
  if (y + signerBoxH + 10 > pageBottom() - 12) {
    doc.addPage();
    y = drawCommonHeader();
    y = drawAtaStrip(y);
  } else {
    y += 8;
  }
  drawRoundBox(margin, y, contentWidth, signerBoxH, COLORS.boxStrong, COLORS.border, 7);
  doc.save().strokeColor('#7f9ec0').lineWidth(0.8)
    .moveTo(margin + (contentWidth * 0.26), y + 21)
    .lineTo(margin + (contentWidth * 0.74), y + 21)
    .stroke()
    .restore();
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.1)
    .text('Responsável pela ata', margin + 8, y + 24, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    const pageNumber = i + 1;
    doc.switchToPage(pages.start + i);
    const footerY = doc.page.height - margin - 10;
    doc.fillColor('#35597a').font('Helvetica').fontSize(8)
      .text(`${pageNumber}/${pages.count}`, margin, footerY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
  }

  doc.end();
}));

router.post('/weeks/:weekId/tasks/import/xlsx', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const phase = String(req.query.phase || '').trim().toLowerCase();
  const isPrePhase = ['pre', 'preprogramacao', 'pre-programacao', 'pre_programacao'].includes(phase);
  if (isPrePhase) {
    const prePlanningOpen = await ensurePrePlanningOpen(req.week.id);
    if (!prePlanningOpen) return res.status(409).json({ error: 'pre_planning_closed' });
  } else {
    const planningGate = await ensurePlanningEditable(req.week.id);
    if (!planningGate.ok) return res.status(409).json({ error: planningGate.error });
  }

  const fileBase64 = String(req.body.fileBase64 || '').trim();
  if (!fileBase64) return res.status(400).json({ error: 'fileBase64_required' });
  let workbook = null;
  try {
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  } catch {
    return res.status(400).json({ error: 'invalid_excel_file' });
  }
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return res.status(400).json({ error: 'sheet_not_found' });
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) return res.status(400).json({ error: 'no_rows_to_import' });

  const contractors = await prisma.contractor.findMany({
    where: { workId: req.workId },
    include: { function: true },
  });
  const contractorByName = new Map(contractors.map((item) => [String(item.name || '').trim().toLowerCase(), item]));

  const weekDays = await prisma.weekWeatherDay.findMany({
    where: { weekId: req.week.id },
    orderBy: { dayDate: 'asc' },
  });
  const weekDayDate = new Map(weekDays.map((item) => [String(item.weekday || '').toUpperCase(), item.dayDate]));

  const maxSeq = await (isPrePhase ? prisma.preTask.findFirst({
    where: { weekId: req.week.id },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  }) : prisma.task.findFirst({
    where: { currentWeekId: req.week.id },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  }));
  let seq = (maxSeq?.sequenceNumber || 0) + 1;
  let createdCount = 0;

  const dayColumns = [
    ['Seg', 'MONDAY'],
    ['Ter', 'TUESDAY'],
    ['Qua', 'WEDNESDAY'],
    ['Qui', 'THURSDAY'],
    ['Sex', 'FRIDAY'],
    ['Sáb', 'SATURDAY'],
  ];
  const allowedWeekdays = new Set(dayColumns.map(([, weekday]) => weekday));

  for (const row of rows) {
    const description = String(row.Tarefa || row.Descrição || row.DESCRICAO || '').trim();
    if (!description) continue;

    const contractorRaw = String(row.Empreiteiro || row.EMPREITEIRO || '').trim();
    const contractorName = contractorRaw.includes('(')
      ? contractorRaw.split('(')[0].trim()
      : contractorRaw;
    const contractor = contractorByName.get(contractorName.toLowerCase()) || null;

    const supervisorFromRow = String(row.Encarregado || row.ENCARREGADO || '').trim();
    const supervisor = supervisorFromRow || (contractor ? parseContractorSupervisor(contractor.contact) : '') || null;

    const locationLevel1 = String(row['Local Nível 1'] || row['Local Nivel 1'] || row.LOCAL_NIVEL_1 || '').trim();
    const locationLevel2 = String(row['Local Nível 2'] || row['Local Nivel 2'] || row.LOCAL_NIVEL_2 || '').trim();
    const resolvedLocationId = locationLevel1
      ? await findOrCreateLocation(req.workId, locationLevel1, locationLevel2 || null)
      : null;

    let plannedDays = dayColumns
      .filter(([label]) => parseBooleanCell(row[label]))
      .map(([, weekday]) => ({
        weekday,
        plannedDate: weekDayDate.get(weekday) || null,
      }));

    let plannedStart = parseDate(String(row['Início previsto'] || row['Inicio previsto'] || row.INICIO_PREVISTO || '').trim());
    let plannedEnd = parseDate(String(row['Fim previsto'] || row.FIM_PREVISTO || '').trim());

    if (!plannedDays.length && plannedStart && plannedEnd) {
      const start = new Date(plannedStart);
      const end = new Date(plannedEnd);
      plannedDays = weekDays
        .filter((item) => item.dayDate >= start && item.dayDate <= end && allowedWeekdays.has(String(item.weekday || '').toUpperCase()))
        .map((item) => ({ weekday: item.weekday, plannedDate: item.dayDate }));
    }

    if ((!plannedStart || !plannedEnd) && plannedDays.length) {
      const dates = plannedDays.map((item) => item.plannedDate).filter(Boolean).sort((a, b) => a - b);
      if (dates.length) {
        plannedStart = plannedStart || dates[0];
        plannedEnd = plannedEnd || dates[dates.length - 1];
      }
    }

    let originWeekId = req.week.id;
    const originWeekNumber = parseIntId(row['Semana origem'] || row['Sem. origem'] || row.SEMANA_ORIGEM);
    if (originWeekNumber) {
      const originWeek = await prisma.week.findUnique({
        where: { workId_weekNumber: { workId: req.workId, weekNumber: originWeekNumber } },
        select: { id: true },
      });
      if (originWeek) originWeekId = originWeek.id;
    }

    const sequenceNumber = parseIntId(row['#']) || seq;
    if (sequenceNumber >= seq) seq = sequenceNumber + 1;
    const importedStatus = normalizePlanningTaskStatusInput(row.Status || row.STATUS || '');

    if (isPrePhase) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.preTask.create({
        data: {
          sequenceNumber,
          originWeekId,
          weekId: req.week.id,
          contractorId: contractor?.id || null,
          supervisor,
          locationId: resolvedLocationId,
          description,
          plannedStart: plannedStart || null,
          plannedEnd: plannedEnd || null,
          status: importedStatus,
          plannedDays: {
            create: plannedDays.map((item) => ({
              weekday: String(item.weekday || '').toUpperCase(),
              plannedDate: item.plannedDate || null,
            })),
          },
        },
      });
    } else {
      // eslint-disable-next-line no-await-in-loop
      await prisma.task.create({
        data: {
          sequenceNumber,
          originWeekId,
          currentWeekId: req.week.id,
          contractorId: contractor?.id || null,
          supervisor,
          locationId: resolvedLocationId,
          description,
          plannedStart: plannedStart || null,
          plannedEnd: plannedEnd || null,
          status: importedStatus,
          plannedDays: {
            create: plannedDays.map((item) => ({
              weekday: String(item.weekday || '').toUpperCase(),
              plannedDate: item.plannedDate || null,
            })),
          },
        },
      });
    }
    createdCount += 1;
  }

  if (isPrePhase) {
    await resequencePrePlanningTasksForWeek(req.week.id);
  } else {
    await resequencePlanningTasksForWeek(req.week.id);
  }

  return res.json({ createdCount });
}));

module.exports = router;
