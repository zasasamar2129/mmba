import { toPersianDigits, toEnglishDigits } from './dateUtils';

export function formatToman(amount: number | string | undefined | null, isPersian = false): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return isPersian ? '۰ تومان' : '0 Toman';
  const num = Math.round(Number(amount));
  const formatted = num.toLocaleString('en-US');
  return isPersian ? `${toPersianDigits(formatted)} تومان` : `${formatted} تومان`;
}

export function formatRial(amount: number | string | undefined | null, isPersian = false): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return isPersian ? '۰ ریال' : '0 Rial';
  const num = Math.round(Number(amount));
  const formatted = num.toLocaleString('en-US');
  return isPersian ? `${toPersianDigits(formatted)} ریال` : `${formatted} ریال`;
}

export function parseTomanInput(input: string): number {
  if (!input) return 0;
  const english = toEnglishDigits(input).replace(/[^\d.-]/g, '');
  const parsed = parseFloat(english);
  return isNaN(parsed) ? 0 : parsed;
}

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const THOUSANDS = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

function convertThreeDigits(num: number): string {
  if (num === 0) return '';
  const h = Math.floor(num / 100);
  const remainder = num % 100;
  const parts: string[] = [];

  if (h > 0) parts.push(HUNDREDS[h]);

  if (remainder >= 10 && remainder < 20) {
    parts.push(TEENS[remainder - 10]);
  } else {
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;
    if (t > 0) parts.push(TENS[t]);
    if (o > 0) parts.push(ONES[o]);
  }

  return parts.join(' و ');
}

export function numberToPersianWords(amount: number): string {
  if (amount === 0) return 'صفر تومان';
  if (amount < 0) return `منفی ${numberToPersianWords(Math.abs(amount))}`;

  const parts: string[] = [];
  let current = Math.floor(amount);
  let scaleIndex = 0;

  while (current > 0) {
    const chunk = current % 1000;
    if (chunk > 0) {
      const chunkWords = convertThreeDigits(chunk);
      const scaleWord = THOUSANDS[scaleIndex];
      parts.unshift(scaleWord ? `${chunkWords} ${scaleWord}` : chunkWords);
    }
    current = Math.floor(current / 1000);
    scaleIndex++;
  }

  return `${parts.join(' و ')} تومان`;
}
