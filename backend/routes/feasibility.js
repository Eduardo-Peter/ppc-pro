const { Router } = require('express');
const { prisma, Prisma } = require('../lib/prisma');
const { writeAudit } = require('../lib/audit');
const { ROLES } = require('../lib/constants');
const { asyncHandler, parseIntId, parseDate } = require('../lib/helpers');
const { authenticate, loadUser, requireWorkRoles } = require('../lib/auth');

const router = Router();

const READ_ROLES = [ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER, ROLES.MANAGEMENT, ROLES.VISUALIZER];
const WRITE_ROLES = [ROLES.ADMIN, ROLES.ENGINEERING, ROLES.CONTROLLER];
const RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH']);
const SNAPSHOT_STATUS = new Set(['ON_TRACK', 'ATTENTION', 'CRITICAL', 'COMPLETED']);

function hasField(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function round2(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

function parseOptionalFloat(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
}

function parseOptionalNonNegativeFloat(rawValue) {
  const parsed = parseOptionalFloat(rawValue);
  if (parsed === null) return null;
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return parsed;
}

function parseOptionalPct(rawValue) {
  const parsed = parseOptionalFloat(rawValue);
  if (parsed === null) return null;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return Number.NaN;
  return parsed;
}

function normalizeDateOnly(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;
  const parsed = parseDate(rawValue);
  if (!parsed) return null;
  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  return date;
}

function computeFeasibilityMetrics(record) {
  if (!record) return null;

  const totalInvestment = Number(record.totalInvestment || 0);
  const expectedRevenue = Number(record.expectedRevenue || 0);
  const expectedOperatingCosts = Number(record.expectedOperatingCosts || 0);
  const expectedDurationMonths = Number(record.expectedDurationMonths || 0);

  const totalEstimatedCost = totalInvestment + expectedOperatingCosts;
  const estimatedNetResult = expectedRevenue - totalEstimatedCost;
  const expectedMarginPct = expectedRevenue > 0
    ? (estimatedNetResult / expectedRevenue) * 100
    : null;
  const expectedRoiPct = totalInvestment > 0
    ? (estimatedNetResult / totalInvestment) * 100
    : null;

  let estimatedPaybackMonths = null;
  if (expectedDurationMonths > 0 && estimatedNetResult > 0) {
    const monthlyNet = estimatedNetResult / expectedDurationMonths;
    if (monthlyNet > 0) estimatedPaybackMonths = totalInvestment / monthlyNet;
  }

  return {
    totalEstimatedCost: round2(totalEstimatedCost),
    estimatedNetResult: round2(estimatedNetResult),
    expectedMarginPct: round2(expectedMarginPct),
    expectedRoiPct: round2(expectedRoiPct),
    estimatedPaybackMonths: round2(estimatedPaybackMonths),
  };
}

function mapFeasibility(record) {
  if (!record) return null;
  return {
    ...record,
    metrics: computeFeasibilityMetrics(record),
  };
}

function mapSnapshot(snapshot) {
  const progressDeltaPct = Number(snapshot.actualProgressPct || 0) - Number(snapshot.plannedProgressPct || 0);
  const costDelta = Number(snapshot.actualCostAccum || 0) - Number(snapshot.plannedCostAccum || 0);
  const revenueDelta = Number(snapshot.actualRevenueAccum || 0) - Number(snapshot.plannedRevenueAccum || 0);
  const costDeltaPct = Number(snapshot.plannedCostAccum || 0) > 0
    ? (costDelta / Number(snapshot.plannedCostAccum)) * 100
    : null;
  const revenueDeltaPct = Number(snapshot.plannedRevenueAccum || 0) > 0
    ? (revenueDelta / Number(snapshot.plannedRevenueAccum)) * 100
    : null;

  return {
    ...snapshot,
    metrics: {
      progressDeltaPct: round2(progressDeltaPct),
      costDelta: round2(costDelta),
      costDeltaPct: round2(costDeltaPct),
      revenueDelta: round2(revenueDelta),
      revenueDeltaPct: round2(revenueDeltaPct),
    },
  };
}

function classifyHealth(latestSnapshot) {
  if (!latestSnapshot) return 'NO_DATA';
  if (SNAPSHOT_STATUS.has(String(latestSnapshot.status || '').toUpperCase())) {
    return String(latestSnapshot.status || '').toUpperCase();
  }

  const progressDelta = Number(latestSnapshot.actualProgressPct || 0) - Number(latestSnapshot.plannedProgressPct || 0);
  const plannedCost = Number(latestSnapshot.plannedCostAccum || 0);
  const costDeltaPct = plannedCost > 0
    ? ((Number(latestSnapshot.actualCostAccum || 0) - plannedCost) / plannedCost) * 100
    : 0;

  if (progressDelta <= -15 || costDeltaPct >= 15) return 'CRITICAL';
  if (progressDelta <= -5 || costDeltaPct >= 5) return 'ATTENTION';
  return 'ON_TRACK';
}

function parseFeasibilityPayload(body) {
  const data = {};

  if (hasField(body, 'analysisDate')) {
    if (body.analysisDate === null || body.analysisDate === '') {
      data.analysisDate = null;
    } else {
      const analysisDate = parseDate(body.analysisDate);
      if (!analysisDate) return { error: 'invalid_analysis_date', data: null };
      data.analysisDate = analysisDate;
    }
  }

  if (hasField(body, 'totalInvestment')) {
    const totalInvestment = parseOptionalNonNegativeFloat(body.totalInvestment);
    if (!Number.isFinite(totalInvestment) && totalInvestment !== null) return { error: 'invalid_total_investment', data: null };
    data.totalInvestment = totalInvestment === null ? 0 : totalInvestment;
  }

  if (hasField(body, 'expectedRevenue')) {
    const expectedRevenue = parseOptionalNonNegativeFloat(body.expectedRevenue);
    if (!Number.isFinite(expectedRevenue) && expectedRevenue !== null) return { error: 'invalid_expected_revenue', data: null };
    data.expectedRevenue = expectedRevenue === null ? 0 : expectedRevenue;
  }

  if (hasField(body, 'expectedOperatingCosts')) {
    const expectedOperatingCosts = parseOptionalNonNegativeFloat(body.expectedOperatingCosts);
    if (!Number.isFinite(expectedOperatingCosts) && expectedOperatingCosts !== null) return { error: 'invalid_expected_operating_costs', data: null };
    data.expectedOperatingCosts = expectedOperatingCosts === null ? 0 : expectedOperatingCosts;
  }

  if (hasField(body, 'expectedDurationMonths')) {
    const parsed = parseIntId(body.expectedDurationMonths);
    if (parsed === null || parsed < 0) return { error: 'invalid_expected_duration_months', data: null };
    data.expectedDurationMonths = parsed;
  }

  if (hasField(body, 'riskLevel')) {
    const riskLevel = String(body.riskLevel || '').trim().toUpperCase();
    if (!RISK_LEVELS.has(riskLevel)) return { error: 'invalid_risk_level', data: null };
    data.riskLevel = riskLevel;
  }

  if (hasField(body, 'notes')) {
    const notes = String(body.notes || '').trim();
    data.notes = notes || null;
  }

  return { error: null, data };
}

function parseSnapshotPayload(body, { allowDate = false } = {}) {
  const data = {};

  if (allowDate && hasField(body, 'referenceDate')) {
    const referenceDate = normalizeDateOnly(body.referenceDate);
    if (!referenceDate) return { error: 'invalid_reference_date', data: null };
    data.referenceDate = referenceDate;
  }

  if (hasField(body, 'plannedProgressPct')) {
    const plannedProgressPct = parseOptionalPct(body.plannedProgressPct);
    if (!Number.isFinite(plannedProgressPct) && plannedProgressPct !== null) return { error: 'invalid_planned_progress_pct', data: null };
    data.plannedProgressPct = plannedProgressPct === null ? 0 : plannedProgressPct;
  }

  if (hasField(body, 'actualProgressPct')) {
    const actualProgressPct = parseOptionalPct(body.actualProgressPct);
    if (!Number.isFinite(actualProgressPct) && actualProgressPct !== null) return { error: 'invalid_actual_progress_pct', data: null };
    data.actualProgressPct = actualProgressPct === null ? 0 : actualProgressPct;
  }

  if (hasField(body, 'plannedCostAccum')) {
    const plannedCostAccum = parseOptionalNonNegativeFloat(body.plannedCostAccum);
    if (!Number.isFinite(plannedCostAccum) && plannedCostAccum !== null) return { error: 'invalid_planned_cost_accum', data: null };
    data.plannedCostAccum = plannedCostAccum === null ? 0 : plannedCostAccum;
  }

  if (hasField(body, 'actualCostAccum')) {
    const actualCostAccum = parseOptionalNonNegativeFloat(body.actualCostAccum);
    if (!Number.isFinite(actualCostAccum) && actualCostAccum !== null) return { error: 'invalid_actual_cost_accum', data: null };
    data.actualCostAccum = actualCostAccum === null ? 0 : actualCostAccum;
  }

  if (hasField(body, 'plannedRevenueAccum')) {
    const plannedRevenueAccum = parseOptionalNonNegativeFloat(body.plannedRevenueAccum);
    if (!Number.isFinite(plannedRevenueAccum) && plannedRevenueAccum !== null) return { error: 'invalid_planned_revenue_accum', data: null };
    data.plannedRevenueAccum = plannedRevenueAccum === null ? 0 : plannedRevenueAccum;
  }

  if (hasField(body, 'actualRevenueAccum')) {
    const actualRevenueAccum = parseOptionalNonNegativeFloat(body.actualRevenueAccum);
    if (!Number.isFinite(actualRevenueAccum) && actualRevenueAccum !== null) return { error: 'invalid_actual_revenue_accum', data: null };
    data.actualRevenueAccum = actualRevenueAccum === null ? 0 : actualRevenueAccum;
  }

  if (hasField(body, 'status')) {
    const status = String(body.status || '').trim().toUpperCase();
    if (!SNAPSHOT_STATUS.has(status)) return { error: 'invalid_snapshot_status', data: null };
    data.status = status;
  }

  if (hasField(body, 'notes')) {
    const notes = String(body.notes || '').trim();
    data.notes = notes || null;
  }

  return { error: null, data };
}

function handleUniqueConstraint(error, res) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(409).json({ error: 'reference_date_already_exists' });
  }
  return null;
}

router.get('/works/:workId/feasibility', authenticate, loadUser, requireWorkRoles(READ_ROLES, (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const feasibility = await prisma.workFeasibility.findUnique({
    where: { workId: req.workId },
  });
  return res.json({
    workId: req.workId,
    feasibility: mapFeasibility(feasibility),
  });
}));

router.put('/works/:workId/feasibility', authenticate, loadUser, requireWorkRoles(WRITE_ROLES, (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const { error, data } = parseFeasibilityPayload(req.body || {});
  if (error) return res.status(400).json({ error });
  if (!Object.keys(data).length) return res.status(400).json({ error: 'no_fields_to_update' });

  const saved = await prisma.workFeasibility.upsert({
    where: { workId: req.workId },
    create: {
      workId: req.workId,
      totalInvestment: 0,
      expectedRevenue: 0,
      expectedOperatingCosts: 0,
      expectedDurationMonths: 0,
      riskLevel: 'MEDIUM',
      ...data,
    },
    update: data,
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WORK_FEASIBILITY',
    entityId: saved.id,
    eventType: 'WORK_FEASIBILITY_UPDATED',
    description: 'Viabilidade economica atualizada.',
    metadata: { fields: Object.keys(data) },
  });

  return res.json({
    workId: req.workId,
    feasibility: mapFeasibility(saved),
  });
}));

router.get('/works/:workId/feasibility/snapshots', authenticate, loadUser, requireWorkRoles(READ_ROLES, (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const snapshots = await prisma.workFeasibilitySnapshot.findMany({
    where: { workId: req.workId },
    orderBy: [{ referenceDate: 'asc' }, { id: 'asc' }],
  });
  return res.json(snapshots.map(mapSnapshot));
}));

router.post('/works/:workId/feasibility/snapshots', authenticate, loadUser, requireWorkRoles(WRITE_ROLES, (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const referenceDate = normalizeDateOnly(req.body.referenceDate);
  if (!referenceDate) return res.status(400).json({ error: 'reference_date_required' });

  const { error, data } = parseSnapshotPayload(req.body || {});
  if (error) return res.status(400).json({ error });

  const existing = await prisma.workFeasibilitySnapshot.findUnique({
    where: {
      workId_referenceDate: {
        workId: req.workId,
        referenceDate,
      },
    },
    select: { id: true },
  });

  const saved = await prisma.workFeasibilitySnapshot.upsert({
    where: {
      workId_referenceDate: {
        workId: req.workId,
        referenceDate,
      },
    },
    create: {
      workId: req.workId,
      referenceDate,
      plannedProgressPct: 0,
      actualProgressPct: 0,
      plannedCostAccum: 0,
      actualCostAccum: 0,
      plannedRevenueAccum: 0,
      actualRevenueAccum: 0,
      status: 'ON_TRACK',
      ...data,
    },
    update: data,
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WORK_FEASIBILITY_SNAPSHOT',
    entityId: saved.id,
    eventType: existing ? 'WORK_FEASIBILITY_SNAPSHOT_UPDATED' : 'WORK_FEASIBILITY_SNAPSHOT_CREATED',
    description: `Snapshot de viabilidade ${existing ? 'atualizado' : 'criado'} (${referenceDate.toISOString().slice(0, 10)}).`,
  });

  return res.status(existing ? 200 : 201).json(mapSnapshot(saved));
}));

router.put('/works/:workId/feasibility/snapshots/:snapshotId', authenticate, loadUser, requireWorkRoles(WRITE_ROLES, (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const snapshotId = parseIntId(req.params.snapshotId);
  if (!snapshotId) return res.status(400).json({ error: 'invalid_snapshot_id' });

  const existing = await prisma.workFeasibilitySnapshot.findUnique({
    where: { id: snapshotId },
    select: { id: true, workId: true, referenceDate: true },
  });
  if (!existing || existing.workId !== req.workId) {
    return res.status(404).json({ error: 'snapshot_not_found' });
  }

  const { error, data } = parseSnapshotPayload(req.body || {}, { allowDate: true });
  if (error) return res.status(400).json({ error });
  if (!Object.keys(data).length) return res.status(400).json({ error: 'no_fields_to_update' });

  let saved;
  try {
    saved = await prisma.workFeasibilitySnapshot.update({
      where: { id: existing.id },
      data,
    });
  } catch (updateError) {
    if (handleUniqueConstraint(updateError, res)) return;
    throw updateError;
  }

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WORK_FEASIBILITY_SNAPSHOT',
    entityId: saved.id,
    eventType: 'WORK_FEASIBILITY_SNAPSHOT_UPDATED',
    description: 'Snapshot de viabilidade atualizado.',
    metadata: { fields: Object.keys(data) },
  });

  return res.json(mapSnapshot(saved));
}));

router.delete('/works/:workId/feasibility/snapshots/:snapshotId', authenticate, loadUser, requireWorkRoles(WRITE_ROLES, (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const snapshotId = parseIntId(req.params.snapshotId);
  if (!snapshotId) return res.status(400).json({ error: 'invalid_snapshot_id' });

  const existing = await prisma.workFeasibilitySnapshot.findUnique({
    where: { id: snapshotId },
    select: { id: true, workId: true, referenceDate: true },
  });
  if (!existing || existing.workId !== req.workId) {
    return res.status(404).json({ error: 'snapshot_not_found' });
  }

  await prisma.workFeasibilitySnapshot.delete({ where: { id: existing.id } });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'WORK_FEASIBILITY_SNAPSHOT',
    entityId: existing.id,
    eventType: 'WORK_FEASIBILITY_SNAPSHOT_DELETED',
    description: `Snapshot de viabilidade removido (${existing.referenceDate.toISOString().slice(0, 10)}).`,
  });

  return res.status(204).send();
}));

router.get('/works/:workId/feasibility/summary', authenticate, loadUser, requireWorkRoles(READ_ROLES, (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const [feasibility, latestSnapshot] = await Promise.all([
    prisma.workFeasibility.findUnique({ where: { workId: req.workId } }),
    prisma.workFeasibilitySnapshot.findFirst({
      where: { workId: req.workId },
      orderBy: [{ referenceDate: 'desc' }, { id: 'desc' }],
    }),
  ]);

  const feasibilityMetrics = computeFeasibilityMetrics(feasibility);
  const snapshotMetrics = latestSnapshot ? mapSnapshot(latestSnapshot).metrics : null;

  return res.json({
    workId: req.workId,
    health: classifyHealth(latestSnapshot),
    feasibility: mapFeasibility(feasibility),
    latestSnapshot: latestSnapshot ? mapSnapshot(latestSnapshot) : null,
    kpis: {
      expectedNetResult: feasibilityMetrics?.estimatedNetResult ?? null,
      expectedRoiPct: feasibilityMetrics?.expectedRoiPct ?? null,
      estimatedPaybackMonths: feasibilityMetrics?.estimatedPaybackMonths ?? null,
      progressDeltaPct: snapshotMetrics?.progressDeltaPct ?? null,
      costDelta: snapshotMetrics?.costDelta ?? null,
      costDeltaPct: snapshotMetrics?.costDeltaPct ?? null,
      revenueDelta: snapshotMetrics?.revenueDelta ?? null,
      revenueDeltaPct: snapshotMetrics?.revenueDeltaPct ?? null,
    },
  });
}));

module.exports = router;
