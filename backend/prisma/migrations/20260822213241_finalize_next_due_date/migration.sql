/*
  Warnings:

  - You are about to drop the column `dayOfMonth` on the `RecurringTransaction` table. All the data in the column will be lost.
  - Made the column `nextDueDate` on table `RecurringTransaction` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "RecurringTransaction" DROP COLUMN "dayOfMonth",
ALTER COLUMN "nextDueDate" SET NOT NULL;
