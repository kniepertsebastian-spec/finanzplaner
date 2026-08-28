-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'OTHER');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'CHECKING',
    "startingBalance" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add nullable accountId first, backfilled below, then tightened to NOT NULL.
ALTER TABLE "Transaction" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "isTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transferGroupId" TEXT;

-- AlterTable
ALTER TABLE "RecurringTransaction" ADD COLUMN     "accountId" TEXT;

-- Data migration: one default account per existing user, seeded with their old startingBalance,
-- then every existing Transaction/RecurringTransaction row is pointed at that account — there was
-- only ever one implicit account per user before this migration, so this is lossless.
INSERT INTO "Account" ("id", "name", "type", "startingBalance", "archived", "createdAt", "updatedAt", "userId")
SELECT gen_random_uuid(), 'Girokonto', 'CHECKING', "startingBalance", false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "id"
FROM "User";

UPDATE "Transaction" t
SET "accountId" = a."id"
FROM "Account" a
WHERE a."userId" = t."userId";

UPDATE "RecurringTransaction" rt
SET "accountId" = a."id"
FROM "Account" a
WHERE a."userId" = rt."userId";

-- AlterTable: now that every row has an accountId, enforce it.
ALTER TABLE "Transaction" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "RecurringTransaction" ALTER COLUMN "accountId" SET NOT NULL;

-- AlterTable: the per-user starting balance now lives on Account instead.
ALTER TABLE "User" DROP COLUMN "startingBalance";

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Transaction_transferGroupId_idx" ON "Transaction"("transferGroupId");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "RecurringTransaction_accountId_idx" ON "RecurringTransaction"("accountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
