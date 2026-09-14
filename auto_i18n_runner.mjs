import fs from 'fs';
import path from 'path';

// Load audit and translations
const i18nContent = fs.readFileSync('src/lib/i18n.ts', 'utf8');

// Replacements dictionary for Persian strings across common components
const replacements = [
  // Common terms
  { fa: 'انصراف', code: "{t('common.cancel')}" },
  { fa: 'ذخیره تغییرات', code: "{t('common.save')}" },
  { fa: 'ثبت اطلاعات', code: "{t('common.save')}" },
  { fa: 'حذف', code: "{t('common.delete')}" },
  { fa: 'ویرایش', code: "{t('common.edit')}" },
  { fa: 'جستجو...', code: "{t('common.search')}" },
  { fa: 'خروجی اکسل', code: "{t('common.exportExcel')}" },
  { fa: 'بستن', code: "{t('common.close')}" },
  { fa: 'تأیید', code: "{t('common.confirm')}" },
  { fa: 'همه', code: "{t('common.all')}" },
];

console.log('Automated translator initialized');
