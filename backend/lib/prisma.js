function loadPrismaModule() {
  const provider = String(process.env.DATABASE_PROVIDER || '').trim().toLowerCase();
  if (provider === 'postgres' || provider === 'postgresql') {
    return require('../generated/postgres-client');
  }
  return require('@prisma/client');
}

const prismaModule = loadPrismaModule();
const { PrismaClient, Prisma } = prismaModule;
const prisma = new PrismaClient();

module.exports = { prisma, Prisma };
