-- AlterTable
ALTER TABLE "RecurringTransaction" ADD COLUMN     "contractNumber" TEXT,
ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "cancellationPeriodDays" INTEGER;
