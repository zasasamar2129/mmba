import React from 'react';
import { AuditLog } from '../../types';
import { formatPersianDate } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';
import {
  Upload, PenLine, Share2, Eye, Download, Trash2, RefreshCw, History
} from 'lucide-react';

export interface DocumentAuditLogProps {
  auditLogs: AuditLog[];
  documentName?: string;
}

const actionMeta: Record<string, { labelFa: string; labelEn: string; icon: React.ReactNode; color: string }> = {
  UPLOAD: { labelFa: 'بارگذاری', labelEn: 'Upload', icon: <Upload className="w-3.5 h-3.5" />, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  RENAME: { labelFa: 'تغییر نام', labelEn: 'Rename', icon: <PenLine className="w-3.5 h-3.5" />, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  SHARE: { labelFa: 'اشتراک گذاری', labelEn: 'Share', icon: <Share2 className="w-3.5 h-3.5" />, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  VIEW: { labelFa: 'مشاهده', labelEn: 'View', icon: <Eye className="w-3.5 h-3.5" />, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
  DOWNLOAD: { labelFa: 'دانلود', labelEn: 'Download', icon: <Download className="w-3.5 h-3.5" />, color: 'text-violet-500 bg-violet-500/10 border-violet-500/20' },
  REPLACE: { labelFa: 'جایگزینی', labelEn: 'Replace', icon: <RefreshCw className="w-3.5 h-3.5" />, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  DELETE: { labelFa: 'حذف', labelEn: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
};

export const DocumentAuditLog: React.FC<DocumentAuditLogProps> = ({
  auditLogs,
  documentName,
}) => {
  const { isRtl } = useTranslation();

  if (!auditLogs || auditLogs.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-400">
        {isRtl ? 'هیچ رویدادی برای این سند ثبت نشده است.' : 'No activity recorded for this document.'}
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-80 overflow-y-auto">
      {auditLogs.map((log) => {
        const meta = actionMeta[log.action?.toUpperCase()] || {
          labelFa: log.action,
          labelEn: log.action,
          icon: <History className="w-3.5 h-3.5" />,
          color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
        };
        return (
          <div
            key={log.id}
            className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/70"
          >
            <span className={`p-1.5 rounded-lg border shrink-0 ${meta.color}`}>
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isRtl ? meta.labelFa : meta.labelEn}
                </span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {log.timestamp ? formatPersianDate(log.timestamp, true) : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed truncate" title={log.details}>
                {log.details}
              </p>
              <p className="text-[10px] text-slate-400">
                {log.userName}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};