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

export interface CashflowPoint {
  date: Date;
  balanceCents: number;
}

// Adds `months` to a UTC-midnight timestamp, clamping the day-of-month to the target month's
// length (e.g. 31 Jan + 1 month -> 28/29 Feb, not 3 Mar) — same clamping rule as
// financialPeriod.ts's periodStartDate, needed here so a recurring rule due on the 31st doesn't
// drift forward across months with fewer days.
function addMonthsClamped(utcMs: number, months: number): number {
  const d = new Date(utcMs);
  const year = d.getUTCFullYear();
  const day = d.getUTCDate();
  const targetIndex = d.getUTCMonth() + months;
  const targetYear = year + Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return Date.UTC(targetYear, targetMonth, Math.min(day, daysInTargetMonth));
}

// Day-by-day projected running balance from today through `horizonDays` days out, applying every
// active recurring rule's occurrences (starting at its nextDueDate, then repeating every
// intervalMonths) that fall in that window. Only committed recurring cashflows are known ahead of
// time — variable day-to-day spending isn't — so this deliberately has the same scope as
// availableIncome()/dailyBurnRate(), not a full spend forecast.
export function cashflowProjection(
  startBalanceCents: number,
  recurring: RecurringTransaction[],
  horizonDays: number,
  referenceDate: Date = new Date(),
): CashflowPoint[] {
  const todayUTC = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const horizonEndUTC = todayUTC + horizonDays * 24 * 60 * 60 * 1000;

  const amountByDayIndex = new Map<number, number>();
  for (const r of recurring.filter((r) => r.active)) {
    const interval = Math.max(1, r.intervalMonths);
    const due = new Date(r.nextDueDate);
    let dueUTC = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    // nextDueDate should already be >= today, but guard against stale data just in case.
    while (dueUTC < todayUTC) {
      dueUTC = addMonthsClamped(dueUTC, interval);
    }
    while (dueUTC <= horizonEndUTC) {
      const dayIndex = Math.round((dueUTC - todayUTC) / (24 * 60 * 60 * 1000));
      amountByDayIndex.set(dayIndex, (amountByDayIndex.get(dayIndex) ?? 0) + r.amount);
      dueUTC = addMonthsClamped(dueUTC, interval);
    }
  }

  const points: CashflowPoint[] = [];
  let runningBalance = startBalanceCents;
  for (let dayIndex = 0; dayIndex <= horizonDays; dayIndex++) {
    runningBalance += amountByDayIndex.get(dayIndex) ?? 0;
    points.push({ date: new Date(todayUTC + dayIndex * 24 * 60 * 60 * 1000), balanceCents: runningBalance });
  }
  return points;
}

// First point where the projected balance dips below zero, or null if the projection stays
// non-negative throughout the horizon — drives the Dashboard's Unterdeckung warning.
export function firstShortfall(points: CashflowPoint[]): CashflowPoint | null {
  return points.find((p) => p.balanceCents < 0) ?? null;
}
