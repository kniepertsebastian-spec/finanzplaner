export function getMonthRange(date: Date = new Date()): { startISO: string; endISO: string } {
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
  const end = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

// Converts an <input type="month"> value ("2026-08") to a first-of-month ISO date.
export function toMonthISO(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toISOString();
}

// Converts a stored month ISO date back to an <input type="month"> value.
export function toMonthInputValue(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function daysInMonth(date: Date = new Date()): number {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0)).getUTCDate();
}

export function dayOfMonth(date: Date = new Date()): number {
  return date.getDate();
}
