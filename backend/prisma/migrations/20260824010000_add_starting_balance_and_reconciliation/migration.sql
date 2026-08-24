-- AlterTable
ALTER TABLE "User" ADD COLUMN     "startingBalance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "isReconciliation" BOOLEAN NOT NULL DEFAULT false;
