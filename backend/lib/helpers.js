function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function parseIntId(raw) {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDate(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
    if (brMatch) {
      const day = Number(brMatch[1]);
      const month = Number(brMatch[2]);
      const year = Number(brMatch[3]);
      const date = new Date(year, month - 1, day);
      if (
        date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day
      ) {
        return date;
      }
      return null;
    }
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

function normalizeFeedbackStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'EXECUTED_UNPLANNED') return 'EXECUTED_UNPLANNED';
  if (status === 'EXECUTED') return 'EXECUTED';
  if (status === 'STARTED' || status === 'IN_PROGRESS' || status === 'INICIADA') return 'STARTED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'NOT_STARTED';
}

function normalizeTaskStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'RETRABALHO') return 'RETRABALHO';
  if (status === 'RESERVA') return 'RESERVA';
  if (status === 'EXECUTED' || status === 'EXECUTED_UNPLANNED') return 'EXECUTED';
  if (status === 'STARTED' || status === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'PLANNED';
}

function toWeekdayRows(startDate, endDate) {
  const labels = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const rows = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const day = current.getDay();
    // Sunday excluded; Saturday included when in range.
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

function summarizeWeek(tasks, feedbacks) {
  const byTask = new Map(feedbacks.map((fb) => [fb.taskId, fb]));
  const totals = {
    executed: 0,
    started: 0,
    notStarted: 0,
    cancelled: 0,
    unplannedExecuted: 0,
  };

  for (const task of tasks) {
    if (task.isUnplanned === true) {
      const feedback = byTask.get(task.id);
      const fbStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;
      if (task.status === 'EXECUTED' || fbStatus === 'EXECUTED' || fbStatus === 'EXECUTED_UNPLANNED') {
        totals.unplannedExecuted += 1;
      }
      continue;
    }
    const feedback = byTask.get(task.id);
    const fbStatus = feedback ? normalizeFeedbackStatus(feedback.status) : null;

    if (task.status === 'CANCELLED' || fbStatus === 'CANCELLED') {
      totals.cancelled += 1;
      continue;
    }
    if (task.status === 'EXECUTED' || fbStatus === 'EXECUTED') {
      totals.executed += 1;
      continue;
    }
    if (task.status === 'IN_PROGRESS' || fbStatus === 'STARTED') {
      totals.started += 1;
      continue;
    }
    totals.notStarted += 1;
  }

  const considered = totals.executed + totals.started + totals.notStarted;
  const ppc = considered === 0 ? 0 : Number(((totals.executed / considered) * 100).toFixed(2));
  return { ...totals, considered, ppc };
}

module.exports = {
  asyncHandler,
  parseIntId,
  parseDate,
  normalizeRole,
  normalizeFeedbackStatus,
  normalizeTaskStatus,
  toWeekdayRows,
  summarizeWeek,
};
