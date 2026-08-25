// Strips an optional leading '#', trims whitespace, drops empties and duplicates (case-insensitive)
// — keeps the first-seen casing so "Urlaub2026" and "urlaub2026" don't become two separate tags.
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const cleaned = raw.trim().replace(/^#/, '');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}
