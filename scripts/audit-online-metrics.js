/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require(path.join(
  __dirname,
  '..',
  'backend',
  'generated',
  'postgres-client',
));

const TASK_STATUS = {
  RESERVA: 'RESERVA',
  EXECUTED: 'EXECUTED',
  IN_PROGRESS: 'IN_PROGRESS',
  CANCELLED: 'CANCELLED',
};

const CAUSE_L2_CONTRACTOR_PREFIX = 'L2C::';

function round2(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(2));
}

function normalizeFeedbackStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'EXECUTED_UNPLANNED') return 'EXECUTED_UNPLANNED';
  if (status === 'EXECUTED') return 'EXECUTED';
  if (status === 'STARTED' || status === 'IN_PROGRESS' || status === 'INICIADA') return 'STARTED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'NOT_STARTED';
}

function isContractorSpecificCause(cause) {
  return String(cause?.description || '').startsWith(CAUSE_L2_CONTRACTOR_PREFIX);
}

function taskOutcome(task) {
  const feedback = task.feedbacks?.[0] || null;
  const fbStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;
  const taskStatus = String(task.status || '').toUpperCase();
  if (fbStatus === 'CANCELLED' || taskStatus === TASK_STATUS.CANCELLED) return 'CANCELLED';
  if (fbStatus === 'EXECUTED' || fbStatus === 'EXECUTED_UNPLANNED' || taskStatus === TASK_STATUS.EXECUTED) return 'EXECUTED';
  if (fbStatus === 'STARTED' || taskStatus === TASK_STATUS.IN_PROGRESS) return 'STARTED';
  return 'NOT_STARTED';
}

function countsAsPlanned(task, outcome) {
  if (task.isUnplanned === true) return false;
  const taskStatus = String(task.status || '').toUpperCase();
  if (taskStatus === TASK_STATUS.RESERVA && outcome !== 'EXECUTED') return false;
  return true;
}

function computeCollaborationFinalScore(teamScore, presenceWeight, isPresentAtMeeting) {
  if (!Number.isInteger(teamScore)) return null;
  const normalizedPresenceWeight = Math.max(0, Math.min(10, Number(presenceWeight || 0)));
  const evaluationWeight = 10 - normalizedPresenceWeight;
  const presenceFactor = isPresentAtMeeting ? 1 : 0;
  return round2((presenceFactor * normalizedPresenceWeight) + ((Number(teamScore) / 10) * evaluationWeight));
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function addMetricRow(map, key, seed = {}) {
  if (!map.has(key)) {
    map.set(key, {
      ...seed,
      planned: 0,
      executed: 0,
      started: 0,
      notStarted: 0,
      cancelled: 0,
      reserveExcluded: 0,
      unplannedExecuted: 0,
      contractorSpecificCauses: 0,
    });
  }
  return map.get(key);
}

async function main() {
  const sourceUrl = String(process.env.SOURCE_DATABASE_URL || process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!sourceUrl) {
    throw new Error('Defina SOURCE_DATABASE_URL, TARGET_DATABASE_URL ou DATABASE_URL para auditar o Postgres online.');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: sourceUrl } },
  });

  try {
    const works = await prisma.work.findMany({
      orderBy: { id: 'asc' },
      include: {
        perceivedQualityConfig: true,
        weeks: {
          where: {
            feedbackStatus: 'CLOSED',
            qualityStatus: 'CLOSED',
          },
          orderBy: { weekNumber: 'asc' },
          include: {
            currentTasks: {
              include: {
                contractor: { include: { function: true } },
                location: true,
                feedbacks: {
                  include: { cause: true },
                },
              },
              orderBy: [{ sequenceNumber: 'asc' }, { id: 'asc' }],
            },
            perceivedQualityItems: {
              include: { contractor: true },
            },
            ppcMeeting: {
              include: {
                attendances: {
                  include: { contractor: true },
                },
              },
            },
          },
        },
      },
    });

    const report = {
      generatedAt: new Date().toISOString(),
      source: 'Postgres online PPC-Pro',
      rules: {
        rawPpc: 'atividades planejadas executadas / atividades planejadas; reserva so entra se executada; nao planejadas executadas nao entram no denominador',
        adjustedPpc: '100 - causas especificas do empreiteiro / atividades planejadas; reserva so entra se executada',
        collaboration: 'presenca * X + (notaEquipe / 10) * (10 - X)',
      },
      works: [],
    };

    works.forEach((work) => {
      const config = work.perceivedQualityConfig || {};
      const presenceWeight = Number(config.collaborationPresenceImpactScore || 0);
      const workRow = {
        workId: Number(work.id),
        workName: work.name,
        ppcTargetPct: Number(work.ppcTargetPct || 80),
        weeks: [],
        totals: {
          planned: 0,
          executed: 0,
          started: 0,
          notStarted: 0,
          cancelled: 0,
          reserveExcluded: 0,
          unplannedExecuted: 0,
          contractorSpecificCauses: 0,
        },
      };

      work.weeks.forEach((week) => {
        const byContractor = new Map();
        const attendance = new Map(
          (week.ppcMeeting?.attendances || []).map((row) => [Number(row.contractorId), row.present === true]),
        );
        const qualityByContractor = new Map(
          (week.perceivedQualityItems || []).map((item) => [Number(item.contractorId), item]),
        );

        week.currentTasks.forEach((task) => {
          const contractorId = Number(task.contractorId || 0);
          const contractorName = task.contractor?.name || 'SEM EMPREITEIRO';
          const row = addMetricRow(byContractor, contractorId || `none-${task.id}`, {
            contractorId: contractorId || null,
            contractorName,
            laborType: task.contractor?.function?.name || null,
          });

          const outcome = taskOutcome(task);
          const planned = countsAsPlanned(task, outcome);
          const taskIsReserve = String(task.status || '').toUpperCase() === TASK_STATUS.RESERVA;

          if (task.isUnplanned === true) {
            if (outcome === 'EXECUTED') row.unplannedExecuted += 1;
            return;
          }

          if (!planned) {
            if (taskIsReserve) row.reserveExcluded += 1;
            return;
          }

          row.planned += 1;
          if (outcome === 'EXECUTED') row.executed += 1;
          else if (outcome === 'STARTED') row.started += 1;
          else if (outcome === 'CANCELLED') row.cancelled += 1;
          else row.notStarted += 1;

          if (outcome !== 'EXECUTED' && isContractorSpecificCause(task.feedbacks?.[0]?.cause)) {
            row.contractorSpecificCauses += 1;
          }
        });

        const contractors = [...byContractor.values()]
          .sort((a, b) => String(a.contractorName).localeCompare(String(b.contractorName), 'pt-BR'))
          .map((row) => {
            const quality = row.contractorId ? qualityByContractor.get(Number(row.contractorId)) : null;
            const rawPpc = row.planned > 0 ? round2((row.executed / row.planned) * 100) : 0;
            const adjustedPpc = row.planned > 0
              ? round2(Math.max(0, 100 - ((row.contractorSpecificCauses / row.planned) * 100)))
              : 0;
            const qualityScore = Number.isInteger(quality?.qualityScore) ? Number(quality.qualityScore) : null;
            const collaborationTeamScore = Number.isInteger(quality?.collaborationTeamScore)
              ? Number(quality.collaborationTeamScore)
              : null;
            const safetyScore = Number.isInteger(quality?.safetyScore) ? Number(quality.safetyScore) : null;
            const cleaningScore = Number.isInteger(quality?.cleaningScore) ? Number(quality.cleaningScore) : null;
            const presentAtMeeting = row.contractorId ? attendance.get(Number(row.contractorId)) === true : false;
            const collaborationFinalScore = computeCollaborationFinalScore(
              collaborationTeamScore,
              presenceWeight,
              presentAtMeeting,
            );
            return {
              ...row,
              rawPpc,
              adjustedPpc,
              perceivedQuality: {
                ppcScore: round2(adjustedPpc / 10),
                qualityScore,
                collaborationTeamScore,
                presentAtMeeting,
                collaborationFinalScore,
                safetyScore,
                cleaningScore,
                averageScore: [round2(adjustedPpc / 10), qualityScore, collaborationFinalScore, safetyScore, cleaningScore]
                  .every((value) => value !== null && value !== undefined)
                  ? round2((
                    round2(adjustedPpc / 10)
                    + Number(qualityScore)
                    + Number(collaborationFinalScore)
                    + Number(safetyScore)
                    + Number(cleaningScore)
                  ) / 5)
                  : null,
                comments: quality?.comments || '',
              },
            };
          });

        const weekTotals = contractors.reduce((acc, row) => {
          Object.keys(acc).forEach((key) => {
            acc[key] += Number(row[key] || 0);
          });
          return acc;
        }, {
          planned: 0,
          executed: 0,
          started: 0,
          notStarted: 0,
          cancelled: 0,
          reserveExcluded: 0,
          unplannedExecuted: 0,
          contractorSpecificCauses: 0,
        });
        Object.keys(workRow.totals).forEach((key) => {
          workRow.totals[key] += Number(weekTotals[key] || 0);
        });

        workRow.weeks.push({
          weekId: Number(week.id),
          weekNumber: Number(week.weekNumber),
          startDate: formatDate(week.startDate),
          endDate: formatDate(week.endDate),
          totals: {
            ...weekTotals,
            rawPpc: weekTotals.planned > 0 ? round2((weekTotals.executed / weekTotals.planned) * 100) : 0,
            adjustedPpc: weekTotals.planned > 0
              ? round2(Math.max(0, 100 - ((weekTotals.contractorSpecificCauses / weekTotals.planned) * 100)))
              : 0,
          },
          contractors,
        });
      });

      workRow.totals.rawPpc = workRow.totals.planned > 0
        ? round2((workRow.totals.executed / workRow.totals.planned) * 100)
        : 0;
      workRow.totals.adjustedPpc = workRow.totals.planned > 0
        ? round2(Math.max(0, 100 - ((workRow.totals.contractorSpecificCauses / workRow.totals.planned) * 100)))
        : 0;
      report.works.push(workRow);
    });

    const outDir = path.join(__dirname, '..', 'docs', 'audits');
    ensureDir(outDir);
    const outPath = path.join(outDir, `ppc-online-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(`Auditoria gerada: ${outPath}`);
    report.works.forEach((work) => {
      console.log(`${work.workName}: ${work.weeks.length} semanas consolidadas | PPC cru ${work.totals.rawPpc}% | PPC ajustado ${work.totals.adjustedPpc}%`);
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Falha na auditoria: ${error.message}`);
  process.exit(1);
});
