import React, { useState, useEffect, useRef } from 'react';
import { logger, SystemLogEntry, LogLevel } from '../../services/logger';
import { storage } from '../../services/storage';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatPersianDate } from '../../lib/dateUtils';
import { useToast } from '../ui/Toast';
import {
  Terminal, Play, Pause, Trash2, Download, Search,
  Filter, ShieldAlert, CheckCircle2, Info, AlertTriangle, Bug,
  Activity, RefreshCw, Layers, Copy, Check
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

export const DebugLogViewer: React.FC = () => {
  const { success } = useToast();
  const { isRtl } = useTranslation();
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => logger.getLogs());
  const [isLive, setIsLive] = useState<boolean>(true);
  const [levelFilter, setLevelFilter] = useState<'ALL' | LogLevel>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to live logs
  useEffect(() => {
    const unsubscribe = logger.subscribe((newEntry) => {
      if (isLive) {
        setLogs((prev) => [newEntry, ...prev.slice(0, 499)]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isLive]);

  // Periodic poll if user pauses and unpauses
  const handleRefresh = () => {
    setLogs(logger.getLogs());
    success(isRtl ? 'لاگ‌ها به‌روزرسانی شدند' : 'Logs refreshed');
  };

  const handleClear = () => {
    logger.clearLogs();
    setLogs(logger.getLogs());
    success(isRtl ? 'تمامی لاگ‌های دیباگ پاکسازی شدند' : 'All debug logs cleared');
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mmba_debug_logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success(isRtl ? 'فایل لاگ‌ها با فرمت JSON دانلود شد' : 'Logs downloaded as JSON file');
  };

  const handleCopyLog = (log: SystemLogEntry) => {
    const text = `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}]: ${log.message} ${log.details ? JSON.stringify(log.details) : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
    if (sourceFilter !== 'ALL' && log.source !== sourceFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      log.message.toLowerCase().includes(q) ||
      log.source.toLowerCase().includes(q) ||
      (log.userName && log.userName.toLowerCase().includes(q)) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(q))
    );
  });

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-mono font-bold">
            <Bug className="w-3 h-3" />
            ERROR
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold">
            <AlertTriangle className="w-3 h-3" />
            WARN
          </span>
        );
      case 'debug':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-mono font-bold">
            <Activity className="w-3 h-3" />
            DEBUG
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-mono font-bold">
            <Info className="w-3 h-3" />
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 text-end animate-blur-fade-up">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{isRtl ? 'مانیتورینگ و دیباگ زنده لاگ‌های سیستم' : 'Live System Log Monitoring & Debug'}</h3>
            <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-400 dark:bg-slate-600'}`} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRtl ? 'مشاهده کنسول، فراخوانی‌های شبکه، تراکنش‌های ذخیره‌سازی و رویدادهای زنده سیستم MMBA' : 'View console, network calls, storage transactions and live MMBA system events'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Live / Normal Toggle */}
          <Button
            size="sm"
            variant={isLive ? 'primary' : 'outline'}
            onClick={() => setIsLive(!isLive)}
            leftIcon={isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            className={isLive ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-none' : ''}
          >
            {isLive ? (isRtl ? 'جریان زنده فعال (Live Mode)' : 'Live Mode Active') : (isRtl ? 'حالت عادی (Paused)' : 'Normal (Paused)')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'تازه‌سازی' : 'Refresh'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'خروجی JSON' : 'Export JSON'}
          </Button>

          <Button
            size="sm"
            variant="danger"
            onClick={handleClear}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'پاکسازی' : 'Clear All'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRtl ? 'جستجو در پیام، جزئیات، کاربر...' : 'Search message, details, user...'}
            rightIcon={<Search className="w-4 h-4" />}
          />

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{isRtl ? 'سطح خطا:' : 'Level:'}</span>
            {(['ALL', 'info', 'warn', 'error', 'debug'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={`text-xs px-2.5 py-1 rounded-lg font-mono transition-all ${
                  levelFilter === lvl
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {lvl.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{isRtl ? 'منبع:' : 'Source:'}</span>
            {['ALL', 'client', 'server', 'api', 'storage', 'security', 'user'].map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSourceFilter(src)}
                className={`text-xs px-2.5 py-1 rounded-lg font-mono transition-all ${
                  sourceFilter === src
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Terminal Display Screen */}
      <div className="rounded-2xl border border-slate-800 bg-[#080d1a] shadow-2xl overflow-hidden">
        {/* Terminal Header */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-xs text-slate-400 font-mono me-2">mmba-debug-engine.log</span>
          </div>

          <span className="text-xs font-mono text-slate-400">
            {isRtl ? `نمایش ${filteredLogs.length} از ${logs.length} رویداد` : `Showing ${filteredLogs.length} of ${logs.length} events`}
          </span>
        </div>

        {/* Terminal Body */}
        <div
          ref={scrollRef}
          className="p-3 sm:p-4 max-h-[500px] overflow-y-auto font-mono text-xs space-y-2.5 text-start"
          dir="ltr"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-sans" dir="rtl">
              <Terminal className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p>{isRtl ? 'هیچ لاگی منطبق بر این فیلترها وجود ندارد.' : 'No logs match these filters.'}</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-2.5 rounded-lg border transition-all relative group ${
                  log.level === 'error'
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60 text-rose-200'
                    : log.level === 'warn'
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60 text-amber-200'
                    : log.level === 'debug'
                    ? 'bg-purple-950/20 border-purple-500/30 hover:border-purple-500/60 text-purple-200'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-800/40">
                  <div className="flex items-center gap-2">
                    {getLevelBadge(log.level)}
                    <span className="text-[11px] text-slate-400">
                      [{new Date(log.timestamp).toLocaleTimeString('fa-IR')}]
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      src:{log.source}
                    </span>
                    {log.userName && (
                      <span className="text-[11px] text-indigo-300">
                        user:{log.userName}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyLog(log)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    title={isRtl ? 'کپی لاگ' : 'Copy log'}
                  >
                    {copiedId === log.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="pt-1.5 break-words whitespace-pre-wrap leading-relaxed select-text">
                  {log.message}
                </div>

                {log.details && (
                  <pre className="mt-1.5 p-2 rounded bg-black/50 border border-slate-800/80 text-[11px] text-slate-400 overflow-x-auto max-h-40">
                    {typeof log.details === 'object'
                      ? JSON.stringify(log.details, null, 2)
                      : String(log.details)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
