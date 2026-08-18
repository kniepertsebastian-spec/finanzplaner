import type { Transaction } from './api/types';

export function spentForCategory(transactions: Transaction[], categoryId: string): number {
  return transactions
    .filter((t) => t.categoryId === categoryId && t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

export function monthlyTotals(transactions: Transaction[]): { incomeCents: number; expenseCents: number } {
  return transactions.reduce(
    (acc, t) => {
      if (t.amount >= 0) {
        acc.incomeCents += t.amount;
      } else {
        acc.expenseCents += Math.abs(t.amount);
      }
      return acc;
    },
    { incomeCents: 0, expenseCents: 0 },
  );
}

// Linear extrapolation of spend-to-date to the end of the month.
export function projectRemainingBudget(
  totalBudgetCents: number,
  expenseSoFarCents: number,
  daysElapsed: number,
  daysInMonth: number,
): number {
  const projectedExpense = daysElapsed > 0 ? (expenseSoFarCents / daysElapsed) * daysInMonth : 0;
  return totalBudgetCents - projectedExpense;
}
