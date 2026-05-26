/* eslint-disable no-console */
const path = require('path');
const { PrismaClient } = require(path.join(
  __dirname,
  '..',
  'backend',
  'generated',
  'postgres-client',
));

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function listTablesWithId(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY c.relname
  `);
  return rows.map((row) => String(row.table_name || '').trim()).filter(Boolean);
}

async function resetSequenceForTable(prisma, tableName) {
  const seqRows = await prisma.$queryRawUnsafe(
    `SELECT pg_get_serial_sequence(format('public.%I', ${quoteLiteral(tableName)}), 'id') AS seq`,
  );
  const sequenceName = String(seqRows?.[0]?.seq || '').trim();
  if (!sequenceName) return { table: tableName, adjusted: false, reason: 'sem_sequence' };

  const maxRows = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(MAX("id"), 0) AS max_id FROM ${quoteIdent(tableName)}`,
  );
  const maxId = Number(maxRows?.[0]?.max_id || 0);

  if (maxId > 0) {
    await prisma.$executeRawUnsafe(`SELECT setval(${quoteLiteral(sequenceName)}, ${maxId}, true)`);
  } else {
    await prisma.$executeRawUnsafe(`SELECT setval(${quoteLiteral(sequenceName)}, 1, false)`);
  }

  return { table: tableName, adjusted: true, maxId };
}

async function main() {
  const targetUrl = String(process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!targetUrl) {
    throw new Error('Defina TARGET_DATABASE_URL (ou DATABASE_URL) para o Postgres alvo.');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: targetUrl } },
  });

  try {
    const tables = await listTablesWithId(prisma);
    const report = [];
    for (const tableName of tables) {
      // eslint-disable-next-line no-await-in-loop
      const result = await resetSequenceForTable(prisma, tableName);
      report.push(result);
      if (result.adjusted) {
        console.log(`OK ${tableName} -> max(id)=${result.maxId}`);
      }
    }
    console.log('\nSequences ajustadas com sucesso.');
    console.log(JSON.stringify({ ok: true, totalTables: tables.length, report }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\nFalha ao ajustar sequences:', error.message);
  process.exitCode = 1;
});

