// A user's "financial month" doesn't have to match the calendar month — e.g. someone paid on
// the 23rd wants their month to run 23rd -> 22nd of the next month, not 1st -> end-of-month.
// `monthStartDay` (1-31, from User.monthStartDay) is the anchor day; everywhere the app used to
// reason in calendar months (Dashboard totals, budget periods, upcoming-Fixkosten total) should
// go through these helpers instead so the whole app shifts consistently when the setting changes.

export interface FinancialPeriod {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
}

function clampDay(year: number, monthIndex: number, day: number): number {
  const daysInThatMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, daysInThatMonth);
}

function periodStartDate(monthStartDay: number, year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, clampDay(year, monthIndex, monthStartDay)));
}

// Builds the full period for a given "cycle month" (the calendar month the period's start day
// falls in). All boundary Dates are constructed via Date.UTC — never derived by subtracting
// milliseconds from another Date and re-reading local getters, which breaks around midnight in
// any timezone with a non-zero offset (verified: broke in CEST/UTC+2 during testing).
function periodForCycleMonth(monthStartDay: number, cycleYear: number, cycleMonth: number): FinancialPeriod {
  const start = periodStartDate(monthStartDay, cycleYear, cycleMonth);

  let nextMonth = cycleMonth + 1;
  let nextYear = cycleYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  const nextStart = periodStartDate(monthStartDay, nextYear, nextMonth);
  const end = new Date(nextStart.getTime() - 1);

  return { start, end, startISO: start.toISOString(), endISO: end.toISOString() };
}

function cycleMonthForYMD(
  monthStartDay: number,
  year: number,
  monthIndex: number,
  day: number,
): { cycleYear: number; cycleMonth: number } {
  let cycleYear = year;
  let cycleMonth = monthIndex;
  if (day < monthStartDay) {
    cycleMonth -= 1;
    if (cycleMonth < 0) {
      cycleMonth = 11;
      cycleYear -= 1;
    }
  }
  return { cycleYear, cycleMonth };
}

export function getFinancialPeriod(monthStartDay: number, referenceDate: Date = new Date()): FinancialPeriod {
  const { cycleYear, cycleMonth } = cycleMonthForYMD(
    monthStartDay,
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  return periodForCycleMonth(monthStartDay, cycleYear, cycleMonth);
}

export function getNextFinancialPeriod(monthStartDay: number, referenceDate: Date = new Date()): FinancialPeriod {
  const current = getFinancialPeriod(monthStartDay, referenceDate);
  // current.start is a Date we built ourselves via Date.UTC — safe to read back with UTC getters.
  const { cycleYear, cycleMonth } = cycleMonthForYMD(
    monthStartDay,
    current.start.getUTCFullYear(),
    current.start.getUTCMonth(),
    current.start.getUTCDate(),
  );
  let nextMonth = cycleMonth + 1;
  let nextYear = cycleYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  return periodForCycleMonth(monthStartDay, nextYear, nextMonth);
}

export function getPreviousFinancialPeriod(monthStartDay: number, referenceDate: Date = new Date()): FinancialPeriod {
  const current = getFinancialPeriod(monthStartDay, referenceDate);
  const { cycleYear, cycleMonth } = cycleMonthForYMD(
    monthStartDay,
    current.start.getUTCFullYear(),
    current.start.getUTCMonth(),
    current.start.getUTCDate(),
  );
  let prevMonth = cycleMonth - 1;
  let prevYear = cycleYear;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear -= 1;
  }
  return periodForCycleMonth(monthStartDay, prevYear, prevMonth);
}

export function daysInFinancialPeriod(period: FinancialPeriod): number {
  return Math.round((period.end.getTime() - period.start.getTime() + 1) / (24 * 60 * 60 * 1000));
}

// 1-indexed count of days elapsed within the period containing referenceDate (today = 1 on the
// period's start day) — mirrors the old dayOfMonth() semantics used for budget projections.
export function dayOfFinancialPeriod(monthStartDay: number, referenceDate: Date = new Date()): number {
  const period = getFinancialPeriod(monthStartDay, referenceDate);
  const startUTC = Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth(), period.start.getUTCDate());
  const refUTC = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  return Math.round((refUTC - startUTC) / (24 * 60 * 60 * 1000)) + 1;
}

const startLabelFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const endLabelFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function financialPeriodLabel(period: FinancialPeriod): string {
  return `${startLabelFormatter.format(period.start)} – ${endLabelFormatter.format(period.end)}`;
}

// A window of periods around referenceDate, e.g. for a "which period is this budget for?" picker.
export function listFinancialPeriods(
  monthStartDay: number,
  referenceDate: Date,
  before: number,
  after: number,
): FinancialPeriod[] {
  const current = getFinancialPeriod(monthStartDay, referenceDate);
  const earlier: FinancialPeriod[] = [];
  let cursor = current;
  for (let i = 0; i < before; i++) {
    cursor = getPreviousFinancialPeriod(monthStartDay, cursor.start);
    earlier.unshift(cursor);
  }

  const later: FinancialPeriod[] = [];
  cursor = current;
  for (let i = 0; i < after; i++) {
    cursor = getNextFinancialPeriod(monthStartDay, cursor.start);
    later.push(cursor);
  }

  return [...earlier, current, ...later];
}
