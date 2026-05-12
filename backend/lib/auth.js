const jwt = require('jsonwebtoken');
const { prisma } = require('./prisma');
const { asyncHandler, normalizeRole, parseIntId } = require('./helpers');
const { ROLES } = require('./constants');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

const loadUser = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.id },
    select: { id: true, name: true, email: true, contractorId: true, isActive: true },
  });

  if (!user || !user.isActive) return res.status(401).json({ error: 'inactive_user' });
  req.user = user;
  return next();
});

async function getActiveRoles(userId, workId) {
  const now = new Date();
  const rows = await prisma.userWorkRole.findMany({
    where: {
      userId,
      workId,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { role: true },
  });
  return new Set(rows.map((row) => normalizeRole(row.role)));
}

async function userIsAdminAnywhere(userId) {
  const now = new Date();
  const role = await prisma.userWorkRole.findFirst({
    where: {
      userId,
      role: ROLES.ADMIN,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(role);
}

function requireWorkRoles(roles, resolveWorkId) {
  return asyncHandler(async (req, res, next) => {
    const workId = resolveWorkId
      ? resolveWorkId(req)
      : parseIntId(req.params.workId || req.body.workId || req.query.workId);

    if (!workId) return res.status(400).json({ error: 'invalid_work_id' });

    const work = await prisma.work.findUnique({ where: { id: workId }, select: { id: true } });
    if (!work) return res.status(404).json({ error: 'work_not_found' });

    const allowed = new Set(roles.map(normalizeRole));
    const isGlobalAdmin = await userIsAdminAnywhere(req.user.id);
    if (isGlobalAdmin && allowed.has(ROLES.ADMIN)) {
      req.workId = workId;
      req.workRoles = new Set([ROLES.ADMIN]);
      return next();
    }

    const activeRoles = await getActiveRoles(req.user.id, workId);
    const hasPermission = [...activeRoles].some((role) => allowed.has(role));

    if (!hasPermission) return res.status(403).json({ error: 'forbidden' });

    req.workId = workId;
    req.workRoles = activeRoles;
    return next();
  });
}

function requireWeekRoles(roles) {
  return asyncHandler(async (req, res, next) => {
    const weekId = parseIntId(req.params.weekId);
    if (!weekId) return res.status(400).json({ error: 'invalid_week_id' });

    const week = await prisma.week.findUnique({
      where: { id: weekId },
      select: {
        id: true,
        workId: true,
      weekNumber: true,
      prePlanningStatus: true,
      planningStatus: true,
      feedbackStatus: true,
      qualityStatus: true,
    },
  });
    if (!week) return res.status(404).json({ error: 'week_not_found' });

    const allowed = new Set(roles.map(normalizeRole));
    const isGlobalAdmin = await userIsAdminAnywhere(req.user.id);
    if (isGlobalAdmin && allowed.has(ROLES.ADMIN)) {
      req.week = week;
      req.workId = week.workId;
      req.workRoles = new Set([ROLES.ADMIN]);
      return next();
    }

    const activeRoles = await getActiveRoles(req.user.id, week.workId);
    const hasPermission = [...activeRoles].some((role) => allowed.has(role));
    if (!hasPermission) return res.status(403).json({ error: 'forbidden' });

    req.week = week;
    req.workId = week.workId;
    req.workRoles = activeRoles;
    return next();
  });
}

module.exports = {
  JWT_SECRET,
  authenticate,
  loadUser,
  getActiveRoles,
  userIsAdminAnywhere,
  requireWorkRoles,
  requireWeekRoles,
};
