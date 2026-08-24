export interface CurrencyOption {
  code: string;
  label: string;
}

export const COMMON_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', label: 'US-Dollar' },
  { code: 'GBP', label: 'Britisches Pfund' },
  { code: 'CHF', label: 'Schweizer Franken' },
  { code: 'JPY', label: 'Japanischer Yen' },
  { code: 'SEK', label: 'Schwedische Krone' },
  { code: 'NOK', label: 'Norwegische Krone' },
  { code: 'DKK', label: 'Dänische Krone' },
  { code: 'PLN', label: 'Polnischer Zloty' },
  { code: 'CZK', label: 'Tschechische Krone' },
  { code: 'TRY', label: 'Türkische Lira' },
];

// Converts a foreign-currency amount to Euro-cents using a manually entered exchange rate (1 unit
// of foreign currency = `rateToEur` Euro). No live exchange-rate API — the app has no external
// network dependencies by design, so the rate is entered by hand (e.g. off a bank statement).
export function convertForeignToEuroCents(foreignAmount: number, rateToEur: number): number {
  return Math.round(foreignAmount * rateToEur * 100);
}

const RATE_STORAGE_PREFIX = 'finanzplaner:lastRate:';

// Per-viewer convenience only (browser localStorage) — remembers the last rate typed per currency
// so a returning trip doesn't require re-entering it. Never fails loudly: private browsing / a
// blocked storage API just means the field starts empty next time.
export function getRememberedRate(currencyCode: string): string {
  try {
    return localStorage.getItem(RATE_STORAGE_PREFIX + currencyCode) ?? '';
  } catch {
    return '';
  }
}

export function rememberRate(currencyCode: string, rate: string): void {
  try {
    localStorage.setItem(RATE_STORAGE_PREFIX + currencyCode, rate);
  } catch {
    // ignore — non-critical convenience storage
  }
}
