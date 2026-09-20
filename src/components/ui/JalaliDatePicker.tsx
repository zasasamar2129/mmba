import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon, Clock, ChevronRight, ChevronLeft,
  X, Check, Sparkles
} from 'lucide-react';
import {
  formatPersianDate,
  formatPersianShortDate,
  toPersianDigits,
  gregorianToJalali,
  jalaliToGregorian,
  getJalaliMonthCalendar,
  parseDateInputToJalali,
  jalaliToIsoDateOnly,
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEK_DAYS_SHORT,
} from '../../lib/dateUtils';

export interface JalaliDatePickerProps {
  label?: string;
  value?: string | null;
  onChange: (isoValue: string) => void;
  includeTime?: boolean;
  showTime?: boolean;
  isRequired?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  error?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
  id?: string;
  align?: 'right' | 'left' | 'center' | 'auto';
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  label,
  value,
  onChange,
  includeTime = false,
  showTime = false,
  isRequired = false,
  disabled = false,
  placeholder,
  helperText,
  error,
  className = '',
  id,
  align = 'auto',
}) => {
  const hasTime = Boolean(includeTime || showTime);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 100, left: 100, width: 340 });

  // Parsed current state from value
  const parsed = useMemo(() => {
    return parseDateInputToJalali(value);
  }, [value]);

  // View state for the calendar (which month and year is currently displayed)
  const [viewYear, setViewYear] = useState<number>(parsed.jy);
  const [viewMonth, setViewMonth] = useState<number>(parsed.jm);
  const [selectedHour, setSelectedHour] = useState<number>(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState<number>(parsed.minute);

  // Precision viewport bounding calculation
  const updatePosition = useCallback(() => {
    if (!triggerButtonRef.current) return;
    const rect = triggerButtonRef.current.getBoundingClientRect();
    const popupWidth = Math.min(340, window.innerWidth - 24);

    // Calculate available space and clamp popup to fit within viewport
    const maxPopupHeight = Math.min(hasTime ? 450 : 365, window.innerHeight - 24);

    let top: number;
    if (rect.bottom + maxPopupHeight + 12 <= window.innerHeight) {
      top = rect.bottom + 6;
    } else if (rect.top - maxPopupHeight - 6 >= 12) {
      top = rect.top - maxPopupHeight - 6;
    } else {
      // When neither fits, center in the available space
      top = Math.max(12, Math.min(window.innerHeight - maxPopupHeight - 12, rect.top + rect.height / 2 - maxPopupHeight / 2));
    }

    // Horizontal placement with RTL priority
    let left = rect.right - popupWidth;
    if (align === 'left') {
      left = rect.left;
    } else if (align === 'center') {
      left = rect.left + (rect.width - popupWidth) / 2;
    }

    if (left < 12) left = 12;
    if (left + popupWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popupWidth - 12);
    }

    setCoords({ top, left, width: popupWidth });
  }, [hasTime, align]);

  // Update popup position on open and watch scroll/resize
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => {
        updatePosition();
      };
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen, updatePosition]);

  // Sync internal view when value changes externally
  useEffect(() => {
    if (value) {
      const p = parseDateInputToJalali(value);
      setViewYear(p.jy);
      setViewMonth(p.jm);
      setSelectedHour(p.hour);
      setSelectedMinute(p.minute);
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerButtonRef.current && !triggerButtonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  // Calendar matrix calculation
  const calendarData = useMemo(() => {
    return getJalaliMonthCalendar(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (jy: number, jm: number, jd: number) => {
    if (hasTime) {
      const g = jalaliToGregorian(jy, jm, jd);
      const isoFormatted = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}T${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
      onChange(isoFormatted);
    } else {
      const isoDateOnly = jalaliToIsoDateOnly(jy, jm, jd);
      onChange(isoDateOnly);
      setIsOpen(false);
    }
  };

  const handleQuickSelect = (type: 'today' | 'tomorrow' | 'nextWeek' | 'nextMonth') => {
    const now = new Date();
    let targetDate = new Date();

    if (type === 'today') {
      targetDate = now;
    } else if (type === 'tomorrow') {
      targetDate.setDate(now.getDate() + 1);
    } else if (type === 'nextWeek') {
      targetDate.setDate(now.getDate() + 7);
    } else if (type === 'nextMonth') {
      targetDate.setMonth(now.getMonth() + 1);
    }

    const j = gregorianToJalali(
      targetDate.getFullYear(),
      targetDate.getMonth() + 1,
      targetDate.getDate()
    );

    setViewYear(j.jy);
    setViewMonth(j.jm);

    if (hasTime) {
      const isoFormatted = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}T${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
      onChange(isoFormatted);
    } else {
      const isoDateOnly = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      onChange(isoDateOnly);
      setIsOpen(false);
    }
  };

  const handleTimeChange = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);

    const baseVal = value || new Date().toISOString();
    const p = parseDateInputToJalali(baseVal);
    const g = jalaliToGregorian(p.jy, p.jm, p.jd);
    const isoFormatted = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onChange(isoFormatted);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  // Generate Year Options
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    const currentJ = gregorianToJalali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    for (let y = currentJ.jy - 50; y <= currentJ.jy + 10; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const displayFormatted = useMemo(() => {
    if (!value) return '';
    return hasTime ? formatPersianDate(value, true) : formatPersianDate(value, false);
  }, [value, hasTime]);

  return (
    <div ref={containerRef} className={`relative text-end ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between gap-2 flex-wrap"
        >
          <span className="flex items-center gap-1">
            <span>{label}</span>
            {isRequired && <span className="text-rose-500 dark:text-rose-400 font-bold">*</span>}
          </span>
          {value && (
            <span className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-500/40 px-2 py-0.5 rounded-lg font-mono shrink-0">
              {toPersianDigits(hasTime ? formatPersianDate(value, true) : formatPersianShortDate(value))}
            </span>
          )}
        </label>
      )}

      {/* Main Input Display Trigger */}
      <div className="relative">
        <button
          ref={triggerButtonRef}
          type="button"
          id={id}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
            }
          }}
          className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex items-center justify-between transition-all ${
            disabled
              ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
              : isOpen
              ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
              : error
              ? 'border-rose-500/80 bg-rose-50/50 dark:bg-rose-950/20'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className={`p-1.5 rounded-lg ${value ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              {hasTime ? <Clock className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
            </div>
            <span className={`truncate font-medium ${value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
              {displayFormatted || placeholder || (hasTime ? 'انتخاب تاریخ و ساعت شمسی...' : 'انتخاب تاریخ شمسی...')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 me-2">
            {value && !isRequired && !disabled && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-1 rounded-md text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                title="پاک کردن تاریخ"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <div className="text-slate-400 text-[10px] transform transition-transform duration-200">
              {isOpen ? '▲' : '▼'}
            </div>
          </div>
        </button>
      </div>

      {/* Calendar Dropdown Popup via Portal */}
      {isOpen && !disabled && typeof document !== 'undefined' && createPortal(
        <>
          {/* Subtle backdrop click catcher */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs z-[999990] transition-opacity"
          />

          <div
            ref={dropdownRef}
            dir="rtl"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 999999,
              maxHeight: `calc(100vh - 24px)`,
            }}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 text-end space-y-3.5 text-slate-900 dark:text-slate-100 overflow-y-auto"
          >
            {/* Header Month / Year Navigation */}
            <div className="flex items-center justify-between gap-1.5 pb-3 border-b border-slate-200 dark:border-slate-800">
              {/* Prev Month button (RTL: right arrow goes to prev month) */}
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700/60"
                title="ماه قبل"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Selects for Month & Year */}
              <div className="flex items-center gap-1.5">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {PERSIAN_MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {toPersianDigits(y)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Next Month button (RTL: left arrow goes to next month) */}
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700/60"
                title="ماه بعد"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Pre-select Buttons */}
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickSelect('today')}
                className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/25 hover:bg-indigo-100 dark:hover:bg-indigo-500/40 text-indigo-700 dark:text-indigo-200 font-semibold border border-indigo-200 dark:border-indigo-500/30 whitespace-nowrap transition-colors"
              >
                امروز
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('tomorrow')}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium border border-slate-200 dark:border-slate-700/60 whitespace-nowrap transition-colors"
              >
                فردا
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('nextWeek')}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium border border-slate-200 dark:border-slate-700/60 whitespace-nowrap transition-colors"
              >
                هفته بعد
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('nextMonth')}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium border border-slate-200 dark:border-slate-700/60 whitespace-nowrap transition-colors"
              >
                ماه بعد
              </button>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-600 dark:text-slate-400 py-1.5 bg-slate-50 dark:bg-slate-950/80 rounded-lg border border-slate-200 dark:border-slate-800/80">
              {PERSIAN_WEEK_DAYS_SHORT.map((wd, i) => (
                <div
                  key={wd}
                  className={`py-0.5 rounded ${i === 6 ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarData.days.map((item, idx) => {
                const isSelected =
                  value &&
                  parsed.jy === item.jy &&
                  parsed.jm === item.jm &&
                  parsed.jd === item.jd;

                return (
                  <button
                    key={`${item.jy}-${item.jm}-${item.jd}-${idx}`}
                    type="button"
                    onClick={() => handleSelectDay(item.jy, item.jm, item.jd)}
                    className={`relative h-8 sm:h-9 rounded-xl text-xs font-semibold font-mono transition-all flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 font-bold scale-105 z-10 ring-2 ring-indigo-400'
                        : item.isCurrentMonth
                        ? item.isFriday
                          ? 'text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 bg-rose-50/60 dark:bg-rose-950/20'
                          : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white bg-slate-50/80 dark:bg-slate-800/40'
                        : 'text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    } ${item.isToday && !isSelected ? 'ring-2 ring-amber-500 dark:ring-amber-400 text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-400/15' : ''}`}
                  >
                    <span>{toPersianDigits(item.dayNumber)}</span>
                    {item.isToday && !isSelected && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-amber-500 dark:bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Time Picker Section (if hasTime is enabled) */}
            {hasTime && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>انتخاب زمان (ساعت و دقیقه)</span>
                  </span>
                  <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-500/40 text-[11px]">
                    {toPersianDigits(String(selectedHour).padStart(2, '0'))}:{toPersianDigits(String(selectedMinute).padStart(2, '0'))}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-medium">ساعت (۰ تا ۲۳)</label>
                    <select
                      value={selectedHour}
                      onChange={(e) => handleTimeChange(Number(e.target.value), selectedMinute)}
                      className="w-full text-xs px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                          {toPersianDigits(String(h).padStart(2, '0'))}:۰۰
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-medium">دقیقه</label>
                    <select
                      value={selectedMinute}
                      onChange={(e) => handleTimeChange(selectedHour, Number(e.target.value))}
                      className="w-full text-xs px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                        <option key={m} value={m} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                          {toPersianDigits(String(m).padStart(2, '0'))}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Times */}
                <div className="flex items-center justify-between gap-1 text-[10px] pt-1">
                  {['09:00', '12:00', '16:00', '18:00', '20:30'].map((qt) => {
                    const [qh, qm] = qt.split(':').map(Number);
                    return (
                      <button
                        key={qt}
                        type="button"
                        onClick={() => handleTimeChange(qh, qm)}
                        className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono transition-colors border border-slate-200 dark:border-slate-700/60"
                      >
                        {toPersianDigits(qt)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Action */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              {!isRequired && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                >
                  پاک کردن
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="me-auto text-xs px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md shadow-indigo-600/30"
              >
                تایید و ثبت
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {error && (
        <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1 font-medium text-end">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 text-end">
          {helperText}
        </p>
      )}
    </div>
  );
};
