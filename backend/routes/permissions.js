const { Router } = require('express');
const { prisma } = require('../lib/prisma');
const { writeAudit } = require('../lib/audit');
const { ROLES } = require('../lib/constants');
const { asyncHandler, parseIntId, parseDate, normalizeRole } = require('../lib/helpers');
const { authenticate, loadUser, requireWorkRoles, userIsAdminAnywhere } = require('../lib/auth');
const {
  PERMISSION_CATALOG,
  ROLE_DEFAULT_PERMISSIONS,
  SYSTEM_PROFILE_TEMPLATES,
  sanitizePermissionKeys,
} = require('../lib/permissions');

const router = Router();

function serializeProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    baseRole: profile.baseRole,
    isSystem: profile.isSystem,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    permissionKeys: (profile.permissions || [])
      .map((item) => item.permissionKey)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
  };
}

async function ensureSystemProfiles() {
  for (const template of SYSTEM_PROFILE_TEMPLATES) {
    // eslint-disable-next-line no-await-in-loop
    const profile = await prisma.permissionProfile.upsert({
      where: { name: template.name },
      update: {
        description: template.description,
        baseRole: normalizeRole(template.baseRole),
        isSystem: true,
      },
      create: {
        name: template.name,
        description: template.description,
        baseRole: normalizeRole(template.baseRole),
        isSystem: true,
      },
    });

    const keys = sanitizePermissionKeys(template.permissions);
    // eslint-disable-next-line no-await-in-loop
    await prisma.profilePermission.deleteMany({ where: { profileId: profile.id } });
    if (keys.length) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.profilePermission.createMany({
        data: keys.map((permissionKey) => ({ profileId: profile.id, permissionKey })),
      });
    }
  }
}

const requireGlobalAdmin = asyncHandler(async (req, res, next) => {
  const isAdmin = await userIsAdminAnywhere(req.user.id);
  if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
  return next();
});

router.get('/permissions/catalog', authenticate, loadUser, asyncHandler(async (_req, res) => {
  return res.json(PERMISSION_CATALOG);
}));

router.get('/permission-profiles', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (_req, res) => {
  await ensureSystemProfiles();
  const list = await prisma.permissionProfile.findMany({
    include: {
      permissions: {
        orderBy: { permissionKey: 'asc' },
      },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
  return res.json(list.map(serializeProfile));
}));

router.post('/permission-profiles', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const baseRole = normalizeRole(req.body.baseRole);
  const permissionKeys = sanitizePermissionKeys(req.body.permissionKeys);

  if (!name || !description || !baseRole) return res.status(400).json({ error: 'name_description_baseRole_required' });
  if (!Object.values(ROLES).includes(baseRole)) return res.status(400).json({ error: 'invalid_base_role' });

  const profile = await prisma.permissionProfile.create({
    data: {
      name,
      description,
      baseRole,
      isSystem: false,
      permissions: {
        create: permissionKeys.map((permissionKey) => ({ permissionKey })),
      },
    },
    include: { permissions: true },
  });

  await writeAudit({
    userId: req.user.id,
    entityType: 'PERMISSION_PROFILE',
    entityId: profile.id,
    eventType: 'PROFILE_CREATED',
    description: `Perfil ${profile.name} criado.`,
    metadata: { baseRole, permissionKeys },
  });

  return res.status(201).json(serializeProfile(profile));
}));

router.put('/permission-profiles/:profileId', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const profileId = parseIntId(req.params.profileId);
  if (!profileId) return res.status(400).json({ error: 'invalid_profile_id' });

  const profile = await prisma.permissionProfile.findUnique({ where: { id: profileId } });
  if (!profile) return res.status(404).json({ error: 'profile_not_found' });

  const name = Object.prototype.hasOwnProperty.call(req.body, 'name')
    ? String(req.body.name || '').trim()
    : profile.name;
  const description = Object.prototype.hasOwnProperty.call(req.body, 'description')
    ? String(req.body.description || '').trim()
    : profile.description;
  const baseRole = Object.prototype.hasOwnProperty.call(req.body, 'baseRole')
    ? normalizeRole(req.body.baseRole)
    : profile.baseRole;
  const permissionKeys = Object.prototype.hasOwnProperty.call(req.body, 'permissionKeys')
    ? sanitizePermissionKeys(req.body.permissionKeys)
    : null;

  if (!name || !description || !baseRole) return res.status(400).json({ error: 'name_description_baseRole_required' });
  if (!Object.values(ROLES).includes(baseRole)) return res.status(400).json({ error: 'invalid_base_role' });

  const updated = await prisma.permissionProfile.update({
    where: { id: profileId },
    data: { name, description, baseRole },
  });

  if (permissionKeys) {
    await prisma.profilePermission.deleteMany({ where: { profileId } });
    if (permissionKeys.length) {
      await prisma.profilePermission.createMany({
        data: permissionKeys.map((permissionKey) => ({ profileId, permissionKey })),
      });
    }
  }

  const result = await prisma.permissionProfile.findUnique({
    where: { id: profileId },
    include: { permissions: true },
  });

  await writeAudit({
    userId: req.user.id,
    entityType: 'PERMISSION_PROFILE',
    entityId: profileId,
    eventType: 'PROFILE_UPDATED',
    description: `Perfil ${updated.name} atualizado.`,
    metadata: { baseRole, permissionKeys: permissionKeys || 'unchanged' },
  });

  return res.json(serializeProfile(result));
}));

router.delete('/permission-profiles/:profileId', authenticate, loadUser, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const profileId = parseIntId(req.params.profileId);
  if (!profileId) return res.status(400).json({ error: 'invalid_profile_id' });

  const profile = await prisma.permissionProfile.findUnique({ where: { id: profileId } });
  if (!profile) return res.status(404).json({ error: 'profile_not_found' });
  if (profile.isSystem) return res.status(409).json({ error: 'system_profile_cannot_be_deleted' });

  const assignmentCount = await prisma.userProfileAssignment.count({ where: { profileId } });
  if (assignmentCount > 0) return res.status(409).json({ error: 'profile_in_use' });

  await prisma.profilePermission.deleteMany({ where: { profileId } });
  await prisma.permissionProfile.delete({ where: { id: profileId } });

  await writeAudit({
    userId: req.user.id,
    entityType: 'PERMISSION_PROFILE',
    entityId: profileId,
    eventType: 'PROFILE_DELETED',
    description: `Perfil ${profile.name} excluído.`,
  });

  return res.status(204).send();
}));

router.get('/works/:workId/profile-assignments', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const rows = await prisma.userProfileAssignment.findMany({
    where: { workId: req.workId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      profile: { include: { permissions: true } },
    },
    orderBy: [{ userId: 'asc' }, { startsAt: 'asc' }],
  });

  return res.json(rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    workId: row.workId,
    profileId: row.profileId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    roleAssignmentId: row.roleAssignmentId,
    user: row.user,
    profile: serializeProfile(row.profile),
    isActiveNow: row.startsAt <= new Date() && (!row.endsAt || row.endsAt > new Date()),
  })));
}));

router.post('/works/:workId/users/:userId/profile-assignments', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const userId = parseIntId(req.params.userId);
  const profileId = parseIntId(req.body.profileId);
  if (!userId || !profileId) return res.status(400).json({ error: 'userId_profileId_required' });

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
    prisma.permissionProfile.findUnique({ where: { id: profileId } }),
  ]);
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  if (!profile) return res.status(404).json({ error: 'profile_not_found' });

  const startsAt = parseDate(req.body.startsAt) || new Date();
  const endsAt = parseDate(req.body.endsAt);
  if (endsAt && startsAt >= endsAt) return res.status(400).json({ error: 'invalid_date_range' });

  const roleAssignment = await prisma.userWorkRole.create({
    data: {
      userId,
      workId: req.workId,
      role: normalizeRole(profile.baseRole),
      startsAt,
      endsAt,
      assignedById: req.user.id,
    },
  });

  const assignment = await prisma.userProfileAssignment.create({
    data: {
      userId,
      workId: req.workId,
      profileId,
      startsAt,
      endsAt,
      assignedById: req.user.id,
      roleAssignmentId: roleAssignment.id,
    },
    include: {
      profile: { include: { permissions: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'USER_PROFILE_ASSIGNMENT',
    entityId: assignment.id,
    eventType: 'PROFILE_ASSIGNED_TO_USER',
    description: `Perfil ${profile.name} atribuído ao usuário ${user.email}.`,
    metadata: { startsAt, endsAt, baseRole: profile.baseRole },
  });

  return res.status(201).json({
    id: assignment.id,
    userId: assignment.userId,
    workId: assignment.workId,
    profileId: assignment.profileId,
    startsAt: assignment.startsAt,
    endsAt: assignment.endsAt,
    roleAssignmentId: assignment.roleAssignmentId,
    user: assignment.user,
    profile: serializeProfile(assignment.profile),
  });
}));

router.put('/works/:workId/users/:userId/profile-assignments/:assignmentId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const userId = parseIntId(req.params.userId);
  const assignmentId = parseIntId(req.params.assignmentId);
  if (!userId || !assignmentId) return res.status(400).json({ error: 'invalid_assignment_id' });

  const assignment = await prisma.userProfileAssignment.findUnique({
    where: { id: assignmentId },
    include: { profile: true },
  });
  if (!assignment || assignment.workId !== req.workId || assignment.userId !== userId) {
    return res.status(404).json({ error: 'assignment_not_found' });
  }

  const nextProfileId = Object.prototype.hasOwnProperty.call(req.body, 'profileId')
    ? parseIntId(req.body.profileId)
    : assignment.profileId;
  const startsAt = Object.prototype.hasOwnProperty.call(req.body, 'startsAt')
    ? parseDate(req.body.startsAt)
    : assignment.startsAt;
  const endsAt = Object.prototype.hasOwnProperty.call(req.body, 'endsAt')
    ? (req.body.endsAt ? parseDate(req.body.endsAt) : null)
    : assignment.endsAt;

  if (!nextProfileId || !startsAt) return res.status(400).json({ error: 'profileId_startsAt_required' });
  if (endsAt && startsAt >= endsAt) return res.status(400).json({ error: 'invalid_date_range' });

  const profile = await prisma.permissionProfile.findUnique({ where: { id: nextProfileId } });
  if (!profile) return res.status(404).json({ error: 'profile_not_found' });

  let roleAssignmentId = assignment.roleAssignmentId;
  if (roleAssignmentId) {
    await prisma.userWorkRole.update({
      where: { id: roleAssignmentId },
      data: {
        role: normalizeRole(profile.baseRole),
        startsAt,
        endsAt,
      },
    });
  } else {
    const createdRole = await prisma.userWorkRole.create({
      data: {
        userId,
        workId: req.workId,
        role: normalizeRole(profile.baseRole),
        startsAt,
        endsAt,
        assignedById: req.user.id,
      },
    });
    roleAssignmentId = createdRole.id;
  }

  const updated = await prisma.userProfileAssignment.update({
    where: { id: assignmentId },
    data: {
      profileId: nextProfileId,
      startsAt,
      endsAt,
      roleAssignmentId,
    },
    include: {
      profile: { include: { permissions: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'USER_PROFILE_ASSIGNMENT',
    entityId: updated.id,
    eventType: 'PROFILE_ASSIGNMENT_UPDATED',
    description: `Vínculo de perfil atualizado para o usuário ${updated.user.email}.`,
    metadata: { startsAt, endsAt, profileId: nextProfileId, baseRole: profile.baseRole },
  });

  return res.json({
    id: updated.id,
    userId: updated.userId,
    workId: updated.workId,
    profileId: updated.profileId,
    startsAt: updated.startsAt,
    endsAt: updated.endsAt,
    roleAssignmentId: updated.roleAssignmentId,
    user: updated.user,
    profile: serializeProfile(updated.profile),
  });
}));

router.delete('/works/:workId/users/:userId/profile-assignments/:assignmentId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const userId = parseIntId(req.params.userId);
  const assignmentId = parseIntId(req.params.assignmentId);
  if (!userId || !assignmentId) return res.status(400).json({ error: 'invalid_assignment_id' });

  const assignment = await prisma.userProfileAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      profile: true,
      user: { select: { email: true } },
    },
  });
  if (!assignment || assignment.workId !== req.workId || assignment.userId !== userId) {
    return res.status(404).json({ error: 'assignment_not_found' });
  }

  if (assignment.roleAssignmentId) {
    await prisma.userWorkRole.deleteMany({
      where: { id: assignment.roleAssignmentId, userId, workId: req.workId },
    });
  }
  await prisma.userProfileAssignment.delete({ where: { id: assignmentId } });

  await writeAudit({
    userId: req.user.id,
    workId: req.workId,
    entityType: 'USER_PROFILE_ASSIGNMENT',
    entityId: assignmentId,
    eventType: 'PROFILE_ASSIGNMENT_DELETED',
    description: `Vínculo de perfil ${assignment.profile?.name || '-'} removido do usuário ${assignment.user?.email || userId}.`,
  });

  return res.status(204).send();
}));

router.get('/works/:workId/effective-permissions', authenticate, loadUser, requireWorkRoles(Object.values(ROLES), (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const now = new Date();
  const profileAssignments = await prisma.userProfileAssignment.findMany({
    where: {
      userId: req.user.id,
      workId: req.workId,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    include: {
      profile: {
        include: {
          permissions: true,
        },
      },
    },
  });

  const activeRoles = [...(req.workRoles || [])].map(normalizeRole);
  const permissions = new Set();

  if (profileAssignments.length > 0) {
    profileAssignments.forEach((item) => {
      (item.profile?.permissions || []).forEach((perm) => {
        if (perm.permissionKey) permissions.add(perm.permissionKey);
      });
    });
  } else {
    activeRoles.forEach((role) => {
      (ROLE_DEFAULT_PERMISSIONS[role] || []).forEach((key) => permissions.add(key));
    });
  }

  return res.json({
    workId: req.workId,
    activeRoles,
    activeProfiles: profileAssignments.map((item) => ({
      assignmentId: item.id,
      profileId: item.profileId,
      profileName: item.profile?.name || '',
      baseRole: item.profile?.baseRole || '',
      startsAt: item.startsAt,
      endsAt: item.endsAt,
    })),
    permissions: [...permissions].sort((a, b) => a.localeCompare(b)),
  });
}));

module.exports = router;

