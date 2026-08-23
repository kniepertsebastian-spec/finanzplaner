-- AlterTable
ALTER TABLE "RecurringTransaction" ADD COLUMN     "tooExpensive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "tooExpensive" BOOLEAN NOT NULL DEFAULT false;
