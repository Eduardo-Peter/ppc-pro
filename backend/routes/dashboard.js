const fs = require('fs');
const { Router } = require('express');
const { prisma } = require('../lib/prisma');
const { ROLES, WEEK_STATUS, TASK_STATUS } = require('../lib/constants');
const {
  asyncHandler,
  parseIntId,
  normalizeFeedbackStatus,
  summarizeWeek,
} = require('../lib/helpers');
const { authenticate, loadUser, requireWorkRoles } = require('../lib/auth');

let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
} catch {
  PDFDocument = null;
}

const router = Router();
const CAUSE_SPLITTER = '::';
const CAUSE_L1_PREFIX = 'L1::';
const CAUSE_L2_PREFIX = 'L2::';
const CAUSE_L2_CONTRACTOR_PREFIX = 'L2C::';
const ZONE_L1_PREFIX = '__ZONE_L1__::';

function parseCauseDescription(description) {
  const text = String(description || '').trim();
  if (!text) {
    return {
      level: 1,
      category: '',
      cause: '',
      label: '',
      contractorSpecific: false,
    };
  }
  if (text.startsWith(CAUSE_L1_PREFIX)) {
    const category = text.slice(CAUSE_L1_PREFIX.length).trim();
    return {
      level: 1,
      category,
      cause: '',
      label: category,
      contractorSpecific: false,
    };
  }
  const isContractorSpecific = text.startsWith(CAUSE_L2_CONTRACTOR_PREFIX);
  if (text.startsWith(CAUSE_L2_PREFIX) || isContractorSpecific) {
    const rest = text.slice((isContractorSpecific ? CAUSE_L2_CONTRACTOR_PREFIX : CAUSE_L2_PREFIX).length).trim();
    const idx = rest.indexOf(CAUSE_SPLITTER);
    if (idx < 0) {
      return {
        level: 2,
        category: 'Geral',
        cause: rest,
        label: rest,
        contractorSpecific: isContractorSpecific,
      };
    }
    const category = rest.slice(0, idx).trim() || 'Geral';
    const cause = rest.slice(idx + CAUSE_SPLITTER.length).trim() || '';
    return {
      level: 2,
      category,
      cause,
      label: `${category} - ${cause}`,
      contractorSpecific: isContractorSpecific,
    };
  }
  const idx = text.indexOf(CAUSE_SPLITTER);
  if (idx >= 0) {
    const category = text.slice(0, idx).trim() || 'Geral';
    const cause = text.slice(idx + CAUSE_SPLITTER.length).trim() || '';
    return {
      level: 2,
      category,
      cause,
      label: `${category} - ${cause}`,
      contractorSpecific: false,
    };
  }
  return {
    level: 1,
    category: text,
    cause: '',
    label: text,
    contractorSpecific: false,
  };
}

function computeCollaborationFinalScore(teamScore, presenceWeight, isPresentAtMeeting) {
  if (!Number.isInteger(teamScore)) return null;
  const normalizedPresenceWeight = Math.max(0, Math.min(10, Number(presenceWeight || 0)));
  const evaluationWeight = 10 - normalizedPresenceWeight;
  const presenceFactor = isPresentAtMeeting ? 1 : 0;
  return Number(((presenceFactor * normalizedPresenceWeight) + ((Number(teamScore) / 10) * evaluationWeight)).toFixed(2));
}

function formatDateBr(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function inferBrazilTimeZoneFromWork(work) {
  const address = String(work?.address || '');
  const ufMatch = /\/([A-Z]{2})(?:\)|$)/i.exec(address);
  const uf = String(ufMatch?.[1] || '').toUpperCase();
  const map = {
    AC: 'America/Rio_Branco',
    AM: 'America/Manaus',
    RR: 'America/Boa_Vista',
    RO: 'America/Porto_Velho',
    MT: 'America/Cuiaba',
    MS: 'America/Campo_Grande',
    PA: 'America/Belem',
    AP: 'America/Belem',
    TO: 'America/Araguaina',
  };
  return map[uf] || 'America/Sao_Paulo';
}

function formatDateTimeBrInTimeZone(value, timeZone) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleString('pt-BR', { timeZone });
  } catch {
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
}

function decodeImageDataUrl(dataUrl) {
  const text = String(dataUrl || '').trim();
  const match = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(text);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

function computeDashboardMetrics(tasks, feedbacks) {
  const byTask = new Map(feedbacks.map((fb) => [fb.taskId, fb]));

  const totals = {
    executed: 0,
    unplannedExecuted: 0,
    started: 0,
    notStarted: 0,
    cancelled: 0,
  };
  const byContractor = new Map();
  const causeByKey = new Map();
  const causeByCategory = new Map();

  const ensureContractor = (contractorName) => {
    if (!byContractor.has(contractorName)) {
      byContractor.set(contractorName, {
        contractor: contractorName,
        executed: 0,
        started: 0,
        notStarted: 0,
        cancelled: 0,
      });
    }
    return byContractor.get(contractorName);
  };

  const registerCause = (cause) => {
    if (!cause) return;
    const parsed = parseCauseDescription(cause.description);
    const category = String(parsed.category || '').trim() || 'Sem grupo';
    const causeName = String(parsed.level === 2 ? parsed.cause : parsed.label || parsed.category || '').trim();
    if (!causeName) return;
    const key = `${category}${CAUSE_SPLITTER}${causeName}`;
    causeByKey.set(key, (causeByKey.get(key) || 0) + 1);
    causeByCategory.set(category, (causeByCategory.get(category) || 0) + 1);
  };

  for (const task of tasks) {
    const feedback = byTask.get(task.id);
    const feedbackStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;
    const contractorName = task.contractor?.name || 'SEM_EMPREITEIRO';
    const row = ensureContractor(contractorName);
    const isReserve = String(task.status || '').toUpperCase() === 'RESERVA';
    const isExecutedOutcome = (
      task.status === 'EXECUTED'
      || feedbackStatus === 'EXECUTED'
      || feedbackStatus === 'EXECUTED_UNPLANNED'
    );

    if (task.isUnplanned === true) {
      if (isExecutedOutcome) {
        totals.unplannedExecuted += 1;
      }
      continue;
    }

    // Regra de negócio:
    // Reserva só entra como atividade planejada se de fato for executada.
    if (isReserve && !isExecutedOutcome) {
      continue;
    }

    if (task.status === 'CANCELLED' || feedbackStatus === 'CANCELLED') {
      totals.cancelled += 1;
      row.cancelled += 1;
      continue;
    }
    if (isExecutedOutcome) {
      totals.executed += 1;
      row.executed += 1;
      continue;
    }
    if (task.status === 'IN_PROGRESS' || feedbackStatus === 'STARTED') {
      totals.started += 1;
      row.started += 1;
      registerCause(feedback?.cause || null);
      continue;
    }
    totals.notStarted += 1;
    row.notStarted += 1;
    registerCause(feedback?.cause || null);
  }

  const totalActivities = (
    totals.executed
    + totals.unplannedExecuted
    + totals.started
    + totals.notStarted
    + totals.cancelled
  );
  const totalExecutedPct = totalActivities
    ? Number((((totals.executed + totals.unplannedExecuted) / totalActivities) * 100).toFixed(2))
    : 0;

  const statusBars = [
    { key: 'planned_executed', label: 'Tarefas programadas executadas', count: totals.executed, color: '#2f8f65' },
    { key: 'unplanned_executed', label: 'Tarefas não planejadas e executadas', count: totals.unplannedExecuted, color: '#2477c4' },
    { key: 'planned_started', label: 'Tarefas programadas iniciadas', count: totals.started, color: '#f0ad4e' },
    { key: 'planned_not_started', label: 'Tarefas programadas não iniciadas', count: totals.notStarted, color: '#db5757' },
    { key: 'cancelled', label: 'Tarefas canceladas', count: totals.cancelled, color: '#8d99aa' },
  ].map((item) => ({
    ...item,
    pct: totalActivities ? Number(((item.count / totalActivities) * 100).toFixed(2)) : 0,
  }));

  const contractorRows = [...byContractor.values()]
    .map((row) => {
      const considered = row.executed + row.started + row.notStarted;
      const executionPct = considered ? Number(((row.executed / considered) * 100).toFixed(2)) : 0;
      return {
        ...row,
        considered,
        executionPct,
      };
    })
    .sort((a, b) => (
      Number(b.executionPct) - Number(a.executionPct)
      || String(a.contractor || '').localeCompare(String(b.contractor || ''), 'pt-BR')
    ));

  const causeTotal = [...causeByKey.values()].reduce((acc, value) => acc + value, 0);
  const causes = [...causeByKey.entries()]
    .map(([key, count]) => {
      const [category, causeName] = String(key || '').split(CAUSE_SPLITTER);
      const categoryCount = causeByCategory.get(category) || 0;
      return {
        category,
        cause: causeName,
        count,
        pct: causeTotal ? Number(((count / causeTotal) * 100).toFixed(2)) : 0,
        categoryCount,
        categoryPct: causeTotal ? Number(((categoryCount / causeTotal) * 100).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => (
      Number(b.categoryCount) - Number(a.categoryCount)
      || String(a.category || '').localeCompare(String(b.category || ''), 'pt-BR')
      || Number(b.count) - Number(a.count)
      || String(a.cause || '').localeCompare(String(b.cause || ''), 'pt-BR')
    ));

  const groupedCauses = [];
  const seenCategories = new Set();
  causes.forEach((item) => {
    if (!seenCategories.has(item.category)) {
      groupedCauses.push({
        type: 'CATEGORY',
        category: item.category,
        count: item.categoryCount,
        pct: item.categoryPct,
      });
      seenCategories.add(item.category);
    }
    groupedCauses.push({
      type: 'CAUSE',
      category: item.category,
      cause: item.cause,
      count: item.count,
      pct: item.pct,
    });
  });

  return {
    totals,
    totalActivities,
    totalExecutedPct,
    statusBars,
    contractorRows,
    causes,
    groupedCauses,
  };
}

function computeContractorSpecificCauseNonCompliance(tasks, feedbacks) {
  const feedbackByTask = new Map(feedbacks.map((fb) => [Number(fb.taskId), fb]));
  const byContractor = new Map();

  const ensureRow = (contractorName) => {
    if (!byContractor.has(contractorName)) {
      byContractor.set(contractorName, {
        contractor: contractorName,
        planned: 0,
        nonExecutedWithContractorSpecificCause: 0,
      });
    }
    return byContractor.get(contractorName);
  };

  tasks.forEach((task) => {
    if (task.isUnplanned === true) return;

    const contractorName = String(task.contractor?.name || 'SEM_EMPREITEIRO');
    const row = ensureRow(contractorName);
    const feedback = feedbackByTask.get(Number(task.id)) || null;
    const feedbackStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;
    const isReserve = String(task.status || '').toUpperCase() === 'RESERVA';
    const isExecutedOutcome = (
      task.status === 'EXECUTED'
      || feedbackStatus === 'EXECUTED'
      || feedbackStatus === 'EXECUTED_UNPLANNED'
    );

    if (isReserve && !isExecutedOutcome) return;
    row.planned += 1;

    const outcome = taskOutcome(task, feedbackByTask);
    if (outcome === 'EXECUTED') return;
    const parsed = parseCauseDescription(feedback?.cause?.description || '');
    if (parsed.contractorSpecific) {
      row.nonExecutedWithContractorSpecificCause += 1;
    }
  });

  return [...byContractor.values()]
    .map((row) => ({
      ...row,
      pct: row.planned > 0
        ? Number(((row.nonExecutedWithContractorSpecificCause / row.planned) * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => (
      Number(b.pct) - Number(a.pct)
      || Number(b.nonExecutedWithContractorSpecificCause) - Number(a.nonExecutedWithContractorSpecificCause)
      || String(a.contractor || '').localeCompare(String(b.contractor || ''), 'pt-BR')
    ));
}

function taskOutcome(task, feedbackByTaskId) {
  const feedback = feedbackByTaskId.get(task.id) || null;
  const feedbackStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;
  if (task.status === 'CANCELLED' || feedbackStatus === 'CANCELLED') return 'CANCELLED';
  if (task.status === 'EXECUTED' || feedbackStatus === 'EXECUTED' || feedbackStatus === 'EXECUTED_UNPLANNED') return 'EXECUTED';
  if (task.status === 'IN_PROGRESS' || feedbackStatus === 'STARTED') return 'STARTED';
  return 'NOT_STARTED';
}

function normalizeLocationLevel2(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith(ZONE_L1_PREFIX)) return '';
  return raw;
}

function drawVerticalBarChart(doc, {
  x,
  y,
  width,
  height,
  bars,
  title,
  axisTitleY = '%',
  valueSuffix = '%',
  valueTextFormatter = null,
  annotationStyle = 'vertical',
  pctLabelFontSize = 7.2,
  countBubbleFontSize = 8.4,
  showLegend = false,
}) {
  const wrapLabel = (text, maxChars = 16, maxLines = 3) => {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const words = raw.split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxChars) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    if (lines.length <= maxLines) return lines.join('\n');
    const clipped = lines.slice(0, maxLines);
    clipped[maxLines - 1] = `${clipped[maxLines - 1]}...`;
    return clipped.join('\n');
  };

  const chartTop = y + 20;
  const labelArea = 38;
  const chartHeight = height - (20 + labelArea);
  const chartBottom = chartTop + chartHeight;
  const axisLeft = x + 30;
  const axisRight = x + width - 8;
  const plotWidth = axisRight - axisLeft;

  doc.fillColor('#1e3c59').font('Helvetica-Bold').fontSize(9.2)
    .text(String(title || ''), x + 8, y + 6, {
      width: width - 16,
      align: 'left',
      lineBreak: false,
      ellipsis: true,
    });

  doc.save().strokeColor('#97b6d8').lineWidth(0.8);
  doc.moveTo(axisLeft, chartTop).lineTo(axisLeft, chartBottom).stroke();
  doc.moveTo(axisLeft, chartBottom).lineTo(axisRight, chartBottom).stroke();
  doc.restore();

  const ticks = [0, 25, 50, 75, 100];
  ticks.forEach((tick) => {
    const yTick = chartBottom - ((tick / 100) * chartHeight);
    doc.save().strokeColor('#d7e6f6').lineWidth(0.55)
      .moveTo(axisLeft, yTick).lineTo(axisRight, yTick).stroke().restore();
    doc.fillColor('#4b6784').font('Helvetica').fontSize(6.6)
      .text(`${tick}`, x + 1, yTick - 3, {
        width: 25,
        align: 'right',
        lineBreak: false,
      });
  });

  doc.fillColor('#4b6784').font('Helvetica').fontSize(6.6)
    .text(axisTitleY, x + 2, chartTop - 12, {
      width: 24,
      align: 'right',
      lineBreak: false,
    });

  const safeBars = Array.isArray(bars) ? bars : [];
  const barCount = Math.max(1, safeBars.length);
  const slotW = plotWidth / barCount;
  const barW = Math.max(8, Math.min(30, slotW * 0.56));

  safeBars.forEach((bar, index) => {
    const rawPct = Number(bar.pct || 0);
    const pct = Math.max(0, Math.min(100, rawPct));
    const value = Number.isFinite(Number(bar.value)) ? Number(bar.value) : rawPct;
    const h = (pct / 100) * chartHeight;
    const slotStart = axisLeft + (index * slotW);
    const barX = axisLeft + (index * slotW) + ((slotW - barW) / 2);
    const barY = chartBottom - h;
    const color = String(bar.color || '#2f8f65');

    doc.save().fillColor(color).rect(barX, barY, barW, h).fill().restore();
    if (annotationStyle === 'pct_bubble') {
      const pctText = `${pct.toFixed(1).replace('.', ',')}%`;
      const pctY = Math.max(chartTop - 4, barY - 12);
      doc.fillColor('#1e3c59').font('Helvetica-Bold').fontSize(pctLabelFontSize)
        .text(pctText, slotStart, pctY, {
          width: slotW,
          align: 'center',
          lineBreak: false,
        });

      const countValue = Number.isFinite(Number(bar.count))
        ? Number(bar.count)
        : Number.isFinite(Number(bar.value)) ? Number(bar.value) : 0;
      const bubbleR = 10;
      const bubbleX = Math.min(
        axisRight - bubbleR - 1,
        Math.max(axisLeft + bubbleR + 1, barX + barW + bubbleR + 3),
      );
      const bubbleY = Math.min(
        chartBottom - bubbleR - 2,
        Math.max(chartTop + bubbleR + 2, barY + (h / 2)),
      );
      doc.save().fillColor('#111111').circle(bubbleX, bubbleY, bubbleR).fill().restore();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(countBubbleFontSize)
        .text(String(countValue), bubbleX - bubbleR, bubbleY - 3.7, {
          width: bubbleR * 2,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
    } else {
      const valueText = typeof valueTextFormatter === 'function'
        ? String(valueTextFormatter({ ...bar, pct, value }))
        : `${value.toFixed(1).replace('.', ',')}${valueSuffix}`;
      // Mantem o percentual ao lado da barra, com folga fixa para nunca sobrepor.
      const valueSafetyGap = 10;
      const valueAnchorX = Math.max(axisLeft + 1, barX - valueSafetyGap);
      doc.save().fillColor('#1e3c59').font('Helvetica-Bold').fontSize(7.2);
      doc.rotate(-90, { origin: [valueAnchorX, chartBottom - 2] });
      doc.text(valueText, valueAnchorX, chartBottom - 2, {
        width: Math.max(34, chartHeight - 2),
        align: 'left',
        lineBreak: false,
        ellipsis: true,
      });
      doc.restore();
    }

    const label = wrapLabel(bar.label, Math.max(10, Math.floor(slotW / 4.4)), 3);
    doc.fillColor('#1e3c59').font('Helvetica').fontSize(6.4)
      .text(label, slotStart, chartBottom + 4, {
        width: slotW,
        align: 'center',
        lineBreak: true,
        ellipsis: true,
      });
  });

  if (showLegend) {
    let lx = x + 8;
    const ly = y + height - 16;
    safeBars.forEach((bar) => {
      const label = String(bar.label || '');
      const color = String(bar.color || '#2f8f65');
      const sw = 8;
      doc.save().fillColor(color).rect(lx, ly, sw, sw).fill().restore();
      doc.fillColor('#1e3c59').font('Helvetica').fontSize(6.3)
        .text(label, lx + sw + 3, ly - 1, { lineBreak: false, ellipsis: true });
      lx += sw + 3 + Math.min(110, doc.widthOfString(label) + 8);
      if (lx > x + width - 110) lx = x + 8;
    });
  }
}

async function resolveWeekAndMetricsForDashboardReport(workId, weekNumber = null) {
  const weekWhere = {
    workId,
    feedbackStatus: WEEK_STATUS.CLOSED,
    qualityStatus: WEEK_STATUS.CLOSED,
  };
  if (weekNumber) weekWhere.weekNumber = weekNumber;

  const week = await prisma.week.findFirst({
    where: weekWhere,
    include: {
      work: true,
      prePlanningClosedBy: { select: { name: true } },
      planningClosedBy: { select: { name: true } },
      feedbackClosedBy: { select: { name: true } },
      qualityClosedBy: { select: { name: true } },
      ppcMeeting: {
        include: {
          closedBy: { select: { name: true } },
        },
      },
    },
    orderBy: [{ weekNumber: 'desc' }],
  });
  if (!week) return null;

  const tasks = await prisma.task.findMany({
    where: { currentWeekId: week.id },
    include: {
      contractor: true,
      location: true,
      originWeek: { select: { id: true, weekNumber: true } },
    },
    orderBy: { sequenceNumber: 'asc' },
  });
  const feedbacks = await prisma.feedback.findMany({
    where: { weekId: week.id },
    include: { cause: true },
  });

  const summary = summarizeWeek(tasks, feedbacks);
  const metrics = computeDashboardMetrics(tasks, feedbacks);
  return {
    week,
    tasks,
    feedbacks,
    summary,
    metrics,
  };
}

async function buildWeeklyOperationalInsights(week, tasks, feedbacks) {
  const feedbackByTaskId = new Map(feedbacks.map((item) => [item.taskId, item]));
  const weekStart = new Date(week.startDate);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(week.endDate);
  weekEnd.setHours(23, 59, 59, 999);

  const loginEvents = await prisma.auditEvent.findMany({
    where: {
      workId: week.workId,
      eventType: 'USER_LOGIN',
      createdAt: { gte: weekStart, lte: weekEnd },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const loginByUser = new Map();
  loginEvents.forEach((event) => {
    const key = String(event.userId || `anon-${event.id}`);
    if (!loginByUser.has(key)) {
      loginByUser.set(key, {
        userId: event.user?.id ? Number(event.user.id) : null,
        userName: event.user?.name || event.user?.email || 'Usuário não identificado',
        email: event.user?.email || '',
        count: 0,
      });
    }
    loginByUser.get(key).count += 1;
  });
  const weeklyAccess = [...loginByUser.values()]
    .sort((a, b) => (Number(b.count) - Number(a.count) || String(a.userName).localeCompare(String(b.userName), 'pt-BR')));

  const pendingFromPrior = tasks.filter((task) => (
    task.isUnplanned !== true
    && Number(task.originWeekId) !== Number(task.currentWeekId)
  ));
  const pendingResolved = pendingFromPrior.filter((task) => taskOutcome(task, feedbackByTaskId) === 'EXECUTED');
  const pendingRemaining = pendingFromPrior.filter((task) => {
    const outcome = taskOutcome(task, feedbackByTaskId);
    return outcome === 'STARTED' || outcome === 'NOT_STARTED';
  });
  const pendingResolvedPct = pendingFromPrior.length
    ? Number(((pendingResolved.length / pendingFromPrior.length) * 100).toFixed(2))
    : 0;

  const historyTaskCache = new Map();
  const loadTaskBasic = async (taskId) => {
    const key = Number(taskId || 0);
    if (!key) return null;
    if (historyTaskCache.has(key)) return historyTaskCache.get(key);
    const task = await prisma.task.findUnique({
      where: { id: key },
      select: {
        id: true,
        rolledFromTaskId: true,
      },
    });
    historyTaskCache.set(key, task || null);
    return task || null;
  };

  const pendingHistoryCache = new Map();
  const loadPendingCauseHistory = async (taskId) => {
    const key = Number(taskId || 0);
    if (!key) return '-';
    if (pendingHistoryCache.has(key)) return pendingHistoryCache.get(key);

    const lineage = [];
    let cursor = key;
    let guard = 0;
    while (cursor && guard < 80) {
      // eslint-disable-next-line no-await-in-loop
      const task = await loadTaskBasic(cursor);
      if (!task) break;
      lineage.push(task.id);
      cursor = task.rolledFromTaskId ? Number(task.rolledFromTaskId) : 0;
      guard += 1;
    }

    if (!lineage.length) {
      pendingHistoryCache.set(key, '-');
      return '-';
    }

    const lineageFeedbacks = await prisma.feedback.findMany({
      where: {
        taskId: { in: lineage },
        causeId: { not: null },
      },
      include: {
        cause: true,
        week: { select: { weekNumber: true } },
      },
    });
    const history = lineageFeedbacks
      .map((item) => {
        const parsed = parseCauseDescription(item.cause?.description || '');
        const causeLabel = parsed.level === 2
          ? `${parsed.category} - ${parsed.cause}`
          : parsed.label || parsed.category || 'Sem descrição';
        return {
          weekNumber: Number(item.week?.weekNumber || 0),
          causeLabel,
        };
      })
      .filter((item) => item.weekNumber > 0)
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .map((item) => `Sem ${item.weekNumber}: ${item.causeLabel}`);

    const result = history.length ? history.join(' | ') : '-';
    pendingHistoryCache.set(key, result);
    return result;
  };

  const pendingRemainingRows = [];
  for (const task of pendingRemaining) {
    // eslint-disable-next-line no-await-in-loop
    const history = await loadPendingCauseHistory(task.id);
    pendingRemainingRows.push({
      taskId: Number(task.id),
      description: String(task.description || '-'),
      contractor: String(task.contractor?.name || '-'),
      originWeek: Number(task.originWeek?.weekNumber || 0) || '-',
      location1: String(task.location?.level1 || '-'),
      location2: normalizeLocationLevel2(task.location?.level2),
      status: taskOutcome(task, feedbackByTaskId),
      history,
    });
  }

  return {
    weeklyAccess,
    pendingFromPrior,
    pendingResolved,
    pendingRemaining,
    pendingResolvedPct,
    pendingRemainingRows,
  };
}

function toMonthKey(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelFromKey(monthKey) {
  const raw = String(monthKey || '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return raw;
  return `${match[2]}/${match[1]}`;
}

function weekdayToJsIndex(rawWeekday) {
  const key = String(rawWeekday || '').trim().toUpperCase();
  const map = {
    SUNDAY: 0,
    DOMINGO: 0,
    MONDAY: 1,
    SEGUNDA: 1,
    TUESDAY: 2,
    TERCA: 2,
    TERÇA: 2,
    WEDNESDAY: 3,
    QUARTA: 3,
    THURSDAY: 4,
    QUINTA: 4,
    FRIDAY: 5,
    SEXTA: 5,
    SATURDAY: 6,
    SABADO: 6,
    SÁBADO: 6,
  };
  return map[key] ?? null;
}

function parseTimeText(timeText, fallback = '00:00') {
  const source = String(timeText || fallback || '00:00').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(source);
  if (!match) return { hour: 0, minute: 0 };
  const hour = Math.max(0, Math.min(23, Number.parseInt(match[1], 10) || 0));
  const minute = Math.max(0, Math.min(59, Number.parseInt(match[2], 10) || 0));
  return { hour, minute };
}

function getDatePartsInTimeZone(dateInput, timeZone = 'America/Sao_Paulo') {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const map = {};
    parts.forEach((part) => {
      if (part.type !== 'literal') map[part.type] = part.value;
    });
    return {
      year: Number(map.year || 0),
      month: Number(map.month || 0),
      day: Number(map.day || 0),
      hour: Number(map.hour || 0),
      minute: Number(map.minute || 0),
      second: Number(map.second || 0),
    };
  } catch {
    return null;
  }
}

function utcDateFromParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function addUtcDays(dateInput, days) {
  const date = new Date(dateInput);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date;
}

function nextMondayAfterUtcDate(dateInput) {
  const date = new Date(dateInput);
  const day = date.getUTCDay(); // 0=Dom, 1=Seg
  let diff = (8 - day) % 7;
  if (diff === 0) diff = 7;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

function calculateWeekPeriodByNumberInTimeZone(workStartDate, weekNumber, timeZone = 'America/Sao_Paulo') {
  const startParts = getDatePartsInTimeZone(workStartDate, timeZone);
  if (!startParts?.year || !startParts?.month || !startParts?.day) return null;
  const normalizedWeekNumber = Math.max(1, Number.parseInt(weekNumber, 10) || 1);
  const week1Start = utcDateFromParts(startParts.year, startParts.month, startParts.day);
  let startDate = new Date(week1Start);

  if (normalizedWeekNumber >= 2) {
    const week2Start = nextMondayAfterUtcDate(week1Start);
    startDate = addUtcDays(week2Start, (normalizedWeekNumber - 2) * 7);
  }

  let endDate;
  if (normalizedWeekNumber === 1) {
    endDate = new Date(startDate);
    const toSaturday = (6 - endDate.getUTCDay() + 7) % 7;
    endDate = addUtcDays(endDate, toSaturday);
    const week2Start = nextMondayAfterUtcDate(week1Start);
    if (endDate.getTime() >= week2Start.getTime()) {
      endDate = addUtcDays(week2Start, -1);
    }
  } else {
    endDate = addUtcDays(startDate, 5);
  }

  return { startDate, endDate };
}

function computeWeekDeadlineLocalParts(week, weekdayRule, timeRule, fallbackWeekday, fallbackTime, options = {}) {
  const scope = String(options.scope || 'CURRENT_WEEK').toUpperCase();
  const baseWeekNumber = Math.max(1, Number.parseInt(week?.weekNumber, 10) || 1);
  let targetWeekNumber = baseWeekNumber;
  if (scope === 'PREVIOUS_WEEK') targetWeekNumber = Math.max(1, baseWeekNumber - 1);
  if (scope === 'NEXT_WEEK') targetWeekNumber = Math.max(1, baseWeekNumber + 1);

  const timeZone = options.timeZone || inferBrazilTimeZoneFromWork(week?.work || week);
  const workStartDate = week?.work?.startDate || week?.startDate;
  const targetPeriod = calculateWeekPeriodByNumberInTimeZone(workStartDate, targetWeekNumber, timeZone);
  if (!targetPeriod) return null;

  const weekday = weekdayToJsIndex(weekdayRule) ?? weekdayToJsIndex(fallbackWeekday) ?? 5;
  const { hour, minute } = parseTimeText(timeRule, fallbackTime);

  let target = new Date(targetPeriod.startDate);
  while (target.getTime() <= targetPeriod.endDate.getTime() && target.getUTCDay() !== weekday) {
    target = addUtcDays(target, 1);
  }
  if (target.getTime() > targetPeriod.endDate.getTime()) {
    target = new Date(targetPeriod.endDate);
  }

  return {
    year: target.getUTCFullYear(),
    month: target.getUTCMonth() + 1,
    day: target.getUTCDate(),
    hour,
    minute,
    second: 0,
    timeZone,
  };
}

function compareLocalDateTimeParts(a, b) {
  if (!a || !b) return null;
  const fields = ['year', 'month', 'day', 'hour', 'minute', 'second'];
  for (const field of fields) {
    const diff = Number(a[field] || 0) - Number(b[field] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function formatDeadlineLocalPartsBr(parts) {
  if (!parts) return '-';
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  const yyyy = String(parts.year);
  const hh = String(parts.hour).padStart(2, '0');
  const mi = String(parts.minute).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function startOfDayLocal(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function nextMondayAfterDateLocal(dateInput) {
  const date = startOfDayLocal(dateInput);
  if (!date) return null;
  const day = date.getDay(); // 0=Dom, 1=Seg
  let diff = (8 - day) % 7;
  if (diff === 0) diff = 7;
  date.setDate(date.getDate() + diff);
  return date;
}

function calculateWeek1EndDateLocal(week1StartDate) {
  const endDate = new Date(week1StartDate);
  const day = endDate.getDay();
  const toSaturday = (6 - day + 7) % 7;
  endDate.setDate(endDate.getDate() + toSaturday);
  const week2Start = nextMondayAfterDateLocal(week1StartDate);
  if (week2Start && endDate.getTime() >= week2Start.getTime()) {
    endDate.setTime(week2Start.getTime());
    endDate.setDate(endDate.getDate() - 1);
  }
  endDate.setHours(23, 59, 59, 999);
  return endDate;
}

function calculateWeekPeriodByNumberLocal(workStartDate, weekNumber) {
  const normalizedWeekNumber = Math.max(1, Number.parseInt(weekNumber, 10) || 1);
  const week1Start = startOfDayLocal(workStartDate);
  if (!week1Start) return null;

  let startDate = new Date(week1Start);
  if (normalizedWeekNumber >= 2) {
    const week2Start = nextMondayAfterDateLocal(week1Start);
    if (!week2Start) return null;
    startDate = new Date(week2Start);
    startDate.setDate(startDate.getDate() + ((normalizedWeekNumber - 2) * 7));
  }

  let endDate;
  if (normalizedWeekNumber === 1) {
    endDate = calculateWeek1EndDateLocal(startDate);
  } else {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5);
    endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
}

function computeWeekDeadlineDate(week, weekdayRule, timeRule, fallbackWeekday, fallbackTime, options = {}) {
  const scope = String(options.scope || 'CURRENT_WEEK').toUpperCase();
  const baseWeekNumber = Math.max(1, Number.parseInt(week?.weekNumber, 10) || 1);
  let targetWeekNumber = baseWeekNumber;
  if (scope === 'PREVIOUS_WEEK') targetWeekNumber = Math.max(1, baseWeekNumber - 1);
  if (scope === 'NEXT_WEEK') targetWeekNumber = Math.max(1, baseWeekNumber + 1);

  const workStartDate = week?.work?.startDate || week?.startDate;
  const targetPeriod = calculateWeekPeriodByNumberLocal(workStartDate, targetWeekNumber);
  if (!targetPeriod) return null;
  const start = startOfDayLocal(targetPeriod.startDate);
  const end = new Date(targetPeriod.endDate);
  if (!start || Number.isNaN(end.getTime())) return null;
  end.setHours(23, 59, 59, 999);

  const weekday = weekdayToJsIndex(weekdayRule) ?? weekdayToJsIndex(fallbackWeekday) ?? 5;
  const { hour, minute } = parseTimeText(timeRule, fallbackTime);

  let target = null;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getDay() === weekday) {
      target = new Date(cursor);
      break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!target) target = new Date(end);
  target.setHours(hour, minute, 0, 0);
  return target;
}

function assignMonthForWeekByWorkdays(week) {
  const start = new Date(week.startDate);
  const end = new Date(week.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const key = toMonthKey(week.startDate);
    return { monthKey: key, monthLabel: monthLabelFromKey(key) };
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const counts = new Map();
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) {
      const key = toMonthKey(cursor);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (!counts.size) {
    const key = toMonthKey(start);
    return { monthKey: key, monthLabel: monthLabelFromKey(key) };
  }

  const entries = [...counts.entries()].sort((a, b) => Number(b[1]) - Number(a[1]) || String(a[0]).localeCompare(String(b[0])));
  const byRule = entries.find(([, count]) => Number(count) >= 3);
  const startKey = toMonthKey(start);
  const sameTopCount = entries.filter((item) => item[1] === entries[0][1]).map((item) => item[0]);
  const chosenKey = byRule
    ? byRule[0]
    : (sameTopCount.includes(startKey) ? startKey : entries[0][0]);
  return { monthKey: chosenKey, monthLabel: monthLabelFromKey(chosenKey) };
}

async function computeHistoricalDashboardSnapshot(workId, selectedWeekNumber = null) {
  const [work, allWeeks, rule] = await Promise.all([
    prisma.work.findUnique({ where: { id: workId } }),
    prisma.week.findMany({
      where: { workId },
      include: {
        work: { select: { startDate: true } },
        planningClosedBy: { select: { name: true } },
        feedbackClosedBy: { select: { name: true } },
      },
      orderBy: { weekNumber: 'asc' },
    }),
    prisma.notificationRule.findUnique({ where: { workId } }),
  ]);

  if (!work || !allWeeks.length) return null;

  const isFeedbackClosed = (week) => (
    String(week?.feedbackStatus || '').toUpperCase() === WEEK_STATUS.CLOSED
    || !!week?.feedbackClosedAt
  );
  const isQualityClosed = (week) => (
    String(week?.qualityStatus || '').toUpperCase() === WEEK_STATUS.CLOSED
    || !!week?.qualityClosedAt
  );
  const isHistoricallyClosed = (week) => isFeedbackClosed(week) && isQualityClosed(week);

  const requestedWeek = selectedWeekNumber
    ? allWeeks.find((item) => Number(item.weekNumber) === Number(selectedWeekNumber))
    : allWeeks[allWeeks.length - 1];
  if (!requestedWeek) return null;

  const closedWeeks = allWeeks.filter((item) => isHistoricallyClosed(item));
  let selectedWeek = closedWeeks
    .filter((item) => Number(item.weekNumber) <= Number(requestedWeek.weekNumber))
    .at(-1) || null;
  if (!selectedWeek) {
    selectedWeek = closedWeeks.at(-1) || null;
  }
  if (!selectedWeek) return null;

  const historyWeeks = closedWeeks.filter((item) => Number(item.weekNumber) <= Number(selectedWeek.weekNumber));
  if (!historyWeeks.length) return null;

  const weeksUpToRequested = allWeeks.filter((item) => Number(item.weekNumber) <= Number(requestedWeek.weekNumber));
  const excludedWeeks = weeksUpToRequested.filter((item) => !isHistoricallyClosed(item));

  const firstWeek = historyWeeks[0];
  const weekIds = historyWeeks.map((item) => Number(item.id));
  const weekById = new Map(historyWeeks.map((item) => [Number(item.id), item]));
  const historyStart = new Date(firstWeek.startDate);
  historyStart.setHours(0, 0, 0, 0);
  const historyEnd = new Date(selectedWeek.endDate);
  historyEnd.setHours(23, 59, 59, 999);

  const [tasks, preTasks, feedbacks, loginEvents, reopenApprovals, causesCatalog, ppcMeetings, qualityConfig, qualityItems] = await Promise.all([
    prisma.task.findMany({
      where: { currentWeekId: { in: weekIds } },
      include: {
        contractor: {
          include: {
            function: true,
          },
        },
        location: true,
        currentWeek: { select: { id: true, weekNumber: true, startDate: true, endDate: true } },
        originWeek: { select: { id: true, weekNumber: true } },
      },
      orderBy: [{ currentWeekId: 'asc' }, { sequenceNumber: 'asc' }],
    }),
    prisma.preTask.findMany({
      where: { weekId: { in: weekIds } },
      select: {
        weekId: true,
        sequenceNumber: true,
        contractorId: true,
        locationId: true,
        description: true,
        plannedStart: true,
        plannedEnd: true,
        status: true,
      },
      orderBy: [{ weekId: 'asc' }, { sequenceNumber: 'asc' }],
    }),
    prisma.feedback.findMany({
      where: { weekId: { in: weekIds } },
      include: { cause: true },
    }),
    prisma.auditEvent.findMany({
      where: {
        workId,
        eventType: 'USER_LOGIN',
        createdAt: { gte: historyStart, lte: historyEnd },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.reopenRequest.findMany({
      where: { weekId: { in: weekIds }, status: 'APPROVED' },
      select: { id: true, weekId: true, requestedAt: true, approvedAt: true },
    }),
    prisma.cause.findMany({
      where: {
        OR: [
          { workId },
          { workId: null },
        ],
      },
      orderBy: { id: 'asc' },
      select: { id: true, description: true },
    }),
    prisma.weekPpcMeeting.findMany({
      where: { weekId: { in: weekIds } },
      select: {
        weekId: true,
        closedAt: true,
      },
    }),
    prisma.workPerceivedQualityConfig.findUnique({
      where: { workId },
    }),
    prisma.weekPerceivedQualityItem.findMany({
      where: { weekId: { in: weekIds } },
      include: {
        contractor: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ contractorId: 'asc' }, { weekId: 'asc' }],
    }),
  ]);

  const feedbackByTaskId = new Map(feedbacks.map((item) => [Number(item.taskId), item]));
  const tasksByWeek = new Map();
  tasks.forEach((task) => {
    const key = Number(task.currentWeekId);
    if (!tasksByWeek.has(key)) tasksByWeek.set(key, []);
    tasksByWeek.get(key).push(task);
  });
  const preTasksByWeek = new Map();
  preTasks.forEach((task) => {
    const key = Number(task.weekId);
    if (!preTasksByWeek.has(key)) preTasksByWeek.set(key, []);
    preTasksByWeek.get(key).push(task);
  });

  const metrics = computeDashboardMetrics(tasks, feedbacks);
  const contractorGlobal = new Map();
  const zoneGlobal = new Map();
  const weeklyRows = [];
  const monthGlobal = new Map();
  const monthContractor = new Map();
  const contractorWeeklyTrendRows = [];
  const contractorPpcWeeklyRows = [];
  const contractorWeeklyPerformanceRows = [];
  const monthContractorPerformance = new Map();
  const laborTypeGlobal = new Map();
  const contractorReliability = new Map();
  const causeImpactByCategory = new Map();
  const causeImpactByCause = new Map();
  const pendingLeadWeeks = [];
  let replannedTasksCount = 0;
  let plannedTasksCount = 0;
  const normalizeTextForDiff = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  const normalizeDateForDiff = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  };
  const taskComparableSignature = (task) => ([
    Number(task?.contractorId || 0),
    Number(task?.locationId || 0),
    normalizeTextForDiff(task?.description),
    normalizeDateForDiff(task?.plannedStart),
    normalizeDateForDiff(task?.plannedEnd),
    normalizeTextForDiff(task?.status),
  ].join('|'));
  const contractorReliabilityTargetPct = Number.isFinite(Number(work?.ppcTargetPct))
    ? Number(work.ppcTargetPct)
    : 80;

  const ensureContractorGlobal = (name) => {
    if (!contractorGlobal.has(name)) {
      contractorGlobal.set(name, {
        contractor: name,
        planned: 0,
        executed: 0,
        started: 0,
        notStarted: 0,
        cancelled: 0,
        unplannedExecuted: 0,
        totalActivities: 0,
      });
    }
    return contractorGlobal.get(name);
  };

  const ensureZoneGlobal = (zone1) => {
    if (!zoneGlobal.has(zone1)) {
      zoneGlobal.set(zone1, {
        zone1,
        planned: 0,
        executedPlanned: 0,
        totalActivities: 0,
      });
    }
    return zoneGlobal.get(zone1);
  };

  const ensureLaborTypeGlobal = (name) => {
    if (!laborTypeGlobal.has(name)) {
      laborTypeGlobal.set(name, {
        laborType: name,
        planned: 0,
        executed: 0,
        started: 0,
        notStarted: 0,
        cancelled: 0,
        unplannedExecuted: 0,
      });
    }
    return laborTypeGlobal.get(name);
  };

  const ensureContractorReliability = (name) => {
    if (!contractorReliability.has(name)) {
      contractorReliability.set(name, {
        contractor: name,
        weeksActive: 0,
        weeksAboveTarget: 0,
        executionPctSum: 0,
      });
    }
    return contractorReliability.get(name);
  };

  const registerCauseImpact = (cause, weight = 1) => {
    if (!cause) return;
    const parsed = parseCauseDescription(cause.description);
    const category = String(parsed.category || '').trim() || 'Sem grupo';
    const causeName = String(parsed.level === 2 ? parsed.cause : parsed.label || parsed.category || '').trim();
    if (!causeName) return;
    const key = `${category}${CAUSE_SPLITTER}${causeName}`;
    causeImpactByCategory.set(category, (causeImpactByCategory.get(category) || 0) + Number(weight || 0));
    causeImpactByCause.set(key, (causeImpactByCause.get(key) || 0) + Number(weight || 0));
  };

  historyWeeks.forEach((week) => {
    const weekTasks = tasksByWeek.get(Number(week.id)) || [];
    const contractorWeek = new Map();
    const contractorWeekPpc = new Map();
    const contractorWeekPerformance = new Map();
    const row = {
      weekId: Number(week.id),
      weekNumber: Number(week.weekNumber),
      planned: 0,
      executed: 0,
      started: 0,
      notStarted: 0,
      causeCount: 0,
      nonExecuted: 0,
      cancelled: 0,
      unplannedExecuted: 0,
      totalActivities: 0,
      ppc: 0,
      executedPlannedPct: 0,
      totalExecutedPct: 0,
      planningQualityPct: 0,
      monthKey: '',
      monthLabel: '',
    };

    const ensureContractorWeek = (name) => {
      if (!contractorWeek.has(name)) {
        contractorWeek.set(name, {
          contractor: name,
          planned: 0,
          executed: 0,
          started: 0,
          notStarted: 0,
          cancelled: 0,
          unplannedExecuted: 0,
        });
      }
      return contractorWeek.get(name);
    };
    const ensureContractorWeekPpc = (key, contractorId, name) => {
      if (!contractorWeekPpc.has(key)) {
        contractorWeekPpc.set(key, {
          contractorId: Number(contractorId || 0) || null,
          contractor: name,
          plannedBase: 0,
          executedPlanned: 0,
        });
      }
      return contractorWeekPpc.get(key);
    };
    const ensureContractorWeekPerformance = (name) => {
      if (!contractorWeekPerformance.has(name)) {
        contractorWeekPerformance.set(name, {
          contractor: name,
          plannedBase: 0,
          contractorSpecificNonCompliance: 0,
        });
      }
      return contractorWeekPerformance.get(name);
    };

    weekTasks.forEach((task) => {
      const outcome = taskOutcome(task, feedbackByTaskId);
      const feedback = feedbackByTaskId.get(Number(task.id)) || null;
      const contractorName = String(task.contractor?.name || 'SEM_EMPREITEIRO');
      const contractorId = Number(task.contractor?.id || 0) || null;
      const contractorKey = contractorId ? String(contractorId) : `N:${contractorName}`;
      const laborTypeName = String(task.contractor?.function?.name || 'SEM MÃO DE OBRA');
      const zone1 = String(task.location?.level1 || 'SEM ZONA');
      const globalContractor = ensureContractorGlobal(contractorName);
      const weekContractor = ensureContractorWeek(contractorName);
      const ppcContractor = ensureContractorWeekPpc(contractorKey, contractorId, contractorName);
      const perfContractor = ensureContractorWeekPerformance(contractorName);
      const globalLaborType = ensureLaborTypeGlobal(laborTypeName);
      const zone = ensureZoneGlobal(zone1);
      const feedbackStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;
      const isReserve = String(task.status || '').toUpperCase() === TASK_STATUS.RESERVA;
      const isExecutedOutcome = (
        String(task.status || '').toUpperCase() === TASK_STATUS.EXECUTED
        || feedbackStatus === 'EXECUTED'
        || feedbackStatus === 'EXECUTED_UNPLANNED'
      );

      if (task.isUnplanned === true) {
        if (outcome === 'EXECUTED') {
          row.unplannedExecuted += 1;
          row.totalActivities += 1;
          globalContractor.unplannedExecuted += 1;
          globalLaborType.unplannedExecuted += 1;
          globalContractor.totalActivities += 1;
          weekContractor.unplannedExecuted += 1;
          zone.totalActivities += 1;
        }
        return;
      }

      // Regra de negócio:
      // Reserva cancelada/não executada não entra no histórico de PPC,
      // nem nos acumulados de planejadas/canceladas.
      if (isReserve && !isExecutedOutcome) {
        return;
      }

      ppcContractor.plannedBase += 1;
      if (outcome === 'EXECUTED') ppcContractor.executedPlanned += 1;

      // Base de performance do empreiteiro:
      // reserva só entra como planejada se executada.
      perfContractor.plannedBase += 1;
      if (outcome !== 'EXECUTED') {
        const parsedCause = parseCauseDescription(feedback?.cause?.description || '');
        if (parsedCause.contractorSpecific) {
          perfContractor.contractorSpecificNonCompliance += 1;
        }
      }

      plannedTasksCount += 1;
      if (task.rolledFromTaskId) replannedTasksCount += 1;

      row.planned += 1;
      row.totalActivities += 1;
      zone.planned += 1;
      zone.totalActivities += 1;

      globalContractor.planned += 1;
      globalContractor.totalActivities += 1;
      weekContractor.planned += 1;
      globalLaborType.planned += 1;

      if (outcome === 'EXECUTED') {
        row.executed += 1;
        zone.executedPlanned += 1;
        globalContractor.executed += 1;
        weekContractor.executed += 1;
        globalLaborType.executed += 1;

        if (Number(task.originWeekId) !== Number(task.currentWeekId)) {
          const originWeek = weekById.get(Number(task.originWeekId));
          const currentWeek = weekById.get(Number(task.currentWeekId));
          if (originWeek && currentWeek) {
            pendingLeadWeeks.push(Math.max(0, Number(currentWeek.weekNumber) - Number(originWeek.weekNumber)));
          }
        }
      } else if (outcome === 'STARTED') {
        row.started += 1;
        if (feedback?.cause) row.causeCount += 1;
        globalContractor.started += 1;
        weekContractor.started += 1;
        globalLaborType.started += 1;
        registerCauseImpact(feedback?.cause || null, 1);
      } else if (outcome === 'CANCELLED') {
        row.cancelled += 1;
        globalContractor.cancelled += 1;
        weekContractor.cancelled += 1;
        globalLaborType.cancelled += 1;
      } else {
        row.notStarted += 1;
        if (feedback?.cause) row.causeCount += 1;
        globalContractor.notStarted += 1;
        weekContractor.notStarted += 1;
        globalLaborType.notStarted += 1;
        registerCauseImpact(feedback?.cause || null, 1);
      }
    });

    row.executedPlannedPct = row.planned ? Number(((row.executed / row.planned) * 100).toFixed(2)) : 0;
    row.ppc = row.executedPlannedPct;
    row.nonExecuted = row.started + row.notStarted;
    row.planningQualityPct = row.planned
      ? Number((Math.max(0, 1 - ((row.cancelled + row.unplannedExecuted) / row.planned)) * 100).toFixed(2))
      : 0;
    row.totalExecutedPct = row.totalActivities
      ? Number((((row.executed + row.unplannedExecuted) / row.totalActivities) * 100).toFixed(2))
      : 0;

    const month = assignMonthForWeekByWorkdays(week);
    row.monthKey = month.monthKey;
    row.monthLabel = month.monthLabel;
    weeklyRows.push(row);

    if (!monthGlobal.has(row.monthKey)) {
      monthGlobal.set(row.monthKey, {
        monthKey: row.monthKey,
        monthLabel: row.monthLabel,
        weeks: 0,
        executedPlannedPctSum: 0,
        planningQualityPctSum: 0,
        ppcSum: 0,
        planned: 0,
        executed: 0,
        started: 0,
        notStarted: 0,
        nonExecuted: 0,
        cancelled: 0,
        unplannedExecuted: 0,
      });
    }
    const monthRow = monthGlobal.get(row.monthKey);
    monthRow.weeks += 1;
    monthRow.executedPlannedPctSum += row.executedPlannedPct;
    monthRow.planningQualityPctSum += row.planningQualityPct;
    monthRow.ppcSum += row.ppc;
    monthRow.planned += row.planned;
    monthRow.executed += row.executed;
    monthRow.started += row.started;
    monthRow.notStarted += row.notStarted;
    monthRow.nonExecuted += row.nonExecuted;
    monthRow.cancelled += row.cancelled;
    monthRow.unplannedExecuted += row.unplannedExecuted;

    if (!monthContractor.has(row.monthKey)) monthContractor.set(row.monthKey, new Map());
    const monthContractorMap = monthContractor.get(row.monthKey);
    contractorWeek.forEach((item, contractorName) => {
      const planned = Number(item.planned || 0);
      const executed = Number(item.executed || 0);
      const started = Number(item.started || 0);
      const notStarted = Number(item.notStarted || 0);
      const cancelled = Number(item.cancelled || 0);
      const unplannedExecuted = Number(item.unplannedExecuted || 0);
      const executedPct = planned ? Number(((executed / planned) * 100).toFixed(2)) : 0;
      contractorWeeklyTrendRows.push({
        monthKey: row.monthKey,
        monthLabel: row.monthLabel,
        weekNumber: row.weekNumber,
        contractor: contractorName,
        planned,
        executed,
        executedPct,
      });

      if (!monthContractorMap.has(contractorName)) {
        monthContractorMap.set(contractorName, {
          monthKey: row.monthKey,
          monthLabel: row.monthLabel,
          contractor: contractorName,
          weeks: 0,
          executedPctSum: 0,
          planned: 0,
          executed: 0,
          started: 0,
          notStarted: 0,
          cancelled: 0,
          unplannedExecuted: 0,
        });
      }
      const itemMonth = monthContractorMap.get(contractorName);
      itemMonth.weeks += 1;
      itemMonth.executedPctSum += executedPct;
      itemMonth.planned += planned;
      itemMonth.executed += executed;
      itemMonth.started += started;
      itemMonth.notStarted += notStarted;
      itemMonth.cancelled += cancelled;
      itemMonth.unplannedExecuted += unplannedExecuted;

    });

    contractorWeek.forEach((item, contractorName) => {
      const plannedBase = Number(item.planned || 0);
      if (plannedBase <= 0) return;
      const executedPlanned = Number(item.executed || 0);
      const executionPct = Number(((executedPlanned / plannedBase) * 100).toFixed(2));
      const reliability = ensureContractorReliability(String(contractorName || 'SEM EMPREITEIRO'));
      reliability.weeksActive += 1;
      reliability.executionPctSum += executionPct;
      if (executionPct >= contractorReliabilityTargetPct) reliability.weeksAboveTarget += 1;
    });

    if (!monthContractorPerformance.has(row.monthKey)) monthContractorPerformance.set(row.monthKey, new Map());
    const monthPerfMap = monthContractorPerformance.get(row.monthKey);
    contractorWeekPerformance.forEach((item, contractorName) => {
      const plannedBase = Number(item.plannedBase || 0);
      if (plannedBase <= 0) return;
      const contractorSpecificNonCompliance = Number(item.contractorSpecificNonCompliance || 0);
      const nonCompliancePct = plannedBase
        ? Number(((contractorSpecificNonCompliance / plannedBase) * 100).toFixed(2))
        : 0;
      const performancePct = Math.max(0, Number((100 - nonCompliancePct).toFixed(2)));
      contractorWeeklyPerformanceRows.push({
        monthKey: row.monthKey,
        monthLabel: row.monthLabel,
        weekNumber: row.weekNumber,
        contractor: contractorName,
        plannedBase,
        contractorSpecificNonCompliance,
        nonCompliancePct,
        performancePct,
      });

      if (!monthPerfMap.has(contractorName)) {
        monthPerfMap.set(contractorName, {
          monthKey: row.monthKey,
          monthLabel: row.monthLabel,
          contractor: contractorName,
          plannedBase: 0,
          contractorSpecificNonCompliance: 0,
          weeks: 0,
        });
      }
      const rowMonthPerf = monthPerfMap.get(contractorName);
      rowMonthPerf.plannedBase += plannedBase;
      rowMonthPerf.contractorSpecificNonCompliance += contractorSpecificNonCompliance;
      rowMonthPerf.weeks += 1;
    });

    contractorWeek.forEach((item, contractorName) => {
      const plannedBase = Number(item.planned || 0);
      if (plannedBase <= 0) return;
      const executedPlanned = Number(item.executed || 0);
      const executionPct = Number(((executedPlanned / plannedBase) * 100).toFixed(2));
      contractorPpcWeeklyRows.push({
        weekId: Number(week.id),
        weekNumber: Number(week.weekNumber),
        contractorId: null,
        contractor: contractorName,
        plannedBase,
        executedPlanned,
        executionPct,
      });
    });
  });

  const planningQualityWeeklyRows = [];
  let planningQualityTotalChanges = 0;
  let planningQualityTotalProgrammed = 0;

  historyWeeks.forEach((week) => {
    const weekId = Number(week.id);
    const preWeekTasks = preTasksByWeek.get(weekId) || [];
    const planningWeekTasks = (tasksByWeek.get(weekId) || []).filter((task) => task?.isUnplanned !== true);

    const preBySeq = new Map((preWeekTasks || []).map((item) => [Number(item.sequenceNumber), item]));
    const planningBySeq = new Map((planningWeekTasks || []).map((item) => [Number(item.sequenceNumber), item]));
    const seqSet = new Set([...preBySeq.keys(), ...planningBySeq.keys()]);

    let added = 0;
    let removed = 0;
    let changed = 0;
    [...seqSet].sort((a, b) => a - b).forEach((seq) => {
      const preTask = preBySeq.get(seq) || null;
      const planningTask = planningBySeq.get(seq) || null;
      if (preTask && !planningTask) {
        removed += 1;
        return;
      }
      if (!preTask && planningTask) {
        added += 1;
        return;
      }
      if (!preTask || !planningTask) return;
      if (taskComparableSignature(preTask) !== taskComparableSignature(planningTask)) {
        changed += 1;
      }
    });

    const totalChanges = Number(added + removed + changed);
    const totalProgrammed = Number(planningWeekTasks.length || 0);
    const qualityPct = totalProgrammed > 0
      ? Math.max(0, Number((100 - ((totalChanges / totalProgrammed) * 100)).toFixed(2)))
      : 0;

    planningQualityWeeklyRows.push({
      weekId,
      weekNumber: Number(week.weekNumber || 0),
      totalChanges,
      totalProgrammed,
      qualityPct,
      added,
      removed,
      changed,
    });
    planningQualityTotalChanges += totalChanges;
    planningQualityTotalProgrammed += totalProgrammed;
  });

  const planningQualityHistoricalPct = planningQualityTotalProgrammed > 0
    ? Math.max(0, Number((100 - ((planningQualityTotalChanges / planningQualityTotalProgrammed) * 100)).toFixed(2)))
    : 0;

  const historyPlanned = Number(metrics?.totals?.executed || 0)
    + Number(metrics?.totals?.started || 0)
    + Number(metrics?.totals?.notStarted || 0)
    + Number(metrics?.totals?.cancelled || 0);
  const historyExecutedPlanned = Number(metrics?.totals?.executed || 0);
  const historyExecutionPct = historyPlanned
    ? Number(((historyExecutedPlanned / historyPlanned) * 100).toFixed(2))
    : 0;
  const ppcHistoryConsidered = Number(metrics?.totals?.executed || 0)
    + Number(metrics?.totals?.started || 0)
    + Number(metrics?.totals?.notStarted || 0)
    + Number(metrics?.totals?.cancelled || 0);
  const ppcHistoryAccumulatedPct = ppcHistoryConsidered > 0
    ? Number(((Number(metrics?.totals?.executed || 0) / ppcHistoryConsidered) * 100).toFixed(2))
    : 0;
  const planningTasksByWeek = new Map();
  const unplannedExecutedByWeek = new Map();
  const cancelledByWeek = new Map();
  tasks.forEach((task) => {
    const weekId = Number(task?.currentWeekId || 0);
    const outcome = taskOutcome(task, feedbackByTaskId);
    if (task?.isUnplanned === true) {
      if (outcome === 'EXECUTED') {
        unplannedExecutedByWeek.set(weekId, Number(unplannedExecutedByWeek.get(weekId) || 0) + 1);
      }
      return;
    }
    const isReserve = String(task?.status || '').toUpperCase() === TASK_STATUS.RESERVA;
    const feedback = feedbackByTaskId.get(Number(task?.id)) || null;
    const feedbackStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;
    const isExecutedOutcome = (
      String(task?.status || '').toUpperCase() === TASK_STATUS.EXECUTED
      || feedbackStatus === 'EXECUTED'
      || feedbackStatus === 'EXECUTED_UNPLANNED'
    );
    if (!(isReserve && !isExecutedOutcome)) {
      planningTasksByWeek.set(weekId, Number(planningTasksByWeek.get(weekId) || 0) + 1);
    }
    if (outcome === 'CANCELLED') {
      cancelledByWeek.set(weekId, Number(cancelledByWeek.get(weekId) || 0) + 1);
    }
  });
  const planningFinalizationWeeklyRows = historyWeeks.map((week) => {
    const weekId = Number(week.id);
    const totalActivities = Number(planningTasksByWeek.get(weekId) || 0);
    const cancelled = Number(cancelledByWeek.get(weekId) || 0);
    const unplannedExecuted = Number(unplannedExecutedByWeek.get(weekId) || 0);
    const totalChanges = Number(cancelled + unplannedExecuted);
    const qualityPct = totalActivities > 0
      ? Math.max(0, Number((100 - ((totalChanges / totalActivities) * 100)).toFixed(2)))
      : 0;
    return {
      weekId,
      weekNumber: Number(week.weekNumber || 0),
      totalActivities,
      cancelled,
      unplannedExecuted,
      totalChanges,
      qualityPct,
    };
  });
  const planningFinalizationTotalChanges = planningFinalizationWeeklyRows
    .reduce((sum, row) => sum + Number(row.totalChanges || 0), 0);
  const planningFinalizationTotalActivities = planningFinalizationWeeklyRows
    .reduce((sum, row) => sum + Number(row.totalActivities || 0), 0);
  const planningFinalizationQualityPct = planningFinalizationTotalActivities > 0
    ? Math.max(0, Number((100 - ((planningFinalizationTotalChanges / planningFinalizationTotalActivities) * 100)).toFixed(2)))
    : 0;
  const plannedDistributionTotals = tasks.reduce((acc, task) => {
    if (!task || task.isUnplanned === true) return acc;
    const isPending = Number(task.originWeekId || 0) !== Number(task.currentWeekId || 0);
    if (isPending) {
      acc.pending += 1;
      return acc;
    }
    const statusCode = String(task.status || '').toUpperCase();
    if (statusCode === TASK_STATUS.RETRABALHO) {
      acc.rework += 1;
      return acc;
    }
    if (statusCode === TASK_STATUS.RESERVA) {
      acc.reserve += 1;
      return acc;
    }
    acc.planned += 1;
    return acc;
  }, {
    planned: 0,
    rework: 0,
    reserve: 0,
    pending: 0,
  });
  const plannedDistributionBase = Number(plannedDistributionTotals.planned || 0)
    + Number(plannedDistributionTotals.rework || 0)
    + Number(plannedDistributionTotals.reserve || 0)
    + Number(plannedDistributionTotals.pending || 0);

  const contractorRows = [...contractorGlobal.values()].map((item) => {
    const considered = Number(item.executed) + Number(item.started) + Number(item.notStarted);
    const ppc = considered ? Number(((Number(item.executed) / considered) * 100).toFixed(2)) : 0;
    const executionPct = Number(item.planned)
      ? Number(((Number(item.executed) / Number(item.planned)) * 100).toFixed(2))
      : 0;
    const unplannedSharePct = (Number(item.executed) + Number(item.unplannedExecuted))
      ? Number(((Number(item.unplannedExecuted) / (Number(item.executed) + Number(item.unplannedExecuted))) * 100).toFixed(2))
      : 0;
    return {
      ...item,
      considered,
      ppc,
      executionPct,
      unplannedSharePct,
    };
  }).sort((a, b) => (
    Number(b.executionPct) - Number(a.executionPct)
    || String(a.contractor).localeCompare(String(b.contractor), 'pt-BR')
  ));

  const zoneRows = [...zoneGlobal.values()]
    .map((item) => ({
      ...item,
      executionPct: Number(item.planned) ? Number(((Number(item.executedPlanned) / Number(item.planned)) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => (
      Number(b.totalActivities) - Number(a.totalActivities)
      || Number(b.planned) - Number(a.planned)
      || String(a.zone1).localeCompare(String(b.zone1), 'pt-BR')
    ));

  const monthlyGlobalRows = [...monthGlobal.values()]
    .map((item) => ({
      ...item,
      avgExecutedPlannedPct: item.weeks ? Number((item.executedPlannedPctSum / item.weeks).toFixed(2)) : 0,
      avgPlanningQualityPct: item.weeks ? Number((item.planningQualityPctSum / item.weeks).toFixed(2)) : 0,
      avgPpc: item.weeks ? Number((item.ppcSum / item.weeks).toFixed(2)) : 0,
    }))
    .sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)));

  const monthlyContractorRows = [];
  [...monthContractor.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .forEach(([, contractorMap]) => {
      [...contractorMap.values()]
        .sort((a, b) => (
          Number(b.executedPctSum / Math.max(1, b.weeks)) - Number(a.executedPctSum / Math.max(1, a.weeks))
          || String(a.contractor).localeCompare(String(b.contractor), 'pt-BR')
        ))
        .forEach((row) => {
          monthlyContractorRows.push({
            ...row,
            avgExecutedPct: row.weeks ? Number((row.executedPctSum / row.weeks).toFixed(2)) : 0,
          });
        });
    });

  const contractorMonthlyPerformanceRows = [];
  [...monthContractorPerformance.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .forEach(([, contractorMap]) => {
      [...contractorMap.values()]
        .sort((a, b) => String(a.contractor).localeCompare(String(b.contractor), 'pt-BR'))
        .forEach((row) => {
          const nonCompliancePct = Number(row.plannedBase || 0)
            ? Number(((Number(row.contractorSpecificNonCompliance || 0) / Number(row.plannedBase || 0)) * 100).toFixed(2))
            : 0;
          contractorMonthlyPerformanceRows.push({
            ...row,
            nonCompliancePct,
            performancePct: Math.max(0, Number((100 - nonCompliancePct).toFixed(2))),
          });
        });
    });

  const contractorPerformanceRankingRows = [];
  const rankingMap = new Map();
  contractorWeeklyPerformanceRows.forEach((row) => {
    const contractor = String(row.contractor || 'SEM_EMPREITEIRO');
    if (!rankingMap.has(contractor)) {
      rankingMap.set(contractor, {
        contractor,
        weeksActive: 0,
        plannedBase: 0,
        contractorSpecificNonCompliance: 0,
      });
    }
    const item = rankingMap.get(contractor);
    item.weeksActive += 1;
    item.plannedBase += Number(row.plannedBase || 0);
    item.contractorSpecificNonCompliance += Number(row.contractorSpecificNonCompliance || 0);
  });
  contractorPerformanceRankingRows.push(
    ...[...rankingMap.values()]
      .map((row) => {
        const nonCompliancePct = Number(row.plannedBase || 0)
          ? Number(((Number(row.contractorSpecificNonCompliance || 0) / Number(row.plannedBase || 0)) * 100).toFixed(2))
          : 0;
        const performancePct = Math.max(0, Number((100 - nonCompliancePct).toFixed(2)));
        return {
          ...row,
          nonCompliancePct,
          performancePct,
        };
      })
      .sort((a, b) => (
        Number(b.performancePct) - Number(a.performancePct)
        || Number(b.weeksActive) - Number(a.weeksActive)
        || String(a.contractor).localeCompare(String(b.contractor), 'pt-BR')
      )),
  );

  const laborTypePerformanceMap = new Map();
  const ensureLaborTypePerformance = (name) => {
    if (!laborTypePerformanceMap.has(name)) {
      laborTypePerformanceMap.set(name, {
        laborType: name,
        planned: 0,
        executedPlanned: 0,
        cancelled: 0,
        unplannedExecuted: 0,
      });
    }
    return laborTypePerformanceMap.get(name);
  };

  tasks.forEach((task) => {
    const laborTypeName = String(task?.contractor?.function?.name || 'SEM MÃO DE OBRA');
    const row = ensureLaborTypePerformance(laborTypeName);
    const outcome = taskOutcome(task, feedbackByTaskId);
    const feedback = feedbackByTaskId.get(Number(task?.id)) || null;
    const feedbackStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;
    const isReserve = String(task?.status || '').toUpperCase() === TASK_STATUS.RESERVA;
    const isExecutedOutcome = (
      String(task?.status || '').toUpperCase() === TASK_STATUS.EXECUTED
      || feedbackStatus === 'EXECUTED'
      || feedbackStatus === 'EXECUTED_UNPLANNED'
    );

    if (task?.isUnplanned === true) {
      if (outcome === 'EXECUTED') row.unplannedExecuted += 1;
      return;
    }

    // Reserva: so entra no planejamento se foi executada.
    if (isReserve && !isExecutedOutcome) return;

    row.planned += 1;
    if (outcome === 'EXECUTED') row.executedPlanned += 1;
    else if (outcome === 'CANCELLED') row.cancelled += 1;
  });

  const laborTypeRows = [...laborTypePerformanceMap.values()]
    .map((item) => ({
      ...item,
      executionPct: Number(item.planned)
        ? Number(((Number(item.executedPlanned) / Number(item.planned)) * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => (
      Number(b.executionPct) - Number(a.executionPct)
      || Number(b.executedPlanned) - Number(a.executedPlanned)
      || String(a.laborType).localeCompare(String(b.laborType), 'pt-BR')
    ));

  const contractorReliabilityRows = [...contractorReliability.values()]
    .map((item) => ({
      ...item,
      reliabilityPct: item.weeksActive
        ? Number(((Number(item.weeksAboveTarget) / Number(item.weeksActive)) * 100).toFixed(2))
        : 0,
      avgExecutionPct: item.weeksActive
        ? Number((Number(item.executionPctSum) / Number(item.weeksActive)).toFixed(2))
        : 0,
      targetPct: contractorReliabilityTargetPct,
    }))
    .sort((a, b) => (
      Number(b.reliabilityPct) - Number(a.reliabilityPct)
      || Number(b.avgExecutionPct) - Number(a.avgExecutionPct)
      || String(a.contractor).localeCompare(String(b.contractor), 'pt-BR')
    ));

  const categoryOrder = [];
  const categoryOrderSet = new Set();
  const catalogRowsByCategory = new Map();
  causesCatalog.forEach((causeRow) => {
    const parsed = parseCauseDescription(causeRow.description);
    const category = String(parsed.category || '').trim() || 'Sem grupo';
    if (!categoryOrderSet.has(category)) {
      categoryOrderSet.add(category);
      categoryOrder.push(category);
    }
    if (parsed.level === 1) return;
    if (!catalogRowsByCategory.has(category)) catalogRowsByCategory.set(category, []);
    catalogRowsByCategory.get(category).push({
      id: causeRow.id,
      category,
      cause: String(parsed.cause || parsed.label || '').trim() || '(Sem causa)',
    });
  });

  const categoryCounts = new Map();
  categoryOrder.forEach((category) => {
    categoryCounts.set(category, Number(causeImpactByCategory.get(category) || 0));
  });
  [...causeImpactByCategory.keys()].forEach((category) => {
    if (!categoryOrderSet.has(category)) {
      categoryOrder.push(category);
      categoryOrderSet.add(category);
      categoryCounts.set(category, Number(causeImpactByCategory.get(category) || 0));
    }
  });

  const causeImpactTotal = [...categoryCounts.values()].reduce((acc, value) => acc + Number(value || 0), 0);
  const causeImpactRows = [];
  categoryOrder.forEach((category) => {
    const categoryCount = Number(categoryCounts.get(category) || 0);
    causeImpactRows.push({
      type: 'CATEGORY',
      category,
      cause: '',
      count: categoryCount,
      pct: causeImpactTotal ? Number(((categoryCount / causeImpactTotal) * 100).toFixed(2)) : 0,
      categoryCount,
      categoryPct: causeImpactTotal ? Number(((categoryCount / causeImpactTotal) * 100).toFixed(2)) : 0,
    });
    const causesInCategory = catalogRowsByCategory.get(category) || [];
    if (!causesInCategory.length) {
      causeImpactRows.push({
        type: 'CAUSE',
        category,
        cause: '(Sem causas cadastradas)',
        count: 0,
        pct: 0,
        categoryCount,
        categoryPct: causeImpactTotal ? Number(((categoryCount / causeImpactTotal) * 100).toFixed(2)) : 0,
      });
    } else {
      causesInCategory.forEach((causeItem) => {
        const key = `${category}${CAUSE_SPLITTER}${causeItem.cause}`;
        const count = Number(causeImpactByCause.get(key) || 0);
        causeImpactRows.push({
          type: 'CAUSE',
          category,
          cause: causeItem.cause,
          count,
          pct: causeImpactTotal ? Number(((count / causeImpactTotal) * 100).toFixed(2)) : 0,
          categoryCount,
          categoryPct: causeImpactTotal ? Number(((categoryCount / causeImpactTotal) * 100).toFixed(2)) : 0,
        });
      });
    }
  });

  const pendingLeadSorted = pendingLeadWeeks.slice().sort((a, b) => Number(a) - Number(b));
  const pendingLeadMedian = pendingLeadSorted.length
    ? (pendingLeadSorted.length % 2 === 1
      ? pendingLeadSorted[(pendingLeadSorted.length - 1) / 2]
      : ((pendingLeadSorted[(pendingLeadSorted.length / 2) - 1] + pendingLeadSorted[pendingLeadSorted.length / 2]) / 2))
    : 0;
  const pendingLeadAvg = pendingLeadWeeks.length
    ? Number((pendingLeadWeeks.reduce((acc, value) => acc + Number(value || 0), 0) / pendingLeadWeeks.length).toFixed(2))
    : 0;

  const reworkRatePct = plannedTasksCount
    ? Number(((Number(replannedTasksCount) / Number(plannedTasksCount)) * 100).toFixed(2))
    : 0;

  const prePlanningDeadlineWeekday = rule?.prePlanningDeadlineWeekday || 'WEDNESDAY';
  const prePlanningDeadlineTime = rule?.prePlanningDeadlineTime || '17:00';
  const ppcMeetingDeadlineWeekday = rule?.ppcMeetingDeadlineWeekday || 'THURSDAY';
  const ppcMeetingDeadlineTime = rule?.ppcMeetingDeadlineTime || '17:00';
  const planningDeadlineWeekday = rule?.planningDeadlineWeekday || 'FRIDAY';
  const planningDeadlineTime = rule?.planningDeadlineTime || '15:00';
  const feedbackDeadlineWeekday = rule?.feedbackDeadlineWeekday || 'FRIDAY';
  const feedbackDeadlineTime = rule?.feedbackDeadlineTime || '17:00';
  const qualityDeadlineWeekday = rule?.qualityDeadlineWeekday || 'SATURDAY';
  const qualityDeadlineTime = rule?.qualityDeadlineTime || '17:00';
  const ppcMeetingClosedAtByWeekId = new Map(
    (ppcMeetings || []).map((item) => [Number(item.weekId), item?.closedAt || null]),
  );
  const reopenApprovedByWeekId = new Map();
  reopenApprovals.forEach((item) => {
    const key = Number(item.weekId);
    reopenApprovedByWeekId.set(key, (reopenApprovedByWeekId.get(key) || 0) + 1);
  });
  const monthlyGovernanceMap = new Map();

  const governance = {
    totalWeeks: historyWeeks.length,
    prePlanningClosedWeeks: 0,
    prePlanningOnTimeWeeks: 0,
    prePlanningLateWeeks: 0,
    ppcMeetingClosedWeeks: 0,
    ppcMeetingOnTimeWeeks: 0,
    ppcMeetingLateWeeks: 0,
    planningClosedWeeks: 0,
    planningOnTimeWeeks: 0,
    planningLateWeeks: 0,
    feedbackClosedWeeks: 0,
    feedbackOnTimeWeeks: 0,
    feedbackLateWeeks: 0,
    qualityClosedWeeks: 0,
    qualityOnTimeWeeks: 0,
    qualityLateWeeks: 0,
    reopenedWeeks: historyWeeks.filter((item) => !!item.reopenedAt).length,
    approvedReopenRequests: reopenApprovals.length,
  };

  historyWeeks.forEach((week) => {
    const workTimeZone = inferBrazilTimeZoneFromWork(week.work || work);
    const prePlanningDeadline = computeWeekDeadlineDate(
      week,
      prePlanningDeadlineWeekday,
      prePlanningDeadlineTime,
      'WEDNESDAY',
      '17:00',
      { scope: 'PREVIOUS_WEEK', timeZone: workTimeZone },
    );
    const ppcMeetingDeadline = computeWeekDeadlineDate(
      week,
      ppcMeetingDeadlineWeekday,
      ppcMeetingDeadlineTime,
      'THURSDAY',
      '17:00',
      { scope: 'PREVIOUS_WEEK', timeZone: workTimeZone },
    );
    const planningDeadline = computeWeekDeadlineDate(
      week,
      planningDeadlineWeekday,
      planningDeadlineTime,
      'FRIDAY',
      '15:00',
      { scope: 'PREVIOUS_WEEK', timeZone: workTimeZone },
    );
    const feedbackDeadline = computeWeekDeadlineDate(
      week,
      feedbackDeadlineWeekday,
      feedbackDeadlineTime,
      'FRIDAY',
      '17:00',
      { scope: 'CURRENT_WEEK', timeZone: workTimeZone },
    );
    const qualityDeadline = computeWeekDeadlineDate(
      week,
      qualityDeadlineWeekday,
      qualityDeadlineTime,
      'SATURDAY',
      '17:00',
      { scope: 'CURRENT_WEEK', timeZone: workTimeZone },
    );
    const month = assignMonthForWeekByWorkdays(week);
    if (!monthlyGovernanceMap.has(month.monthKey)) {
      monthlyGovernanceMap.set(month.monthKey, {
        monthKey: month.monthKey,
        monthLabel: month.monthLabel,
        weeks: 0,
        planningOnTime: 0,
        feedbackOnTime: 0,
        reopenApproved: 0,
        planningLate: 0,
        feedbackLate: 0,
        reopenedWeeks: 0,
      });
    }
    const monthlyGov = monthlyGovernanceMap.get(month.monthKey);
    monthlyGov.weeks += 1;
    if (reopenApprovedByWeekId.get(Number(week.id)) > 0) monthlyGov.reopenApproved += 1;
    if (week.reopenedAt) monthlyGov.reopenedWeeks += 1;

    const prePlanningClosedAt = week.prePlanningClosedAt || null;
    const ppcMeetingClosedAt = ppcMeetingClosedAtByWeekId.get(Number(week.id)) || null;
    const planningClosedAt = week.planningClosedAt || null;
    const feedbackClosedAt = week.feedbackClosedAt || null;
    const qualityClosedAt = week.qualityClosedAt || null;

    if (prePlanningClosedAt) {
      governance.prePlanningClosedWeeks += 1;
      if (prePlanningDeadline && new Date(prePlanningClosedAt).getTime() <= prePlanningDeadline.getTime()) {
        governance.prePlanningOnTimeWeeks += 1;
      } else {
        governance.prePlanningLateWeeks += 1;
      }
    }

    if (ppcMeetingClosedAt) {
      governance.ppcMeetingClosedWeeks += 1;
      if (ppcMeetingDeadline && new Date(ppcMeetingClosedAt).getTime() <= ppcMeetingDeadline.getTime()) {
        governance.ppcMeetingOnTimeWeeks += 1;
      } else {
        governance.ppcMeetingLateWeeks += 1;
      }
    }

    if (planningClosedAt) {
      governance.planningClosedWeeks += 1;
      if (planningDeadline && new Date(planningClosedAt).getTime() <= planningDeadline.getTime()) {
        governance.planningOnTimeWeeks += 1;
        monthlyGov.planningOnTime += 1;
      } else {
        governance.planningLateWeeks += 1;
        monthlyGov.planningLate += 1;
      }
    }

    if (feedbackClosedAt) {
      governance.feedbackClosedWeeks += 1;
      if (feedbackDeadline && new Date(feedbackClosedAt).getTime() <= feedbackDeadline.getTime()) {
        governance.feedbackOnTimeWeeks += 1;
        monthlyGov.feedbackOnTime += 1;
      } else {
        governance.feedbackLateWeeks += 1;
        monthlyGov.feedbackLate += 1;
      }
    }

    if (qualityClosedAt) {
      governance.qualityClosedWeeks += 1;
      if (qualityDeadline && new Date(qualityClosedAt).getTime() <= qualityDeadline.getTime()) {
        governance.qualityOnTimeWeeks += 1;
      } else {
        governance.qualityLateWeeks += 1;
      }
    }
  });

  governance.planningOnTimePctTotal = governance.totalWeeks
    ? Number(((governance.planningOnTimeWeeks / governance.totalWeeks) * 100).toFixed(2))
    : 0;
  governance.feedbackOnTimePctTotal = governance.totalWeeks
    ? Number(((governance.feedbackOnTimeWeeks / governance.totalWeeks) * 100).toFixed(2))
    : 0;
  governance.planningOnTimePctClosed = governance.planningClosedWeeks
    ? Number(((governance.planningOnTimeWeeks / governance.planningClosedWeeks) * 100).toFixed(2))
    : 0;
  governance.feedbackOnTimePctClosed = governance.feedbackClosedWeeks
    ? Number(((governance.feedbackOnTimeWeeks / governance.feedbackClosedWeeks) * 100).toFixed(2))
    : 0;
  governance.prePlanningLatePctClosed = governance.prePlanningClosedWeeks
    ? Number(((governance.prePlanningLateWeeks / governance.prePlanningClosedWeeks) * 100).toFixed(2))
    : 0;
  governance.ppcMeetingLatePctClosed = governance.ppcMeetingClosedWeeks
    ? Number(((governance.ppcMeetingLateWeeks / governance.ppcMeetingClosedWeeks) * 100).toFixed(2))
    : 0;
  governance.planningLatePctClosed = governance.planningClosedWeeks
    ? Number(((governance.planningLateWeeks / governance.planningClosedWeeks) * 100).toFixed(2))
    : 0;
  governance.feedbackLatePctClosed = governance.feedbackClosedWeeks
    ? Number(((governance.feedbackLateWeeks / governance.feedbackClosedWeeks) * 100).toFixed(2))
    : 0;
  governance.qualityLatePctClosed = governance.qualityClosedWeeks
    ? Number(((governance.qualityLateWeeks / governance.qualityClosedWeeks) * 100).toFixed(2))
    : 0;

  const monthlyGovernanceRows = [...monthlyGovernanceMap.values()]
    .map((item) => ({
      ...item,
      planningOnTimePct: item.weeks ? Number(((item.planningOnTime / item.weeks) * 100).toFixed(2)) : 0,
      feedbackOnTimePct: item.weeks ? Number(((item.feedbackOnTime / item.weeks) * 100).toFixed(2)) : 0,
      reopenApprovedPct: item.weeks ? Number(((item.reopenApproved / item.weeks) * 100).toFixed(2)) : 0,
      planningLatePct: item.weeks ? Number(((item.planningLate / item.weeks) * 100).toFixed(2)) : 0,
      feedbackLatePct: item.weeks ? Number(((item.feedbackLate / item.weeks) * 100).toFixed(2)) : 0,
      reopenedWeeksPct: item.weeks ? Number(((item.reopenedWeeks / item.weeks) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)));

  const accessRowsByUserWeek = new Map();
  const accessRowsByUser = new Map();
  const accessRowsByWeek = new Map();
  historyWeeks.forEach((week) => accessRowsByWeek.set(Number(week.id), 0));

  const findWeekForEvent = (dateInput) => {
    const ts = new Date(dateInput).getTime();
    if (!Number.isFinite(ts)) return null;
    for (let i = 0; i < historyWeeks.length; i += 1) {
      const week = historyWeeks[i];
      const start = new Date(week.startDate).getTime();
      const end = new Date(week.endDate).getTime();
      if (ts >= start && ts <= end) return week;
    }
    return null;
  };

  loginEvents.forEach((event) => {
    const week = findWeekForEvent(event.createdAt);
    if (!week) return;
    const userKey = String(event.userId || event.user?.email || `anon-${event.id}`);
    const rowKey = `${week.id}::${userKey}`;
    if (!accessRowsByUserWeek.has(rowKey)) {
      accessRowsByUserWeek.set(rowKey, {
        weekNumber: Number(week.weekNumber),
        userName: event.user?.name || event.user?.email || 'Usuário não identificado',
        email: event.user?.email || '',
        count: 0,
      });
    }
    const row = accessRowsByUserWeek.get(rowKey);
    row.count += 1;

    if (!accessRowsByUser.has(userKey)) {
      accessRowsByUser.set(userKey, {
        userName: row.userName,
        email: row.email,
        count: 0,
      });
    }
    accessRowsByUser.get(userKey).count += 1;
    accessRowsByWeek.set(Number(week.id), Number(accessRowsByWeek.get(Number(week.id)) || 0) + 1);
  });

  const accessRows = [...accessRowsByUserWeek.values()]
    .sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber) || Number(b.count) - Number(a.count));
  const accessByUser = [...accessRowsByUser.values()]
    .sort((a, b) => Number(b.count) - Number(a.count) || String(a.userName).localeCompare(String(b.userName), 'pt-BR'));
  const accessByWeek = historyWeeks.map((week) => ({
    weekNumber: Number(week.weekNumber),
    count: Number(accessRowsByWeek.get(Number(week.id)) || 0),
  }));

  const qualityThresholds = {
    deadlineRegular: Number(qualityConfig?.deadlineRegularPct ?? 60),
    deadlineGood: Number(qualityConfig?.deadlineGoodPct ?? 80),
    qualityRegular: Number(qualityConfig?.qualityRegularScore ?? 5),
    qualityGood: Number(qualityConfig?.qualityGoodScore ?? 8),
    collaborationRegular: Number(qualityConfig?.collaborationRegularScore ?? 5),
    collaborationGood: Number(qualityConfig?.collaborationGoodScore ?? 8),
    safetyRegular: Number(qualityConfig?.safetyRegularScore ?? 5),
    safetyGood: Number(qualityConfig?.safetyGoodScore ?? 8),
    cleaningRegular: Number(qualityConfig?.cleaningRegularScore ?? 5),
    cleaningGood: Number(qualityConfig?.cleaningGoodScore ?? 8),
  };
  const normalizeQualityScore = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < 0 || parsed > 10) return null;
    return Math.round(parsed);
  };
  const classifyBand = (value, regular, good) => {
    if (value === null || value === undefined || value === '') return '-';
    const score = Number(value);
    if (!Number.isFinite(score)) return '-';
    if (score >= Number(good)) return 'Bom';
    if (score >= Number(regular)) return 'Regular';
    return 'Ruim';
  };
  const qualityItemByContractorWeek = new Map();
  (qualityItems || []).forEach((item) => {
    qualityItemByContractorWeek.set(`${Number(item.weekId)}::${Number(item.contractorId)}`, item);
  });
  const contractorsQualityMap = new Map();
  (contractorPpcWeeklyRows || []).forEach((row) => {
    const cid = Number(row.contractorId || 0);
    if (!cid) return;
    if (!contractorsQualityMap.has(cid)) {
      contractorsQualityMap.set(cid, { contractorId: cid, contractorName: String(row.contractor || '-') });
    }
  });
  (qualityItems || []).forEach((item) => {
    const cid = Number(item.contractorId || 0);
    if (!cid) return;
    if (!contractorsQualityMap.has(cid)) {
      contractorsQualityMap.set(cid, { contractorId: cid, contractorName: String(item.contractor?.name || '-') });
    }
  });

  const qualityHistoryRows = [];
  [...contractorsQualityMap.values()]
    .sort((a, b) => String(a.contractorName).localeCompare(String(b.contractorName), 'pt-BR'))
    .forEach((contractor) => {
      const weekly = historyWeeks
        .map((week) => {
          const weekId = Number(week.id);
          const ppcRow = contractorPpcWeeklyRows.find((row) => (
            Number(row.weekId) === weekId && Number(row.contractorId || 0) === Number(contractor.contractorId)
          ));
          if (!ppcRow) return null;
          const item = qualityItemByContractorWeek.get(`${weekId}::${Number(contractor.contractorId)}`) || null;
          const ppcPct = Number(ppcRow.executionPct || 0);
          const ppcScore = Number((ppcPct / 10).toFixed(2));
          const qualityScore = normalizeQualityScore(item?.qualityScore);
          const collaborationScore = normalizeQualityScore(item?.collaborationTeamScore);
          const safetyScore = normalizeQualityScore(item?.safetyScore);
          const cleaningScore = normalizeQualityScore(item?.cleaningScore);
          return {
            weekId,
            weekNumber: Number(week.weekNumber),
            ppcScore,
            ppcBand: classifyBand(ppcPct, qualityThresholds.deadlineRegular, qualityThresholds.deadlineGood),
            qualityScore,
            qualityBand: classifyBand(qualityScore, qualityThresholds.qualityRegular, qualityThresholds.qualityGood),
            collaborationScore,
            collaborationBand: classifyBand(collaborationScore, qualityThresholds.collaborationRegular, qualityThresholds.collaborationGood),
            cleaningScore,
            cleaningBand: classifyBand(cleaningScore, qualityThresholds.cleaningRegular, qualityThresholds.cleaningGood),
            safetyScore,
            safetyBand: classifyBand(safetyScore, qualityThresholds.safetyRegular, qualityThresholds.safetyGood),
          };
        })
        .filter(Boolean);
      if (!weekly.length) return;
      const weeksCount = weekly.length;
      const sumMetric = (key) => weekly.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
      qualityHistoryRows.push({
        contractorId: Number(contractor.contractorId),
        contractorName: contractor.contractorName,
        weekly,
        averages: {
          ppcScore: Number((sumMetric('ppcScore') / weeksCount).toFixed(2)),
          collaborationScore: Number((sumMetric('collaborationScore') / weeksCount).toFixed(2)),
          cleaningScore: Number((sumMetric('cleaningScore') / weeksCount).toFixed(2)),
          qualityScore: Number((sumMetric('qualityScore') / weeksCount).toFixed(2)),
          safetyScore: Number((sumMetric('safetyScore') / weeksCount).toFixed(2)),
        },
      });
    });

  const selectedWeekTasks = tasksByWeek.get(Number(selectedWeek.id)) || [];
  const pendingCurrent = selectedWeekTasks.filter((task) => (
    task.isUnplanned !== true
    && Number(task.originWeekId) !== Number(task.currentWeekId)
    && ['STARTED', 'NOT_STARTED'].includes(taskOutcome(task, feedbackByTaskId))
  ));
  const pendingResolvedTotal = tasks.filter((task) => (
    task.isUnplanned !== true
    && Number(task.originWeekId) !== Number(task.currentWeekId)
    && taskOutcome(task, feedbackByTaskId) === 'EXECUTED'
  )).length;

  const latestClosedWeek = closedWeeks.length ? closedWeeks[closedWeeks.length - 1] : selectedWeek;
  const requestedWeekNumberSafe = Number(requestedWeek.weekNumber);
  const selectedWeekNumberSafe = Number(selectedWeek.weekNumber);
  const excludedWeeksCount = excludedWeeks.length;
  const excludedCurrentWeek = requestedWeekNumberSafe > selectedWeekNumberSafe;
  const ppcWeeklyAveragePct = weeklyRows.length
    ? Number((weeklyRows.reduce((acc, item) => acc + Number(item?.ppc || 0), 0) / weeklyRows.length).toFixed(2))
    : 0;
  const noticeMessage = excludedWeeksCount > 0
    ? `Dados consolidados até a Semana ${selectedWeekNumberSafe} (última semana com feedback e qualidade percebida fechados). Semanas sem fechamento completo até a semana solicitada não foram incluídas.`
    : `Dados consolidados até a Semana ${selectedWeekNumberSafe} (última semana com feedback e qualidade percebida fechados).`;

  return {
    work: {
      id: Number(work.id),
      name: String(work.name || ''),
      address: String(work.address || ''),
      cep: String(work.cep || ''),
      ppcTargetPct: Number(contractorReliabilityTargetPct),
    },
    selectedWeek: {
      id: Number(selectedWeek.id),
      weekNumber: Number(selectedWeek.weekNumber),
      startDate: selectedWeek.startDate,
      endDate: selectedWeek.endDate,
    },
    requestedWeek: {
      id: Number(requestedWeek.id),
      weekNumber: requestedWeekNumberSafe,
      startDate: requestedWeek.startDate,
      endDate: requestedWeek.endDate,
      feedbackStatus: String(requestedWeek.feedbackStatus || ''),
      feedbackClosedAt: requestedWeek.feedbackClosedAt || null,
    },
    coverage: {
      requestedWeekNumber: requestedWeekNumberSafe,
      effectiveWeekNumber: selectedWeekNumberSafe,
      latestClosedWeekNumber: Number(latestClosedWeek?.weekNumber || selectedWeekNumberSafe),
      excludedWeeksCount,
      excludedCurrentWeek,
      hasExclusions: excludedWeeksCount > 0,
      message: noticeMessage,
    },
    range: {
      fromWeek: Number(firstWeek.weekNumber),
      toWeek: Number(selectedWeek.weekNumber),
      totalWeeks: historyWeeks.length,
      startDate: firstWeek.startDate,
      endDate: selectedWeek.endDate,
    },
    settings: {
      ppcTargetPct: Number(contractorReliabilityTargetPct),
    },
    totals: {
      planned: historyPlanned,
      executed: Number(metrics?.totals?.executed || 0),
      started: Number(metrics?.totals?.started || 0),
      notStarted: Number(metrics?.totals?.notStarted || 0),
      cancelled: Number(metrics?.totals?.cancelled || 0),
      unplannedExecuted: Number(metrics?.totals?.unplannedExecuted || 0),
      totalActivities: Number(metrics?.totalActivities || 0),
      executedPlannedPct: historyExecutionPct,
      totalExecutedPct: Number(metrics?.totalExecutedPct || 0),
      avgPlannedPerWeek: historyWeeks.length ? Number((historyPlanned / historyWeeks.length).toFixed(2)) : 0,
      ppcPlanned: Number(ppcHistoryConsidered || 0),
      ppcExecuted: Number(metrics?.totals?.executed || 0),
      ppcExecutionPct: Number(ppcWeeklyAveragePct || 0),
      ppcAccumulatedPct: Number(ppcHistoryAccumulatedPct || 0),
    },
    plannedDistribution: {
      planned: Number(plannedDistributionTotals.planned || 0),
      rework: Number(plannedDistributionTotals.rework || 0),
      reserve: Number(plannedDistributionTotals.reserve || 0),
      pending: Number(plannedDistributionTotals.pending || 0),
      base: Number(plannedDistributionBase || 0),
    },
    planningQuality: {
      preVsPlan: {
        totalChanges: Number(planningQualityTotalChanges || 0),
        totalProgrammedActivities: Number(planningQualityTotalProgrammed || 0),
        qualityPct: Number(planningQualityHistoricalPct || 0),
        weekly: planningQualityWeeklyRows
          .slice()
          .sort((a, b) => Number(a.weekNumber || 0) - Number(b.weekNumber || 0)),
      },
      planVsExecution: {
        totalChanges: Number(planningFinalizationTotalChanges || 0),
        totalProgrammedActivities: Number(planningFinalizationTotalActivities || 0),
        qualityPct: Number(planningFinalizationQualityPct || 0),
        weekly: planningFinalizationWeeklyRows
          .slice()
          .sort((a, b) => Number(a.weekNumber || 0) - Number(b.weekNumber || 0)),
      },
    },
    statusBars: metrics.statusBars,
    weeklyTrend: weeklyRows,
    contractors: contractorRows,
    contractorWeeklyTrend: contractorWeeklyTrendRows
      .sort((a, b) => String(a.contractor).localeCompare(String(b.contractor), 'pt-BR') || Number(a.weekNumber) - Number(b.weekNumber)),
    contractorPpcWeekly: contractorPpcWeeklyRows
      .sort((a, b) => String(a.contractor).localeCompare(String(b.contractor), 'pt-BR') || Number(a.weekNumber) - Number(b.weekNumber)),
    contractorPerformance: {
      weekly: contractorWeeklyPerformanceRows
        .sort((a, b) => String(a.contractor).localeCompare(String(b.contractor), 'pt-BR') || Number(a.weekNumber) - Number(b.weekNumber)),
      monthly: contractorMonthlyPerformanceRows
        .sort((a, b) => String(a.contractor).localeCompare(String(b.contractor), 'pt-BR') || String(a.monthKey).localeCompare(String(b.monthKey))),
      ranking: contractorPerformanceRankingRows,
    },
    zones: zoneRows,
    governance,
    access: {
      total: accessRows.reduce((acc, item) => acc + Number(item.count || 0), 0),
      rows: accessRows,
      byUser: accessByUser,
      byWeek: accessByWeek,
    },
    monthly: {
      global: monthlyGlobalRows,
      contractors: monthlyContractorRows,
      governance: monthlyGovernanceRows,
    },
    causes: {
      grouped: metrics.groupedCauses,
    },
    causeImpact: {
      total: causeImpactTotal,
      rows: causeImpactRows,
      byCategory: categoryOrder.map((category) => {
        const count = Number(categoryCounts.get(category) || 0);
        return {
          category,
          count,
          pct: causeImpactTotal ? Number(((count / causeImpactTotal) * 100).toFixed(2)) : 0,
        };
      }),
      observedByCategory: [...causeImpactByCategory.entries()].map(([category, count]) => ({
        category,
        count: Number(count || 0),
        pct: causeImpactTotal ? Number(((Number(count || 0) / causeImpactTotal) * 100).toFixed(2)) : 0,
      })).sort((a, b) => Number(b.count) - Number(a.count) || String(a.category).localeCompare(String(b.category), 'pt-BR')),
    },
    laborTypes: laborTypeRows,
    rework: {
      replannedTasks: Number(replannedTasksCount),
      plannedTasks: Number(plannedTasksCount),
      ratePct: reworkRatePct,
    },
    pendingLeadTime: {
      samples: Number(pendingLeadWeeks.length),
      avgWeeks: Number(pendingLeadAvg),
      medianWeeks: Number(Number(pendingLeadMedian || 0).toFixed(2)),
      maxWeeks: pendingLeadSorted.length ? Number(pendingLeadSorted[pendingLeadSorted.length - 1]) : 0,
    },
    contractorReliability: contractorReliabilityRows,
    pending: {
      resolvedTotal: pendingResolvedTotal,
      openCurrent: pendingCurrent.length,
    },
    qualityPerceivedHistory: {
      thresholds: qualityThresholds,
      contractors: qualityHistoryRows,
    },
  };
}

router.get('/works/:workId/dashboard/weeks/:weekId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER, ROLES.MANAGEMENT, ROLES.ENGINEERING], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const weekId = parseIntId(req.params.weekId);
  if (!weekId) return res.status(400).json({ error: 'invalid_week_id' });

  const week = await prisma.week.findUnique({ where: { id: weekId } });
  if (!week || week.workId !== req.workId) return res.status(404).json({ error: 'week_not_found' });
  const [work, qualityItemsRaw, qualityConfig, ppcMeeting] = await Promise.all([
    prisma.work.findUnique({ where: { id: req.workId }, select: { id: true, ppcTargetPct: true } }),
    prisma.weekPerceivedQualityItem.findMany({
      where: { weekId },
      include: { contractor: { select: { id: true, name: true } } },
    }),
    prisma.workPerceivedQualityConfig.findUnique({ where: { workId: req.workId } }),
    prisma.weekPpcMeeting.findUnique({
      where: { weekId },
      include: {
        attendances: {
          include: { contractor: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const tasks = await prisma.task.findMany({
    where: { currentWeekId: weekId },
    include: {
      contractor: { include: { function: true } },
      location: true,
      originWeek: { select: { id: true, weekNumber: true } },
    },
  });
  const feedbacks = await prisma.feedback.findMany({
    where: { weekId },
    include: { cause: true },
  });

  const summary = summarizeWeek(tasks, feedbacks);
  const metrics = computeDashboardMetrics(tasks, feedbacks);
  const insights = await buildWeeklyOperationalInsights(week, tasks, feedbacks);
  const contractorSpecificCauseRows = computeContractorSpecificCauseNonCompliance(tasks, feedbacks);
  const byTask = new Map(feedbacks.map((fb) => [fb.taskId, fb]));
  const causeCounter = new Map();
  const byContractor = new Map();

  const ppcByContractor = new Map();
  const ppcByLaborType = new Map();
  const ensurePpcContractor = (name) => {
    if (!ppcByContractor.has(name)) {
      ppcByContractor.set(name, {
        contractor: name,
        planned: 0,
        executed: 0,
      });
    }
    return ppcByContractor.get(name);
  };
  const ensurePpcLaborType = (name) => {
    if (!ppcByLaborType.has(name)) {
      ppcByLaborType.set(name, {
        laborType: name,
        planned: 0,
        executed: 0,
      });
    }
    return ppcByLaborType.get(name);
  };
  const ppcBox = {
    planned: 0,
    executedPlanned: 0,
    nonConcluded: 0,
    cancelled: 0,
    unplannedExecuted: 0,
    ppcPct: 0,
  };

  for (const task of tasks) {
    const feedback = byTask.get(task.id);
    const feedbackStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;
    const outcome = taskOutcome(task, byTask);
    const contractorName = task.contractor?.name || 'SEM_EMPREITEIRO';
    const laborTypeName = String(task.contractor?.function?.name || 'SEM MÃO DE OBRA');

    if (task.isUnplanned === true) {
      if (outcome === 'EXECUTED') ppcBox.unplannedExecuted += 1;
      continue;
    }
    const isReserve = String(task.status || '').toUpperCase() === TASK_STATUS.RESERVA;
    const isExecutedOutcome = (
      task.status === 'EXECUTED'
      || feedbackStatus === 'EXECUTED'
      || feedbackStatus === 'EXECUTED_UNPLANNED'
    );
    if (!(isReserve && !isExecutedOutcome)) {
      ppcBox.planned += 1;
      const ppcContractorRow = ensurePpcContractor(contractorName);
      const ppcLaborTypeRow = ensurePpcLaborType(laborTypeName);
      ppcContractorRow.planned += 1;
      ppcLaborTypeRow.planned += 1;
      if (outcome === 'EXECUTED') {
        ppcBox.executedPlanned += 1;
        ppcContractorRow.executed += 1;
        ppcLaborTypeRow.executed += 1;
      } else if (outcome === 'CANCELLED') {
        ppcBox.cancelled += 1;
      } else {
        ppcBox.nonConcluded += 1;
      }
    }

    if (!byContractor.has(contractorName)) {
      byContractor.set(contractorName, {
        contractor: contractorName,
        executed: 0,
        started: 0,
        notStarted: 0,
        cancelled: 0,
      });
    }
    const row = byContractor.get(contractorName);

    if (task.status === 'CANCELLED' || feedbackStatus === 'CANCELLED') {
      row.cancelled += 1;
      continue;
    }
    if (task.status === 'EXECUTED' || feedbackStatus === 'EXECUTED') {
      row.executed += 1;
      continue;
    }
    if (task.status === 'IN_PROGRESS' || feedbackStatus === 'STARTED') {
      row.started += 1;
      if (feedback?.cause?.description) {
        causeCounter.set(feedback.cause.description, (causeCounter.get(feedback.cause.description) || 0) + 1);
      }
      continue;
    }
    row.notStarted += 1;
    if (feedback?.cause?.description) {
      causeCounter.set(feedback.cause.description, (causeCounter.get(feedback.cause.description) || 0) + 1);
    }
  }
  ppcBox.ppcPct = ppcBox.planned
    ? Number(((ppcBox.executedPlanned / ppcBox.planned) * 100).toFixed(2))
    : 0;

  const contractorRows = [...byContractor.values()].map((row) => {
    const considered = row.executed + row.started + row.notStarted;
    return {
      ...row,
      considered,
      ppc: considered === 0 ? 0 : Number(((row.executed / considered) * 100).toFixed(2)),
    };
  }).sort((a, b) => Number(b.ppc) - Number(a.ppc));
  const contractorPpcRows = [...ppcByContractor.values()]
    .map((row) => ({
      ...row,
      executionPct: row.planned > 0
        ? Number(((row.executed / row.planned) * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => (
      Number(b.executionPct) - Number(a.executionPct)
      || Number(b.executed) - Number(a.executed)
      || String(a.contractor || '').localeCompare(String(b.contractor || ''), 'pt-BR')
    ));
  const laborTypePpcRows = [...ppcByLaborType.values()]
    .map((row) => ({
      ...row,
      executionPct: row.planned > 0
        ? Number(((row.executed / row.planned) * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => (
      Number(b.executionPct) - Number(a.executionPct)
      || Number(b.executed) - Number(a.executed)
      || String(a.laborType || '').localeCompare(String(b.laborType || ''), 'pt-BR')
    ));
  const contractorRanking = contractorSpecificCauseRows
    .map((row) => ({
      contractor: String(row.contractor || 'SEM_EMPREITEIRO'),
      planned: Number(row.planned || 0),
      nonComplianceSpecific: Number(row.nonExecutedWithContractorSpecificCause || 0),
      nonCompliancePct: Number(row.pct || 0),
      performancePct: Math.max(0, Number((100 - Number(row.pct || 0)).toFixed(2))),
    }))
    .sort((a, b) => (
      Number(b.performancePct) - Number(a.performancePct)
      || Number(b.planned) - Number(a.planned)
      || String(a.contractor || '').localeCompare(String(b.contractor || ''), 'pt-BR')
    ));

  const attendanceByContractorId = new Map(
    (ppcMeeting?.attendances || []).map((row) => [Number(row.contractorId), row.present === true]),
  );
  const contractorSpecificByName = new Map(
    contractorSpecificCauseRows.map((row) => [String(row.contractor || ''), row]),
  );
  const qualityItemByContractorId = new Map(
    (qualityItemsRaw || []).map((row) => [Number(row.contractorId), row]),
  );
  const activeContractorsById = new Map();
  (tasks || []).forEach((task) => {
    const id = Number(task.contractor?.id || task.contractorId || 0);
    if (!id) return;
    activeContractorsById.set(id, { id, name: String(task.contractor?.name || 'SEM_EMPREITEIRO') });
  });
  (qualityItemsRaw || []).forEach((row) => {
    const id = Number(row.contractor?.id || row.contractorId || 0);
    if (!id) return;
    activeContractorsById.set(id, { id, name: String(row.contractor?.name || 'SEM_EMPREITEIRO') });
  });
  (ppcMeeting?.attendances || []).forEach((row) => {
    const id = Number(row.contractor?.id || row.contractorId || 0);
    if (!id) return;
    activeContractorsById.set(id, { id, name: String(row.contractor?.name || 'SEM_EMPREITEIRO') });
  });

  const qualityThresholds = {
    deadlineRegular: Number(qualityConfig?.deadlineRegularPct ?? 60),
    deadlineGood: Number(qualityConfig?.deadlineGoodPct ?? 80),
    qualityRegular: Number(qualityConfig?.qualityRegularScore ?? 5),
    qualityGood: Number(qualityConfig?.qualityGoodScore ?? 8),
    collaborationRegular: Number(qualityConfig?.collaborationRegularScore ?? 5),
    collaborationGood: Number(qualityConfig?.collaborationGoodScore ?? 8),
    safetyRegular: Number(qualityConfig?.safetyRegularScore ?? 5),
    safetyGood: Number(qualityConfig?.safetyGoodScore ?? 8),
    cleaningRegular: Number(qualityConfig?.cleaningRegularScore ?? 5),
    cleaningGood: Number(qualityConfig?.cleaningGoodScore ?? 8),
    presenceImpact: Number(qualityConfig?.collaborationPresenceImpactScore ?? 0),
  };
  const classifyBand = (value, regular, good) => {
    if (value === null || value === undefined || value === '') return '-';
    const score = Number(value);
    if (!Number.isFinite(score)) return '-';
    if (score >= Number(good)) return 'Bom';
    if (score >= Number(regular)) return 'Regular';
    return 'Ruim';
  };
  const perceivedQualityRows = [...activeContractorsById.values()]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .map((contractor) => {
      const item = qualityItemByContractorId.get(Number(contractor.id)) || null;
      const nonComplianceRow = contractorSpecificByName.get(contractor.name) || null;
      const ppcPct = (nonComplianceRow && Number(nonComplianceRow.planned || 0) > 0)
        ? Math.max(0, Number((100 - Number(nonComplianceRow.pct || 0)).toFixed(2)))
        : 0;
      const present = attendanceByContractorId.get(Number(contractor.id)) === true;
      const collabTeam = Number.isInteger(item?.collaborationTeamScore) ? Number(item.collaborationTeamScore) : null;
      const collaborationScore = computeCollaborationFinalScore(
        collabTeam,
        qualityThresholds.presenceImpact,
        present,
      );
      const qualityScore = Number.isInteger(item?.qualityScore) ? Number(item.qualityScore) : null;
      const safetyScore = Number.isInteger(item?.safetyScore) ? Number(item.safetyScore) : null;
      const cleaningScore = Number.isInteger(item?.cleaningScore) ? Number(item.cleaningScore) : null;
      return {
        contractorId: Number(contractor.id),
        contractorName: contractor.name,
        ppcPct,
        ppcBand: classifyBand(ppcPct, qualityThresholds.deadlineRegular, qualityThresholds.deadlineGood),
        qualityScore,
        qualityBand: classifyBand(qualityScore, qualityThresholds.qualityRegular, qualityThresholds.qualityGood),
        collaborationScore,
        collaborationBand: classifyBand(collaborationScore, qualityThresholds.collaborationRegular, qualityThresholds.collaborationGood),
        safetyScore,
        safetyBand: classifyBand(safetyScore, qualityThresholds.safetyRegular, qualityThresholds.safetyGood),
        cleaningScore,
        cleaningBand: classifyBand(cleaningScore, qualityThresholds.cleaningRegular, qualityThresholds.cleaningGood),
        comments: String(item?.comments || ''),
      };
    });

  return res.json({
    week: {
      id: week.id,
      weekNumber: week.weekNumber,
      year: week.year,
      startDate: week.startDate,
      endDate: week.endDate,
      planningStatus: week.planningStatus,
      feedbackStatus: week.feedbackStatus,
    },
    summary,
    causes: [...causeCounter.entries()].map(([cause, count]) => ({ cause, count })),
    byContractor: contractorRows,
    contractorPpcRows,
    laborTypePpcRows,
    contractorRanking,
    perceivedQuality: {
      rows: perceivedQualityRows,
      thresholds: qualityThresholds,
    },
    ppcBox,
    settings: {
      ppcTargetPct: Number.isFinite(Number(work?.ppcTargetPct)) ? Number(work.ppcTargetPct) : 80,
    },
    metrics,
    accesses: {
      total: insights.weeklyAccess.reduce((acc, item) => acc + Number(item.count || 0), 0),
      users: insights.weeklyAccess,
    },
    pending: {
      base: insights.pendingFromPrior.length,
      resolved: insights.pendingResolved.length,
      remaining: insights.pendingRemaining.length,
      resolvedPct: insights.pendingResolvedPct,
      remainingRows: insights.pendingRemainingRows,
    },
  });
}));

router.get('/works/:workId/dashboard/history/weeks/:weekId', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER, ROLES.MANAGEMENT, ROLES.ENGINEERING], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const weekId = parseIntId(req.params.weekId);
  if (!weekId) return res.status(400).json({ error: 'invalid_week_id' });

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    select: { id: true, workId: true, weekNumber: true },
  });
  if (!week || Number(week.workId) !== Number(req.workId)) {
    return res.status(404).json({ error: 'week_not_found' });
  }

  const data = await computeHistoricalDashboardSnapshot(req.workId, week.weekNumber);
  if (!data) return res.status(404).json({ error: 'history_not_found' });
  return res.json(data);
}));

router.get('/works/:workId/dashboard/reports/history/pdf', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER, ROLES.MANAGEMENT, ROLES.ENGINEERING], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (!PDFDocument) {
    return res.status(500).json({ error: 'pdf_dependency_missing' });
  }

  const requestedWeek = parseIntId(req.query.weekNumber);
  const data = await computeHistoricalDashboardSnapshot(req.workId, requestedWeek || null);
  if (!data) {
    return res.status(404).json({ error: 'history_not_found' });
  }

  const appConfig = await prisma.appConfig.findFirst({ orderBy: { id: 'asc' } });
  const printedAt = new Date();
  const tz = inferBrazilTimeZoneFromWork(data.work);
  const printedAtText = formatDateTimeBrInTimeZone(printedAt, tz);
  const periodLabel = `${formatDateBr(data.selectedWeek.startDate)} a ${formatDateBr(data.selectedWeek.endDate)}`;

  const companyWebsite = appConfig?.companySite || appConfig?.companyWebsite || appConfig?.website || appConfig?.site || 'A cadastrar';
  const companyStreetNumber = [appConfig?.companyStreet, appConfig?.companyNumber].filter(Boolean).join(', ');
  const companyComplement = String(appConfig?.companyComplement || '').trim();
  const companyCityState = [appConfig?.companyCity, appConfig?.companyState].filter(Boolean).join('/');
  let companyAddressCompact = [
    companyStreetNumber ? `${companyStreetNumber}${companyComplement ? `, ${companyComplement}` : ''}` : '',
    companyCityState,
  ].filter(Boolean).join(' - ');
  if (!companyAddressCompact) companyAddressCompact = String(appConfig?.companyAddress || '').trim() || 'Não cadastrado';

  const fileWeekNumber = Number(data.coverage?.requestedWeekNumber || data.selectedWeek.weekNumber);
  const fileName = `PPC - Histórico da Obra - Semana ${fileWeekNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 34, size: 'A4', bufferPages: true });
  doc.pipe(res);

  const COLORS = {
    border: '#b7cfe8',
    box: '#f2f8ff',
    boxStrong: '#dcebff',
    title: '#c8def8',
    text: '#1e3c59',
    rowA: '#f7fbff',
    rowB: '#eaf3ff',
    header: '#d4e6fb',
    faceGood: '#21a35e',
    faceRegular: '#f2c94c',
    faceBad: '#d14b52',
  };
  const margin = 34;
  const contentWidth = doc.page.width - (margin * 2);
  const pageBottom = () => doc.page.height - margin;
  let y = margin;
  const tocEntries = [];
  const tocSeen = new Set();
  const canUsePdfDestinations = typeof doc.addNamedDestination === 'function' && typeof doc.goTo === 'function';

  const drawRoundBox = (x, yPos, w, h, fill = COLORS.box, stroke = COLORS.border, radius = 8) => {
    doc
      .save()
      .fillColor(fill)
      .strokeColor(stroke)
      .lineWidth(0.7)
      .roundedRect(x, yPos, w, h, radius)
      .fillAndStroke()
      .restore();
  };

  const drawTitleStrip = (yPos, text) => {
    const h = 28;
    drawRoundBox(margin, yPos, contentWidth, h, COLORS.title, COLORS.border);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
      .text(String(text || ''), margin, yPos + 8, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
    return yPos + h + 6;
  };

  const RUNNING_HEADER_H = 22;
  const CONTENT_TOP = margin + RUNNING_HEADER_H + 10;
  const currentDocPageNumber = () => doc.bufferedPageRange().count;
  const registerTocEntry = (title, destination) => {
    const normalized = String(title || '').trim().toUpperCase();
    if (!normalized) return;
    if (tocSeen.has(normalized)) return;
    tocSeen.add(normalized);
    tocEntries.push({
      title: normalized,
      page: currentDocPageNumber(),
      destination: destination || '',
      level: /^\d+\.\d+/.test(normalized) ? 2 : 1,
    });
  };
  const runningHeaderLeft = 'PPC - RELATÓRIO - Histórico';
  const drawRunningHeader = () => {
    drawRoundBox(margin, margin, contentWidth, RUNNING_HEADER_H, '#eef6ff', COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.5)
      .text(runningHeaderLeft, margin + 8, margin + 6, {
        width: 220,
        lineBreak: false,
        ellipsis: true,
      });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
      .text(String(data.work?.name || '-'), margin + 232, margin + 6, {
        width: contentWidth - 240,
        align: 'right',
        lineBreak: false,
        ellipsis: true,
      });
  };

  const addPage = () => {
    doc.addPage();
    drawRunningHeader();
    y = CONTENT_TOP;
  };
  const ensureSpace = (neededHeight) => {
    if (y + neededHeight > pageBottom() - 16) addPage();
  };
  const drawSectionTitle = (text, minHeight = 0, options = {}) => {
    const normalized = String(text || '').trim().toUpperCase();
    const registerInToc = options.registerInToc !== false;
    const wrap = options.wrap === true;
    const fontSize = Number(options.fontSize || 9.6);
    const destination = `dest_${normalized
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120)}`;
    if (registerInToc) registerTocEntry(normalized, destination);
    const titleTextHeight = wrap
      ? Math.ceil(doc.font('Helvetica-Bold').fontSize(fontSize).heightOfString(normalized, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: true,
      }))
      : Math.ceil(fontSize + 2);
    const titleBoxH = Math.max(22, titleTextHeight + 8);
    const titleGap = 5;
    ensureSpace(titleBoxH + titleGap + Math.max(0, Number(minHeight) || 0));
    if (canUsePdfDestinations && registerInToc) {
      try {
        doc.addNamedDestination(destination);
      } catch {
        // no-op
      }
    }
    drawRoundBox(margin, y, contentWidth, titleBoxH, COLORS.boxStrong, COLORS.border, 6);
    const titleY = y + Math.max(3, Math.floor((titleBoxH - titleTextHeight) / 2));
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(fontSize)
      .text(normalized, margin + 8, titleY, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: wrap,
        ellipsis: !wrap,
      });
    y += titleBoxH + titleGap;
  };

  const formatNumberBr = (value, decimals = 2) => Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const formatPercentBr = (value, decimals = 2) => `${formatNumberBr(value, decimals)}%`;

  const drawSimpleTable = (columns, rows, opts = {}) => {
    const headerH = opts.headerH || 20;
    const rowH = opts.rowH || 20;
    const maxRows = Array.isArray(rows) ? rows : [];

    const drawHeader = () => {
      drawRoundBox(margin, y, contentWidth, headerH, COLORS.header, COLORS.border, 4);
      let x = margin;
      columns.forEach((col, idx) => {
        if (idx > 0) {
          doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, y).lineTo(x, y + headerH).stroke().restore();
        }
        const headerText = String(col.title || '');
        const headerSize = 7.3;
        const headerOptions = {
          width: col.width - 4,
          align: 'center',
          lineBreak: col.wrapTitle === true,
          ellipsis: true,
        };
        doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(headerSize);
        const headerTextHeight = Math.min(
          headerH - 4,
          doc.heightOfString(headerText, headerOptions),
        );
        const headerTextY = y + Math.max(2, ((headerH - headerTextHeight) / 2));
        doc.text(headerText, x + 2, headerTextY, headerOptions);
        x += col.width;
      });
      y += headerH;
    };

    const drawRow = (row, idx) => {
      const fill = idx % 2 === 0 ? COLORS.rowA : COLORS.rowB;
      drawRoundBox(margin, y, contentWidth, rowH, fill, COLORS.border, 3);
      let x = margin;
      columns.forEach((col, colIdx) => {
        if (colIdx > 0) {
          doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(x, y).lineTo(x, y + rowH).stroke().restore();
        }
        const value = row[col.key] ?? '';
        const text = (col.formatter && typeof col.formatter === 'function')
          ? col.formatter(value, row)
          : value;
        const rowText = String(text);
        const rowSize = 7.0;
        const rowOptions = {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        };
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(rowSize);
        const rowTextHeight = Math.min(
          rowH - 4,
          doc.heightOfString(rowText, rowOptions),
        );
        const rowTextY = y + Math.max(2, ((rowH - rowTextHeight) / 2));
        doc.text(rowText, x + 2, rowTextY, rowOptions);
        x += col.width;
      });
      y += rowH;
    };

    ensureSpace(headerH + rowH + 2);
    drawHeader();
    if (!maxRows.length) {
      drawRow(Object.fromEntries(columns.map((col) => [col.key, '-'])), 0);
      return;
    }
    maxRows.forEach((row, idx) => {
      if (y + rowH > pageBottom() - 16) {
        addPage();
        drawSectionTitle(String(opts.repeatTitle || opts.title || 'Tabela'), 0, { registerInToc: false });
        drawHeader();
      }
      drawRow(row, idx);
    });
  };

  const drawLegend = (items, x, yPos, width, options = {}) => {
    let cursorX = x;
    let cursorY = yPos;
    const rowH = options.rowH || 12;
    const fontSize = options.fontSize || 6.6;
    const sw = options.sw || 8;
    items.forEach((item) => {
      const label = String(item.label || '');
      const color = String(item.color || '#2f8f65');
      const textW = Math.min(220, doc.widthOfString(label, { font: 'Helvetica', size: fontSize }) + 10);
      if (cursorX + sw + textW > x + width) {
        cursorX = x;
        cursorY += rowH;
      }
      doc.save().fillColor(color).rect(cursorX, cursorY + 2, sw, sw).fill().restore();
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(fontSize)
        .text(label, cursorX + sw + 3, cursorY + 1, { lineBreak: false, ellipsis: true });
      cursorX += sw + textW + 8;
    });
    return cursorY + rowH;
  };

  const drawLegendGrid = (items, x, yPos, width, columns = 2) => {
    const safeItems = Array.isArray(items) ? items : [];
    if (!safeItems.length) return yPos;
    const colCount = Math.max(1, Number(columns) || 1);
    const colW = width / colCount;
    const rowH = 12;
    safeItems.forEach((item, idx) => {
      const row = Math.floor(idx / colCount);
      const col = idx % colCount;
      const cx = x + (col * colW);
      const cy = yPos + (row * rowH);
      const sw = 7;
      doc.save().fillColor(String(item.color || '#2f8f65')).rect(cx, cy + 2, sw, sw).fill().restore();
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(6.0)
        .text(String(item.label || ''), cx + sw + 3, cy + 1, {
          width: colW - sw - 6,
          lineBreak: false,
          ellipsis: true,
        });
    });
    return yPos + (Math.ceil(safeItems.length / colCount) * rowH);
  };

  const drawGroupedBarChart = ({
    x,
    yPos,
    width,
    height,
    categories,
    series,
    yLabel = 'Qtde',
    showValueLabels = true,
    valueFormatter = (value) => String(Number(value || 0)),
    maxLabelLines = 2,
    yMaxOverride = null,
    extraBottomArea = 0,
    showVerticalBottomValueLabels = false,
    bottomValueLabelFormatter = (value) => String(Number(value || 0)),
    bottomValueLabelFontSize = 6.5,
    yTickFontSize = 6.2,
    yAxisLabelFontSize = 6.0,
    categoryFontSize = 6.0,
    barValueLabelFontSize = 6.2,
    showBubbleLabels = false,
    bubbleLabelFormatter = (value) => String(value),
    bubbleLabelFontSize = 6.2,
    bubbleFillColor = '#000000',
    bubbleTextColor = '#ffffff',
    overlayBars = false,
    stackedBars = false,
  }) => {
    const wrapLabel = (text, maxChars = 14, maxLines = maxLabelLines) => {
      const raw = String(text || '').trim();
      if (!raw) return '';
      const words = raw.split(/\s+/);
      const lines = [];
      let current = '';
      words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxChars) {
          current = candidate;
        } else if (current) {
          lines.push(current);
          current = word;
        } else {
          lines.push(word);
          current = '';
        }
      });
      if (current) lines.push(current);
      if (lines.length <= maxLines) return lines.join('\n');
      return lines.slice(0, maxLines).join('\n');
    };

    const chartTop = yPos + 16;
    const labelArea = Math.max(30, 8 + (maxLabelLines * 8)) + Math.max(0, Number(extraBottomArea || 0));
    const chartBottom = yPos + height - labelArea;
    const axisLeft = x + 26;
    const axisRight = x + width - 6;
    const plotWidth = axisRight - axisLeft;
    const plotHeight = chartBottom - chartTop;
    const catCount = Math.max(1, categories.length);
    const seriesList = Array.isArray(series) ? series : [];
    const seriesCount = Math.max(1, seriesList.length);
    const slotCount = (overlayBars || stackedBars) ? 1 : seriesCount;
    const allValues = [];
    seriesList.forEach((s) => (s.values || []).forEach((v) => allValues.push(Number(v) || 0)));
    const maxY = Math.max(1, Number(yMaxOverride || 0), ...allValues);
    const tickValues = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxY * p));

    doc.save().strokeColor('#97b6d8').lineWidth(0.8);
    doc.moveTo(axisLeft, chartTop).lineTo(axisLeft, chartBottom).stroke();
    doc.moveTo(axisLeft, chartBottom).lineTo(axisRight, chartBottom).stroke();
    doc.restore();
    tickValues.forEach((tick) => {
      const ratio = maxY ? (tick / maxY) : 0;
      const yTick = chartBottom - (ratio * plotHeight);
      doc.save().strokeColor('#d7e6f6').lineWidth(0.5).moveTo(axisLeft, yTick).lineTo(axisRight, yTick).stroke().restore();
      doc.fillColor('#4b6784').font('Helvetica').fontSize(yTickFontSize)
        .text(formatNumberBr(tick, maxY > 20 ? 0 : 2), x, yTick - 3, { width: 22, align: 'right', lineBreak: false });
    });
    doc.fillColor('#4b6784').font('Helvetica').fontSize(yAxisLabelFontSize)
      .text(yLabel, x, chartTop - 10, { width: 22, align: 'right', lineBreak: false });

    const groupW = plotWidth / catCount;
    const innerGap = 2;
    const barW = Math.max(3, Math.min(12, (groupW - 6 - ((slotCount - 1) * innerGap)) / slotCount));
    const xLabelTop = chartBottom + 4;
    const xLabelBandHeight = Math.max(10, maxLabelLines * 8);
    const valueBandTop = xLabelTop + xLabelBandHeight;
    const primarySeries = seriesList[0] || { values: [] };
    categories.forEach((category, idx) => {
      const totalBarsW = overlayBars
        ? barW
        : (stackedBars
          ? barW
          : ((barW * seriesCount) + (innerGap * (seriesCount - 1))));
      const baseX = axisLeft + (idx * groupW) + ((groupW - totalBarsW) / 2);
      let stackedAccumValue = 0;
      seriesList.forEach((s, sIdx) => {
        const value = Number(s.values?.[idx] || 0);
        const h = maxY ? ((value / maxY) * plotHeight) : 0;
        const seriesBarW = overlayBars
          ? Math.max(3, barW - (sIdx * 1.4))
          : barW;
        const bx = overlayBars
          ? (baseX + ((barW - seriesBarW) / 2))
          : (stackedBars
            ? baseX
            : (baseX + (sIdx * (barW + innerGap))));
        const stackedBaseH = stackedBars
          ? (maxY ? ((stackedAccumValue / maxY) * plotHeight) : 0)
          : 0;
        const by = chartBottom - h - stackedBaseH;
        doc.save().fillColor(String(s.color || '#2f8f65')).rect(bx, by, seriesBarW, h).fill().restore();
        if (showValueLabels) {
          const labelYOffset = overlayBars ? (sIdx * 8) : (stackedBars ? (sIdx * 2) : 0);
          const labelY = stackedBars
            ? Math.max(chartTop - 8, by + 2 + labelYOffset)
            : Math.max(chartTop - 8, by - 9 - labelYOffset);
          doc.fillColor('#1e3c59').font('Helvetica-Bold').fontSize(barValueLabelFontSize)
            .text(String(valueFormatter(value, s, idx)), bx - 8, labelY, {
              width: seriesBarW + 16,
              align: 'center',
              lineBreak: false,
              ellipsis: true,
            });
        }
        if (stackedBars) stackedAccumValue += value;
        if (showBubbleLabels) {
          const bubbleLabel = String(bubbleLabelFormatter(value, s, idx) || '').trim();
          if (bubbleLabel) {
            doc.font('Helvetica-Bold').fontSize(bubbleLabelFontSize);
            const txtW = Math.ceil(doc.widthOfString(bubbleLabel, { font: 'Helvetica-Bold', size: bubbleLabelFontSize }));
            const radius = Math.max(8, Math.ceil((txtW / 2) + 3));
            const cxRaw = bx + seriesBarW + radius + 3;
            const cx = Math.min(axisRight - radius - 1, Math.max(axisLeft + radius + 1, cxRaw));
            const cy = Math.max(chartTop + radius + 1, Math.min(chartBottom - radius - 1, by + (h / 2)));
            doc.save().fillColor(String(bubbleFillColor || '#000000')).circle(cx, cy, radius).fill().restore();
            doc.fillColor(String(bubbleTextColor || '#ffffff')).font('Helvetica-Bold').fontSize(bubbleLabelFontSize)
              .text(bubbleLabel, cx - radius + 1, cy - Math.max(4, bubbleLabelFontSize / 2), {
                width: (radius * 2) - 2,
                align: 'center',
                lineBreak: false,
                ellipsis: true,
              });
          }
        }
      });
      const lbl = wrapLabel(String(category || ''), Math.max(8, Math.floor(groupW / 4.1)), maxLabelLines);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(categoryFontSize)
        .text(lbl, axisLeft + (idx * groupW), xLabelTop, {
          width: groupW,
          align: 'center',
          lineBreak: true,
          ellipsis: true,
        });
      if (showVerticalBottomValueLabels) {
        const rawValue = Number(primarySeries.values?.[idx] || 0);
        const labelValue = String(bottomValueLabelFormatter(rawValue, primarySeries, idx));
        const cx = axisLeft + (idx * groupW) + (groupW / 2);
        const cy = valueBandTop + Math.max(8, (Number(extraBottomArea || 0) / 2));
        doc.save();
        doc.fillColor('#1e3c59').font('Helvetica-Bold').fontSize(bottomValueLabelFontSize);
        doc.rotate(-90, { origin: [cx, cy] });
        doc.text(labelValue, cx - 24, cy - 3, {
          width: 48,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
        doc.restore();
      }
    });
  };

  const drawBarLineComboChart = ({
    x,
    yPos,
    width,
    height,
    categories,
    barSeries,
    lineSeries,
    yLabel = '%',
    yMax = 100,
    valueFormatter = (value) => formatPercentBr(value || 0),
    maxLabelLines = 2,
    showBarValueLabels = true,
    showVerticalBottomBarLabels = false,
    extraBottomArea = 0,
    bottomValueLabelFontSize = 6.5,
    yTickFontSize = 6.2,
    yAxisLabelFontSize = 6.0,
    categoryFontSize = 6.0,
    barValueLabelFontSize = 6.2,
  }) => {
    drawGroupedBarChart({
      x,
      yPos,
      width,
      height,
      categories,
      series: barSeries,
      yLabel,
      showValueLabels: showBarValueLabels,
      valueFormatter,
      maxLabelLines,
      yMaxOverride: yMax,
      extraBottomArea,
      showVerticalBottomValueLabels: showVerticalBottomBarLabels,
      bottomValueLabelFormatter: valueFormatter,
      bottomValueLabelFontSize,
      yTickFontSize,
      yAxisLabelFontSize,
      categoryFontSize,
      barValueLabelFontSize,
    });

    const chartTop = yPos + 16;
    const labelArea = Math.max(30, 8 + (maxLabelLines * 8)) + Math.max(0, Number(extraBottomArea || 0));
    const chartBottom = yPos + height - labelArea;
    const axisLeft = x + 26;
    const axisRight = x + width - 6;
    const plotWidth = axisRight - axisLeft;
    const plotHeight = chartBottom - chartTop;
    const pointsCount = Math.max(1, categories.length);
    const stepX = pointsCount > 1 ? (plotWidth / (pointsCount - 1)) : 0;

    (lineSeries || []).forEach((s) => {
      const color = String(s.color || '#1d4e89');
      const values = Array.isArray(s.values) ? s.values : [];
      const lineStyle = String(s.lineStyle || 'solid');
      doc.save().strokeColor(color).lineWidth(1.4);
      if (lineStyle === 'dashed') doc.dash(4, { space: 3 });
      if (lineStyle === 'dotted') doc.dash(1.5, { space: 2.5 });
      values.forEach((v, idx) => {
        const value = Math.max(0, Math.min(yMax, Number(v) || 0));
        const px = axisLeft + (idx * stepX);
        const py = chartBottom - ((value / yMax) * plotHeight);
        if (idx === 0) doc.moveTo(px, py); else doc.lineTo(px, py);
      });
      doc.stroke().restore();
    });
  };

  const drawMultiLineChart = ({
    x, yPos, width, height, labels, series, yLabel = '%', yMax = 100,
  }) => {
    const chartTop = yPos + 16;
    const chartBottom = yPos + height - 30;
    const axisLeft = x + 28;
    const axisRight = x + width - 6;
    const plotWidth = axisRight - axisLeft;
    const plotHeight = chartBottom - chartTop;
    const pointsCount = Math.max(1, labels.length);
    const maxY = Math.max(1, Number(yMax) || 100);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((factor) => Number((maxY * factor).toFixed(maxY > 20 ? 0 : 2)));

    doc.save().strokeColor('#97b6d8').lineWidth(0.8);
    doc.moveTo(axisLeft, chartTop).lineTo(axisLeft, chartBottom).stroke();
    doc.moveTo(axisLeft, chartBottom).lineTo(axisRight, chartBottom).stroke();
    doc.restore();
    ticks.forEach((tick) => {
      const yTick = chartBottom - ((tick / maxY) * plotHeight);
      doc.save().strokeColor('#d7e6f6').lineWidth(0.5).moveTo(axisLeft, yTick).lineTo(axisRight, yTick).stroke().restore();
      doc.fillColor('#4b6784').font('Helvetica').fontSize(6.1)
        .text(formatNumberBr(tick, maxY > 20 ? 0 : 2), x, yTick - 3, { width: 24, align: 'right', lineBreak: false });
    });
    doc.fillColor('#4b6784').font('Helvetica').fontSize(6.0)
      .text(yLabel, x, chartTop - 10, { width: 24, align: 'right', lineBreak: false });

    const stepX = pointsCount > 1 ? (plotWidth / (pointsCount - 1)) : 0;
    (series || []).forEach((s) => {
      const color = String(s.color || '#2f8f65');
      const values = Array.isArray(s.values) ? s.values : [];
      const lineStyle = String(s.lineStyle || 'solid');
      doc.save().strokeColor(color).lineWidth(1.2);
      if (lineStyle === 'dashed') doc.dash(4, { space: 3 });
      if (lineStyle === 'dotted') doc.dash(1.5, { space: 2.5 });
      values.forEach((v, idx) => {
        const value = Math.max(0, Math.min(maxY, Number(v) || 0));
        const px = axisLeft + (idx * stepX);
        const py = chartBottom - ((value / maxY) * plotHeight);
        if (idx === 0) doc.moveTo(px, py); else doc.lineTo(px, py);
      });
      doc.stroke().restore();
      if (lineStyle === 'dashed' || lineStyle === 'dotted' || s.hidePoints === true) return;
      values.forEach((v, idx) => {
        const value = Math.max(0, Math.min(maxY, Number(v) || 0));
        const px = axisLeft + (idx * stepX);
        const py = chartBottom - ((value / maxY) * plotHeight);
        doc.save().fillColor(color).circle(px, py, 1.7).fill().restore();
      });
    });

    const labelStep = Math.max(1, Math.ceil(pointsCount / 12));
    labels.forEach((label, idx) => {
      if (idx % labelStep !== 0 && idx !== labels.length - 1) return;
      const lx = axisLeft + (idx * stepX);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(5.9)
        .text(String(label || ''), lx - 18, chartBottom + 4, {
          width: 36,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
    });
  };

  const classifyBandLocal = (value, regular, good) => {
    if (value === null || value === undefined || value === '') return '-';
    const score = Number(value);
    if (!Number.isFinite(score)) return '-';
    if (score >= Number(good)) return 'Bom';
    if (score >= Number(regular)) return 'Regular';
    return 'Ruim';
  };

  const resolveBandFaceLocal = (band) => {
    const normalized = String(band || '-').toUpperCase();
    if (normalized === 'BOM') return { mood: 'good', color: COLORS.faceGood };
    if (normalized === 'REGULAR') return { mood: 'regular', color: COLORS.faceRegular };
    if (normalized === 'RUIM') return { mood: 'bad', color: COLORS.faceBad };
    return { mood: 'none', color: '#9fb5ca' };
  };

  const drawBandFaceLocal = (x, yPos, size, band) => {
    const face = resolveBandFaceLocal(band);
    const cx = x + (size / 2);
    const cy = yPos + (size / 2);
    const radius = size / 2;
    doc.save();
    doc.fillColor(face.color).circle(cx, cy, radius).fill();
    if (face.mood !== 'none') {
      doc.fillColor('#12324d');
      const eyeR = Math.max(0.8, size * 0.05);
      const eyeY = yPos + (size * 0.38);
      doc.circle(x + (size * 0.34), eyeY, eyeR).fill();
      doc.circle(x + (size * 0.66), eyeY, eyeR).fill();
      doc.strokeColor('#12324d').lineWidth(Math.max(0.5, size * 0.05));
      if (face.mood === 'good') {
        doc.path(`M ${x + (size * 0.28)} ${yPos + (size * 0.60)} Q ${cx} ${yPos + (size * 0.80)} ${x + (size * 0.72)} ${yPos + (size * 0.60)}`).stroke();
      } else if (face.mood === 'regular') {
        doc.moveTo(x + (size * 0.30), yPos + (size * 0.66)).lineTo(x + (size * 0.70), yPos + (size * 0.66)).stroke();
      } else {
        doc.path(`M ${x + (size * 0.28)} ${yPos + (size * 0.76)} Q ${cx} ${yPos + (size * 0.56)} ${x + (size * 0.72)} ${yPos + (size * 0.76)}`).stroke();
      }
    }
    doc.restore();
  };

  const drawCompanyHeaderBlock = (startY = margin) => {
    const logoW = 98;
    const logoH = 64;
    const gap = 8;
    const rightX = margin + logoW + gap;
    const rightW = contentWidth - logoW - gap;
    drawRoundBox(margin, startY, logoW, logoH);
    let logoRendered = false;
    if (appConfig?.logoPath) {
      try {
        const logoDataUrl = String(appConfig.logoPath || '').trim();
        if (logoDataUrl.startsWith('data:image/')) {
          const logoBuffer = decodeImageDataUrl(logoDataUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, margin + 6, startY + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
            logoRendered = true;
          }
        } else if (fs.existsSync(appConfig.logoPath)) {
          doc.image(appConfig.logoPath, margin + 6, startY + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
          logoRendered = true;
        }
      } catch {
        logoRendered = false;
      }
    }
    if (!logoRendered) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text('LOGO', margin, startY + 25, { width: logoW, align: 'center' });
    }
    drawRoundBox(rightX, startY, rightW, 26);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
      .text(String(appConfig?.companyName || 'Não cadastrado'), rightX + 8, startY + 7, {
        width: rightW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });

    const secondRowY = startY + logoH - 30;
    drawRoundBox(rightX, secondRowY, 136, 30);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.1)
      .text(`CNPJ: ${String(appConfig?.companyCnpj || 'Não cadastrado')}`, rightX + 8, secondRowY + 10, {
        width: 120,
        lineBreak: false,
        ellipsis: true,
      });
    drawRoundBox(rightX + 140, secondRowY, rightW - 140, 30);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.0)
      .text(String(companyAddressCompact), rightX + 148, secondRowY + 6, {
        width: rightW - 156,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.text(String(companyWebsite), rightX + 148, secondRowY + 18, {
      width: rightW - 156,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
    return startY + 72;
  };

  const drawCoverPage = () => {
    const afterHeaderY = drawCompanyHeaderBlock(margin);
    const coverBoxH = 188;
    const coverBoxY = Math.max(afterHeaderY + 26, Math.floor((doc.page.height - coverBoxH) / 2));
    const accumulatedPeriod = `Semanas ${Number(data.range?.fromWeek || data.selectedWeek.weekNumber)} a ${Number(data.range?.toWeek || data.selectedWeek.weekNumber)}`;
    const accumulatedDates = `De ${formatDateBr(data.range?.startDate || data.selectedWeek.startDate)} até ${formatDateBr(data.range?.endDate || data.selectedWeek.endDate)}`;
    const workAddressText = `${String(data.work?.address || '-')}${data.work?.cep ? ` | CEP ${data.work.cep}` : ''}`;
    drawRoundBox(margin, coverBoxY, contentWidth, coverBoxH, '#f7fbff', COLORS.border, 10);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(24)
      .text('PPC RELATÓRIO', margin + 16, coverBoxY + 28, {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
      });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(12.8)
      .text(`Período considerado: ${accumulatedPeriod}`, margin + 16, coverBoxY + 70, {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
      });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(11.3)
      .text(accumulatedDates, margin + 16, coverBoxY + 88, {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
      });
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(15.6)
      .text(String(data.work?.name || '-').toUpperCase(), margin + 16, coverBoxY + 118, {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10.6)
      .text(workAddressText.toUpperCase(), margin + 16, coverBoxY + 150, {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
  };

  const drawSummaryPage = () => {
    drawRoundBox(margin, y, contentWidth, 24, COLORS.boxStrong, COLORS.border, 7);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(11.2)
      .text('SUMÁRIO', margin + 8, y + 7, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    y += 38;
  };

  const startMainSectionOnNewPage = (title, minHeight = 0, options = {}) => {
    drawSectionTitle(title, minHeight, options);
  };

  drawCoverPage();

  addPage();
  const tocPageIndex = doc.bufferedPageRange().count - 1;
  drawSummaryPage();

  addPage();
  drawSectionTitle('1 - Introdução', 80);
  const introText = [
    'Este relatório histórico consolida os resultados da obra desde a primeira semana com feedback e qualidade percebida fechados até a semana de corte selecionada. O objetivo é apresentar, de forma clara e objetiva, desempenho, qualidade percebida e governança do processo.',
    'CAPÍTULO 2 - DESEMPENHO',
    'O Capítulo 2 é focado na apresentação do desempenho da obra e dos empreiteiros ao longo do período.',
    '  2.1 - Resumo acumulado da obra: apresenta os principais números consolidados do histórico.',
    '  2.2 - Desempenho mensal: mostra a evolução mensal do PPC e das médias de referência.',
    '  2.3 - Desempenho semanal: mostra a evolução semanal do PPC e das médias de referência.',
    '  2.4 - Evolução mensal por empreiteiro: apresenta o desempenho agregado por mês para cada empreiteiro.',
    '  2.5 - Evolução semanal por empreiteiro: apresenta a variação semanal do desempenho por empreiteiro.',
    '  2.6 - Ranking de empreiteiros: ordena os empreiteiros pelo desempenho apurado no período.',
    '  2.7 - PPC por tipo de mão de obra: consolida o desempenho por especialidade de mão de obra.',
    '  2.8 - Ranking de empreiteiros: detalha o posicionamento acumulado por desempenho.',
    '  2.9 - PPC por tipo de mão de obra: apresenta os totais e percentuais por tipo de mão de obra.',
    '  2.10 - Causas de não cumprimento: apresenta volume e distribuição das causas de não cumprimento.',
    '  2.11 - Qualidade no planejamento: compara Pré-programação, Programação e execução final.',
    '  2.12 - Confiabilidade do planejamento por empreiteiro: mede estabilidade de entrega ao longo das semanas.',
    '  2.13 - Visão mensal global: consolida os resultados mensais da obra em tabela única.',
    '  2.14 - Índices adicionais: mostra retrabalho, lead time de pendências e saldo de pendências.',
    '  2.15 - Mapa de calor por Zona 1: apresenta concentração e eficiência das atividades por zona.',
    '  2.16 - Visão semanal por empreiteiro: mostra a curva semanal de desempenho por empreiteiro.',
    'CAPÍTULO 3 - QUALIDADE PERCEBIDA',
    'Apresenta a evolução mensal da qualidade percebida por empreiteiro, com notas por critério e média do período ativo.',
    'CAPÍTULO 4 - GOVERNANÇA',
    'Apresenta os resultados de cumprimento de prazos e os indicadores de acesso ao sistema por usuário.',
  ].join('\n\n');
  doc.font('Helvetica').fontSize(8.9);
  const introBoxH = Math.max(170, Math.ceil(doc.heightOfString(introText, {
    width: contentWidth - 20,
    align: 'justify',
    lineBreak: true,
    lineGap: 1.2,
  }) + 16));
  ensureSpace(introBoxH + 6);
  drawRoundBox(margin, y, contentWidth, introBoxH, '#f7fbff', COLORS.border, 7);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.9)
    .text(introText, margin + 10, y + 8, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.2,
    });
  y += introBoxH + 8;

  addPage();
  drawSectionTitle('2 - Desempenho', 96);
  drawRoundBox(margin, y, contentWidth, 22);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
    .text(`Período acumulado: Semana ${data.range.fromWeek} até Semana ${data.range.toWeek} | Documento impresso em: ${printedAtText}`, margin + 8, y + 7, {
      width: contentWidth - 16,
      lineBreak: false,
      ellipsis: true,
    });
  y += 28;
  if (data.coverage?.message) {
    drawRoundBox(margin, y, contentWidth, 28, '#fff5dc', '#d7b453', 7);
    doc.fillColor('#5f4510').font('Helvetica-Bold').fontSize(8.2)
      .text(String(data.coverage.message || ''), margin + 8, y + 9, {
        width: contentWidth - 16,
        lineBreak: false,
        ellipsis: true,
      });
    y += 34;
  }

  startMainSectionOnNewPage('2.1 - Resumo acumulado da obra', 86);
  const ppcMetaTarget = Number(data.settings?.ppcTargetPct ?? data.work?.ppcTargetPct ?? 80);
  const ppcAverage = Number(data.totals?.ppcExecutionPct ?? data.totals?.executedPlannedPct ?? 0);
  const ppcBelowTarget = ppcAverage < ppcMetaTarget;
  const ppcBoxFill = ppcBelowTarget ? '#c43840' : '#dff4df';
  const ppcTextColor = ppcBelowTarget ? '#ffffff' : COLORS.text;
  ensureSpace(142);
  drawRoundBox(margin, y, contentWidth, 134, ppcBoxFill, COLORS.border, 8);
  doc.fillColor(ppcTextColor).font('Helvetica-Bold').fontSize(12.2)
    .text('MÉDIA DE ATENDIMENTO DO PPC', margin + 8, y + 8, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });
  doc.fillColor(ppcTextColor).font('Helvetica-Bold').fontSize(34)
    .text(formatPercentBr(ppcAverage || 0), margin + 8, y + 30, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });
  const ppcExplanation = `São consideradas aqui apenas as atividades que foram planejadas na semana anterior. Atividades que foram executadas, mas não foram planejadas, não são contabilizadas.\nMeta de PPC cadastrada para a obra: ${formatPercentBr(ppcMetaTarget || 0)}.\nAtividades em status Reserva: se executadas, contam como atividade planejada e executada; se não executadas, não entram como atividade planejada.`;
  doc.fillColor(ppcTextColor).font('Helvetica').fontSize(8.5)
    .text(ppcExplanation, margin + 10, y + 73, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
    });
  y += 142;

  const weeklyTrend = Array.isArray(data.weeklyTrend) ? data.weeklyTrend : [];
  const totalWeeks = Math.max(1, Number(data.range?.totalWeeks || weeklyTrend.length || 0));
  const weeksWithMeta = weeklyTrend.filter((item) => Number(item.ppc || 0) >= ppcMetaTarget).length;
  const weeksWithMetaPct = totalWeeks ? Number(((weeksWithMeta / totalWeeks) * 100).toFixed(2)) : 0;

  const plannedTotal = Number(data.totals?.planned || 0);
  const plannedAvg = totalWeeks ? Number((plannedTotal / totalWeeks).toFixed(2)) : 0;
  const executedPlannedTotal = Number(data.totals?.ppcExecuted ?? data.totals?.executed ?? 0);
  const executedPlannedAvg = totalWeeks ? Number((executedPlannedTotal / totalWeeks).toFixed(2)) : 0;
  const startedTotal = Number(data.totals?.started || 0);
  const startedAvg = totalWeeks ? Number((startedTotal / totalWeeks).toFixed(2)) : 0;
  const notStartedTotal = Number(data.totals?.notStarted || 0);
  const notStartedAvg = totalWeeks ? Number((notStartedTotal / totalWeeks).toFixed(2)) : 0;
  const unplannedExecutedTotal = Number(data.totals?.unplannedExecuted || 0);
  const unplannedExecutedAvg = totalWeeks ? Number((unplannedExecutedTotal / totalWeeks).toFixed(2)) : 0;
  const cancelledTotal = Number(data.totals?.cancelled || 0);
  const cancelledAvg = totalWeeks ? Number((cancelledTotal / totalWeeks).toFixed(2)) : 0;

  const metricRows = [
    {
      key: 'metaWeeks',
      labels: ['Semanas com meta PPC atendida', 'Total de semanas', '% Semanas com meta PPC atendida'],
      values: [String(weeksWithMeta), String(totalWeeks), formatPercentBr(weeksWithMetaPct)],
      explanation: 'Semanas com a meta do PPC atendida são as semanas em que o % de execução de atividades com relação às atividades planejadas para semana foi superior à meta cadastrada para a obra.',
    },
    {
      key: 'planned',
      labels: ['Total de atividades planejadas', 'Média de atividades planejadas por semana'],
      values: [formatNumberBr(plannedTotal, 0), formatNumberBr(plannedAvg, 2)],
      explanation: 'Aqui é fornecido o total de atividades planejadas durante todas as semanas para a obra, bem como a média de atividades planejadas por semana.',
      rowFill: '#dff4df',
      metricFill: '#cdeccc',
    },
    {
      key: 'executedPlanned',
      labels: ['Total de atividades planejadas e executadas', 'Média de atividades planejadas e executadas por semana'],
      values: [formatNumberBr(executedPlannedTotal, 0), formatNumberBr(executedPlannedAvg, 2)],
      explanation: 'Aqui é fornecido o total de atividades planejadas e executadas durante todas as semanas para a obra, bem como a média de atividades planejadas e executadas por semana. Atividades em status Reserva: se executadas, contam como atividade planejada e executada; se não executadas, não entram como atividade planejada.',
      rowFill: '#e3f8eb',
      metricFill: '#cdeedc',
    },
    {
      key: 'started',
      labels: ['Total de atividades iniciadas', 'Média de atividades iniciadas por semana'],
      values: [formatNumberBr(startedTotal, 0), formatNumberBr(startedAvg, 2)],
      explanation: 'Aqui é fornecido o total de atividades planejadas e iniciadas (mas não finalizadas) durante todas as semanas para a obra, bem como a média de atividades planejadas e iniciadas (mas não finalizadas) por semana.',
      rowFill: '#eafaf0',
      metricFill: '#daf3e6',
    },
    {
      key: 'notStarted',
      labels: ['Total de atividades não iniciadas', 'Média de atividades não iniciadas por semana'],
      values: [formatNumberBr(notStartedTotal, 0), formatNumberBr(notStartedAvg, 2)],
      explanation: 'Aqui é fornecido o total de atividades planejadas e não iniciadas durante todas as semanas para a obra, bem como a média de atividades planejadas e não iniciadas por semana.',
      rowFill: '#f0fbf4',
      metricFill: '#e4f6ec',
    },
    {
      key: 'cancelled',
      labels: ['Total de atividades canceladas', 'Média de atividades canceladas por semana'],
      values: [formatNumberBr(cancelledTotal, 0), formatNumberBr(cancelledAvg, 2)],
      explanation: 'Aqui é fornecido o total de atividades canceladas durante todas as semanas para a obra, bem como a média de atividades canceladas por semana.',
      rowFill: '#e6f8e6',
      metricFill: '#d2f0d2',
    },
    {
      key: 'unplannedExecuted',
      labels: ['Total de atividades executadas não planejadas', 'Média de atividades executadas não planejadas por semana'],
      values: [formatNumberBr(unplannedExecutedTotal, 0), formatNumberBr(unplannedExecutedAvg, 2)],
      explanation: 'Aqui é fornecido o total de atividades executadas e não planejadas durante todas as semanas para a obra, bem como a média de atividades executadas e não planejadas por semana.',
      rowFill: '#f8dfe1',
      metricFill: '#f3c5ca',
    },
  ];

  const drawMetricAnalysisRow = (row) => {
    const boxH = 72;
    ensureSpace(boxH + 8);
    const rowFill = String(row.rowFill || '#f4f9ff');
    const metricFill = String(row.metricFill || '#ffffff');
    drawRoundBox(margin, y, contentWidth, boxH, rowFill, COLORS.border, 7);
    const metricGap = 8;
    const count = Math.max(1, row.values.length);
    const metricW = (contentWidth - ((count + 1) * metricGap)) / count;
    for (let i = 0; i < count; i += 1) {
      const mx = margin + metricGap + (i * (metricW + metricGap));
      drawRoundBox(mx, y + 6, metricW, 28, metricFill, COLORS.border, 6);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(6.8)
        .text(String(row.labels[i] || ''), mx + 4, y + 10, {
          width: metricW - 8,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12.4)
        .text(String(row.values[i] || ''), mx + 4, y + 20, {
          width: metricW - 8,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
    }
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
      .text(String(row.explanation || ''), margin + 10, y + 42, {
        width: contentWidth - 20,
        align: 'justify',
        lineBreak: true,
      });
    y += boxH + 8;
  };

  metricRows.forEach((row) => drawMetricAnalysisRow(row));

  const pieItems = [
    { key: 'executedPlanned', label: 'Planejadas e executadas', value: Number(executedPlannedTotal || 0), color: '#7ccfa4' },
    { key: 'started', label: 'Iniciadas', value: Number(startedTotal || 0), color: '#9edebc' },
    { key: 'notStarted', label: 'Não iniciadas', value: Number(notStartedTotal || 0), color: '#bee9d2' },
    { key: 'cancelled', label: 'Canceladas', value: Number(cancelledTotal || 0), color: '#d8f2e4' },
    { key: 'unplannedExecuted', label: 'Executadas não planejadas', value: Number(unplannedExecutedTotal || 0), color: '#d14b52' },
  ];
  const pieTotal = pieItems.reduce((acc, item) => acc + Number(item.value || 0), 0);
  const piePlannedTotal = pieItems
    .filter((item) => item.key !== 'unplannedExecuted')
    .reduce((acc, item) => acc + Number(item.value || 0), 0);
  const pieUnplannedTotal = Number(unplannedExecutedTotal || 0);

  const plannedDistributionTotals = {
    planned: Number(data.plannedDistribution?.planned || 0),
    rework: Number(data.plannedDistribution?.rework || 0),
    reserve: Number(data.plannedDistribution?.reserve || 0),
    pending: Number(data.plannedDistribution?.pending || 0),
  };
  const plannedDistributionBase = Number(data.plannedDistribution?.base || 0)
    || (Number(plannedDistributionTotals.planned || 0)
      + Number(plannedDistributionTotals.rework || 0)
      + Number(plannedDistributionTotals.reserve || 0)
      + Number(plannedDistributionTotals.pending || 0));
  const plannedDistributionRows = [
    {
      label: 'Total de atividades planejadas',
      total: Number(plannedDistributionTotals.planned || 0),
      pct: plannedDistributionBase ? Number(((Number(plannedDistributionTotals.planned || 0) / plannedDistributionBase) * 100).toFixed(2)) : 0,
      fill: '#dff4df',
    },
    {
      label: 'Total de atividades de retrabalho',
      total: Number(plannedDistributionTotals.rework || 0),
      pct: plannedDistributionBase ? Number(((Number(plannedDistributionTotals.rework || 0) / plannedDistributionBase) * 100).toFixed(2)) : 0,
      fill: '#e8f8e8',
    },
    {
      label: 'Total de atividades reservas',
      total: Number(plannedDistributionTotals.reserve || 0),
      pct: plannedDistributionBase ? Number(((Number(plannedDistributionTotals.reserve || 0) / plannedDistributionBase) * 100).toFixed(2)) : 0,
      fill: '#eefaf0',
    },
    {
      label: 'Total de atividades pendentes',
      total: Number(plannedDistributionTotals.pending || 0),
      pct: plannedDistributionBase ? Number(((Number(plannedDistributionTotals.pending || 0) / plannedDistributionBase) * 100).toFixed(2)) : 0,
      fill: '#f4fcf6',
    },
  ];

  ensureSpace(286);
  drawRoundBox(margin, y, contentWidth, 278, '#f7fbff', COLORS.border, 8);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
    .text('DISTRIBUIÇÃO DE ATIVIDADES', margin + 8, y + 8, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });

  const pieCenterX = margin + 150;
  const pieCenterY = y + 102;
  const pieRadius = 70;
  let angle = -Math.PI / 2;
  pieItems.forEach((item) => {
    const value = Number(item.value || 0);
    const pct = pieTotal ? Number(((value / pieTotal) * 100).toFixed(2)) : 0;
    const sweep = pieTotal ? ((value / pieTotal) * Math.PI * 2) : 0;
    const nextAngle = angle + sweep;
    if (sweep > 0) {
      doc.save()
        .fillColor(item.color)
        .strokeColor('#ffffff')
        .lineWidth(1)
        .moveTo(pieCenterX, pieCenterY)
        .arc(pieCenterX, pieCenterY, pieRadius, angle, nextAngle)
        .lineTo(pieCenterX, pieCenterY)
        .fillAndStroke()
        .restore();
    }
    const mid = angle + (sweep / 2);
    const labelRadius = pct < 6 ? (pieRadius * 0.8) : (pieRadius * 0.62);
    const lx = pieCenterX + (Math.cos(mid) * labelRadius);
    const ly = pieCenterY + (Math.sin(mid) * labelRadius);
    const label = `${formatPercentBr(pct, 1)}\n(${formatNumberBr(value, 0)})`;
    doc.fillColor('#1f2f3d').font('Helvetica-Bold').fontSize(7.4)
      .text(label, lx - 18, ly - 9, {
        width: 36,
        align: 'center',
        lineBreak: true,
      });
    angle = nextAngle;
  });

  const legendX = margin + 258;
  let legendY = y + 34;
  pieItems.forEach((item) => {
    const value = Number(item.value || 0);
    const pct = pieTotal ? Number(((value / pieTotal) * 100).toFixed(2)) : 0;
    doc.save().fillColor(item.color).roundedRect(legendX, legendY + 2, 10, 10, 2).fill().restore();
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.6)
      .text(`${item.label}: ${formatNumberBr(value, 0)} (${formatPercentBr(pct, 2)})`, legendX + 14, legendY + 2, {
        width: contentWidth - (legendX - margin) - 18,
        lineBreak: false,
        ellipsis: true,
      });
    legendY += 16;
  });

  const resumeY = y + 206;
  drawRoundBox(margin + 8, resumeY, contentWidth - 16, 62, '#eef6ff', COLORS.border, 6);
  const summaryLines = [
    `Total de atividades: ${formatNumberBr(pieTotal, 0)}`,
    `Total de atividades planejadas: ${formatNumberBr(piePlannedTotal, 0)}`,
    `Total de atividades não planejadas: ${formatNumberBr(pieUnplannedTotal, 0)}`,
  ];
  const summaryLineGap = 16;
  const summaryStartY = resumeY + Math.max(4, Math.floor((62 - ((summaryLines.length - 1) * summaryLineGap + 10)) / 2));
  summaryLines.forEach((line, idx) => {
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.7)
      .text(line, margin + 16, summaryStartY + (idx * summaryLineGap), {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
  });
  y += 286;

  ensureSpace(178);
  drawRoundBox(margin, y, contentWidth, 170, '#f7fbff', COLORS.border, 8);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
    .text('DISTRIBUIÇÃO DE ATIVIDADES PLANEJADAS', margin + 8, y + 8, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  const distHeaderY = y + 30;
  const distTableX = margin + 8;
  const distTableW = contentWidth - 16;
  const distLabelW = distTableW * 0.50;
  const distTotalW = distTableW * 0.16;
  const distPctW = distTableW - distLabelW - distTotalW;
  const distHeaderH = 30;
  const distRowH = 24;

  const drawDistCellText = (text, xCell, yCell, wCell, hCell, opts = {}) => {
    const cellText = String(text || '');
    const bold = opts.bold !== false;
    const lineBreak = opts.lineBreak === true;
    const fontSize = Number(opts.fontSize || 7.2);
    const innerPad = 3;
    const textWidth = Math.max(8, wCell - (innerPad * 2));
    doc.fillColor(COLORS.text).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    const textHeight = Math.min(
      hCell - 4,
      doc.heightOfString(cellText, {
        width: textWidth,
        align: 'center',
        lineBreak,
        ellipsis: true,
      }),
    );
    const textY = yCell + Math.max(2, ((hCell - textHeight) / 2));
    doc.text(cellText, xCell + innerPad, textY, {
      width: textWidth,
      align: 'center',
      lineBreak,
      ellipsis: true,
    });
  };

  drawRoundBox(distTableX, distHeaderY, distTableW, distHeaderH, '#e7f1ff', COLORS.border, 5);
  doc.save().strokeColor(COLORS.border).lineWidth(0.5)
    .moveTo(distTableX + distLabelW, distHeaderY)
    .lineTo(distTableX + distLabelW, distHeaderY + distHeaderH)
    .stroke()
    .moveTo(distTableX + distLabelW + distTotalW, distHeaderY)
    .lineTo(distTableX + distLabelW + distTotalW, distHeaderY + distHeaderH)
    .stroke()
    .restore();
  drawDistCellText('ÍNDICE', distTableX, distHeaderY, distLabelW, distHeaderH, { fontSize: 7.3, lineBreak: false });
  drawDistCellText('TOTAL', distTableX + distLabelW, distHeaderY, distTotalW, distHeaderH, { fontSize: 7.3, lineBreak: false });
  drawDistCellText('% SOBRE TOTAL DE ATIVIDADES NO PLANEJAMENTO', distTableX + distLabelW + distTotalW, distHeaderY, distPctW, distHeaderH, {
    fontSize: 6.8,
    lineBreak: true,
  });

  let distY = distHeaderY + distHeaderH + 4;
  plannedDistributionRows.forEach((row, idx) => {
    drawRoundBox(distTableX, distY, distTableW, distRowH, row.fill, COLORS.border, 5);
    doc.save().strokeColor(COLORS.border).lineWidth(0.5)
      .moveTo(distTableX + distLabelW, distY)
      .lineTo(distTableX + distLabelW, distY + distRowH)
      .stroke()
      .moveTo(distTableX + distLabelW + distTotalW, distY)
      .lineTo(distTableX + distLabelW + distTotalW, distY + distRowH)
      .stroke()
      .restore();
    drawDistCellText(row.label, distTableX, distY, distLabelW, distRowH, { fontSize: 7.4, lineBreak: false });
    drawDistCellText(formatNumberBr(row.total, 0), distTableX + distLabelW, distY, distTotalW, distRowH, { fontSize: 8.3, lineBreak: false });
    drawDistCellText(formatPercentBr(row.pct, 2), distTableX + distLabelW + distTotalW, distY, distPctW, distRowH, { fontSize: 8.3, lineBreak: false });
    distY += distRowH + 4;
  });
  y += 178;

  const monthlyGlobal = Array.isArray(data.monthly?.global) ? data.monthly.global : [];
  const monthlyLabels = monthlyGlobal.map((m) => m.monthLabel);
  const ppcTargetPct = Number(data.settings?.ppcTargetPct ?? data.work?.ppcTargetPct ?? 80);
  const monthlyExecPlanPct = monthlyGlobal.map((m) => Number(m.avgPpc || 0));
  const monthlyAvgGlobal = monthlyExecPlanPct.length
    ? Number((monthlyExecPlanPct.reduce((acc, value) => acc + Number(value || 0), 0) / monthlyExecPlanPct.length).toFixed(2))
    : 0;
  const monthlyMovingAvg = [];
  let monthlyMovingAcc = 0;
  monthlyExecPlanPct.forEach((value, idx) => {
    monthlyMovingAcc += Number(value || 0);
    monthlyMovingAvg.push(Number((monthlyMovingAcc / (idx + 1)).toFixed(2)));
  });

  const ppcPerfSectionH = 500;
  startMainSectionOnNewPage('2.2 - Desempenho mensal', ppcPerfSectionH + 8);
  drawRoundBox(margin, y, contentWidth, ppcPerfSectionH, '#f7fbff', COLORS.border, 7);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.9)
    .text('% Atendimento PPC por mês', margin + 8, y + 8, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });
  const monthlyPerfBars = [
    { label: 'PPC por mês', color: '#2f8f65', values: monthlyExecPlanPct },
  ];
  const monthlyPerfLines = [
    { label: 'Média histórica', color: '#1d4e89', values: monthlyExecPlanPct.map(() => monthlyAvgGlobal), hidePoints: true },
    { label: 'Média móvel acumulada', color: '#f59e0b', values: monthlyMovingAvg, hidePoints: true },
    { label: 'Meta PPC', color: '#b91c1c', values: monthlyExecPlanPct.map(() => ppcTargetPct), hidePoints: true },
  ];
  drawBarLineComboChart({
    x: margin + 4,
    yPos: y + 24,
    width: contentWidth - 8,
    height: 334,
    categories: monthlyLabels,
    barSeries: monthlyPerfBars,
    lineSeries: monthlyPerfLines,
    yLabel: '%',
    yMax: 100,
    valueFormatter: (value) => formatPercentBr(value || 0),
    maxLabelLines: 2,
    showBarValueLabels: false,
    showVerticalBottomBarLabels: true,
    extraBottomArea: 42,
    bottomValueLabelFontSize: 8.0,
    yTickFontSize: 7.4,
    yAxisLabelFontSize: 7.2,
    categoryFontSize: 7.2,
  });
  const monthlyLegendBottom = drawLegend(
    [...monthlyPerfBars, ...monthlyPerfLines],
    margin + 8,
    y + 376,
    contentWidth - 16,
    { fontSize: 7.9, rowH: 14, sw: 9 },
  );
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(9.0)
    .text('Cálculo do PPC mensal: considera apenas atividades planejadas executadas, iniciadas e não iniciadas. Atividades canceladas e atividades não planejadas e executadas não entram no cálculo do PPC. Atividades em status Reserva contam como planejadas apenas quando executadas.', margin + 10, monthlyLegendBottom + 6, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
    });
  y += ppcPerfSectionH + 8;

  const weeklyLabels = weeklyTrend.map((w) => `S${w.weekNumber}`);
  const weeklyExecPlanPct = weeklyTrend.map((w) => Number(w.ppc || 0));
  const weeklyAvgGlobal = weeklyExecPlanPct.length
    ? Number((weeklyExecPlanPct.reduce((acc, value) => acc + Number(value || 0), 0) / weeklyExecPlanPct.length).toFixed(2))
    : 0;
  const weeklyMovingAvg = [];
  let weeklyMovingAcc = 0;
  weeklyExecPlanPct.forEach((value, idx) => {
    weeklyMovingAcc += Number(value || 0);
    weeklyMovingAvg.push(Number((weeklyMovingAcc / (idx + 1)).toFixed(2)));
  });

  startMainSectionOnNewPage('2.3 - Desempenho semanal', ppcPerfSectionH + 8);
  drawRoundBox(margin, y, contentWidth, ppcPerfSectionH, '#f7fbff', COLORS.border, 7);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.9)
    .text('% Atendimento PPC por semana', margin + 8, y + 8, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });
  const weeklyPerfBars = [
    { label: 'PPC por semana', color: '#2f8f65', values: weeklyExecPlanPct },
  ];
  const weeklyPerfLines = [
    { label: 'Média histórica', color: '#1d4e89', values: weeklyExecPlanPct.map(() => weeklyAvgGlobal), hidePoints: true },
    { label: 'Média móvel acumulada', color: '#f59e0b', values: weeklyMovingAvg, hidePoints: true },
    { label: 'Meta PPC', color: '#b91c1c', values: weeklyExecPlanPct.map(() => ppcTargetPct), hidePoints: true },
  ];
  drawBarLineComboChart({
    x: margin + 4,
    yPos: y + 24,
    width: contentWidth - 8,
    height: 334,
    categories: weeklyLabels,
    barSeries: weeklyPerfBars,
    lineSeries: weeklyPerfLines,
    yLabel: '%',
    yMax: 100,
    valueFormatter: (value) => formatPercentBr(value || 0),
    maxLabelLines: 2,
    showBarValueLabels: false,
    showVerticalBottomBarLabels: true,
    extraBottomArea: 42,
    bottomValueLabelFontSize: 8.0,
    yTickFontSize: 7.4,
    yAxisLabelFontSize: 7.2,
    categoryFontSize: 7.2,
  });
  const weeklyLegendBottom = drawLegend(
    [...weeklyPerfBars, ...weeklyPerfLines],
    margin + 8,
    y + 376,
    contentWidth - 16,
    { fontSize: 7.9, rowH: 14, sw: 9 },
  );
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(9.0)
    .text('Cálculo do PPC semanal: considera apenas atividades planejadas executadas, iniciadas e não iniciadas. Atividades canceladas e atividades não planejadas e executadas não entram no cálculo do PPC. Atividades em status Reserva contam como planejadas apenas quando executadas.', margin + 10, weeklyLegendBottom + 6, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
    });
  y += ppcPerfSectionH + 8;

  const weeklyPlanningQualityPct = weeklyTrend.map((w) => Number(w.planningQualityPct || 0));
  const drawEvolutionTripleSection = ({
    title,
    categories,
    plannedValues,
    cancelledValues,
    unplannedExecutedValues,
    descriptionLines,
  }) => {
    doc.font('Helvetica').fontSize(9.6);
    const descText = descriptionLines.join('\n');
    const descTextHeight = Math.ceil(doc.heightOfString(descText, {
      width: contentWidth - 32,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.2,
    }));
    const descBoxH = Math.max(64, descTextHeight + 18);
    const topPad = 16;
    const bottomPad = 10;
    const chartGap = 12;
    const chartTitleBand = 14;
    const descGap = 10;
    const sectionH = 560;
    startMainSectionOnNewPage(title, sectionH + 6, { wrap: true, fontSize: 8.7 });
    drawRoundBox(margin, y, contentWidth, sectionH, '#f7fbff', COLORS.border, 7);

    const chartX = margin + 8;
    const chartW = contentWidth - 16;
    const chartAreaAvailable = sectionH - topPad - bottomPad - descGap - descBoxH - (chartGap * 2) - (chartTitleBand * 3);
    const chartH = Math.max(108, Math.floor(chartAreaAvailable / 3));
    const firstY = y + topPad + chartTitleBand;
    const secondY = firstY + chartH + chartGap + chartTitleBand;
    const thirdY = secondY + chartH + chartGap + chartTitleBand;

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.1)
      .text('Atividades planejadas', chartX, firstY - chartTitleBand, { width: chartW, align: 'center', lineBreak: false });
    drawGroupedBarChart({
      x: chartX,
      yPos: firstY,
      width: chartW,
      height: chartH,
      categories,
      series: [{ label: 'Atividades planejadas', color: '#2f8f65', values: plannedValues }],
      yLabel: 'Qtde',
      showValueLabels: false,
      valueFormatter: (value) => String(Number(value || 0)),
      maxLabelLines: 2,
      categoryFontSize: 7.0,
      yTickFontSize: 6.9,
      yAxisLabelFontSize: 6.8,
      barValueLabelFontSize: 7.0,
    });

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.1)
      .text('Atividades canceladas', chartX, secondY - chartTitleBand, { width: chartW, align: 'center', lineBreak: false });
    drawGroupedBarChart({
      x: chartX,
      yPos: secondY,
      width: chartW,
      height: chartH,
      categories,
      series: [{ label: 'Atividades canceladas', color: '#db5757', values: cancelledValues }],
      yLabel: 'Qtde',
      showValueLabels: true,
      valueFormatter: (value) => String(Number(value || 0)),
      maxLabelLines: 2,
      categoryFontSize: 7.0,
      yTickFontSize: 6.9,
      yAxisLabelFontSize: 6.8,
      barValueLabelFontSize: 7.0,
    });

    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.1)
      .text('Atividades executadas e não planejadas', chartX, thirdY - chartTitleBand, { width: chartW, align: 'center', lineBreak: false });
    drawGroupedBarChart({
      x: chartX,
      yPos: thirdY,
      width: chartW,
      height: chartH,
      categories,
      series: [{ label: 'Atividades executadas e não planejadas', color: '#2477c4', values: unplannedExecutedValues }],
      yLabel: 'Qtde',
      showValueLabels: true,
      valueFormatter: (value) => String(Number(value || 0)),
      maxLabelLines: 2,
      categoryFontSize: 7.0,
      yTickFontSize: 6.9,
      yAxisLabelFontSize: 6.8,
      barValueLabelFontSize: 7.0,
    });

    const descY = y + sectionH - bottomPad - descBoxH;
    drawRoundBox(margin + 8, descY, contentWidth - 16, descBoxH, '#eef8fb', COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9.6)
      .text(descText, margin + 16, descY + 10, {
        width: contentWidth - 32,
        align: 'justify',
        lineBreak: true,
        lineGap: 1.2,
      });

    y += sectionH + 8;
  };

  drawEvolutionTripleSection({
    title: '2.4 - Evolução mensal - planejadas, canceladas, não executadas e não planejadas executadas',
    categories: monthlyLabels,
    plannedValues: monthlyGlobal.map((m) => Number(m.planned || 0)),
    cancelledValues: monthlyGlobal.map((m) => Number(m.cancelled || 0)),
    unplannedExecutedValues: monthlyGlobal.map((m) => Number(m.unplannedExecuted || 0)),
    descriptionLines: [
      'Atividades planejadas de acordo com o fechamento da programação das semanas.',
      'Atividades canceladas de acordo com o fechamento do feedback das semanas.',
      'Atividades executadas e não planejadas de acordo com o fechamento do feedback das semanas.',
    ],
  });

  drawEvolutionTripleSection({
    title: '2.5 - Evolução semanal - planejadas, canceladas, não executadas e não planejadas executadas',
    categories: weeklyLabels,
    plannedValues: weeklyTrend.map((w) => Number(w.planned || 0)),
    cancelledValues: weeklyTrend.map((w) => Number(w.cancelled || 0)),
    unplannedExecutedValues: weeklyTrend.map((w) => Number(w.unplannedExecuted || 0)),
    descriptionLines: [
      'Atividades planejadas de acordo com o fechamento da programação da semana.',
      'Atividades canceladas de acordo com o fechamento do feedback da semana.',
      'Atividades executadas e não planejadas de acordo com o fechamento do feedback da semana.',
    ],
  });

  const contractorPerfExplanation = 'A performance é medida como: 100% - % de não cumprimento por causa específica do empreiteiro. Assim o empreiteiro não é penalizado por causas que não dependem dele. São consideradas apenas as atividades que foram planejadas na semana anterior. Atividades executadas e não planejadas não são contabilizadas. Atividades em status Reserva: se executadas, contam como atividade planejada e executada; se não executadas, não entram como atividade planejada.';
  const drawContractorPerformanceSection = ({
    sectionTitle,
    boxTitlePrefix,
    rows,
    toCategoryLabel,
    sortRows,
  }) => {
    const grouped = new Map();
    (Array.isArray(rows) ? rows : []).forEach((item) => {
      const contractor = String(item.contractor || 'SEM_EMPREITEIRO').trim() || 'SEM_EMPREITEIRO';
      if (!grouped.has(contractor)) grouped.set(contractor, []);
      grouped.get(contractor).push(item);
    });
    const contractors = [...grouped.keys()].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    startMainSectionOnNewPage(sectionTitle, 80, { wrap: true, fontSize: 8.8 });
    if (!contractors.length) {
      drawRoundBox(margin, y, contentWidth, 40, '#f7fbff', COLORS.border, 6);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.6)
        .text('Sem dados de performance de empreiteiros para o período.', margin + 8, y + 14, {
          width: contentWidth - 16,
          align: 'center',
          lineBreak: false,
        });
      y += 48;
      return;
    }

    contractors.forEach((contractor) => {
      const contractorRows = grouped.get(contractor) || [];
      const sortedRows = typeof sortRows === 'function'
        ? contractorRows.slice().sort(sortRows)
        : contractorRows.slice();
      const categories = sortedRows.map((row) => toCategoryLabel(row));
      const values = sortedRows.map((row) => Number(row.performancePct || 0));

      doc.font('Helvetica').fontSize(8.8);
      const descHeight = Math.ceil(doc.heightOfString(contractorPerfExplanation, {
        width: contentWidth - 32,
        align: 'justify',
        lineBreak: true,
        lineGap: 1.2,
      }));
      const descBoxH = Math.max(66, descHeight + 16);
      const boxH = 266 + descBoxH;

      if (y + boxH > pageBottom() - 16) {
        addPage();
        drawSectionTitle(sectionTitle, 0, { wrap: true, fontSize: 8.8, registerInToc: false });
      }

      drawRoundBox(margin, y, contentWidth, boxH, '#f7fbff', COLORS.border, 7);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.2)
        .text(`${boxTitlePrefix} ${contractor}`.toUpperCase(), margin + 8, y + 10, {
          width: contentWidth - 16,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      drawGroupedBarChart({
        x: margin + 8,
        yPos: y + 26,
        width: contentWidth - 16,
        height: 230,
        categories,
        series: [{ label: 'Performance (%)', color: '#2f8f65', values }],
        yLabel: '%',
        showValueLabels: true,
        valueFormatter: (value) => formatPercentBr(value || 0),
        maxLabelLines: 2,
        yMaxOverride: 100,
        categoryFontSize: 7.0,
        yTickFontSize: 6.8,
        yAxisLabelFontSize: 6.8,
        barValueLabelFontSize: 6.8,
      });
      const descY = y + 266;
      drawRoundBox(margin + 8, descY, contentWidth - 16, descBoxH, '#eef8fb', COLORS.border, 6);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.8)
        .text(contractorPerfExplanation, margin + 16, descY + 8, {
          width: contentWidth - 32,
          align: 'justify',
          lineBreak: true,
          lineGap: 1.2,
        });

      y += boxH + 10;
    });
  };

  drawContractorPerformanceSection({
    sectionTitle: '2.6 - Desempenho mensal por empreiteiro',
    boxTitlePrefix: 'DESEMPENHO MENSAL',
    rows: data.contractorPerformance?.monthly || [],
    toCategoryLabel: (row) => String(row.monthLabel || ''),
    sortRows: (a, b) => String(a.monthKey || '').localeCompare(String(b.monthKey || '')),
  });

  drawContractorPerformanceSection({
    sectionTitle: '2.7 - Desempenho semanal por empreiteiro',
    boxTitlePrefix: 'DESEMPENHO SEMANAL',
    rows: data.contractorPerformance?.weekly || [],
    toCategoryLabel: (row) => `S${Number(row.weekNumber || 0)}`,
    sortRows: (a, b) => Number(a.weekNumber || 0) - Number(b.weekNumber || 0),
  });

  startMainSectionOnNewPage('2.8 - Ranking de empreiteiros', 88);
  const rankingRows = Array.isArray(data.contractorPerformance?.ranking) ? data.contractorPerformance.ranking : [];
  drawSimpleTable(
    [
      { title: 'Posição', key: 'rank', width: 68 },
      { title: 'Empreiteiro', key: 'contractor', width: 250 },
      { title: 'Semanas ativas', key: 'weeksActive', width: 120 },
      { title: 'Performance %', key: 'performancePct', width: contentWidth - (68 + 250 + 120) },
    ],
    rankingRows.map((item, idx) => ({
      rank: String(idx + 1),
      contractor: item.contractor,
      weeksActive: String(Number(item.weeksActive || 0)),
      performancePct: formatPercentBr(item.performancePct || 0),
    })),
    { title: 'Ranking de empreiteiros', repeatTitle: 'Ranking de empreiteiros' },
  );
  y += 0;
  const rankingExplanation = 'A performance é medida como: 100% - % de não cumprimento por causa específica do empreiteiro. Assim o empreiteiro não é penalizado por causas que não dependem dele.\nSão consideradas apenas as atividades que foram planejadas na semana anterior.\nAtividades executadas e não planejadas não são contabilizadas.\nAtividades em status Reserva: se executadas, contam como atividade planejada e executada; se não executadas, não entram como atividade planejada.';
  doc.font('Helvetica').fontSize(8.7);
  const rankingTextH = Math.max(58, Math.ceil(doc.heightOfString(rankingExplanation, {
    width: contentWidth - 20,
    align: 'justify',
    lineBreak: true,
    lineGap: 1.2,
  }) + 14));
  ensureSpace(rankingTextH + 6);
  drawRoundBox(margin, y, contentWidth, rankingTextH, '#f4f9ff', COLORS.border, 3);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.7)
    .text(rankingExplanation, margin + 10, y + 8, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.2,
    });
  y += rankingTextH + 8;

  startMainSectionOnNewPage('2.9 - PPC por tipo de mão de obra', 44);
  drawSimpleTable(
    [
      { title: 'Ranking', key: 'rank', width: 44, wrapTitle: true },
      { title: 'Tipo de\nmão de obra', key: 'laborType', width: 128, wrapTitle: true },
      { title: 'Atividades\nplanejadas', key: 'planned', width: 66, wrapTitle: true },
      { title: 'Planejadas e\nexecutadas', key: 'executedPlanned', width: 78, wrapTitle: true },
      { title: 'Canceladas', key: 'cancelled', width: 56, wrapTitle: true },
      { title: 'Executadas e\nnão planejadas', key: 'unplannedExecuted', width: 78, wrapTitle: true },
      { title: '% Ativ. executadas/\nAtiv. planejadas', key: 'executionPct', width: contentWidth - (44 + 128 + 66 + 78 + 56 + 78), wrapTitle: true },
    ],
    (data.laborTypes || []).map((item, idx) => ({
      rank: String(idx + 1),
      laborType: item.laborType,
      planned: String(Number(item.planned || 0)),
      executedPlanned: String(Number(item.executedPlanned || 0)),
      cancelled: String(Number(item.cancelled || 0)),
      unplannedExecuted: String(Number(item.unplannedExecuted || 0)),
      executionPct: formatPercentBr(item.executionPct || 0),
    })),
    {
      title: 'PPC por tipo de mão de obra',
      repeatTitle: 'PPC por tipo de mão de obra',
      headerH: 30,
      rowH: 21,
    },
  );
  y += 0;
  const laborTypeExplanation = 'Percentual calculado por tipo de mão de obra: Atividades planejadas e executadas / Atividades planejadas. As atividades Executadas e Não Planejadas não alteram este percentual. As atividades Canceladas afetam o desempenho por permanecerem na base planejada sem execução. Regra de Reserva: se executada, conta como planejada e executada; se não executada, não entra como planejada.';
  doc.font('Helvetica').fontSize(8.7);
  const laborTypeTextH = Math.max(44, Math.ceil(doc.heightOfString(laborTypeExplanation, {
    width: contentWidth - 20,
    align: 'justify',
    lineBreak: true,
    lineGap: 1.2,
  }) + 14));
  ensureSpace(laborTypeTextH + 8);
  drawRoundBox(margin, y, contentWidth, laborTypeTextH, '#f4f9ff', COLORS.border, 3);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.7)
    .text(laborTypeExplanation, margin + 10, y + 8, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.2,
    });
  y += laborTypeTextH + 8;

  startMainSectionOnNewPage('2.10 - Causas de não cumprimento de atividades', 210);
  const causeImpactRowsHist = Array.isArray(data.causeImpact?.rows) ? data.causeImpact.rows : [];
  const categoryRowsHist = causeImpactRowsHist
    .filter((row) => row?.type === 'CATEGORY' && Number(row.count || 0) > 0)
    .map((row) => ({
      category: String(row.category || 'Sem grupo'),
      count: Number(row.count || 0),
    }));
  const totalCausesHist = categoryRowsHist.reduce((sum, row) => sum + Number(row.count || 0), 0);

  const drawCauseBarBox = ({
    title,
    labels,
    values,
    pctDenominator,
    footerText,
    barColor,
  }) => {
    const safeLabels = Array.isArray(labels) ? labels : [];
    const safeValues = Array.isArray(values) ? values : [];
    if (!safeLabels.length || !safeValues.length) return;
    const footerH = 34;
    const chartH = 172;
    const boxH = 34 + chartH + footerH;
    ensureSpace(boxH + 8);
    drawRoundBox(margin, y, contentWidth, boxH, '#f7fbff', COLORS.border, 7);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.0)
      .text(String(title || ''), margin + 8, y + 10, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    drawGroupedBarChart({
      x: margin + 4,
      yPos: y + 30,
      width: contentWidth - 8,
      height: chartH,
      categories: safeLabels,
      series: [{ label: 'Número de causas', color: String(barColor || '#2f8f65'), values: safeValues }],
      yLabel: 'Qtde',
      showValueLabels: true,
      valueFormatter: (value) => String(Number(value || 0)),
      maxLabelLines: 3,
      categoryFontSize: 6.8,
      yTickFontSize: 6.6,
      yAxisLabelFontSize: 6.6,
      barValueLabelFontSize: 6.8,
      showBubbleLabels: true,
      bubbleLabelFormatter: (value) => {
        const pct = Number(pctDenominator || 0) > 0
          ? ((Number(value || 0) / Number(pctDenominator || 0)) * 100)
          : 0;
        return formatPercentBr(pct, 1);
      },
      bubbleLabelFontSize: 6.2,
    });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
      .text(String(footerText || ''), margin + 10, y + 30 + chartH + 8, {
        width: contentWidth - 20,
        align: 'justify',
        lineBreak: true,
        lineGap: 1.1,
      });
    y += boxH + 8;
  };

  if (!categoryRowsHist.length) {
    drawRoundBox(margin, y, contentWidth, 44, '#f7fbff', COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.6)
      .text('Sem causas registradas para não cumprimento no período analisado.', margin + 8, y + 15, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    y += 52;
  } else {
    drawCauseBarBox({
      title: 'Causas por totalizadora',
      labels: categoryRowsHist.map((row) => row.category.toUpperCase()),
      values: categoryRowsHist.map((row) => Number(row.count || 0)),
      pctDenominator: totalCausesHist,
      footerText: `Este gráfico apresenta o número total de causas por totalizadora. Total de causas no histórico: ${formatNumberBr(totalCausesHist, 0)}.`,
      barColor: '#2f8f65',
    });
  }

  const weeklyCauseRows = Array.isArray(data.weeklyTrend)
    ? data.weeklyTrend
    : (Array.isArray(data.weekly?.global) ? data.weekly.global : []);
  if (weeklyCauseRows.length) {
    ensureSpace(260);
    drawRoundBox(margin, y, contentWidth, 252, '#f7fbff', COLORS.border, 7);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.0)
      .text('Causas e atividades canceladas por semana', margin + 8, y + 10, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    const weeklyCauseSeries = [
      {
        label: 'Causas de não cumprimento',
        color: '#2f8f65',
        values: weeklyCauseRows.map((row) => Number(row.causeCount || 0)),
      },
      {
        label: 'Atividades canceladas',
        color: '#db5757',
        values: weeklyCauseRows.map((row) => Number(row.cancelled || 0)),
      },
    ];
    const weeklyCauseStackMax = weeklyCauseRows.reduce((max, row) => (
      Math.max(
        max,
        Number(row.causeCount || 0) + Number(row.cancelled || 0),
      )
    ), 0);
    drawGroupedBarChart({
      x: margin + 4,
      yPos: y + 30,
      width: contentWidth - 8,
      height: 182,
      categories: weeklyCauseRows.map((row) => `S${Number(row.weekNumber || 0)}`),
      series: weeklyCauseSeries,
      yLabel: 'Qtde',
      showValueLabels: false,
      valueFormatter: (value) => String(Number(value || 0)),
      maxLabelLines: 2,
      categoryFontSize: 6.8,
      yTickFontSize: 6.6,
      yAxisLabelFontSize: 6.6,
      barValueLabelFontSize: 6.8,
      stackedBars: true,
      yMaxOverride: Math.max(1, weeklyCauseStackMax),
      showBubbleLabels: true,
      bubbleLabelFormatter: (value) => (Number(value || 0) > 0 ? String(Number(value || 0)) : ''),
      bubbleLabelFontSize: 6.0,
    });
    drawLegend(weeklyCauseSeries, margin + 10, y + 214, contentWidth - 20);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
      .text('Este é o total de causas de não cumprimento do PPC.', margin + 10, y + 233, {
        width: contentWidth - 20,
        align: 'center',
        lineBreak: false,
      });
    y += 260;
  } else {
    ensureSpace(90);
    drawRoundBox(margin, y, contentWidth, 82, '#f7fbff', COLORS.border, 7);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.0)
      .text('Causas de não cumprimento por semana', margin + 8, y + 10, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.4)
      .text('Sem dados semanais para exibição.', margin + 8, y + 36, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
      .text('Este é o total de causas de não cumprimento do PPC.', margin + 8, y + 56, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    y += 90;
  }

  const impactColumnsV2 = [
    { title: 'Causa', key: 'cause', width: contentWidth - (88 + 86) },
    { title: 'Ocorrências', key: 'count', width: 88 },
    { title: '%', key: 'pct', width: 86 },
  ];
  const impactHeaderH2 = 20;
  const impactRowH2 = 20;
  const drawImpactHeaderV2 = () => {
    drawRoundBox(margin, y, contentWidth, impactHeaderH2, COLORS.header, COLORS.border, 4);
    let x = margin;
    impactColumnsV2.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, y).lineTo(x, y + impactHeaderH2).stroke().restore();
      }
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.2)
        .text(String(col.title || ''), x + 2, y + 6, {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    y += impactHeaderH2;
  };

  const impactRowsForTable = causeImpactRowsHist.filter((row) => (
    row?.type === 'CATEGORY' || (row?.type === 'CAUSE' && Number(row.categoryCount || 0) > 0)
  ));
  ensureSpace(impactHeaderH2 + impactRowH2 + 2);
  drawImpactHeaderV2();
  let groupIndex = -1;
  let childRowIdx = 0;
  impactRowsForTable.forEach((row) => {
    if (y + impactRowH2 > pageBottom() - 16) {
      addPage();
      drawSectionTitle('2.10 - Causas de não cumprimento de atividades', 0, { registerInToc: false });
      drawImpactHeaderV2();
    }
    if (row.type === 'CATEGORY') {
      groupIndex += 1;
      childRowIdx = 0;
    } else {
      childRowIdx += 1;
    }

    const isBlueGroup = groupIndex % 2 === 0;
    const categoryFill = isBlueGroup ? '#dcecff' : '#d9f5e1';
    const childFillA = isBlueGroup ? '#edf5ff' : '#e9f9ee';
    const childFillB = isBlueGroup ? '#f5f9ff' : '#f2fcf5';
    const fill = row.type === 'CATEGORY'
      ? categoryFill
      : (childRowIdx % 2 === 0 ? childFillA : childFillB);

    drawRoundBox(margin, y, contentWidth, impactRowH2, fill, COLORS.border, 3);
    let x = margin;
    const values = [
      row.type === 'CATEGORY'
        ? String(row.category || '').toUpperCase()
        : String(row.cause || ''),
      String(Number(row.count || 0)),
      formatPercentBr(row.pct || 0),
    ];
    impactColumnsV2.forEach((col, colIdx) => {
      if (colIdx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(x, y).lineTo(x, y + impactRowH2).stroke().restore();
      }
      doc.fillColor(COLORS.text).font(row.type === 'CATEGORY' && colIdx === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.0)
        .text(String(values[colIdx] || ''), x + 2, y + 6, {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    y += impactRowH2;
  });
  y += 8;

  startMainSectionOnNewPage('2.11 - Qualidade no planejamento', 460);
  const preVsPlanQuality = data.planningQuality?.preVsPlan || {};
  const preVsPlanTotalChanges = Number(preVsPlanQuality.totalChanges || 0);
  const preVsPlanTotalProgrammed = Number(preVsPlanQuality.totalProgrammedActivities || 0);
  const preVsPlanQualityPctHist = Number(preVsPlanQuality.qualityPct || 0);
  const preVsPlanWeekly = Array.isArray(preVsPlanQuality.weekly) ? preVsPlanQuality.weekly : [];

  drawRoundBox(margin, y, contentWidth, 118, '#f7fbff', COLORS.border, 7);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.2)
    .text('PRÉ E PROGRAMAÇÃO DA SEMANA', margin + 8, y + 10, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  const pqCardGap = 8;
  const pqCardW = (contentWidth - 16 - (pqCardGap * 2)) / 3;
  const pqCardY = y + 30;
  [
    {
      label: 'Total de alterações',
      value: String(preVsPlanTotalChanges),
      bg: '#f1f7ff',
      fg: '#244e83',
    },
    {
      label: 'Total de atividades planejadas',
      value: String(preVsPlanTotalProgrammed),
      bg: '#f6fbf7',
      fg: '#1f6f45',
    },
    {
      label: 'Qualidade da Programação',
      value: formatPercentBr(preVsPlanQualityPctHist, 2),
      bg: '#eef8fb',
      fg: '#2f5e77',
    },
  ].forEach((item, idx) => {
    const cx = margin + 8 + (idx * (pqCardW + pqCardGap));
    drawRoundBox(cx, pqCardY, pqCardW, 76, item.bg, COLORS.border, 7);
    doc.fillColor(item.fg).font('Helvetica-Bold').fontSize(8.0)
      .text(item.label, cx + 6, pqCardY + 9, {
        width: pqCardW - 12,
        align: 'center',
        lineBreak: true,
      });
    doc.font('Helvetica-Bold').fontSize(13.2)
      .text(item.value, cx + 6, pqCardY + 47, {
        width: pqCardW - 12,
        align: 'center',
        lineBreak: false,
      });
  });
  y += 124;

  drawRoundBox(margin, y, contentWidth, 214, '#f7fbff', COLORS.border, 7);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.8)
    .text('Evolução semanal da Qualidade da Programação (%)', margin + 8, y + 10, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  drawGroupedBarChart({
    x: margin + 4,
    yPos: y + 24,
    width: contentWidth - 8,
    height: 142,
    categories: preVsPlanWeekly.map((row) => `S${Number(row.weekNumber || 0)}`),
    series: [{ label: 'Qualidade da Programação (%)', color: '#2563eb', values: preVsPlanWeekly.map((row) => Number(row.qualityPct || 0)) }],
    yLabel: '%',
    showValueLabels: true,
    valueFormatter: (value) => formatPercentBr(value || 0),
    maxLabelLines: 2,
    yMaxOverride: 100,
    categoryFontSize: 6.8,
    yTickFontSize: 6.6,
    yAxisLabelFontSize: 6.6,
    barValueLabelFontSize: 6.8,
  });
  const pqText = 'Método de cálculo: Qualidade da Programação = 100% - (alterações / total de atividades programadas da semana x 100). Alterações consideradas nesta seção: atividades adicionadas, removidas/canceladas e atividades com mudanças relevantes entre a Pré-programação e a Programação final da semana.';
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
    .text(pqText, margin + 10, y + 174, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.1,
    });
  y += 222;

  const planVsExecQuality = data.planningQuality?.planVsExecution || {};
  const planVsExecTotalChanges = Number(planVsExecQuality.totalChanges || 0);
  const planVsExecTotalProgrammed = Number(planVsExecQuality.totalProgrammedActivities || 0);
  const planVsExecQualityPct = Number(planVsExecQuality.qualityPct || 0);
  const planVsExecWeekly = Array.isArray(planVsExecQuality.weekly) ? planVsExecQuality.weekly : [];

  ensureSpace(330);
  drawRoundBox(margin, y, contentWidth, 118, '#f7fbff', COLORS.border, 7);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.2)
    .text('PROGRAMAÇÃO DA SEMANA E FINALIZAÇÃO DA SEMANA', margin + 8, y + 10, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  const peCardGap = 8;
  const peCardW = (contentWidth - 16 - (peCardGap * 2)) / 3;
  const peCardY = y + 30;
  [
    {
      label: 'Total de alterações',
      value: String(planVsExecTotalChanges),
      bg: '#f1f7ff',
      fg: '#244e83',
    },
    {
      label: 'Total de atividades',
      value: String(planVsExecTotalProgrammed),
      bg: '#f6fbf7',
      fg: '#1f6f45',
    },
    {
      label: 'Qualidade da Programação',
      value: formatPercentBr(planVsExecQualityPct, 2),
      bg: '#eef8fb',
      fg: '#2f5e77',
    },
  ].forEach((item, idx) => {
    const cx = margin + 8 + (idx * (peCardW + peCardGap));
    drawRoundBox(cx, peCardY, peCardW, 76, item.bg, COLORS.border, 7);
    doc.fillColor(item.fg).font('Helvetica-Bold').fontSize(8.0)
      .text(item.label, cx + 6, peCardY + 9, {
        width: peCardW - 12,
        align: 'center',
        lineBreak: true,
      });
    doc.font('Helvetica-Bold').fontSize(13.2)
      .text(item.value, cx + 6, peCardY + 47, {
        width: peCardW - 12,
        align: 'center',
        lineBreak: false,
      });
  });
  y += 124;

  drawRoundBox(margin, y, contentWidth, 214, '#f7fbff', COLORS.border, 7);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.8)
    .text('Evolução semanal da Qualidade da Programação - Finalização (%)', margin + 8, y + 10, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  drawGroupedBarChart({
    x: margin + 4,
    yPos: y + 24,
    width: contentWidth - 8,
    height: 142,
    categories: planVsExecWeekly.map((row) => `S${Number(row.weekNumber || 0)}`),
    series: [{ label: 'Qualidade da Programação (%)', color: '#2f8f65', values: planVsExecWeekly.map((row) => Number(row.qualityPct || 0)) }],
    yLabel: '%',
    showValueLabels: true,
    valueFormatter: (value) => formatPercentBr(value || 0),
    maxLabelLines: 2,
    yMaxOverride: 100,
    categoryFontSize: 6.8,
    yTickFontSize: 6.6,
    yAxisLabelFontSize: 6.6,
    barValueLabelFontSize: 6.8,
  });
  const peText = 'Método de cálculo: Qualidade da Programação = 100% - (alterações / total de atividades programadas da semana x 100). Alterações consideradas nesta seção: atividades executadas e não planejadas e cancelamento de atividades planejadas na semana.';
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
    .text(peText, margin + 10, y + 174, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.1,
    });
  y += 222;

  startMainSectionOnNewPage('2.12 - Confiabilidade do planejamento por empreiteiro', 62);
  drawSimpleTable(
    [
      { title: 'Ranking', key: 'rank', width: 54 },
      { title: 'Empreiteiro', key: 'contractor', width: 176 },
      { title: 'Semanas ativas\ndo empreiteiro', key: 'weeksActive', width: 92, wrapTitle: true },
      { title: 'Semanas com\n% Atividades\nExecutadas >= Meta', key: 'weeksAboveTarget', width: 118, wrapTitle: true },
      { title: 'Confiabilidade %', key: 'reliabilityPct', width: contentWidth - (54 + 176 + 92 + 118), wrapTitle: true },
    ],
    (data.contractorReliability || []).map((item, idx) => ({
      rank: String(idx + 1),
      contractor: item.contractor,
      weeksActive: String(item.weeksActive),
      weeksAboveTarget: String(item.weeksAboveTarget),
      reliabilityPct: formatPercentBr(item.reliabilityPct || 0),
    })),
    {
      title: 'Confiabilidade do planejamento por empreiteiro',
      repeatTitle: 'Confiabilidade do planejamento por empreiteiro',
      headerH: 34,
      rowH: 22,
    },
  );
  const reliabilityText = `A confiabilidade é medida como (Semanas com % Atividades Executadas >= Meta / Semanas ativas do empreiteiro). Meta considerada: ${formatPercentBr(data.settings?.ppcTargetPct ?? 80)}.`;
  doc.font('Helvetica').fontSize(8.5);
  const reliabilityTextH = Math.max(30, Math.ceil(doc.heightOfString(reliabilityText, {
    width: contentWidth - 20,
    align: 'justify',
    lineBreak: true,
    lineGap: 1.2,
  }) + 12));
  ensureSpace(reliabilityTextH + 4);
  drawRoundBox(margin, y, contentWidth, reliabilityTextH, '#f4f9ff', COLORS.border, 3);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.5)
    .text(reliabilityText, margin + 10, y + 7, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.2,
    });
  y += reliabilityTextH + 8;

  startMainSectionOnNewPage('2.13 - Visão mensal - global', 236);
  const monthlyRows = Array.isArray(data.monthly?.global) ? data.monthly.global : [];
  const monthlyColW = contentWidth / 8;
  const monthlyTableRows = monthlyRows.map((item) => ({
    monthLabel: item.monthLabel,
    weeks: Number(item.weeks || 0),
    planned: Number(item.planned || 0),
    executed: Number(item.executed || 0),
    cancelled: Number(item.cancelled || 0),
    started: Number(item.started || 0),
    notStarted: Number(item.notStarted || 0),
    unplannedExecuted: Number(item.unplannedExecuted || 0),
  }));
  const monthlyTotals = monthlyTableRows.reduce((acc, item) => ({
    weeks: acc.weeks + Number(item.weeks || 0),
    planned: acc.planned + Number(item.planned || 0),
    executed: acc.executed + Number(item.executed || 0),
    cancelled: acc.cancelled + Number(item.cancelled || 0),
    started: acc.started + Number(item.started || 0),
    notStarted: acc.notStarted + Number(item.notStarted || 0),
    unplannedExecuted: acc.unplannedExecuted + Number(item.unplannedExecuted || 0),
  }), {
    weeks: 0, planned: 0, executed: 0, cancelled: 0, started: 0, notStarted: 0, unplannedExecuted: 0,
  });
  drawSimpleTable(
    [
      { title: 'Mês/Ano', key: 'monthLabel', width: monthlyColW, wrapTitle: true },
      { title: 'Semanas', key: 'weeks', width: monthlyColW, wrapTitle: true },
      { title: 'Tarefas\nplanejadas', key: 'planned', width: monthlyColW, wrapTitle: true },
      { title: 'Planejadas e\nexecutadas', key: 'executed', width: monthlyColW, wrapTitle: true },
      { title: 'Canceladas', key: 'cancelled', width: monthlyColW, wrapTitle: true },
      { title: 'Iniciadas', key: 'started', width: monthlyColW, wrapTitle: true },
      { title: 'Não\niniciadas', key: 'notStarted', width: monthlyColW, wrapTitle: true },
      { title: 'Executadas e\nnão planejadas', key: 'unplannedExecuted', width: monthlyColW, wrapTitle: true },
    ],
    [
      ...monthlyTableRows.map((item) => ({
        monthLabel: item.monthLabel,
        weeks: String(item.weeks),
        planned: String(item.planned),
        executed: String(item.executed),
        cancelled: String(item.cancelled),
        started: String(item.started),
        notStarted: String(item.notStarted),
        unplannedExecuted: String(item.unplannedExecuted),
      })),
      {
        monthLabel: 'TOTAL',
        weeks: String(monthlyTotals.weeks),
        planned: String(monthlyTotals.planned),
        executed: String(monthlyTotals.executed),
        cancelled: String(monthlyTotals.cancelled),
        started: String(monthlyTotals.started),
        notStarted: String(monthlyTotals.notStarted),
        unplannedExecuted: String(monthlyTotals.unplannedExecuted),
      },
    ],
    { title: 'Visão mensal - global', repeatTitle: 'Visão mensal - global', headerH: 34, rowH: 22 },
  );
  const monthlyExplain = 'Mês/Ano: referência do período. Semanas: quantidade de semanas daquele mês. Tarefas planejadas: tarefas no fechamento do planejamento semanal. Planejadas e executadas: tarefas planejadas que foram executadas no fechamento do feedback. Canceladas/Iniciadas/Não iniciadas: status no fechamento do feedback. Executadas e não planejadas: atividades feitas sem constarem no planejamento da semana.';
  doc.font('Helvetica').fontSize(8.2);
  const monthlyExplainH = Math.max(52, Math.ceil(doc.heightOfString(monthlyExplain, {
    width: contentWidth - 20,
    align: 'justify',
    lineBreak: true,
    lineGap: 1.1,
  }) + 12));
  ensureSpace(monthlyExplainH + 4);
  drawRoundBox(margin, y, contentWidth, monthlyExplainH, '#f4f9ff', COLORS.border, 3);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
    .text(monthlyExplain, margin + 10, y + 7, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.1,
    });
  y += monthlyExplainH + 8;

  startMainSectionOnNewPage('2.14 - Índices adicionais', 152);
  const idxCardGap = 10;
  const idxCardW = (contentWidth - (idxCardGap * 2)) / 3;
  const idxCardH = 62;
  const idxCards = [
    {
      label: 'Taxa de retrabalho',
      value: formatPercentBr(data.rework?.ratePct || 0),
      sub: `${Number(data.rework?.replannedTasks || 0)} de ${Number(data.rework?.plannedTasks || 0)} tarefas`,
      bg: '#f1f7ff',
      fg: '#244e83',
    },
    {
      label: 'Lead time médio',
      value: `${formatNumberBr(data.pendingLeadTime?.avgWeeks || 0)} sem`,
      sub: `Mediana: ${formatNumberBr(data.pendingLeadTime?.medianWeeks || 0)} | Máx: ${Number(data.pendingLeadTime?.maxWeeks || 0)}`,
      bg: '#f6fbf7',
      fg: '#1f6f45',
    },
    {
      label: 'Pendências',
      value: `${Number(data.pending?.resolvedTotal || 0)} | ${Number(data.pending?.openCurrent || 0)}`,
      sub: 'Resolvidas no histórico | abertas na semana de corte',
      bg: '#eef8fb',
      fg: '#2f5e77',
    },
  ];
  idxCards.forEach((card, idx) => {
    const cx = margin + (idx * (idxCardW + idxCardGap));
    drawRoundBox(cx, y, idxCardW, idxCardH, card.bg, COLORS.border, 7);
    doc.fillColor(card.fg).font('Helvetica-Bold').fontSize(8.0)
      .text(card.label, cx + 6, y + 7, {
        width: idxCardW - 12,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica-Bold').fontSize(12.2)
      .text(card.value, cx + 6, y + 24, {
        width: idxCardW - 12,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(6.8)
      .text(card.sub, cx + 6, y + 43, {
        width: idxCardW - 12,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
  });
  y += idxCardH + 8;
  const idxExplain = 'Taxa de retrabalho: percentual de tarefas replanejadas sobre o total de tarefas planejadas. Lead time médio de pendências resolvidas: tempo médio, em semanas, entre a origem e a resolução de pendências. Pendências resolvidas no histórico e pendências abertas na semana de corte: medem o saldo de pendências resolvidas/acumuladas até a semana analisada.';
  doc.font('Helvetica').fontSize(8.2);
  const idxExplainH = Math.max(52, Math.ceil(doc.heightOfString(idxExplain, {
    width: contentWidth - 20,
    align: 'justify',
    lineBreak: true,
    lineGap: 1.1,
  }) + 12));
  ensureSpace(idxExplainH + 4);
  drawRoundBox(margin, y, contentWidth, idxExplainH, '#f4f9ff', COLORS.border, 3);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
    .text(idxExplain, margin + 10, y + 7, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.1,
    });
  y += idxExplainH + 8;

  startMainSectionOnNewPage('2.15 - Mapa de calor por Zona 1', 44);
  const rankedZoneRows = (Array.isArray(data.zones) ? data.zones : [])
    .filter((item) => Number(item?.planned || 0) > 0)
    .sort((a, b) => (
      Number(b?.planned || 0) - Number(a?.planned || 0)
      || Number(b?.executedPlanned || 0) - Number(a?.executedPlanned || 0)
      || String(a?.zone1 || '').localeCompare(String(b?.zone1 || ''), 'pt-BR')
    ));
  drawSimpleTable(
    [
      { title: 'Ranking', key: 'rank', width: 54 },
      { title: 'Zona 1', key: 'zone1', width: 176 },
      { title: 'Total atividades\nplanejadas', key: 'planned', width: 114, wrapTitle: true },
      { title: 'Total atividades\nplanejadas executadas', key: 'executedPlanned', width: 126, wrapTitle: true },
      { title: '% atividades planejadas\nexecutadas', key: 'executionPct', width: contentWidth - (54 + 176 + 114 + 126), wrapTitle: true },
    ],
    rankedZoneRows.map((item, idx) => ({
      rank: String(idx + 1),
      zone1: item.zone1,
      planned: String(Number(item.planned || 0)),
      executedPlanned: String(Number(item.executedPlanned || 0)),
      executionPct: formatPercentBr(item.executionPct || 0),
    })),
    { title: 'Mapa de calor por Zona 1', repeatTitle: 'Mapa de calor por Zona 1', headerH: 32, rowH: 22 },
  );
  const zoneExplain = 'Ranking: ordenação da zona por volume de atividades. Total atividades planejadas: quantidade de tarefas previstas para a zona. Total atividades planejadas executadas: quantidade de tarefas previstas que foram executadas. % atividades planejadas executadas: razão entre executadas planejadas e planejadas da zona.';
  doc.font('Helvetica').fontSize(8.2);
  const zoneExplainH = Math.max(44, Math.ceil(doc.heightOfString(zoneExplain, {
    width: contentWidth - 20,
    align: 'justify',
    lineBreak: true,
    lineGap: 1.1,
  }) + 12));
  ensureSpace(zoneExplainH + 4);
  drawRoundBox(margin, y, contentWidth, zoneExplainH, '#f4f9ff', COLORS.border, 3);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
    .text(zoneExplain, margin + 10, y + 7, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.1,
    });
  y += zoneExplainH + 8;

  startMainSectionOnNewPage('2.16 - VISÃO SEMANAL POR EMPREITEIRO', 232);
  const contractorPpcIntro = 'Aqui é mostrado o PPC por empreiteiro. Mesmo causas que não dependem do empreiteiro são consideradas nestes gráficos. Mede-se o % entre as atividades planejadas executadas e o total de atividades planejadas em cadas semana. Atividades executadas e não planejadas não fazem parte da contabilidade. Atividades Reserva, quando executadas, contam como atividades planejadas executadas e também como atividades planejadas';
  doc.font('Helvetica').fontSize(8.5);
  const contractorPpcIntroH = Math.max(62, Math.ceil(doc.heightOfString(contractorPpcIntro, {
    width: contentWidth - 20,
    align: 'justify',
    lineBreak: true,
    lineGap: 1.2,
  }) + 12));
  ensureSpace(contractorPpcIntroH + 8);
  drawRoundBox(margin, y, contentWidth, contractorPpcIntroH, '#f4f9ff', COLORS.border, 6);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.5)
    .text(contractorPpcIntro, margin + 10, y + 7, {
      width: contentWidth - 20,
      align: 'justify',
      lineBreak: true,
      lineGap: 1.2,
    });
  y += contractorPpcIntroH + 8;

  const contractorPpcWeekly = Array.isArray(data.contractorPpcWeekly) ? data.contractorPpcWeekly : [];
  const byContractorPpcWeekly = new Map();
  contractorPpcWeekly.forEach((row) => {
    const key = String(row.contractor || 'SEM_EMPREITEIRO');
    if (!byContractorPpcWeekly.has(key)) byContractorPpcWeekly.set(key, []);
    byContractorPpcWeekly.get(key).push(row);
  });
  const contractorNames = [...byContractorPpcWeekly.keys()].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

  if (!contractorNames.length) {
    ensureSpace(44);
    drawRoundBox(margin, y, contentWidth, 36, '#f7fbff', COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.5)
      .text('Sem dados semanais por empreiteiro para o período.', margin + 8, y + 12, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    y += 44;
  } else {
    contractorNames.forEach((contractorName) => {
      const rows = (byContractorPpcWeekly.get(contractorName) || []).slice().sort((a, b) => Number(a.weekNumber || 0) - Number(b.weekNumber || 0));
      const boxH = 168;
      ensureSpace(boxH + 8);
      drawRoundBox(margin, y, contentWidth, boxH, '#f7fbff', COLORS.border, 7);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.8)
        .text(String(contractorName || '-'), margin + 8, y + 9, {
          width: contentWidth - 16,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      drawMultiLineChart({
        x: margin + 4,
        yPos: y + 24,
        width: contentWidth - 8,
        height: 134,
        labels: rows.map((r) => `S${Number(r.weekNumber || 0)}`),
        series: [{
          label: '% atividades planejadas executadas / atividades planejadas',
          color: '#2f8f65',
          values: rows.map((r) => Number(r.executionPct || 0)),
        }],
        yLabel: '%',
        yMax: 100,
      });
      y += boxH + 8;
    });
  }

  addPage();
  drawSectionTitle('3 - Qualidade percebida', 70);
  startMainSectionOnNewPage('3.1 - EVOLUÇÃO MENSAL DA QUALIDADE PERCEBIDA POR EMPREITEIRO', 88);
  const qualityHistory = Array.isArray(data.qualityPerceivedHistory?.contractors)
    ? data.qualityPerceivedHistory.contractors
    : [];
  const weeklyTrendRowsForQuality = Array.isArray(data.weeklyTrend) ? data.weeklyTrend : [];
  const weekToMonthMap = new Map();
  weeklyTrendRowsForQuality.forEach((row) => {
    const weekNum = Number(row?.weekNumber || 0);
    if (!weekNum) return;
    weekToMonthMap.set(weekNum, {
      monthKey: String(row?.monthKey || ''),
      monthLabel: String(row?.monthLabel || ''),
    });
  });
  const qualityThresholds = {
    deadlineRegular: Number(data.qualityPerceivedHistory?.thresholds?.deadlineRegular ?? 60),
    deadlineGood: Number(data.qualityPerceivedHistory?.thresholds?.deadlineGood ?? 80),
    qualityRegular: Number(data.qualityPerceivedHistory?.thresholds?.qualityRegular ?? 5),
    qualityGood: Number(data.qualityPerceivedHistory?.thresholds?.qualityGood ?? 8),
    collaborationRegular: Number(data.qualityPerceivedHistory?.thresholds?.collaborationRegular ?? 5),
    collaborationGood: Number(data.qualityPerceivedHistory?.thresholds?.collaborationGood ?? 8),
    safetyRegular: Number(data.qualityPerceivedHistory?.thresholds?.safetyRegular ?? 5),
    safetyGood: Number(data.qualityPerceivedHistory?.thresholds?.safetyGood ?? 8),
    cleaningRegular: Number(data.qualityPerceivedHistory?.thresholds?.cleaningRegular ?? 5),
    cleaningGood: Number(data.qualityPerceivedHistory?.thresholds?.cleaningGood ?? 8),
  };
  const drawQualityMetricCell = (xCell, yCell, wCell, hCell, band, score, decimals = 0) => {
    const size = Math.max(10, Math.min(14, hCell - 8));
    const parsed = Number(score);
    const hasScore = Number.isFinite(parsed);
    const scoreText = hasScore ? formatNumberBr(parsed, decimals) : '-';
    const scoreSize = 7.3;
    doc.font('Helvetica-Bold').fontSize(scoreSize);
    const scoreW = Math.min(wCell - 12, Math.ceil(doc.widthOfString(scoreText, { font: 'Helvetica-Bold', size: scoreSize })) + 2);
    const clusterW = size + 3 + scoreW;
    const startX = xCell + Math.max(3, Math.floor((wCell - clusterW) / 2));
    const faceY = yCell + Math.max(2, Math.floor((hCell - size) / 2));
    drawBandFaceLocal(startX, faceY, size, band);
    const scoreH = Math.ceil(doc.heightOfString(scoreText, { width: scoreW, align: 'center', lineBreak: false }));
    const scoreY = yCell + Math.max(2, Math.floor((hCell - scoreH) / 2));
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(scoreSize)
      .text(scoreText, startX + size + 3, scoreY, {
        width: scoreW,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
  };

  if (!qualityHistory.length) {
    ensureSpace(44);
    drawRoundBox(margin, y, contentWidth, 36, '#f7fbff', COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.5)
      .text('Sem dados mensais de qualidade percebida no período analisado.', margin + 8, y + 12, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    y += 44;
  } else {
    const qMonthColW = 102;
    const qWeeksColW = 72;
    const qMetricW = (contentWidth - qMonthColW - qWeeksColW) / 5;
    const qCols = [
      { title: 'Mês', key: 'month', width: qMonthColW },
      { title: 'Número de\nsemanas', key: 'weeks', width: qWeeksColW },
      { title: 'PPC', key: 'ppc', width: qMetricW },
      { title: 'Colaboração', key: 'collaboration', width: qMetricW },
      { title: 'Limpeza', key: 'cleaning', width: qMetricW },
      { title: 'Qualidade', key: 'quality', width: qMetricW },
      { title: 'Segurança', key: 'safety', width: qMetricW },
    ];
    const qHeaderH = 22;
    const qRowH = 22;
    qualityHistory.forEach((contractor) => {
      const weeklyRows = Array.isArray(contractor.weekly)
        ? contractor.weekly.slice().sort((a, b) => Number(a.weekNumber || 0) - Number(b.weekNumber || 0))
        : [];
      if (!weeklyRows.length) return;
      const monthMap = new Map();
      weeklyRows.forEach((row) => {
        const weekNum = Number(row?.weekNumber || 0);
        const monthRef = weekToMonthMap.get(weekNum) || { monthKey: '', monthLabel: '' };
        const monthKey = String(monthRef.monthKey || `${Math.floor(weekNum / 4)}`).trim() || `W${weekNum}`;
        const monthLabel = String(monthRef.monthLabel || '').trim() || `S${weekNum}`;
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            monthKey,
            monthLabel,
            weeks: 0,
            ppcScoreSum: 0,
            collaborationScoreSum: 0,
            cleaningScoreSum: 0,
            qualityScoreSum: 0,
            safetyScoreSum: 0,
          });
        }
        const acc = monthMap.get(monthKey);
        acc.weeks += 1;
        acc.ppcScoreSum += Number(row?.ppcScore || 0);
        acc.collaborationScoreSum += Number(row?.collaborationScore || 0);
        acc.cleaningScoreSum += Number(row?.cleaningScore || 0);
        acc.qualityScoreSum += Number(row?.qualityScore || 0);
        acc.safetyScoreSum += Number(row?.safetyScore || 0);
      });
      const monthlyRows = [...monthMap.values()]
        .sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey), 'pt-BR'))
        .map((item) => ({
          monthLabel: item.monthLabel,
          weeks: Number(item.weeks || 0),
          ppcScore: item.weeks ? Number((item.ppcScoreSum / item.weeks).toFixed(2)) : 0,
          collaborationScore: item.weeks ? Number((item.collaborationScoreSum / item.weeks).toFixed(2)) : 0,
          cleaningScore: item.weeks ? Number((item.cleaningScoreSum / item.weeks).toFixed(2)) : 0,
          qualityScore: item.weeks ? Number((item.qualityScoreSum / item.weeks).toFixed(2)) : 0,
          safetyScore: item.weeks ? Number((item.safetyScoreSum / item.weeks).toFixed(2)) : 0,
        }));
      if (!monthlyRows.length) return;
      const activeWeeks = Math.max(1, weeklyRows.length);
      const averageRow = {
        monthLabel: 'MÉDIA',
        weeks: activeWeeks,
        ppcScore: Number((weeklyRows.reduce((sum, row) => sum + Number(row?.ppcScore || 0), 0) / activeWeeks).toFixed(2)),
        collaborationScore: Number((weeklyRows.reduce((sum, row) => sum + Number(row?.collaborationScore || 0), 0) / activeWeeks).toFixed(2)),
        cleaningScore: Number((weeklyRows.reduce((sum, row) => sum + Number(row?.cleaningScore || 0), 0) / activeWeeks).toFixed(2)),
        qualityScore: Number((weeklyRows.reduce((sum, row) => sum + Number(row?.qualityScore || 0), 0) / activeWeeks).toFixed(2)),
        safetyScore: Number((weeklyRows.reduce((sum, row) => sum + Number(row?.safetyScore || 0), 0) / activeWeeks).toFixed(2)),
      };
      const totalRows = monthlyRows.length + 1;
      const tableH = qHeaderH + (totalRows * qRowH);
      const boxH = 30 + tableH + 8;
      if (y + boxH > pageBottom() - 16) {
        addPage();
        drawSectionTitle('3.1 - EVOLUÇÃO MENSAL DA QUALIDADE PERCEBIDA POR EMPREITEIRO', 0, { registerInToc: false });
      }
      drawRoundBox(margin, y, contentWidth, boxH, '#f7fbff', COLORS.border, 7);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.8)
        .text(String(contractor.contractorName || '-'), margin + 8, y + 9, {
          width: contentWidth - 16,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });

      let qY = y + 30;
      drawRoundBox(margin, qY, contentWidth, qHeaderH, COLORS.header, COLORS.border, 4);
      let qX = margin;
      qCols.forEach((col, idx) => {
        if (idx > 0) {
          doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(qX, qY).lineTo(qX, qY + qHeaderH).stroke().restore();
        }
        doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.1)
          .text(String(col.title || ''), qX + 2, qY + 7, {
            width: col.width - 4,
            align: 'center',
            lineBreak: false,
            ellipsis: true,
          });
        qX += col.width;
      });
      qY += qHeaderH;

      const drawQualityRow = (row, isAverage = false, idx = 0) => {
        const fill = isAverage ? '#e8f5ff' : (idx % 2 === 0 ? COLORS.rowA : COLORS.rowB);
        drawRoundBox(margin, qY, contentWidth, qRowH, fill, COLORS.border, 3);
        let xCell = margin;
        qCols.forEach((col, colIdx) => {
          if (colIdx > 0) {
            doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(xCell, qY).lineTo(xCell, qY + qRowH).stroke().restore();
          }
          if (col.key === 'month') {
            const monthText = isAverage ? 'MÉDIA' : String(row.monthLabel || '-');
            doc.fillColor(COLORS.text).font(isAverage ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.2)
              .text(monthText, xCell + 2, qY + 7, {
                width: col.width - 4,
                align: 'center',
                lineBreak: false,
                ellipsis: true,
              });
          } else if (col.key === 'weeks') {
            const weeksText = String(Number(row.weeks || 0));
            doc.fillColor(COLORS.text).font(isAverage ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.2)
              .text(weeksText, xCell + 2, qY + 7, {
                width: col.width - 4,
                align: 'center',
                lineBreak: false,
                ellipsis: true,
              });
          } else {
            const metricKey = col.key;
            let band = '-';
            let score = null;
            const decimals = 2;
            if (metricKey === 'ppc') {
              score = row.ppcScore;
              band = classifyBandLocal(Number(score || 0) * 10, qualityThresholds.deadlineRegular, qualityThresholds.deadlineGood);
            } else if (metricKey === 'collaboration') {
              score = row.collaborationScore;
              band = classifyBandLocal(score, qualityThresholds.collaborationRegular, qualityThresholds.collaborationGood);
            } else if (metricKey === 'cleaning') {
              score = row.cleaningScore;
              band = classifyBandLocal(score, qualityThresholds.cleaningRegular, qualityThresholds.cleaningGood);
            } else if (metricKey === 'quality') {
              score = row.qualityScore;
              band = classifyBandLocal(score, qualityThresholds.qualityRegular, qualityThresholds.qualityGood);
            } else if (metricKey === 'safety') {
              score = row.safetyScore;
              band = classifyBandLocal(score, qualityThresholds.safetyRegular, qualityThresholds.safetyGood);
            }
            drawQualityMetricCell(xCell, qY, col.width, qRowH, band, score, decimals);
          }
          xCell += col.width;
        });
        qY += qRowH;
      };

      monthlyRows.forEach((row, idx) => drawQualityRow(row, false, idx));
      drawQualityRow(averageRow, true, monthlyRows.length);
      y += boxH + 8;
    });
  }

  addPage();
  drawSectionTitle('4 - Governança', 68);
  const g = data.governance || {};
  startMainSectionOnNewPage('4.1 - Governança do processo', 520);
  const governanceCards = [
    {
      title: 'Fechamento da pré programação da semana',
      late: Number(g.prePlanningLateWeeks || 0),
      considered: Number(g.prePlanningClosedWeeks || 0),
      pct: Number(g.prePlanningLatePctClosed || 0),
      description: 'Mede o atraso no fechamento da pré programação da semana em relação ao prazo definido.',
    },
    {
      title: 'Fechamento lista de presença e ata (Reunião)',
      late: Number(g.ppcMeetingLateWeeks || 0),
      considered: Number(g.ppcMeetingClosedWeeks || 0),
      pct: Number(g.ppcMeetingLatePctClosed || 0),
      description: 'Mede o atraso no fechamento da lista de presença e ata da reunião de PPC.',
    },
    {
      title: 'Fechamento da programação da semana',
      late: Number(g.planningLateWeeks || 0),
      considered: Number(g.planningClosedWeeks || 0),
      pct: Number(g.planningLatePctClosed || 0),
      description: 'Mede o atraso no fechamento da programação oficial da semana.',
    },
    {
      title: 'Fechamento do feedback da semana',
      late: Number(g.feedbackLateWeeks || 0),
      considered: Number(g.feedbackClosedWeeks || 0),
      pct: Number(g.feedbackLatePctClosed || 0),
      description: 'Mede o atraso no fechamento do feedback semanal da obra.',
    },
    {
      title: 'Fechamento da qualidade percebida da semana',
      late: Number(g.qualityLateWeeks || 0),
      considered: Number(g.qualityClosedWeeks || 0),
      pct: Number(g.qualityLatePctClosed || 0),
      description: 'Mede o atraso no fechamento da qualidade percebida da semana.',
    },
  ];
  const governanceCardH = 94;
  const governanceGap = 8;
  const miniGap = 8;
  const miniW = (contentWidth - (miniGap * 4)) / 3;
  governanceCards.forEach((card) => {
    ensureSpace(governanceCardH + governanceGap);
    drawRoundBox(margin, y, contentWidth, governanceCardH, '#eef8fb', COLORS.border, 7);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.6)
      .text(card.title, margin + 8, y + 8, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    const miniY = y + 26;
    const miniItems = [
      { label: 'Semanas fora do prazo', value: formatNumberBr(card.late, 0), fill: '#ffe7e9' },
      { label: 'Semanas consideradas', value: formatNumberBr(card.considered, 0), fill: '#eef6ff' },
      { label: '% fora do prazo', value: formatPercentBr(card.pct, 2), fill: '#fff4dd' },
    ];
    miniItems.forEach((item, idx) => {
      const mx = margin + miniGap + (idx * (miniW + miniGap));
      drawRoundBox(mx, miniY, miniW, 30, item.fill, COLORS.border, 6);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(6.8)
        .text(item.label, mx + 4, miniY + 5, {
          width: miniW - 8,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.6)
        .text(item.value, mx + 4, miniY + 16, {
          width: miniW - 8,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
    });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.8)
      .text(card.description, margin + 10, y + 62, {
        width: contentWidth - 20,
        align: 'justify',
        lineBreak: true,
      });
    y += governanceCardH + governanceGap;
  });

  startMainSectionOnNewPage('4.2 - Ranking de acessos por usuário', 120);
  const accessRank = Array.isArray(data.access?.byUser) ? data.access.byUser : [];
  drawSimpleTable(
    [
      { title: 'Ranking', key: 'rank', width: 54 },
      { title: 'Usuário', key: 'userName', width: 170 },
      { title: 'Email', key: 'email', width: 210 },
      { title: 'Acessos', key: 'count', width: contentWidth - (54 + 170 + 210) },
    ],
    accessRank.map((item, idx) => ({
      rank: String(idx + 1),
      userName: item.userName,
      email: item.email || '-',
      count: String(item.count),
    })),
    { title: 'Ranking de acessos por usuário', repeatTitle: 'Ranking de acessos por usuário' },
  );
  y += 6;

  startMainSectionOnNewPage('4.3 - Gráficos de acesso por usuário', 168);
  const weeklyLabelsAccess = (data.access?.byWeek || []).map((w) => `S${w.weekNumber}`);
  const accessRows = Array.isArray(data.access?.rows) ? data.access.rows : [];
  const accessByUserSeries = new Map();
  accessRows.forEach((row) => {
    const key = String(row.userName || 'Usuário');
    if (!accessByUserSeries.has(key)) accessByUserSeries.set(key, new Map());
    accessByUserSeries.get(key).set(Number(row.weekNumber), Number(row.count || 0));
  });
  const activeAccessUsers = accessRank.filter((userRow) => Number(userRow?.count || 0) > 0);
  if (!activeAccessUsers.length) {
    ensureSpace(44);
    drawRoundBox(margin, y, contentWidth, 36, '#f7fbff', COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.5)
      .text('Sem usuários com acesso registrado no período.', margin + 8, y + 12, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    y += 44;
  }
  activeAccessUsers.forEach((userRow) => {
    const userName = String(userRow.userName || 'Usuário');
    const map = accessByUserSeries.get(userName) || new Map();
    const values = (data.access?.byWeek || []).map((w) => Number(map.get(Number(w.weekNumber)) || 0));
    const weeksForMean = Math.max(1, Number(data.range?.totalWeeks || (data.access?.byWeek || []).length || 1));
    const meanAccess = Number(userRow?.count || 0) / weeksForMean;
    const meanSeries = values.map(() => meanAccess);
    const boxH = 160;
    ensureSpace(boxH + 8);
    drawRoundBox(margin, y, contentWidth, boxH, '#f7fbff', COLORS.border, 7);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.2)
      .text(userName, margin + 8, y + 8, { width: contentWidth - 16, align: 'center', lineBreak: false, ellipsis: true });
    drawMultiLineChart({
      x: margin + 4,
      yPos: y + 22,
      width: contentWidth - 8,
      height: 106,
      labels: weeklyLabelsAccess,
      series: [
        { label: 'Acessos semanais', color: '#2477c4', values },
        { label: `Média semanal (${formatNumberBr(meanAccess, 2)})`, color: '#d97706', values: meanSeries, lineStyle: 'dashed', hidePoints: true },
      ],
      yLabel: 'Acessos',
      yMax: Math.max(1, ...values, meanAccess),
    });
    drawLegend(
      [
        { label: 'Acessos semanais', color: '#2477c4' },
        { label: `Média semanal (${formatNumberBr(meanAccess, 2)})`, color: '#d97706' },
      ],
      margin + 10,
      y + 134,
      contentWidth - 20,
      { fontSize: 6.8, rowH: 12, sw: 8 },
    );
    y += boxH + 8;
  });


  const pages = doc.bufferedPageRange();
  doc.switchToPage(pages.start + tocPageIndex);
  doc.save()
    .fillColor('#ffffff')
    .rect(margin, CONTENT_TOP, contentWidth, doc.page.height - CONTENT_TOP - margin)
    .fill()
    .restore();
  let tocY = CONTENT_TOP;
  drawRoundBox(margin, tocY, contentWidth, 28, COLORS.title, COLORS.border, 8);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
    .text('SUMÁRIO', margin + 8, tocY + 8, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });
  tocY += 38;
  const tocMinLineH = 18;
  const sortedTocEntries = [...tocEntries].sort((a, b) => Number(a.page) - Number(b.page));
  sortedTocEntries.forEach((entry) => {
    const pageDisplay = Math.max(1, Number(entry.page) - 1);
    const indent = Number(entry.level) === 2 ? 18 : 0;
    const textX = margin + 8 + indent;
    const textW = contentWidth - 60 - indent;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.8);
    const textH = Math.ceil(doc.heightOfString(entry.title, {
      width: textW,
      align: 'left',
      lineBreak: true,
    }));
    const rowH = Math.max(tocMinLineH, textH + 6);
    if (tocY + rowH > pageBottom()) return;
    drawRoundBox(margin, tocY, contentWidth, rowH, '#f7fbff', COLORS.border, 4);
    const textY = tocY + Math.max(3, Math.floor((rowH - textH) / 2));
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.8)
      .text(entry.title, textX, textY, {
        width: textW,
        align: 'left',
        lineBreak: true,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(9)
      .text(String(pageDisplay), margin + contentWidth - 32, tocY + Math.max(3, Math.floor((rowH - 9) / 2)), {
        width: 24,
        align: 'right',
        lineBreak: false,
      });
    if (canUsePdfDestinations && entry.destination) {
      try {
        doc.goTo(margin + 6, tocY + 2, contentWidth - 12, rowH - 4, entry.destination);
      } catch {
        // no-op
      }
    }
    tocY += rowH + 4;
  });

  const internalTotal = Math.max(0, pages.count - 1);
  for (let i = 0; i < pages.count; i += 1) {
    if (i === 0) continue;
    const pageNumber = i;
    doc.switchToPage(pages.start + i);
    const footerY = doc.page.height - margin - 10;
    doc.fillColor('#35597a').font('Helvetica').fontSize(8)
      .text(`${pageNumber}/${internalTotal}`, margin, footerY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
  }

  doc.end();
}));

router.get('/works/:workId/dashboard/reports/last-week/pdf', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN, ROLES.CONTROLLER, ROLES.MANAGEMENT, ROLES.ENGINEERING], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  if (!PDFDocument) {
    return res.status(500).json({ error: 'pdf_dependency_missing' });
  }

  const requestedWeek = parseIntId(req.query.weekNumber);
  const payload = await resolveWeekAndMetricsForDashboardReport(req.workId, requestedWeek);
  if (!payload) {
    return res.status(404).json({ error: 'no_closed_feedback_quality_week' });
  }

  const { week, metrics, tasks, feedbacks } = payload;
  const insights = await buildWeeklyOperationalInsights(week, tasks, feedbacks);
  const contractorSpecificCauseRows = computeContractorSpecificCauseNonCompliance(tasks, feedbacks);
  const weeklyAccess = insights.weeklyAccess;
  const pendingFromPrior = insights.pendingFromPrior;
  const pendingResolved = insights.pendingResolved;
  const pendingRemaining = insights.pendingRemaining;
  const pendingResolvedPct = insights.pendingResolvedPct;
  const pendingRemainingRows = insights.pendingRemainingRows;
  const feedbackByTaskId = new Map((feedbacks || []).map((fb) => [Number(fb.taskId), fb]));
  const plannedActivities = Number(metrics?.totals?.executed || 0)
    + Number(metrics?.totals?.started || 0)
    + Number(metrics?.totals?.notStarted || 0)
    + Number(metrics?.totals?.cancelled || 0);
  const executedPlannedActivities = Number(metrics?.totals?.executed || 0);
  const executedVsPlannedPct = plannedActivities
    ? Number(((executedPlannedActivities / plannedActivities) * 100).toFixed(2))
    : 0;
  const heatMapByLocation = new Map();
  (tasks || []).forEach((task) => {
    const outcome = taskOutcome(task, feedbackByTaskId);
    if (outcome !== 'EXECUTED') return;
    const location1 = String(task.location?.level1 || 'SEM LOCAL 1');
    heatMapByLocation.set(location1, (heatMapByLocation.get(location1) || 0) + 1);
  });
  const heatMapRows = [...heatMapByLocation.entries()]
    .map(([location1, planned]) => ({ location1, planned: Number(planned || 0) }))
    .sort((a, b) => Number(b.planned) - Number(a.planned) || String(a.location1).localeCompare(String(b.location1), 'pt-BR'));
  const [
    appConfig,
    qualityItemsRaw,
    qualityConfig,
    ppcMeeting,
    notificationRule,
    workUserAssignments,
  ] = await Promise.all([
    prisma.appConfig.findFirst({ orderBy: { id: 'asc' } }),
    prisma.weekPerceivedQualityItem.findMany({
      where: { weekId: week.id },
      include: { contractor: { select: { id: true, name: true } } },
    }),
    prisma.workPerceivedQualityConfig.findUnique({ where: { workId: req.workId } }),
    prisma.weekPpcMeeting.findUnique({
      where: { weekId: week.id },
      include: {
        closedBy: { select: { name: true } },
        attendances: {
          include: { contractor: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.notificationRule.findUnique({ where: { workId: req.workId } }),
    prisma.userWorkRole.findMany({
      where: { workId: req.workId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  const attendanceByContractorId = new Map(
    (ppcMeeting?.attendances || []).map((row) => [Number(row.contractorId), row.present === true]),
  );
  const contractorSpecificByName = new Map(
    contractorSpecificCauseRows.map((row) => [String(row.contractor || ''), row]),
  );
  const qualityItemByContractorId = new Map(
    (qualityItemsRaw || []).map((row) => [Number(row.contractorId), row]),
  );
  const activeContractorsById = new Map();
  (tasks || []).forEach((task) => {
    const id = Number(task.contractor?.id || task.contractorId || 0);
    if (!id) return;
    activeContractorsById.set(id, {
      id,
      name: String(task.contractor?.name || 'SEM_EMPREITEIRO'),
    });
  });
  (qualityItemsRaw || []).forEach((row) => {
    const id = Number(row.contractor?.id || row.contractorId || 0);
    if (!id) return;
    activeContractorsById.set(id, {
      id,
      name: String(row.contractor?.name || 'SEM_EMPREITEIRO'),
    });
  });
  (ppcMeeting?.attendances || []).forEach((row) => {
    const id = Number(row.contractor?.id || row.contractorId || 0);
    if (!id) return;
    activeContractorsById.set(id, {
      id,
      name: String(row.contractor?.name || 'SEM_EMPREITEIRO'),
    });
  });

  const qualityThresholds = {
    deadlineRegular: Number(qualityConfig?.deadlineRegularPct ?? 60),
    deadlineGood: Number(qualityConfig?.deadlineGoodPct ?? 80),
    qualityRegular: Number(qualityConfig?.qualityRegularScore ?? 5),
    qualityGood: Number(qualityConfig?.qualityGoodScore ?? 8),
    collaborationRegular: Number(qualityConfig?.collaborationRegularScore ?? 5),
    collaborationGood: Number(qualityConfig?.collaborationGoodScore ?? 8),
    safetyRegular: Number(qualityConfig?.safetyRegularScore ?? 5),
    safetyGood: Number(qualityConfig?.safetyGoodScore ?? 8),
    cleaningRegular: Number(qualityConfig?.cleaningRegularScore ?? 5),
    cleaningGood: Number(qualityConfig?.cleaningGoodScore ?? 8),
    presenceImpact: Number(qualityConfig?.collaborationPresenceImpactScore ?? 0),
  };

  const weeklyPerceivedQualityRows = [...activeContractorsById.values()]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
    .map((contractor) => {
      const item = qualityItemByContractorId.get(Number(contractor.id)) || null;
      const nonComplianceRow = contractorSpecificByName.get(contractor.name) || null;
      const ppcPct = (nonComplianceRow && Number(nonComplianceRow.planned || 0) > 0)
        ? Math.max(0, Number((100 - Number(nonComplianceRow.pct || 0)).toFixed(2)))
        : 0;
      const present = attendanceByContractorId.get(Number(contractor.id)) === true;
      const collabTeam = Number.isInteger(item?.collaborationTeamScore) ? Number(item.collaborationTeamScore) : null;
      const collaborationScore = computeCollaborationFinalScore(
        collabTeam,
        qualityThresholds.presenceImpact,
        present,
      );
      return {
        contractorId: Number(contractor.id),
        contractorName: contractor.name,
        ppcPct,
        qualityScore: Number.isInteger(item?.qualityScore) ? Number(item.qualityScore) : null,
        collaborationScore,
        safetyScore: Number.isInteger(item?.safetyScore) ? Number(item.safetyScore) : null,
        cleaningScore: Number.isInteger(item?.cleaningScore) ? Number(item.cleaningScore) : null,
        comments: String(item?.comments || ''),
        presentAtMeeting: present,
      };
    });
  const printedAt = new Date();
  const tz = inferBrazilTimeZoneFromWork(week.work);
  const printedAtText = formatDateTimeBrInTimeZone(printedAt, tz);
  const planningClosedAtText = formatDateTimeBrInTimeZone(week.planningClosedAt, tz) || '-';
  const feedbackClosedAtText = formatDateTimeBrInTimeZone(week.feedbackClosedAt, tz) || '-';
  const ppcTargetPct = Number.isFinite(Number(week.work?.ppcTargetPct)) ? Number(week.work.ppcTargetPct) : 80;
  const weeklyAccessByUserId = new Map(
    (weeklyAccess || [])
      .filter((item) => Number.isFinite(Number(item.userId)))
      .map((item) => [Number(item.userId), Number(item.count || 0)]),
  );
  const usersById = new Map();
  (workUserAssignments || []).forEach((assignment) => {
    const user = assignment?.user;
    const uid = Number(user?.id || 0);
    if (!uid) return;
    if (!usersById.has(uid)) {
      usersById.set(uid, {
        userId: uid,
        userName: String(user?.name || user?.email || 'Usuário sem nome'),
        email: String(user?.email || ''),
      });
    }
  });
  (weeklyAccess || []).forEach((item) => {
    const uid = Number(item.userId || 0);
    if (!uid) return;
    if (!usersById.has(uid)) {
      usersById.set(uid, {
        userId: uid,
        userName: String(item.userName || item.email || 'Usuário'),
        email: String(item.email || ''),
      });
    }
  });
  const allUsersWeeklyAccessRows = [...usersById.values()]
    .map((item) => ({
      ...item,
      count: Number(weeklyAccessByUserId.get(Number(item.userId)) || 0),
    }))
    .sort((a, b) => (
      Number(b.count) - Number(a.count)
      || String(a.userName || '').localeCompare(String(b.userName || ''), 'pt-BR')
    ));

  const companyWebsite = appConfig?.companySite || appConfig?.companyWebsite || appConfig?.website || appConfig?.site || 'A cadastrar';
  const companyStreetNumber = [appConfig?.companyStreet, appConfig?.companyNumber].filter(Boolean).join(', ');
  const companyComplement = String(appConfig?.companyComplement || '').trim();
  const companyCityState = [appConfig?.companyCity, appConfig?.companyState].filter(Boolean).join('/');
  let companyAddressCompact = [
    companyStreetNumber ? `${companyStreetNumber}${companyComplement ? `, ${companyComplement}` : ''}` : '',
    companyCityState,
  ].filter(Boolean).join(' - ');
  if (!companyAddressCompact) companyAddressCompact = String(appConfig?.companyAddress || '').trim() || 'Não cadastrado';

  const fileName = `PPC-Relatorio-Semana-${week.weekNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ margin: 34, size: 'A4', bufferPages: true });
  doc.pipe(res);

  const COLORS = {
    border: '#b7cfe8',
    box: '#f2f8ff',
    boxStrong: '#dcebff',
    title: '#c8def8',
    text: '#1e3c59',
    rowA: '#f7fbff',
    rowB: '#eaf3ff',
    header: '#d4e6fb',
    faceGood: '#21a35e',
    faceRegular: '#f2c94c',
    faceBad: '#d14b52',
  };
  const margin = 34;
  const contentWidth = doc.page.width - (margin * 2);
  const pageBottom = () => doc.page.height - margin;
  const rowH = 20;
  let y = margin;
  const RUNNING_HEADER_H = 20;
  const CONTENT_TOP = margin + RUNNING_HEADER_H + 8;
  const tocEntries = [];
  const tocSeen = new Set();
  const canUsePdfDestinations = typeof doc.addNamedDestination === 'function' && typeof doc.goTo === 'function';
  const formatNumberBrLocal = (value, decimals = 2) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };
  const formatPercentBrLocal = (value, decimals = 2) => `${formatNumberBrLocal(value, decimals)}%`;
  const textYCenteredInRow = (rowTop, rowHeight, fontSize) => rowTop + Math.max(0, ((rowHeight - fontSize) / 2) - 1);

  const drawRoundBox = (x, yPos, w, h, fill = COLORS.box, stroke = COLORS.border, radius = 8) => {
    doc
      .save()
      .fillColor(fill)
      .strokeColor(stroke)
      .lineWidth(0.7)
      .roundedRect(x, yPos, w, h, radius)
      .fillAndStroke()
      .restore();
  };

  const drawTitleStrip = (yPos, text) => {
    const h = 28;
    drawRoundBox(margin, yPos, contentWidth, h, COLORS.title, COLORS.border);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
      .text(String(text || ''), margin, yPos + 8, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
    return yPos + h + 6;
  };

  const currentDocPageNumber = () => doc.bufferedPageRange().count;

  const registerTocEntry = (title, destination) => {
    const normalized = String(title || '').trim().toUpperCase();
    if (!normalized) return;
    if (tocSeen.has(normalized)) return;
    tocSeen.add(normalized);
    tocEntries.push({
      title: normalized,
      page: currentDocPageNumber(),
      destination: destination || '',
      level: /^\d+\.\d+/.test(normalized) ? 2 : 1,
    });
  };

  const drawRunningHeader = () => {
    const headY = margin;
    drawRoundBox(margin, headY, contentWidth, RUNNING_HEADER_H, '#eef6ff', COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.5)
      .text(`PPC RELATÓRIO - Semana ${week.weekNumber}`, margin + 8, headY + 6, {
        width: 180,
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(8.2)
      .text(String(week.work?.name || '-'), margin + 188, headY + 6, {
        width: contentWidth - 196,
        align: 'right',
        lineBreak: false,
        ellipsis: true,
      });
  };

  const drawInfoBoxInline = ({
    x, yPos, w, h, label, value, align = 'left',
  }) => {
    drawRoundBox(x, yPos, w, h);
    const labelText = `${String(label || '').trim()}:`;
    const lineY = yPos + ((h - 10) / 2);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.1)
      .text(labelText, x + 8, lineY, { lineBreak: false });
    const lw = doc.widthOfString(labelText) + 6;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.3)
      .text(String(value || '-'), x + 8 + lw, lineY, {
        width: w - 16 - lw,
        align,
        lineBreak: false,
        ellipsis: true,
      });
  };

  const classifyBand = (value, regular, good) => {
    const score = Number(value);
    if (!Number.isFinite(score)) return '-';
    if (score >= Number(good)) return 'Bom';
    if (score >= Number(regular)) return 'Regular';
    return 'Ruim';
  };

  const bandVisual = (band) => {
    const normalized = String(band || '').trim().toUpperCase();
    if (normalized === 'BOM') return { mood: 'good', color: COLORS.faceGood };
    if (normalized === 'REGULAR') return { mood: 'regular', color: COLORS.faceRegular };
    if (normalized === 'RUIM') return { mood: 'bad', color: COLORS.faceBad };
    return null;
  };

  const drawBandFace = (x, yPos, size, band) => {
    const visual = bandVisual(band);
    if (!visual) return;
    const r = Math.max(4, size / 2);
    const cx = x + r;
    const cy = yPos + r;

    doc.save();
    doc.circle(cx, cy, r).fillAndStroke(visual.color, '#336079');
    doc.fillColor('#1e3240');
    doc.circle(cx - (r * 0.35), cy - (r * 0.25), Math.max(0.8, r * 0.1)).fill();
    doc.circle(cx + (r * 0.35), cy - (r * 0.25), Math.max(0.8, r * 0.1)).fill();
    doc.lineWidth(1).strokeColor('#1e3240');
    if (visual.mood === 'good') {
      doc.moveTo(cx - (r * 0.48), cy + (r * 0.25))
        .quadraticCurveTo(cx, cy + (r * 0.72), cx + (r * 0.48), cy + (r * 0.25))
        .stroke();
    } else if (visual.mood === 'bad') {
      doc.moveTo(cx - (r * 0.48), cy + (r * 0.52))
        .quadraticCurveTo(cx, cy + (r * 0.1), cx + (r * 0.48), cy + (r * 0.52))
        .stroke();
    } else {
      doc.moveTo(cx - (r * 0.45), cy + (r * 0.42))
        .lineTo(cx + (r * 0.45), cy + (r * 0.42))
        .stroke();
    }
    doc.restore();
  };

  const drawCompanyHeaderBlock = (initialY = margin) => {
    let headerY = initialY;
    const logoW = 98;
    const logoH = 64;
    const gap = 8;
    const rightX = margin + logoW + gap;
    const rightW = contentWidth - logoW - gap;
    const rowTopH = 26;
    const topHeaderH = Math.max(logoH, (rowTopH * 2) + 20);

    drawRoundBox(margin, headerY, logoW, logoH);
    let logoRendered = false;
    if (appConfig?.logoPath) {
      try {
        const logoDataUrl = String(appConfig.logoPath || '').trim();
        if (logoDataUrl.startsWith('data:image/')) {
          const logoBuffer = decodeImageDataUrl(logoDataUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, margin + 6, headerY + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
            logoRendered = true;
          }
        } else if (fs.existsSync(appConfig.logoPath)) {
          doc.image(appConfig.logoPath, margin + 6, headerY + 6, { fit: [logoW - 12, logoH - 12], align: 'center', valign: 'center' });
          logoRendered = true;
        }
      } catch {
        logoRendered = false;
      }
    }
    if (!logoRendered) {
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text('LOGO', margin, headerY + 25, { width: logoW, align: 'center' });
    }

    drawRoundBox(rightX, headerY, rightW, rowTopH);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.2)
      .text(String(appConfig?.companyName || 'Não cadastrado'), rightX + 8, headerY + 7, {
        width: rightW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });

    const secondRowH = 30;
    const secondRowY = headerY + logoH - secondRowH;
    const cnpjW = 136;
    const addrX = rightX + cnpjW + 4;
    const addrW = rightW - cnpjW - 4;
    drawInfoBoxInline({
      x: rightX,
      yPos: secondRowY,
      w: cnpjW,
      h: secondRowH,
      label: 'CNPJ',
      value: appConfig?.companyCnpj || 'Não cadastrado',
    });
    drawRoundBox(addrX, secondRowY, addrW, secondRowH);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.1)
      .text(String(companyAddressCompact), addrX + 8, secondRowY + 6, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(7.0)
      .text(String(companyWebsite), addrX + 8, secondRowY + 18, {
        width: addrW - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });

    return headerY + topHeaderH + 8;
  };

  const drawCoverPage = () => {
    const afterHeaderY = drawCompanyHeaderBlock(margin);
    const centerY = Math.max(afterHeaderY + 16, (doc.page.height / 2) - 80);
    const periodText = `${formatDateBr(week.startDate)} a ${formatDateBr(week.endDate)}`;
    const workName = String(week.work?.name || '-');
    const workAddress = `${String(week.work?.address || '-')}${week.work?.cep ? ` | CEP ${week.work.cep}` : ''}`;

    drawRoundBox(margin, centerY, contentWidth, 170, '#f7fbff', COLORS.border, 10);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(24)
      .text(`PPC RELATÓRIO - SEMANA ${week.weekNumber}`, margin + 16, centerY + 24, {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
      });
    doc.font('Helvetica').fontSize(14.5)
      .text(periodText, margin + 16, centerY + 62, {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
      });
    doc.font('Helvetica-Bold').fontSize(16)
      .text(workName.toUpperCase(), margin + 16, centerY + 100, {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.font('Helvetica').fontSize(11)
      .text(workAddress.toUpperCase(), margin + 16, centerY + 132, {
        width: contentWidth - 32,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
  };

  const drawCommonHeader = () => {
    let headerY = y;
    headerY = drawTitleStrip(headerY, `Relatório - Semana ${week.weekNumber}`);

    drawInfoBoxInline({
      x: margin,
      yPos: headerY,
      w: contentWidth,
      h: 22,
      label: 'Obra',
      value: week.work?.name || '-',
    });
    headerY += 26;
    drawInfoBoxInline({
      x: margin,
      yPos: headerY,
      w: contentWidth,
      h: 22,
      label: 'Endereço da obra',
      value: `${week.work?.address || '-'} | CEP ${week.work?.cep || '-'}`,
    });
    headerY += 28;

    drawRoundBox(margin, headerY, contentWidth, 54);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.7)
      .text(
        `Fechamento do planejamento: ${planningClosedAtText}${week.planningClosedBy?.name ? ` por ${week.planningClosedBy.name}` : ''}`,
        margin + 8,
        headerY + 8,
        { width: contentWidth - 16, lineBreak: false },
      );
    doc.text(
      `Fechamento do feedback: ${feedbackClosedAtText}${week.feedbackClosedBy?.name ? ` por ${week.feedbackClosedBy.name}` : ''}`,
      margin + 8,
      headerY + 22,
      { width: contentWidth - 16, lineBreak: false },
    );
    doc.text(
      `Documento impresso em: ${printedAtText}`,
      margin + 8,
      headerY + 36,
      { width: contentWidth - 16, lineBreak: false },
    );
    return headerY + 60;
  };

  const addPageAndHeader = () => {
    doc.addPage();
    y = CONTENT_TOP;
  };
  const ensureSpace = (neededHeight) => {
    if (y + neededHeight > pageBottom() - 18) {
      addPageAndHeader();
    }
  };
  const drawSectionTitle = (text, minContentHeight = 0) => {
    const normalized = String(text || '').trim().toUpperCase();
    const destination = `dest_${normalized
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120)}`;
    registerTocEntry(normalized, destination);
    ensureSpace(27 + Math.max(0, Number(minContentHeight) || 0));
    if (canUsePdfDestinations) {
      try {
        doc.addNamedDestination(destination);
      } catch {
        // no-op
      }
    }
    drawRoundBox(margin, y, contentWidth, 22, COLORS.boxStrong, COLORS.border, 6);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.6)
      .text(normalized, margin + 8, y + 7, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    y += 27;
  };
  const drawTextInsideBox = ({
    x,
    yPos,
    w,
    h,
    text,
    font = 'Helvetica',
    fontSize = 8.8,
    align = 'justify',
    color = COLORS.text,
    paddingX = 10,
    minTopPadding = 8,
    lineGap = 1.2,
  }) => {
    const contentW = Math.max(10, w - (paddingX * 2));
    doc.fillColor(color).font(font).fontSize(fontSize);
    const textH = doc.heightOfString(String(text || ''), {
      width: contentW,
      align,
      lineGap,
    });
    const centeredY = yPos + Math.max(minTopPadding, (h - textH) / 2);
    doc.text(String(text || ''), x + paddingX, centeredY, {
      width: contentW,
      align,
      lineGap,
    });
  };

  drawCoverPage();
  addPageAndHeader();
  const tocPageIndex = doc.bufferedPageRange().count - 1;
  drawRoundBox(margin, y, contentWidth, 28, COLORS.title, COLORS.border, 8);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
    .text('SUMÁRIO', margin + 8, y + 8, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });

  addPageAndHeader();
  drawSectionTitle('1 - INTRODUÇÃO', 214);
  const introBoxH = 206;
  drawRoundBox(margin, y, contentWidth, introBoxH, '#f7fbff', COLORS.border, 7);
  const introText = [
    'Este relatório semanal consolida, em uma única visão executiva, o desempenho do ciclo de Planejamento e Controle da Produção (PPC) da obra. O documento é emitido somente após o fechamento do feedback e da qualidade percebida da semana, garantindo rastreabilidade, consistência dos dados e segurança para análise gerencial.',
    'O Capítulo 2 apresenta a ANÁLISE DO PPC: atividades planejadas e executadas, distribuição de status das tarefas, desempenho por empreiteiro, causas de não cumprimento, indicadores complementares, pendências remanescentes e mapa de calor operacional por zona.',
    'O Capítulo 3 trata da QUALIDADE PERCEBIDA dos empreiteiros ativos, combinando resultados de prazo (PPC), qualidade, colaboração, segurança e limpeza, além do registro de presença na reunião de PPC.',
    'O Capítulo 4 detalha a QUALIDADE DA PROGRAMAÇÃO em dois momentos críticos: (i) aderência entre pré-programação e programação final e (ii) aderência entre programação final e execução reportada no feedback.',
    'O Capítulo 5 consolida a GOVERNANÇA do processo, evidenciando cumprimento de prazos de fechamento, responsáveis por cada etapa e comportamento de uso do sistema por usuário na semana analisada.',
  ].join('\n\n');
  drawTextInsideBox({
    x: margin,
    yPos: y,
    w: contentWidth,
    h: introBoxH,
    text: introText,
    font: 'Helvetica',
    fontSize: 9.4,
    align: 'justify',
    paddingX: 12,
    minTopPadding: 10,
    lineGap: 1.6,
  });
  y += 214;

  addPageAndHeader();
  drawSectionTitle('2 - ANÁLISE DO PPC');
  drawSectionTitle('2.1 - ATIVIDADES PLANEJADAS E EXECUTADAS', 126);
  const kpiOuterH = 74;
  const kpiInnerH = 58;
  drawRoundBox(margin, y, contentWidth, kpiOuterH, '#edf7ef', '#b9dcbc', 7);
  const counterGap = 6;
  const counterW = (contentWidth - (counterGap * 2) - 10) / 3;
  const c1x = margin + 5;
  const c2x = c1x + counterW + counterGap;
  const c3x = c2x + counterW + counterGap;
  const ppcBelowTarget = Number(executedVsPlannedPct) < Number(ppcTargetPct);
  drawRoundBox(c1x, y + 8, counterW, kpiInnerH, '#f1f7ff', '#b7cfe8', 6);
  drawRoundBox(c2x, y + 8, counterW, kpiInnerH, '#f6fbf7', '#b9dcbc', 6);
  drawRoundBox(c3x, y + 8, counterW, kpiInnerH, ppcBelowTarget ? '#c0392b' : '#eef8fb', ppcBelowTarget ? '#9b1c1c' : '#b7d9e4', 6);
  doc.fillColor('#244e83').font('Helvetica-Bold').fontSize(9.1)
    .text('ATIVIDADES EXECUTADAS', c1x + 4, y + 14, {
      width: counterW - 8,
      align: 'center',
      lineBreak: false,
    });
  doc.fontSize(18.2)
    .text(String(executedPlannedActivities), c1x + 4, y + 38, {
      width: counterW - 8,
      align: 'center',
      lineBreak: false,
    });
  doc.fillColor('#1f6f45').font('Helvetica-Bold').fontSize(9.1)
    .text('ATIVIDADES PLANEJADAS', c2x + 4, y + 14, {
      width: counterW - 8,
      align: 'center',
      lineBreak: false,
    });
  doc.fontSize(18.2)
    .text(String(plannedActivities), c2x + 4, y + 38, {
      width: counterW - 8,
      align: 'center',
      lineBreak: false,
    });
  doc.fillColor(ppcBelowTarget ? '#ffffff' : '#2f5e77').font('Helvetica-Bold').fontSize(9.1)
    .text('% ATIVIDADES EXECUTADAS', c3x + 4, y + 12, {
      width: counterW - 8,
      align: 'center',
      lineBreak: false,
    });
  doc.fillColor(ppcBelowTarget ? '#ffffff' : '#2f5e77').fontSize(14.6)
    .text(`${formatPercentBrLocal(executedVsPlannedPct, 2)}`, c3x + 4, y + 34, {
      width: counterW - 8,
      align: 'center',
      lineBreak: false,
    });
  doc.fillColor(ppcBelowTarget ? '#ffffff' : '#2f5e77').font('Helvetica-Bold').fontSize(8.2)
    .text(`Meta ${formatPercentBrLocal(ppcTargetPct, 2)}`, c3x + 4, y + 53, {
      width: counterW - 8,
      align: 'center',
      lineBreak: false,
    });
  y += (kpiOuterH + 8);

  if (ppcBelowTarget) {
    ensureSpace(30);
    drawRoundBox(margin, y, contentWidth, 24, '#c0392b', '#9b1c1c', 6);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10.4)
      .text('PPC SEMANAL ABAIXO DA META', margin + 8, y + 7, {
        width: contentWidth - 16,
        align: 'center',
        lineBreak: false,
      });
    y += 30;
  }

  ensureSpace(86);
  drawRoundBox(margin, y, contentWidth, 80, '#f4f9ff', COLORS.border, 6);
  drawTextInsideBox({
    x: margin,
    yPos: y,
    w: contentWidth,
    h: 80,
    text: [
      'São consideradas aqui apenas as atividades que foram planejadas na semana anterior. Atividades que foram executadas, mas não foram planejadas, não são contabilizadas.',
      `Meta de PPC cadastrada para a obra: ${formatPercentBrLocal(ppcTargetPct, 2)}.`,
      'Atividades em status Reserva: se executadas, contam como atividade planejada e executada; se não executadas, não entram como atividade planejada.',
    ].join('\n'),
    font: 'Helvetica',
    fontSize: 8.9,
    align: 'justify',
    paddingX: 10,
    minTopPadding: 8,
    lineGap: 1.4,
  });
  y += 86;

  const statusChartBoxHeight = 188;
  const statusChartTotalBoxHeight = statusChartBoxHeight + 36;
  drawSectionTitle('2.2 - DISTRIBUIÇÃO DE STATUS DE TAREFAS', statusChartBoxHeight + 54);
  drawRoundBox(margin, y, contentWidth, statusChartTotalBoxHeight, COLORS.box, COLORS.border, 7);
  drawVerticalBarChart(doc, {
    x: margin + 4,
    y: y + 2,
    width: contentWidth - 8,
    height: statusChartBoxHeight - 34,
    bars: metrics.statusBars.map((item) => ({
      label: item.label,
      pct: item.pct,
      count: item.count,
      color: item.color,
    })),
    title: '% por status da semana',
    axisTitleY: '%',
    annotationStyle: 'pct_bubble',
    pctLabelFontSize: 9.4,
    countBubbleFontSize: 9.2,
  });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10.4)
    .text(`Número total de atividades: ${String(metrics.totalActivities || 0)}`, margin + 8, y + statusChartBoxHeight - 4, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });
  drawTextInsideBox({
    x: margin,
    yPos: y + statusChartBoxHeight + 8,
    w: contentWidth,
    h: 20,
    text: 'São consideradas aqui todas as atividades, planejadas ou não. Incluem-se as tarefas canceladas e as tarefas não planejadas e executadas.',
    font: 'Helvetica',
    fontSize: 8.6,
    align: 'justify',
    paddingX: 10,
    minTopPadding: 4,
    lineGap: 1.1,
  });
  y += statusChartTotalBoxHeight + 6;

  const contractorChartBoxHeight = 214;
  drawSectionTitle('2.3 - % DE TAREFAS EXECUTADAS POR EMPREITEIRO ATIVO', contractorChartBoxHeight);
  drawRoundBox(margin, y, contentWidth, contractorChartBoxHeight - 8, COLORS.box, COLORS.border, 7);
  const contractorBars = metrics.contractorRows.slice(0, 12).map((row) => ({
    label: row.contractor,
    pct: row.executionPct,
    value: row.executionPct,
    color: '#2f8f65',
  }));
  drawVerticalBarChart(doc, {
    x: margin + 4,
    y: y + 2,
    width: contentWidth - 8,
    height: contractorChartBoxHeight - 54,
    bars: contractorBars,
    title: '% executado por empreiteiro',
    axisTitleY: '%',
  });
  drawTextInsideBox({
    x: margin,
    yPos: y + contractorChartBoxHeight - 44,
    w: contentWidth,
    h: 34,
    text: 'São consideradas aqui apenas as atividades que foram planejadas na semana anterior. Atividades executadas e não planejadas não são contabilizadas. Atividades em status Reserva: se executadas, contam como atividade planejada e executada; se não executadas, não entram como atividade planejada.',
    font: 'Helvetica',
    fontSize: 8.3,
    align: 'justify',
    paddingX: 10,
    minTopPadding: 4,
    lineGap: 1.1,
  });
  y += contractorChartBoxHeight + 2;
  if (metrics.contractorRows.length > 12) {
    ensureSpace(16);
    doc.fillColor('#4b6784').font('Helvetica').fontSize(7.1)
      .text(`* Exibindo os 12 primeiros de ${metrics.contractorRows.length} empreiteiros.`, margin + 4, y, {
        width: contentWidth - 8,
        align: 'right',
      });
    y += 14;
  }

  const contractorCauseChartBoxHeight = 214;
  drawSectionTitle('2.4 - % DE NÃO CUMPRIMENTO POR CAUSA ESPECÍFICA DO EMPREITEIRO', contractorCauseChartBoxHeight);
  drawRoundBox(margin, y, contentWidth, contractorCauseChartBoxHeight - 8, COLORS.box, COLORS.border, 7);
  const contractorCauseBars = contractorSpecificCauseRows.slice(0, 12).map((row) => ({
    label: row.contractor,
    pct: row.pct,
    count: row.nonExecutedWithContractorSpecificCause,
    color: '#9b1c31',
  }));
  drawVerticalBarChart(doc, {
    x: margin + 4,
    y: y + 2,
    width: contentWidth - 8,
    height: contractorCauseChartBoxHeight - 54,
    bars: contractorCauseBars,
    title: '% de não cumprimento por causa específica',
    axisTitleY: '%',
    annotationStyle: 'pct_bubble',
    pctLabelFontSize: 9.0,
    countBubbleFontSize: 8.8,
  });
  drawTextInsideBox({
    x: margin,
    yPos: y + contractorCauseChartBoxHeight - 44,
    w: contentWidth,
    h: 34,
    text: 'Este gráfico apresenta, por empreiteiro, o percentual de tarefas não executadas com causa específica do empreiteiro em relação ao total de atividades planejadas da semana. Atividades em status Reserva: se executadas, contam como atividade planejada e executada; se não executadas, não entram como atividade planejada.',
    font: 'Helvetica',
    fontSize: 8.3,
    align: 'justify',
    paddingX: 10,
    minTopPadding: 4,
    lineGap: 1.1,
  });
  y += contractorCauseChartBoxHeight + 2;

  drawSectionTitle('2.5 - MELHORES EMPREITEIROS DA SEMANA', rowH * 2);
  const rankingColumns = [
    { title: 'Ranking', key: 'rank', width: 70 },
    { title: 'Empreiteiro', key: 'contractor', width: contentWidth - 160 },
    { title: '% desempenho', key: 'pct', width: 90 },
  ];
  const drawSimpleHeader = (columns) => {
    drawRoundBox(margin, y, contentWidth, rowH, COLORS.header, COLORS.border, 4);
    let x = margin;
    columns.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, y).lineTo(x, y + rowH).stroke().restore();
      }
      const fz = 7.4;
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.4)
        .text(col.title, x + 2, textYCenteredInRow(y, rowH, fz), {
          width: col.width - 4,
          align: col.align || 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    y += rowH;
  };
  const drawSimpleRow = (columns, rowData, rowIndex) => {
    const fill = rowIndex % 2 === 0 ? COLORS.rowA : COLORS.rowB;
    drawRoundBox(margin, y, contentWidth, rowH, fill, COLORS.border, 3);
    let x = margin;
    columns.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(x, y).lineTo(x, y + rowH).stroke().restore();
      }
      const fz = 7.3;
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.3)
        .text(String(rowData[col.key] ?? ''), x + 2, textYCenteredInRow(y, rowH, fz), {
          width: col.width - 4,
          align: col.align || 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    y += rowH;
  };

  drawSimpleHeader(rankingColumns);
  const rankingRows = contractorSpecificCauseRows
    .map((row) => ({
      contractor: row.contractor,
      pct: Number((100 - Number(row.pct || 0)).toFixed(2)),
    }))
    .sort((a, b) => (
      Number(b.pct) - Number(a.pct)
      || String(a.contractor || '').localeCompare(String(b.contractor || ''), 'pt-BR')
    ))
    .map((row, index) => ({
    rank: String(index + 1),
    contractor: row.contractor,
      pct: formatPercentBrLocal(row.pct, 2),
    }));
  if (!rankingRows.length) {
    ensureSpace(rowH);
    drawSimpleRow(rankingColumns, {
      rank: '-',
      contractor: 'Sem dados de empreiteiros na semana.',
      pct: '-',
    }, 0);
  } else {
    rankingRows.forEach((row, idx) => {
      ensureSpace(rowH + 2);
      if (y + rowH > pageBottom() - 18) {
        addPageAndHeader();
        drawSectionTitle('2.5 - MELHORES EMPREITEIROS DA SEMANA');
        drawSimpleHeader(rankingColumns);
      }
      drawSimpleRow(rankingColumns, row, idx);
    });
  }
  y += 4;
  ensureSpace(36);
  drawRoundBox(margin, y, contentWidth, 30, '#f4f9ff', COLORS.border, 5);
  drawTextInsideBox({
    x: margin,
    yPos: y,
    w: contentWidth,
    h: 30,
    text: 'O ranking foi calculado por: 100% - % de não cumprimento por causa específica do empreiteiro. Assim, o empreiteiro não é penalizado por causas que não dependem apenas dele.',
    font: 'Helvetica',
    fontSize: 8.5,
    align: 'justify',
    paddingX: 10,
    minTopPadding: 5,
    lineGap: 1.1,
  });
  y += 36;

  drawSectionTitle('2.6 - CAUSAS MAIS FREQUENTES', rowH * 2);
  const causeColumns = [
    { title: 'Causa', key: 'causeLabel', width: contentWidth - 132, align: 'center' },
    { title: 'Eventos', key: 'count', width: 62 },
    { title: '%', key: 'pct', width: 70 },
  ];
  drawSimpleHeader(causeColumns);
  if (!metrics.groupedCauses.length) {
    drawSimpleRow(causeColumns, {
      causeLabel: 'Sem causas registradas na semana.',
      count: '-',
      pct: '-',
    }, 0);
  } else {
    metrics.groupedCauses.forEach((item, idx) => {
      if (y + rowH > pageBottom() - 18) {
        addPageAndHeader();
        drawSectionTitle('2.6 - CAUSAS MAIS FREQUENTES');
        drawSimpleHeader(causeColumns);
      }
      if (item.type === 'CATEGORY') {
        drawRoundBox(margin, y, contentWidth, rowH, '#e3f1ff', COLORS.border, 3);
        let cx = margin;
        causeColumns.forEach((col, colIdx) => {
          if (colIdx > 0) {
            doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(cx, y).lineTo(cx, y + rowH).stroke().restore();
          }
          const text = col.key === 'causeLabel'
            ? String(item.category || '').toUpperCase()
            : (col.key === 'count'
              ? String(item.count)
              : (col.key === 'pct' ? formatPercentBrLocal(Number(item.pct || 0), 2) : ''));
          doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.2)
            .text(text, cx + 2, textYCenteredInRow(y, rowH, 7.2), {
              width: col.width - 4,
              align: 'center',
              lineBreak: false,
              ellipsis: true,
            });
          cx += col.width;
        });
        y += rowH;
      } else {
        drawSimpleRow(causeColumns, {
          causeLabel: `   - ${String(item.cause || '-')}`,
          count: String(item.count),
          pct: formatPercentBrLocal(Number(item.pct || 0), 2),
        }, idx);
      }
    });
  }
  y += 4;
  const totalCausesCount = (metrics.causes || []).reduce((acc, item) => acc + Number(item.count || 0), 0);
  ensureSpace(24);
  drawRoundBox(margin, y, contentWidth, 18, '#f4f9ff', COLORS.border, 5);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
    .text('Total de causas para não cumprimento das tarefas: ', margin + 8, y + 5, {
      width: contentWidth - 16,
      align: 'left',
      lineBreak: false,
    });
  doc.font('Helvetica-Bold')
    .text(String(totalCausesCount), margin + 206, y + 5, {
      width: 60,
      align: 'left',
      lineBreak: false,
    });
  y += 24;

  drawSectionTitle('2.7 - INDICADORES COMPLEMENTARES DA SEMANA', 95);
  const cardGap = 8;
  const cardW = (contentWidth - (cardGap * 3)) / 4;
  const cardH = 66;
  const summaryCards = [
    {
      label: 'Atividades canceladas',
      value: String(metrics.totals.cancelled),
      bg: '#f3f5f8',
      fg: '#4b6784',
    },
    {
      label: 'Executadas sem planejamento',
      value: String(metrics.totals.unplannedExecuted),
      bg: '#e9f1ff',
      fg: '#295e98',
    },
    {
      label: 'Pendentes resolvidas',
      value: String(pendingResolved.length),
      bg: '#eaf8ef',
      fg: '#246c45',
    },
    {
      label: '% pendentes resolvidas',
      value: formatPercentBrLocal(pendingResolvedPct, 2),
      bg: '#eef8fb',
      fg: '#2f5e77',
    },
  ];
  summaryCards.forEach((card, idx) => {
    const x = margin + (idx * (cardW + cardGap));
    drawRoundBox(x, y, cardW, cardH, card.bg, COLORS.border, 7);
    doc.fillColor(card.fg).font('Helvetica-Bold').fontSize(8.0)
      .text(card.label, x + 8, y + 8, {
        width: cardW - 16,
        align: 'center',
      });
    doc.fontSize(15)
      .text(card.value, x + 8, y + 33, {
        width: cardW - 16,
        align: 'center',
        lineBreak: false,
      });
  });
  y += cardH + 10;

  drawRoundBox(margin, y, contentWidth, 26, '#f4f9ff', COLORS.border, 6);
  drawTextInsideBox({
    x: margin,
    yPos: y,
    w: contentWidth,
    h: 26,
    text: `Base pendentes: ${pendingFromPrior.length} | Resolvidas: ${pendingResolved.length} | Remanescentes: ${pendingRemaining.length}`,
    font: 'Helvetica',
    fontSize: 8.6,
    align: 'center',
    paddingX: 8,
    minTopPadding: 4,
    lineGap: 1,
  });
  y += 32;

  drawSectionTitle('2.8 - PENDÊNCIAS REMANESCENTES E HISTÓRICO DE CAUSAS POR SEMANA', rowH * 2);
  const pendingColumns = [
    { title: 'Tarefa', key: 'description', width: 130, align: 'center' },
    { title: 'Empreiteiro', key: 'contractor', width: 88, align: 'center' },
    { title: 'Sem. origem', key: 'originWeek', width: 48, align: 'center' },
    { title: 'Zona 1', key: 'location1', width: 70, align: 'center' },
    { title: 'Zona 2', key: 'location2', width: 58, align: 'center' },
    { title: 'Histórico de causas', key: 'history', width: contentWidth - (130 + 88 + 48 + 70 + 58), align: 'center' },
  ];

  const drawPendingHeader = () => {
    drawRoundBox(margin, y, contentWidth, rowH, COLORS.header, COLORS.border, 4);
    let x = margin;
    pendingColumns.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, y).lineTo(x, y + rowH).stroke().restore();
      }
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.1)
        .text(col.title, x + 2, y + 6, {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    y += rowH;
  };

  const drawPendingRow = (row, rowIndex) => {
    const fontSize = 6.6;
    const paddingY = 4;
    const heights = pendingColumns.map((col) => {
      doc.font('Helvetica').fontSize(fontSize);
      return doc.heightOfString(String(row[col.key] ?? ''), {
        width: col.width - 6,
        lineGap: 0.4,
      });
    });
    const dynamicH = Math.max(22, Math.ceil(Math.max(...heights) + (paddingY * 2)));
    if (y + dynamicH > pageBottom() - 18) {
      addPageAndHeader();
      drawSectionTitle('2.8 - PENDÊNCIAS REMANESCENTES E HISTÓRICO DE CAUSAS POR SEMANA');
      drawPendingHeader();
    }

    const fill = rowIndex % 2 === 0 ? COLORS.rowA : COLORS.rowB;
    drawRoundBox(margin, y, contentWidth, dynamicH, fill, COLORS.border, 3);
    let x = margin;
    pendingColumns.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(x, y).lineTo(x, y + dynamicH).stroke().restore();
      }
      const text = String(row[col.key] ?? '');
      doc.font('Helvetica').fontSize(fontSize);
      const textHeight = doc.heightOfString(text, {
        width: col.width - 6,
        align: 'center',
        lineGap: 0.4,
      });
      const textY = y + Math.max(0, (dynamicH - textHeight) / 2);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(fontSize)
        .text(text, x + 3, textY, {
          width: col.width - 6,
          align: 'center',
          lineGap: 0.4,
        });
      x += col.width;
    });
    y += dynamicH;
  };

  drawPendingHeader();
  if (!pendingRemainingRows.length) {
    drawPendingRow({
      description: 'Sem pendências remanescentes na semana.',
      contractor: '-',
      originWeek: '-',
      location1: '-',
      location2: '-',
      history: '-',
    }, 0);
  } else {
    pendingRemainingRows.forEach((item, idx) => drawPendingRow(item, idx));
  }

  y += 8;
  drawSectionTitle('2.9 - MAPA DE CALOR');
  const heatMapColumns = [
    { title: 'Ranking', key: 'rank', width: 64 },
    { title: 'Local nível 1', key: 'location1', width: contentWidth - 164 },
    { title: 'Atividades executadas', key: 'planned', width: 100 },
  ];
  drawSimpleHeader(heatMapColumns);
  if (!heatMapRows.length) {
    drawSimpleRow(heatMapColumns, {
      rank: '-',
      location1: 'Sem atividades executadas por local nível 1 na semana.',
      planned: '-',
    }, 0);
  } else {
    heatMapRows.forEach((row, idx) => {
      if (y + rowH > pageBottom() - 18) {
        addPageAndHeader();
        drawSectionTitle('2.9 - MAPA DE CALOR');
        drawSimpleHeader(heatMapColumns);
      }
      drawSimpleRow(heatMapColumns, {
        rank: String(idx + 1),
        location1: String(row.location1 || '-'),
        planned: String(Number(row.planned || 0)),
      }, idx);
    });
  }

  addPageAndHeader();
  drawSectionTitle('3 - QUALIDADE PERCEBIDA', 40);

  const qualityColumns = [
    { key: 'seq', title: '#', width: 24, align: 'center' },
    { key: 'contractor', title: 'Empreiteiro', width: 124, align: 'center' },
    { key: 'ppc', title: 'PPC', width: 54, align: 'center' },
    { key: 'collaboration', title: 'Colaboração', width: 54, align: 'center' },
    { key: 'cleaning', title: 'Limpeza', width: 54, align: 'center' },
    { key: 'quality', title: 'Qualidade', width: 54, align: 'center' },
    { key: 'safety', title: 'Segurança', width: 54, align: 'center' },
    { key: 'comments', title: 'Comentários', width: contentWidth - (24 + 124 + (54 * 5)), align: 'center' },
  ];
  const qualityRowH = 30;
  const faceSize = 13;
  const formatScore = (value, { pct = false } = {}) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return pct ? `${num.toFixed(1).replace('.', ',')}%` : `${num.toFixed(1).replace('.', ',')}`;
  };

  const drawQualityHeader = () => {
    drawRoundBox(margin, y, contentWidth, qualityRowH, COLORS.header, COLORS.border, 4);
    let x = margin;
    qualityColumns.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, y).lineTo(x, y + qualityRowH).stroke().restore();
      }
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.3)
        .text(col.title, x + 2, textYCenteredInRow(y, qualityRowH, 7.3), {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    y += qualityRowH;
  };

  const drawQualityRow = (row, index) => {
    const fill = index % 2 === 0 ? COLORS.rowA : COLORS.rowB;
    drawRoundBox(margin, y, contentWidth, qualityRowH, fill, COLORS.border, 3);
    const ppcBand = classifyBand(row.ppcPct, qualityThresholds.deadlineRegular, qualityThresholds.deadlineGood);
    const collabBand = row.collaborationScore === null ? '-' : classifyBand(row.collaborationScore, qualityThresholds.collaborationRegular, qualityThresholds.collaborationGood);
    const cleaningBand = row.cleaningScore === null ? '-' : classifyBand(row.cleaningScore, qualityThresholds.cleaningRegular, qualityThresholds.cleaningGood);
    const qualityBand = row.qualityScore === null ? '-' : classifyBand(row.qualityScore, qualityThresholds.qualityRegular, qualityThresholds.qualityGood);
    const safetyBand = row.safetyScore === null ? '-' : classifyBand(row.safetyScore, qualityThresholds.safetyRegular, qualityThresholds.safetyGood);

    const values = {
      seq: String(index + 1),
      contractor: row.contractorName || '-',
      ppc: formatScore(row.ppcPct, { pct: true }),
      collaboration: formatScore(row.collaborationScore),
      cleaning: formatScore(row.cleaningScore),
      quality: formatScore(row.qualityScore),
      safety: formatScore(row.safetyScore),
      comments: String(row.comments || '-'),
    };
    const bands = {
      ppc: ppcBand,
      collaboration: collabBand,
      cleaning: cleaningBand,
      quality: qualityBand,
      safety: safetyBand,
    };

    let x = margin;
    qualityColumns.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(x, y).lineTo(x, y + qualityRowH).stroke().restore();
      }
      const band = bands[col.key] || null;
      if (band && band !== '-') {
        drawBandFace(x + 3, y + ((qualityRowH - faceSize) / 2), faceSize, band);
      }
      const hasFace = !!(band && band !== '-');
      const textX = hasFace ? x + 18 : x + 2;
      const textW = hasFace ? col.width - 20 : col.width - 4;
      const rowFont = col.key === 'contractor' ? 7.2 : 7.0;
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(rowFont)
        .text(values[col.key], textX, textYCenteredInRow(y, qualityRowH, rowFont), {
          width: textW,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    y += qualityRowH;
  };

  drawQualityHeader();
  if (!weeklyPerceivedQualityRows.length) {
    drawRoundBox(margin, y, contentWidth, qualityRowH, COLORS.rowA, COLORS.border, 3);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.2)
      .text('Sem avaliações de qualidade percebida para a semana.', margin + 8, y + 10, {
        width: contentWidth - 16,
        align: 'center',
      });
    y += qualityRowH;
  } else {
    weeklyPerceivedQualityRows.forEach((row, idx) => {
      if (y + qualityRowH > pageBottom() - 18) {
        addPageAndHeader();
        drawSectionTitle('3 - QUALIDADE PERCEBIDA');
        drawQualityHeader();
      }
      drawQualityRow(row, idx);
    });
  }

  y += 8;
  const presentContractors = weeklyPerceivedQualityRows
    .filter((row) => row.presentAtMeeting === true)
    .map((row) => String(row.contractorName || '-'));
  const absentContractors = weeklyPerceivedQualityRows
    .filter((row) => row.presentAtMeeting !== true)
    .map((row) => String(row.contractorName || '-'));
  const presentText = presentContractors.length
    ? presentContractors.join(', ')
    : 'Nenhum empreiteiro com presença registrada.';
  const absentText = absentContractors.length
    ? absentContractors.join(', ')
    : 'Nenhum empreiteiro ausente registrado.';
  const presenceLine1 = `Presentes na reunião de PPC: ${presentText}`;
  const presenceLine2 = `Ausentes na reunião de PPC: ${absentText}`;
  doc.font('Helvetica').fontSize(8.2);
  const presenceLine1H = doc.heightOfString(presenceLine1, { width: contentWidth - 16, align: 'justify' });
  const presenceLine2H = doc.heightOfString(presenceLine2, { width: contentWidth - 16, align: 'justify' });
  const presenceBoxH = Math.max(44, Math.ceil(presenceLine1H + presenceLine2H + 20));
  ensureSpace(presenceBoxH + 6);
  drawRoundBox(margin, y, contentWidth, presenceBoxH, '#f4f9ff', COLORS.border, 6);
  drawTextInsideBox({
    x: margin,
    yPos: y,
    w: contentWidth,
    h: presenceBoxH,
    text: `${presenceLine1}\n${presenceLine2}`,
    font: 'Helvetica',
    fontSize: 8.6,
    align: 'justify',
    paddingX: 10,
    minTopPadding: 6,
    lineGap: 1.3,
  });
  y += presenceBoxH + 2;

  addPageAndHeader();
  drawSectionTitle('4 - QUALIDADE DA PROGRAMAÇÃO');

  const normalizeTextForDiff = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  const normalizeDateForDiff = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  };
  const taskComparableSignature = (task) => ([
    Number(task?.contractorId || 0),
    Number(task?.locationId || 0),
    normalizeTextForDiff(task?.description),
    normalizeDateForDiff(task?.plannedStart),
    normalizeDateForDiff(task?.plannedEnd),
    normalizeTextForDiff(task?.status),
  ].join('|'));

  const preTasks = await prisma.preTask.findMany({
    where: { weekId: week.id },
    select: {
      sequenceNumber: true,
      contractorId: true,
      locationId: true,
      description: true,
      plannedStart: true,
      plannedEnd: true,
      status: true,
    },
    orderBy: { sequenceNumber: 'asc' },
  });
  const planningTasks = (tasks || []).filter((task) => task.isUnplanned !== true);
  const preBySeq = new Map((preTasks || []).map((item) => [Number(item.sequenceNumber), item]));
  const planningBySeq = new Map((planningTasks || []).map((item) => [Number(item.sequenceNumber), item]));
  const seqSet = new Set([...preBySeq.keys(), ...planningBySeq.keys()]);

  let preVsPlanAdded = 0;
  let preVsPlanRemoved = 0;
  let preVsPlanChanged = 0;
  [...seqSet].sort((a, b) => a - b).forEach((seq) => {
    const preTask = preBySeq.get(seq) || null;
    const planningTask = planningBySeq.get(seq) || null;
    if (preTask && !planningTask) {
      preVsPlanRemoved += 1;
      return;
    }
    if (!preTask && planningTask) {
      preVsPlanAdded += 1;
      return;
    }
    if (!preTask || !planningTask) return;
    if (taskComparableSignature(preTask) !== taskComparableSignature(planningTask)) {
      preVsPlanChanged += 1;
    }
  });

  const totalProgrammedActivities = Number(planningTasks.length || 0);
  const totalPreVsPlanChanges = Number(preVsPlanAdded + preVsPlanRemoved + preVsPlanChanged);
  const preVsPlanQualityPct = totalProgrammedActivities > 0
    ? Math.max(0, Number((100 - ((totalPreVsPlanChanges / totalProgrammedActivities) * 100)).toFixed(2)))
    : 0;

  const plannedCancelledCount = planningTasks.reduce((acc, task) => {
    const outcome = taskOutcome(task, feedbackByTaskId);
    return acc + (outcome === 'CANCELLED' ? 1 : 0);
  }, 0);
  const unplannedExecutedCount = Number(metrics?.totals?.unplannedExecuted || 0);
  const totalPlanVsExecChanges = Number(plannedCancelledCount + unplannedExecutedCount);
  const planVsExecQualityPct = totalProgrammedActivities > 0
    ? Math.max(0, Number((100 - ((totalPlanVsExecChanges / totalProgrammedActivities) * 100)).toFixed(2)))
    : 0;

  const drawProgrammingQualityCards = (startY, cards) => {
    const cardGap = 8;
    const cardW = (contentWidth - (cardGap * 2)) / 3;
    const cardH = 52;
    cards.forEach((card, idx) => {
      const x = margin + (idx * (cardW + cardGap));
      drawRoundBox(x, startY, cardW, cardH, card.bg, COLORS.border, 7);
      doc.fillColor(card.fg).font('Helvetica-Bold').fontSize(8.1)
        .text(card.label, x + 8, startY + 8, {
          width: cardW - 16,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      doc.fontSize(13.2)
        .text(card.value, x + 8, startY + 26, {
          width: cardW - 16,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
    });
    return cardH + 8;
  };

  drawSectionTitle('4.1 - PRÉ E PROGRAMAÇÃO DA SEMANA', 120);
  const section41Cards = [
    {
      label: 'Total de alterações',
      value: String(totalPreVsPlanChanges),
      bg: '#f1f7ff',
      fg: '#244e83',
    },
    {
      label: 'Total de atividades',
      value: String(totalProgrammedActivities),
      bg: '#f6fbf7',
      fg: '#1f6f45',
    },
    {
      label: 'Qualidade da programação',
      value: formatPercentBrLocal(preVsPlanQualityPct, 2),
      bg: '#eef8fb',
      fg: '#2f5e77',
    },
  ];
  ensureSpace(120);
  y += drawProgrammingQualityCards(y, section41Cards);
  const section41Text = [
    'Método de cálculo: Qualidade da Programação = 100% - (alterações / total de atividades programadas da semana x 100).',
    'Alterações consideradas nesta seção: atividades adicionadas, removidas/canceladas e atividades com mudanças relevantes entre a Pré-programação e a Programação final da semana.',
    `Detalhamento da semana: adicionadas ${preVsPlanAdded}, removidas ${preVsPlanRemoved}, alteradas ${preVsPlanChanged}.`,
    'O resultado é limitado ao mínimo de 0%.',
  ].join(' ');
  doc.font('Helvetica').fontSize(8.7);
  const section41TextH = Math.max(48, Math.ceil(doc.heightOfString(section41Text, {
    width: contentWidth - 16,
    align: 'justify',
    lineGap: 1.2,
  }) + 14));
  ensureSpace(section41TextH + 4);
  drawRoundBox(margin, y, contentWidth, section41TextH, '#f4f9ff', COLORS.border, 6);
  drawTextInsideBox({
    x: margin,
    yPos: y,
    w: contentWidth,
    h: section41TextH,
    text: section41Text,
    font: 'Helvetica',
    fontSize: 8.7,
    align: 'justify',
    paddingX: 10,
    minTopPadding: 7,
    lineGap: 1.2,
  });
  y += section41TextH + 8;

  drawSectionTitle('4.2 - PROGRAMAÇÃO DA SEMANA E ATIVIDADES EXECUTADAS', 120);
  const section42Cards = [
    {
      label: 'Total de alterações',
      value: String(totalPlanVsExecChanges),
      bg: '#f1f7ff',
      fg: '#244e83',
    },
    {
      label: 'Total de atividades',
      value: String(totalProgrammedActivities),
      bg: '#f6fbf7',
      fg: '#1f6f45',
    },
    {
      label: 'Qualidade da programação',
      value: formatPercentBrLocal(planVsExecQualityPct, 2),
      bg: '#eef8fb',
      fg: '#2f5e77',
    },
  ];
  ensureSpace(120);
  y += drawProgrammingQualityCards(y, section42Cards);
  const section42Text = [
    'Método de cálculo: Qualidade da Programação = 100% - (alterações / total de atividades programadas da semana x 100).',
    'Alterações consideradas nesta seção: atividades executadas e não planejadas e cancelamento de atividades planejadas na semana.',
    `Detalhamento da semana: canceladas ${plannedCancelledCount}, executadas não planejadas ${unplannedExecutedCount}.`,
    'O resultado é limitado ao mínimo de 0%.',
  ].join(' ');
  doc.font('Helvetica').fontSize(8.7);
  const section42TextH = Math.max(48, Math.ceil(doc.heightOfString(section42Text, {
    width: contentWidth - 16,
    align: 'justify',
    lineGap: 1.2,
  }) + 14));
  ensureSpace(section42TextH + 4);
  drawRoundBox(margin, y, contentWidth, section42TextH, '#f4f9ff', COLORS.border, 6);
  drawTextInsideBox({
    x: margin,
    yPos: y,
    w: contentWidth,
    h: section42TextH,
    text: section42Text,
    font: 'Helvetica',
    fontSize: 8.7,
    align: 'justify',
    paddingX: 10,
    minTopPadding: 7,
    lineGap: 1.2,
  });
  y += section42TextH + 2;

  addPageAndHeader();
  drawSectionTitle('5 - GOVERNANÇA');
  drawSectionTitle('5.1 - CUMPRIMENTO DOS PRAZOS', rowH * 2);

  const formatDelayInfo = (deadlineDate, closedAt) => {
    if (!closedAt) return { status: 'PENDING', text: 'Não fechado', sort: Number.POSITIVE_INFINITY };
    if (!deadlineDate) return { status: 'UNKNOWN', text: 'Sem prazo definido', sort: 0 };
    const closedDate = new Date(closedAt);
    if (Number.isNaN(closedDate.getTime())) return { status: 'UNKNOWN', text: 'Sem prazo definido', sort: 0 };
    const cmp = closedDate.getTime() - deadlineDate.getTime();
    if (cmp <= 0) return { status: 'ONTIME', text: 'No prazo', sort: cmp };
    const deltaMs = Math.max(0, closedDate.getTime() - deadlineDate.getTime());
    const totalMinutes = Math.floor(deltaMs / 60000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const remMinutes = totalMinutes - (days * 24 * 60);
    const hours = Math.floor(remMinutes / 60);
    const minutes = remMinutes % 60;
    return {
      status: 'LATE',
      text: `${days}d ${hours}h ${minutes}min`,
      sort: cmp,
    };
  };

  const governanceRows = [
    {
      event: 'Fechamento Pré-programação da semana',
      deadline: computeWeekDeadlineDate(
        week,
        notificationRule?.prePlanningDeadlineWeekday,
        notificationRule?.prePlanningDeadlineTime,
        'WEDNESDAY',
        '17:00',
        { scope: 'PREVIOUS_WEEK', timeZone: tz },
      ),
      closedAt: week.prePlanningClosedAt || null,
      closedBy: String(week.prePlanningClosedBy?.name || '-'),
    },
    {
      event: 'Fechamento Lista de Presença + Ata de Reunião',
      deadline: computeWeekDeadlineDate(
        week,
        notificationRule?.ppcMeetingDeadlineWeekday,
        notificationRule?.ppcMeetingDeadlineTime,
        'THURSDAY',
        '17:00',
        { scope: 'PREVIOUS_WEEK', timeZone: tz },
      ),
      closedAt: ppcMeeting?.closedAt || week.ppcMeeting?.closedAt || null,
      closedBy: String(ppcMeeting?.closedBy?.name || week.ppcMeeting?.closedBy?.name || '-'),
    },
    {
      event: 'Fechamento Programação da semana',
      deadline: computeWeekDeadlineDate(
        week,
        notificationRule?.planningDeadlineWeekday,
        notificationRule?.planningDeadlineTime,
        'FRIDAY',
        '15:00',
        { scope: 'PREVIOUS_WEEK', timeZone: tz },
      ),
      closedAt: week.planningClosedAt || null,
      closedBy: String(week.planningClosedBy?.name || '-'),
    },
    {
      event: 'Fechamento Feedback da semana',
      deadline: computeWeekDeadlineDate(
        week,
        notificationRule?.feedbackDeadlineWeekday,
        notificationRule?.feedbackDeadlineTime,
        'FRIDAY',
        '17:00',
        { scope: 'CURRENT_WEEK', timeZone: tz },
      ),
      closedAt: week.feedbackClosedAt || null,
      closedBy: String(week.feedbackClosedBy?.name || '-'),
    },
    {
      event: 'Fechamento Qualidade percebida da semana',
      deadline: computeWeekDeadlineDate(
        week,
        notificationRule?.qualityDeadlineWeekday,
        notificationRule?.qualityDeadlineTime,
        'SATURDAY',
        '17:00',
        { scope: 'CURRENT_WEEK', timeZone: tz },
      ),
      closedAt: week.qualityClosedAt || null,
      closedBy: String(week.qualityClosedBy?.name || '-'),
    },
  ].map((row) => {
    const delay = formatDelayInfo(row.deadline, row.closedAt);
    return {
      ...row,
      delay,
      deadlineText: row.deadline ? formatDateTimeBrInTimeZone(row.deadline, tz) : '-',
      closedAtText: row.closedAt ? formatDateTimeBrInTimeZone(row.closedAt, tz) : '-',
    };
  });

  const governanceColumns = [
    { title: 'Evento', key: 'event', width: 154, align: 'center' },
    { title: 'Prazo', key: 'deadlineText', width: 92, align: 'center' },
    { title: 'Fechamento', key: 'closedAtText', width: 92, align: 'center' },
    { title: 'Responsável', key: 'closedBy', width: 112, align: 'center' },
    { title: 'Atraso', key: 'delayText', width: 77, align: 'center' },
  ];

  const drawGovernanceHeader = () => {
    drawRoundBox(margin, y, contentWidth, rowH, COLORS.header, COLORS.border, 4);
    let x = margin;
    governanceColumns.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.55).moveTo(x, y).lineTo(x, y + rowH).stroke().restore();
      }
      const fz = 7.2;
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(7.2)
        .text(col.title, x + 2, textYCenteredInRow(y, rowH, fz), {
          width: col.width - 4,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    y += rowH;
  };

  const drawGovernanceRow = (row, index) => {
    const isLate = row.delay.status === 'LATE';
    const isPending = row.delay.status === 'PENDING';
    const fill = isLate
      ? '#c0392b'
      : (isPending ? '#fff6db' : (index % 2 === 0 ? '#eaf8ef' : '#f7fbff'));
    const textColor = isLate ? '#ffffff' : COLORS.text;
    drawRoundBox(margin, y, contentWidth, rowH, fill, COLORS.border, 3);
    let x = margin;
    governanceColumns.forEach((col, idx) => {
      if (idx > 0) {
        doc.save().strokeColor(COLORS.border).lineWidth(0.5).moveTo(x, y).lineTo(x, y + rowH).stroke().restore();
      }
      let value = '';
      if (col.key === 'delayText') value = row.delay.text;
      else value = String(row[col.key] || '-');
      const fz = 7.0;
      doc.fillColor(textColor).font(isLate ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.0)
        .text(value, x + 2, textYCenteredInRow(y, rowH, fz), {
          width: col.width - 4,
          align: col.align || 'center',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    y += rowH;
  };

  drawGovernanceHeader();
  governanceRows.forEach((row, idx) => {
    if (y + rowH > pageBottom() - 18) {
      addPageAndHeader();
      drawSectionTitle('5 - GOVERNANÇA');
      drawSectionTitle('5.1 - CUMPRIMENTO DOS PRAZOS');
      drawGovernanceHeader();
    }
    drawGovernanceRow(row, idx);
  });

  y += 10;
  drawSectionTitle('5.2 - ACESSOS AO SISTEMA NA SEMANA', rowH * 2);
  const accessColumns = [
    { title: 'Usuário', key: 'userName', width: contentWidth - 185 },
    { title: 'Email', key: 'email', width: 140 },
    { title: 'Acessos', key: 'count', width: 45 },
  ];
  drawSimpleHeader(accessColumns);
  if (!allUsersWeeklyAccessRows.length) {
    drawSimpleRow(accessColumns, {
      userName: 'Sem usuários cadastrados na obra.',
      email: '-',
      count: '0',
    }, 0);
  } else {
    allUsersWeeklyAccessRows.forEach((item, idx) => {
      if (y + rowH > pageBottom() - 18) {
        addPageAndHeader();
        drawSectionTitle('5 - GOVERNANÇA');
        drawSectionTitle('5.2 - ACESSOS AO SISTEMA NA SEMANA');
        drawSimpleHeader(accessColumns);
      }
      drawSimpleRow(accessColumns, {
        userName: item.userName,
        email: item.email || '-',
        count: String(item.count),
      }, idx);
    });
  }

  const pages = doc.bufferedPageRange();

  doc.switchToPage(pages.start + tocPageIndex);
  doc.save()
    .fillColor('#ffffff')
    .rect(margin, CONTENT_TOP, contentWidth, doc.page.height - CONTENT_TOP - margin)
    .fill()
    .restore();
  let tocY = CONTENT_TOP;
  drawRoundBox(margin, tocY, contentWidth, 28, COLORS.title, COLORS.border, 8);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
    .text('SUMÁRIO', margin + 8, tocY + 8, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
    });
  tocY += 38;
  const tocLineH = 18;
  const sortedTocEntries = [...tocEntries].sort((a, b) => Number(a.page) - Number(b.page));
  sortedTocEntries.forEach((entry) => {
    const pageDisplay = Math.max(1, Number(entry.page) - 1);
    if (tocY + tocLineH > pageBottom()) return;
    drawRoundBox(margin, tocY, contentWidth, tocLineH, '#f7fbff', COLORS.border, 4);
    const indent = Number(entry.level) === 2 ? 14 : 0;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
      .text(entry.title, margin + 8 + indent, tocY + 5, {
        width: contentWidth - 60 - indent,
        align: 'left',
        lineBreak: false,
        ellipsis: true,
      })
      .text(String(pageDisplay), margin + contentWidth - 32, tocY + 5, {
        width: 24,
        align: 'right',
        lineBreak: false,
      });
    if (canUsePdfDestinations && entry.destination) {
      try {
        doc.goTo(margin + 6, tocY + 2, contentWidth - 12, tocLineH - 4, entry.destination);
      } catch {
        // no-op
      }
    }
    tocY += tocLineH + 4;
  });

  const reportPagesTotal = Math.max(0, pages.count - 1);
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(pages.start + i);
    if (i === 0) continue;
    drawRunningHeader();
    const reportPageNumber = i;
    const footerY = doc.page.height - margin - 10;
    doc.fillColor('#35597a').font('Helvetica').fontSize(8)
      .text(`${reportPageNumber}/${reportPagesTotal}`, margin, footerY, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
  }

  doc.end();
}));

router.get('/works/:workId/audit', authenticate, loadUser, requireWorkRoles([ROLES.ADMIN], (req) => parseIntId(req.params.workId)), asyncHandler(async (req, res) => {
  const limit = Math.min(parseIntId(req.query.limit) || 200, 1000);
  const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
  const entityId = parseIntId(req.query.entityId);

  const where = { workId: req.workId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const rows = await prisma.auditEvent.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return res.json(rows);
}));

module.exports = router;
