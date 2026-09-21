import React from 'react';
import { LayoutGrid, List, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { Button } from './Button';
import { useTranslation } from '../../lib/i18n';

export type ViewMode = 'card' | 'list';

export interface ListViewControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  showViewToggle?: boolean;
}

export function usePersistentViewMode(key: string, defaultMode: ViewMode = 'list'): [ViewMode, (mode: ViewMode) => void] {
  const storageKey = `mmba_view_pref_${key}`;
  const [mode, setMode] = React.useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'card' || saved === 'list') return saved;
    } catch {}
    return defaultMode;
  });

  const updateMode = (newMode: ViewMode) => {
    setMode(newMode);
    try {
      localStorage.setItem(storageKey, newMode);
    } catch {}
  };

  return [mode, updateMode];
}

export const ListViewControls: React.FC<ListViewControlsProps> = ({
  viewMode,
  onViewModeChange,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
  showViewToggle = true,
}) => {
  const { isRtl } = useTranslation();
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs ${className}`}>
      {/* Left: View Mode Toggle & Total Count */}
      <div className="flex items-center gap-3">
        {showViewToggle && (
          <div className="flex items-center bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title={isRtl ? 'نمای جدولی و ردیفی (List / Table View)' : 'List / Table View'}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRtl ? 'نمای ردیفی' : 'Row view'}</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('card')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'card'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title={isRtl ? 'نمای کارتی (Card View)' : 'Card View'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRtl ? 'نمای کارتی' : 'Card view'}</span>
            </button>
          </div>
        )}

        <div className="text-slate-500 dark:text-slate-400 text-xs">
          {isRtl ? 'نمایش' : 'Showing'} <span className="font-bold text-slate-800 dark:text-slate-200">{startItem}</span> {isRtl ? 'تا' : 'to'}{' '}
          <span className="font-bold text-slate-800 dark:text-slate-200">{endItem}</span> {isRtl ? 'از' : 'of'}{' '}
          <span className="font-bold text-slate-800 dark:text-slate-200">{totalItems}</span> {isRtl ? 'رکورد' : 'records'}
        </div>
      </div>

      {/* Right: Page Size & Pagination Buttons */}
      <div className="flex items-center gap-2.5">
        {/* Page Size Select */}
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="hidden md:inline">{isRtl ? 'تعداد در صفحه:' : 'Per page:'}</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="h-8 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} {isRtl ? 'رکورد' : 'records'}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none"
            title={isRtl ? 'صفحه اول' : 'First page'}
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none"
            title={isRtl ? 'صفحه قبل' : 'Previous page'}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {currentPage} {isRtl ? 'از' : 'of'} {Math.max(1, totalPages)}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none"
            title={isRtl ? 'صفحه بعد' : 'Next page'}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none"
            title={isRtl ? 'صفحه آخر' : 'Last page'}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
