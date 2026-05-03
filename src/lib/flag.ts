/**
 * ISO 3166-1 alpha-2 country code → flag emoji.
 * "US" → "🇺🇸"
 */
export function flagFor(code: string): string {
  if (!code || code.length !== 2) return "🏳";
  const A = 0x1f1e6;
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    A + upper.charCodeAt(0) - 65,
    A + upper.charCodeAt(1) - 65
  );
}
