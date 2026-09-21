import React, { useState, useEffect } from 'react';
import {
  Bell, Smartphone, Volume2, Clock, Shield, Check, AlertCircle,
  Play, RefreshCw, Trash2, Send, Laptop, Phone, Monitor, Info
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { pushService, SoundType } from '../../services/pushService';
import { storage } from '../../services/storage';
import { formatPersianDate } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';

interface UserDevice {
  id: string;
  userId: string;
  endpoint: string;
  userAgent?: string;
  deviceType?: string;
  deviceName?: string;
  platform?: string;
  isActive: boolean;
  lastActiveAt: string;
  createdAt: string;
}

interface NotificationDelivery {
  id: string;
  notificationId?: string;
  userId: string;
  deviceId?: string;
  title: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'EXPIRED';
  attemptCount: number;
  scheduledFor: string;
  sentAt?: string;
  error?: string;
  createdAt: string;
}

interface SettingsState {
  enabled: boolean;
  soundEnabled: boolean;
  soundType: SoundType;
  volume: number;
  snoozeDefaultMinutes: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export const NotificationSettingsManager: React.FC = () => {
  const { isRtl } = useTranslation();
  const { success, error, info } = useToast();
  const currentUser = storage.getCurrentUser();

  const pushSupported = pushService.isPushSupported();
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(() =>
    pushSupported ? pushService.getPermissionState() : 'unsupported'
  );

  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [testTitle, setTestTitle] = useState('یادآور وظایف و چک‌ها');
  const [testBody, setTestBody] = useState('این یک اعلان آزمایشی از سامانه مدیریت ارتباط با مشتری است.');
  const [settings, setSettings] = useState<SettingsState>({
    enabled: true,
    soundEnabled: true,
    soundType: 'crystal',
    volume: 0.8,
    snoozeDefaultMinutes: 15,
    quietHoursEnabled: false,
    quietHoursStart: '23:00',
    quietHoursEnd: '07:30',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Load settings
      const settingsRes = await fetch(`/api/v1/notifications/settings?userId=${currentUser.id}`);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data?.settings) {
          setSettings((prev) => ({
            ...prev,
            ...data.settings,
          }));
        }
      }

      // Load devices
      const devicesRes = await fetch(`/api/v1/notifications/devices?userId=${currentUser.id}`);
      if (devicesRes.ok) {
        const data = await devicesRes.json();
        setDevices(data.devices || []);
      }

      // Load deliveries
      const deliveriesRes = await fetch(`/api/v1/notifications/deliveries?userId=${currentUser.id}`);
      if (deliveriesRes.ok) {
        const data = await deliveriesRes.json();
        setDeliveries(data.deliveries || []);
      }
    } catch (err) {
      console.warn('Failed to load notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePlaySound = (type: SoundType) => {
    pushService.playNotificationSound(type);
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/v1/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          ...settings,
        }),
      });
      if (res.ok) {
        success(isRtl ? 'تنظیمات اعلان با موفقیت ذخیره شد' : 'Notification settings saved');
      } else {
        error(isRtl ? 'خطا در ذخیره‌سازی تنظیمات' : 'Failed to save settings');
      }
    } catch (e: any) {
      error(e.message || (isRtl ? 'خطا در ارتباط با سرور' : 'Server connection error'));
    }
  };

  const handleRegisterCurrentDevice = async () => {
    setLoading(true);
    try {
      const res = await pushService.subscribeUser(currentUser.id, currentUser.name);
      if (res.success) {
        success(isRtl ? 'این مرورگر با موفقیت ثبت شد' : 'Current device registered successfully');
        pushService.playNotificationSound(settings.soundType);
        await loadData();
      } else {
        error(res.error || (isRtl ? 'خطا در ثبت دستگاه' : 'Failed to register device'));
      }
    } catch (e: any) {
      error(e.message || (isRtl ? 'خطا در ثبت' : 'Save error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnregisterDevice = async (deviceId: string) => {
    try {
      const res = await fetch(`/api/v1/notifications/devices/${deviceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        success(isRtl ? 'دستگاه با موفقیت حذف شد' : 'Device deleted');
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      }
    } catch (e: any) {
      error(e.message || (isRtl ? 'خطا در حذف دستگاه' : 'Error removing device'));
    }
  };

  const handleSendTestPush = async () => {
    handlePlaySound(settings.soundType);
    try {
      const res = await pushService.sendTestPush(currentUser.id, testTitle, testBody);
      if (res.success) {
        success(isRtl ? 'اعلان پوش آزمایشی ارسال شد' : 'Test push sent');
      } else {
        info(isRtl ? 'سیگنال صوتی پخش شد. پوش سرور: ' + (res.error || 'ارسال شد') : 'Sound played. Push: ' + res.error);
      }
      setTimeout(loadData, 1000);
    } catch (e: any) {
      info(isRtl ? 'صدا پخش شد' : 'Sound played');
    }
  };

  const getDeviceIcon = (dev: UserDevice) => {
    const ua = (dev.userAgent || '').toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Phone className="w-4 h-4 text-indigo-500" />;
    }
    if (ua.includes('macintosh') || ua.includes('windows') || ua.includes('linux')) {
      return <Laptop className="w-4 h-4 text-emerald-500" />;
    }
    return <Monitor className="w-4 h-4 text-sky-500" />;
  };

  const handleUnsubscribeAll = async () => {
    setLoading(true);
    try {
      const res = await pushService.unsubscribeDevice();
      if (res.success) {
        success(isRtl ? 'این دستگاه از اعلان‌های پوش خارج شد' : 'Device unsubscribed from push');
        await loadData();
      } else {
        error(res.error || (isRtl ? 'خطا در لغو اشتراک' : 'Failed to unsubscribe'));
      }
    } catch (e: any) {
      error(e.message || (isRtl ? 'خطا در لغو اشتراک' : 'Error unsubscribing'));
    } finally {
      setLoading(false);
    }
  };

  const getDeviceLabel = (dev: UserDevice): string => {
    const ua = (dev.userAgent || '').toLowerCase();
    const name = dev.deviceName || '';
    // Friendly labels — do not expose raw user-agent strings as primary UX (§96)
    if (name && name !== (isRtl ? 'مرورگر وب' : 'Web Browser')) return name;
    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('ipad')) return 'iPad';
    if (ua.includes('android')) {
      return ua.includes('mobile') || ua.includes('mobi') ? 'Android phone' : 'Android tablet';
    }
    if (ua.includes('windows')) return 'Chrome on Windows';
    if (ua.includes('macintosh')) return 'Safari on Mac';
    return name || (isRtl ? 'دستگاه مرورگر وب' : 'Web Browser Device');
  };

  return (
    <div className="space-y-6 text-end animate-blur-fade-up">
      {/* Top Banner / Device Status */}
      <div className="p-5 rounded-2xl liquid-glass-card border border-indigo-200 dark:border-indigo-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{isRtl ? 'مرکز مدیریت اعلان‌های پوش و هشدارهای سیستمی' : 'Push Notifications & Alerts Hub'}</span>
              <Badge variant="indigo" size="sm">
                Web Push VAPID
              </Badge>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {isRtl
                ? 'ارسال هشدارهای آنی سررسید وظایف، چک‌ها، تعویق یادآورها و تغییرات مالی به مرورگر و گوشی‌های هوشمند کاربران با پشتیبانی کامل از Service Worker و صدای اختصاصی.'
                : 'Real-time task reminders, check maturities, snooze handling, and push notifications via Service Worker.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={loading}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            {isRtl ? 'بروزرسانی وضعیت' : 'Refresh'}
          </Button>
          {pushSupported ? (
            permissionState === 'denied' ? (
              <span className="text-xs text-rose-600 dark:text-rose-400 shrink-0">
                {isRtl ? 'دسترسی اعلان در تنظیمات مرورگر مسدود است' : 'Notification permission denied in browser'}
              </span>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRegisterCurrentDevice}
                leftIcon={<Smartphone className="w-4 h-4" />}
              >
                {isRtl ? 'ثبت این مرورگر برای دریافت پوش' : 'Register Current Device'}
              </Button>
            )
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">
              {isRtl ? 'مرورگر شما از اعلان‌های وب پشتیبانی نمی‌کند' : 'Web Push not supported by this browser'}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chime & Sound Settings */}
        <div className="p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-500" />
              <span>{isRtl ? 'تنظیمات صدا و زنگ اعلان' : 'Sound & Chime Settings'}</span>
            </h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {isRtl ? 'پخش صدا هنگام اعلان' : 'Enable Sound'}
              </span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isRtl ? 'انتخاب ملودی و صدای اعلان:' : 'Select Alert Chime:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'crystal', label: isRtl ? 'کریستال (ملایم)' : 'Crystal' },
                { id: 'bell', label: isRtl ? 'زنگ کلاسیک' : 'Classic Bell' },
                { id: 'subtle', label: isRtl ? 'مینیمال' : 'Subtle' },
                { id: 'urgent', label: isRtl ? 'هشدار فوری' : 'Urgent' },
              ].map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSettings({ ...settings, soundType: c.id as SoundType })}
                  className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all flex flex-col items-center justify-between gap-2 ${
                    settings.soundType === c.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span className="text-xs">{c.label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaySound(c.id as SoundType);
                    }}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 shadow-2xs"
                    title={isRtl ? 'پخش نمونه صدا' : 'Play preview'}
                  >
                    <Play className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Volume slider */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                <span>{isRtl ? 'بلندی صدا' : 'Volume'}</span>
                <span className="font-mono">{Math.round(settings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.volume}
                onChange={(e) => setSettings({ ...settings, volume: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Default Snooze Minutes */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? 'مدت زمان پیش‌فرض به تعویق انداختن (Snooze):' : 'Default Snooze Duration:'}
              </label>
              <select
                value={settings.snoozeDefaultMinutes}
                onChange={(e) => setSettings({ ...settings, snoozeDefaultMinutes: parseInt(e.target.value) })}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value={5}>{isRtl ? '۵ دقیقه' : '5 minutes'}</option>
                <option value={10}>{isRtl ? '۱۰ دقیقه' : '10 minutes'}</option>
                <option value={15}>{isRtl ? '۱۵ دقیقه (پیش‌فرض سیستم)' : '15 minutes (system default)'}</option>
                <option value={30}>{isRtl ? '۳۰ دقیقه' : '30 minutes'}</option>
                <option value={60}>{isRtl ? '۱ ساعت' : '1 hour'}</option>
                <option value={1440}>{isRtl ? '۲۴ ساعت (یک روز)' : '24 hours (1 day)'}</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button variant="primary" size="sm" onClick={handleSaveSettings}>
                {isRtl ? 'ذخیره تنظیمات صدا' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>

        {/* Test Push Sender */}
        <div className="p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-500" />
              <span>{isRtl ? 'تست ارسال اعلان آزمایشی' : 'Send Test Notification'}</span>
            </h4>
            <Badge variant="success" size="sm">
              Live Testing
            </Badge>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'عنوان پیام آزمایشی' : 'Title'}
              </label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'متن اعلان' : 'Body'}
              </label>
              <textarea
                rows={2}
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                {isRtl
                  ? 'این اعلان هم از طریق پخش صدا در مرورگر و هم از طریق پروتکل پوش به کلیه دستگاه‌های متصل کاربر ارسال خواهد شد.'
                  : 'This alert will play Web Audio and dispatch to all registered devices via Web Push.'}
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendTestPush}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                {isRtl ? 'ارسال اعلان آزمایشی' : 'Send Test Push'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Registered Devices List */}
      <div className="p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-indigo-500" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {isRtl ? 'دستگاه‌های ثبت شده برای اعلان پوش' : 'Registered Push Devices'}
            </h4>
            <Badge variant="indigo" size="sm">
              {devices.length} دستگاه
            </Badge>
          </div>
          <span className="text-xs text-slate-500">
            {isRtl ? 'کاربر جاری:' : 'User:'} {currentUser.name}
          </span>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-8 text-slate-500 space-y-2">
            <Smartphone className="w-8 h-8 mx-auto text-slate-400 opacity-40" />
            <p className="text-xs">{isRtl ? 'هنوز دستگاهی برای این کاربر ثبت نشده است.' : 'No devices registered yet.'}</p>
            <Button variant="outline" size="sm" onClick={handleRegisterCurrentDevice}>
              {isRtl ? 'ثبت همین دستگاه اکنون' : 'Register this device now'}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {devices.map((dev) => (
              <div key={dev.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                    {getDeviceIcon(dev)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {getDeviceLabel(dev)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                        {dev.platform || 'Web'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block truncate max-w-md">
                      {dev.browser && !dev.browser.toLowerCase().includes('unknown')
                        ? `${dev.browser} · ${formatPersianDate(dev.lastActiveAt, true)}`
                        : formatPersianDate(dev.lastActiveAt, true)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUnregisterDevice(dev.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={isRtl ? 'حذف دستگاه' : 'Delete device'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {devices.length > 0 && pushSupported && (
          <div className="pt-2 flex justify-end border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnsubscribeAll}
              isLoading={loading}
              leftIcon={<Smartphone className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'حذف این دستگاه از اعلان‌های پوش' : 'Remove this device from push'}
            </Button>
          </div>
        )}
      </div>

      {/* Recent Deliveries Log */}
      {deliveries.length > 0 && (
        <div className="p-5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isRtl ? 'آخرین گزارش‌های ارسال اعلان پوش به دستگاه‌ها' : 'Recent Push Deliveries'}
            </h4>
            <span className="text-[11px] text-slate-400">{deliveries.length} {isRtl ? 'مورد' : 'items'}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {deliveries.slice(0, 10).map((d) => (
              <div
                key={d.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      d.status === 'SENT' ? 'bg-emerald-500' : d.status === 'FAILED' ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{d.title}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>{d.sentAt ? formatPersianDate(d.sentAt, true) : (isRtl ? 'در صف ارسال' : 'In send queue')}</span>
                  <Badge variant={d.status === 'SENT' ? 'success' : d.status === 'FAILED' ? 'danger' : 'warning'} size="sm">
                    {d.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
