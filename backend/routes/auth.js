const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Router } = require('express');
const { prisma } = require('../lib/prisma');
const { writeAudit } = require('../lib/audit');
const { asyncHandler, normalizeRole, parseDate } = require('../lib/helpers');
const { authenticate, loadUser, userIsAdminAnywhere, JWT_SECRET } = require('../lib/auth');

const router = Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, contractorId, assignments = [] } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name_email_password_required' });
  }

  const usersCount = await prisma.user.count();
  let assignedById = null;

  if (usersCount > 0) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing_token' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'invalid_token' });
    }

    const isAdmin = await userIsAdminAnywhere(payload.id);
    if (!isAdmin) return res.status(403).json({ error: 'admin_required' });
    assignedById = payload.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      contractorId: contractorId || null,
    },
    select: { id: true, name: true, email: true, contractorId: true },
  });

  for (const assignment of assignments) {
    if (!assignment.workId || !assignment.role) continue;
    await prisma.userWorkRole.create({
      data: {
        userId: user.id,
        workId: assignment.workId,
        role: normalizeRole(assignment.role),
        startsAt: parseDate(assignment.startsAt) || new Date(),
        endsAt: parseDate(assignment.endsAt),
        assignedById,
      },
    });
  }

  await writeAudit({
    userId: assignedById,
    entityType: 'USER',
    entityId: user.id,
    eventType: 'USER_CREATED',
    description: `Usuario ${user.email} criado.`,
  });

  return res.status(201).json(user);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email_password_required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '8h' });

  // Registro de acesso por obra para viabilizar relatório semanal de acessos.
  try {
    const now = new Date();
    const assignments = await prisma.userWorkRole.findMany({
      where: {
        userId: user.id,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { workId: true },
    });
    const workIds = [...new Set(assignments.map((item) => Number(item.workId)).filter(Boolean))];
    for (const workId of workIds) {
      // eslint-disable-next-line no-await-in-loop
      await writeAudit({
        userId: user.id,
        workId,
        entityType: 'USER',
        entityId: user.id,
        eventType: 'USER_LOGIN',
        description: `Login realizado por ${user.email}.`,
      });
    }
  } catch {
    // Falha de auditoria não bloqueia autenticação.
  }

  return res.json({ token });
}));

router.get('/me', authenticate, loadUser, asyncHandler(async (req, res) => {
  const now = new Date();
  const assignments = await prisma.userWorkRole.findMany({
    where: {
      userId: req.user.id,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    include: { work: { select: { id: true, name: true } } },
    orderBy: [{ workId: 'asc' }, { role: 'asc' }],
  });

  return res.json({
    ...req.user,
    assignments: assignments.map((item) => ({
      id: item.id,
      role: item.role,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      workId: item.workId,
      workName: item.work.name,
    })),
  });
}));

module.exports = router;
