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

// Verfügbar = Gesamtsaldo - ausstehende Fixkosten (Rücklagen/sinking funds don't exist yet —
// that's Phase 10 — so they're not subtracted here).
export function availableIncome(balanceCents: number, outstandingFixedCostsCents: number): number {
  return balanceCents - outstandingFixedCostsCents;
}

// Earliest active, income-type (positive-amount) recurring rule due today or later. `nextDueDate`
// is a UTC-midnight-anchored calendar date from the backend — compared via getTime(), never via
// local Date getters (see the CEST bug documented for financialPeriod.ts).
export function nextIncomeDueDate(recurring: RecurringTransaction[], referenceDate: Date = new Date()): Date | null {
  const todayUTC = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const dueDates = recurring
    .filter((r) => r.active && r.amount > 0)
    .map((r) => new Date(r.nextDueDate))
    .filter((d) => d.getTime() >= todayUTC)
    .sort((a, b) => a.getTime() - b.getTime());
  return dueDates[0] ?? null;
}

// Whole days between "today" and a UTC-midnight-anchored target date, floored at 1 so burn-rate
// math never divides by zero (e.g. the next income is due today).
export function daysUntil(target: Date, referenceDate: Date = new Date()): number {
  const todayUTC = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffDays = Math.round((target.getTime() - todayUTC) / (24 * 60 * 60 * 1000));
  return Math.max(1, diffDays);
}

// "Verbleibendes Tagesbudget bis zum nächsten Gehaltseingang" — can go negative, which is the
// point: it signals the user is already projected to overspend before the next income arrives.
export function dailyBurnRate(availableIncomeCents: number, daysUntilNextIncome: number): number {
  return Math.round(availableIncomeCents / daysUntilNextIncome);
}
