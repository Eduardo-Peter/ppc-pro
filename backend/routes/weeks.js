const { Router } = require('express');
const { prisma } = require('../lib/prisma');
const { writeAudit } = require('../lib/audit');
const { ROLES, TASK_STATUS, WEEK_STATUS } = require('../lib/constants');
const {
  asyncHandler,
  parseIntId,
  parseDate,
  normalizeFeedbackStatus,
  normalizeTaskStatus,
  toWeekdayRows,
  summarizeWeek,
} = require('../lib/helpers');
const { authenticate, loadUser, requireWorkRoles, requireWeekRoles } = require('../lib/auth');
let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
} catch {
  PDFDocument = null;
}

const router = Router();
const CAUSE_SPLITTER = '::';
const CAUSE_L2_PREFIX = 'L2::';
const CAUSE_L2_CONTRACTOR_PREFIX = 'L2C::';

function weekWeatherDayFieldSet() {
  const fields = new Set();
  try {
    const runtimeFields = prisma?._runtimeDataModel?.models?.WeekWeatherDay?.fields || [];
    runtimeFields.forEach((field) => fields.add(field.name));
  } catch {
    // no-op
  }
  try {
    const dmmfFields = prisma?._dmmf?.modelMap?.WeekWeatherDay?.fields || [];
    dmmfFields.forEach((field) => fields.add(field.name));
  } catch {
    // no-op
  }
  return fields;
}

const WEEK_WEATHER_DAY_FIELDS = weekWeatherDayFieldSet();
const SUPPORTS_PRECIPITATION_FIELDS = (
  WEEK_WEATHER_DAY_FIELDS.has('precipitationMm')
  && WEEK_WEATHER_DAY_FIELDS.has('precipitationProbabilityPct')
);

function withPrecipitation(payload, source = null) {
  if (!SUPPORTS_PRECIPITATION_FIELDS) return payload;
  return {
    ...payload,
    precipitationMm: source?.precipitationMm ?? source?.precipitationSum ?? null,
    precipitationProbabilityPct: source?.precipitationProbabilityPct ?? source?.precipitationProbabilityMax ?? null,
  };
}

function parseCauseDescription(description) {
  const text = String(description || '').trim();
  if (!text) {
    return {
      level: 1,
      category: '',
      cause: '',
      label: '',
      contractorSpecific: false,
    };
  }
  const isContractorSpecific = text.startsWith(CAUSE_L2_CONTRACTOR_PREFIX);
  if (text.startsWith(CAUSE_L2_PREFIX) || isContractorSpecific) {
    const rest = text.slice((isContractorSpecific ? CAUSE_L2_CONTRACTOR_PREFIX : CAUSE_L2_PREFIX).length).trim();
    const idx = rest.indexOf(CAUSE_SPLITTER);
    if (idx < 0) {
      return {
        level: 2,
        category: 'Geral',
        cause: rest,
        label: rest,
        contractorSpecific: isContractorSpecific,
      };
    }
    const category = rest.slice(0, idx).trim() || 'Geral';
    const cause = rest.slice(idx + CAUSE_SPLITTER.length).trim() || '';
    return {
      level: 2,
      category,
      cause,
      label: `${category} - ${cause}`,
      contractorSpecific: isContractorSpecific,
    };
  }
  return {
    level: 1,
    category: text,
    cause: '',
    label: text,
    contractorSpecific: false,
  };
}

function mapWeatherCodeToIcon(code, precipitationProbability = null, precipitationSum = null) {
  const c = Number(code);
  if (!Number.isFinite(c)) return 'CLOUDY';
  const rainCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
  const stormCodes = [95, 96, 99];
  const probability = Number(precipitationProbability);
  const rainMm = Number(precipitationSum);
  const hasProb = Number.isFinite(probability);
  const hasRainMm = Number.isFinite(rainMm);
  const prob = hasProb ? probability : 0;
  const mm = hasRainMm ? rainMm : 0;

  // Regra dura: com chuva acumulada zero, não mostra ícone de chuva/temporal.
  if (hasRainMm && mm <= 0) {
    if (c === 0 || c === 1 || c === 2) return 'SUNNY';
    return 'CLOUDY';
  }

  if (stormCodes.includes(c)) {
    if (prob >= 65 || mm >= 6) return 'STORM';
    if (prob >= 45 || mm >= 3) return 'RAIN';
    return 'CLOUDY';
  }

  if (c === 0 || c === 1) return 'SUNNY';
  if (c === 2) return 'SUNNY';
  if (c === 3) {
    if (prob <= 5 && mm === 0) return 'SUNNY';
    return 'CLOUDY';
  }

  if (rainCodes.includes(c)) {
    if ((prob >= 30 && mm >= 3) || prob >= 60 || mm >= 5) return 'RAIN';
    return 'CLOUDY';
  }

  if ([45, 48].includes(c)) return 'CLOUDY';
  return 'CLOUDY';
}

function parseIsoDateKey(raw) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw || '').trim());
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function dateKeyStable(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const key = parseIsoDateKey(dateInput);
    if (key) return key;
  }
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function dateFromKeyLocal(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
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

function startOfDayLocal(dateInput) {
  const key = dateKeyStable(dateInput);
  const fromKey = dateFromKeyLocal(key);
  if (fromKey) return fromKey;
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function nextMondayAfterDate(dateInput) {
  const date = startOfDayLocal(dateInput);
  const day = date.getDay(); // 0=Dom, 1=Seg
  let diff = (8 - day) % 7;
  if (diff === 0) diff = 7;
  date.setDate(date.getDate() + diff);
  return date;
}

function calculateWeek1EndDate(week1StartDate) {
  const endDate = new Date(week1StartDate);
  const day = endDate.getDay(); // 0=Dom ... 6=Sab

  const toSaturday = (6 - day + 7) % 7;
  endDate.setDate(endDate.getDate() + toSaturday);

  const week2Start = nextMondayAfterDate(week1StartDate);
  if (endDate.getTime() >= week2Start.getTime()) {
    endDate.setTime(week2Start.getTime());
    endDate.setDate(endDate.getDate() - 1);
  }

  return endDate;
}

function calculateWeekPeriod(workStartDate, weekNumber) {
  const normalizedWeekNumber = Math.max(1, Number.parseInt(weekNumber, 10) || 1);
  const week1Start = startOfDayLocal(workStartDate);
  let startDate = new Date(week1Start);

  if (normalizedWeekNumber >= 2) {
    const week2Start = nextMondayAfterDate(week1Start);
    startDate = new Date(week2Start);
    startDate.setDate(startDate.getDate() + ((normalizedWeekNumber - 2) * 7));
  }

  let endDate;
  if (normalizedWeekNumber === 1) {
    endDate = calculateWeek1EndDate(startDate);
  } else {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5); // sábado sempre incluído
  }
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate, year: startDate.getFullYear() };
}

async function findOrCreateLocation(workId, level1, level2) {
  const l1 = String(level1 || '').trim();
  const l2 = String(level2 || '').trim();
  if (!l1) return null;
  if (!l2) {
    const level1Marker = `__ZONE_L1__::${l1}`;
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

function normalizeWeekday(value) {
  const key = String(value || '').trim().toUpperCase();
  const allowed = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']);
  if (!allowed.has(key)) return null;
  return key;
}

function normalizePlanningTaskStatusForCopy(value) {
  const status = normalizeTaskStatus(value);
  if (status === TASK_STATUS.RETRABALHO) return TASK_STATUS.RETRABALHO;
  if (status === TASK_STATUS.RESERVA) return TASK_STATUS.RESERVA;
  return TASK_STATUS.PLANNED;
}

async function ensureWeekExistsForWork(workId, workStartDate, weekNumber) {
  const normalizedWeekNumber = Math.max(1, Number.parseInt(weekNumber, 10) || 1);
  const existing = await prisma.week.findUnique({
    where: { workId_weekNumber: { workId, weekNumber: normalizedWeekNumber } },
  });
  if (existing) return existing;

  const { startDate, endDate, year } = calculateWeekPeriod(workStartDate, normalizedWeekNumber);

  try {
    return await prisma.week.create({
      data: {
        workId,
        weekNumber: normalizedWeekNumber,
        year,
        startDate,
        endDate,
        prePlanningStatus: WEEK_STATUS.OPEN,
        planningStatus: WEEK_STATUS.OPEN,
        feedbackStatus: WEEK_STATUS.OPEN,
        qualityStatus: WEEK_STATUS.OPEN,
        weatherDays: { create: weatherRowsWithSunday(startDate, endDate) },
      },
    });
  } catch {
    return prisma.week.findUnique({
      where: { workId_weekNumber: { workId, weekNumber: normalizedWeekNumber } },
    });
  }
}

async function rollPendingTasksToNextWeek(sourceWeek, nextWeek) {
  if (!sourceWeek?.id || !nextWeek?.id) return { rolledCount: 0, rolledTaskIds: [] };

  const pending = await prisma.task.findMany({
    where: {
      currentWeekId: sourceWeek.id,
      status: { in: [TASK_STATUS.PLANNED, TASK_STATUS.IN_PROGRESS, TASK_STATUS.RETRABALHO, TASK_STATUS.RESERVA] },
    },
    include: {
      plannedDays: true,
      rolledToTasks: { where: { currentWeekId: nextWeek.id }, select: { id: true } },
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  const toRoll = pending.filter((item) => item.rolledToTasks.length === 0);
  if (!toRoll.length) return { rolledCount: 0, rolledTaskIds: [] };

  const maxSeq = await prisma.preTask.findFirst({
    where: { weekId: nextWeek.id },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  let seq = (maxSeq?.sequenceNumber || 0) + 1;
  const created = [];

  for (const item of toRoll) {
    const normalizedStatus = normalizePlanningTaskStatusForCopy(item.status);
    // Evita duplicar pendência quando já existe cópia equivalente na pré-programação da semana destino.
    // Isso cobre casos de execução manual de rollover em semanas já processadas.
    // eslint-disable-next-line no-await-in-loop
    const alreadyExists = await prisma.preTask.findFirst({
      where: {
        weekId: nextWeek.id,
        originWeekId: item.originWeekId,
        contractorId: item.contractorId,
        locationId: item.locationId,
        description: item.description,
        plannedStart: item.plannedStart,
        plannedEnd: item.plannedEnd,
        status: normalizedStatus,
      },
      select: { id: true },
    });
    if (alreadyExists) continue;

    // eslint-disable-next-line no-await-in-loop
    const task = await prisma.preTask.create({
      data: {
        sequenceNumber: seq++,
        originWeekId: item.originWeekId,
        weekId: nextWeek.id,
        contractorId: item.contractorId,
        supervisor: item.supervisor,
        locationId: item.locationId,
        description: item.description,
        plannedStart: item.plannedStart,
        plannedEnd: item.plannedEnd,
        status: normalizedStatus,
        plannedDays: {
          create: item.plannedDays.map((day) => ({
            weekday: day.weekday,
            plannedDate: day.plannedDate,
          })),
        },
      },
      select: { id: true },
    });
    created.push(task.id);
  }

  return { rolledCount: created.length, rolledTaskIds: created };
}

async function countPlanningTasksWithoutLocationLevel1(weekId) {
  const rows = await prisma.task.findMany({
    where: {
      currentWeekId: weekId,
    },
    select: {
      locationId: true,
      location: { select: { level1: true } },
    },
  });
  return rows.filter((item) => {
    if (!item.locationId) return true;
    const level1 = String(item.location?.level1 || '').trim();
    return !level1 || level1 === '-';
  }).length;
}

async function countPrePlanningTasksWithoutLocationLevel1(weekId) {
  const rows = await prisma.preTask.findMany({
    where: {
      weekId,
    },
    select: {
      locationId: true,
      location: { select: { level1: true } },
    },
  });
  return rows.filter((item) => {
    if (!item.locationId) return true;
    const level1 = String(item.location?.level1 || '').trim();
    return !level1 || level1 === '-';
  }).length;
}

function weatherRowsWithSunday(startDate, endDate) {
  const rows = toWeekdayRows(startDate, endDate);
  const monday = new Date(startDate);
  monday.setHours(0, 0, 0, 0);
  if (monday.getDay() !== 1) return rows;
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() - 1);
  rows.unshift({
    dayDate: sunday,
    weekday: 'SUNDAY',
    icon: 'CLOUDY',
  });
  return rows;
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

function parseDateTimeInput(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addDays(dateInput, days) {
  const date = new Date(dateInput);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
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

function formatDateBr(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function inferBrazilTimeZoneFromWork(work) {
  const address = String(work?.address || '');
  const ufMatch = /\/([A-Z]{2})(?:\)|$)/i.exec(address);
  const uf = String(ufMatch?.[1] || '').trim().toUpperCase();
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
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  try {
    return date.toLocaleString('pt-BR', { timeZone });
  } catch {
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
}

function round2(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(2));
}

function sanitizeFileName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
    || 'sem-nome';
}

function normalizeQualityScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < 0 || num > 10) return null;
  return num;
}

function classifyByThreshold(value, regular, good) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '-';
  if (score >= good) return 'Bom';
  if (score >= regular) return 'Regular';
  return 'Ruim';
}

function feedbackLikeStatus(task, feedbackStatus) {
  const fb = String(feedbackStatus || '').toUpperCase();
  if (fb === 'EXECUTED' || fb === 'EXECUTED_UNPLANNED') return 'EXECUTED';
  if (fb === 'STARTED') return 'STARTED';
  if (fb === 'NOT_STARTED') return 'NOT_STARTED';
  if (fb === 'CANCELLED') return 'CANCELLED';
  const taskStatus = String(task?.status || '').toUpperCase();
  if (taskStatus === TASK_STATUS.EXECUTED) return 'EXECUTED';
  if (taskStatus === TASK_STATUS.IN_PROGRESS) return 'STARTED';
  if (taskStatus === TASK_STATUS.CANCELLED) return 'CANCELLED';
  return 'NOT_STARTED';
}

async function listPlanningContractorsByWeek(weekId, workId) {
  const rows = await prisma.task.findMany({
    where: {
      currentWeekId: weekId,
      contractorId: { not: null },
    },
    include: {
      contractor: {
        include: { function: true },
      },
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  const byId = new Map();
  rows.forEach((item) => {
    const contractor = item.contractor;
    if (!contractor?.id) return;
    if (Number(contractor.workId) !== Number(workId)) return;
    if (!byId.has(contractor.id)) byId.set(contractor.id, contractor);
  });

  return [...byId.values()]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

async function computeDeadlineMetricsByContractor(weekId) {
  const tasks = await prisma.task.findMany({
    where: {
      currentWeekId: weekId,
      contractorId: { not: null },
    },
    include: {
      feedbacks: {
        where: { weekId },
        include: { cause: { select: { description: true } } },
      },
    },
  });

  const map = new Map();

  tasks.forEach((task) => {
    const contractorId = Number(task.contractorId);
    if (!contractorId) return;
    if (!map.has(contractorId)) {
      map.set(contractorId, {
        planned: 0,
        executed: 0,
        started: 0,
        notStarted: 0,
        cancelled: 0,
        unplannedExecuted: 0,
        considered: 0,
        contractorSpecificNonCompliance: 0,
        ppcPct: 0,
      });
    }
    const row = map.get(contractorId);

    const feedbackStatus = task.feedbacks?.[0]?.status || null;
    const normalized = feedbackLikeStatus(task, feedbackStatus);

    if (task.isUnplanned === true) {
      if (normalized === 'EXECUTED') row.unplannedExecuted += 1;
      return;
    }

    const isReserve = String(task.status || '').toUpperCase() === 'RESERVA';
    const isExecutedOutcome = (
      String(task.status || '').toUpperCase() === TASK_STATUS.EXECUTED
      || normalized === 'EXECUTED'
      || normalized === 'EXECUTED_UNPLANNED'
    );
    if (isReserve && !isExecutedOutcome) return;

    row.planned += 1;
    if (normalized === 'CANCELLED' || String(task.status || '').toUpperCase() === TASK_STATUS.CANCELLED) {
      row.cancelled += 1;
    } else if (normalized === 'EXECUTED' || String(task.status || '').toUpperCase() === TASK_STATUS.EXECUTED) {
      row.executed += 1;
    } else if (normalized === 'STARTED' || String(task.status || '').toUpperCase() === TASK_STATUS.IN_PROGRESS) {
      row.started += 1;
    } else {
      row.notStarted += 1;
    }

    const isNotExecuted = !(normalized === 'EXECUTED' || String(task.status || '').toUpperCase() === TASK_STATUS.EXECUTED);
    if (isNotExecuted) {
      const parsed = parseCauseDescription(task.feedbacks?.[0]?.cause?.description || '');
      if (parsed.contractorSpecific) row.contractorSpecificNonCompliance += 1;
    }
  });

  map.forEach((row) => {
    row.considered = row.executed + row.started + row.notStarted;
    if (row.planned > 0) {
      const nonCompliancePct = (row.contractorSpecificNonCompliance / row.planned) * 100;
      row.ppcPct = Math.max(0, round2(100 - nonCompliancePct));
    } else {
      row.ppcPct = 0;
    }
  });

  return map;
}

function computePerceivedQualityRow({
  item,
  contractor,
  config,
  metric,
  presenceScore,
}) {
  const deadlineRegular = Number(config?.deadlineRegularPct ?? 60);
  const deadlineGood = Number(config?.deadlineGoodPct ?? 80);
  const qualityRegular = Number(config?.qualityRegularScore ?? 5);
  const qualityGood = Number(config?.qualityGoodScore ?? 8);
  const collabRegular = Number(config?.collaborationRegularScore ?? 5);
  const collabGood = Number(config?.collaborationGoodScore ?? 8);
  const safetyRegular = Number(config?.safetyRegularScore ?? 5);
  const safetyGood = Number(config?.safetyGoodScore ?? 8);
  const cleaningRegular = Number(config?.cleaningRegularScore ?? 5);
  const cleaningGood = Number(config?.cleaningGoodScore ?? 8);

  const deadlinePct = Number(metric?.ppcPct || 0);
  const deadlineScoreNormalized = round2(deadlinePct / 10);
  const qualityScore = normalizeQualityScore(item?.qualityScore);
  const collaborationTeamScore = normalizeQualityScore(item?.collaborationTeamScore);
  const safetyScore = normalizeQualityScore(item?.safetyScore);
  const cleaningScore = normalizeQualityScore(item?.cleaningScore);
  const collaborationFinalScore = collaborationTeamScore === null
    ? null
    : round2((collaborationTeamScore + Number(presenceScore || 0)) / 2);

  const canComputeOverall = [qualityScore, collaborationFinalScore, safetyScore, cleaningScore]
    .every((value) => value !== null && value !== undefined);
  const overallScore = canComputeOverall
    ? round2((deadlineScoreNormalized + qualityScore + collaborationFinalScore + safetyScore + cleaningScore) / 5)
    : null;

  const overallRegular = round2((
    (deadlineRegular / 10)
    + qualityRegular
    + collabRegular
    + safetyRegular
    + cleaningRegular
  ) / 5);
  const overallGood = round2((
    (deadlineGood / 10)
    + qualityGood
    + collabGood
    + safetyGood
    + cleaningGood
  ) / 5);

  return {
    id: item?.id || null,
    contractorId: contractor.id,
    contractorName: contractor.name || '-',
    laborType: contractor.function?.name || null,
    deadlinePpcPct: deadlinePct,
    deadlineBand: classifyByThreshold(deadlinePct, deadlineRegular, deadlineGood),
    presenceScore: Number(presenceScore || 0),
    qualityScore,
    qualityBand: qualityScore === null ? '-' : classifyByThreshold(qualityScore, qualityRegular, qualityGood),
    collaborationTeamScore,
    collaborationFinalScore,
    collaborationBand: collaborationFinalScore === null ? '-' : classifyByThreshold(collaborationFinalScore, collabRegular, collabGood),
    safetyScore,
    safetyBand: safetyScore === null ? '-' : classifyByThreshold(safetyScore, safetyRegular, safetyGood),
    cleaningScore,
    cleaningBand: cleaningScore === null ? '-' : classifyByThreshold(cleaningScore, cleaningRegular, cleaningGood),
    overallScore,
    overallBand: overallScore === null ? '-' : classifyByThreshold(overallScore, overallRegular, overallGood),
    comments: String(item?.comments || ''),
    metrics: {
      planned: Number(metric?.planned || 0),
      executed: Number(metric?.executed || 0),
      started: Number(metric?.started || 0),
      notStarted: Number(metric?.notStarted || 0),
      cancelled: Number(metric?.cancelled || 0),
      unplannedExecuted: Number(metric?.unplannedExecuted || 0),
    },
  };
}

async function ensurePerceivedQualityRows(weekId, contractors) {
  for (const contractor of contractors) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.weekPerceivedQualityItem.upsert({
      where: {
        weekId_contractorId: {
          weekId,
          contractorId: contractor.id,
        },
      },
      create: {
        weekId,
        contractorId: contractor.id,
      },
      update: {},
    });
  }
}

async function buildPerceivedQualityWeekPayload(weekId) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      work: true,
      qualityClosedBy: { select: { id: true, name: true, email: true } },
      feedbackClosedBy: { select: { id: true, name: true, email: true } },
      ppcMeeting: {
        include: { attendances: true },
      },
    },
  });
  if (!week) return null;

  const [config, activeContractors, metricsByContractor, feedbackRows] = await Promise.all([
    prisma.workPerceivedQualityConfig.findUnique({ where: { workId: week.workId } }),
    listPlanningContractorsByWeek(week.id, week.workId),
    computeDeadlineMetricsByContractor(week.id),
    prisma.feedback.findMany({
      where: { weekId: week.id },
      include: {
        task: {
          include: {
            contractor: {
              include: { function: true },
            },
          },
        },
      },
    }),
  ]);

  await ensurePerceivedQualityRows(week.id, activeContractors);

  const items = await prisma.weekPerceivedQualityItem.findMany({
    where: { weekId: week.id },
    include: {
      contractor: { include: { function: true } },
    },
    orderBy: { id: 'asc' },
  });

  const activeById = new Map(activeContractors.map((contractor) => [Number(contractor.id), contractor]));
  items.forEach((item) => {
    if (!item.contractor) return;
    if (Number(item.contractor.workId) !== Number(week.workId)) return;
    if (!activeById.has(Number(item.contractor.id))) {
      activeById.set(Number(item.contractor.id), item.contractor);
    }
  });
  // Recuperacao defensiva de historico:
  // se tarefas da semana foram alteradas posteriormente, ainda usamos os empreiteiros
  // que aparecem nos feedbacks da propria semana.
  feedbackRows.forEach((feedback) => {
    const contractor = feedback.task?.contractor || null;
    if (!contractor?.id) return;
    if (Number(contractor.workId) !== Number(week.workId)) return;
    if (!activeById.has(Number(contractor.id))) {
      activeById.set(Number(contractor.id), contractor);
    }
  });

  const attendanceMap = new Map(
    (week.ppcMeeting?.attendances || []).map((row) => [Number(row.contractorId), row.present === true]),
  );
  const presenceImpactScore = Number(config?.collaborationPresenceImpactScore ?? 0);

  const itemByContractor = new Map(items.map((item) => [Number(item.contractorId), item]));
  const rows = [...activeById.values()]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .map((contractor) => {
      const contractorId = Number(contractor.id);
      const item = itemByContractor.get(contractorId) || null;
      const present = attendanceMap.get(contractorId) === true;
      const presenceScore = present ? presenceImpactScore : 0;
      return computePerceivedQualityRow({
        item,
        contractor,
        config,
        metric: metricsByContractor.get(contractorId) || null,
        presenceScore,
      });
    });

  return {
    week: {
      id: week.id,
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      planningStatus: week.planningStatus,
      feedbackStatus: week.feedbackStatus,
      qualityStatus: week.qualityStatus || WEEK_STATUS.OPEN,
      feedbackClosedAt: week.feedbackClosedAt,
      feedbackClosedBy: week.feedbackClosedBy || null,
      qualityClosedAt: week.qualityClosedAt,
      qualityClosedBy: week.qualityClosedBy || null,
    },
    work: week.work,
    config,
    rows,
  };
}

function validatePerceivedQualityClose(payload) {
  const reasons = [];
  const lineIssues = [];
  if (!payload) {
    return {
      canClose: false,
      reasons: ['Semana não encontrada para Qualidade Percebida.'],
      lineIssues: [],
    };
  }

  if (String(payload.week.feedbackStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    reasons.push('O feedback da semana ainda não foi fechado.');
  }

  if (!payload.config) {
    reasons.push('Parâmetros da Qualidade Percebida da obra ainda não foram cadastrados.');
  }

  if (!payload.rows.length) {
    reasons.push('Não há empreiteiros ativos nesta semana para avaliação.');
  }

  payload.rows.forEach((row, index) => {
    const missing = [];
    if (row.qualityScore === null) missing.push('Qualidade');
    if (row.collaborationTeamScore === null) missing.push('Colaboração (equipe)');
    if (row.safetyScore === null) missing.push('Segurança');
    if (row.cleaningScore === null) missing.push('Limpeza');
    if (!missing.length) return;
    lineIssues.push(`Linha ${index + 1} (${row.contractorName}): faltando ${missing.join(', ')}.`);
  });

  if (lineIssues.length) reasons.push('Existem itens obrigatórios não preenchidos na avaliação da semana.');

  return {
    canClose: reasons.length === 0 && lineIssues.length === 0,
    reasons,
    lineIssues,
  };
}

async function listActiveContractorsByWeek(weekId, workId) {
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

function serializePpcMeeting(meeting, week, contractors, suggestedMeetingAt = null) {
  const attendanceMap = new Map(
    (meeting?.attendances || []).map((item) => [Number(item.contractorId), item]),
  );
  const rows = contractors.map((contractor) => {
    const attendance = attendanceMap.get(Number(contractor.id));
    const contact = parseContractorContact(contractor.contact);
    return {
      contractorId: contractor.id,
      contractorName: contractor.name,
      laborType: contractor.function?.name || null,
      supervisor: contact.supervisor || '',
      communicationEmail: contact.communicationEmail || '',
      phone: contact.phone || '',
      present: attendance?.present === true,
      attendanceId: attendance?.id || null,
    };
  });

  return {
    id: meeting?.id || null,
    weekId: week.id,
    weekNumber: week.weekNumber,
    meetingAt: meeting?.meetingAt || null,
    suggestedMeetingAt: suggestedMeetingAt || null,
    minutes: meeting?.minutes || '',
    isClosed: meeting?.isClosed === true,
    closedAt: meeting?.closedAt || null,
    closedById: meeting?.closedById || null,
    closedByName: meeting?.closedBy?.name || null,
    attendance: rows,
  };
}

async function normalizeWeekCalendarForWork(workId, workStartDate) {
  const weeks = await prisma.week.findMany({
    where: { workId },
    include: { weatherDays: { orderBy: { dayDate: 'asc' } } },
    orderBy: { weekNumber: 'asc' },
  });

  for (const week of weeks) {
    const expected = calculateWeekPeriod(workStartDate, week.weekNumber);
    const weekChanged = (
      dateKeyStable(week.startDate) !== dateKeyStable(expected.startDate)
      || dateKeyStable(week.endDate) !== dateKeyStable(expected.endDate)
      || week.year !== expected.year
    );

    if (weekChanged) {
      await prisma.week.update({
        where: { id: week.id },
        data: {
          startDate: expected.startDate,
          endDate: expected.endDate,
          year: expected.year,
        },
      });
    }

    const expectedRows = weatherRowsWithSunday(expected.startDate, expected.endDate);
    const expectedDates = expectedRows.map((row) => row.dayDate);
    const existingByWeekday = new Map();
    for (const day of week.weatherDays) {
      const key = String(day.weekday || '').toUpperCase();
      if (!existingByWeekday.has(key)) existingByWeekday.set(key, day);
    }

    await prisma.weekWeatherDay.deleteMany({
      where: {
        weekId: week.id,
        dayDate: { notIn: expectedDates },
      },
    });

    for (const expectedRow of expectedRows) {
      const source = existingByWeekday.get(expectedRow.weekday);
      await prisma.weekWeatherDay.upsert({
        where: { weekId_dayDate: { weekId: week.id, dayDate: expectedRow.dayDate } },
        create: withPrecipitation({
          weekId: week.id,
          dayDate: expectedRow.dayDate,
          weekday: expectedRow.weekday,
          icon: source?.icon || 'CLOUDY',
          tempMinC: source?.tempMinC ?? null,
          tempMaxC: source?.tempMaxC ?? null,
        }, source),
        update: withPrecipitation({
          weekday: expectedRow.weekday,
          icon: source?.icon || 'CLOUDY',
          tempMinC: source?.tempMinC ?? null,
          tempMaxC: source?.tempMaxC ?? null,
        }, source),
      });
    }
  }
}

async function resolveCoordinatesFromCep(cep) {
  const cleanCep = String(cep || '').replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  let cepData = null;
  try {
    const cepResp = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
    if (cepResp.ok) {
      const raw = await cepResp.json();
      cepData = {
        city: raw.city || '',
        state: raw.state || '',
        location: raw.location || null,
      };
    }
  } catch {
    cepData = null;
  }

  if (!cepData || !cepData.city) {
    try {
      const viaCepResp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (viaCepResp.ok) {
        const raw = await viaCepResp.json();
        if (!raw.erro) {
          cepData = {
            city: raw.localidade || '',
            state: raw.uf || '',
            location: null,
          };
        }
      }
    } catch {
      cepData = cepData || null;
    }
  }

  if (!cepData || !cepData.city) return null;

  const latFromCep = Number.parseFloat(cepData?.location?.coordinates?.latitude);
  const lonFromCep = Number.parseFloat(cepData?.location?.coordinates?.longitude);
  if (Number.isFinite(latFromCep) && Number.isFinite(lonFromCep)) {
    return { latitude: latFromCep, longitude: lonFromCep };
  }

  const state = String(cepData.state || '').trim();
  const city = String(cepData.city || '').trim();
  const queryCandidates = [
    state ? `${city}, ${state}, Brasil` : city,
    state ? `${city}, ${state}` : null,
    city,
  ].filter((item, index, arr) => item && arr.indexOf(item) === index);

  let geoResults = [];
  for (const queryName of queryCandidates) {
    try {
      const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
      geoUrl.searchParams.set('name', queryName);
      geoUrl.searchParams.set('countryCode', 'BR');
      geoUrl.searchParams.set('count', '10');
      geoUrl.searchParams.set('language', 'pt');
      geoUrl.searchParams.set('format', 'json');
      // eslint-disable-next-line no-await-in-loop
      const geoResp = await fetch(geoUrl);
      if (!geoResp.ok) continue;
      // eslint-disable-next-line no-await-in-loop
      const geo = await geoResp.json();
      if (Array.isArray(geo?.results) && geo.results.length) {
        geoResults = geo.results;
        break;
      }
    } catch {
      // tenta próximo candidato
    }
  }
  if (!geoResults.length) return null;

  const normalizedCity = city.toLowerCase();
  const exactCity = geoResults.find((item) => String(item.name || '').trim().toLowerCase() === normalizedCity);
  const first = exactCity || geoResults[0];
  return { latitude: first.latitude, longitude: first.longitude };
}

async function fetchWeatherPayload(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.daily?.time) return null;
    return data;
  } catch {
    return null;
  }
}

router.get('/works/:workId/weeks', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const work = await prisma.work.findUnique({
    where: { id: req.workId },
    select: { id: true, startDate: true },
  });
  if (!work) return res.status(404).json({ error: 'work_not_found' });

  await normalizeWeekCalendarForWork(req.workId, work.startDate);

  const weekNumber = parseIntId(req.query.weekNumber);
  const where = { workId: req.workId };
  if (weekNumber) where.weekNumber = weekNumber;

  const weeks = await prisma.week.findMany({
    where,
    include: { weatherDays: { orderBy: { dayDate: 'asc' } } },
    orderBy: { weekNumber: 'asc' },
  });

  const weekIds = weeks.map((week) => week.id);
  const pendingRequests = weekIds.length
    ? await prisma.reopenRequest.findMany({
      where: { weekId: { in: weekIds }, status: 'PENDING' },
      select: { weekId: true },
    })
    : [];
  const pendingSet = new Set(pendingRequests.map((item) => Number(item.weekId)));
  const enriched = weeks.map((week) => ({
    ...week,
    hasPendingReopenRequest: pendingSet.has(Number(week.id)),
  }));

  return res.json(enriched);
}));

router.post('/works/:workId/weeks', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const weekNumber = parseIntId(req.body.weekNumber);

  if (!weekNumber) {
    return res.status(400).json({ error: 'weekNumber_required' });
  }

  const existing = await prisma.week.findUnique({
    where: { workId_weekNumber: { workId: req.workId, weekNumber } },
  });
  if (existing) return res.status(409).json({ error: 'week_already_exists' });

  const work = await prisma.work.findUnique({
    where: { id: req.workId },
    select: { id: true, startDate: true },
  });
  if (!work) return res.status(404).json({ error: 'work_not_found' });

  const { startDate, endDate, year } = calculateWeekPeriod(work.startDate, weekNumber);

  const maxWeek = await prisma.week.findFirst({
    where: { workId: req.workId },
    orderBy: { weekNumber: 'desc' },
    select: { weekNumber: true },
  });

  const isEngineeringOnly = req.workRoles.has(ROLES.ENGINEERING)
    && !req.workRoles.has(ROLES.ADMIN)
    && !req.workRoles.has(ROLES.CONTROLLER);

  if (isEngineeringOnly && maxWeek && weekNumber > maxWeek.weekNumber + 1) {
    const approved = await prisma.futureWeekAuthorization.findFirst({
      where: { workId: req.workId, requestedWeekNumber: weekNumber, status: 'APPROVED' },
      orderBy: { approvedAt: 'desc' },
      select: { id: true },
    });
    if (!approved) {
      return res.status(403).json({
        error: 'future_week_needs_approval',
        message: `A semana ${weekNumber} precisa de autorizacao do Controller/Admin.`,
      });
    }
  }

  const week = await prisma.week.create({
    data: {
      workId: req.workId,
      weekNumber,
      year,
      startDate,
      endDate,
      prePlanningStatus: WEEK_STATUS.OPEN,
      planningStatus: WEEK_STATUS.OPEN,
      feedbackStatus: WEEK_STATUS.OPEN,
      qualityStatus: WEEK_STATUS.OPEN,
      weatherDays: { create: weatherRowsWithSunday(startDate, endDate) },
    },
    include: { weatherDays: { orderBy: { dayDate: 'asc' } } },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WEEK',
    entityId: week.id,
    eventType: 'WEEK_CREATED',
    description: `Semana ${week.weekNumber} criada.`,
  });

  return res.status(201).json(week);
}));

router.put('/weeks/:weekId/weather', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const days = Array.isArray(req.body.days) ? req.body.days : [];
  if (!days.length) return res.status(400).json({ error: 'days_required' });

  for (const day of days) {
    const dayDate = parseDate(day.dayDate);
    if (!dayDate || !day.weekday || !day.icon) {
      return res.status(400).json({ error: 'dayDate_weekday_icon_required' });
    }

    await prisma.weekWeatherDay.upsert({
      where: { weekId_dayDate: { weekId: req.week.id, dayDate } },
      create: withPrecipitation({
        weekId: req.week.id,
        dayDate,
        weekday: String(day.weekday).toUpperCase(),
        icon: String(day.icon).toUpperCase(),
        tempMinC: day.tempMinC ?? null,
        tempMaxC: day.tempMaxC ?? null,
      }, day),
      update: withPrecipitation({
        weekday: String(day.weekday).toUpperCase(),
        icon: String(day.icon).toUpperCase(),
        tempMinC: day.tempMinC ?? null,
        tempMaxC: day.tempMaxC ?? null,
      }, day),
    });
  }

  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    include: { weatherDays: { orderBy: { dayDate: 'asc' } } },
  });
  return res.json(week);
}));

router.post('/weeks/:weekId/weather/fetch', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const work = await prisma.work.findUnique({ where: { id: req.workId } });
  if (!work) return res.status(404).json({ error: 'work_not_found' });

  const currentWeek = await prisma.week.findUnique({
    where: { id: req.week.id },
    include: { weatherDays: true },
  });
  if (!currentWeek) return res.status(404).json({ error: 'week_not_found' });

  const expectedPeriod = calculateWeekPeriod(work.startDate, currentWeek.weekNumber);
  const expectedRows = weatherRowsWithSunday(expectedPeriod.startDate, expectedPeriod.endDate);
  const queryStart = new Date(expectedPeriod.startDate);
  if (queryStart.getDay() === 1) queryStart.setDate(queryStart.getDate() - 1);
  const expectedStartKey = dateKeyStable(queryStart);
  const expectedEndKey = dateKeyStable(expectedPeriod.endDate);

  const coords = await resolveCoordinatesFromCep(work.cep);
  if (!coords) return res.status(400).json({ error: 'unable_to_resolve_coordinates_from_cep' });

  const preferredUrl = new URL('https://api.open-meteo.com/v1/forecast');
  preferredUrl.searchParams.set('latitude', String(coords.latitude));
  preferredUrl.searchParams.set('longitude', String(coords.longitude));
  preferredUrl.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum');
  preferredUrl.searchParams.set('timezone', 'America/Sao_Paulo');
  preferredUrl.searchParams.set('start_date', expectedStartKey);
  preferredUrl.searchParams.set('end_date', expectedEndKey);

  let data = await fetchWeatherPayload(preferredUrl);

  // Fallback para cenários em que o provedor rejeita start/end para uma semana muito à frente.
  if (!data) {
    const fallbackUrl = new URL('https://api.open-meteo.com/v1/forecast');
    fallbackUrl.searchParams.set('latitude', String(coords.latitude));
    fallbackUrl.searchParams.set('longitude', String(coords.longitude));
    fallbackUrl.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum');
    fallbackUrl.searchParams.set('timezone', 'America/Sao_Paulo');
    fallbackUrl.searchParams.set('forecast_days', '16');
    data = await fetchWeatherPayload(fallbackUrl);
  }

  await prisma.week.update({
    where: { id: currentWeek.id },
    data: {
      startDate: expectedPeriod.startDate,
      endDate: expectedPeriod.endDate,
      year: expectedPeriod.year,
    },
  });

  const forecastByKey = new Map();
  if (data?.daily?.time) {
    for (let i = 0; i < data.daily.time.length; i += 1) {
      forecastByKey.set(String(data.daily.time[i] || ''), {
        weatherCode: data.daily.weathercode?.[i],
        precipitationProbabilityMax: data.daily.precipitation_probability_max?.[i],
        precipitationSum: data.daily.precipitation_sum?.[i],
        tempMinC: data.daily.temperature_2m_min?.[i],
        tempMaxC: data.daily.temperature_2m_max?.[i],
      });
    }
  }

  const expectedDates = expectedRows.map((row) => row.dayDate);
  await prisma.weekWeatherDay.deleteMany({
    where: {
      weekId: currentWeek.id,
      dayDate: { notIn: expectedDates },
    },
  });

  const updates = [];

  for (const rowExpected of expectedRows) {
    const dayDate = rowExpected.dayDate;
    const weekday = String(rowExpected.weekday || '').toUpperCase();
    const dayKey = dateKeyStable(dayDate);
    const forecast = forecastByKey.get(dayKey);
    const icon = mapWeatherCodeToIcon(
      forecast?.weatherCode,
      forecast?.precipitationProbabilityMax,
      forecast?.precipitationSum,
    );

    const row = await prisma.weekWeatherDay.upsert({
      where: { weekId_dayDate: { weekId: currentWeek.id, dayDate } },
      create: withPrecipitation({
        weekId: currentWeek.id,
        dayDate,
        weekday,
        icon,
        tempMinC: forecast?.tempMinC ?? null,
        tempMaxC: forecast?.tempMaxC ?? null,
      }, forecast),
      update: withPrecipitation({
        weekday,
        icon,
        tempMinC: forecast?.tempMinC ?? null,
        tempMaxC: forecast?.tempMaxC ?? null,
      }, forecast),
    });
    updates.push({
      ...row,
      precipitationMm: forecast?.precipitationSum ?? row.precipitationMm ?? null,
      precipitationProbabilityPct: forecast?.precipitationProbabilityMax ?? row.precipitationProbabilityPct ?? null,
    });
  }

  return res.json({
    count: updates.length,
    weatherDays: updates,
    source: data ? 'open-meteo' : 'fallback-sem-dados',
  });
}));

router.post('/weeks/:weekId/close-planning', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  if (req.week.planningStatus === WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'planning_already_closed' });
  }

  const prePlanningClosed = String(req.week.prePlanningStatus || '').toUpperCase() === WEEK_STATUS.CLOSED;
  const ppcMeeting = await prisma.weekPpcMeeting.findUnique({
    where: { weekId: req.week.id },
    select: { isClosed: true },
  });
  const ppcMeetingClosed = ppcMeeting?.isClosed === true;
  if (!prePlanningClosed || !ppcMeetingClosed) {
    return res.status(409).json({ error: 'planning_requires_pre_and_ppc_close' });
  }

  const planningTasksMissingLocation = await countPlanningTasksWithoutLocationLevel1(req.week.id);
  if (planningTasksMissingLocation > 0) {
    return res.status(409).json({ error: 'close_requires_location_level1' });
  }

  const updated = await prisma.week.update({
    where: { id: req.week.id },
    data: {
      planningStatus: WEEK_STATUS.CLOSED,
      planningClosedAt: new Date(),
      planningClosedById: req.user.id,
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WEEK',
    entityId: req.week.id,
    eventType: 'PLANNING_CLOSED',
    description: `Planejamento da semana ${req.week.weekNumber} fechado.`,
  });

  return res.json(updated);
}));

router.post('/weeks/:weekId/close-pre-planning', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  if (String(req.week.prePlanningStatus || '').toUpperCase() === WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'pre_planning_already_closed' });
  }

  if (String(req.week.planningStatus || '').toUpperCase() === WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'planning_closed' });
  }

  const prePlanningTasksMissingLocation = await countPrePlanningTasksWithoutLocationLevel1(req.week.id);
  if (prePlanningTasksMissingLocation > 0) {
    return res.status(409).json({ error: 'close_requires_location_level1' });
  }

  const preTasks = await prisma.preTask.findMany({
    where: { weekId: req.week.id },
    include: { plannedDays: { orderBy: { weekday: 'asc' } } },
    orderBy: { sequenceNumber: 'asc' },
  });

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const existingTaskIds = (await tx.task.findMany({
      where: { currentWeekId: req.week.id },
      select: { id: true },
    })).map((item) => item.id);

    if (existingTaskIds.length) {
      await tx.feedback.deleteMany({ where: { taskId: { in: existingTaskIds } } });
      await tx.taskPlannedDay.deleteMany({ where: { taskId: { in: existingTaskIds } } });
    }
    await tx.task.deleteMany({ where: { currentWeekId: req.week.id } });

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
          status: normalizePlanningTaskStatusForCopy(item.status),
          plannedDays: {
            create: (item.plannedDays || []).map((day) => ({
              weekday: String(day.weekday || '').toUpperCase(),
              plannedDate: day.plannedDate || null,
            })),
          },
        },
      });
    }

    return tx.week.update({
      where: { id: req.week.id },
      data: {
        prePlanningStatus: WEEK_STATUS.CLOSED,
        prePlanningClosedAt: now,
        prePlanningClosedById: req.user.id,
      },
    });
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WEEK',
    entityId: req.week.id,
    eventType: 'PRE_PLANNING_CLOSED',
    description: `Pré-programação da semana ${req.week.weekNumber} fechada.`,
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WEEK',
    entityId: req.week.id,
    eventType: 'PRE_TO_PLANNING_SYNC',
    description: `Pré-programação sincronizada automaticamente para programação da semana ${req.week.weekNumber} (${preTasks.length} tarefas).`,
  });

  return res.json({
    ...updated,
    autoSyncedToPlanning: true,
    copiedCount: preTasks.length,
  });
}));

router.post('/weeks/:weekId/reopen-requests', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const item = await prisma.reopenRequest.create({
    data: {
      weekId: req.week.id,
      requestedById: req.user.id,
      reason: req.body.reason || null,
      status: 'PENDING',
    },
  });
  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'REOPEN_REQUEST',
    entityId: item.id,
    eventType: 'REOPEN_REQUESTED',
    description: `Solicitada reabertura da semana ${req.week.weekNumber}.`,
  });
  return res.status(201).json(item);
}));

router.post('/reopen-requests/:reopenRequestId/decision', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const reopenRequestId = parseIntId(req.params.reopenRequestId);
  if (!reopenRequestId) return res.status(400).json({ error: 'invalid_reopen_request_id' });
  const request = await prisma.reopenRequest.findUnique({
    where: { id: reopenRequestId },
    include: { week: { select: { id: true, workId: true, weekNumber: true } } },
  });
  if (!request) return res.status(404).json({ error: 'reopen_request_not_found' });
  req.reopenRequest = request;
  req.params.workId = String(request.week.workId);
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (typeof req.body.approve !== 'boolean') return res.status(400).json({ error: 'approve_boolean_required' });
  if (req.reopenRequest.status !== 'PENDING') return res.status(409).json({ error: 'reopen_request_already_decided' });
  const approve = req.body.approve === true;
  const now = new Date();

  const updatedRequest = await prisma.reopenRequest.update({
    where: { id: req.reopenRequest.id },
    data: {
      status: approve ? 'APPROVED' : 'REJECTED',
      approvedById: req.user.id,
      approvedAt: approve ? now : null,
      rejectedAt: approve ? null : now,
    },
  });

  if (approve) {
    await prisma.week.update({
      where: { id: req.reopenRequest.weekId },
      data: { planningStatus: WEEK_STATUS.OPEN, reopenedAt: now, reopenedById: req.user.id },
    });
  }

  return res.json(updatedRequest);
}));

router.post('/weeks/:weekId/feedback/unplanned-task', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  if (String(req.week.planningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'planning_not_closed' });
  }
  if (String(req.week.feedbackStatus || '').toUpperCase() === WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'feedback_closed' });
  }

  const description = String(req.body.description || '').trim();
  if (!description) return res.status(400).json({ error: 'description_required' });

  const contractorId = parseIntId(req.body.contractorId);
  if (!contractorId) return res.status(400).json({ error: 'contractor_required' });

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { id: true, workId: true, contact: true },
  });
  if (!contractor || contractor.workId !== req.workId) {
    return res.status(400).json({ error: 'contractor_not_in_work' });
  }

  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    include: { weatherDays: { orderBy: { dayDate: 'asc' } } },
  });
  if (!week) return res.status(404).json({ error: 'week_not_found' });

  const weekDayDate = new Map(
    (week.weatherDays || []).map((item) => [String(item.weekday || '').toUpperCase(), item.dayDate]),
  );

  const bodyDays = Array.isArray(req.body.executedDays) ? req.body.executedDays : [];
  let executedDays = bodyDays
    .map((item) => normalizeWeekday(item?.weekday || item))
    .filter(Boolean);
  executedDays = [...new Set(executedDays)];

  let actualStart = parseDate(req.body.actualStart);
  let actualEnd = parseDate(req.body.actualEnd);

  if (!executedDays.length && actualStart && actualEnd) {
    const start = new Date(actualStart);
    const end = new Date(actualEnd);
    executedDays = (week.weatherDays || [])
      .filter((item) => item.dayDate >= start && item.dayDate <= end)
      .map((item) => normalizeWeekday(item.weekday))
      .filter(Boolean);
  }

  const executedDates = executedDays
    .map((weekday) => weekDayDate.get(weekday))
    .filter(Boolean)
    .sort((a, b) => a - b);

  if ((!actualStart || !actualEnd) && executedDates.length) {
    actualStart = actualStart || executedDates[0];
    actualEnd = actualEnd || executedDates[executedDates.length - 1];
  }

  if (!actualStart && !actualEnd && !executedDays.length) {
    return res.status(400).json({ error: 'actual_dates_or_days_required' });
  }
  if (actualStart && !actualEnd) actualEnd = new Date(actualStart);
  if (!actualStart && actualEnd) actualStart = new Date(actualEnd);
  if (actualStart && actualEnd && actualStart > actualEnd) {
    const temp = actualStart;
    actualStart = actualEnd;
    actualEnd = temp;
  }

  let locationId = null;
  const locationLevel1 = String(req.body.locationLevel1 || '').trim();
  const locationLevel2 = String(req.body.locationLevel2 || '').trim();
  if (!locationLevel1) return res.status(400).json({ error: 'location_level1_required' });
  if (locationLevel1) {
    locationId = await findOrCreateLocation(req.workId, locationLevel1, locationLevel2 || null);
  }

  const maxSeq = await prisma.task.findFirst({
    where: { currentWeekId: req.week.id },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  const nextSeq = (maxSeq?.sequenceNumber || 0) + 1;

  const created = await prisma.task.create({
    data: {
      sequenceNumber: nextSeq,
      originWeekId: req.week.id,
      currentWeekId: req.week.id,
      contractorId: contractor.id,
      supervisor: String(req.body.supervisor || '').trim() || parseContractorSupervisor(contractor.contact) || null,
      locationId,
      description,
      plannedStart: null,
      plannedEnd: null,
      actualStart: actualStart || null,
      actualEnd: actualEnd || null,
      status: TASK_STATUS.EXECUTED,
      isUnplanned: true,
      plannedDays: {
        create: executedDays.map((weekday) => ({
          weekday,
          plannedDate: null,
          actualDate: weekDayDate.get(weekday) || null,
        })),
      },
      feedbacks: {
        create: {
          weekId: req.week.id,
          status: 'EXECUTED_UNPLANNED',
          causeId: null,
          comments: 'Atividade executada não planejada.',
          submittedById: req.user.id,
        },
      },
    },
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
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'TASK',
    entityId: created.id,
    eventType: 'UNPLANNED_TASK_EXECUTED_CREATED',
    description: `Atividade não planejada criada na semana ${req.week.weekNumber}.`,
  });

  return res.status(201).json(created);
}));

router.delete('/weeks/:weekId/feedback/unplanned-task/:taskId', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  if (String(req.week.planningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'planning_not_closed' });
  }
  if (String(req.week.feedbackStatus || '').toUpperCase() === WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'feedback_closed' });
  }

  const taskId = parseIntId(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'invalid_task_id' });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      currentWeekId: true,
      isUnplanned: true,
      sequenceNumber: true,
    },
  });
  if (!task || Number(task.currentWeekId) !== Number(req.week.id)) {
    return res.status(404).json({ error: 'task_not_found' });
  }
  if (task.isUnplanned !== true) {
    return res.status(409).json({ error: 'only_unplanned_task_can_be_deleted_here' });
  }

  await prisma.feedback.deleteMany({ where: { taskId: task.id } });
  await prisma.taskPlannedDay.deleteMany({ where: { taskId: task.id } });
  await prisma.task.delete({ where: { id: task.id } });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'TASK',
    entityId: task.id,
    eventType: 'UNPLANNED_TASK_DELETED',
    description: `Atividade não planejada #${task.sequenceNumber} excluída da semana ${req.week.weekNumber}.`,
  });

  return res.status(204).send();
}));

router.post('/weeks/:weekId/feedback', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  if (String(req.week.planningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'planning_not_closed' });
  }
  if (String(req.week.feedbackStatus || '').toUpperCase() === WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'feedback_closed' });
  }

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const closeWeek = req.body.closeWeek === true;
  if (!items.length) return res.status(400).json({ error: 'items_required' });

  const taskIds = items.map((item) => parseIntId(item.taskId)).filter(Boolean);
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, currentWeekId: req.week.id },
    select: {
      id: true,
      sequenceNumber: true,
      status: true,
      isUnplanned: true,
      contractorId: true,
      supervisor: true,
      locationId: true,
      description: true,
    },
  });
  const taskIdSet = new Set(tasks.map((task) => task.id));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  if (taskIds.some((id) => !taskIdSet.has(id))) {
    return res.status(400).json({ error: 'some_tasks_not_in_week' });
  }

  const weekDays = await prisma.weekWeatherDay.findMany({
    where: { weekId: req.week.id },
    orderBy: { dayDate: 'asc' },
  });
  const weekDayDate = new Map(
    weekDays.map((item) => [String(item.weekday || '').toUpperCase(), item.dayDate]),
  );

  const existingTaskDays = await prisma.taskPlannedDay.findMany({
    where: { taskId: { in: taskIds } },
    select: { taskId: true, weekday: true },
  });
  const existingByTask = new Map();
  existingTaskDays.forEach((row) => {
    const taskDaySet = existingByTask.get(row.taskId) || new Set();
    taskDaySet.add(String(row.weekday || '').toUpperCase());
    existingByTask.set(row.taskId, taskDaySet);
  });

  const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  if (closeWeek) {
    const incompleteRows = [];
    for (const item of items) {
      const taskId = parseIntId(item.taskId);
      if (!taskId) continue;
      const task = taskById.get(taskId);
      if (!task) continue;
      let feedbackStatus = normalizeFeedbackStatus(item.status);
      if (task?.isUnplanned) feedbackStatus = 'EXECUTED_UNPLANNED';
      const taskIsReserve = String(task?.status || '').toUpperCase() === TASK_STATUS.RESERVA;
      const reserveNotExecuted = taskIsReserve && feedbackStatus !== 'EXECUTED' && feedbackStatus !== 'EXECUTED_UNPLANNED';
      const requiresCause = (feedbackStatus === 'STARTED' || feedbackStatus === 'NOT_STARTED') && !reserveNotExecuted;
      if (requiresCause && !parseIntId(item.causeId)) {
        incompleteRows.push(Number(task.sequenceNumber || task.id));
      }
    }
    if (incompleteRows.length) {
      return res.status(400).json({ error: 'feedback_close_incomplete', rows: incompleteRows });
    }
  }

  for (const item of items) {
    const taskId = parseIntId(item.taskId);
    if (!taskId) continue;
    const task = taskById.get(taskId);
    let feedbackStatus = normalizeFeedbackStatus(item.status);
    if (task?.isUnplanned) feedbackStatus = 'EXECUTED_UNPLANNED';
    const originalTaskStatus = String(task?.status || '').toUpperCase();
    let taskStatus = normalizeTaskStatus(feedbackStatus);
    const taskIsReserve = String(task?.status || '').toUpperCase() === TASK_STATUS.RESERVA;
    const reserveNotExecuted = taskIsReserve && feedbackStatus !== 'EXECUTED' && feedbackStatus !== 'EXECUTED_UNPLANNED';
    if (
      (originalTaskStatus === TASK_STATUS.RESERVA || originalTaskStatus === TASK_STATUS.RETRABALHO)
      && feedbackStatus !== 'EXECUTED'
      && feedbackStatus !== 'EXECUTED_UNPLANNED'
    ) {
      taskStatus = originalTaskStatus;
    }
    const causeId = (feedbackStatus === 'EXECUTED' || feedbackStatus === 'EXECUTED_UNPLANNED' || feedbackStatus === 'CANCELLED' || reserveNotExecuted)
      ? null
      : (item.causeId || null);
    const bodyDays = Array.isArray(item.executedDays) ? item.executedDays : [];
    let executedDays = bodyDays
      .map((entry) => normalizeWeekday(entry?.weekday || entry))
      .filter(Boolean);
    executedDays = [...new Set(executedDays)];

    let actualStart = parseDate(item.actualStart);
    let actualEnd = parseDate(item.actualEnd);

    if (!executedDays.length && actualStart && actualEnd) {
      const start = new Date(actualStart);
      const end = new Date(actualEnd);
      executedDays = weekDays
        .filter((day) => day.dayDate >= start && day.dayDate <= end)
        .map((day) => normalizeWeekday(day.weekday))
        .filter(Boolean);
    }

    const executedDates = executedDays
      .map((weekday) => weekDayDate.get(weekday))
      .filter(Boolean)
      .sort((a, b) => a - b);

    if ((!actualStart || !actualEnd) && executedDates.length) {
      actualStart = actualStart || executedDates[0];
      actualEnd = actualEnd || executedDates[executedDates.length - 1];
    }
    if (actualStart && !actualEnd) actualEnd = new Date(actualStart);
    if (!actualStart && actualEnd) actualStart = new Date(actualEnd);
    if (actualStart && actualEnd && actualStart > actualEnd) {
      const temp = actualStart;
      actualStart = actualEnd;
      actualEnd = temp;
    }

    await prisma.feedback.upsert({
      where: { taskId_weekId: { taskId, weekId: req.week.id } },
      create: {
        taskId,
        weekId: req.week.id,
        status: feedbackStatus,
        causeId,
        comments: item.comments || null,
        submittedById: req.user.id,
      },
      update: {
        status: feedbackStatus,
        causeId,
        comments: item.comments || null,
        submittedById: req.user.id,
        submittedAt: new Date(),
      },
    });

    const taskUpdateData = {
      status: taskStatus,
      actualStart: actualStart || null,
      actualEnd: actualEnd || null,
    };

    const editedContractorId = parseIntId(item.contractorId);
    if (editedContractorId) {
      const contractor = await prisma.contractor.findUnique({
        where: { id: editedContractorId },
        select: { id: true, workId: true, contact: true },
      });
      if (!contractor || contractor.workId !== req.workId) {
        return res.status(400).json({ error: 'contractor_not_in_work' });
      }
      taskUpdateData.contractorId = contractor.id;
      taskUpdateData.supervisor = parseContractorSupervisor(contractor.contact) || task?.supervisor || null;
    }

    if (task?.isUnplanned) {
      const editedDescription = String(item.description || '').trim();
      if (editedDescription) {
        taskUpdateData.description = editedDescription;
      }

      if (Object.prototype.hasOwnProperty.call(item, 'locationLevel1')) {
        const editedL1 = String(item.locationLevel1 || '').trim();
        const editedL2 = String(item.locationLevel2 || '').trim();
        if (editedL1) {
          taskUpdateData.locationId = await findOrCreateLocation(req.workId, editedL1, editedL2 || null);
        } else {
          taskUpdateData.locationId = null;
        }
      }
    }

    await prisma.task.update({
      where: { id: taskId },
      data: taskUpdateData,
    });

    const existingSet = existingByTask.get(taskId) || new Set();
    for (const weekday of weekdays) {
      const actualDate = executedDays.includes(weekday)
        ? (weekDayDate.get(weekday) || null)
        : null;

      if (existingSet.has(weekday)) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.taskPlannedDay.updateMany({
          where: { taskId, weekday },
          data: { actualDate },
        });
      } else if (actualDate) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.taskPlannedDay.create({
          data: {
            taskId,
            weekday,
            plannedDate: null,
            actualDate,
          },
        });
      }
    }
  }

  let rolloverResult = null;
  if (closeWeek) {
    await prisma.week.update({
      where: { id: req.week.id },
      data: {
        feedbackStatus: WEEK_STATUS.CLOSED,
        feedbackClosedAt: new Date(),
        feedbackClosedById: req.user.id,
      },
    });

    const work = await prisma.work.findUnique({
      where: { id: req.workId },
      select: { id: true, startDate: true },
    });
    if (work?.startDate) {
      const nextWeek = await ensureWeekExistsForWork(req.workId, work.startDate, Number(req.week.weekNumber) + 1);
      if (nextWeek) {
        rolloverResult = await rollPendingTasksToNextWeek(req.week, nextWeek);
      }
    }
  }

  const weekTasks = await prisma.task.findMany({ where: { currentWeekId: req.week.id } });
  const weekFeedbacks = await prisma.feedback.findMany({ where: { weekId: req.week.id } });
  return res.json({ summary: summarizeWeek(weekTasks, weekFeedbacks), rollover: rolloverResult });
}));

router.get('/weeks/:weekId/perceived-quality', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  const payload = await buildPerceivedQualityWeekPayload(req.week.id);
  if (!payload) return res.status(404).json({ error: 'week_not_found' });
  return res.json(payload);
}));

router.put('/weeks/:weekId/perceived-quality', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const payload = await buildPerceivedQualityWeekPayload(req.week.id);
  if (!payload) return res.status(404).json({ error: 'week_not_found' });
  if (String(payload.week.qualityStatus || '').toUpperCase() === WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'quality_closed' });
  }

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'items_required' });

  const allowedContractorIds = new Set(payload.rows.map((row) => Number(row.contractorId)));

  for (const item of items) {
    const contractorId = parseIntId(item.contractorId);
    if (!contractorId || !allowedContractorIds.has(Number(contractorId))) {
      return res.status(400).json({ error: 'quality_item_invalid_contractor' });
    }

    const nextData = {};

    if (Object.prototype.hasOwnProperty.call(item, 'qualityScore')) {
      const normalized = normalizeQualityScore(item.qualityScore);
      if (item.qualityScore !== null && item.qualityScore !== '' && normalized === null) {
        return res.status(400).json({ error: 'quality_score_invalid' });
      }
      nextData.qualityScore = normalized;
    }

    if (Object.prototype.hasOwnProperty.call(item, 'collaborationTeamScore')) {
      const normalized = normalizeQualityScore(item.collaborationTeamScore);
      if (item.collaborationTeamScore !== null && item.collaborationTeamScore !== '' && normalized === null) {
        return res.status(400).json({ error: 'quality_score_invalid' });
      }
      nextData.collaborationTeamScore = normalized;
    }

    if (Object.prototype.hasOwnProperty.call(item, 'safetyScore')) {
      const normalized = normalizeQualityScore(item.safetyScore);
      if (item.safetyScore !== null && item.safetyScore !== '' && normalized === null) {
        return res.status(400).json({ error: 'quality_score_invalid' });
      }
      nextData.safetyScore = normalized;
    }

    if (Object.prototype.hasOwnProperty.call(item, 'cleaningScore')) {
      const normalized = normalizeQualityScore(item.cleaningScore);
      if (item.cleaningScore !== null && item.cleaningScore !== '' && normalized === null) {
        return res.status(400).json({ error: 'quality_score_invalid' });
      }
      nextData.cleaningScore = normalized;
    }

    if (Object.prototype.hasOwnProperty.call(item, 'comments')) {
      nextData.comments = String(item.comments || '').trim() || null;
    }

    // eslint-disable-next-line no-await-in-loop
    await prisma.weekPerceivedQualityItem.upsert({
      where: {
        weekId_contractorId: {
          weekId: req.week.id,
          contractorId,
        },
      },
      create: {
        weekId: req.week.id,
        contractorId,
        qualityScore: Object.prototype.hasOwnProperty.call(nextData, 'qualityScore') ? nextData.qualityScore : null,
        collaborationTeamScore: Object.prototype.hasOwnProperty.call(nextData, 'collaborationTeamScore') ? nextData.collaborationTeamScore : null,
        safetyScore: Object.prototype.hasOwnProperty.call(nextData, 'safetyScore') ? nextData.safetyScore : null,
        cleaningScore: Object.prototype.hasOwnProperty.call(nextData, 'cleaningScore') ? nextData.cleaningScore : null,
        comments: Object.prototype.hasOwnProperty.call(nextData, 'comments') ? nextData.comments : null,
      },
      update: nextData,
    });
  }

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WEEK_PERCEIVED_QUALITY',
    entityId: req.week.id,
    eventType: 'PERCEIVED_QUALITY_SAVED',
    description: `Qualidade percebida da semana ${payload.week.weekNumber} atualizada.`,
    metadata: { itemsUpdated: items.length },
  });

  const updated = await buildPerceivedQualityWeekPayload(req.week.id);
  return res.json(updated);
}));

router.post('/weeks/:weekId/perceived-quality/close', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const payload = await buildPerceivedQualityWeekPayload(req.week.id);
  if (!payload) return res.status(404).json({ error: 'week_not_found' });

  if (String(payload.week.qualityStatus || '').toUpperCase() === WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'quality_already_closed' });
  }

  const validation = validatePerceivedQualityClose(payload);
  if (!validation.canClose) {
    const primaryReason = validation.reasons[0] || 'Não foi possível fechar a Qualidade Percebida da semana.';
    if (String(payload.week.feedbackStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
      return res.status(409).json({ error: 'feedback_not_closed_for_quality', reasons: validation.reasons, lineIssues: validation.lineIssues });
    }
    return res.status(400).json({
      error: 'quality_incomplete',
      message: primaryReason,
      reasons: validation.reasons,
      lineIssues: validation.lineIssues,
    });
  }

  await prisma.week.update({
    where: { id: req.week.id },
    data: {
      qualityStatus: WEEK_STATUS.CLOSED,
      qualityClosedAt: new Date(),
      qualityClosedById: req.user.id,
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WEEK_PERCEIVED_QUALITY',
    entityId: req.week.id,
    eventType: 'PERCEIVED_QUALITY_CLOSED',
    description: `Qualidade percebida da semana ${payload.week.weekNumber} fechada.`,
  });

  const closedPayload = await buildPerceivedQualityWeekPayload(req.week.id);
  return res.json(closedPayload);
}));

router.get('/weeks/:weekId/perceived-quality/export/pdf', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  if (!PDFDocument) return res.status(500).json({ error: 'pdf_dependency_missing' });

  const payload = await buildPerceivedQualityWeekPayload(req.week.id);
  if (!payload) return res.status(404).json({ error: 'week_not_found' });
  if (String(payload.week.qualityStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'quality_not_closed' });
  }

  const appConfig = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  const timeZone = inferBrazilTimeZoneFromWork(payload.work);
  const week = payload.week;
  const rows = payload.rows || [];

  const fileName = `PPC-Qualidade-Percebida-Semana-${sanitizeFileName(week.weekNumber)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 24 });
  doc.pipe(res);

  const COLORS = {
    border: '#8fb4cd',
    card: '#eef6fb',
    title: '#d9ecf8',
    header: '#c3d8ea',
    rowA: '#f5fbff',
    rowB: '#ffffff',
    text: '#0e3850',
    faceGood: '#21a35e',
    faceRegular: '#f2c94c',
    faceBad: '#d14b52',
  };
  const margin = 24;
  const contentWidth = doc.page.width - (margin * 2);
  const pageBottom = () => doc.page.height - margin;

  const drawRoundBox = (x, y, w, h, fill = '#fff', border = COLORS.border, radius = 6) => {
    doc.save()
      .roundedRect(x, y, w, h, radius)
      .fillAndStroke(fill, border)
      .restore();
  };

  const bandVisual = (band) => {
    const normalized = String(band || '').trim().toUpperCase();
    if (normalized === 'BOM') return { mood: 'good', color: COLORS.faceGood };
    if (normalized === 'REGULAR') return { mood: 'regular', color: COLORS.faceRegular };
    if (normalized === 'RUIM') return { mood: 'bad', color: COLORS.faceBad };
    return null;
  };

  const drawFace = (x, y, size, band) => {
    const visual = bandVisual(band);
    if (!visual) return;

    const r = Math.max(5, size / 2);
    const cx = x + r;
    const cy = y + r;

    doc.save();
    doc.circle(cx, cy, r).fillAndStroke(visual.color, '#336079');

    doc.fillColor('#1e3240');
    doc.circle(cx - (r * 0.35), cy - (r * 0.25), Math.max(0.9, r * 0.1)).fill();
    doc.circle(cx + (r * 0.35), cy - (r * 0.25), Math.max(0.9, r * 0.1)).fill();

    doc.lineWidth(1).strokeColor('#1e3240');
    if (visual.mood === 'good') {
      doc.moveTo(cx - (r * 0.48), cy + (r * 0.25))
        .quadraticCurveTo(cx, cy + (r * 0.72), cx + (r * 0.48), cy + (r * 0.25))
        .stroke();
    } else if (visual.mood === 'bad') {
      doc.moveTo(cx - (r * 0.48), cy + (r * 0.52))
        .quadraticCurveTo(cx, cy + (r * 0.1), cx + (r * 0.48), cy + (r * 0.52))
        .stroke();
    } else {
      doc.moveTo(cx - (r * 0.45), cy + (r * 0.42))
        .lineTo(cx + (r * 0.45), cy + (r * 0.42))
        .stroke();
    }
    doc.restore();
  };

  let y = margin;

  const logoW = 80;
  const topH = 56;
  drawRoundBox(margin, y, logoW, topH, '#f7fbff', COLORS.border, 8);
  const logoDataUrl = String(appConfig?.logoPath || '').trim();
  if (logoDataUrl.startsWith('data:image/')) {
    const logoBuffer = decodeImageDataUrl(logoDataUrl);
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, margin + 6, y + 6, { fit: [logoW - 12, topH - 12], align: 'center', valign: 'center' });
      } catch {
        // no-op
      }
    }
  }

  const companyX = margin + logoW + 8;
  const companyW = contentWidth - logoW - 8;
  drawRoundBox(companyX, y, companyW, topH, COLORS.card, COLORS.border, 8);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
    .text(String(appConfig?.companyName || '-'), companyX + 10, y + 8, {
      width: companyW - 20,
      align: 'center',
      lineBreak: false,
    });
  doc.font('Helvetica').fontSize(9)
    .text(`CNPJ: ${String(appConfig?.companyCnpj || '-')}`, companyX + 10, y + 28, { width: 180, lineBreak: false });
  doc.text(String(appConfig?.companyAddress || '-'), companyX + 190, y + 28, { width: companyW - 200, lineBreak: false });
  if (appConfig?.companySite) {
    doc.text(String(appConfig.companySite), companyX + 10, y + 42, { width: companyW - 20, lineBreak: false });
  }
  y += topH + 8;

  drawRoundBox(margin, y, contentWidth, 28, COLORS.title, COLORS.border, 8);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text)
    .text(
      `QUALIDADE PERCEBIDA - SEMANA ${week.weekNumber} | ${formatDateBr(week.startDate)} a ${formatDateBr(week.endDate)}`,
      margin + 8,
      y + 8,
      { width: contentWidth - 16, align: 'center', lineBreak: false },
    );
  y += 36;

  const feedbackClosedBy = week.feedbackClosedBy?.name ? ` por ${week.feedbackClosedBy.name}` : '';
  const qualityClosedBy = week.qualityClosedBy?.name ? ` por ${week.qualityClosedBy.name}` : '';
  drawRoundBox(margin, y, contentWidth, 42, COLORS.card, COLORS.border, 7);
  doc.font('Helvetica').fontSize(9.2).fillColor(COLORS.text)
    .text(`Obra: ${payload.work?.name || '-'}`, margin + 10, y + 7, { width: contentWidth - 20, lineBreak: false })
    .text(`Fechamento do feedback: ${formatDateTimeBrInTimeZone(week.feedbackClosedAt, timeZone)}${feedbackClosedBy}`, margin + 10, y + 20, { width: contentWidth - 20, lineBreak: false })
    .text(`Fechamento da qualidade percebida: ${formatDateTimeBrInTimeZone(week.qualityClosedAt, timeZone)}${qualityClosedBy} | Impresso em: ${formatDateTimeBrInTimeZone(new Date(), timeZone)}`, margin + 10, y + 32, { width: contentWidth - 20, lineBreak: false });
  y += 50;

  const FACE_SCALE = 0.75;
  const legendFaceSize = Math.round(24 * FACE_SCALE);
  drawRoundBox(margin, y, contentWidth, 40, COLORS.card, COLORS.border, 7);
  const legendFaceY = y + 8;
  let legendX = margin + 12;
  drawFace(legendX, legendFaceY, legendFaceSize, 'RUIM');
  doc.font('Helvetica-Bold').fontSize(9.6).fillColor(COLORS.text)
    .text('Ruim', legendX + 28, y + 14, { width: 42, lineBreak: false });
  legendX += 86;
  drawFace(legendX, legendFaceY, legendFaceSize, 'REGULAR');
  doc.text('Regular', legendX + 28, y + 14, { width: 52, lineBreak: false });
  legendX += 98;
  drawFace(legendX, legendFaceY, legendFaceSize, 'BOM');
  doc.text('Bom', legendX + 28, y + 14, { width: 40, lineBreak: false });
  y += 48;

  const columns = [
    { key: 'seq', title: '#', width: 25, align: 'center' },
    { key: 'contractor', title: 'Empreiteiro', width: 180, align: 'center' },
    { key: 'deadline', title: 'Prazo', width: 68, align: 'center' },
    { key: 'quality', title: 'Qualidade', width: 68, align: 'center' },
    { key: 'collaboration', title: 'Colaboração', width: 68, align: 'center' },
    { key: 'safety', title: 'Segurança', width: 68, align: 'center' },
    { key: 'cleaning', title: 'Limpeza', width: 68, align: 'center' },
  ];
  const rowH = 36;
  const faceSize = Math.round(24 * FACE_SCALE);
  const contractorTextScale = 0.75;
  const textYFor = (startY, height, fontSize) => startY + Math.max(0, ((height - fontSize) / 2) - 1);

  const drawHeader = (startY) => {
    drawRoundBox(margin, startY, contentWidth, rowH, COLORS.header, COLORS.border, 5);
    let x = margin;
    columns.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.5)
          .moveTo(x, startY).lineTo(x, startY + rowH).stroke().restore();
      }
      const headerFont = 9.1;
      doc.font('Helvetica-Bold').fontSize(headerFont).fillColor(COLORS.text)
        .text(col.title, x + 2, textYFor(startY, rowH, headerFont), {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
        });
      x += col.width;
    });
  };

  const drawRow = (startY, row, idx) => {
    const fill = idx % 2 === 0 ? COLORS.rowA : COLORS.rowB;
    drawRoundBox(margin, startY, contentWidth, rowH, fill, COLORS.border, 3);
    const bandsByCol = {
      deadline: row.deadlineBand,
      quality: row.qualityBand,
      collaboration: row.collaborationBand,
      safety: row.safetyBand,
      cleaning: row.cleaningBand,
    };
    const values = {
      seq: String(idx + 1),
      contractor: row.contractorName || '-',
      deadline: '',
      quality: '',
      collaboration: '',
      safety: '',
      cleaning: '',
    };

    let x = margin;
    columns.forEach((col, colIdx) => {
      if (colIdx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.45)
          .moveTo(x, startY).lineTo(x, startY + rowH).stroke().restore();
      }
      const faceBand = bandsByCol[col.key] || null;
      if (faceBand) {
        drawFace(x + ((col.width - faceSize) / 2), startY + ((rowH - faceSize) / 2), faceSize, faceBand);
      }
      const baseFont = col.key === 'contractor'
        ? (10.2 * contractorTextScale)
        : (col.key === 'seq' ? (9.2 * contractorTextScale) : 9.2);
      const showText = col.key === 'seq' || col.key === 'contractor' || !faceBand;
      if (showText) {
        doc.font('Helvetica').fontSize(baseFont).fillColor(COLORS.text)
          .text(values[col.key] || '-', x + 2, textYFor(startY, rowH, baseFont), {
            width: col.width - 4,
            align: 'center',
            lineBreak: false,
          });
      }
      x += col.width;
    });
  };

  drawHeader(y);
  y += rowH + 2;

  if (!rows.length) {
    drawRoundBox(margin, y, contentWidth, rowH, COLORS.rowA, COLORS.border, 3);
    doc.font('Helvetica').fontSize(9.2).fillColor(COLORS.text)
      .text('Sem empreiteiros avaliados nesta semana.', margin + 8, textYFor(y, rowH, 9.2), {
        width: contentWidth - 16,
        align: 'center',
      });
    y += rowH + 2;
  } else {
    rows.forEach((row, idx) => {
      if (y + rowH > pageBottom()) {
        doc.addPage({ size: 'A4', layout: 'portrait', margin: 24 });
        y = margin;
        drawHeader(y);
        y += rowH + 2;
      }
      drawRow(y, row, idx);
      y += rowH + 2;
    });
  }

  doc.end();
}));

router.get('/weeks/:weekId/ppc-meeting', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  const week = await prisma.week.findUnique({
    where: { id: req.week.id },
    select: { id: true, workId: true, weekNumber: true, startDate: true, endDate: true },
  });
  if (!week) return res.status(404).json({ error: 'week_not_found' });

  let meeting = await prisma.weekPpcMeeting.findUnique({
    where: { weekId: week.id },
    include: { attendances: true, closedBy: { select: { name: true } } },
  });
  if (!meeting) {
    meeting = await prisma.weekPpcMeeting.create({
      data: { weekId: week.id },
      include: { attendances: true, closedBy: { select: { name: true } } },
    });
  }

  const contractors = await listActiveContractorsByWeek(week.id, week.workId);
  const missingAttendanceRows = contractors
    .filter((contractor) => !meeting.attendances.some((item) => Number(item.contractorId) === Number(contractor.id)))
    .map((contractor) => ({
      meetingId: meeting.id,
      contractorId: contractor.id,
      present: false,
    }));
  if (missingAttendanceRows.length) {
    for (const row of missingAttendanceRows) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.ppcMeetingAttendance.upsert({
        where: {
          meetingId_contractorId: {
            meetingId: row.meetingId,
            contractorId: row.contractorId,
          },
        },
        create: row,
        update: {},
      });
    }
    meeting = await prisma.weekPpcMeeting.findUnique({
      where: { id: meeting.id },
      include: { attendances: true, closedBy: { select: { name: true } } },
    });
  }

  let suggestedMeetingAt = null;
  if (!meeting.meetingAt) {
    const previousWeek = await prisma.week.findUnique({
      where: { workId_weekNumber: { workId: week.workId, weekNumber: week.weekNumber - 1 } },
      select: {
        id: true,
        startDate: true,
        ppcMeeting: { select: { meetingAt: true } },
      },
    });
    if (previousWeek?.ppcMeeting?.meetingAt) {
      suggestedMeetingAt = addDays(previousWeek.ppcMeeting.meetingAt, 7);
    } else {
      const fallback = new Date(week.startDate);
      fallback.setHours(15, 0, 0, 0);
      fallback.setDate(fallback.getDate() + 2); // quarta-feira da semana
      suggestedMeetingAt = fallback;
    }
  }

  return res.json(serializePpcMeeting(meeting, week, contractors, suggestedMeetingAt));
}));

router.put('/weeks/:weekId/ppc-meeting/pre', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const meetingAt = parseDateTimeInput(req.body.meetingAt);
  if (!meetingAt) return res.status(400).json({ error: 'meeting_datetime_required' });

  const current = await prisma.weekPpcMeeting.findUnique({
    where: { weekId: req.week.id },
    include: { attendances: true, closedBy: { select: { name: true } } },
  }) || await prisma.weekPpcMeeting.create({
    data: { weekId: req.week.id },
    include: { attendances: true, closedBy: { select: { name: true } } },
  });

  if (current.isClosed) return res.status(409).json({ error: 'ppc_meeting_closed' });

  const updated = await prisma.weekPpcMeeting.update({
    where: { id: current.id },
    data: { meetingAt },
    include: { attendances: true, closedBy: { select: { name: true } } },
  });

  const contractors = await listActiveContractorsByWeek(req.week.id, req.workId);
  return res.json(serializePpcMeeting(updated, req.week, contractors));
}));

router.put('/weeks/:weekId/ppc-meeting/post', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const minutes = String(req.body.minutes || '').trim();
  const attendanceItems = Array.isArray(req.body.attendance) ? req.body.attendance : [];

  const current = await prisma.weekPpcMeeting.findUnique({
    where: { weekId: req.week.id },
    include: { attendances: true, closedBy: { select: { name: true } } },
  }) || await prisma.weekPpcMeeting.create({
    data: { weekId: req.week.id },
    include: { attendances: true, closedBy: { select: { name: true } } },
  });
  if (current.isClosed) return res.status(409).json({ error: 'ppc_meeting_closed' });

  const contractors = await listActiveContractorsByWeek(req.week.id, req.workId);
  const contractorIdSet = new Set(contractors.map((item) => Number(item.id)));

  for (const row of attendanceItems) {
    const contractorId = parseIntId(row.contractorId);
    if (!contractorId || !contractorIdSet.has(contractorId)) continue;
    // eslint-disable-next-line no-await-in-loop
    await prisma.ppcMeetingAttendance.upsert({
      where: { meetingId_contractorId: { meetingId: current.id, contractorId } },
      create: {
        meetingId: current.id,
        contractorId,
        present: row.present === true,
      },
      update: {
        present: row.present === true,
      },
    });
  }

  const updated = await prisma.weekPpcMeeting.update({
    where: { id: current.id },
    data: { minutes },
    include: { attendances: true, closedBy: { select: { name: true } } },
  });

  return res.json(serializePpcMeeting(updated, req.week, contractors));
}));

router.post('/weeks/:weekId/ppc-meeting/close', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  if (String(req.week.prePlanningStatus || '').toUpperCase() !== WEEK_STATUS.CLOSED) {
    return res.status(409).json({ error: 'ppc_meeting_requires_pre_planning_close' });
  }

  const current = await prisma.weekPpcMeeting.findUnique({
    where: { weekId: req.week.id },
    include: { attendances: true, closedBy: { select: { name: true } } },
  });
  if (!current) return res.status(404).json({ error: 'ppc_meeting_not_found' });
  if (current.isClosed) return res.status(409).json({ error: 'ppc_meeting_already_closed' });
  if (!String(current.minutes || '').trim()) return res.status(400).json({ error: 'ppc_meeting_minutes_required' });

  const updated = await prisma.weekPpcMeeting.update({
    where: { id: current.id },
    data: {
      isClosed: true,
      closedAt: new Date(),
      closedById: req.user.id,
    },
    include: { attendances: true, closedBy: { select: { name: true } } },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WEEK_PPC_MEETING',
    entityId: updated.id,
    eventType: 'PPC_MEETING_CLOSED',
    description: `Reunião de PPC da semana ${req.week.weekNumber} fechada.`,
  });

  const contractors = await listActiveContractorsByWeek(req.week.id, req.workId);
  return res.json(serializePpcMeeting(updated, req.week, contractors));
}));

router.post('/weeks/:weekId/rollover', authenticate, loadUser, requireWeekRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER]), asyncHandler(async (req, res) => {
  const nextWeekId = parseIntId(req.body.nextWeekId);
  let nextWeek = null;

  if (nextWeekId) {
    nextWeek = await prisma.week.findUnique({ where: { id: nextWeekId } });
  } else {
    nextWeek = await prisma.week.findUnique({
      where: { workId_weekNumber: { workId: req.workId, weekNumber: req.week.weekNumber + 1 } },
    });
  }

  if (!nextWeek || nextWeek.workId !== req.workId) return res.status(400).json({ error: 'target_week_not_found_or_invalid' });
  const result = await rollPendingTasksToNextWeek(req.week, nextWeek);
  return res.json({ ...result, targetWeekId: nextWeek.id });
}));

module.exports = router;
