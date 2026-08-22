// One-off data migration: populates the new `nextDueDate` column from the old `dayOfMonth`
// column before migration `finalize-next-due-date` drops it. Uses raw SQL so it still works
// after the Prisma Client has been (re)generated against the final schema, which no longer
// has `dayOfMonth` as a typed field. Must run between the two migrations, not before/after both.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

function nextOccurrence(dayOfMonth: number, from: Date): Date {
  const candidate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0)).getUTCDate();
  candidate.setUTCDate(Math.min(dayOfMonth, daysInMonth));

  if (candidate >= new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))) {
    return candidate;
  }

  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const daysInNextMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(dayOfMonth, daysInNextMonth));
  return next;
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const rows = await prisma.$queryRaw<{ id: string; description: string; dayOfMonth: number }[]>`
    SELECT id, description, "dayOfMonth" FROM "RecurringTransaction" WHERE "nextDueDate" IS NULL
  `;
  const today = new Date();

  for (const row of rows) {
    const nextDueDate = nextOccurrence(row.dayOfMonth, today);
    await prisma.$executeRaw`
      UPDATE "RecurringTransaction" SET "nextDueDate" = ${nextDueDate} WHERE id = ${row.id}
    `;
    console.log(`${row.description}: dayOfMonth=${row.dayOfMonth} -> nextDueDate=${nextDueDate.toISOString()}`);
  }

  console.log(`Backfilled ${rows.length} row(s).`);
  await prisma.$disconnect();
}

main();
