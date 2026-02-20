export function parseLocaleNumber(input: string): number {
  const normalized = String(input ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}
