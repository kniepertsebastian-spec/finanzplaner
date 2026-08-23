-- AlterTable
ALTER TABLE "RecurringTransaction" ADD COLUMN     "avoidable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inefficient" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "avoidable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inefficient" BOOLEAN NOT NULL DEFAULT false;
