/* eslint-disable no-console */
const path = require('path');
const { PrismaClient: SourcePrismaClient } = require(path.join(
  __dirname,
  '..',
  'backend',
  'generated',
  'postgres-client',
));
const { PrismaClient: TargetPrismaClient } = require('@prisma/client');

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function sqlitePlaceholders(rowCount, colCount) {
  const rows = [];
  for (let i = 0; i < rowCount; i += 1) {
    rows.push(`(${Array.from({ length: colCount }, () => '?').join(', ')})`);
  }
  return rows.join(', ');
}

async function listPostgresTables(source) {
  const rows = await source.$queryRawUnsafe(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `);
  return rows.map((row) => row.tablename).filter(Boolean);
}

async function listSqliteTables(target) {
  const rows = await target.$queryRawUnsafe(`
    SELECT name
    FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> '_prisma_migrations'
    ORDER BY name
  `);
  return rows.map((row) => row.name).filter(Boolean);
}

async function clearSqliteTables(target, tables) {
  if (!tables.length) return;
  await target.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await target.$executeRawUnsafe('BEGIN');
  try {
    for (const table of tables) {
      // eslint-disable-next-line no-await-in-loop
      await target.$executeRawUnsafe(`DELETE FROM ${quoteIdent(table)}`);
      // eslint-disable-next-line no-await-in-loop
      await target.$executeRawUnsafe(`DELETE FROM sqlite_sequence WHERE name = '${String(table).replace(/'/g, "''")}'`);
    }
    await target.$executeRawUnsafe('COMMIT');
  } catch (error) {
    await target.$executeRawUnsafe('ROLLBACK');
    throw error;
  } finally {
    await target.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  }
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
        const value = row[col];
        if (value instanceof Date) {
          values.push(value.toISOString());
        } else {
          values.push(value);
        }
      });
    });
    const sql = `${insertBase}${sqlitePlaceholders(chunk.length, columns.length)}`;
    // eslint-disable-next-line no-await-in-loop
    await target.$executeRawUnsafe(sql, ...values);
    inserted += chunk.length;
  }

  return inserted;
}

async function main() {
  const sourceUrl = String(process.env.SOURCE_DATABASE_URL || process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!sourceUrl) {
    throw new Error('Defina SOURCE_DATABASE_URL (ou TARGET_DATABASE_URL/DATABASE_URL) para o Postgres de origem.');
  }

  const source = new SourcePrismaClient({
    datasources: { db: { url: sourceUrl } },
  });
  const target = new TargetPrismaClient();

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
    'WeekPerceivedQualityItem',
    'WorkFeasibilitySnapshot',
    'AuditEvent',
    'AppConfig',
  ];

  try {
    console.log('Lendo tabelas do Postgres (origem)...');
    const sourceTables = await listPostgresTables(source);
    if (!sourceTables.length) throw new Error('Nenhuma tabela encontrada no Postgres de origem.');

    console.log('Lendo tabelas do SQLite (destino)...');
    const targetTables = await listSqliteTables(target);
    if (!targetTables.length) throw new Error('Nenhuma tabela encontrada no SQLite de destino.');

    const targetSet = new Set(targetTables);
    const ordered = [];
    preferredOrder.forEach((name) => {
      if (sourceTables.includes(name) && targetSet.has(name)) ordered.push(name);
    });
    sourceTables.forEach((name) => {
      if (targetSet.has(name) && !ordered.includes(name)) ordered.push(name);
    });

    console.log('Limpando SQLite de destino...');
    await clearSqliteTables(target, ordered);

    const report = [];
    for (const table of ordered) {
      // eslint-disable-next-line no-await-in-loop
      const inserted = await copyTable(source, target, table);
      report.push({ table, inserted });
      console.log(`Tabela ${table}: ${inserted} registros`);
    }

    console.log('\nClonagem Postgres -> SQLite concluída com sucesso.');
    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error('\nFalha na clonagem Postgres -> SQLite:', error.message);
  process.exitCode = 1;
});

