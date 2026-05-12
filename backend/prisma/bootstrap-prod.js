const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');

function asDate(value, fallbackIso) {
  if (!value) return new Date(fallbackIso);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(fallbackIso);
  return date;
}

async function main() {
  const adminName = String(process.env.ADMIN_NAME || 'Administrador PPC').trim();
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@ppc.local').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || 'admin123').trim();

  const workName = String(process.env.BOOTSTRAP_WORK_NAME || 'OBRA INICIAL').trim();
  const workAddress = String(process.env.BOOTSTRAP_WORK_ADDRESS || 'Endereço inicial, 100 - Centro').trim();
  const workCep = String(process.env.BOOTSTRAP_WORK_CEP || '01001000').trim();
  const workStartDate = asDate(process.env.BOOTSTRAP_WORK_START_DATE, '2026-01-05T00:00:00.000Z');

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL e ADMIN_PASSWORD sao obrigatorios para bootstrap.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
      isActive: true,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      isActive: true,
    },
  });

  const work = await prisma.work.findFirst({
    where: { name: workName },
    select: { id: true },
  });

  const targetWork = work || await prisma.work.create({
    data: {
      name: workName,
      address: workAddress,
      cep: workCep,
      startDate: workStartDate,
    },
    select: { id: true },
  });

  const existingAssignment = await prisma.userWorkRole.findFirst({
    where: {
      userId: admin.id,
      workId: targetWork.id,
      role: 'ADMIN',
      endsAt: null,
    },
    select: { id: true },
  });

  if (!existingAssignment) {
    await prisma.userWorkRole.create({
      data: {
        userId: admin.id,
        workId: targetWork.id,
        role: 'ADMIN',
        startsAt: new Date(),
      },
    });
  }

  console.log(JSON.stringify({
    ok: true,
    adminEmail,
    workId: targetWork.id,
    message: 'Bootstrap concluido: admin + obra inicial + vinculo ADMIN.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
