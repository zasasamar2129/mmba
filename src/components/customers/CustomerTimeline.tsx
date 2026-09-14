import React from 'react';
import { CustomerTimelineEvent } from '../../types';
import {
  PhoneCall, CheckSquare, FileText, CreditCard,
  Wrench, Smartphone, Paperclip, MessageSquare, Clock
} from 'lucide-react';
import { formatPersianDate, getRelativeTimeFa } from '../../lib/dateUtils';
import { Badge } from '../ui/Badge';

export interface CustomerTimelineProps {
  events: CustomerTimelineEvent[];
  onEventClick?: (event: CustomerTimelineEvent) => void;
}

export const CustomerTimeline: React.FC<CustomerTimelineProps> = ({ events, onEventClick }) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CALL':
        return <PhoneCall className="w-4 h-4 text-sky-400" />;
      case 'TASK':
        return <CheckSquare className="w-4 h-4 text-emerald-400" />;
      case 'PAYMENT':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'CHECK':
        return <FileText className="w-4 h-4 text-purple-400" />;
      case 'CONTRACT':
        return <FileText className="w-4 h-4 text-indigo-400" />;
      case 'REPAIR':
        return <Wrench className="w-4 h-4 text-amber-400" />;
      case 'SIM':
        return <Smartphone className="w-4 h-4 text-cyan-400" />;
      case 'ATTACHMENT':
        return <Paperclip className="w-4 h-4 text-slate-300" />;
      default:
        return <MessageSquare className="w-4 h-4 text-slate-400" />;
    }
  };

  const getEventBadge = (type: string) => {
    const badges: Record<string, { text: string; variant: 'info' | 'success' | 'warning' | 'purple' | 'amber' | 'default' }> = {
      CALL: { text: 'تماس ثبت شده', variant: 'info' },
      TASK: { text: 'وظیفه / پیگیری', variant: 'success' },
      PAYMENT: { text: 'تراکنش مالی', variant: 'success' },
      CHECK: { text: 'چک صیادی', variant: 'purple' },
      CONTRACT: { text: 'قرارداد', variant: 'purple' },
      REPAIR: { text: 'تعمیرات', variant: 'amber' },
      SIM: { text: 'تخصیص سیم‌کارت', variant: 'info' },
      ATTACHMENT: { text: 'پیوست سند', variant: 'default' },
      STATUS_CHANGE: { text: 'تغییر وضعیت', variant: 'warning' },
    };
    return badges[type] || { text: 'رویداد', variant: 'default' };
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 rounded-2xl liquid-glass-subtle p-6 border border-slate-800">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">هنوز هیچ رویدادی برای این مشتری ثبت نشده است</p>
        <p className="text-xs text-slate-600 mt-1">با ثبت اولین تماس یا وظیفه، تایم‌لاین کامل تشکیل خواهد شد.</p>
      </div>
    );
  }

  return (
    <div className="relative border-r-2 border-slate-800/80 mr-3 pr-6 space-y-6 text-right">
      {events.map((evt) => {
        const badgeInfo = getEventBadge(evt.type);
        return (
          <div
            key={evt.id}
            onClick={() => onEventClick?.(evt)}
            className="relative group transition-all"
          >
            {/* Timeline node icon */}
            <div className="absolute -right-[35px] top-1 w-7 h-7 rounded-full bg-slate-900 border-2 border-indigo-500/50 flex items-center justify-center shadow-md group-hover:border-indigo-400 group-hover:scale-110 transition-all">
              {getEventIcon(evt.type)}
            </div>

            {/* Event Card */}
            <div className="p-4 rounded-2xl liquid-glass-card border border-slate-800 hover:border-slate-700 transition-all group-hover:shadow-lg">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-indigo-300">
                    {evt.title}
                  </h4>
                  <Badge variant={badgeInfo.variant} size="sm">
                    {badgeInfo.text}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>ثبت توسط: {evt.userName}</span>
                  <span>•</span>
                  <span>{getRelativeTimeFa(evt.timestamp)}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                {evt.description}
              </p>

              <div className="mt-2 text-[10px] text-slate-500">
                تاریخ دقیق: {formatPersianDate(evt.timestamp, true)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
