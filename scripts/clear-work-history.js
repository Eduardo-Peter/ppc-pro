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
  const exact = await prisma.work.findFirst({
    where: { name },
    select: { id: true, name: true },
  });
  if (exact) return exact;

  const byContains = await prisma.work.findFirst({
    where: {
      name: {
        contains: name,
        mode: 'insensitive',
      },
    },
    orderBy: { id: 'asc' },
    select: { id: true, name: true },
  });
  return byContains;
}

async function clearWorkHistory(prisma, workId) {
  const weeks = await prisma.week.findMany({
    where: { workId },
    select: { id: true },
  });
  const weekIds = weeks.map((w) => w.id);
  if (!weekIds.length) {
    return {
      weeks: 0,
      tasks: 0,
      preTasks: 0,
      feedbacks: 0,
      message: 'Sem semanas para limpar.',
    };
  }

  const tasks = await prisma.task.findMany({
    where: { currentWeekId: { in: weekIds } },
    select: { id: true },
  });
  const taskIds = tasks.map((t) => t.id);

  const preTasks = await prisma.preTask.findMany({
    where: { weekId: { in: weekIds } },
    select: { id: true },
  });
  const preTaskIds = preTasks.map((t) => t.id);

  const meetings = await prisma.weekPpcMeeting.findMany({
    where: { weekId: { in: weekIds } },
    select: { id: true },
  });
  const meetingIds = meetings.map((m) => m.id);

  const result = await prisma.$transaction(async (tx) => {
    const counts = {};

    counts.feedbacks = (await tx.feedback.deleteMany({ where: { weekId: { in: weekIds } } })).count;
    counts.qualityItems = (await tx.weekPerceivedQualityItem.deleteMany({ where: { weekId: { in: weekIds } } })).count;
    counts.weatherDays = (await tx.weekWeatherDay.deleteMany({ where: { weekId: { in: weekIds } } })).count;
    counts.reopenRequests = (await tx.reopenRequest.deleteMany({ where: { weekId: { in: weekIds } } })).count;

    if (meetingIds.length) {
      counts.meetingAttendances = (await tx.ppcMeetingAttendance.deleteMany({ where: { meetingId: { in: meetingIds } } })).count;
    } else {
      counts.meetingAttendances = 0;
    }
    counts.meetings = (await tx.weekPpcMeeting.deleteMany({ where: { weekId: { in: weekIds } } })).count;

    if (taskIds.length) {
      counts.taskDays = (await tx.taskPlannedDay.deleteMany({ where: { taskId: { in: taskIds } } })).count;
    } else {
      counts.taskDays = 0;
    }
    if (preTaskIds.length) {
      counts.preTaskDays = (await tx.preTaskPlannedDay.deleteMany({ where: { preTaskId: { in: preTaskIds } } })).count;
    } else {
      counts.preTaskDays = 0;
    }

    counts.tasks = (await tx.task.deleteMany({ where: { currentWeekId: { in: weekIds } } })).count;
    counts.preTasks = (await tx.preTask.deleteMany({ where: { weekId: { in: weekIds } } })).count;

    counts.futureWeekAuthorizations = (await tx.futureWeekAuthorization.deleteMany({ where: { workId } })).count;
    counts.auditEvents = (await tx.auditEvent.deleteMany({ where: { workId } })).count;
    counts.feasibilitySnapshots = (await tx.workFeasibilitySnapshot.deleteMany({ where: { workId } })).count;

    counts.weeks = (await tx.week.deleteMany({ where: { workId } })).count;
    return counts;
  });

  return result;
}

async function hideTesteWork(prisma) {
  const target = await prisma.work.findFirst({
    where: {
      OR: [
        { name: 'TESTE' },
        { name: '__HIDDEN__ TESTE' },
      ],
    },
    select: { id: true, name: true },
  });
  if (!target) return { changed: false, reason: 'obra TESTE não encontrada' };
  if (target.name === '__HIDDEN__ TESTE') return { changed: false, reason: 'já estava oculta', id: target.id };

  await prisma.work.update({
    where: { id: target.id },
    data: { name: '__HIDDEN__ TESTE' },
  });
  return { changed: true, id: target.id };
}

async function main() {
  const args = parseArgs(process.argv);
  const targetUrl = String(process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!targetUrl) throw new Error('Defina TARGET_DATABASE_URL (ou DATABASE_URL).');

  const workName = String(args.work || args.w || 'Euroville').trim();
  const hideTeste = args.hideTeste !== 'false';

  const prisma = new PrismaClient({
    datasources: { db: { url: targetUrl } },
  });

  try {
    const work = await findWorkByName(prisma, workName);
    if (!work) throw new Error(`Obra não encontrada para: ${workName}`);

    console.log(`Limpando histórico da obra: ${work.name} (id=${work.id})`);
    const clearCounts = await clearWorkHistory(prisma, work.id);

    let hiddenResult = null;
    if (hideTeste) {
      hiddenResult = await hideTesteWork(prisma);
      console.log(`Obra TESTE: ${hiddenResult.changed ? 'ocultada' : `sem alteração (${hiddenResult.reason})`}`);
    }

    console.log(JSON.stringify({
      ok: true,
      work: { id: work.id, name: work.name },
      clearCounts,
      hiddenResult,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\nFalha:', error.message);
  process.exitCode = 1;
});

