import type { Category, RecurringTransaction, Transaction } from './api/types';

// Sums active, expense-only (negative amount) recurring rules whose nextDueDate falls
// within [startISO, endISO) — i.e. what's due to post next calendar month.
// A rule counts toward a period if its nextDueDate falls within that period (not yet posted for
// it), OR it already posted within that period (lastRunAt falls within it) — the backend cron
// posts a rule for the *current* period as soon as the period starts and immediately advances
// nextDueDate to the following cycle (see RecurringTransactionsService.isDue's comment), so by
// the time someone looks at the dashboard, every rule that's relevant to the current period has
// already had its nextDueDate pushed into the *next* one. Without the lastRunAt check here, a
// rule that already posted this period would vanish from "this period's fixed costs" and appear
// to belong to next period instead, even though the money already left this period.
// lastRunAt is always in the past, so this check never matches when called for a future period.
export function upcomingFixedCosts(recurring: RecurringTransaction[], startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t <= end;
  };
  return recurring
    .filter((r) => r.active && r.amount < 0)
    .filter((r) => inRange(r.nextDueDate) || (r.lastRunAt && inRange(r.lastRunAt)))
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

// Share of income not spent in the period, as a percentage (e.g. 23.5). Null when there was no
// income at all — a rate would be meaningless (division by zero), not just "0%".
export function savingsRate(incomeCents: number, expenseCents: number): number | null {
  if (incomeCents <= 0) return null;
  return ((incomeCents - expenseCents) / incomeCents) * 100;
}

export interface BudgetTypeBreakdown {
  needsCents: number;
  wantsCents: number;
  // Spending in SAVINGS-classified categories (e.g. a transfer-to-savings booking) plus whatever
  // of the period's income was left unspent entirely — both count as "saved" for this rule.
  savingsCents: number;
  // Expense in categories with no budgetType set — excluded from the needs/wants/savings split
  // rather than silently folded into one of them, since the user hasn't made that call yet.
  unassignedCents: number;
  incomeCents: number;
}

// Classifies the period's expense transactions by their category's 50/30/20 budgetType, for the
// "Notwendiges/Wünsche/Sparen" breakdown against the classic 50/30/20 income-based targets.
export function budgetTypeBreakdown(
  transactions: Transaction[],
  categories: Category[],
  incomeCents: number,
): BudgetTypeBreakdown {
  const budgetTypeByCategoryId = new Map(categories.map((c) => [c.id, c.budgetType]));

  let needsCents = 0;
  let wantsCents = 0;
  let categorizedSavingsCents = 0;
  let unassignedCents = 0;
  let totalExpenseCents = 0;

  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const amount = Math.abs(t.amount);
    totalExpenseCents += amount;

    switch (budgetTypeByCategoryId.get(t.categoryId)) {
      case 'NEEDS':
        needsCents += amount;
        break;
      case 'WANTS':
        wantsCents += amount;
        break;
      case 'SAVINGS':
        categorizedSavingsCents += amount;
        break;
      default:
        unassignedCents += amount;
    }
  }

  const leftoverCents = Math.max(0, incomeCents - totalExpenseCents);
  return {
    needsCents,
    wantsCents,
    savingsCents: categorizedSavingsCents + leftoverCents,
    unassignedCents,
    incomeCents,
  };
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

// Verfügbar = Gesamtsaldo - ausstehende Fixkosten - Rücklagen (virtuelle Töpfe, die Teile des
// Saldos sperren, z. B. Notgroschen/Kfz-Steuer/Urlaub).
export function availableIncome(
  balanceCents: number,
  outstandingFixedCostsCents: number,
  lockedInPotsCents: number,
): number {
  return balanceCents - outstandingFixedCostsCents - lockedInPotsCents;
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

export interface CancellationNotice {
  recurring: RecurringTransaction;
  deadline: Date; // last day to cancel: contractEndDate - cancellationPeriodDays
  contractEndDate: Date;
}

// Active recurring rules with both `contractEndDate` and `cancellationPeriodDays` set whose
// cancellation deadline falls within [today, today + windowDays] — i.e. contracts that will
// silently auto-renew soon unless cancelled now. Sorted by deadline, most urgent first. A
// deadline already in the past (data entered late) is still surfaced, not filtered out — the
// user needs to know just as much, if not more.
export function contractsNeedingCancellationNotice(
  recurring: RecurringTransaction[],
  windowDays: number = 30,
  referenceDate: Date = new Date(),
): CancellationNotice[] {
  const todayUTC = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const windowEndUTC = todayUTC + windowDays * 24 * 60 * 60 * 1000;

  const notices: CancellationNotice[] = [];
  for (const r of recurring) {
    if (!r.active || !r.contractEndDate || r.cancellationPeriodDays == null) continue;
    const end = new Date(r.contractEndDate);
    const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const deadlineUTC = endUTC - r.cancellationPeriodDays * 24 * 60 * 60 * 1000;
    if (deadlineUTC <= windowEndUTC) {
      notices.push({ recurring: r, deadline: new Date(deadlineUTC), contractEndDate: new Date(endUTC) });
    }
  }
  return notices.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
}

export interface PriceIncrease {
  recurring: RecurringTransaction;
  previousAmount: number;
}

// Active expense rules (amount < 0) whose current amount costs more than the snapshotted
// `previousAmount` — i.e. the recurring cost was raised since the user last confirmed it (e.g.
// after a provider's price-increase notice). Income rules are out of scope: a rising income isn't
// a warning. Cleared per-rule via the dismiss-price-increase endpoint, not by this function.
export function priceIncreaseRules(recurring: RecurringTransaction[]): PriceIncrease[] {
  return recurring
    .filter(
      (r) => r.active && r.amount < 0 && r.previousAmount != null && Math.abs(r.amount) > Math.abs(r.previousAmount),
    )
    .map((r) => ({ recurring: r, previousAmount: r.previousAmount as number }));
}

type SpendingFlag = 'avoidable' | 'inefficient' | 'tooExpensive';

export interface FlagPotential {
  transactionCents: number; // sum of flagged, expense transactions passed in (caller decides the period)
  recurringMonthlyCents: number; // active flagged recurring expenses, normalized to a monthly equivalent
}

export interface SavingsPotential {
  avoidable: FlagPotential;
  inefficient: FlagPotential;
  tooExpensive: FlagPotential;
}

function flagPotential(transactions: Transaction[], recurring: RecurringTransaction[], flag: SpendingFlag): FlagPotential {
  const transactionCents = transactions
    .filter((t) => t[flag] && t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const recurringMonthlyCents = recurring
    .filter((r) => r[flag] && r.active && r.amount < 0)
    .reduce((sum, r) => sum + Math.round(Math.abs(r.amount) / Math.max(1, r.intervalMonths)), 0);
  return { transactionCents, recurringMonthlyCents };
}

// Aggregates the three independent spending flags (Vermeidbar/Ineffizient/Zu hoch) across both
// variable transactions (caller passes whichever period they want summed) and active recurring
// rules (normalized to a monthly equivalent via intervalMonths — a flagged yearly car-tax rule
// isn't "12x" as urgent as a flagged monthly one). Kept as two separate figures per flag rather
// than one blended sum: "already spent this period" and "estimated ongoing per month" answer
// different questions and summing them would overstate the number without adding insight.
export function savingsPotential(transactions: Transaction[], recurring: RecurringTransaction[]): SavingsPotential {
  return {
    avoidable: flagPotential(transactions, recurring, 'avoidable'),
    inefficient: flagPotential(transactions, recurring, 'inefficient'),
    tooExpensive: flagPotential(transactions, recurring, 'tooExpensive'),
  };
}

export interface CategoryShare {
  categoryId: string;
  name: string;
  cents: number;
}

export interface MoneyFlowNode {
  key: string; // categoryId, or a synthetic key for the "Gespart" pseudo-category
  name: string;
  cents: number;
}

export interface MoneyFlowData {
  totalIncomeCents: number;
  items: MoneyFlowNode[]; // expense categories (desc by amount) + "Gespart" last, if any is left over
}

const SAVED_KEY = '__saved__';

// Money-flow diagram data for a simple two-column Sankey-style visualization: all income pooled
// into a single "Einnahmen" source, fanning out to expense categories plus "Gespart" (unspent
// income). A three-column source->hub->categories layout would show individual income categories
// too, but with only 1-2 income categories in practice that's not worth the extra layout
// complexity — see SankeyChart.tsx for why this is hand-rolled SVG rather than a charting library.
export function moneyFlow(transactions: Transaction[], categories: Category[]): MoneyFlowData {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  let totalIncomeCents = 0;
  const expenseByCategoryId = new Map<string, number>();

  for (const t of transactions) {
    if (t.amount >= 0) {
      totalIncomeCents += t.amount;
    } else {
      expenseByCategoryId.set(t.categoryId, (expenseByCategoryId.get(t.categoryId) ?? 0) + Math.abs(t.amount));
    }
  }

  const items: MoneyFlowNode[] = Array.from(expenseByCategoryId.entries())
    .map(([key, cents]) => ({ key, name: nameById.get(key) ?? 'Unbekannt', cents }))
    .sort((a, b) => b.cents - a.cents);

  const totalExpenseCents = items.reduce((sum, i) => sum + i.cents, 0);
  const leftover = totalIncomeCents - totalExpenseCents;
  if (leftover > 0) {
    items.push({ key: SAVED_KEY, name: 'Gespart', cents: leftover });
  }

  return { totalIncomeCents, items };
}

// Expense totals per category for the given (already period-scoped) transactions, sorted largest
// first — feeds the category-share donut chart. Categories with zero expense are omitted.
export function expensesByCategory(transactions: Transaction[], categories: Category[]): CategoryShare[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();

  for (const t of transactions) {
    if (t.amount >= 0) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + Math.abs(t.amount));
  }

  return Array.from(totals.entries())
    .map(([categoryId, cents]) => ({ categoryId, name: nameById.get(categoryId) ?? 'Unbekannt', cents }))
    .sort((a, b) => b.cents - a.cents);
}
