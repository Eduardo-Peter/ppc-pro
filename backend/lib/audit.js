const { prisma } = require('./prisma');

async function writeAudit({ userId, workId, entityType, entityId, eventType, description, metadata }) {
  await prisma.auditEvent.create({
    data: {
      userId: userId || null,
      workId: workId || null,
      entityType,
      entityId: entityId || null,
      eventType,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

module.exports = { writeAudit };
