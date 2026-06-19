const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { writeAudit } = require('../lib/audit');
const { ROLES } = require('../lib/constants');
const { asyncHandler, parseIntId, normalizeRole, parseDate } = require('../lib/helpers');
const { authenticate, loadUser, requireWorkRoles, userIsAdminAnywhere } = require('../lib/auth');
let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
} catch {
  PDFDocument = null;
}

const router = Router();
const NAME_COMPANY_SPLITTER = ' | ';
const CAUSE_SPLITTER = '::';
const CAUSE_L1_PREFIX = 'L1::';
const CAUSE_L2_PREFIX = 'L2::';
const CAUSE_L2_CONTRACTOR_PREFIX = 'L2C::';
const ZONE_L1_PREFIX = '__ZONE_L1__::';
const LABOR_MARKER = 'LABOR:';
const HIDDEN_WORK_PREFIX = '__HIDDEN__';
let globalCauseCatalogMigrated = false;
let globalCauseCatalogMigrationPromise = null;

function normalizeCep(rawCep) {
  return String(rawCep || '').replace(/\D/g, '');
}

function normalizePhone(rawPhone) {
  return String(rawPhone || '').replace(/\D/g, '');
}

function normalizeLaborTypeName(rawName) {
  return String(rawName || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('pt-BR');
}

function isHiddenWork(work) {
  const name = String(work?.name || '').trim();
  if (!name) return false;
  if (name.toUpperCase() === 'TESTE') return true;
  if (name.toUpperCase().startsWith(`${HIDDEN_WORK_PREFIX}_`) || name.toUpperCase().startsWith(`${HIDDEN_WORK_PREFIX} `)) return true;
  if (name.toUpperCase().startsWith(HIDDEN_WORK_PREFIX)) return true;
  return false;
}

function isValidPhoneWithDdd(rawPhone) {
  const digits = normalizePhone(rawPhone);
  return digits.length === 10 || digits.length === 11;
}

const MONTH_LABELS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAY_LABELS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function formatDateBrUtc(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function formatDateTimeBr(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
  });
}

function holidayKeyParts(dayDate) {
  const date = new Date(dayDate);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

function dataUrlImageBuffer(dataUrl) {
  const text = String(dataUrl || '').trim();
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(text);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

function parseNameAndCompany(rawName) {
  const text = String(rawName || '').trim();
  if (!text) return { name: '', company: '' };
  const idx = text.indexOf(NAME_COMPANY_SPLITTER);
  if (idx < 0) return { name: text, company: '' };
  return {
    name: text.slice(0, idx).trim(),
    company: text.slice(idx + NAME_COMPANY_SPLITTER.length).trim(),
  };
}

function composeNameAndCompany(name, company) {
  const person = String(name || '').trim();
  const org = String(company || '').trim();
  if (!person) return '';
  if (!org) return person;
  return `${person}${NAME_COMPANY_SPLITTER}${org}`;
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

  if (text.startsWith(CAUSE_L1_PREFIX)) {
    const category = text.slice(CAUSE_L1_PREFIX.length).trim();
    return {
      level: 1,
      category,
      cause: '',
      label: category,
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

  // Compatibilidade com formato legado: "Categoria::Causa"
  const idx = text.indexOf(CAUSE_SPLITTER);
  if (idx >= 0) {
    const category = text.slice(0, idx).trim() || 'Geral';
    const cause = text.slice(idx + CAUSE_SPLITTER.length).trim() || '';
    return {
      level: 2,
      category,
      cause,
      label: `${category} - ${cause}`,
      contractorSpecific: false,
    };
  }

  // Texto simples legado vira totalizadora.
  return {
    level: 1,
    category: text,
    cause: '',
    label: text,
    contractorSpecific: false,
  };
}

function buildCauseDescription(body) {
  const requestedLevel = parseIntId(body.level || body.nivel);
  const category = String(body.category || body.totalizadora || body.totalizer || '').trim();
  const detail = String(body.cause || body.item || '').trim();
  const description = String(body.description || '').trim();

  if (requestedLevel === 1) {
    const totalizer = (category || description).toLocaleUpperCase('pt-BR');
    if (!totalizer) return null;
    return `${CAUSE_L1_PREFIX}${totalizer}`;
  }

  if (requestedLevel === 2) {
    const parent = category;
    const cause = detail || description;
    const contractorSpecific = body.contractorSpecific === true || String(body.contractorSpecific || '').toLowerCase() === 'true';
    if (!parent || !cause) return null;
    return `${contractorSpecific ? CAUSE_L2_CONTRACTOR_PREFIX : CAUSE_L2_PREFIX}${parent}${CAUSE_SPLITTER}${cause}`;
  }

  // Compatibilidade com payload antigo.
  if (category && detail) return `${CAUSE_L2_PREFIX}${category}${CAUSE_SPLITTER}${detail}`;
  if (!description) return null;
  return `${CAUSE_L1_PREFIX}${description}`;
}

function mapCause(item) {
  const parsed = parseCauseDescription(item.description);
  return {
    ...item,
    level: parsed.level,
    category: parsed.category,
    cause: parsed.cause,
    description: parsed.label,
    contractorSpecific: parsed.contractorSpecific === true,
  };
}

function normalizeDateOnly(raw) {
  const parsed = parseDate(raw);
  if (!parsed) return null;
  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function ensureGlobalCauseCatalog() {
  if (globalCauseCatalogMigrated) return;
  if (globalCauseCatalogMigrationPromise) {
    await globalCauseCatalogMigrationPromise;
    return;
  }

  globalCauseCatalogMigrationPromise = (async () => {
    const allCauses = await prisma.cause.findMany({
      select: { id: true, workId: true, description: true },
      orderBy: { id: 'asc' },
    });
    if (!allCauses.length) {
      globalCauseCatalogMigrated = true;
      return;
    }

    const globalByDescription = new Map();
    allCauses
      .filter((item) => item.workId === null)
      .forEach((item) => {
        if (!globalByDescription.has(item.description)) {
          globalByDescription.set(item.description, item.id);
        }
      });

    const legacyCauses = allCauses.filter((item) => item.workId !== null);
    const replacements = [];

    for (const legacy of legacyCauses) {
      let globalId = globalByDescription.get(legacy.description);
      if (!globalId) {
        // eslint-disable-next-line no-await-in-loop
        const created = await prisma.cause.create({
          data: { workId: null, description: legacy.description },
          select: { id: true, description: true },
        });
        globalId = created.id;
        globalByDescription.set(created.description, created.id);
      }
      replacements.push({ fromId: legacy.id, toId: globalId });
    }

    for (const item of replacements) {
      if (item.fromId === item.toId) continue;
      // eslint-disable-next-line no-await-in-loop
      await prisma.feedback.updateMany({
        where: { causeId: item.fromId },
        data: { causeId: item.toId },
      });
    }

    const legacyIds = legacyCauses.map((item) => item.id);
    if (legacyIds.length) {
      await prisma.cause.deleteMany({ where: { id: { in: legacyIds } } });
    }

    const refreshedGlobals = await prisma.cause.findMany({
      where: { workId: null },
      select: { id: true, description: true },
      orderBy: { id: 'asc' },
    });
    const duplicateGroups = new Map();
    refreshedGlobals.forEach((item) => {
      const list = duplicateGroups.get(item.description) || [];
      list.push(item.id);
      duplicateGroups.set(item.description, list);
    });
    for (const ids of duplicateGroups.values()) {
      if (!ids || ids.length <= 1) continue;
      const keepId = ids[0];
      const deleteIds = ids.slice(1);
      // eslint-disable-next-line no-await-in-loop
      await prisma.feedback.updateMany({
        where: { causeId: { in: deleteIds } },
        data: { causeId: keepId },
      });
      // eslint-disable-next-line no-await-in-loop
      await prisma.cause.deleteMany({ where: { id: { in: deleteIds } } });
    }

    globalCauseCatalogMigrated = true;
  })();

  try {
    await globalCauseCatalogMigrationPromise;
  } finally {
    globalCauseCatalogMigrationPromise = null;
  }
}

async function ensureCauseParentExists(category) {
  const normalized = String(category || '').trim();
  if (!normalized) return false;
  const parent = await prisma.cause.findFirst({
    where: {
      workId: null,
      OR: [
        { description: `${CAUSE_L1_PREFIX}${normalized}` },
        { description: normalized },
      ],
    },
    select: { id: true },
  });
  return Boolean(parent);
}

function parseContractorContact(contact) {
  const text = String(contact || '').trim();
  if (!text) return {
    supervisor: '',
    communicationEmail: '',
    phone: '',
    notes: '',
    isActive: true,
    sourceContractorId: null,
    selectedInWork: false,
  };

  const result = {
    supervisor: '',
    communicationEmail: '',
    phone: '',
    notes: '',
    isActive: true,
    sourceContractorId: null,
    selectedInWork: false,
  };
  const parts = text.split('|').map((part) => part.trim()).filter(Boolean);
  let parsedAny = false;

  for (const part of parts) {
    const [rawKey, ...rest] = part.split('=');
    const key = String(rawKey || '').trim().toUpperCase();
    const value = rest.join('=').trim();
    if (!value) continue;
    if (key === 'ENCARREGADO') {
      result.supervisor = value;
      parsedAny = true;
      continue;
    }
    if (key === 'EMAIL') {
      result.communicationEmail = value;
      parsedAny = true;
      continue;
    }
    if (key === 'TELEFONE') {
      result.phone = value;
      parsedAny = true;
      continue;
    }
    if (key === 'OBS') {
      result.notes = value;
      parsedAny = true;
      continue;
    }
    if (key === 'ATIVO') {
      result.isActive = value === '1' || value.toLowerCase() === 'true';
      parsedAny = true;
      continue;
    }
    if (key === 'ORIGEM_ID') {
      const parsedId = parseIntId(value);
      result.sourceContractorId = parsedId || null;
      parsedAny = true;
      continue;
    }
    if (key === 'EM_OBRA') {
      result.selectedInWork = value === '1' || value.toLowerCase() === 'true';
      parsedAny = true;
      continue;
    }
  }

  if (!parsedAny) {
    result.notes = text;
  }

  return result;
}

function buildContractorContact({
  supervisor,
  communicationEmail,
  phone,
  notes,
  contact,
  isActive,
  sourceContractorId,
  selectedInWork,
}) {
  const parts = [];
  const s = String(supervisor || '').trim();
  const e = String(communicationEmail || '').trim();
  const p = String(phone || '').trim();
  const n = String(notes || contact || '').trim();
  if (s) parts.push(`ENCARREGADO=${s}`);
  if (e) parts.push(`EMAIL=${e}`);
  if (p) parts.push(`TELEFONE=${p}`);
  if (n) parts.push(`OBS=${n}`);
  if (isActive !== undefined) parts.push(`ATIVO=${isActive ? '1' : '0'}`);
  if (sourceContractorId) parts.push(`ORIGEM_ID=${sourceContractorId}`);
  if (selectedInWork !== undefined) parts.push(`EM_OBRA=${selectedInWork ? '1' : '0'}`);
  return parts.length ? parts.join(' | ') : null;
}

function zoneLevel1Marker(level1) {
  return `${ZONE_L1_PREFIX}${String(level1 || '').trim()}`;
}

function isZoneLevel1Location(location) {
  return String(location?.level2 || '').startsWith(ZONE_L1_PREFIX);
}

async function resolveContractorFunctionId(functionId, functionName) {
  const id = parseIntId(functionId);
  if (id) return id;
  const name = normalizeLaborTypeName(functionName);
  if (!name) return null;

  const existing = await prisma.contractorFunction.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.contractorFunction.create({ data: { name } });
  return created.id;
}

async function findDefaultContractorByFunction(workId, functionName) {
  const name = normalizeLaborTypeName(functionName);
  if (!name) return null;
  const row = await prisma.contractor.findFirst({
    where: { workId, function: { is: { name } } },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return row ? row.id : null;
}

function laborTypeFromMarker(defaultSupervisor) {
  const text = String(defaultSupervisor || '').trim();
  if (!text.startsWith(LABOR_MARKER)) return null;
  return text.slice(LABOR_MARKER.length).trim() || null;
}

async function fetchCepInfo(cep) {
  const cleanCep = normalizeCep(cep);
  if (cleanCep.length !== 8) return null;
  const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
  if (!response.ok) return null;
  const data = await response.json();
  if (!data.city || !data.state) return null;
  return {
    cep: cleanCep,
    street: data.street || '',
    neighborhood: data.neighborhood || '',
    city: data.city || '',
    state: data.state || '',
  };
}

const requireGlobalAdmin = asyncHandler(async (req, res, next) => {
  const isAdmin = await userIsAdminAnywhere(req.user.id);
  if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
  return next();
});

async function findOrCreateLocation(workId, level1, level2) {
  const existing = await prisma.location.findUnique({
    where: { workId_level1_level2: { workId, level1, level2 } },
  });
  if (existing) return existing;
  return prisma.location.create({ data: { workId, level1, level2 } });
}

router.get('/utils/cep/:cep', authenticate, loadUser, asyncHandler(async (req, res) => {
  const info = await fetchCepInfo(req.params.cep);
  if (!info) return res.status(404).json({ error: 'cep_not_found' });
  return res.json(info);
}));

router.get('/works', authenticate, loadUser, asyncHandler(async (req, res) => {
  const now = new Date();
  const allRequested = req.query.all === 'true';
  const isAdmin = await userIsAdminAnywhere(req.user.id);

  if (allRequested && isAdmin) {
    const works = await prisma.work.findMany({ orderBy: { id: 'asc' } });
    return res.json(works.filter((work) => !isHiddenWork(work)));
  }

  const assignments = await prisma.userWorkRole.findMany({
    where: {
      userId: req.user.id,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    include: { work: true },
  });

  const unique = [];
  const seen = new Set();
  for (const item of assignments) {
    if (seen.has(item.workId)) continue;
    seen.add(item.workId);
    unique.push(item.work);
  }

  return res.json(unique.filter((work) => !isHiddenWork(work)));
}));

router.post('/works', authenticate, loadUser, asyncHandler(async (req, res) => {
  const isAdmin = await userIsAdminAnywhere(req.user.id);
  if (!isAdmin) {
    return res.status(403).json({ error: 'only_admin_can_create_work' });
  }

  const {
    name,
    cep,
    startDate,
    ppcTargetPct,
    address,
    street,
    neighborhood,
    city,
    state,
    number,
    complement,
  } = req.body;

  const normalizedName = String(name || '').trim();
  const normalizedCepInput = String(cep || '').trim();
  const normalizedStreetInput = String(street || '').trim();
  const normalizedNeighborhoodInput = String(neighborhood || '').trim();
  const normalizedCityInput = String(city || '').trim();
  const normalizedStateInput = String(state || '').trim();
  const normalizedNumberInput = String(number || '').trim();
  const normalizedComplementInput = String(complement || '').trim();
  const parsedPpcTargetPct = Number.parseFloat(ppcTargetPct);
  const normalizedPpcTargetPct = Number.isFinite(parsedPpcTargetPct) ? parsedPpcTargetPct : 80;
  const parsedStartDate = parseDate(startDate);
  if (
    !normalizedName
    || !normalizedCepInput
    || !normalizedStreetInput
    || !normalizedNeighborhoodInput
    || !normalizedCityInput
    || !normalizedStateInput
    || !normalizedNumberInput
    || !normalizedComplementInput
    || !parsedStartDate
  ) {
    return res.status(400).json({ error: 'work_creation_all_fields_required' });
  }
  if (normalizedPpcTargetPct < 0 || normalizedPpcTargetPct > 100) {
    return res.status(400).json({ error: 'invalid_ppc_target_pct' });
  }

  const cepInfo = await fetchCepInfo(normalizedCepInput);
  if (!cepInfo) return res.status(400).json({ error: 'invalid_cep' });

  const normalizedStreet = normalizedStreetInput;
  const normalizedNeighborhood = normalizedNeighborhoodInput;
  const normalizedCity = normalizedCityInput;
  const normalizedState = normalizedStateInput;
  const normalizedNumber = normalizedNumberInput;
  const normalizedComplement = normalizedComplementInput;

  const formattedAddress = address
    || `${normalizedStreet || 'Sem logradouro'}, ${normalizedNumber || 'S/N'} - ${normalizedNeighborhood || 'Sem bairro'}, ${normalizedCity}/${normalizedState}${normalizedComplement ? ` (${normalizedComplement})` : ''}`;

  const work = await prisma.work.create({
    data: {
      name: normalizedName,
      cep: cepInfo.cep,
      address: formattedAddress,
      startDate: parsedStartDate,
      ppcTargetPct: normalizedPpcTargetPct,
    },
  });

  await prisma.userWorkRole.create({
    data: { userId: req.user.id, workId: work.id, role: ROLES.ADMIN },
  });

  await writeAudit({
    userId: req.user.id,
    workId: work.id,
    entityType: 'WORK',
    entityId: work.id,
    eventType: 'WORK_CREATED',
    description: `Obra ${work.name} criada.`,
  });

  return res.status(201).json(work);
}));

router.put('/works/:workId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const work = await prisma.work.findUnique({ where: { id: req.workId } });
  if (!work) return res.status(404).json({ error: 'work_not_found' });

  const hasName = Object.prototype.hasOwnProperty.call(req.body, 'name');
  const hasCep = Object.prototype.hasOwnProperty.call(req.body, 'cep');
  const hasStartDate = Object.prototype.hasOwnProperty.call(req.body, 'startDate');
  const hasAddress = Object.prototype.hasOwnProperty.call(req.body, 'address');
  const hasPpcTargetPct = Object.prototype.hasOwnProperty.call(req.body, 'ppcTargetPct');
  const hasStreet = Object.prototype.hasOwnProperty.call(req.body, 'street');
  const hasNeighborhood = Object.prototype.hasOwnProperty.call(req.body, 'neighborhood');
  const hasCity = Object.prototype.hasOwnProperty.call(req.body, 'city');
  const hasState = Object.prototype.hasOwnProperty.call(req.body, 'state');
  const hasNumber = Object.prototype.hasOwnProperty.call(req.body, 'number');
  const hasComplement = Object.prototype.hasOwnProperty.call(req.body, 'complement');

  let cepInfo = null;
  let normalizedCep = work.cep;
  if (hasCep) {
    cepInfo = await fetchCepInfo(req.body.cep);
    if (!cepInfo) return res.status(400).json({ error: 'invalid_cep' });
    normalizedCep = cepInfo.cep;
  }

  let parsedStartDate = work.startDate;
  if (hasStartDate) {
    parsedStartDate = parseDate(req.body.startDate);
    if (!parsedStartDate) return res.status(400).json({ error: 'invalid_startDate' });
  }

  let normalizedPpcTargetPct = Number(work.ppcTargetPct || 80);
  if (hasPpcTargetPct) {
    const parsedTarget = Number.parseFloat(req.body.ppcTargetPct);
    if (!Number.isFinite(parsedTarget) || parsedTarget < 0 || parsedTarget > 100) {
      return res.status(400).json({ error: 'invalid_ppc_target_pct' });
    }
    normalizedPpcTargetPct = parsedTarget;
  }

  let formattedAddress = work.address;
  if (hasAddress) {
    formattedAddress = String(req.body.address || '').trim() || work.address;
  } else if (hasStreet || hasNeighborhood || hasCity || hasState || hasNumber || hasComplement || hasCep) {
    const street = String((hasStreet ? req.body.street : null) || cepInfo?.street || '').trim();
    const neighborhood = String((hasNeighborhood ? req.body.neighborhood : null) || cepInfo?.neighborhood || '').trim();
    const city = String((hasCity ? req.body.city : null) || cepInfo?.city || '').trim();
    const state = String((hasState ? req.body.state : null) || cepInfo?.state || '').trim();
    const number = String((hasNumber ? req.body.number : null) || '').trim();
    const complement = String((hasComplement ? req.body.complement : null) || '').trim();
    formattedAddress = `${street || 'Sem logradouro'}, ${number || 'S/N'} - ${neighborhood || 'Sem bairro'}, ${city || 'Sem cidade'}/${state || 'UF'}${complement ? ` (${complement})` : ''}`;
  }

  const updated = await prisma.work.update({
    where: { id: req.workId },
    data: {
      name: hasName ? String(req.body.name || '').trim() || work.name : work.name,
      cep: normalizedCep,
      address: formattedAddress,
      startDate: parsedStartDate,
      ppcTargetPct: normalizedPpcTargetPct,
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WORK',
    entityId: req.workId,
    eventType: 'WORK_UPDATED',
    description: `Obra ${updated.name} atualizada.`,
  });

  return res.json(updated);
}));

router.delete('/works/:workId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const weekCount = await prisma.week.count({ where: { workId: req.workId } });
  if (weekCount > 0) {
    return res.status(409).json({ error: 'work_has_planning_history' });
  }

  const work = await prisma.work.findUnique({ where: { id: req.workId } });
  if (!work) return res.status(404).json({ error: 'work_not_found' });

  const contractors = await prisma.contractor.findMany({
    where: { workId: req.workId },
    select: { id: true },
  });
  const contractorIds = contractors.map((c) => c.id);
  if (contractorIds.length > 0) {
    await prisma.user.updateMany({
      where: { contractorId: { in: contractorIds } },
      data: { contractorId: null },
    });
  }

  const groups = await prisma.taskGroup.findMany({
    where: { workId: req.workId },
    select: { id: true },
  });
  const groupIds = groups.map((g) => g.id);
  if (groupIds.length > 0) {
    await prisma.taskGroupItem.deleteMany({ where: { taskGroupId: { in: groupIds } } });
  }

  await prisma.userWorkRole.deleteMany({ where: { workId: req.workId } });
  await prisma.futureWeekAuthorization.deleteMany({ where: { workId: req.workId } });
  await prisma.notificationRule.deleteMany({ where: { workId: req.workId } });
  await prisma.userProfileAssignment.deleteMany({ where: { workId: req.workId } });
  await prisma.taskGroup.deleteMany({ where: { workId: req.workId } });
  await prisma.cause.deleteMany({ where: { workId: req.workId } });
  await prisma.location.deleteMany({ where: { workId: req.workId } });
  await prisma.holiday.deleteMany({ where: { workId: req.workId } });
  await prisma.contractor.deleteMany({ where: { workId: req.workId } });
  await prisma.work.delete({ where: { id: req.workId } });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WORK',
    entityId: req.workId,
    eventType: 'WORK_DELETED',
    description: `Obra ${work.name} excluida.`,
  });

  return res.status(204).send();
}));

router.get('/works/:workId/assignments', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const rows = await prisma.userWorkRole.findMany({
    where: { workId: req.workId },
    include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    orderBy: [{ userId: 'asc' }, { startsAt: 'asc' }],
  });
  return res.json(rows);
}));

router.get('/works/:workId/users', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const rows = await prisma.userWorkRole.findMany({
    where: { workId: req.workId },
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true, contractorId: true } },
    },
    orderBy: [{ userId: 'asc' }, { startsAt: 'asc' }],
  });
  const profileRows = await prisma.userProfileAssignment.findMany({
    where: { workId: req.workId },
    include: {
      profile: { select: { id: true, name: true, baseRole: true } },
    },
    orderBy: [{ userId: 'asc' }, { startsAt: 'asc' }],
  });

  const byUser = new Map();
  const now = new Date();
  for (const row of rows) {
    if (!byUser.has(row.userId)) {
      const split = parseNameAndCompany(row.user.name);
      byUser.set(row.userId, {
        id: row.user.id,
        name: split.name,
        company: split.company,
        email: row.user.email,
        isActive: row.user.isActive,
        contractorId: row.user.contractorId,
        roles: [],
      assignments: [],
      profileAssignments: [],
    });
  }
    const entry = byUser.get(row.userId);
    entry.roles.push(row.role);
    entry.assignments.push({
      id: row.id,
      role: row.role,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      isActiveNow: row.startsAt <= now && (!row.endsAt || row.endsAt > now),
    });
  }
  for (const row of profileRows) {
    if (!byUser.has(row.userId)) continue;
    const entry = byUser.get(row.userId);
    entry.profileAssignments.push({
      id: row.id,
      profileId: row.profileId,
      profileName: row.profile?.name || '',
      baseRole: row.profile?.baseRole || '',
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      roleAssignmentId: row.roleAssignmentId,
      isActiveNow: row.startsAt <= now && (!row.endsAt || row.endsAt > now),
    });
  }

  const list = [...byUser.values()]
    .map((item) => ({
      ...item,
      roles: [...new Set(item.roles)],
      assignments: item.assignments.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
      profileAssignments: item.profileAssignments.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return res.json(list);
}));

router.post('/works/:workId/users', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const { name, company, email, password, role, contractorId, startsAt, endsAt } = req.body;
  const normalizedCompany = String(company || '').trim();
  const normalizedName = composeNameAndCompany(name, company);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '').trim();
  const normalizedRole = normalizeRole(role);

  if (!normalizedName || !normalizedCompany || !normalizedEmail || !normalizedRole) {
    return res.status(400).json({ error: 'user_creation_all_fields_required' });
  }
  if (!Object.values(ROLES).includes(normalizedRole)) {
    return res.status(400).json({ error: 'invalid_role' });
  }

  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    if (!normalizedPassword) return res.status(400).json({ error: 'password_required_for_new_user' });
    const passwordHash = await bcrypt.hash(normalizedPassword, 10);
    user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
        contractorId: parseIntId(contractorId),
      },
    });
    await writeAudit({
      userId: req.user.id,
      workId: req.workId,
      entityType: 'USER',
      entityId: user.id,
      eventType: 'USER_CREATED',
      description: `Usuario ${user.email} criado.`,
    });
  } else {
    const updateData = {};
    if (normalizedName && normalizedName !== user.name) updateData.name = normalizedName;
    const parsedContractorId = parseIntId(contractorId);
    if (parsedContractorId) updateData.contractorId = parsedContractorId;
    if (normalizedPassword) updateData.passwordHash = await bcrypt.hash(normalizedPassword, 10);
    if (Object.keys(updateData).length) {
      user = await prisma.user.update({ where: { id: user.id }, data: updateData });
    }
  }

  const alreadyAssigned = await prisma.userWorkRole.findFirst({
    where: {
      userId: user.id,
      workId: req.workId,
      role: normalizedRole,
      startsAt: { lte: new Date() },
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (alreadyAssigned) return res.status(409).json({ error: 'user_role_already_assigned' });

  const assignment = await prisma.userWorkRole.create({
    data: {
      userId: user.id,
      workId: req.workId,
      role: normalizedRole,
      startsAt: parseDate(startsAt) || new Date(),
      endsAt: parseDate(endsAt),
      assignedById: req.user.id,
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'USER_WORK_ROLE',
    entityId: assignment.id,
    eventType: 'ROLE_ASSIGNED',
    description: `Papel ${assignment.role} atribuido ao usuario ${user.email}.`,
  });

  const split = parseNameAndCompany(user.name);
  return res.status(201).json({
    id: user.id,
    name: split.name,
    company: split.company,
    email: user.email,
    role: assignment.role,
  });
}));

router.put('/works/:workId/users/:userId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const userId = parseIntId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'invalid_user_id' });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const hasAnyAssignment = await prisma.userWorkRole.findFirst({
    where: { userId, workId: req.workId },
    select: { id: true },
  });
  if (!hasAnyAssignment) return res.status(404).json({ error: 'user_not_in_work' });

  const splitCurrent = parseNameAndCompany(user.name);
  const hasName = Object.prototype.hasOwnProperty.call(req.body, 'name');
  const hasCompany = Object.prototype.hasOwnProperty.call(req.body, 'company');
  const hasEmail = Object.prototype.hasOwnProperty.call(req.body, 'email');
  const hasPassword = Object.prototype.hasOwnProperty.call(req.body, 'password');
  const hasContractorId = Object.prototype.hasOwnProperty.call(req.body, 'contractorId');

  const updateData = {};
  if (hasName || hasCompany) {
    const finalName = hasName ? String(req.body.name || '').trim() : splitCurrent.name;
    const finalCompany = hasCompany ? String(req.body.company || '').trim() : splitCurrent.company;
    if (!finalName) return res.status(400).json({ error: 'name_required' });
    updateData.name = composeNameAndCompany(finalName, finalCompany);
  }
  if (hasEmail) {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ error: 'email_required' });
    updateData.email = normalizedEmail;
  }
  if (hasPassword) {
    const rawPassword = String(req.body.password || '').trim();
    if (rawPassword) {
      updateData.passwordHash = await bcrypt.hash(rawPassword, 10);
    }
  }
  if (hasContractorId) {
    const parsedContractorId = parseIntId(req.body.contractorId);
    updateData.contractorId = parsedContractorId || null;
  }

  let updatedUser = user;
  if (Object.keys(updateData).length > 0) {
    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  const promotionMode = String(req.body.promotionMode || '').trim().toUpperCase();
  const isPermanentPromotion = promotionMode === 'PERMANENT';
  const hasPromotionMode = Object.prototype.hasOwnProperty.call(req.body, 'promotionMode');
  if (hasPromotionMode && promotionMode && !isPermanentPromotion) {
    return res.status(400).json({ error: 'invalid_promotion_mode' });
  }

  let updatedAssignment = null;
  const hasAssignmentPayload = ['assignmentId', 'role', 'startsAt', 'endsAt', 'promotionMode']
    .some((field) => Object.prototype.hasOwnProperty.call(req.body, field));
  if (hasAssignmentPayload) {
    const assignmentId = parseIntId(req.body.assignmentId);
    const roleRaw = req.body.role;
    const hasStartsAt = Object.prototype.hasOwnProperty.call(req.body, 'startsAt');
    const hasEndsAt = Object.prototype.hasOwnProperty.call(req.body, 'endsAt');

    if (isPermanentPromotion) {
      const normalizedRole = normalizeRole(roleRaw);
      if (!Object.values(ROLES).includes(normalizedRole)) return res.status(400).json({ error: 'invalid_role' });
      const effectiveStart = hasStartsAt ? parseDate(req.body.startsAt) : new Date();
      if (!effectiveStart) return res.status(400).json({ error: 'invalid_startsAt' });

      updatedAssignment = await prisma.$transaction(async (tx) => {
        await tx.userWorkRole.updateMany({
          where: {
            userId,
            workId: req.workId,
            startsAt: { lte: effectiveStart },
            OR: [{ endsAt: null }, { endsAt: { gt: effectiveStart } }],
          },
          data: { endsAt: effectiveStart },
        });

        return tx.userWorkRole.create({
          data: {
            userId,
            workId: req.workId,
            role: normalizedRole,
            startsAt: effectiveStart,
            endsAt: null,
            assignedById: req.user.id,
          },
        });
      });

      await writeAudit({
        userId: req.user.id,
        workId: req.workId,
        entityType: 'USER_WORK_ROLE',
        entityId: updatedAssignment.id,
        eventType: 'ROLE_PROMOTED_PERMANENT',
        description: `Promocao permanente para ${updatedAssignment.role} do usuario ${updatedUser.email}.`,
      });
    } else if (assignmentId) {
      const assignment = await prisma.userWorkRole.findUnique({ where: { id: assignmentId } });
      if (!assignment || assignment.workId !== req.workId || assignment.userId !== userId) {
        return res.status(404).json({ error: 'assignment_not_found' });
      }

      const assignmentData = {};
      if (roleRaw !== undefined) {
        const normalizedRole = normalizeRole(roleRaw);
        if (!Object.values(ROLES).includes(normalizedRole)) return res.status(400).json({ error: 'invalid_role' });
        assignmentData.role = normalizedRole;
      }
      if (hasStartsAt) {
        const parsedStart = parseDate(req.body.startsAt);
        if (!parsedStart) return res.status(400).json({ error: 'invalid_startsAt' });
        assignmentData.startsAt = parsedStart;
      }
      if (hasEndsAt) {
        if (req.body.endsAt === null || String(req.body.endsAt).trim() === '') {
          assignmentData.endsAt = null;
        } else {
          const parsedEnd = parseDate(req.body.endsAt);
          if (!parsedEnd) return res.status(400).json({ error: 'invalid_endsAt' });
          assignmentData.endsAt = parsedEnd;
        }
      }
      if (Object.keys(assignmentData).length) {
        updatedAssignment = await prisma.userWorkRole.update({
          where: { id: assignmentId },
          data: assignmentData,
        });
      }
    } else if (roleRaw !== undefined) {
      const normalizedRole = normalizeRole(roleRaw);
      if (!Object.values(ROLES).includes(normalizedRole)) return res.status(400).json({ error: 'invalid_role' });
      const parsedStart = hasStartsAt ? parseDate(req.body.startsAt) : new Date();
      if (!parsedStart) return res.status(400).json({ error: 'invalid_startsAt' });
      let parsedEnd = null;
      if (hasEndsAt && req.body.endsAt !== null && String(req.body.endsAt).trim() !== '') {
        parsedEnd = parseDate(req.body.endsAt);
        if (!parsedEnd) return res.status(400).json({ error: 'invalid_endsAt' });
      }

      updatedAssignment = await prisma.userWorkRole.create({
        data: {
          userId,
          workId: req.workId,
          role: normalizedRole,
          startsAt: parsedStart,
          endsAt: parsedEnd,
          assignedById: req.user.id,
        },
      });
    }
  }

  const splitUpdated = parseNameAndCompany(updatedUser.name);
  return res.json({
    id: updatedUser.id,
    name: splitUpdated.name,
    company: splitUpdated.company,
    email: updatedUser.email,
    assignment: updatedAssignment
      ? {
        id: updatedAssignment.id,
        role: updatedAssignment.role,
        startsAt: updatedAssignment.startsAt,
        endsAt: updatedAssignment.endsAt,
      }
      : null,
  });
}));

router.delete('/works/:workId/users/:userId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const userId = parseIntId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'invalid_user_id' });

  const existing = await prisma.userWorkRole.findFirst({
    where: { userId, workId: req.workId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'user_not_in_work' });

  const now = new Date();
  await prisma.userWorkRole.updateMany({
    where: {
      userId,
      workId: req.workId,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    data: { endsAt: now },
  });

  await prisma.userProfileAssignment.updateMany({
    where: {
      userId,
      workId: req.workId,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    data: { endsAt: now },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'USER_WORK_ROLE',
    entityId: userId,
    eventType: 'USER_UNASSIGNED_FROM_WORK',
    description: `Usuario ${userId} desvinculado da obra ${req.workId}.`,
  });

  return res.status(204).send();
}));

router.post('/works/:workId/assignments', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const { userId, role, startsAt, endsAt } = req.body;
  if (!userId || !role) return res.status(400).json({ error: 'userId_role_required' });

  const assignment = await prisma.userWorkRole.create({
    data: {
      userId,
      workId: req.workId,
      role: normalizeRole(role),
      startsAt: parseDate(startsAt) || new Date(),
      endsAt: parseDate(endsAt),
      assignedById: req.user.id,
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'USER_WORK_ROLE',
    entityId: assignment.id,
    eventType: 'ROLE_ASSIGNED',
    description: `Papel ${assignment.role} atribuido ao usuario ${userId}.`,
  });

  return res.status(201).json(assignment);
}));

router.get('/works/:workId/contractor-functions', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (_req, res) => {
  const list = await prisma.contractorFunction.findMany({ orderBy: { name: 'asc' } });
  return res.json(list);
}));

router.post('/works/:workId/contractor-functions', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const name = normalizeLaborTypeName(req.body.name);
  if (!name) return res.status(400).json({ error: 'name_required' });
  const existing = await prisma.contractorFunction.findUnique({ where: { name } });
  if (existing) return res.json(existing);
  const created = await prisma.contractorFunction.create({ data: { name } });
  return res.status(201).json(created);
}));

router.put('/works/:workId/contractor-functions/:functionId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const functionId = parseIntId(req.params.functionId);
  if (!functionId) return res.status(400).json({ error: 'invalid_function_id' });

  const nextName = normalizeLaborTypeName(req.body.name);
  if (!nextName) return res.status(400).json({ error: 'name_required' });

  const existing = await prisma.contractorFunction.findUnique({ where: { id: functionId } });
  if (!existing) return res.status(404).json({ error: 'function_not_found' });

  const duplicate = await prisma.contractorFunction.findUnique({ where: { name: nextName } });
  if (duplicate && duplicate.id !== functionId) {
    return res.status(409).json({ error: 'name_already_exists' });
  }

  const updated = await prisma.contractorFunction.update({
    where: { id: functionId },
    data: { name: nextName },
  });

  if (existing.name !== nextName) {
    await prisma.taskGroupItem.updateMany({
      where: { defaultSupervisor: `${LABOR_MARKER}${existing.name}` },
      data: { defaultSupervisor: `${LABOR_MARKER}${nextName}` },
    });
  }

  return res.json(updated);
}));

router.delete('/works/:workId/contractor-functions/:functionId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const functionId = parseIntId(req.params.functionId);
  if (!functionId) return res.status(400).json({ error: 'invalid_function_id' });

  const existing = await prisma.contractorFunction.findUnique({ where: { id: functionId } });
  if (!existing) return res.status(404).json({ error: 'function_not_found' });

  const [contractorCount, markerCount] = await Promise.all([
    prisma.contractor.count({ where: { functionId } }),
    prisma.taskGroupItem.count({ where: { defaultSupervisor: `${LABOR_MARKER}${existing.name}` } }),
  ]);
  if (contractorCount > 0 || markerCount > 0) {
    return res.status(409).json({ error: 'labor_type_in_use' });
  }

  await prisma.contractorFunction.delete({ where: { id: functionId } });
  return res.status(204).send();
}));

router.get('/works/:workId/contractors', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const importedOnly = req.query.importedOnly === 'true';
  const generalOnly = req.query.generalOnly === 'true';
  const list = await prisma.contractor.findMany({
    where: { workId: req.workId },
    include: { function: true },
    orderBy: { name: 'asc' },
  });
  const mapped = list.map((item) => ({
    ...item,
    ...parseContractorContact(item.contact),
    laborType: item.function?.name || null,
  }));
  let filtered = includeInactive ? mapped : mapped.filter((item) => item.isActive !== false);
  if (importedOnly) filtered = filtered.filter((item) => Boolean(item.sourceContractorId) || item.selectedInWork === true);
  if (generalOnly) filtered = filtered.filter((item) => !item.sourceContractorId);
  return res.json(filtered);
}));

router.get('/works/:workId/contractors/catalog', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const functionName = normalizeLaborTypeName(req.query.functionName || '');
  const where = {};
  if (functionName) {
    where.function = { is: { name: functionName } };
  }

  const rows = await prisma.contractor.findMany({
    where,
    include: {
      function: true,
      work: { select: { id: true, name: true } },
    },
    orderBy: [{ name: 'asc' }],
  });

  return res.json(rows
    .map((item) => {
      const parsed = parseContractorContact(item.contact);
      return {
        id: item.id,
        name: item.name,
        ...parsed,
        laborType: item.function?.name || null,
        originWork: item.work ? { id: item.work.id, name: item.work.name } : null,
      };
    })
    .filter((item) => item.isActive !== false)
    .filter((item) => !item.sourceContractorId)
    .filter((item) => !(Number(item.originWork?.id) === Number(req.workId) && item.selectedInWork === true)));
}));

router.get('/global/contractors', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (_req, res) => {
  const rows = await prisma.contractor.findMany({
    where: {},
    include: {
      function: true,
      work: { select: { id: true, name: true } },
    },
    orderBy: [{ name: 'asc' }],
  });

  return res.json(rows
    .filter((item) => !parseContractorContact(item.contact).sourceContractorId)
    .filter((item) => !isHiddenWork(item.work))
    .map((item) => ({
      ...item,
      ...parseContractorContact(item.contact),
      laborType: item.function?.name || null,
      originWork: item.work ? { id: item.work.id, name: item.work.name } : null,
    })));
}));

router.post('/global/contractors', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const {
    name,
    contact,
    notes,
    supervisor,
    communicationEmail,
    email,
    phone,
    functionId,
    functionName,
    laborType,
    workId,
  } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedSupervisor = String(supervisor || '').trim();
  const normalizedEmail = String(communicationEmail || email || '').trim();
  const normalizedPhone = normalizePhone(phone);
  const normalizedFunctionName = normalizeLaborTypeName(functionName || laborType || '');
  if (!normalizedName || !normalizedSupervisor || !normalizedEmail || !normalizedPhone || !normalizedFunctionName) {
    return res.status(400).json({ error: 'contractor_all_fields_required' });
  }
  if (!isValidPhoneWithDdd(normalizedPhone)) return res.status(400).json({ error: 'invalid_contractor_phone' });
  const resolvedFunctionId = await resolveContractorFunctionId(functionId, normalizedFunctionName);
  if (!resolvedFunctionId) return res.status(400).json({ error: 'contractor_function_required' });

  let targetWorkId = parseIntId(workId);
  if (targetWorkId) {
    const targetWork = await prisma.work.findUnique({ where: { id: targetWorkId } });
    if (!targetWork || isHiddenWork(targetWork)) targetWorkId = null;
  }
  if (!targetWorkId) {
    const fallbackWork = await prisma.work.findFirst({
      orderBy: { id: 'asc' },
    });
    if (!fallbackWork || isHiddenWork(fallbackWork)) {
      const visibleWork = await prisma.work.findMany({ orderBy: { id: 'asc' } });
      const firstVisible = visibleWork.find((item) => !isHiddenWork(item));
      targetWorkId = firstVisible?.id || null;
    } else {
      targetWorkId = fallbackWork.id;
    }
  }
  if (!targetWorkId) return res.status(400).json({ error: 'work_required' });

  const item = await prisma.contractor.create({
    data: {
      workId: targetWorkId,
      name: normalizedName,
      contact: buildContractorContact({
        supervisor: normalizedSupervisor,
        communicationEmail: normalizedEmail,
        phone: normalizedPhone,
        notes,
        contact,
        isActive: true,
        sourceContractorId: null,
        selectedInWork: false,
      }),
      functionId: resolvedFunctionId,
    },
    include: {
      function: true,
      work: { select: { id: true, name: true } },
    },
  });

  return res.status(201).json({
    ...item,
    ...parseContractorContact(item.contact),
    laborType: item.function?.name || null,
    originWork: item.work ? { id: item.work.id, name: item.work.name } : null,
  });
}));

router.put('/global/contractors/:contractorId', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const contractorId = parseIntId(req.params.contractorId);
  if (!contractorId) return res.status(400).json({ error: 'invalid_contractor_id' });

  const existing = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: {
      function: true,
      work: { select: { id: true, name: true } },
    },
  });
  if (!existing) return res.status(404).json({ error: 'contractor_not_found' });

  const existingContact = parseContractorContact(existing.contact);
  if (existingContact.sourceContractorId) {
    return res.status(409).json({ error: 'contractor_not_found' });
  }

  const {
    name,
    contact,
    notes,
    supervisor,
    communicationEmail,
    email,
    phone,
    functionId,
    functionName,
    laborType,
  } = req.body;

  const finalName = String(name || '').trim() || existing.name;
  const finalSupervisor = String((supervisor ?? existingContact.supervisor) || '').trim();
  const finalEmail = String(((communicationEmail || email) ?? existingContact.communicationEmail) || '').trim();
  const finalPhone = normalizePhone((phone ?? existingContact.phone) || '');
  const finalFunctionName = normalizeLaborTypeName(functionName || laborType || existing.function?.name || '');
  if (!finalName || !finalSupervisor || !finalEmail || !finalPhone || !finalFunctionName) {
    return res.status(400).json({ error: 'contractor_all_fields_required' });
  }
  if (!isValidPhoneWithDdd(finalPhone)) return res.status(400).json({ error: 'invalid_contractor_phone' });

  const resolvedFunctionId = await resolveContractorFunctionId(functionId, finalFunctionName);
  if (!resolvedFunctionId) return res.status(400).json({ error: 'contractor_function_required' });

  const updated = await prisma.contractor.update({
    where: { id: contractorId },
    data: {
      name: finalName,
      contact: buildContractorContact({
        supervisor: finalSupervisor,
        communicationEmail: finalEmail,
        phone: finalPhone,
        notes: notes ?? existingContact.notes,
        contact,
        isActive: existingContact.isActive,
        sourceContractorId: existingContact.sourceContractorId,
        selectedInWork: existingContact.selectedInWork,
      }),
      functionId: resolvedFunctionId,
    },
    include: {
      function: true,
      work: { select: { id: true, name: true } },
    },
  });

  return res.json({
    ...updated,
    ...parseContractorContact(updated.contact),
    laborType: updated.function?.name || null,
    originWork: updated.work ? { id: updated.work.id, name: updated.work.name } : null,
  });
}));

router.delete('/global/contractors/:contractorId', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const contractorId = parseIntId(req.params.contractorId);
  if (!contractorId) return res.status(400).json({ error: 'invalid_contractor_id' });
  const existing = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: { function: true },
  });
  if (!existing) return res.status(404).json({ error: 'contractor_not_found' });

  const parsedExisting = parseContractorContact(existing.contact);
  if (parsedExisting.sourceContractorId) {
    return res.status(404).json({ error: 'contractor_not_found' });
  }

  const [taskCount, userCount, groupItemCount] = await Promise.all([
    prisma.task.count({ where: { contractorId } }),
    prisma.user.count({ where: { contractorId } }),
    prisma.taskGroupItem.count({ where: { defaultContractorId: contractorId } }),
  ]);

  if (parsedExisting.selectedInWork) {
    const deselected = await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        contact: buildContractorContact({
          supervisor: parsedExisting.supervisor,
          communicationEmail: parsedExisting.communicationEmail,
          phone: parsedExisting.phone,
          notes: parsedExisting.notes,
          isActive: parsedExisting.isActive,
          sourceContractorId: null,
          selectedInWork: false,
        }),
      },
      include: { function: true },
    });
    return res.json({
      deselected: true,
      contractor: {
        ...deselected,
        ...parseContractorContact(deselected.contact),
        laborType: deselected.function?.name || null,
      },
    });
  }

  if (taskCount > 0) {
    const archived = await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        contact: buildContractorContact({
          supervisor: parsedExisting.supervisor,
          communicationEmail: parsedExisting.communicationEmail,
          phone: parsedExisting.phone,
          notes: parsedExisting.notes,
          isActive: false,
          sourceContractorId: parsedExisting.sourceContractorId,
          selectedInWork: parsedExisting.selectedInWork,
        }),
      },
      include: { function: true },
    });
    return res.json({
      archived: true,
      contractor: {
        ...archived,
        ...parseContractorContact(archived.contact),
        laborType: archived.function?.name || null,
      },
    });
  }
  if (userCount > 0 || groupItemCount > 0) {
    return res.status(409).json({ error: 'contractor_in_use' });
  }

  await prisma.contractor.delete({ where: { id: contractorId } });
  return res.status(204).send();
}));

router.post('/works/:workId/contractors/import', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const sourceContractorId = parseIntId(req.body.sourceContractorId);
  if (!sourceContractorId) return res.status(400).json({ error: 'source_contractor_required' });

  const source = await prisma.contractor.findUnique({
    where: { id: sourceContractorId },
    include: { function: true },
  });
  if (!source) return res.status(404).json({ error: 'source_contractor_not_found' });
  const sourceContact = parseContractorContact(source.contact);
  if (sourceContact.sourceContractorId) {
    return res.status(400).json({ error: 'source_must_be_general' });
  }
  if (source.workId === req.workId) {
    if (sourceContact.selectedInWork) return res.status(409).json({ error: 'contractor_already_in_work' });
    const selected = await prisma.contractor.update({
      where: { id: source.id },
      data: {
        contact: buildContractorContact({
          supervisor: sourceContact.supervisor,
          communicationEmail: sourceContact.communicationEmail,
          phone: sourceContact.phone,
          notes: sourceContact.notes,
          isActive: sourceContact.isActive,
          sourceContractorId: null,
          selectedInWork: true,
        }),
      },
      include: { function: true },
    });
    return res.json({
      ...selected,
      ...parseContractorContact(selected.contact),
      laborType: selected.function?.name || null,
    });
  }

  const importedFromSource = await prisma.contractor.findMany({
    where: {
      workId: req.workId,
      contact: { contains: `ORIGEM_ID=${source.id}` },
    },
    include: { function: true },
  });
  const importedRows = importedFromSource.map((item) => ({
    ...item,
    parsedContact: parseContractorContact(item.contact),
  }));
  const activeImported = importedRows.find((item) => item.parsedContact.isActive !== false);
  if (activeImported) return res.status(409).json({ error: 'contractor_already_in_work' });

  const archivedImported = importedRows.find((item) => item.parsedContact.isActive === false);
  const nameConflict = await prisma.contractor.findFirst({
    where: {
      workId: req.workId,
      name: source.name,
      ...(archivedImported ? { id: { not: archivedImported.id } } : {}),
    },
    select: { id: true },
  });
  if (nameConflict) return res.status(409).json({ error: 'contractor_name_conflict' });

  if (archivedImported) {
    const reactivated = await prisma.contractor.update({
      where: { id: archivedImported.id },
      data: {
        name: source.name,
        functionId: source.functionId,
        contact: buildContractorContact({
          supervisor: sourceContact.supervisor,
          communicationEmail: sourceContact.communicationEmail,
          phone: sourceContact.phone,
          notes: sourceContact.notes,
          isActive: true,
          sourceContractorId: source.id,
        }),
      },
      include: { function: true },
    });

    return res.json({
      ...reactivated,
      ...parseContractorContact(reactivated.contact),
      laborType: reactivated.function?.name || null,
    });
  }

  const created = await prisma.contractor.create({
    data: {
      workId: req.workId,
      name: source.name,
      functionId: source.functionId,
      contact: buildContractorContact({
        supervisor: sourceContact.supervisor,
        communicationEmail: sourceContact.communicationEmail,
        phone: sourceContact.phone,
        notes: sourceContact.notes,
        isActive: true,
        sourceContractorId: source.id,
        selectedInWork: true,
      }),
    },
    include: { function: true },
  });

  return res.status(201).json({
    ...created,
    ...parseContractorContact(created.contact),
    laborType: created.function?.name || null,
  });
}));

router.post('/works/:workId/contractors', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const {
    name,
    contact,
    notes,
    supervisor,
    communicationEmail,
    email,
    phone,
    functionId,
    functionName,
    laborType,
  } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedSupervisor = String(supervisor || '').trim();
  const normalizedEmail = String(communicationEmail || email || '').trim();
  const normalizedPhone = normalizePhone(phone);
  const normalizedFunctionName = normalizeLaborTypeName(functionName || laborType || '');
  if (!normalizedName || !normalizedSupervisor || !normalizedEmail || !normalizedPhone || !normalizedFunctionName) {
    return res.status(400).json({ error: 'contractor_all_fields_required' });
  }
  if (!isValidPhoneWithDdd(normalizedPhone)) return res.status(400).json({ error: 'invalid_contractor_phone' });
  const resolvedFunctionId = await resolveContractorFunctionId(functionId, normalizedFunctionName);
  if (!resolvedFunctionId) return res.status(400).json({ error: 'contractor_function_required' });

  const item = await prisma.contractor.create({
    data: {
      workId: req.workId,
      name: normalizedName,
      contact: buildContractorContact({
        supervisor: normalizedSupervisor,
        communicationEmail: normalizedEmail,
        phone: normalizedPhone,
        notes,
        contact,
        isActive: true,
        sourceContractorId: null,
        selectedInWork: false,
      }),
      functionId: resolvedFunctionId,
    },
    include: { function: true },
  });

  return res.status(201).json({
    ...item,
    ...parseContractorContact(item.contact),
    laborType: item.function?.name || null,
  });
}));

router.put('/works/:workId/contractors/:contractorId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const contractorId = parseIntId(req.params.contractorId);
  if (!contractorId) return res.status(400).json({ error: 'invalid_contractor_id' });

  const existing = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: { function: true },
  });
  if (!existing || existing.workId !== req.workId) {
    return res.status(404).json({ error: 'contractor_not_found' });
  }

  const {
    name,
    contact,
    notes,
    supervisor,
    communicationEmail,
    email,
    phone,
    functionId,
    functionName,
    laborType,
  } = req.body;

  const currentContact = parseContractorContact(existing.contact);
  const finalName = String(name || '').trim() || existing.name;
  const finalSupervisor = String((supervisor ?? currentContact.supervisor) || '').trim();
  const finalEmail = String(((communicationEmail || email) ?? currentContact.communicationEmail) || '').trim();
  const finalPhone = normalizePhone((phone ?? currentContact.phone) || '');
  const finalFunctionName = normalizeLaborTypeName(functionName || laborType || existing.function?.name || '');
  if (!finalName || !finalSupervisor || !finalEmail || !finalPhone || !finalFunctionName) {
    return res.status(400).json({ error: 'contractor_all_fields_required' });
  }
  if (!isValidPhoneWithDdd(finalPhone)) return res.status(400).json({ error: 'invalid_contractor_phone' });

  const resolvedFunctionId = await resolveContractorFunctionId(functionId, finalFunctionName);
  if (!resolvedFunctionId) return res.status(400).json({ error: 'contractor_function_required' });
  const updated = await prisma.contractor.update({
    where: { id: contractorId },
    data: {
      name: finalName,
      contact: buildContractorContact({
        supervisor: finalSupervisor,
        communicationEmail: finalEmail,
        phone: finalPhone,
        notes: notes ?? currentContact.notes,
        contact,
        isActive: currentContact.isActive,
        sourceContractorId: currentContact.sourceContractorId,
        selectedInWork: currentContact.selectedInWork,
      }),
      functionId: resolvedFunctionId,
    },
    include: { function: true },
  });

  return res.json({
    ...updated,
    ...parseContractorContact(updated.contact),
    laborType: updated.function?.name || null,
  });
}));

router.delete('/works/:workId/contractors/:contractorId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const contractorId = parseIntId(req.params.contractorId);
  if (!contractorId) return res.status(400).json({ error: 'invalid_contractor_id' });
  const existing = await prisma.contractor.findUnique({ where: { id: contractorId } });
  if (!existing || existing.workId !== req.workId) return res.status(404).json({ error: 'contractor_not_found' });

  const [taskCount, userCount, groupItemCount] = await Promise.all([
    prisma.task.count({ where: { contractorId } }),
    prisma.user.count({ where: { contractorId } }),
    prisma.taskGroupItem.count({ where: { defaultContractorId: contractorId } }),
  ]);
  const parsedExisting = parseContractorContact(existing.contact);
  if (!parsedExisting.sourceContractorId && parsedExisting.selectedInWork) {
    const deselected = await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        contact: buildContractorContact({
          supervisor: parsedExisting.supervisor,
          communicationEmail: parsedExisting.communicationEmail,
          phone: parsedExisting.phone,
          notes: parsedExisting.notes,
          isActive: parsedExisting.isActive,
          sourceContractorId: null,
          selectedInWork: false,
        }),
      },
      include: { function: true },
    });
    return res.json({
      deselected: true,
      contractor: {
        ...deselected,
        ...parseContractorContact(deselected.contact),
        laborType: deselected.function?.name || null,
      },
    });
  }
  if (taskCount > 0) {
    const parsed = parsedExisting;
    const archived = await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        contact: buildContractorContact({
          supervisor: parsed.supervisor,
          communicationEmail: parsed.communicationEmail,
          phone: parsed.phone,
          notes: parsed.notes,
          isActive: false,
          sourceContractorId: parsed.sourceContractorId,
          selectedInWork: parsed.selectedInWork,
        }),
      },
      include: { function: true },
    });
    return res.json({
      archived: true,
      contractor: {
        ...archived,
        ...parseContractorContact(archived.contact),
        laborType: archived.function?.name || null,
      },
    });
  }
  if (userCount > 0 || groupItemCount > 0) {
    return res.status(409).json({ error: 'contractor_in_use' });
  }

  await prisma.contractor.delete({ where: { id: contractorId } });
  return res.status(204).send();
}));

router.get('/works/:workId/causes', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  await ensureGlobalCauseCatalog();
  const items = await prisma.cause.findMany({
    where: { workId: null },
    orderBy: [{ description: 'asc' }],
  });
  return res.json(items.map(mapCause));
}));

router.post('/works/:workId/causes', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  await ensureGlobalCauseCatalog();
  const level = parseIntId(req.body.level || req.body.nivel);
  if (level !== 1 && level !== 2) return res.status(400).json({ error: 'cause_level_required' });
  const description = buildCauseDescription(req.body);
  if (!description) return res.status(400).json({ error: 'invalid_cause_payload' });
  const parsed = parseCauseDescription(description);

  if (parsed.level === 2) {
    const parentExists = await ensureCauseParentExists(parsed.category);
    if (!parentExists) return res.status(400).json({ error: 'parent_totalizer_not_found' });
  }

  const duplicate = await prisma.cause.findFirst({
    where: {
      workId: null,
      description,
    },
    select: { id: true },
  });
  if (duplicate) return res.status(409).json({ error: 'cause_already_exists' });

  const item = await prisma.cause.create({ data: { workId: null, description } });
  return res.status(201).json(mapCause(item));
}));

router.put('/works/:workId/causes/:causeId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  await ensureGlobalCauseCatalog();
  const causeId = parseIntId(req.params.causeId);
  if (!causeId) return res.status(400).json({ error: 'invalid_cause_id' });
  const existing = await prisma.cause.findUnique({ where: { id: causeId } });
  if (!existing || existing.workId !== null) {
    return res.status(404).json({ error: 'cause_not_found' });
  }

  const level = parseIntId(req.body.level || req.body.nivel);
  if (level !== 1 && level !== 2) return res.status(400).json({ error: 'cause_level_required' });
  const description = buildCauseDescription(req.body);
  if (!description) return res.status(400).json({ error: 'invalid_cause_payload' });

  const parsedExisting = parseCauseDescription(existing.description);
  const parsedNext = parseCauseDescription(description);
  if (parsedNext.level === 2) {
    const parentExists = await ensureCauseParentExists(parsedNext.category);
    if (!parentExists) return res.status(400).json({ error: 'parent_totalizer_not_found' });
  }

  const duplicate = await prisma.cause.findFirst({
    where: {
      id: { not: causeId },
      workId: null,
      description,
    },
    select: { id: true },
  });
  if (duplicate) return res.status(409).json({ error: 'cause_already_exists' });

  if (parsedExisting.level === 1 && parsedNext.level !== 1) {
    const childCount = await prisma.cause.count({
      where: {
        id: { not: causeId },
        workId: null,
        OR: [
          { description: { startsWith: `${CAUSE_L2_PREFIX}${parsedExisting.category}${CAUSE_SPLITTER}` } },
          { description: { startsWith: `${CAUSE_L2_CONTRACTOR_PREFIX}${parsedExisting.category}${CAUSE_SPLITTER}` } },
          { description: { startsWith: `${parsedExisting.category}${CAUSE_SPLITTER}` } },
        ],
      },
    });
    if (childCount > 0) return res.status(409).json({ error: 'cause_has_children' });
  }

  const updated = await prisma.cause.update({
    where: { id: causeId },
    data: { description },
  });

  if (parsedExisting.level === 1 && parsedNext.level === 1 && parsedExisting.category !== parsedNext.category) {
    const oldPrefixed = `${CAUSE_L2_PREFIX}${parsedExisting.category}${CAUSE_SPLITTER}`;
    const oldContractorPrefixed = `${CAUSE_L2_CONTRACTOR_PREFIX}${parsedExisting.category}${CAUSE_SPLITTER}`;
    const oldLegacy = `${parsedExisting.category}${CAUSE_SPLITTER}`;
    const newPrefixed = `${CAUSE_L2_PREFIX}${parsedNext.category}${CAUSE_SPLITTER}`;
    const newContractorPrefixed = `${CAUSE_L2_CONTRACTOR_PREFIX}${parsedNext.category}${CAUSE_SPLITTER}`;
    const related = await prisma.cause.findMany({
      where: {
        workId: null,
        OR: [
          { description: { startsWith: oldPrefixed } },
          { description: { startsWith: oldContractorPrefixed } },
          { description: { startsWith: oldLegacy } },
        ],
      },
    });
    for (const child of related) {
      let nextDescription = child.description;
      if (nextDescription.startsWith(oldPrefixed)) {
        nextDescription = `${newPrefixed}${nextDescription.slice(oldPrefixed.length)}`;
      } else if (nextDescription.startsWith(oldContractorPrefixed)) {
        nextDescription = `${newContractorPrefixed}${nextDescription.slice(oldContractorPrefixed.length)}`;
      } else if (nextDescription.startsWith(oldLegacy)) {
        nextDescription = `${newPrefixed}${nextDescription.slice(oldLegacy.length)}`;
      }
      if (nextDescription !== child.description) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.cause.update({
          where: { id: child.id },
          data: { description: nextDescription },
        });
      }
    }
  }

  return res.json(mapCause(updated));
}));

router.delete('/works/:workId/causes/:causeId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  await ensureGlobalCauseCatalog();
  const causeId = parseIntId(req.params.causeId);
  if (!causeId) return res.status(400).json({ error: 'invalid_cause_id' });
  const existing = await prisma.cause.findUnique({ where: { id: causeId } });
  if (!existing || existing.workId !== null) {
    return res.status(404).json({ error: 'cause_not_found' });
  }

  const parsed = parseCauseDescription(existing.description);
  if (parsed.level === 1) {
    const childCount = await prisma.cause.count({
      where: {
        id: { not: causeId },
        workId: null,
        OR: [
          { description: { startsWith: `${CAUSE_L2_PREFIX}${parsed.category}${CAUSE_SPLITTER}` } },
          { description: { startsWith: `${CAUSE_L2_CONTRACTOR_PREFIX}${parsed.category}${CAUSE_SPLITTER}` } },
          { description: { startsWith: `${parsed.category}${CAUSE_SPLITTER}` } },
        ],
      },
    });
    if (childCount > 0) return res.status(409).json({ error: 'cause_has_children' });
  }

  const feedbackCount = await prisma.feedback.count({ where: { causeId } });
  if (feedbackCount > 0) return res.status(409).json({ error: 'cause_in_use' });
  await prisma.cause.delete({ where: { id: causeId } });
  return res.status(204).send();
}));

router.get('/works/:workId/holidays', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const items = await prisma.holiday.findMany({
    where: { workId: req.workId },
    orderBy: [{ dayDate: 'asc' }, { id: 'asc' }],
  });
  return res.json(items);
}));

router.post('/works/:workId/holidays', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const dayDate = normalizeDateOnly(req.body.dayDate);
  const descriptionRaw = String(req.body.description || '').trim();
  if (!dayDate) return res.status(400).json({ error: 'invalid_holiday_date' });
  if (!descriptionRaw) return res.status(400).json({ error: 'holiday_description_required' });
  const description = descriptionRaw;

  const duplicate = await prisma.holiday.findUnique({
    where: {
      workId_dayDate: {
        workId: req.workId,
        dayDate,
      },
    },
  });
  if (duplicate) return res.status(409).json({ error: 'holiday_already_exists' });

  const item = await prisma.holiday.create({
    data: {
      workId: req.workId,
      dayDate,
      description,
    },
  });
  return res.status(201).json(item);
}));

router.put('/works/:workId/holidays/:holidayId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const holidayId = parseIntId(req.params.holidayId);
  if (!holidayId) return res.status(400).json({ error: 'invalid_holiday_id' });
  const existing = await prisma.holiday.findUnique({ where: { id: holidayId } });
  if (!existing || existing.workId !== req.workId) return res.status(404).json({ error: 'holiday_not_found' });

  const hasDayDate = Object.prototype.hasOwnProperty.call(req.body, 'dayDate');
  const hasDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
  if (!hasDayDate && !hasDescription) return res.status(400).json({ error: 'holiday_payload_required' });

  const data = {};
  if (hasDayDate) {
    const normalized = normalizeDateOnly(req.body.dayDate);
    if (!normalized) return res.status(400).json({ error: 'invalid_holiday_date' });
    data.dayDate = normalized;
  }
  if (hasDescription) {
    const text = String(req.body.description || '').trim();
    if (!text) return res.status(400).json({ error: 'holiday_description_required' });
    data.description = text;
  } else if (!String(existing.description || '').trim()) {
    return res.status(400).json({ error: 'holiday_description_required' });
  }

  const targetDate = data.dayDate || existing.dayDate;
  if (targetDate.getTime() !== existing.dayDate.getTime()) {
    const duplicate = await prisma.holiday.findUnique({
      where: {
        workId_dayDate: {
          workId: req.workId,
          dayDate: targetDate,
        },
      },
    });
    if (duplicate && duplicate.id !== holidayId) return res.status(409).json({ error: 'holiday_already_exists' });
  }

  const updated = await prisma.holiday.update({
    where: { id: holidayId },
    data,
  });
  return res.json(updated);
}));

router.delete('/works/:workId/holidays/:holidayId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const holidayId = parseIntId(req.params.holidayId);
  if (!holidayId) return res.status(400).json({ error: 'invalid_holiday_id' });
  const existing = await prisma.holiday.findUnique({ where: { id: holidayId } });
  if (!existing || existing.workId !== req.workId) return res.status(404).json({ error: 'holiday_not_found' });
  await prisma.holiday.delete({ where: { id: holidayId } });
  return res.status(204).send();
}));

router.get('/works/:workId/holidays/calendar/pdf', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (!PDFDocument) return res.status(500).json({ error: 'pdf_dependency_missing' });

  const [work, appConfig, holidays] = await Promise.all([
    prisma.work.findUnique({
      where: { id: req.workId },
      select: { id: true, name: true, address: true, cep: true },
    }),
    prisma.appConfig.findFirst({ orderBy: { id: 'asc' } }),
    prisma.holiday.findMany({
      where: { workId: req.workId },
      orderBy: [{ dayDate: 'asc' }, { id: 'asc' }],
    }),
  ]);

  if (!work) return res.status(404).json({ error: 'work_not_found' });
  if (!holidays.length) return res.status(400).json({ error: 'no_holidays_registered' });

  const holidaysByYear = new Map();
  holidays.forEach((item) => {
    const parts = holidayKeyParts(item.dayDate);
    if (!holidaysByYear.has(parts.year)) holidaysByYear.set(parts.year, []);
    holidaysByYear.get(parts.year).push({
      ...item,
      year: parts.year,
      month: parts.month,
      day: parts.day,
    });
  });
  const years = [...holidaysByYear.keys()].sort((a, b) => a - b);

  const companyName = String(appConfig?.companyName || '').trim() || 'Construtora';
  const companyCnpj = String(appConfig?.companyCnpj || '').trim() || '-';
  const companyAddress = String(appConfig?.companyAddress || '').trim() || '-';
  const companySite = String(appConfig?.companySite || '').trim() || '-';
  const logoBuffer = dataUrlImageBuffer(appConfig?.logoPath || '');
  const generatedAt = formatDateTimeBr(new Date());
  const responsible = String(req.user?.name || req.user?.email || 'Usuário');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=\"PPC-Calendario-Feriados-Obra-${req.workId}.pdf\"`);

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24 });
  doc.pipe(res);

  const drawYearPage = (year, yearHolidays) => {
    const margin = 24;
    const contentX = margin;
    const contentY = margin;
    const contentW = doc.page.width - (margin * 2);
    const headerH = 74;

    doc.save();
    doc.roundedRect(contentX, contentY, contentW, headerH, 10).fillAndStroke('#e9f4fa', '#bfd7e5');
    const logoX = contentX + 8;
    const logoY = contentY + 8;
    const logoW = 64;
    const logoH = 58;
    doc.roundedRect(logoX, logoY, logoW, logoH, 8).fillAndStroke('#ffffff', '#bfd7e5');
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, logoX + 4, logoY + 4, { fit: [logoW - 8, logoH - 8], align: 'center', valign: 'center' });
      } catch {
        // Ignora falha de logo e mantém o PDF.
      }
    }
    doc.restore();

    const textX = logoX + logoW + 10;
    const textW = contentW - (logoW + 18);
    doc.fillColor('#123a4d').font('Helvetica-Bold').fontSize(14).text(companyName, textX, contentY + 6, { width: textW, align: 'center' });
    doc.font('Helvetica').fontSize(9).text(`CNPJ: ${companyCnpj}`, textX, contentY + 24, { width: textW, align: 'center' });
    doc.fontSize(9).text(companyAddress, textX, contentY + 36, { width: textW, align: 'center' });
    doc.fontSize(8.5).text(companySite, textX, contentY + 48, { width: textW, align: 'center' });

    const workInfoY = contentY + headerH + 8;
    doc.roundedRect(contentX, workInfoY, contentW, 22, 8).fillAndStroke('#dcecf6', '#bfd7e5');
    doc.fillColor('#123a4d').font('Helvetica-Bold').fontSize(9.5).text(
      `Obra: ${work.name} | Endereço: ${work.address} | CEP: ${work.cep || '-'}`,
      contentX + 10,
      workInfoY + 6,
      { width: contentW - 20, align: 'left' },
    );

    const infoY = workInfoY + 26;
    doc.roundedRect(contentX, infoY, contentW, 22, 8).fillAndStroke('#f2f8fc', '#d2e3ee');
    doc.fillColor('#123a4d').font('Helvetica').fontSize(9).text(
      `Documento gerado em: ${generatedAt} | Responsável: ${responsible}`,
      contentX + 10,
      infoY + 6,
      { width: contentW - 20, align: 'left' },
    );

    const titleY = infoY + 28;
    doc.roundedRect(contentX, titleY, contentW, 24, 8).fillAndStroke('#1c6b94', '#1c6b94');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text(`Calendário - Ano ${year}`, contentX, titleY + 6, { width: contentW, align: 'center' });

    const holidaysByMonth = new Map();
    yearHolidays.forEach((item) => {
      if (!holidaysByMonth.has(item.month)) holidaysByMonth.set(item.month, []);
      holidaysByMonth.get(item.month).push({
        day: item.day,
        description: String(item.description || '').trim() || 'Sem descrição',
      });
    });
    holidaysByMonth.forEach((rows) => rows.sort((a, b) => a.day - b.day));

    const cols = 4;
    const rows = 3;
    const gapX = 8;
    const gapY = 8;
    const gridY = titleY + 30;
    const gridH = doc.page.height - margin - gridY;
    const cardW = (contentW - (gapX * (cols - 1))) / cols;
    const cardH = (gridH - (gapY * (rows - 1))) / rows;

    for (let month = 0; month < 12; month += 1) {
      const col = month % cols;
      const row = Math.floor(month / cols);
      const x = contentX + col * (cardW + gapX);
      const y = gridY + row * (cardH + gapY);
      const monthHolidays = holidaysByMonth.get(month) || [];
      const holidayDaySet = new Set(monthHolidays.map((item) => item.day));

      doc.roundedRect(x, y, cardW, cardH, 8).fillAndStroke('#f8fcff', '#c8dce9');
      doc.rect(x, y, cardW, 18).fill('#dcecf6');
      doc.fillColor('#103d54').font('Helvetica-Bold').fontSize(8.5).text(MONTH_LABELS_PT[month].toUpperCase(), x + 4, y + 5, { width: cardW - 8, align: 'center' });

      const innerX = x + 4;
      const innerW = cardW - 8;
      const weekY = y + 20;
      const cellW = innerW / 7;
      const cellH = 10;
      WEEKDAY_LABELS_PT.forEach((label, weekdayIdx) => {
        const wx = innerX + (weekdayIdx * cellW);
        doc.rect(wx, weekY, cellW, cellH).fillAndStroke('#eef5fa', '#d7e6ef');
        doc.fillColor('#355363').font('Helvetica-Bold').fontSize(6).text(label, wx, weekY + 2, { width: cellW, align: 'center' });
      });

      const daysGridY = weekY + cellH;
      for (let dayRow = 0; dayRow < 6; dayRow += 1) {
        for (let dayCol = 0; dayCol < 7; dayCol += 1) {
          const dx = innerX + (dayCol * cellW);
          const dy = daysGridY + (dayRow * cellH);
          doc.rect(dx, dy, cellW, cellH).fillAndStroke('#ffffff', '#dceaf2');
        }
      }

      const firstDay = new Date(Date.UTC(year, month, 1));
      const firstDayWeekday = firstDay.getUTCDay();
      const startOffset = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

      for (let day = 1; day <= daysInMonth; day += 1) {
        const position = startOffset + (day - 1);
        const dayRow = Math.floor(position / 7);
        const dayCol = position % 7;
        const dx = innerX + (dayCol * cellW);
        const dy = daysGridY + (dayRow * cellH);
        if (holidayDaySet.has(day)) {
          doc.rect(dx, dy, cellW, cellH).fillAndStroke('#ffd6d6', '#e6a3a3');
        }
        doc.fillColor('#123a4d').font(holidayDaySet.has(day) ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.4).text(String(day), dx, dy + 2, { width: cellW, align: 'center' });
      }

      const legendY = daysGridY + (6 * cellH) + 2;
      const legendH = Math.max(12, cardH - (legendY - y) - 4);
      const legendText = monthHolidays.length
        ? monthHolidays.map((item) => `${String(item.day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')} - ${item.description}`).join(' | ')
        : 'Sem feriados.';
      doc.fillColor('#355363').font('Helvetica').fontSize(6.1).text(legendText, innerX, legendY, {
        width: innerW,
        height: legendH,
        align: 'left',
      });
    }
  };

  years.forEach((year, idx) => {
    if (idx > 0) doc.addPage();
    drawYearPage(year, holidaysByYear.get(year) || []);
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'HOLIDAY',
    eventType: 'HOLIDAY_CALENDAR_PDF_EXPORTED',
    description: `PDF de calendario de feriados gerado para os anos ${years.join(', ')}.`,
  });

  doc.end();
}));

router.get('/works/:workId/locations', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const items = await prisma.location.findMany({
    where: { workId: req.workId },
    orderBy: [{ level1: 'asc' }, { level2: 'asc' }],
  });
  return res.json(items);
}));

router.post('/works/:workId/locations', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const { level1, level2 } = req.body;
  if (!level1 || !level2) return res.status(400).json({ error: 'level1_level2_required' });
  const item = await findOrCreateLocation(req.workId, level1, level2);
  return res.status(201).json(item);
}));

router.put('/works/:workId/locations/:locationId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const locationId = parseIntId(req.params.locationId);
  if (!locationId) return res.status(400).json({ error: 'invalid_location_id' });
  const existing = await prisma.location.findUnique({ where: { id: locationId } });
  if (!existing || existing.workId !== req.workId) return res.status(404).json({ error: 'location_not_found' });

  const level = parseIntId(req.body.level);
  const name = String(req.body.name || '').trim();
  const parentLevel1 = String(req.body.parentLevel1 || '').trim();
  if ((level !== 1 && level !== 2) || !name) {
    return res.status(400).json({ error: 'level_name_required' });
  }

  if (isZoneLevel1Location(existing) || level === 1) {
    const oldLevel1 = existing.level1;
    const newLevel1 = name;
    if (!newLevel1) return res.status(400).json({ error: 'level1_required' });
    if (oldLevel1 === newLevel1) return res.json({ updated: true, level: 1, level1: newLevel1 });

    const affected = await prisma.location.findMany({
      where: { workId: req.workId, level1: oldLevel1 },
      select: { id: true, level1: true, level2: true },
    });
    const markerOld = zoneLevel1Marker(oldLevel1);
    const markerNew = zoneLevel1Marker(newLevel1);
    const targetRows = await prisma.location.findMany({
      where: { workId: req.workId, level1: newLevel1 },
      select: { id: true, level2: true },
    });
    const targetLevels = new Set(targetRows.map((row) => String(row.level2 || '')));
    const conflict = affected.some((row) => {
      const mappedLevel2 = isZoneLevel1Location(row) || String(row.level2 || '') === markerOld
        ? markerNew
        : String(row.level2 || '');
      return targetLevels.has(mappedLevel2);
    });
    if (conflict) return res.status(409).json({ error: 'location_level_conflict' });

    await prisma.$transaction([
      prisma.location.updateMany({
        where: {
          workId: req.workId,
          level1: oldLevel1,
          NOT: { level2: markerOld },
        },
        data: { level1: newLevel1 },
      }),
      prisma.location.updateMany({
        where: {
          workId: req.workId,
          level1: oldLevel1,
          level2: markerOld,
        },
        data: { level1: newLevel1, level2: markerNew },
      }),
    ]);
    return res.json({ updated: true, level: 1, level1: newLevel1 });
  }

  const targetParent = parentLevel1 || existing.level1;
  if (!targetParent) return res.status(400).json({ error: 'parent_level1_required' });
  const parentExists = await prisma.location.findFirst({
    where: { workId: req.workId, level1: targetParent, level2: zoneLevel1Marker(targetParent) },
    select: { id: true },
  });
  if (!parentExists) return res.status(400).json({ error: 'parent_level1_not_found' });
  if (name === zoneLevel1Marker(targetParent) || String(name).startsWith(ZONE_L1_PREFIX)) {
    return res.status(400).json({ error: 'invalid_level2_name' });
  }
  const duplicate = await prisma.location.findFirst({
    where: {
      workId: req.workId,
      level1: targetParent,
      level2: name,
      NOT: { id: locationId },
    },
    select: { id: true },
  });
  if (duplicate) return res.status(409).json({ error: 'location_level_conflict' });

  const updated = await prisma.location.update({
    where: { id: locationId },
    data: { level1: targetParent, level2: name },
  });
  return res.json(updated);
}));

router.delete('/works/:workId/locations/:locationId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const locationId = parseIntId(req.params.locationId);
  if (!locationId) return res.status(400).json({ error: 'invalid_location_id' });
  const existing = await prisma.location.findUnique({ where: { id: locationId } });
  if (!existing || existing.workId !== req.workId) return res.status(404).json({ error: 'location_not_found' });

  if (isZoneLevel1Location(existing)) {
    const affected = await prisma.location.findMany({
      where: { workId: req.workId, level1: existing.level1 },
      select: { id: true },
    });
    const affectedIds = affected.map((item) => item.id);
    const inUseCount = await prisma.task.count({ where: { locationId: { in: affectedIds } } });
    if (inUseCount > 0) return res.status(409).json({ error: 'location_in_use' });
    await prisma.location.deleteMany({ where: { id: { in: affectedIds } } });
    return res.status(204).send();
  }

  const inUseCount = await prisma.task.count({ where: { locationId } });
  if (inUseCount > 0) return res.status(409).json({ error: 'location_in_use' });
  await prisma.location.delete({ where: { id: locationId } });
  return res.status(204).send();
}));

router.get('/works/:workId/task-groups', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const groups = await prisma.taskGroup.findMany({
    where: { workId: req.workId },
    include: {
      items: {
        include: { defaultContractor: { include: { function: true } } },
        orderBy: { sequenceNumber: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
  const mapped = groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      laborType: item.defaultContractor?.function?.name || laborTypeFromMarker(item.defaultSupervisor),
    })),
  }));
  return res.json(mapped);
}));

router.get('/global/task-groups', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (_req, res) => {
  const groups = await prisma.taskGroup.findMany({
    where: { workId: null },
    include: {
      items: {
        include: { defaultContractor: { include: { function: true } } },
        orderBy: { sequenceNumber: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
  const mapped = groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      laborType: item.defaultContractor?.function?.name || laborTypeFromMarker(item.defaultSupervisor),
    })),
  }));
  return res.json(mapped);
}));

router.get('/works/:workId/task-groups/templates', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const groups = await prisma.taskGroup.findMany({
    where: { workId: null },
    include: {
      work: { select: { id: true, name: true } },
      items: {
        include: { defaultContractor: { include: { function: true } } },
        orderBy: { sequenceNumber: 'asc' },
      },
    },
    orderBy: [{ name: 'asc' }],
  });
  return res.json(groups.map((group) => ({
    id: group.id,
    workId: group.workId,
    originWork: group.work ? { id: group.work.id, name: group.work.name } : null,
    name: group.name,
    items: (group.items || []).map((item) => ({
      id: item.id,
      sequenceNumber: item.sequenceNumber,
      description: item.description,
      laborType: item.defaultContractor?.function?.name || laborTypeFromMarker(item.defaultSupervisor),
    })),
  })));
}));

router.post('/works/:workId/task-groups/import-template', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const templateGroupId = parseIntId(req.body.templateGroupId);
  if (!templateGroupId) return res.status(400).json({ error: 'template_group_required' });

  const template = await prisma.taskGroup.findUnique({
    where: { id: templateGroupId },
    include: {
      items: { orderBy: { sequenceNumber: 'asc' } },
    },
  });
  if (!template) return res.status(404).json({ error: 'template_group_not_found' });
  if (template.workId === req.workId) return res.status(409).json({ error: 'template_group_same_work' });

  let targetName = template.name;
  let idx = 2;
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await prisma.taskGroup.findFirst({
      where: { workId: req.workId, name: targetName },
      select: { id: true },
    });
    if (!exists) break;
    targetName = `${template.name} (${idx})`;
    idx += 1;
  }

  const created = await prisma.taskGroup.create({
    data: {
      workId: req.workId,
      name: targetName,
    },
  });

  for (const item of template.items) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.taskGroupItem.create({
      data: {
        taskGroupId: created.id,
        sequenceNumber: item.sequenceNumber,
        description: item.description,
        defaultContractorId: null,
        defaultSupervisor: item.defaultSupervisor,
        defaultLocationL1: item.defaultLocationL1,
        defaultLocationL2: item.defaultLocationL2,
      },
    });
  }

  return res.status(201).json(created);
}));

router.post('/global/task-groups', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name_required' });
  const group = await prisma.taskGroup.create({ data: { workId: null, name } });
  return res.status(201).json(group);
}));

router.put('/global/task-groups/:taskGroupId', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const taskGroupId = parseIntId(req.params.taskGroupId);
  if (!taskGroupId) return res.status(400).json({ error: 'invalid_task_group_id' });
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name_required' });

  const existing = await prisma.taskGroup.findUnique({ where: { id: taskGroupId } });
  if (!existing || existing.workId !== null) return res.status(404).json({ error: 'task_group_not_found' });

  const updated = await prisma.taskGroup.update({
    where: { id: taskGroupId },
    data: { name },
  });
  return res.json(updated);
}));

router.delete('/global/task-groups/:taskGroupId', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const taskGroupId = parseIntId(req.params.taskGroupId);
  if (!taskGroupId) return res.status(400).json({ error: 'invalid_task_group_id' });

  const existing = await prisma.taskGroup.findUnique({ where: { id: taskGroupId } });
  if (!existing || existing.workId !== null) return res.status(404).json({ error: 'task_group_not_found' });

  await prisma.taskGroupItem.deleteMany({ where: { taskGroupId } });
  await prisma.taskGroup.delete({ where: { id: taskGroupId } });
  return res.status(204).send();
}));

router.post('/works/:workId/task-groups', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name_required' });
  const group = await prisma.taskGroup.create({ data: { workId: req.workId, name } });
  return res.status(201).json(group);
}));

router.put('/works/:workId/task-groups/:taskGroupId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const taskGroupId = parseIntId(req.params.taskGroupId);
  if (!taskGroupId) return res.status(400).json({ error: 'invalid_task_group_id' });
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name_required' });

  const existing = await prisma.taskGroup.findUnique({
    where: { id: taskGroupId },
    select: { id: true, workId: true },
  });
  if (!existing || existing.workId !== req.workId) {
    return res.status(404).json({ error: 'task_group_not_found' });
  }

  const updated = await prisma.taskGroup.update({
    where: { id: taskGroupId },
    data: { name },
  });
  return res.json(updated);
}));

router.delete('/works/:workId/task-groups/:taskGroupId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const taskGroupId = parseIntId(req.params.taskGroupId);
  if (!taskGroupId) return res.status(400).json({ error: 'invalid_task_group_id' });

  const existing = await prisma.taskGroup.findUnique({
    where: { id: taskGroupId },
    select: { id: true, workId: true },
  });
  if (!existing || existing.workId !== req.workId) {
    return res.status(404).json({ error: 'task_group_not_found' });
  }

  await prisma.taskGroupItem.deleteMany({ where: { taskGroupId } });
  await prisma.taskGroup.delete({ where: { id: taskGroupId } });
  return res.status(204).send();
}));

router.post('/global/task-groups/:taskGroupId/items', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const taskGroupId = parseIntId(req.params.taskGroupId);
  if (!taskGroupId) return res.status(400).json({ error: 'invalid_task_group_id' });
  const group = await prisma.taskGroup.findUnique({ where: { id: taskGroupId } });
  if (!group || group.workId !== null) return res.status(404).json({ error: 'task_group_not_found' });

  const resolvedDescription = String(req.body.taskDescription || req.body.description || '').trim();
  if (!resolvedDescription) return res.status(400).json({ error: 'description_required' });
  const normalizedLaborType = normalizeLaborTypeName(req.body.laborType || req.body.functionName || '');
  if (!normalizedLaborType) return res.status(400).json({ error: 'labor_type_required' });
  const laborTypeExists = await prisma.contractorFunction.findUnique({
    where: { name: normalizedLaborType },
    select: { id: true },
  });
  if (!laborTypeExists) return res.status(400).json({ error: 'invalid_labor_type' });

  const lastItem = await prisma.taskGroupItem.findFirst({
    where: { taskGroupId },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  const nextSequence = parseIntId(req.body.sequenceNumber) || ((lastItem?.sequenceNumber || 0) + 1);

  const item = await prisma.taskGroupItem.create({
    data: {
      taskGroupId,
      sequenceNumber: nextSequence,
      description: resolvedDescription,
      defaultContractorId: null,
      defaultSupervisor: `${LABOR_MARKER}${normalizedLaborType}`,
      defaultLocationL1: req.body.defaultLocationL1 || null,
      defaultLocationL2: req.body.defaultLocationL2 || null,
    },
  });

  return res.status(201).json({
    ...item,
    laborType: laborTypeFromMarker(item.defaultSupervisor),
  });
}));

router.put('/global/task-group-items/:itemId', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const itemId = parseIntId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: 'invalid_task_group_item_id' });

  const existing = await prisma.taskGroupItem.findUnique({
    where: { id: itemId },
    include: { taskGroup: true },
  });
  if (!existing || existing.taskGroup.workId !== null) {
    return res.status(404).json({ error: 'task_group_item_not_found' });
  }

  const resolvedDescription = String(req.body.taskDescription || req.body.description || existing.description || '').trim();
  if (!resolvedDescription) return res.status(400).json({ error: 'description_required' });
  const normalizedLaborType = normalizeLaborTypeName(req.body.laborType || req.body.functionName || laborTypeFromMarker(existing.defaultSupervisor) || '');
  if (!normalizedLaborType) return res.status(400).json({ error: 'labor_type_required' });
  const laborTypeExists = await prisma.contractorFunction.findUnique({
    where: { name: normalizedLaborType },
    select: { id: true },
  });
  if (!laborTypeExists) return res.status(400).json({ error: 'invalid_labor_type' });

  const updated = await prisma.taskGroupItem.update({
    where: { id: itemId },
    data: {
      description: resolvedDescription,
      defaultContractorId: null,
      defaultSupervisor: `${LABOR_MARKER}${normalizedLaborType}`,
      defaultLocationL1: Object.prototype.hasOwnProperty.call(req.body, 'defaultLocationL1')
        ? (req.body.defaultLocationL1 || null)
        : existing.defaultLocationL1,
      defaultLocationL2: Object.prototype.hasOwnProperty.call(req.body, 'defaultLocationL2')
        ? (req.body.defaultLocationL2 || null)
        : existing.defaultLocationL2,
    },
  });

  return res.json({
    ...updated,
    laborType: laborTypeFromMarker(updated.defaultSupervisor),
  });
}));

router.delete('/global/task-group-items/:itemId', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const itemId = parseIntId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: 'invalid_task_group_item_id' });

  const existing = await prisma.taskGroupItem.findUnique({
    where: { id: itemId },
    include: { taskGroup: true },
  });
  if (!existing || existing.taskGroup.workId !== null) {
    return res.status(404).json({ error: 'task_group_item_not_found' });
  }

  await prisma.taskGroupItem.delete({ where: { id: itemId } });
  return res.status(204).send();
}));

router.post('/task-groups/:taskGroupId/items', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const taskGroupId = parseIntId(req.params.taskGroupId);
  if (!taskGroupId) return res.status(400).json({ error: 'invalid_task_group_id' });

  const group = await prisma.taskGroup.findUnique({ where: { id: taskGroupId }, select: { id: true, workId: true } });
  if (!group) return res.status(404).json({ error: 'task_group_not_found' });

  req.params.workId = String(group.workId);
  req.taskGroupId = group.id;
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const {
    description,
    taskDescription,
    laborType,
    functionName,
    defaultContractorId,
    defaultSupervisor,
    defaultLocationL1,
    defaultLocationL2,
  } = req.body;
  const resolvedDescription = String(taskDescription || description || '').trim();
  const normalizedLaborType = normalizeLaborTypeName(laborType || functionName || '');
  if (!resolvedDescription) {
    return res.status(400).json({ error: 'description_required' });
  }
  if (normalizedLaborType) {
    const laborTypeExists = await prisma.contractorFunction.findUnique({
      where: { name: normalizedLaborType },
      select: { id: true },
    });
    if (!laborTypeExists) return res.status(400).json({ error: 'invalid_labor_type' });
  }
  let resolvedContractorId = parseIntId(defaultContractorId);
  if (!resolvedContractorId) {
    resolvedContractorId = await findDefaultContractorByFunction(req.workId, normalizedLaborType);
  }
  const resolvedDefaultSupervisor = resolvedContractorId
    ? (defaultSupervisor || null)
    : (defaultSupervisor || (normalizedLaborType ? `${LABOR_MARKER}${normalizedLaborType}` : null));
  const lastItem = await prisma.taskGroupItem.findFirst({
    where: { taskGroupId: req.taskGroupId },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  const nextSequence = parseIntId(req.body.sequenceNumber) || ((lastItem?.sequenceNumber || 0) + 1);

  const item = await prisma.taskGroupItem.create({
    data: {
      taskGroupId: req.taskGroupId,
      sequenceNumber: nextSequence,
      description: resolvedDescription,
      defaultContractorId: resolvedContractorId || null,
      defaultSupervisor: resolvedDefaultSupervisor,
      defaultLocationL1: defaultLocationL1 || null,
      defaultLocationL2: defaultLocationL2 || null,
    },
    include: { defaultContractor: { include: { function: true } } },
  });

  return res.status(201).json({
    ...item,
    laborType: item.defaultContractor?.function?.name || laborTypeFromMarker(item.defaultSupervisor),
  });
}));

router.put('/task-group-items/:itemId', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const itemId = parseIntId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: 'invalid_task_group_item_id' });

  const existing = await prisma.taskGroupItem.findUnique({
    where: { id: itemId },
    include: { taskGroup: { select: { workId: true } }, defaultContractor: { include: { function: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'task_group_item_not_found' });
  req.params.workId = String(existing.taskGroup.workId);
  req.taskGroupItem = existing;
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const {
    taskGroupId,
    description,
    taskDescription,
    laborType,
    functionName,
    defaultContractorId,
    defaultSupervisor,
    defaultLocationL1,
    defaultLocationL2,
  } = req.body;
  const resolvedDescription = String(taskDescription || description || req.taskGroupItem.description || '').trim();
  if (!resolvedDescription) return res.status(400).json({ error: 'description_required' });

  const nextTaskGroupId = parseIntId(taskGroupId) || req.taskGroupItem.taskGroupId;
  if (nextTaskGroupId !== req.taskGroupItem.taskGroupId) {
    const destination = await prisma.taskGroup.findUnique({
      where: { id: nextTaskGroupId },
      select: { id: true, workId: true },
    });
    if (!destination || destination.workId !== parseIntId(req.params.workId)) {
      return res.status(400).json({ error: 'invalid_target_group' });
    }
  }

  const normalizedLaborType = normalizeLaborTypeName(laborType || functionName || '');
  if (normalizedLaborType) {
    const laborTypeExists = await prisma.contractorFunction.findUnique({
      where: { name: normalizedLaborType },
      select: { id: true },
    });
    if (!laborTypeExists) return res.status(400).json({ error: 'invalid_labor_type' });
  }

  const hasDefaultContractorId = Object.prototype.hasOwnProperty.call(req.body, 'defaultContractorId');
  let resolvedContractorId = hasDefaultContractorId ? parseIntId(defaultContractorId) : req.taskGroupItem.defaultContractorId;
  if (normalizedLaborType && !hasDefaultContractorId) {
    resolvedContractorId = await findDefaultContractorByFunction(parseIntId(req.params.workId), normalizedLaborType);
  } else if (!resolvedContractorId && normalizedLaborType) {
    resolvedContractorId = await findDefaultContractorByFunction(parseIntId(req.params.workId), normalizedLaborType);
  }

  let nextDefaultSupervisor = req.taskGroupItem.defaultSupervisor;
  if (Object.prototype.hasOwnProperty.call(req.body, 'defaultSupervisor')) {
    nextDefaultSupervisor = String(defaultSupervisor || '').trim() || null;
  } else if (normalizedLaborType) {
    nextDefaultSupervisor = resolvedContractorId ? null : `${LABOR_MARKER}${normalizedLaborType}`;
  }

  const updated = await prisma.taskGroupItem.update({
    where: { id: req.taskGroupItem.id },
    data: {
      taskGroupId: nextTaskGroupId,
      description: resolvedDescription,
      defaultContractorId: resolvedContractorId || null,
      defaultSupervisor: nextDefaultSupervisor,
      defaultLocationL1: Object.prototype.hasOwnProperty.call(req.body, 'defaultLocationL1')
        ? (defaultLocationL1 || null)
        : req.taskGroupItem.defaultLocationL1,
      defaultLocationL2: Object.prototype.hasOwnProperty.call(req.body, 'defaultLocationL2')
        ? (defaultLocationL2 || null)
        : req.taskGroupItem.defaultLocationL2,
    },
    include: { defaultContractor: { include: { function: true } } },
  });

  return res.json({
    ...updated,
    laborType: updated.defaultContractor?.function?.name || laborTypeFromMarker(updated.defaultSupervisor),
  });
}));

router.delete('/task-group-items/:itemId', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const itemId = parseIntId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: 'invalid_task_group_item_id' });

  const existing = await prisma.taskGroupItem.findUnique({
    where: { id: itemId },
    include: { taskGroup: { select: { workId: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'task_group_item_not_found' });
  req.params.workId = String(existing.taskGroup.workId);
  req.taskGroupItem = existing;
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  await prisma.taskGroupItem.delete({ where: { id: req.taskGroupItem.id } });
  return res.status(204).send();
}));

router.get('/works/:workId/future-week-authorizations', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER, ROLES.ENGINEERING], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const rows = await prisma.futureWeekAuthorization.findMany({
    where: { workId: req.workId },
    orderBy: { requestedAt: 'desc' },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });
  return res.json(rows);
}));

router.post('/works/:workId/future-week-authorizations', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER, ROLES.ENGINEERING], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const requestedWeekNumber = parseIntId(req.body.requestedWeekNumber);
  if (!requestedWeekNumber) return res.status(400).json({ error: 'requestedWeekNumber_required' });

  const request = await prisma.futureWeekAuthorization.create({
    data: {
      workId: req.workId,
      requestedWeekNumber,
      requestedById: req.user.id,
      reason: req.body.reason || null,
      status: 'PENDING',
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'FUTURE_WEEK_AUTHORIZATION',
    entityId: request.id,
    eventType: 'FUTURE_WEEK_REQUESTED',
    description: `Solicitada abertura da semana ${requestedWeekNumber}.`,
  });

  return res.status(201).json(request);
}));

router.post('/future-week-authorizations/:authorizationId/decision', authenticate, loadUser, asyncHandler(async (req, res, next) => {
  const authorizationId = parseIntId(req.params.authorizationId);
  if (!authorizationId) return res.status(400).json({ error: 'invalid_authorization_id' });

  const request = await prisma.futureWeekAuthorization.findUnique({
    where: { id: authorizationId },
    select: { id: true, workId: true, requestedWeekNumber: true, status: true },
  });
  if (!request) return res.status(404).json({ error: 'authorization_not_found' });
  req.authorizationRequest = request;
  req.params.workId = String(request.workId);
  return next();
}), requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const approve = req.body.approve === true;
  if (typeof req.body.approve !== 'boolean') return res.status(400).json({ error: 'approve_boolean_required' });
  if (req.authorizationRequest.status !== 'PENDING') return res.status(409).json({ error: 'authorization_already_decided' });

  const updated = await prisma.futureWeekAuthorization.update({
    where: { id: req.authorizationRequest.id },
    data: {
      status: approve ? 'APPROVED' : 'REJECTED',
      approvedById: req.user.id,
      approvedAt: approve ? new Date() : null,
      rejectedAt: approve ? null : new Date(),
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.authorizationRequest.workId,
    entityType: 'FUTURE_WEEK_AUTHORIZATION',
    entityId: updated.id,
    eventType: approve ? 'FUTURE_WEEK_APPROVED' : 'FUTURE_WEEK_REJECTED',
    description: `${approve ? 'Aprovada' : 'Rejeitada'} abertura da semana ${req.authorizationRequest.requestedWeekNumber}.`,
  });

  return res.json(updated);
}));

module.exports = router;
