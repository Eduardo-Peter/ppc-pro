const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { SYSTEM_PROFILE_TEMPLATES, sanitizePermissionKeys } = require('../lib/permissions');

const prisma = new PrismaClient();

async function upsertUser(email, data) {
  return prisma.user.upsert({
    where: { email },
    update: data,
    create: { email, ...data },
  });
}

async function deleteWorkCompletely(workId) {
  const weeks = await prisma.week.findMany({
    where: { workId },
    select: { id: true },
  });
  const weekIds = weeks.map((w) => w.id);

  let taskIds = [];
  if (weekIds.length > 0) {
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { currentWeekId: { in: weekIds } },
          { originWeekId: { in: weekIds } },
        ],
      },
      select: { id: true },
    });
    taskIds = tasks.map((t) => t.id);
  }

  if (taskIds.length > 0) {
    await prisma.task.updateMany({
      where: { rolledFromTaskId: { in: taskIds } },
      data: { rolledFromTaskId: null },
    });

    await prisma.feedback.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.taskPlannedDay.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  }

  if (weekIds.length > 0) {
    await prisma.feedback.deleteMany({ where: { weekId: { in: weekIds } } });
    await prisma.reopenRequest.deleteMany({ where: { weekId: { in: weekIds } } });
    await prisma.weekWeatherDay.deleteMany({ where: { weekId: { in: weekIds } } });
    await prisma.week.deleteMany({ where: { id: { in: weekIds } } });
  }

  const groups = await prisma.taskGroup.findMany({
    where: { workId },
    select: { id: true },
  });
  const groupIds = groups.map((g) => g.id);
  if (groupIds.length > 0) {
    await prisma.taskGroupItem.deleteMany({ where: { taskGroupId: { in: groupIds } } });
    await prisma.taskGroup.deleteMany({ where: { id: { in: groupIds } } });
  }

  const contractors = await prisma.contractor.findMany({
    where: { workId },
    select: { id: true },
  });
  const contractorIds = contractors.map((c) => c.id);
  if (contractorIds.length > 0) {
    await prisma.user.updateMany({
      where: { contractorId: { in: contractorIds } },
      data: { contractorId: null },
    });
  }

  await prisma.futureWeekAuthorization.deleteMany({ where: { workId } });
  await prisma.notificationRule.deleteMany({ where: { workId } });
  await prisma.userProfileAssignment.deleteMany({ where: { workId } });
  await prisma.userWorkRole.deleteMany({ where: { workId } });
  await prisma.cause.deleteMany({ where: { workId } });
  await prisma.location.deleteMany({ where: { workId } });
  await prisma.contractor.deleteMany({ where: { workId } });
  await prisma.work.delete({ where: { id: workId } });
}

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const engHash = await bcrypt.hash('engenharia123', 10);
  const ctrHash = await bcrypt.hash('controller123', 10);
  const dirHash = await bcrypt.hash('diretoria123', 10);
  const contractorHash = await bcrypt.hash('empreiteiro123', 10);
  const viewerHash = await bcrypt.hash('visualizador123', 10);

  const admin = await upsertUser('admin@ppc.local', {
    name: 'Administrador PPC',
    email: 'admin@ppc.local',
    passwordHash: adminHash,
  });

  const engineer = await upsertUser('engenharia@ppc.local', {
    name: 'Engenharia Obra',
    email: 'engenharia@ppc.local',
    passwordHash: engHash,
  });

  const controller = await upsertUser('controller@ppc.local', {
    name: 'Controller',
    email: 'controller@ppc.local',
    passwordHash: ctrHash,
  });

  const director = await upsertUser('diretoria@ppc.local', {
    name: 'Diretoria',
    passwordHash: dirHash,
  });

  const work = await prisma.work.upsert({
    where: { id: 1 },
    update: {
      name: 'TESTE',
      address: 'Rua Teste, 100 - Centro',
      cep: '01001000',
      startDate: new Date('2026-01-05'),
    },
    create: {
      id: 1,
      name: 'TESTE',
      address: 'Rua Teste, 100 - Centro',
      cep: '01001000',
      startDate: new Date('2026-01-05'),
    },
  });

  const extraWorks = await prisma.work.findMany({
    where: { id: { not: work.id } },
    select: { id: true },
  });
  for (const extra of extraWorks) {
    await deleteWorkCompletely(extra.id);
  }

  const contractor = await prisma.contractor.upsert({
    where: { workId_name: { workId: work.id, name: 'Empreiteira TESTE' } },
    update: {
      contact: 'ENCARREGADO=Carlos Silva|EMAIL=empreiteirateste@ppc.local|TELEFONE=11987654321',
    },
    create: {
      workId: work.id,
      name: 'Empreiteira TESTE',
      contact: 'ENCARREGADO=Carlos Silva|EMAIL=empreiteirateste@ppc.local|TELEFONE=11987654321',
    },
  });

  const contractorUser = await upsertUser('empreiteiro@ppc.local', {
    name: 'Usuário Empreiteiro',
    passwordHash: contractorHash,
    contractorId: contractor.id,
  });

  const viewerUser = await upsertUser('visualizador@ppc.local', {
    name: 'Usuário Visualizador',
    passwordHash: viewerHash,
  });

  for (const template of SYSTEM_PROFILE_TEMPLATES) {
    // eslint-disable-next-line no-await-in-loop
    const profile = await prisma.permissionProfile.upsert({
      where: { name: template.name },
      update: {
        description: template.description,
        baseRole: template.baseRole,
        isSystem: true,
      },
      create: {
        name: template.name,
        description: template.description,
        baseRole: template.baseRole,
        isSystem: true,
      },
    });
    // eslint-disable-next-line no-await-in-loop
    await prisma.profilePermission.deleteMany({ where: { profileId: profile.id } });
    const keys = sanitizePermissionKeys(template.permissions);
    if (keys.length) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.profilePermission.createMany({
        data: keys.map((permissionKey) => ({ profileId: profile.id, permissionKey })),
      });
    }
  }

  await prisma.userWorkRole.deleteMany({
    where: {
      userId: {
        in: [admin.id, engineer.id, controller.id, director.id, contractorUser.id, viewerUser.id],
      },
    },
  });

  const roles = [
    { userId: admin.id, role: 'ADMIN' },
    { userId: engineer.id, role: 'ENGINEERING' },
    { userId: controller.id, role: 'CONTROLLER' },
    { userId: director.id, role: 'MANAGEMENT' },
    { userId: contractorUser.id, role: 'CONTRACTOR' },
    { userId: viewerUser.id, role: 'VISUALIZER' },
  ];

  for (const row of roles) {
    const exists = await prisma.userWorkRole.findFirst({
      where: { userId: row.userId, workId: work.id, role: row.role, endsAt: null },
    });
    if (!exists) {
      await prisma.userWorkRole.create({
        data: {
          userId: row.userId,
          workId: work.id,
          role: row.role,
          startsAt: new Date('2026-01-05T08:00:00'),
          assignedById: admin.id,
        },
      });
    }
  }

  await prisma.cause.upsert({
    where: { id: 1 },
    update: { description: 'Mau tempo', workId: null },
    create: { id: 1, description: 'Mau tempo', workId: null },
  });

  await prisma.cause.upsert({
    where: { id: 2 },
    update: { description: 'Falta de material', workId: null },
    create: { id: 2, description: 'Falta de material', workId: null },
  });

  await prisma.cause.upsert({
    where: { id: 3 },
    update: { description: 'Atraso de fornecedor', workId: null },
    create: { id: 3, description: 'Atraso de fornecedor', workId: null },
  });

  const week9 = await prisma.week.upsert({
    where: { workId_weekNumber: { workId: work.id, weekNumber: 9 } },
    update: {
      year: 2026,
      startDate: new Date('2026-03-02'),
      endDate: new Date('2026-03-07'),
    },
    create: {
      workId: work.id,
      weekNumber: 9,
      year: 2026,
      startDate: new Date('2026-03-02'),
      endDate: new Date('2026-03-07'),
    },
  });

  const existingTask = await prisma.task.findFirst({
    where: { currentWeekId: week9.id, sequenceNumber: 1 },
  });

  if (!existingTask) {
    await prisma.task.create({
      data: {
        sequenceNumber: 1,
        originWeekId: week9.id,
        currentWeekId: week9.id,
        contractorId: contractor.id,
        supervisor: 'Encarregado Carlos',
        description: 'Fechamento de formas de pilares',
        plannedStart: new Date('2026-03-02'),
        plannedEnd: new Date('2026-03-04'),
        status: 'PLANNED',
      },
    });
  }

  console.log('Seed concluido.');
  console.log('Admin: admin@ppc.local / admin123');
  console.log('Engenharia: engenharia@ppc.local / engenharia123');
  console.log('Controller: controller@ppc.local / controller123');
  console.log('Diretoria: diretoria@ppc.local / diretoria123');
  console.log('Empreiteiro: empreiteiro@ppc.local / empreiteiro123');
  console.log('Visualizador: visualizador@ppc.local / visualizador123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
