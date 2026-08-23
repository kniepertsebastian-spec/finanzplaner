import type { Category } from './api/types';

export interface ParsedVoiceInput {
  amountEuros: string | null;
  description: string;
}

// German speech recognition normalizes spoken numbers to digits in the transcript
// (e.g. "fünfzig Euro" -> "50 Euro"), so a numeric regex is enough — no word-number parsing needed.
const AMOUNT_PATTERN = /(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)/i;

export function parseVoiceTranscript(transcript: string): ParsedVoiceInput {
  const trimmed = transcript.trim();
  const match = trimmed.match(AMOUNT_PATTERN);
  if (!match) {
    return { amountEuros: null, description: trimmed };
  }

  const amountEuros = match[1].replace(',', '.');
  const description = (trimmed.slice(0, match.index) + trimmed.slice((match.index ?? 0) + match[0].length))
    .replace(/\s+/g, ' ')
    .trim();

  return { amountEuros, description: description || trimmed };
}

export function matchCategoryId(transcript: string, categories: Category[]): string | null {
  const lower = transcript.toLowerCase();
  const match = categories.find((c) => lower.includes(c.name.toLowerCase()));
  return match?.id ?? null;
}
