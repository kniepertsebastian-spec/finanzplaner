import type { RecurringTransaction, Transaction } from './api/types';

// Sums active, expense-only (negative amount) recurring rules whose nextDueDate falls
// within [startISO, endISO) — i.e. what's due to post next calendar month.
export function upcomingFixedCosts(recurring: RecurringTransaction[], startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return recurring
    .filter((r) => r.active && r.amount < 0)
    .filter((r) => {
      const due = new Date(r.nextDueDate).getTime();
      return due >= start && due <= end;
    })
    .reduce((sum, r) => sum + Math.abs(r.amount), 0);
}

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
