/* eslint-disable no-console */
const path = require('path');
const { PrismaClient } = require(path.join(
  __dirname,
  '..',
  'backend',
  'generated',
  'postgres-client',
));

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = String(next);
      i += 1;
    }
  }
  return args;
}

async function findWorkByName(prisma, rawName) {
  const name = String(rawName || '').trim();
  if (!name) return null;
  const exact = await prisma.work.findFirst({ where: { name }, select: { id: true, name: true } });
  if (exact) return exact;
  return prisma.work.findFirst({
    where: { name: { contains: name, mode: 'insensitive' } },
    orderBy: { id: 'asc' },
    select: { id: true, name: true },
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const targetUrl = String(process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!targetUrl) throw new Error('Defina TARGET_DATABASE_URL (ou DATABASE_URL).');

  const workName = String(args.work || 'Euroville').trim();
  const weekNumber = Number.parseInt(String(args.week || ''), 10);
  const overwrite = String(args.overwrite || '').toLowerCase() === 'true';
  if (!Number.isFinite(weekNumber) || weekNumber <= 0) {
    throw new Error('Informe --week com número válido.');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: targetUrl } },
  });

  try {
    const work = await findWorkByName(prisma, workName);
    if (!work) throw new Error(`Obra não encontrada: ${workName}`);

    const week = await prisma.week.findFirst({
      where: { workId: work.id, weekNumber },
      select: { id: true, weekNumber: true },
    });
    if (!week) throw new Error(`Semana ${weekNumber} não encontrada para ${work.name}.`);

    const planningTasks = await prisma.task.findMany({
      where: { currentWeekId: week.id },
      include: { plannedDays: true },
      orderBy: { sequenceNumber: 'asc' },
    });
    if (!planningTasks.length) {
      console.log(JSON.stringify({
        ok: true,
        message: `Sem tarefas na Programação da semana ${weekNumber}. Nada para copiar.`,
      }, null, 2));
      return;
    }

    const existingPreCount = await prisma.preTask.count({ where: { weekId: week.id } });
    if (existingPreCount > 0 && !overwrite) {
      throw new Error(`Pré-programação já tem ${existingPreCount} tarefas. Use --overwrite true para substituir.`);
    }

    const result = await prisma.$transaction(async (tx) => {
      if (existingPreCount > 0 && overwrite) {
        const preTasks = await tx.preTask.findMany({
          where: { weekId: week.id },
          select: { id: true },
        });
        const preIds = preTasks.map((item) => item.id);
        if (preIds.length) {
          await tx.preTaskPlannedDay.deleteMany({ where: { preTaskId: { in: preIds } } });
        }
        await tx.preTask.deleteMany({ where: { weekId: week.id } });
      }

      let created = 0;
      for (const task of planningTasks) {
        // eslint-disable-next-line no-await-in-loop
        await tx.preTask.create({
          data: {
            sequenceNumber: task.sequenceNumber,
            originWeekId: task.originWeekId || week.id,
            weekId: week.id,
            contractorId: task.contractorId,
            supervisor: task.supervisor,
            locationId: task.locationId,
            description: task.description,
            plannedStart: task.plannedStart,
            plannedEnd: task.plannedEnd,
            status: task.status,
            plannedDays: {
              create: (task.plannedDays || []).map((day) => ({
                weekday: day.weekday,
                plannedDate: day.plannedDate,
              })),
            },
          },
        });
        created += 1;
      }
      return { created };
    });

    console.log(JSON.stringify({
      ok: true,
      work,
      week: week.weekNumber,
      copiedFromPlanning: planningTasks.length,
      createdInPrePlanning: result.created,
      overwrite,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\nFalha:', error.message);
  process.exitCode = 1;
});

