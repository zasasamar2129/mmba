import * as jalaali from 'jalaali-js';

export const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export const PERSIAN_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const PERSIAN_WEEK_DAYS = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'
];

export const PERSIAN_WEEK_DAYS_SHORT = [
  'ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'
];

export function toPersianDigits(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  const str = input.toString();
  return str.replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

export function toEnglishDigits(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/[۰-۹]/g, (w) => (w.charCodeAt(0) - 1776).toString())
    .replace(/[٠-٩]/g, (w) => (w.charCodeAt(0) - 1632).toString());
}

export function formatPrice(amount: number | string | undefined | null, currency: 'IRT' | 'IRR' = 'IRT', isPersian = true): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return '۰';
  const num = Math.round(Number(amount));
  const formatted = num.toLocaleString('en-US');
  const result = isPersian ? toPersianDigits(formatted) : formatted;
  const suffix = isPersian ? (currency === 'IRT' ? ' تومان' : ' ریال') : (currency === 'IRT' ? ' Toman' : ' IRR');
  return result + suffix;
}

// Gregorian to Jalali converter using jalaali-js
export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  try {
    if (jalaali && typeof jalaali.toJalaali === 'function') {
      return jalaali.toJalaali(gy, gm, gd);
    }
  } catch {}
  
  // Safe mathematical fallback
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    (365 * gy) +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

// Jalali to Gregorian converter using jalaali-js
export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  try {
    if (jalaali && typeof jalaali.toGregorian === 'function') {
      return jalaali.toGregorian(jy, jm, jd);
    }
  } catch {}

  // Fallback if needed
  let gy: number;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }
  let days =
    (365 * jy) +
    (Math.floor(jy / 33) * 8) +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && days > sal_a[gm]) {
    days -= sal_a[gm];
    gm++;
  }
  return { gy, gm, gd: days };
}

export function getJalaaliMonthLength(jy: number, jm: number): number {
  try {
    if (jalaali && typeof jalaali.jalaaliMonthLength === 'function') {
      return jalaali.jalaaliMonthLength(jy, jm);
    }
  } catch {}
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Is leap year check for Esfand
  try {
    if (jalaali && typeof jalaali.isLeapJalaaliYear === 'function') {
      return jalaali.isLeapJalaaliYear(jy) ? 30 : 29;
    }
  } catch {}
  return 29;
}

// Gregorian (English) presentation without corrupting the canonical timestamp.
export function formatGregorianDate(dateInput?: string | Date | null, includeTime = false): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    const y = d.getFullYear();
    const m = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const dateStr = `${day} ${m} ${y}`;
    if (!includeTime) return dateStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${dateStr} - ${hours}:${minutes}`;
  } catch {
    return String(dateInput);
  }
}

export function formatGregorianShortDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  } catch {
    return String(dateInput);
  }
}

export function formatPersianDate(dateInput?: string | Date | null, includeTime = false): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const day = String(j.jd).padStart(2, '0');
    const month = PERSIAN_MONTH_NAMES[j.jm - 1];
    const year = j.jy;

    const dateStr = `${toPersianDigits(day)} ${month} ${toPersianDigits(year)}`;
    if (!includeTime) return dateStr;

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${dateStr} - ${toPersianDigits(hours)}:${toPersianDigits(minutes)}`;
  } catch {
    return String(dateInput);
  }
}

export function formatPersianShortDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return `${toPersianDigits(j.jy)}/${toPersianDigits(String(j.jm).padStart(2, '0'))}/${toPersianDigits(String(j.jd).padStart(2, '0'))}`;
  } catch {
    return String(dateInput);
  }
}

export function formatPersianDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const day = String(j.jd).padStart(2, '0');
    const month = PERSIAN_MONTH_NAMES[j.jm - 1];
    const year = j.jy;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${toPersianDigits(day)} ${month} ${toPersianDigits(year)} ساعت ${toPersianDigits(hours)}:${toPersianDigits(minutes)}`;
  } catch {
    return String(dateInput);
  }
}

export function formatPersianDateFull(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const weekdayIndex = (d.getDay() + 1) % 7;
    const weekday = PERSIAN_WEEK_DAYS[weekdayIndex];
    const day = String(j.jd).padStart(2, '0');
    const month = PERSIAN_MONTH_NAMES[j.jm - 1];
    const year = j.jy;
    return `${weekday} ${toPersianDigits(day)} ${month} ${toPersianDigits(year)}`;
  } catch {
    return String(dateInput);
  }
}

export function formatPersianTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${toPersianDigits(hours)}:${toPersianDigits(minutes)}`;
  } catch {
    return '';
  }
}

// Locale-aware relative time for EN.
export function getRelativeTimeEn(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45 && diffSec >= -45) return 'just now';

  if (diffMs > 0) {
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatGregorianShortDate(d);
  } else {
    const absMin = Math.abs(diffMin);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);
    if (absMin < 60) return `in ${absMin}m`;
    if (absHours < 24) return `in ${absHours}h`;
    if (absDays === 1) return 'tomorrow';
    if (absDays < 30) return `in ${absDays}d`;
    return formatGregorianShortDate(d);
  }
}

export function getRelativeTimeFa(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45 && diffSec >= -45) return 'همین الان';

  if (diffMs > 0) {
    // In the past
    if (diffMin < 60) return `${toPersianDigits(diffMin)} دقیقه پیش`;
    if (diffHours < 24) return `${toPersianDigits(diffHours)} ساعت پیش`;
    if (diffDays === 1) return 'دیروز';
    if (diffDays < 30) return `${toPersianDigits(diffDays)} روز پیش`;
    return formatPersianShortDate(d);
  } else {
    // In the future
    const absMin = Math.abs(diffMin);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);

    if (absMin < 60) return `${toPersianDigits(absMin)} دقیقه دیگر`;
    if (absHours < 24) return `${toPersianDigits(absHours)} ساعت دیگر`;
    if (absDays === 1) return 'فردا';
    if (absDays < 30) return `${toPersianDigits(absDays)} روز دیگر`;
    return formatPersianShortDate(d);
  }
}

export function isOverdue(dateInput?: string | null): boolean {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  const now = new Date();
  return d.getTime() < now.getTime();
}

export function isToday(dateInput?: string | null): boolean {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function getCurrentJalaliYear(): number {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate()).jy;
}

export function getCurrentJalaliDate(): { jy: number; jm: number; jd: number; formatted: string } {
  const now = new Date();
  const j = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return {
    jy: j.jy,
    jm: j.jm,
    jd: j.jd,
    formatted: `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`,
  };
}

export function parseDateInputToJalali(dateInput?: string | Date | null): { jy: number; jm: number; jd: number; hour: number; minute: number } {
  const now = new Date();
  if (!dateInput) {
    const j = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return { jy: j.jy, jm: j.jm, jd: j.jd, hour: now.getHours(), minute: now.getMinutes() };
  }

  // Check if string is Jalali format like "1403/05/22" or "1403-05-22"
  if (typeof dateInput === 'string') {
    const clean = toEnglishDigits(dateInput.trim());
    const jalaliMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2}))?/);
    if (jalaliMatch) {
      const jy = parseInt(jalaliMatch[1], 10);
      const jm = parseInt(jalaliMatch[2], 10);
      const jd = parseInt(jalaliMatch[3], 10);
      const hour = jalaliMatch[4] ? parseInt(jalaliMatch[4], 10) : 0;
      const minute = jalaliMatch[5] ? parseInt(jalaliMatch[5], 10) : 0;
      if (jy >= 1300 && jy <= 1500 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31) {
        return { jy, jm, jd, hour, minute };
      }
    }
  }

  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!isNaN(d.getTime())) {
    const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { jy: j.jy, jm: j.jm, jd: j.jd, hour: d.getHours(), minute: d.getMinutes() };
  }

  const j = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return { jy: j.jy, jm: j.jm, jd: j.jd, hour: now.getHours(), minute: now.getMinutes() };
}

export function jalaliToIsoString(jy: number, jm: number, jd: number, hour = 0, minute = 0, second = 0): string {
  const g = jalaliToGregorian(jy, jm, jd);
  const d = new Date(g.gy, g.gm - 1, g.gd, hour, minute, second);
  return d.toISOString();
}

export function jalaliToIsoDateOnly(jy: number, jm: number, jd: number): string {
  const g = jalaliToGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}

export function getJalaliMonthCalendar(jy: number, jm: number): {
  daysInMonth: number;
  firstDayWeekday: number; // 0 = Saturday, 6 = Friday
  days: {
    dayNumber: number;
    isCurrentMonth: boolean;
    jy: number;
    jm: number;
    jd: number;
    isoDate: string;
    isToday: boolean;
    isFriday: boolean;
  }[];
} {
  const daysInMonth = getJalaaliMonthLength(jy, jm);
  const firstDayGreg = jalaliToGregorian(jy, jm, 1);
  const firstDate = new Date(firstDayGreg.gy, firstDayGreg.gm - 1, firstDayGreg.gd);
  const firstDayWeekday = (firstDate.getDay() + 1) % 7; // 0 = شنبه

  const today = new Date();
  const todayJ = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const days: {
    dayNumber: number;
    isCurrentMonth: boolean;
    jy: number;
    jm: number;
    jd: number;
    isoDate: string;
    isToday: boolean;
    isFriday: boolean;
  }[] = [];

  // Previous month padding
  const prevJm = jm === 1 ? 12 : jm - 1;
  const prevJy = jm === 1 ? jy - 1 : jy;
  const prevMonthLength = getJalaaliMonthLength(prevJy, prevJm);

  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const dNum = prevMonthLength - i;
    const g = jalaliToGregorian(prevJy, prevJm, dNum);
    days.push({
      dayNumber: dNum,
      isCurrentMonth: false,
      jy: prevJy,
      jm: prevJm,
      jd: dNum,
      isoDate: `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`,
      isToday: prevJy === todayJ.jy && prevJm === todayJ.jm && dNum === todayJ.jd,
      isFriday: (days.length % 7) === 6,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const g = jalaliToGregorian(jy, jm, d);
    days.push({
      dayNumber: d,
      isCurrentMonth: true,
      jy,
      jm,
      jd: d,
      isoDate: `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`,
      isToday: jy === todayJ.jy && jm === todayJ.jm && d === todayJ.jd,
      isFriday: (days.length % 7) === 6,
    });
  }

  // Next month padding to complete 35 or 42 grid slots
  const totalSlots = days.length <= 35 ? 35 : 42;
  const remaining = totalSlots - days.length;
  const nextJm = jm === 12 ? 1 : jm + 1;
  const nextJy = jm === 12 ? jy + 1 : jy;

  for (let d = 1; d <= remaining; d++) {
    const g = jalaliToGregorian(nextJy, nextJm, d);
    days.push({
      dayNumber: d,
      isCurrentMonth: false,
      jy: nextJy,
      jm: nextJm,
      jd: d,
      isoDate: `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`,
      isToday: nextJy === todayJ.jy && nextJm === todayJ.jm && d === todayJ.jd,
      isFriday: (days.length % 7) === 6,
    });
  }

  return {
    daysInMonth,
    firstDayWeekday,
    days,
  };
}

