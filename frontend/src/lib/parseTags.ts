// Splits a free-text "Tags" input (space- or comma-separated, '#' optional) into a clean tag list.
// Mirrors the backend's normalizeTags (strip '#', trim, drop empties/duplicates) so what's typed
// here matches what's actually stored.
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const cleaned = raw.trim().replace(/^#/, '');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}
