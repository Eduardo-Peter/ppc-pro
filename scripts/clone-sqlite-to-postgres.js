/* eslint-disable no-console */
const path = require('path');
const { PrismaClient: SourcePrismaClient } = require('@prisma/client');
const { PrismaClient: TargetPrismaClient } = require(path.join(
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

function pgPlaceholders(rowCount, colCount, startIndex = 1) {
  const rows = [];
  let p = startIndex;
  for (let i = 0; i < rowCount; i += 1) {
    const cols = [];
    for (let j = 0; j < colCount; j += 1) {
      cols.push(`$${p}`);
      p += 1;
    }
    rows.push(`(${cols.join(', ')})`);
  }
  return rows.join(', ');
}

async function listUserTables(source) {
  const rows = await source.$queryRawUnsafe(`
    SELECT name
    FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> '_prisma_migrations'
    ORDER BY name
  `);
  return rows.map((r) => r.name).filter(Boolean);
}

async function truncateTargetTables(target, tables) {
  if (!tables.length) return;
  const sql = `TRUNCATE TABLE ${tables.map(quoteIdent).join(', ')} RESTART IDENTITY CASCADE`;
  await target.$executeRawUnsafe(sql);
}

async function copyTable(source, target, tableName, batchSize = 200) {
  const rows = await source.$queryRawUnsafe(`SELECT * FROM ${quoteIdent(tableName)}`);
  if (!rows.length) return 0;

  const columns = Object.keys(rows[0]);
  if (!columns.length) return 0;

  const insertBase = `INSERT INTO ${quoteIdent(tableName)} (${columns.map(quoteIdent).join(', ')}) VALUES `;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const values = [];
    chunk.forEach((row) => {
      columns.forEach((col) => {
        values.push(row[col]);
      });
    });
    const valuesSql = pgPlaceholders(chunk.length, columns.length, 1);
    const sql = `${insertBase}${valuesSql}`;
    await target.$executeRawUnsafe(sql, ...values);
    inserted += chunk.length;
  }

  return inserted;
}

async function resetTargetIdentitySequences(target, tableNames) {
  for (const tableName of tableNames) {
    // eslint-disable-next-line no-await-in-loop
    const seqRows = await target.$queryRawUnsafe(
      `SELECT pg_get_serial_sequence(format('public.%I', ${quoteLiteral(tableName)}), 'id') AS seq`,
    );
    const sequenceName = String(seqRows?.[0]?.seq || '').trim();
    if (!sequenceName) continue;

    // eslint-disable-next-line no-await-in-loop
    const maxRows = await target.$queryRawUnsafe(
      `SELECT COALESCE(MAX("id"), 0) AS max_id FROM ${quoteIdent(tableName)}`,
    );
    const maxId = Number(maxRows?.[0]?.max_id || 0);

    if (maxId > 0) {
      // eslint-disable-next-line no-await-in-loop
      await target.$executeRawUnsafe(`SELECT setval(${quoteLiteral(sequenceName)}, ${maxId}, true)`);
    } else {
      // eslint-disable-next-line no-await-in-loop
      await target.$executeRawUnsafe(`SELECT setval(${quoteLiteral(sequenceName)}, 1, false)`);
    }
  }
}

async function main() {
  const targetUrl = String(process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!targetUrl) {
    throw new Error('Defina TARGET_DATABASE_URL (ou DATABASE_URL) para o Postgres de destino.');
  }

  const source = new SourcePrismaClient();
  const target = new TargetPrismaClient({
    datasources: { db: { url: targetUrl } },
  });

  const preferredOrder = [
    'PermissionProfile',
    'ProfilePermission',
    'ContractorFunction',
    'Work',
    'Contractor',
    'User',
    'UserWorkRole',
    'UserProfileAssignment',
    'Location',
    'TaskGroup',
    'TaskGroupItem',
    'Cause',
    'Holiday',
    'NotificationRule',
    'WorkPerceivedQualityConfig',
    'WorkFeasibility',
    'Week',
    'WeekWeatherDay',
    'WeekPpcMeeting',
    'PpcMeetingAttendance',
    'Task',
    'PreTask',
    'TaskPlannedDay',
    'PreTaskPlannedDay',
    'Feedback',
    'ReopenRequest',
    'FutureWeekAuthorization',
    'ContractorPerceivedQualityWeek',
    'WeekPerceivedQualityItem',
    'WorkFeasibilitySnapshot',
    'AuditEvent',
  ];

  try {
    console.log('Listando tabelas de origem (SQLite)...');
    const sourceTables = await listUserTables(source);
    if (!sourceTables.length) throw new Error('Nenhuma tabela encontrada na origem.');

    const ordered = [];
    const sourceSet = new Set(sourceTables);
    preferredOrder.forEach((name) => {
      if (sourceSet.has(name)) ordered.push(name);
    });
    sourceTables.forEach((name) => {
      if (!ordered.includes(name)) ordered.push(name);
    });

    console.log('Limpando banco destino (Postgres)...');
    await truncateTargetTables(target, ordered);

    const report = [];
    const pending = [...ordered];

    while (pending.length) {
      let progressed = false;
      const stillPending = [];

      for (const table of pending) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const inserted = await copyTable(source, target, table);
          report.push({ table, inserted });
          console.log(`Tabela ${table}: ${inserted} registros`);
          progressed = true;
        } catch (error) {
          const message = String(error?.message || '');
          const isForeignKeyDependency = message.includes('Code: `23503`');
          if (isForeignKeyDependency) {
            stillPending.push(table);
          } else {
            throw error;
          }
        }
      }

      if (!progressed) {
        throw new Error(
          `Nao foi possivel resolver dependencias entre tabelas. Pendentes: ${stillPending.join(', ')}`,
        );
      }

      pending.length = 0;
      pending.push(...stillPending);
    }

    console.log('Sincronizando sequences/identity (id) no destino...');
    await resetTargetIdentitySequences(target, ordered);

    console.log('\nClonagem concluida com sucesso.');
    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error('\nFalha na clonagem:', error.message);
  process.exitCode = 1;
});
