export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: 'client' | 'server' | 'api' | 'storage' | 'security' | 'user';
  message: string;
  details?: any;
  userId?: string;
  userName?: string;
}

type LogListener = (log: SystemLogEntry) => void;

class LoggerService {
  private logs: SystemLogEntry[] = [];
  private maxLogs: number = 500;
  private listeners: Set<LogListener> = new Set();
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
    debug: typeof console.debug;
  } | null = null;
  private isHooked = false;

  constructor() {
    this.hookConsole();
    this.addLog('info', 'سیستم لاگ مرکزی فعال شد', 'storage');
  }

  private hookConsole() {
    if (this.isHooked || typeof window === 'undefined') return;
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
    };

    console.log = (...args: any[]) => {
      this.originalConsole?.log(...args);
      this.capture('info', args, 'client');
    };

    console.warn = (...args: any[]) => {
      this.originalConsole?.warn(...args);
      this.capture('warn', args, 'client');
    };

    console.error = (...args: any[]) => {
      this.originalConsole?.error(...args);
      this.capture('error', args, 'client');
    };

    console.info = (...args: any[]) => {
      this.originalConsole?.info(...args);
      this.capture('info', args, 'client');
    };

    this.isHooked = true;
  }

  private capture(level: LogLevel, args: any[], source: SystemLogEntry['source']) {
    try {
      const message = args
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ');
      
      // Skip repetitive internal noise
      if (message.includes('react-dom') || message.includes('Storage listener')) return;

      this.addLog(level, message, source, args.length > 1 ? args : undefined);
    } catch {
      // ignore serialization errors
    }
  }

  public addLog(
    level: LogLevel,
    message: string,
    source: SystemLogEntry['source'] = 'client',
    details?: any,
    user?: { id?: string; name?: string }
  ): SystemLogEntry {
    const entry: SystemLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details,
      userId: user?.id,
      userName: user?.name,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (e) {
        // silent
      }
    });

    return entry;
  }

  public getLogs(): SystemLogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    this.addLog('info', 'لیست لاگ‌ها پاکسازی شد', 'storage');
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public info(message: string, source: SystemLogEntry['source'] = 'client', details?: any) {
    return this.addLog('info', message, source, details);
  }

  public warn(message: string, source: SystemLogEntry['source'] = 'client', details?: any) {
    return this.addLog('warn', message, source, details);
  }

  public error(message: string, source: SystemLogEntry['source'] = 'client', details?: any) {
    return this.addLog('error', message, source, details);
  }

  public debug(message: string, source: SystemLogEntry['source'] = 'client', details?: any) {
    return this.addLog('debug', message, source, details);
  }
}

export const logger = new LoggerService();
