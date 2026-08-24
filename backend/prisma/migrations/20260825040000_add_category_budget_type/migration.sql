-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('NEEDS', 'WANTS', 'SAVINGS');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "budgetType" "BudgetType";
