import fs from 'fs';

const newKeys = JSON.parse(fs.readFileSync('new_keys.json', 'utf8'));

const extra = {
  // Extra EN translations for fa keys that lack an EN counterpart
  'nav.chat': { fa: 'گفتگوها', en: 'Chat' },
  'nav.desc.chat': { fa: 'پیام‌رسانی داخلی بین کارکنان', en: 'Internal messaging between colleagues' },
  'header.tagline': { fa: 'سامانه یکپارچه مدیریت ارتباط با مشتریان و هوش تجاری', en: 'Unified CRM & business intelligence platform' },
  'header.quickCreate': { fa: 'ثبت سریع و فوری', en: 'Quick Create' },
  'header.recordVoice': { fa: 'ضبط پیام صوتی', en: 'Record Voice Note' },
  'header.uploadVoice': { fa: 'بارگذاری فایل صوتی', en: 'Upload Voice File' },
  'header.logCall': { fa: 'ثبت مذاکره / تماس', en: 'Log Call / Interaction' },
  'header.newCustomer': { fa: 'ثبت مخاطب جدید', en: 'New Customer' },
  'header.newTask': { fa: 'ایجاد وظیفه جدید', en: 'New Task' },
  'header.newPayment': { fa: 'ثبت دریافتی مالی', en: 'New Payment' },
  'header.dbConnected': { fa: 'پایگاه داده متصل', en: 'Database Connected' },
  'header.dbConnecting': { fa: 'در حال اتصال به پایگاه داده...', en: 'Connecting to database...' },
  'header.dbRevision': { fa: 'نسخه همگام‌سازی', en: 'Sync Revision' },
  'header.themeLight': { fa: 'حالت روز', en: 'Light Mode' },
  'header.themeDark': { fa: 'حالت شب', en: 'Dark Mode' },
  'header.lang': { fa: 'تغییر زبان', en: 'Change Language' },
  'common.quickAction': { fa: 'ثبت فوری', en: 'Quick Action' },
  'common.records': { fa: 'مورد', en: 'records' },
  'common.customer': { fa: 'مخاطب', en: 'Customer' },
  'common.more': { fa: 'بیشتر', en: 'More' },
  'today': { fa: 'امروز', en: 'Today' },
  'tomorrow': { fa: 'فردا', en: 'Tomorrow' },
  'nextWeek': { fa: 'هفته آینده', en: 'Next Week' },
  'nextMonth': { fa: 'ماه آینده', en: 'Next Month' },
  'dashboard.criticalAlerts': { fa: 'هشدارهای اضطراری و اقدامات فوری', en: 'Critical Alerts & Urgent Actions' },
  'dashboard.activeCustomers': { fa: 'مشتریان فعال', en: 'Active Customers' },
  'dashboard.totalRevenue': { fa: 'مجموع درآمد وصول‌شده', en: 'Collected Revenue' },
  'dashboard.pendingTasks': { fa: 'وظایف در دست اقدام', en: 'Pending Tasks' },
  'dashboard.simsInStock': { fa: 'سیم‌کارت‌های موجود در انبار', en: 'SIMs In Stock' },
  'dashboard.activeRepairs': { fa: 'دستگاه‌های در حال تعمیر', en: 'Devices In Repair' },
  'dashboard.checksInSafe': { fa: 'چک‌های موجود در صندوق', en: 'Checks In Safe' },
  'dashboard.todayAgenda': { fa: 'کارتابل و اقدامات امروز', en: 'Today Agenda' },
  'dashboard.noTasksToday': { fa: 'برای امروز اقدام یا وظیفه فوری ثبت نشده است.', en: 'No urgent tasks or actions scheduled for today.' },
  'dashboard.recentCalls': { fa: 'آخرین تماس‌ها و مذاکرات', en: 'Recent Calls' },
  'dashboard.viewAll': { fa: 'مشاهده همه', en: 'View All' },
  'customers.customerProfile': { fa: 'پرونده مخاطب', en: 'Customer Profile' },
  'tasks.assignee': { fa: 'مسئول پیگیری', en: 'Assignee' },
  'repairs.statusDiagnosing': { fa: 'در حال عیب‌یابی', en: 'Diagnosing' },
  'repairs.problem': { fa: 'شرح ایراد و مشکل', en: 'Issue Description' },
  'repairs.warranty': { fa: 'مدت گارانتی', en: 'Warranty' },
  'repairs.receivedAt': { fa: 'تاریخ پذیرش', en: 'Received Date' },
  'repairs.customer': { fa: 'مشتری', en: 'Customer' },
  'repairs.newTicketModalTitle': { fa: 'صدور قبض پذیرش دستگاه جدید', en: 'New Device Intake Ticket' },
  'repairs.editTicketModalTitle': { fa: 'ویرایش قبض تعمیرات', en: 'Edit Repair Ticket' },
  'attachments.title': { fa: 'مدیریت اسناد، مدارک و پیوست‌ها', en: 'Documents & Attachments' },
  'attachments.subtitle': { fa: 'بایگانی اسناد، قراردادها، مدارک هویتی و پیوست‌های پرونده مشتریان', en: 'Archive of contracts, identity documents and customer file attachments' },
  'attachments.uploadNew': { fa: 'بارگذاری سند جدید', en: 'Upload New Document' },
  'attachments.searchPlaceholder': { fa: 'جستجو در نام فایل، مشتری یا توضیحات...', en: 'Search file name, customer or notes...' },
  'attachments.selectCustomer': { fa: 'انتخاب مشتری مقصد', en: 'Select Target Customer' },
  'attachments.download': { fa: 'دریافت فایل', en: 'Download File' },
  'attachments.noAttachments': { fa: 'هیچ سندی بارگذاری نشده است', en: 'No documents uploaded' },
  'attachments.noAttachmentsDesc': { fa: 'برای افزودن مدرک جدید از دکمه بارگذاری استفاده نمایید.', en: 'Use the upload button to attach a new document.' },
  'payments.paymentDate': { fa: 'تاریخ واریز', en: 'Payment Date' },
  'payments.referenceNumber': { fa: 'شماره پیگیری / فیش', en: 'Reference Number' },
  'payments.description': { fa: 'شرح و توضیحات واریزی', en: 'Payment Description' },
  'checks.type': { fa: 'نوع چک', en: 'Check Type' },
  'checks.typeAll': { fa: 'همه انواع چک', en: 'All Check Types' },
  'checks.statusTransferred': { fa: 'خرج‌شده / منتقل‌شده', en: 'Transferred' },
  'checks.bank': { fa: 'نام بانک', en: 'Bank Name' },
  'checks.branch': { fa: 'شعبه', en: 'Branch' },
  'checks.issuerName': { fa: 'صاحب حساب / صادرکننده', en: 'Drawer / Issuer' },
  'checks.amount': { fa: 'مبلغ چک', en: 'Check Amount' },
  'checks.customer': { fa: 'مشتری / طرف حساب', en: 'Customer / Counterparty' },
  'checks.description': { fa: 'توضیحات و بابت', en: 'Description / Purpose' },
  'checks.overdueAlert': { fa: 'سررسید گذشته و وصول‌نشده', en: 'Overdue & Uncleared' },
  'contracts.totalAmount': { fa: 'مبلغ کل قرارداد', en: 'Total Contract Amount' },
  'contracts.prepayment': { fa: 'پیش‌پرداخت', en: 'Prepayment' },
  'contracts.contractTitle': { fa: 'موضوع / عنوان قرارداد', en: 'Contract Title' },
  'contracts.customer': { fa: 'طرف قرارداد', en: 'Contract Party' },
  'reports.totalRevenueKPI': { fa: 'کل درآمد وصول‌شده', en: 'Total Collected Revenue' },
  'reports.revenueSub': { fa: 'مجموع تراکنش‌های نقدی و واریزی تایید شده', en: 'Total confirmed cash and bank transfer transactions' },
  'reports.checksInSafeKPI': { fa: 'ارزش چک‌های در جریان', en: 'Value of Checks In Safe' },
  'reports.checksInSafeSub': { fa: 'چک‌های صیادی معتبر موجود در صندوق', en: 'Valid Sayad checks held in the safe vault' },
  'reports.contractsValueKPI': { fa: 'ارزش کل قراردادها', en: 'Total Contracts Value' },
  'reports.simInventoryValueKPI': { fa: 'ارزش موجودی خطوط', en: 'SIM Inventory Value' },
  'reports.inventoryValue': { fa: 'ارزش موجودی انبار', en: 'Inventory Value' },
  'reports.totalCustomersCount': { fa: 'تعداد کل مشتریان', en: 'Total Customers' },
  'reports.totalCallsCount': { fa: 'کل تماس‌های ثبت‌شده', en: 'Total Logged Calls' },
  'reports.loggedCallsCount': { fa: 'تعداد کل تماس‌ها', en: 'Total Calls' },
  'reports.totalRepairsCount': { fa: 'پرونده‌های تعمیرات', en: 'Repair Tickets' },
  'reports.activeRepairsCount': { fa: 'دستگاه‌های در دست تعمیر', en: 'Devices In Repair' },
  'reports.mciSims': { fa: 'خطوط همراه اول', en: 'MCI Lines' },
  'reports.otherSims': { fa: 'سایر اپراتورها', en: 'Other Operators' },
  'reports.leadsPipeline': { fa: 'قیف جذب سرنخ‌ها', en: 'Lead Pipeline' },
  'reports.simAndTechDistribution': { fa: 'توزیع انبار سیم‌کارت و خدمات فنی', en: 'SIM & Tech Service Distribution' },
  'reports.aiInsightTitle': { fa: 'تحلیل هوشمند شاخص‌های تجاری', en: 'AI Business Insight' },
  'reports.aiInsightDesc': { fa: 'ارزیابی خودکار عملکرد فروش، وصول مطالبات و پیش‌بینی وضعیت نقدینگی', en: 'Automated sales performance, receivable collection and cashflow forecasting' },
  'reports.kpiCol': { fa: 'شاخص عملکردی', en: 'Metric' },
  'reports.valueCol': { fa: 'مقدار / ارزش', en: 'Value' },
  'reports.unitCol': { fa: 'واحد', en: 'Unit' },
  'reports.exportExcelBtn': { fa: 'خروجی جامع اکسل', en: 'Export Comprehensive Excel' },
};

// Also fix chat.unread: exists in en but needs fa
if (!newKeys['chat.unread']) newKeys['chat.unread'] = { fa: 'خوانده نشده', en: 'Unread' };

const all = { ...newKeys, ...extra };

const i18n = fs.readFileSync('src/lib/i18n.ts', 'utf8');

// Parse both dict blocks precisely
function extractBlock(src, name) {
  const marker = `const ${name}: Translations = {`;
  const start = src.indexOf(marker) + marker.length;
  const end = src.indexOf('\n};', start);
  return { start, end, body: src.slice(start, end) };
}

function renderEntry(key, val) {
  const faEsc = val.fa.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const enEsc = val.en.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `  "${key}": "${faEsc}",\n`;
}

function renderEntryEn(key, val) {
  const faEsc = val.fa.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const enEsc = val.en.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `  "${key}": "${enEsc}",\n`;
}

const faBlock = extractBlock(i18n, 'faTranslations');
const enBlock = extractBlock(i18n, 'enTranslations');

// Existing keys in each block
const existingFa = new Set([...faBlock.body.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]));
const existingEn = new Set([...enBlock.body.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]));

let faAdd = '';
let enAdd = '';
const injected = [];

for (const [key, val] of Object.entries(all)) {
  if (val.fa === undefined || val.en === undefined) continue;
  if (!existingFa.has(key)) {
    faAdd += renderEntry(key, val);
    injected.push(key);
  }
  if (!existingEn.has(key)) {
    enAdd += renderEntryEn(key, val);
  }
}

console.log('keys to inject into fa dict:', injected.length);
console.log('keys to inject into en dict:', Object.keys(all).filter(k => !existingEn.has(k)).length);

// Inject before closing of each block
const result =
  i18n.slice(0, faBlock.end) + '\n' + faAdd + i18n.slice(faBlock.end, enBlock.end) + '\n' + enAdd + i18n.slice(enBlock.end);

fs.writeFileSync('src/lib/i18n.ts', result);
console.log('i18n.ts updated. New size:', result.length);