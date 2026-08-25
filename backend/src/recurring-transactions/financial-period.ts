// Backend counterpart to frontend/src/lib/financialPeriod.ts — only the current period's END is
// needed here (for "pull a recurring rule forward if its due date falls within the user's current
// financial period" semantics), so this is a minimal, standalone port rather than a shared
// package. Kept manually in sync with the frontend version's date math.
//
// Unlike the frontend (which reasons in the browser's local time for "today"), this uses UTC
// calendar dates throughout, consistent with how the rest of RecurringTransactionsService already
// treats `nextDueDate`/`today` (see dateOnly()) — the backend has no "user's local time" concept,
// just a daily cron on a fixed clock.

function clampDay(year: number, monthIndex: number, day: number): number {
  const daysInThatMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, daysInThatMonth);
}

function periodStartUTC(monthStartDay: number, year: number, monthIndex: number): number {
  return Date.UTC(year, monthIndex, clampDay(year, monthIndex, monthStartDay));
}

// End-of-period timestamp (ms) — one ms before the next period's start — for the financial period
// that contains `today`.
export function currentPeriodEndUTC(monthStartDay: number, today: Date): number {
  const year = today.getUTCFullYear();
  const monthIndex = today.getUTCMonth();
  const day = today.getUTCDate();

  let cycleYear = year;
  let cycleMonth = monthIndex;
  if (day < monthStartDay) {
    cycleMonth -= 1;
    if (cycleMonth < 0) {
      cycleMonth = 11;
      cycleYear -= 1;
    }
  }

  let nextMonth = cycleMonth + 1;
  let nextYear = cycleYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  return periodStartUTC(monthStartDay, nextYear, nextMonth) - 1;
}
