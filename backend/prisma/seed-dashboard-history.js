const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ZONE_L1_PREFIX = '__ZONE_L1__::';
const CAUSE_L1_PREFIX = 'L1::';
const CAUSE_L2_PREFIX = 'L2::';
const CAUSE_SPLITTER = '::';

function startOfDayLocal(dateInput) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function nextMondayAfterDate(dateInput) {
  const date = startOfDayLocal(dateInput);
  const day = date.getDay(); // 0=Dom, 1=Seg
  let diff = (8 - day) % 7;
  if (diff === 0) diff = 7;
  date.setDate(date.getDate() + diff);
  return date;
}

function calculateWeek1EndDate(week1StartDate) {
  const endDate = new Date(week1StartDate);
  const day = endDate.getDay(); // 0..6
  const toSaturday = (6 - day + 7) % 7;
  endDate.setDate(endDate.getDate() + toSaturday);
  const week2Start = nextMondayAfterDate(week1StartDate);
  if (endDate.getTime() >= week2Start.getTime()) {
    endDate.setTime(week2Start.getTime());
    endDate.setDate(endDate.getDate() - 1);
  }
  return endDate;
}

function calculateWeekPeriod(workStartDate, weekNumber) {
  const normalizedWeekNumber = Math.max(1, Number.parseInt(weekNumber, 10) || 1);
  const week1Start = startOfDayLocal(workStartDate);
  let startDate = new Date(week1Start);

  if (normalizedWeekNumber >= 2) {
    const week2Start = nextMondayAfterDate(week1Start);
    startDate = new Date(week2Start);
    startDate.setDate(startDate.getDate() + ((normalizedWeekNumber - 2) * 7));
  }

  let endDate;
  if (normalizedWeekNumber === 1) {
    endDate = calculateWeek1EndDate(startDate);
  } else {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5); // segunda a sábado
  }
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate, year: startDate.getFullYear() };
}

function toWeekdayRows(startDate, endDate) {
  const labels = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const rows = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day >= 1 && day <= 6) {
      rows.push({
        dayDate: new Date(current),
        weekday: labels[day],
        icon: 'CLOUDY',
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return rows;
}

function normalizeTaskStatusFromFeedback(feedbackStatus) {
  const status = String(feedbackStatus || '').toUpperCase();
  if (status === 'EXECUTED' || status === 'EXECUTED_UNPLANNED') return 'EXECUTED';
  if (status === 'STARTED') return 'IN_PROGRESS';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'PLANNED';
}

function seededStatus(weekNumber, taskNumber) {
  const seed = (weekNumber * 97 + taskNumber * 37) % 100;
  if (seed < 58) return 'EXECUTED';
  if (seed < 76) return 'STARTED';
  if (seed < 94) return 'NOT_STARTED';
  return 'CANCELLED';
}

async function ensureCause(workId, level, category, cause = '') {
  let description = `${CAUSE_L1_PREFIX}${category}`;
  if (level === 2) {
    description = `${CAUSE_L2_PREFIX}${category}${CAUSE_SPLITTER}${cause}`;
  }
  const existing = await prisma.cause.findFirst({
    where: {
      workId,
      description,
    },
  });
  if (existing) return existing;
  return prisma.cause.create({
    data: {
      workId,
      description,
    },
  });
}

async function ensureLocation(workId, level1, level2 = '') {
  const l1 = String(level1 || '').trim();
  const l2 = String(level2 || '').trim();
  if (!l1) return null;
  const effectiveL2 = l2 || `${ZONE_L1_PREFIX}${l1}`;
  const existing = await prisma.location.findUnique({
    where: {
      workId_level1_level2: { workId, level1: l1, level2: effectiveL2 },
    },
  });
  if (existing) return existing;
  return prisma.location.create({
    data: {
      workId,
      level1: l1,
      level2: effectiveL2,
    },
  });
}

async function ensureContractorFunction(name) {
  const normalized = String(name || '').trim().toLocaleUpperCase('pt-BR');
  if (!normalized) return null;
  const existing = await prisma.contractorFunction.findUnique({ where: { name: normalized } });
  if (existing) return existing;
  return prisma.contractorFunction.create({ data: { name: normalized } });
}

async function ensureContractor(workId, functionId, name, supervisor, email, phone) {
  const contractorName = String(name || '').trim();
  const existing = await prisma.contractor.findUnique({
    where: { workId_name: { workId, name: contractorName } },
  });
  const contact = [
    `ENCARREGADO=${supervisor}`,
    `EMAIL=${email}`,
    `TELEFONE=${phone}`,
  ].join('|');
  if (existing) {
    return prisma.contractor.update({
      where: { id: existing.id },
      data: {
        functionId: functionId || null,
        contact,
      },
    });
  }
  return prisma.contractor.create({
    data: {
      workId,
      functionId: functionId || null,
      name: contractorName,
      contact,
    },
  });
}

async function ensureWeekWithWeather(workId, workStartDate, weekNumber) {
  const period = calculateWeekPeriod(workStartDate, weekNumber);
  const weatherRows = toWeekdayRows(period.startDate, period.endDate);
  const existing = await prisma.week.findUnique({
    where: { workId_weekNumber: { workId, weekNumber } },
    include: { weatherDays: true },
  });

  if (!existing) {
    return prisma.week.create({
      data: {
        workId,
        weekNumber,
        year: period.year,
        startDate: period.startDate,
        endDate: period.endDate,
        planningStatus: 'OPEN',
        feedbackStatus: 'OPEN',
        weatherDays: {
          create: weatherRows.map((row) => ({
            dayDate: row.dayDate,
            weekday: row.weekday,
            icon: row.icon,
            tempMinC: 19 + ((weekNumber + row.dayDate.getDate()) % 4),
            tempMaxC: 28 + ((weekNumber + row.dayDate.getDate()) % 5),
            precipitationMm: ((weekNumber + row.dayDate.getDate()) % 3 === 0) ? 4 : 0,
            precipitationProbabilityPct: ((weekNumber + row.dayDate.getDate()) % 3 === 0) ? 62 : 8,
          })),
        },
      },
      include: { weatherDays: { orderBy: { dayDate: 'asc' } } },
    });
  }

  await prisma.week.update({
    where: { id: existing.id },
    data: {
      year: period.year,
      startDate: period.startDate,
      endDate: period.endDate,
    },
  });

  const expectedDates = weatherRows.map((row) => row.dayDate);
  await prisma.weekWeatherDay.deleteMany({
    where: {
      weekId: existing.id,
      dayDate: { notIn: expectedDates },
    },
  });

  for (const row of weatherRows) {
    await prisma.weekWeatherDay.upsert({
      where: { weekId_dayDate: { weekId: existing.id, dayDate: row.dayDate } },
      create: {
        weekId: existing.id,
        dayDate: row.dayDate,
        weekday: row.weekday,
        icon: row.icon,
        tempMinC: 19 + ((weekNumber + row.dayDate.getDate()) % 4),
        tempMaxC: 28 + ((weekNumber + row.dayDate.getDate()) % 5),
        precipitationMm: ((weekNumber + row.dayDate.getDate()) % 3 === 0) ? 4 : 0,
        precipitationProbabilityPct: ((weekNumber + row.dayDate.getDate()) % 3 === 0) ? 62 : 8,
      },
      update: {
        weekday: row.weekday,
        icon: row.icon,
      },
    });
  }

  return prisma.week.findUnique({
    where: { id: existing.id },
    include: { weatherDays: { orderBy: { dayDate: 'asc' } } },
  });
}

function dayOffsetByWeekday(weekday) {
  const map = {
    MONDAY: 0,
    TUESDAY: 1,
    WEDNESDAY: 2,
    THURSDAY: 3,
    FRIDAY: 4,
    SATURDAY: 5,
  };
  return map[String(weekday || '').toUpperCase()] ?? 0;
}

async function clearWeekTasks(weekId) {
  const tasks = await prisma.task.findMany({
    where: { currentWeekId: weekId },
    select: { id: true },
  });
  const taskIds = tasks.map((item) => item.id);
  if (!taskIds.length) return;

  await prisma.task.updateMany({
    where: { rolledFromTaskId: { in: taskIds } },
    data: { rolledFromTaskId: null },
  });
  await prisma.feedback.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.taskPlannedDay.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
}

async function main() {
  const workNameArg = String(process.env.WORK_NAME || 'TESTE').trim();
  const weeksBack = Math.max(2, Number.parseInt(process.env.WEEKS_BACK || '4', 10) || 4);

  const works = await prisma.work.findMany({ select: { id: true, name: true, startDate: true } });
  const work = works.find((item) => String(item.name || '').trim().toLowerCase() === workNameArg.toLowerCase())
    || works.find((item) => String(item.name || '').toLowerCase().includes(workNameArg.toLowerCase()));
  if (!work) {
    throw new Error(`Obra não encontrada para WORK_NAME=${workNameArg}`);
  }

  const roleUsers = await prisma.userWorkRole.findMany({
    where: {
      workId: work.id,
      role: { in: ['ENGINEERING', 'ADMIN', 'CONTROLLER'] },
      endsAt: null,
    },
    include: { user: true },
    orderBy: { startsAt: 'asc' },
  });
  const operatorUser = roleUsers[0]?.user || null;

  const existingWeeks = await prisma.week.findMany({
    where: { workId: work.id },
    orderBy: { weekNumber: 'asc' },
    select: { weekNumber: true },
  });
  const highestWeek = existingWeeks.length ? existingWeeks[existingWeeks.length - 1].weekNumber : 1;
  const startWeek = Math.max(1, highestWeek - weeksBack);
  const targetWeeks = [];
  for (let w = startWeek; w <= Math.max(1, highestWeek - 1); w += 1) targetWeeks.push(w);
  if (!targetWeeks.length) targetWeeks.push(Math.max(1, highestWeek));

  const functionStructure = await ensureContractorFunction('MO ESTRUTURA');
  const functionMasonry = await ensureContractorFunction('MO ALVENARIA');
  const functionPlaster = await ensureContractorFunction('MO REBOCO INTERNO');
  const functionPaint = await ensureContractorFunction('MO PINTURA INTERNA');

  const contractors = [
    await ensureContractor(work.id, functionStructure?.id, 'Construtora Alfa', 'Carlos Silva', 'alfa@teste.local', '51999991001'),
    await ensureContractor(work.id, functionMasonry?.id, 'Equipe Bloco Forte', 'Márcio Souza', 'bloco@teste.local', '51999991002'),
    await ensureContractor(work.id, functionPlaster?.id, 'Reboco Sul', 'Davi Martins', 'reboco@teste.local', '51999991003'),
    await ensureContractor(work.id, functionPaint?.id, 'Pinturas Brasil', 'André Lima', 'pintura@teste.local', '51999991004'),
  ];

  const locations = [
    await ensureLocation(work.id, 'Pav 01', 'Apto 101'),
    await ensureLocation(work.id, 'Pav 02', 'Apto 202'),
    await ensureLocation(work.id, 'Pav 03', 'Apto 303'),
    await ensureLocation(work.id, 'Pav 04', 'Apto 404'),
    await ensureLocation(work.id, 'Pav 05', ''),
  ];

  const causes = [
    await ensureCause(work.id, 1, 'PLANEJAMENTO'),
    await ensureCause(work.id, 2, 'PLANEJAMENTO', 'Sequenciamento inadequado'),
    await ensureCause(work.id, 2, 'PLANEJAMENTO', 'Mudança de prioridade'),
    await ensureCause(work.id, 1, 'SUPRIMENTOS'),
    await ensureCause(work.id, 2, 'SUPRIMENTOS', 'Falta de material'),
    await ensureCause(work.id, 2, 'SUPRIMENTOS', 'Atraso de fornecedor'),
    await ensureCause(work.id, 1, 'MÃO DE OBRA'),
    await ensureCause(work.id, 2, 'MÃO DE OBRA', 'Equipe insuficiente'),
    await ensureCause(work.id, 2, 'MÃO DE OBRA', 'Absenteísmo'),
    await ensureCause(work.id, 1, 'CLIMA'),
    await ensureCause(work.id, 2, 'CLIMA', 'Chuva forte'),
  ];
  const causeL2 = causes.filter((item) => String(item.description || '').startsWith(CAUSE_L2_PREFIX));

  const taskTemplates = [
    'Montagem de formas',
    'Armação de ferragens',
    'Concretagem de pilares',
    'Elevação de alvenaria',
    'Execução de chapisco',
    'Aplicação de reboco interno',
    'Instalação de infra elétrica',
    'Execução de contrapiso',
    'Assentamento cerâmico',
    'Preparação para pintura',
    'Pintura de paredes',
    'Limpeza técnica de frente de serviço',
  ];
  const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  let createdTasks = 0;
  let createdFeedbacks = 0;

  for (const weekNumber of targetWeeks) {
    const week = await ensureWeekWithWeather(work.id, work.startDate, weekNumber);
    await clearWeekTasks(week.id);

    const dayDateByWeekday = new Map(
      (week.weatherDays || []).map((item) => [String(item.weekday || '').toUpperCase(), item.dayDate]),
    );

    let seq = 1;
    for (let i = 0; i < taskTemplates.length; i += 1) {
      const contractor = contractors[i % contractors.length];
      const location = locations[(i + weekNumber) % locations.length];
      const supervisor = String(contractor.contact || '')
        .split('|')
        .find((part) => part.startsWith('ENCARREGADO='))
        ?.split('=')[1] || null;
      const template = taskTemplates[i];
      const description = `${template} - Frente ${((i % 4) + 1)}`;
      const status = seededStatus(weekNumber, i + 1);

      const startIdx = (weekNumber + i) % 5;
      const duration = 1 + ((weekNumber + i) % 3);
      const plannedDays = weekdays
        .slice(startIdx, Math.min(6, startIdx + duration))
        .map((weekday) => ({
          weekday,
          plannedDate: dayDateByWeekday.get(weekday) || null,
        }))
        .filter((item) => item.plannedDate);
      if (!plannedDays.length) {
        plannedDays.push({
          weekday: 'MONDAY',
          plannedDate: dayDateByWeekday.get('MONDAY') || new Date(week.startDate),
        });
      }
      const plannedStart = plannedDays[0].plannedDate;
      const plannedEnd = plannedDays[plannedDays.length - 1].plannedDate;

      const feedbackStatus = status;
      const taskStatus = normalizeTaskStatusFromFeedback(feedbackStatus);
      let actualStart = null;
      let actualEnd = null;
      if (feedbackStatus === 'EXECUTED' || feedbackStatus === 'STARTED') {
        actualStart = plannedStart;
        if (feedbackStatus === 'EXECUTED') actualEnd = plannedEnd;
      }

      const task = await prisma.task.create({
        data: {
          sequenceNumber: seq,
          originWeekId: week.id,
          currentWeekId: week.id,
          contractorId: contractor.id,
          supervisor,
          locationId: location.id,
          description,
          plannedStart,
          plannedEnd,
          actualStart,
          actualEnd,
          status: taskStatus,
          plannedDays: {
            create: plannedDays.map((day) => ({
              weekday: day.weekday,
              plannedDate: day.plannedDate,
              actualDate: (feedbackStatus === 'EXECUTED' || feedbackStatus === 'STARTED') ? day.plannedDate : null,
            })),
          },
        },
      });
      createdTasks += 1;
      seq += 1;

      const cause = (feedbackStatus === 'STARTED' || feedbackStatus === 'NOT_STARTED')
        ? causeL2[(weekNumber + i) % causeL2.length]
        : null;

      await prisma.feedback.create({
        data: {
          taskId: task.id,
          weekId: week.id,
          status: feedbackStatus,
          causeId: cause?.id || null,
          comments: cause ? `Impacto identificado: ${cause.description.replace(CAUSE_L2_PREFIX, '').replace(CAUSE_SPLITTER, ' - ')}` : null,
          submittedById: operatorUser?.id || null,
        },
      });
      createdFeedbacks += 1;
    }

    const unplannedCount = 1 + (weekNumber % 2);
    for (let j = 0; j < unplannedCount; j += 1) {
      const contractor = contractors[(weekNumber + j) % contractors.length];
      const location = locations[(weekNumber + j + 2) % locations.length];
      const weekday = weekdays[(weekNumber + j) % weekdays.length];
      const actualDate = dayDateByWeekday.get(weekday) || new Date(week.startDate);
      const supervisor = String(contractor.contact || '')
        .split('|')
        .find((part) => part.startsWith('ENCARREGADO='))
        ?.split('=')[1] || null;

      const task = await prisma.task.create({
        data: {
          sequenceNumber: seq,
          originWeekId: week.id,
          currentWeekId: week.id,
          contractorId: contractor.id,
          supervisor,
          locationId: location.id,
          description: `Atividade executada não planejada #${j + 1}`,
          plannedStart: null,
          plannedEnd: null,
          actualStart: actualDate,
          actualEnd: actualDate,
          status: 'EXECUTED',
          isUnplanned: true,
          plannedDays: {
            create: [{
              weekday,
              plannedDate: null,
              actualDate,
            }],
          },
        },
      });
      createdTasks += 1;
      seq += 1;

      await prisma.feedback.create({
        data: {
          taskId: task.id,
          weekId: week.id,
          status: 'EXECUTED_UNPLANNED',
          causeId: null,
          comments: 'Atividade executada não planejada.',
          submittedById: operatorUser?.id || null,
        },
      });
      createdFeedbacks += 1;
    }

    const planningClosedAt = new Date(week.startDate);
    planningClosedAt.setDate(planningClosedAt.getDate() + Math.min(4, dayOffsetByWeekday('FRIDAY')));
    planningClosedAt.setHours(15, 0, 0, 0);
    const feedbackClosedAt = new Date(planningClosedAt);
    feedbackClosedAt.setHours(17, 0, 0, 0);

    await prisma.week.update({
      where: { id: week.id },
      data: {
        planningStatus: 'CLOSED',
        feedbackStatus: 'CLOSED',
        planningClosedAt,
        planningClosedById: operatorUser?.id || null,
        feedbackClosedAt,
        feedbackClosedById: operatorUser?.id || null,
      },
    });
  }

  console.log('Histórico de dashboard gerado com sucesso.');
  console.log(`Obra: ${work.name} (id=${work.id})`);
  console.log(`Semanas atualizadas: ${targetWeeks.join(', ')}`);
  console.log(`Tarefas criadas: ${createdTasks}`);
  console.log(`Feedbacks criados: ${createdFeedbacks}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
