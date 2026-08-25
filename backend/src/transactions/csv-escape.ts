// Wraps a field in double quotes (escaping embedded quotes) only when it contains the delimiter,
// a quote, or a newline — keeps the common case (plain text) readable and unquoted.
export function csvEscape(value: string): string {
  if (/[;"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
