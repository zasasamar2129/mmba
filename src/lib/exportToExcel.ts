import * as XLSX from 'xlsx';
import { Customer, Call, Task, Contract, Payment, Check, SimCard, Repair, VoiceNote, AuditLog } from '../types';
import { formatPersianDate, formatPersianShortDate, toPersianDigits } from './dateUtils';
import { formatToman } from './currencyUtils';

/**
 * Generic helper to export JSON data to an XLSX workbook and trigger browser download
 */
export function exportTableToExcel(
  data: Record<string, any>[],
  fileName: string,
  sheetName = 'گزارش'
) {
  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-fit column widths based on content
    if (data.length > 0) {
      const colWidths = Object.keys(data[0]).map((key) => {
        const headerLen = String(key).length;
        const maxValLen = Math.max(
          ...data.map((row) => (row[key] !== undefined && row[key] !== null ? String(row[key]).length : 0))
        );
        return { wch: Math.max(headerLen, maxValLen) + 5 };
      });
      ws['!cols'] = colWidths;
    }

    // Set Right-to-Left orientation for Persian Excel views
    if (!ws['!views']) {
      ws['!views'] = [];
    }
    ws['!views'].push({ RTL: true });

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const safeFileName = `${fileName}_${new Date().toISOString().substring(0, 10)}.xlsx`;
    XLSX.writeFile(wb, safeFileName);
    return true;
  } catch (err) {
    console.error('Error exporting to Excel:', err);
    return false;
  }
}

export const exportToExcel = exportTableToExcel;

/**
 * Export Customers List
 */
export function exportCustomersToExcel(customers: Customer[] = []) {
  const statusLabels: Record<string, string> = {
    VIP: 'ویژه (VIP)',
    ACTIVE: 'فعال',
    PROSPECT: 'مذاکره / لید',
    INACTIVE: 'غیرفعال',
    BLACKLISTED: 'مسدود',
  };

  const rows = (customers || []).map((c, index) => ({
    'ردیف': index + 1,
    'کد پرونده': c.code || '-',
    'نام و نام خانوادگی': c.name,
    'شماره موبایل': c.mobile,
    'تلفن ثابت': c.phone || '-',
    'کد ملی / شناسه ملی': c.nationalCode || '-',
    'پست الکترونیک': c.email || '-',
    'نام شرکت / سازمان': c.companyName || '-',
    'شهر': c.city || '-',
    'وضعیت مشتری': statusLabels[c.status] || c.status,
    'سقف اعتبار (تومان)': c.creditLimit ? c.creditLimit.toLocaleString('fa-IR') : '۰',
    'برچسب‌ها': (c.tags || []).join('، '),
    'آدرس': c.address || '-',
    'یادداشت‌ها': c.notes || '-',
    'تاریخ ایجاد': formatPersianDate(c.createdAt),
  }));

  return exportTableToExcel(rows, 'MMBA_Customers', 'مشتریان');
}

/**
 * Export Calls Log
 */
export function exportCallsToExcel(calls: Call[] = []) {
  const callTypeLabels: Record<string, string> = {
    INCOMING: 'ورودی',
    OUTGOING: 'خروجی',
    MISSED: 'از دست رفته',
  };

  const resultLabels: Record<string, string> = {
    RESOLVED: 'حل و فصل شده',
    FOLLOW_UP_REQUIRED: 'نیازمند پیگیری بعدی',
    PROMISE_PAYMENT: 'وعده پرداخت وجه',
    NO_ANSWER: 'عدم پاسخگویی',
    CANCELLED: 'لغو شده',
  };

  const rows = (calls || []).map((call, index) => {
    const minutes = Math.floor(call.durationSeconds / 60);
    const seconds = call.durationSeconds % 60;
    const durationStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    return {
      'ردیف': index + 1,
      'نام مشتری': call.customerName,
      'شماره تماس': call.customerMobile,
      'کارشناس ثبت‌کننده': call.userName,
      'نوع تماس': callTypeLabels[call.callType] || call.callType,
      'موضوع تماس': call.subject,
      'مدت مکالمه': durationStr,
      'نتیجه تماس': resultLabels[call.result] || call.result,
      'نیازمند پیگیری': call.followUpRequired ? 'بله' : 'خیر',
      'موعد پیگیری': call.followUpDueDate ? formatPersianDate(call.followUpDueDate, true) : '-',
      'شرح مکالمه و توضیحات': call.notes || '-',
      'تاریخ و زمان تماس': formatPersianDate(call.dateTime, true),
    };
  });

  return exportTableToExcel(rows, 'MMBA_Calls', 'تماس‌ها');
}

/**
 * Export Tasks
 */
export function exportTasksToExcel(tasks: Task[] = []) {
  const priorityLabels: Record<string, string> = {
    URGENT: 'فوری و اضطراری',
    HIGH: 'بالا',
    MEDIUM: 'متوسط',
    LOW: 'پایین',
  };

  const statusLabels: Record<string, string> = {
    TODO: 'در انتظار انجام',
    IN_PROGRESS: 'در حال انجام',
    WAITING: 'معلق / منتظر شخص ثالث',
    COMPLETED: 'انجام شده',
    CANCELLED: 'لغو شده',
  };

  const rows = (tasks || []).map((t, index) => ({
    'ردیف': index + 1,
    'عنوان وظیفه': t.title,
    'مشتری مرتبط': t.customerName || '-',
    'مسئول انجام': t.assignedUserName,
    'ایجادکننده': t.creatorUserName,
    'اولویت': priorityLabels[t.priority] || t.priority,
    'وضعیت': statusLabels[t.status] || t.status,
    'سررسید موعد انجام': formatPersianDate(t.dueDate, true),
    'تاریخ یادآوری': t.reminderDate ? formatPersianDate(t.reminderDate, true) : '-',
    'توضیحات وظیفه': t.description || '-',
    'تاریخ ایجاد': formatPersianDate(t.createdAt),
  }));

  return exportTableToExcel(rows, 'MMBA_Tasks', 'وظایف');
}

/**
 * Export Contracts
 */
export function exportContractsToExcel(contracts: Contract[] = []) {
  const typeLabels: Record<string, string> = {
    SERVICE: 'خدمات و پشتیبانی',
    SALES: 'فروش کالا و تجهیزات',
    SUBSCRIPTION: 'اشتراک و خطوط',
    MAINTENANCE: 'نگهداری و تعمیرات',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'پیش‌نویس',
    PENDING_SIGNATURE: 'در انتظار امضا',
    ACTIVE: 'فعال و معتبر',
    EXPIRED: 'منقضی شده',
    TERMINATED: 'فسخ شده',
  };

  const rows = (contracts || []).map((cnt, index) => ({
    'ردیف': index + 1,
    'شماره قرارداد': cnt.contractNumber,
    'عنوان قرارداد': cnt.title,
    'طرف قرارداد (مشتری)': cnt.customerName,
    'نوع قرارداد': typeLabels[cnt.type] || cnt.type,
    'مبلغ کل (تومان)': cnt.amount ? cnt.amount.toLocaleString('fa-IR') : '۰',
    'وضعیت': statusLabels[cnt.status] || cnt.status,
    'تاریخ شروع': formatPersianShortDate(cnt.startDate),
    'تاریخ پایان': formatPersianShortDate(cnt.endDate),
    'شرایط و تعهدات': cnt.termsAndConditions || '-',
    'توضیحات': cnt.notes || '-',
  }));

  return exportTableToExcel(rows, 'MMBA_Contracts', 'قراردادها');
}

/**
 * Export Payments
 */
export function exportPaymentsToExcel(payments: Payment[] = []) {
  const methodLabels: Record<string, string> = {
    CASH: 'نقدی',
    CARD_READER: 'دستگاه کارتخوان (POS)',
    BANK_TRANSFER: 'حواله پایا / ساتنا / بانکی',
    ONLINE_GATEWAY: 'درگاه پرداخت اینترنتی',
    CHECK: 'چک صیادی',
  };

  const statusLabels: Record<string, string> = {
    REPORTED: 'گزارش شده',
    VERIFIED: 'تأیید حسابداری',
    COMPLETED: 'نهایی و تسویه شده',
    REJECTED: 'رد شده',
  };

  const rows = (payments || []).map((p, index) => ({
    'ردیف': index + 1,
    'شماره رسید': p.receiptNumber || '-',
    'نام مشتری': p.customerName,
    'مبلغ پرداختی (تومان)': p.amount ? p.amount.toLocaleString('fa-IR') : '۰',
    'روش پرداخت': methodLabels[p.method] || p.method,
    'شماره پیگیری / ارجاع': p.referenceNumber || '-',
    'وضعیت مالی': statusLabels[p.status] || p.status,
    'گزارش‌کننده': p.reportedByUserName || '-',
    'تأییدکننده حسابداری': p.verifiedByUserName || '-',
    'تاریخ و زمان تراکنش': formatPersianDate(p.date, true),
    'بابت / توضیحات': p.notes || '-',
  }));

  return exportTableToExcel(rows, 'MMBA_Payments', 'دریافت_پرداخت');
}

/**
 * Export Checks
 */
export function exportChecksToExcel(checks: Check[] = []) {
  const statusLabels: Record<string, string> = {
    RECEIVED: 'نزد صندوق (دریافت شده)',
    DEPOSITED: 'واگذار شده به بانک',
    CLEARED: 'پاس شده (وصول نهایی)',
    BOUNCED: 'برگشت خورده',
    RETURNED: 'مسترد شده به مشتری',
  };

  const rows = (checks || []).map((chk, index) => ({
    'ردیف': index + 1,
    'شناسه ۱۶ رقمی صیاد': chk.sayadNumber,
    'شماره سریال چک': chk.checkNumber,
    'نام بانک': chk.bankName,
    'نام شعبه': chk.branchName || '-',
    'نام مشتری (صاحب حساب)': chk.customerName,
    'مبلغ چک (تومان)': chk.amount ? chk.amount.toLocaleString('fa-IR') : '۰',
    'تاریخ سررسید': formatPersianShortDate(chk.dueDate),
    'تاریخ صدور': formatPersianShortDate(chk.issueDate),
    'وضعیت وصول': statusLabels[chk.status] || chk.status,
    'در وجه': chk.receiverName || '-',
    'توضیحات': chk.notes || '-',
  }));

  return exportTableToExcel(rows, 'MMBA_Checks', 'چک‌های_صیادی');
}

/**
 * Export SIM Cards
 */
export function exportSimsToExcel(sims: SimCard[] = []) {
  const opLabels: Record<string, string> = {
    MCI: 'همراه اول (MCI)',
    IRANCELL: 'ایرانسل (MTN)',
    RIGHTEL: 'رایتل (Rightel)',
    SHATEL: 'شاتل موبایل',
  };

  const statusLabels: Record<string, string> = {
    IN_STOCK: 'موجود در انبار',
    ALLOCATED: 'تخصیص یافته به مشتری',
    ACTIVATED: 'فعال و تحویل شده',
    SUSPENDED: 'مسدود / قطع موقت',
    TERMINATED: 'سلب امتیاز / باطل شده',
  };

  const rows = (sims || []).map((sim, index) => ({
    'ردیف': index + 1,
    'شماره خط': sim.phoneNumber,
    'اپراتور': opLabels[sim.operator] || sim.operator,
    'سریال سیم‌کارت (ICCID)': sim.iccid,
    'مشتری تخصیص یافته': sim.customerName || 'تخصیص نیافته',
    'وضعیت خط': statusLabels[sim.status] || sim.status,
    'محل نگهداری فیزیکی': sim.shelfLocation || '-',
    'کد PIN': sim.pinCode || '-',
    'کد PUK': sim.pukCode || '-',
    'تاریخ فعال‌سازی': sim.activatedAt ? formatPersianDate(sim.activatedAt) : '-',
    'توضیحات': sim.notes || '-',
  }));

  return exportTableToExcel(rows, 'MMBA_Sim_Cards', 'سیم‌کارت‌ها');
}

/**
 * Export Repairs
 */
export function exportRepairsToExcel(repairs: Repair[] = []) {
  const statusLabels: Record<string, string> = {
    RECEIVED: 'پذیرش اولیه',
    DIAGNOSING: 'در حال عیب‌یابی',
    WAITING_PARTS: 'در انتظار قطعه',
    IN_PROGRESS: 'در دست تعمیر',
    TESTING: 'تست نهایی کیفیت',
    READY: 'آماده تحویل به مشتری',
    DELIVERED: 'تحویل داده شد',
    CANCELLED: 'لغو / غیرقابل تعمیر',
  };

  const rows = (repairs || []).map((r, index) => ({
    'ردیف': index + 1,
    'کد رهگیری پذیرش': r.trackingCode,
    'نام مشتری': r.customerName,
    'شماره تماس مشتری': r.customerMobile,
    'نوع دستگاه': r.deviceType,
    'برند': r.brand,
    'مدل': r.model,
    'شماره سریال / IMEI': r.serialNumber || '-',
    'شرح ایراد اظهار شده': r.problemDescription,
    'تکنسین مسئول': r.technicianUserName || '-',
    'وضعیت پرونده': statusLabels[r.status] || r.status,
    'تشخیص فنی': r.diagnosis || '-',
    'اقدامات انجام شده': r.workPerformed || '-',
    'هزینه تخمینی (تومان)': r.estimatedCost ? r.estimatedCost.toLocaleString('fa-IR') : '۰',
    'هزینه نهایی (تومان)': r.finalCost ? r.finalCost.toLocaleString('fa-IR') : '۰',
    'تأییدیه مشتری': r.customerApproved ? 'تأیید شده' : 'در انتظار تأیید',
    'مدت گارانتی (روز)': r.warrantyPeriodDays ? toPersianDigits(r.warrantyPeriodDays) : '۰',
    'تاریخ پذیرش': formatPersianDate(r.receivedDate),
  }));

  return exportTableToExcel(rows, 'MMBA_Repairs', 'تعمیرات');
}

/**
 * Export Voice Notes
 */
export function exportVoiceNotesToExcel(notes: VoiceNote[] = []) {
  const rows = (notes || []).map((vn, index) => ({
    'ردیف': index + 1,
    'عنوان صوت': vn.title,
    'مشتری مرتبط': vn.customerName || '-',
    'دسته‌بندی': vn.category || '-',
    'مدت زمان (ثانیه)': toPersianDigits(vn.durationSeconds),
    'متن پیاده‌سازی شده': vn.transcription || '-',
    'ثبت‌کننده': vn.createdByName,
    'تاریخ ضبط': formatPersianDate(vn.createdAt, true),
  }));

  return exportTableToExcel(rows, 'MMBA_Voice_Notes', 'یادداشت‌های_صوتی');
}

/**
 * Export Audit Logs
 */
export function exportAuditLogsToExcel(logs: AuditLog[] = []) {
  const rows = (logs || []).map((log, index) => ({
    'ردیف': index + 1,
    'کاربر عامل': log.userName,
    'نقش کاربر': log.userRole,
    'عملیات انجام شده': log.action,
    'بخش / ماژول': log.module,
    'نوع موجودیت هدف': log.targetType || '-',
    'شناسه هدف': log.targetId || '-',
    'جزئیات رویداد': log.details || '-',
    'آدرس IP': log.ipAddress || '-',
    'زمان ثبت رویداد': formatPersianDate(log.timestamp, true),
  }));

  return exportTableToExcel(rows, 'MMBA_Audit_Logs', 'لاگ‌های_امنیتی');
}

/**
 * Export Comprehensive Dashboard Summary Report
 */
export function exportDashboardReportToExcel(dashboardData: {
  stats: Record<string, number | string>;
  recentCustomers: Customer[];
  recentPayments: Payment[];
  upcomingTasks: Task[];
  activeRepairs: Repair[];
}) {
  try {
    const wb = XLSX.utils.book_new();

    // 1. KPI Summary Sheet
    const kpiRows = Object.entries(dashboardData.stats).map(([kpiName, value]) => ({
      'شاخص کلیدی عملکرد (KPI)': kpiName,
      'مقدار / وضعیت': typeof value === 'number' ? value.toLocaleString('fa-IR') : value,
    }));
    const wsKPI = XLSX.utils.json_to_sheet(kpiRows);
    wsKPI['!cols'] = [{ wch: 35 }, { wch: 25 }];
    wsKPI['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsKPI, 'خلاصه شاخص‌ها');

    // 2. Recent Payments Sheet
    if (dashboardData.recentPayments && dashboardData.recentPayments.length > 0) {
      const payRows = dashboardData.recentPayments.map((p, i) => ({
        'ردیف': i + 1,
        'شماره رسید': p.receiptNumber || '-',
        'مشتری': p.customerName,
        'مبلغ (تومان)': p.amount ? p.amount.toLocaleString('fa-IR') : '۰',
        'روش': p.method,
        'وضعیت': p.status,
        'تاریخ': formatPersianDate(p.date),
      }));
      const wsPay = XLSX.utils.json_to_sheet(payRows);
      wsPay['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, wsPay, 'تراکنش‌های اخیر');
    }

    // 3. Upcoming Tasks Sheet
    if (dashboardData.upcomingTasks && dashboardData.upcomingTasks.length > 0) {
      const taskRows = dashboardData.upcomingTasks.map((t, i) => ({
        'ردیف': i + 1,
        'عنوان وظیفه': t.title,
        'مشتری': t.customerName || '-',
        'مسئول': t.assignedUserName,
        'اولویت': t.priority,
        'سررسید': formatPersianDate(t.dueDate),
      }));
      const wsTasks = XLSX.utils.json_to_sheet(taskRows);
      wsTasks['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, wsTasks, 'وظایف پیش‌رو');
    }

    const safeFileName = `MMBA_Dashboard_Report_${new Date().toISOString().substring(0, 10)}.xlsx`;
    XLSX.writeFile(wb, safeFileName);
    return true;
  } catch (err) {
    console.error('Failed to export dashboard report:', err);
    return false;
  }
}
