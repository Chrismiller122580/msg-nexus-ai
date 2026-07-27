/** Normalize to E.164-ish +digits for storage and comparison. */
export function normalizePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (input.trim().startsWith('+')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

/** Compare phones ignoring formatting. */
export function phonesMatch(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '');
  const db = b.replace(/\D/g, '');
  if (!da || !db) return false;
  if (da === db) return true;
  // US: 10-digit vs 11-digit with leading 1
  const strip = (d: string) => (d.length === 11 && d.startsWith('1') ? d.slice(1) : d);
  return strip(da) === strip(db);
}
