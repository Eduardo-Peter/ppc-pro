const { Router } = require('express');
const { prisma } = require('../lib/prisma');
const { writeAudit } = require('../lib/audit');
const { ROLES } = require('../lib/constants');
const { asyncHandler, parseIntId } = require('../lib/helpers');
const { authenticate, loadUser, requireWorkRoles, requireWeekRoles, userIsAdminAnywhere } = require('../lib/auth');

const router = Router();

function parseNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function parseInteger(value) {
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  return num;
}

router.get('/app-config', authenticate, loadUser, asyncHandler(async (_req, res) => {
  const row = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  return res.json(row);
}));

router.put('/app-config', authenticate, loadUser, asyncHandler(async (req, res) => {
  const isAdmin = await userIsAdminAnywhere(req.user.id);
  if (!isAdmin) return res.status(403).json({ error: 'admin_required' });

  const payload = {
    companyName: req.body.companyName,
    companyCnpj: req.body.companyCnpj,
    companyAddress: req.body.companyAddress,
    companyCep: req.body.companyCep,
    companyStreet: req.body.companyStreet,
    companyNeighborhood: req.body.companyNeighborhood,
    companyCity: req.body.companyCity,
    companyState: req.body.companyState,
    companyNumber: req.body.companyNumber,
    companyComplement: req.body.companyComplement || null,
    companySite: req.body.companySite,
    logoPath: req.body.logoPath || null,
  };
  if (
    !payload.companyName
    || !payload.companyCnpj
    || !payload.companyAddress
    || !payload.companyCep
    || !payload.companyStreet
    || !payload.companyNeighborhood
    || !payload.companyCity
    || !payload.companyState
    || !payload.companyNumber
    || !payload.companySite
  ) {
    return res.status(400).json({ error: 'company_required_fields_missing' });
  }

  const first = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  const row = first
    ? await prisma.appConfig.update({ where: { id: first.id }, data: payload })
    : await prisma.appConfig.create({ data: payload });

  return res.json(row);
}));

router.get('/works/:workId/notification-rule', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const rule = await prisma.notificationRule.findUnique({ where: { workId: req.workId } });
  return res.json(rule);
}));

router.put('/works/:workId/notification-rule', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const payload = {
    prePlanningDeadlineWeekday: req.body.prePlanningDeadlineWeekday || null,
    prePlanningDeadlineTime: req.body.prePlanningDeadlineTime || null,
    ppcMeetingDeadlineWeekday: req.body.ppcMeetingDeadlineWeekday || null,
    ppcMeetingDeadlineTime: req.body.ppcMeetingDeadlineTime || null,
    planningDeadlineWeekday: req.body.planningDeadlineWeekday || null,
    planningDeadlineTime: req.body.planningDeadlineTime || null,
    feedbackDeadlineWeekday: req.body.feedbackDeadlineWeekday || null,
    feedbackDeadlineTime: req.body.feedbackDeadlineTime || null,
    qualityDeadlineWeekday: req.body.qualityDeadlineWeekday || null,
    qualityDeadlineTime: req.body.qualityDeadlineTime || null,
    emailRecipients: req.body.emailRecipients || '',
    enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : true,
  };

  const row = await prisma.notificationRule.upsert({
    where: { workId: req.workId },
    create: { workId: req.workId, ...payload },
    update: payload,
  });
  return res.json(row);
}));

router.get('/works/:workId/perceived-quality-config', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const row = await prisma.workPerceivedQualityConfig.findUnique({
    where: { workId: req.workId },
  });
  return res.json(row || null);
}));

router.put('/works/:workId/perceived-quality-config', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const deadlineRegularPct = parseNumber(req.body.deadlineRegularPct);
  const deadlineGoodPct = parseNumber(req.body.deadlineGoodPct);
  const qualityRegularScore = parseInteger(req.body.qualityRegularScore);
  const qualityGoodScore = parseInteger(req.body.qualityGoodScore);
  const collaborationPresenceImpactScore = parseInteger(req.body.collaborationPresenceImpactScore);
  const collaborationRegularScore = parseInteger(req.body.collaborationRegularScore);
  const collaborationGoodScore = parseInteger(req.body.collaborationGoodScore);
  const safetyRegularScore = parseInteger(req.body.safetyRegularScore);
  const safetyGoodScore = parseInteger(req.body.safetyGoodScore);
  const cleaningRegularScore = parseInteger(req.body.cleaningRegularScore);
  const cleaningGoodScore = parseInteger(req.body.cleaningGoodScore);

  const allPresent = [
    deadlineRegularPct,
    deadlineGoodPct,
    qualityRegularScore,
    qualityGoodScore,
    collaborationPresenceImpactScore,
    collaborationRegularScore,
    collaborationGoodScore,
    safetyRegularScore,
    safetyGoodScore,
    cleaningRegularScore,
    cleaningGoodScore,
  ].every((item) => item !== null);

  if (!allPresent) {
    return res.status(400).json({ error: 'perceived_quality_all_fields_required' });
  }

  if (
    deadlineRegularPct < 0 || deadlineRegularPct > 100
    || deadlineGoodPct < 0 || deadlineGoodPct > 100
    || deadlineGoodPct < deadlineRegularPct
  ) {
    return res.status(400).json({ error: 'invalid_deadline_thresholds' });
  }

  const scorePairs = [
    [qualityRegularScore, qualityGoodScore],
    [collaborationRegularScore, collaborationGoodScore],
    [safetyRegularScore, safetyGoodScore],
    [cleaningRegularScore, cleaningGoodScore],
  ];
  const invalidScores = scorePairs.some(([regular, good]) => regular < 0 || regular > 10 || good < 0 || good > 10 || good < regular);
  if (invalidScores || collaborationPresenceImpactScore < 0 || collaborationPresenceImpactScore > 10) {
    return res.status(400).json({ error: 'invalid_quality_scores' });
  }

  const payload = {
    deadlineRegularPct,
    deadlineGoodPct,
    qualityRegularScore,
    qualityGoodScore,
    collaborationPresenceImpactScore,
    collaborationRegularScore,
    collaborationGoodScore,
    safetyRegularScore,
    safetyGoodScore,
    cleaningRegularScore,
    cleaningGoodScore,
  };

  const row = await prisma.workPerceivedQualityConfig.upsert({
    where: { workId: req.workId },
    create: { workId: req.workId, ...payload },
    update: payload,
  });

  return res.json(row);
}));

router.post('/works/:workId/notifications/check-deadlines', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const now = new Date();
  const overduePlanning = await prisma.week.findMany({
    where: { workId: req.workId, planningStatus: 'OPEN', startDate: { lte: now } },
    orderBy: { weekNumber: 'asc' },
  });
  const overdueFeedback = await prisma.week.findMany({
    where: { workId: req.workId, feedbackStatus: 'OPEN', endDate: { lt: now } },
    orderBy: { weekNumber: 'asc' },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'NOTIFICATION_CHECK',
    eventType: 'DEADLINE_SCAN_EXECUTED',
    description: 'Verificacao de prazos executada.',
    metadata: {
      overduePlanningWeeks: overduePlanning.map((item) => item.weekNumber),
      overdueFeedbackWeeks: overdueFeedback.map((item) => item.weekNumber),
    },
  });

  return res.json({
    checkedAt: now,
    overduePlanningWeeks: overduePlanning,
    overdueFeedbackWeeks: overdueFeedback,
    message: 'Canal de envio de email sera conectado na proxima entrega da V1.',
  });
}));

router.get('/weeks/:weekId/export/:format', authenticate, loadUser, requireWeekRoles(Object.values(ROLES)), asyncHandler(async (req, res) => {
  const format = String(req.params.format || '').toLowerCase();
  if (!['xlsx', 'pdf'].includes(format)) {
    return res.status(400).json({ error: 'format_must_be_xlsx_or_pdf' });
  }
  return res.status(501).json({
    error: 'not_implemented',
    message: `Exportacao ${format.toUpperCase()} entra na proxima iteracao.`,
  });
}));

module.exports = router;
