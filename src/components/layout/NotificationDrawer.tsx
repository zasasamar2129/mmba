import React, { useState, useEffect } from 'react';
import { Drawer } from '../ui/Drawer';
import { Notification } from '../../types';
import { storage } from '../../services/storage';
import { pushService } from '../../services/pushService';
import {
  CheckCheck, Bell, CheckSquare, CreditCard, Wrench, Users,
  ShieldAlert, Clock, Volume2, Smartphone, Send, Moon, AlertTriangle
} from 'lucide-react';
import { getRelativeTimeFa } from '../../lib/dateUtils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';

export interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNavigate: (module: string, entityId?: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications = [],
  onNavigate,
}) => {
  const { success, error, info } = useToast();
  const { isRtl } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pushStatus, setPushStatus] = useState<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
    loading: boolean;
  }>({
    supported: false,
    permission: 'default',
    subscribed: false,
    loading: true,
  });

  const currentUser = storage.getCurrentUser();

  const checkStatus = async () => {
    const supported = pushService.isPushSupported();
    const permission = pushService.getPermissionState();
    let subscribed = false;
    if (supported && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          subscribed = !!sub;
        }
      } catch (e) {
        console.warn('Failed to inspect subscription:', e);
      }
    }
    setPushStatus({
      supported,
      permission,
      subscribed,
      loading: false,
    });
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  const handleEnablePush = async () => {
    setPushStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await pushService.subscribeUser(currentUser?.id || 'usr-admin');
      if (res.success) {
        success(isRtl ? 'اعلان‌های پوش مرورگر با موفقیت فعال شدند' : 'Browser push notifications enabled');
        pushService.playNotificationSound('bell');
      } else {
        error(res.error || (isRtl ? 'خطا در فعال‌سازی اعلان پوش' : 'Error enabling push notifications'));
      }
    } catch (err: any) {
      error(err.message || (isRtl ? 'خطا در برقراری ارتباط' : 'Connection error'));
    } finally {
      checkStatus();
    }
  };

  const handleTestPush = async () => {
    try {
      pushService.playNotificationSound('crystal');
      const res = await pushService.sendTestPush(
        currentUser?.id || 'usr-admin',
        isRtl ? 'تست اعلان CRM مدیران' : 'Admin CRM notification test',
        isRtl ? 'سیستم اعلان‌های سیستمی و پوش با موفقیت آزمایش شد.' : 'System and push notifications tested successfully.'
      );
      if (res.success) {
        success(isRtl ? 'اعلان آزمایشی ارسال شد' : 'Test notification sent');
      } else {
        info(isRtl ? 'بیپ تست پخش شد (ارسال پوش با پیغام: ' : 'Test beep played (push with message: ') + (res.error || (isRtl ? 'در صف' : 'queued')) + ')');
      }
    } catch (e: any) {
      info(isRtl ? 'سیگنال صوتی تست پخش شد' : 'Test audio signal played');
    }
  };

  const handleSnooze = (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    storage.snoozeNotification(notifId, 15);
    success(isRtl ? 'اعلان برای ۱۵ دقیقه به تعویق افتاد' : 'Notification snoozed for 15 minutes');
  };

  const unreadCount = (notifications || []).filter((n) => !n.read).length;

  const filteredNotifications = (notifications || []).filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const handleMarkAllAsRead = () => {
    storage.markAllNotificationsAsRead();
  };

  const handleItemClick = (notif: Notification) => {
    storage.markNotificationAsRead(notif.id);
    if (notif.relatedEntityType && notif.relatedEntityId) {
      const moduleMap: Record<string, string> = {
        TASK: 'TASKS',
        PAYMENT: 'PAYMENTS',
        CHECK: 'CHECKS',
        CUSTOMER: 'CUSTOMERS',
        REPAIR: 'REPAIRS',
        CONTRACT: 'CONTRACTS',
      };
      const mod = moduleMap[notif.relatedEntityType] || 'DASHBOARD';
      onNavigate(mod, notif.relatedEntityId);
      onClose();
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'TASK':
        return <CheckSquare className="w-4 h-4 text-emerald-400" />;
      case 'PAYMENT':
        return <CreditCard className="w-4 h-4 text-sky-400" />;
      case 'REPAIR':
        return <Wrench className="w-4 h-4 text-amber-400" />;
      case 'CUSTOMER':
        return <Users className="w-4 h-4 text-indigo-400" />;
      case 'APPROVAL':
        return <ShieldAlert className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-slate-900 dark:text-slate-100">{isRtl ? 'مرکز اعلان‌ها و هشدارها' : 'Notifications & Alerts Center'}</span>
          {unreadCount > 0 && (
            <Badge variant="danger" size="sm">
              {unreadCount} جدید
            </Badge>
          )}
        </div>
      }
      subtitle={isRtl ? 'رویدادها، سررسیدها و یادآورهای سیستمی' : 'Events, due dates and system reminders'}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            leftIcon={<CheckCheck className="w-4 h-4" />}
          >
            خوانده‌شدن همه
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            بستن
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Device Push Notification Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-slate-50 dark:from-indigo-950/30 dark:to-slate-900/60 border border-indigo-200/70 dark:border-indigo-800/40 text-end space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{isRtl ? 'اعلان‌های پوش دستگاه' : 'Device Push Notifications'}</span>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                pushStatus.subscribed
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
              }`}
            >
              {pushStatus.subscribed ? (isRtl ? 'فعال روی این مرورگر' : 'Active on this browser') : (isRtl ? 'غیرفعال' : 'Inactive')}
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            {pushStatus.subscribed
              ? (isRtl ? 'دستگاه شما آماده دریافت هشدارهای بلادرنگ سررسید وظایف، چک‌ها و تعمیرات است.' : 'Your device is ready for real-time alerts on task, check and repair due dates.')
              : pushStatus.permission === 'denied'
              ? (isRtl ? 'دسترسی اعلان در تنظیمات مرورگر مسدود شده است. برای فعال‌سازی، آن را از تنظیمات سایت متصرف کنید.' : 'Notification access is blocked in browser settings. Enable it from the site settings.')
              : pushStatus.permission === 'granted'
              ? (isRtl ? 'مجوز اعلان صادر شده است، اما هنوز اشتراک این دستگاه ثبت نشده.' : 'Permission granted, but this device is not subscribed yet.')
              : (isRtl ? 'برای دریافت هشدارهای صوتی و پیام‌های سررسید حتی در زمان بسته بودن تب مرورگر، این قابلیت را فعال کنید.' : 'Enable this to receive audio alerts and due-date messages even when the tab is closed.')}
          </p>

          <div className="flex items-center gap-2 pt-1">
            {!pushStatus.supported ? (
              <p className="w-full text-center text-[11px] text-amber-600 dark:text-amber-400">
                {isRtl ? 'مرورگر شما از اعلان‌های وب پشتیبانی نمی‌کند.' : 'Your browser does not support web notifications.'}
              </p>
            ) : !pushStatus.subscribed && pushStatus.permission === 'denied' ? (
              <p className="w-full text-center text-[11px] text-rose-600 dark:text-rose-400">
                {isRtl ? 'اعلان در تنظیمات مرورگر مسدود است.' : 'Notifications are blocked in browser settings.'}
              </p>
            ) : !pushStatus.subscribed ? (
              <Button
                variant="primary"
                size="sm"
                className="w-full text-xs"
                onClick={handleEnablePush}
                isLoading={pushStatus.loading}
                leftIcon={<Bell className="w-3.5 h-3.5" />}
              >
                فعال‌سازی اعلان‌های سیستمی
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleTestPush}
                leftIcon={<Send className="w-3.5 h-3.5 text-indigo-500" />}
              >
                ارسال اعلان آزمایشی و تست صدا
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              همه ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'unread'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              خوانده نشده ({unreadCount})
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{isRtl ? 'هیچ اعلانی در این بخش وجود ندارد' : 'No notifications in this section'}</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isSnoozed = notif.snoozedUntil && new Date(notif.snoozedUntil).getTime() > Date.now();
              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-end flex items-start gap-3 ${
                    notif.read
                      ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 opacity-85'
                      : 'bg-white dark:bg-slate-900/90 border-indigo-200 dark:border-indigo-500/30 text-slate-900 dark:text-slate-100 shadow-xs'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                    {getCategoryIcon(notif.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-semibold truncate text-slate-900 dark:text-slate-100">
                        {notif.title}
                      </h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSnoozed && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center gap-0.5"
                            title={isRtl ? 'به تعویق افتاده' : 'Snoozed'}
                          >
                            <Moon className="w-2.5 h-2.5" />
                            تعویق
                          </span>
                        )}
                        {!notif.read && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{notif.message}</p>
                    <div className="flex items-center justify-between gap-2 mt-2 pt-1 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800/40">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <span>{getRelativeTimeFa(notif.createdAt)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleSnooze(e, notif.id)}
                        className="text-[10px] text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
                        title={isRtl ? 'به تعویق انداختن برای ۱۵ دقیقه' : 'Snooze for 15 minutes'}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        تعویق ۱۵د
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Drawer>
  );
};
