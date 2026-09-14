import { toPersianDigits } from './dateUtils';

/**
 * Ensures any numeric or alphanumeric string (phone number, Sayad ID, ICCID, tracking code)
 * retains strict LTR ordering and proper visual presentation inside RTL layouts.
 */
export function formatPhoneNumber(
  phoneNumber: string | undefined | null,
  isPersianDigits = true
): string {
  if (!phoneNumber) return '-';
  const clean = phoneNumber.trim();

  // Standard Iranian Mobile (e.g., 09123456789 -> 0912 345 6789)
  if (/^09\d{9}$/.test(clean)) {
    const formatted = `${clean.substring(0, 4)} ${clean.substring(4, 7)} ${clean.substring(7, 11)}`;
    return isPersianDigits ? toPersianDigits(formatted) : formatted;
  }

  // Landline with prefix (e.g., 02188776655 -> 021-88776655)
  if (/^0\d{10}$/.test(clean)) {
    const formatted = `${clean.substring(0, 3)}-${clean.substring(3, 7)}-${clean.substring(7)}`;
    return isPersianDigits ? toPersianDigits(formatted) : formatted;
  }

  return isPersianDigits ? toPersianDigits(clean) : clean;
}

/**
 * Format Sayad 16-digit check identifier with 4x4 grouping
 */
export function formatSayadNumber(sayadNumber: string | undefined | null, isPersianDigits = true): string {
  if (!sayadNumber) return '-';
  const clean = sayadNumber.replace(/\s+/g, '');
  if (clean.length === 16) {
    const formatted = `${clean.substring(0, 4)} - ${clean.substring(4, 8)} - ${clean.substring(8, 12)} - ${clean.substring(12, 16)}`;
    return isPersianDigits ? toPersianDigits(formatted) : formatted;
  }
  return isPersianDigits ? toPersianDigits(clean) : clean;
}

/**
 * Format SIM Card ICCID with clean readable spacing
 */
export function formatICCID(iccid: string | undefined | null, isPersianDigits = false): string {
  if (!iccid) return '-';
  const clean = iccid.replace(/\s+/g, '');
  if (clean.length >= 18) {
    // e.g. 8998 0120 2600 1092 81
    const parts = clean.match(/.{1,4}/g) || [clean];
    const formatted = parts.join(' ');
    return isPersianDigits ? toPersianDigits(formatted) : formatted;
  }
  return isPersianDigits ? toPersianDigits(clean) : clean;
}

/**
 * Format percentage with correct RTL sign placement
 */
export function formatPercentage(val: number | string | undefined | null, isPersianDigits = true): string {
  if (val === undefined || val === null || isNaN(Number(val))) return '۰٪';
  const num = Number(val);
  const formatted = Math.abs(num).toFixed(1).replace(/\.0$/, '');
  const persianNum = isPersianDigits ? toPersianDigits(formatted) : formatted;

  if (num > 0) {
    return `+${persianNum}٪`;
  } else if (num < 0) {
    return `-${persianNum}٪`;
  }
  return `${persianNum}٪`;
}

/**
 * Normalizes phone numbers for accurate comparison and duplicate checking across different formats:
 * - Converts Persian & Arabic numerals to standard ASCII digits
 * - Strips all non-digit characters (spaces, dashes, parentheses, pluses)
 * - Normalizes international prefixes (+98, 0098, 98) to standard leading 0
 * - Handles standard 10-digit formats (912... -> 0912...)
 */
export function normalizePhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let str = String(phone).trim();
  str = str.replace(/[۰-۹]/g, (w) => String(persianDigits.indexOf(w)));
  str = str.replace(/[٠-٩]/g, (w) => String(arabicDigits.indexOf(w)));

  let digits = str.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0098')) {
    digits = '0' + digits.substring(4);
  } else if (digits.startsWith('98') && digits.length >= 11) {
    digits = '0' + digits.substring(2);
  } else if (digits.length === 10 && digits.startsWith('9')) {
    digits = '0' + digits;
  }

  return digits;
}

/**
 * Checks if two phone numbers refer to the exact same phone identity
 */
export function isSamePhoneNumber(phoneA: string | undefined | null, phoneB: string | undefined | null): boolean {
  const normA = normalizePhoneNumber(phoneA);
  const normB = normalizePhoneNumber(phoneB);
  if (!normA || !normB) return false;
  return normA === normB;
}

