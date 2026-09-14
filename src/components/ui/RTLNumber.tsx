import React from 'react';
import { toPersianDigits } from '../../lib/dateUtils';
import { formatPhoneNumber, formatSayadNumber, formatICCID, formatPercentage } from '../../lib/numberUtils';
import { cn } from './Button';

export interface RTLNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string | number | undefined | null;
  type?: 'phone' | 'sayad' | 'iccid' | 'price' | 'percentage' | 'code' | 'date' | 'raw' | 'count';
  isPersian?: boolean;
  currency?: 'IRT' | 'IRR';
  suffix?: string;
}

export const RTLNumber: React.FC<RTLNumberProps> = ({
  value,
  type = 'raw',
  isPersian = false,
  currency = 'IRT',
  suffix,
  className,
  ...props
}) => {
  if (value === undefined || value === null || value === '') {
    return <span className="text-slate-400 font-mono">-</span>;
  }

  switch (type) {
    case 'phone': {
      const formatted = formatPhoneNumber(String(value), isPersian);
      return (
        <span
          className={cn('inline-block tabular-nums font-mono', className)}
          dir="ltr"
          style={{ unicodeBidi: 'isolate', direction: 'ltr', textAlign: 'right' }}
          {...props}
        >
          {formatted}
        </span>
      );
    }
    case 'sayad': {
      const formatted = formatSayadNumber(String(value), isPersian);
      return (
        <span
          className={cn('inline-block tabular-nums font-mono', className)}
          dir="ltr"
          style={{ unicodeBidi: 'isolate', direction: 'ltr' }}
          {...props}
        >
          {formatted}
        </span>
      );
    }
    case 'iccid': {
      const formatted = formatICCID(String(value), isPersian);
      return (
        <span
          className={cn('inline-block tabular-nums font-mono tracking-wider', className)}
          dir="ltr"
          style={{ unicodeBidi: 'isolate', direction: 'ltr' }}
          {...props}
        >
          {formatted}
        </span>
      );
    }
    case 'price': {
      const num = Math.round(Number(value) || 0);
      const formatted = num.toLocaleString('en-US');
      const displayNum = isPersian ? toPersianDigits(formatted) : formatted;
      const currencyText = currency === 'IRT' ? 'تومان' : 'ریال';

      return (
        <span
          className={cn('inline-flex items-center gap-1 tabular-nums font-semibold', className)}
          dir="rtl"
          style={{ unicodeBidi: 'isolate' }}
          {...props}
        >
          <span
            className="tabular-nums font-mono inline-block"
            dir="ltr"
            style={{ unicodeBidi: 'isolate', direction: 'ltr' }}
          >
            {displayNum}
          </span>
          <span className="text-xs font-normal opacity-80 select-none">
            {suffix || currencyText}
          </span>
        </span>
      );
    }
    case 'percentage': {
      const formatted = formatPercentage(value, isPersian);
      return (
        <span
          className={cn('inline-block tabular-nums font-mono font-semibold', className)}
          dir="ltr"
          style={{ unicodeBidi: 'isolate', direction: 'ltr' }}
          {...props}
        >
          {formatted}
        </span>
      );
    }
    case 'count': {
      const displayNum = isPersian ? toPersianDigits(String(value)) : String(value);
      return (
        <span
          className={cn('inline-flex items-center gap-1 tabular-nums', className)}
          dir="rtl"
          style={{ unicodeBidi: 'isolate' }}
          {...props}
        >
          <span
            className="tabular-nums inline-block font-bold"
            dir="ltr"
            style={{ unicodeBidi: 'isolate', direction: 'ltr' }}
          >
            {displayNum}
          </span>
          {suffix && (
            <span className="text-inherit font-normal opacity-90 select-none">
              {suffix}
            </span>
          )}
        </span>
      );
    }
    case 'code':
    case 'date':
    case 'raw':
    default: {
      const formatted = isPersian ? toPersianDigits(String(value)) : String(value);
      return (
        <span
          className={cn('inline-block tabular-nums font-mono', className)}
          dir="ltr"
          style={{ unicodeBidi: 'isolate', direction: 'ltr' }}
          {...props}
        >
          {formatted}
        </span>
      );
    }
  }
};
