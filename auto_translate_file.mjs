/**
 * auto_translate_file.mjs — Batch i18n worker for one .tsx file.
 *
 * Usage:
 *   node auto_translate_file.mjs <path-to-file.tsx>
 *
 * Actions:
 * 1. Reads the file.
 * 2. Finds all Persian string literals (double-quoted and single-quoted, JSX text).
 * 3. Generates a translation key based on file context.
 * 4. Adds the key to both fa and en dicts in src/lib/i18n.ts (re-reads each time).
 * 5. Replaces each string in the source with a t() call.
 * 6. Re-reads i18n.ts and writes updated dictionaries.
 *
 * Limitations:
 * - Only handles string literals (dq, sq) in JSX attributes and assignments.
 * - JSX text content (between tags) is skipped for safety (multi-line edge cases).
 * - Some edge cases may need manual cleanup.
 *
 * Safety:
 * - Never touches i18n.ts if the file has no Persian.
 * - Keys are namespaced: files.customers.title based on the file path.
 */

import fs from 'fs';
import path from 'path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node auto_translate_file.mjs <file.tsx>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const i18nPath = 'src/lib/i18n.ts';
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

function getDictBlock(content, name) {
  const marker = `export const ${name}: Translations = {`;
  const start = content.indexOf(marker);
  if (start === -1) return null;
  const bodyStart = start + marker.length;
  const bodyEnd = content.indexOf('\n};', bodyStart);
  return { start, markerStart: start, bodyStart, bodyEnd, body: content.slice(bodyStart, bodyEnd) };
}

function extractExistingKeys(block) {
  const keys = new Set();
  const re = /^\s*"([^"]+)":/gm;
  let m;
  while ((m = re.exec(block.body)) !== null) keys.add(m[1]);
  return keys;
}

const faBlock = getDictBlock(i18nContent, 'faTranslations');
const enBlock = getDictBlock(i18nContent, 'enTranslations');
if (!faBlock || !enBlock) {
  console.error('Could not find faTranslations or enTranslations blocks');
  process.exit(1);
}
const existingFaKeys = extractExistingKeys(faBlock);
const existingEnKeys = extractExistingKeys(enBlock);

// Derive namespace from file path
function deriveNamespace(filePath) {
  const rel = filePath.replace(/^src\/components\//, '').replace(/\.tsx?$/, '');
  const parts = rel.split(/[\/\\]/);
  // Use the component directory name as the top namespace
  // e.g. src/components/auth/LoginModal -> auth
  // e.g. src/components/customers/CustomerDetailView -> customers
  return parts[0];
}

// Generate a key from the Persian string and context
function generateKey(faStr, namespace, fileBasename, idx) {
  const clean = faStr.replace(/['"]/g, '').trim();
  // Try to extract a short semantic slug
  let slug = '';
  // Common patterns: remove prefix words
  slug = clean
    .replace(/[.\u060C?\u061B!:،.]/g, '')
    .trim()
    .substring(0, 40);
  // Replace spaces with dots for key style
  slug = slug.replace(/\s+/g, '.');
  // Strip non-ASCII from key (keep dots for nesting)
  slug = slug.replace(/[^\w.\u0600-\u06FF-]/g, '');
  if (slug.length < 2) slug = `literal.${idx}`;
  return `${namespace}.${slug}`;
}

// English translation — very rough literal for now. A human review pass is needed.
// For most UI strings, a "best effort" machine mapping is provided.
function autoTranslate(faStr) {
  // A small dictionary of common UI translations
  const dict = {
    'ذخیره تغییرات': 'Save Changes',
    'ثبت اطلاعات': 'Save',
    'انصراف': 'Cancel',
    'تأیید': 'Confirm',
    'بستن': 'Close',
    'حذف': 'Delete',
    'ویرایش': 'Edit',
    'افزودن': 'Add',
    'جستجو...': 'Search...',
    'خروجی اکسل': 'Export Excel',
    'بارگذاری': 'Upload',
    'دانلود': 'Download',
    'موفقیت\u200cآمیز': 'Success',
    'خطا': 'Error',
    'هشدار': 'Warning',
    'اطلاعیه': 'Information',
    'در حال بارگذاری...': 'Loading...',
    'موردی یافت نشد': 'No records found',
    'انتخاب کنید': 'Select...',
    'بازگشت': 'Back',
    'عملیات': 'Actions',
    'وضعیت': 'Status',
    'تاریخ': 'Date',
    'زمان': 'Time',
    'نوع': 'Type',
    'توضیحات': 'Description',
    'جزئیات': 'Details',
    'مجموع': 'Total',
    'تعداد': 'Count',
    'مبلغ': 'Amount',
    'تومان': 'Toman',
    'ریال': 'Rial',
    'بله': 'Yes',
    'خیر': 'No',
    'فعال': 'Active',
    'غیرفعال': 'Inactive',
    'الزامی': 'Required',
    'اختیاری': 'Optional',
    'بیشتر': 'More',
    'انتخاب': 'Select',
    'ثبت': 'Register',
    'ثبت سریع': 'Quick Register',
    'لطفاً': 'Please',
    'کپی شد': 'Copied',
    'فقط خواندنی': 'Read Only',
    'ویرایش پروفایل': 'Edit Profile',
    'حذف این مورد': 'Delete this item',
    'آیا از حذف این مورد اطمینان دارید؟': 'Are you sure you want to delete this item?',
    'این عملیات غیرقابل بازگشت است.': 'This action is irreversible.',
    'فایل با موفقیت حذف شد': 'File deleted successfully',
    'فایل با موفقیت آپلود شد': 'File uploaded successfully',
    'مشتری': 'Customer',
    'مخاطب': 'Contact',
    'مشتریان': 'Customers',
    'مخاطبین': 'Contacts',
    'تماس': 'Call',
    'تماس\u200cها': 'Calls',
    'وظیفه': 'Task',
    'وظایف': 'Tasks',
    'سیم\u200cکارت': 'SIM Card',
    'سیم\u200cکارت\u200cها': 'SIM Cards',
    'تعمیرات': 'Repairs',
    'تعمیر': 'Repair',
    'قرارداد': 'Contract',
    'قراردادها': 'Contracts',
    'پرداخت': 'Payment',
    'پرداخت\u200cها': 'Payments',
    'چک': 'Check',
    'چک\u200cها': 'Checks',
    'کاربر': 'User',
    'کاربران': 'Users',
    'فروش': 'Sale',
    'فروخته شده': 'Sold',
    'موجود': 'Available',
    'موجودی': 'Inventory',
    'ارسال': 'Send',
    'ارسال شد': 'Sent',
    'خوانده شد': 'Read',
    'خوانده نشده': 'Unread',
    'بایگانی': 'Archive',
    'پشتیبان\u200cگیری': 'Backup',
    'بازیابی': 'Restore',
    'دانلود فایل پشتیبان': 'Download Backup',
    'گزارش': 'Report',
    'گزارش\u200cها': 'Reports',
    'تنظیمات': 'Settings',
    ' audit.title': 'Security Audit Trails',
  };
  const clean = faStr.replace(/['"]/g, '').trim();
  if (dict[clean]) return dict[clean];
  // Mark as needing manual review
  return `[REVIEW: ${clean}]`;
}

// Extract Persian strings from a file's content (string literals only, not JSX text)
function extractPersianStrings(content) {
  const results = [];
  const lines = content.split('\n');
  lines.forEach((line, lineIdx) => {
    const lineNo = lineIdx + 1;
    // Double-quoted strings containing Persian
    const dqRe = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    // Single-quoted strings containing Persian
    const sqRe = /'([^'\\]*(?:\\.[^'\\]*)*)'/g;
    // Template literals (basic — skip multi-line)
    const tlRe = /`([^`\\]*(?:\\.[^`\\]*)*)`/g;

    const persianRe = /[\u0600-\u06FF]/;

    [dqRe, sqRe, tlRe].forEach((re) => {
      let m;
      while ((m = re.exec(line)) !== null) {
        const fullMatch = m[0];
        const inner = m[1];
        if (!persianRe.test(inner)) continue;
        // Skip if this string is a t() call argument already
        const beforeMatch = line.substring(0, m.index);
        if (/t\s*\(\s*$/.test(beforeMatch)) continue;
        if (/\bt\s*\(\s*\{/.test(beforeMatch)) continue;
        // Skip import statements
        if (/^\s*import\s/.test(line)) continue;
        // Skip if it is a CSS class or similar (unlikely in Persian but check)
        results.push({
          line: lineNo,
          fullMatch,
          inner,
          quote: fullMatch[0],
          index: m.index,
        });
      }
    });
  });
  return results;
}

// Replace a string in a line (simple — the first occurrence matching the full string)
function replaceInLine(line, fullMatch, replacement, quote) {
  // Use a more specific replacement: only in the same quote context
  const idx = line.indexOf(fullMatch);
  if (idx === -1) return null;
  return line.substring(0, idx) + replacement + line.substring(idx + fullMatch.length);
}

// Main
let fileContent = fs.readFileSync(filePath, 'utf8');
const namespace = deriveNamespace(filePath);
const fileName = path.basename(filePath, '.tsx');
const persianStrings = extractPersianStrings(fileContent);

if (persianStrings.length === 0) {
  console.log(`No Persian strings found in ${filePath}. Skipping.`);
  process.exit(0);
}

console.log(`\n=== ${filePath} (${persianStrings.length} Persian strings) ===`);

const faEntries = [];
const enEntries = [];
let changedLines = 0;
const seenKeys = new Set();
let keyIdx = 0;

persianStrings.forEach((item) => {
  const key = generateKey(item.inner, namespace, fileName, keyIdx++);
  if (seenKeys.has(key)) return;
  seenKeys.add(key);

  const enText = autoTranslate(item.inner);

  // Only add if key not already in dicts
  if (!existingFaKeys.has(key)) {
    faEntries.push(`  "${key}": "${item.inner.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",\n`);
    existingFaKeys.add(key);
  }
  if (!existingEnKeys.has(key)) {
    enEntries.push(`  "${key}": "${enText.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",\n`);
    existingEnKeys.add(key);
  }

  // Replace in source
  const newStr = `{t('${key}')}`;
  const newLine = replaceInLine(
    fileContent.split('\n')[item.line - 1],
    item.fullMatch,
    newStr,
    item.quote
  );
  if (newLine !== null) {
    const lines = fileContent.split('\n');
    lines[item.line - 1] = newLine;
    fileContent = lines.join('\n');
    changedLines++;
  }
});

// Append to fa dict
if (faEntries.length > 0) {
  const faEnd = faBlock.bodyEnd;
  i18nContent =
    i18nContent.slice(0, faEnd) +
    '\n' +
    faEntries.join('') +
    i18nContent.slice(faEnd);
  // Recompute enBlock after fa modification
  const enBlock2 = getDictBlock(i18nContent, 'enTranslations');
  const enEnd = enBlock2.bodyEnd;
  i18nContent =
    i18nContent.slice(0, enEnd) +
    '\n' +
    enEntries.join('') +
    i18nContent.slice(enEnd);
  fs.writeFileSync(i18nPath, i18nContent);
  console.log(`  → Added ${faEntries.length} keys to i18n.ts`);
}

// Write the modified source file (only if t() import is needed)
if (changedLines > 0) {
  // Ensure useTranslation import exists
  if (!fileContent.includes('useTranslation') && !fileContent.includes('./lib/i18n')) {
    // Add import at the top
    const importLine = `import { useTranslation } from '../../lib/i18n';\n`;
    fileContent = importLine + fileContent;
  }
  // Add const { t } = useTranslation(); if not present and there are t() calls
  if (fileContent.includes("t('") && !fileContent.includes('const { t }') && !fileContent.includes('const {t')) {
    // Find the first function component opening and inject
    const hookInsert = `  const { t } = useTranslation();\n`;
    // Simple heuristic: insert before the first `return (` in the main component
    const returnMatch = fileContent.indexOf('\n    return (');
    if (returnMatch !== -1) {
      fileContent = fileContent.slice(0, returnMatch + 1) + hookInsert + fileContent.slice(returnMatch + 1);
    }
  }
  fs.writeFileSync(filePath, fileContent);
  console.log(`  → Updated ${changedLines} strings in source`);
}

console.log(`  Done. Total keys added: ${faEntries.length}`);