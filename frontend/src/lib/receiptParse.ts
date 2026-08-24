export interface ParsedReceipt {
  amountEuros: string | null;
  date: string | null; // ISO date, e.g. "2026-08-25"
  merchant: string | null;
}

// Matches "12,34" or "12.34" (no thousands separator — receipts scanned here are everyday
// purchases, not five-figure invoices, and the user reviews the prefilled value before saving).
const AMOUNT_PATTERN = /\d{1,4}[.,]\d{2}/g;
const TOTAL_LINE_PATTERN = /(summe|gesamt|total|betrag|zu\s*zahlen)/i;
const DATE_PATTERN = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/;
const MERCHANT_LINE_PATTERN = /[A-Za-zÄÖÜäöüß]{3,}/;

function toAmountNumber(match: string): number {
  return Number(match.replace(',', '.'));
}

// The grand total is usually on (or right after) a line labelled "Summe"/"Gesamt"/"Total" — and
// if a receipt shows both a subtotal and a final total under that wording, the final one printed
// wins, so the *last* matching line is preferred over the first. Falls back to the largest amount
// found anywhere in the text when no such line exists at all.
function findTotalAmount(lines: string[]): string | null {
  let lastLabelledAmount: string | null = null;
  let maxAmount: number | null = null;
  let maxAmountText: string | null = null;

  for (const line of lines) {
    const amounts = line.match(AMOUNT_PATTERN);
    if (!amounts) continue;
    const lastOnLine = amounts[amounts.length - 1];

    if (TOTAL_LINE_PATTERN.test(line)) {
      lastLabelledAmount = lastOnLine;
    }
    for (const raw of amounts) {
      const value = toAmountNumber(raw);
      if (maxAmount === null || value > maxAmount) {
        maxAmount = value;
        maxAmountText = raw;
      }
    }
  }

  return lastLabelledAmount ?? maxAmountText;
}

function findDate(text: string): string | null {
  const match = text.match(DATE_PATTERN);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function findMerchant(lines: string[]): string | null {
  const line = lines.find((l) => MERCHANT_LINE_PATTERN.test(l));
  return line?.trim() ?? null;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const amount = findTotalAmount(lines);

  return {
    amountEuros: amount ? amount.replace(',', '.') : null,
    date: findDate(text),
    merchant: findMerchant(lines),
  };
}
