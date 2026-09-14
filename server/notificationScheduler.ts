import { centralDb } from './db';
import { webPushService } from './webPushService';
import {
  Notification,
  NotificationDelivery,
  DeliveryChannel,
  DeliveryStatus,
  UserNotificationDevice,
} from '../src/types';

class NotificationScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private notifiedTaskKeys = new Set<string>();
  private isProcessing = false;

  public start(intervalMs = 15000) {
    if (this.intervalId) return;
    console.log(`[NotificationScheduler] Starting background reminder scheduler (Interval: ${intervalMs}ms)...`);

    // Initial run
    this.checkReminders().catch((err) => console.error('[NotificationScheduler] Initial check error:', err));

    this.intervalId = setInterval(() => {
      this.checkReminders().catch((err) => console.error('[NotificationScheduler] Periodic check error:', err));
    }, intervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[NotificationScheduler] Stopped background reminder scheduler.');
    }
  }

  public async checkReminders() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const db = centralDb.getDatabase();
      const now = Date.now();

      // ----------------------------------------------------
      // 1. Task Reminders & Due Dates
      // ----------------------------------------------------
      const activeTasks = (db.tasks || []).filter(
        (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
      );

      for (const task of activeTasks) {
        const reminderTarget = task.reminderDate || task.dueDate;
        if (!reminderTarget) continue;

        const targetTime = new Date(reminderTarget).getTime();
        if (isNaN(targetTime) || targetTime > now) continue;

        const taskKey = `task-${task.id}-${reminderTarget}`;
        if (this.notifiedTaskKeys.has(taskKey)) continue;

        // Check if DB already has a reminder notification for this task to avoid duplicates across restarts
        const existingNotif = (db.notifications || []).find(
          (n) => n.relatedEntityType === 'TASK' && n.relatedEntityId === task.id
        );

        if (existingNotif) {
          this.notifiedTaskKeys.add(taskKey);
          continue;
        }

        this.notifiedTaskKeys.add(taskKey);

        const targetUserId = task.assignedUserId || task.creatorUserId || 'usr-admin';
        const notifTitle = `یادآور وظیفه: ${task.title}`;
        const notifBody = `موعد انجام این وظیفه فرا رسیده است.${
          task.customerName ? ` (مشتری: ${task.customerName})` : ''
        }`;

        const notif: Notification = {
          id: `notif-task-${task.id}-${Date.now()}`,
          userId: targetUserId,
          title: notifTitle,
          message: notifBody,
          body: notifBody,
          category: 'TASK',
          priority: String(task.priority || 'HIGH').toUpperCase(),
          read: false,
          relatedEntityType: 'TASK',
          relatedEntityId: task.id,
          relatedCustomerName: task.customerName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const savedNotif = await centralDb.saveNotification(notif);
        console.log(`[NotificationScheduler] Generated due reminder for task "${task.title}" (User: ${targetUserId})`);

        await this.dispatchToUser(targetUserId, savedNotif);
      }

      // ----------------------------------------------------
      // 2. Snoozed Notifications Expired
      // ----------------------------------------------------
      const notifications = db.notifications || [];
      for (const n of notifications) {
        if (!n.snoozedUntil) continue;
        const snoozeTime = new Date(n.snoozedUntil).getTime();
        if (!isNaN(snoozeTime) && snoozeTime <= now) {
          // Clear snooze and re-alert
          await centralDb.mutate((database) => {
            const idx = database.notifications.findIndex((item) => item.id === n.id);
            if (idx >= 0) {
              database.notifications[idx].snoozedUntil = undefined;
              database.notifications[idx].read = false;
              database.notifications[idx].updatedAt = new Date().toISOString();
            }
          });

          console.log(`[NotificationScheduler] Snooze expired for notification "${n.title}". Re-alerting user.`);
          const targetUserId = n.userId || 'usr-admin';
          await this.dispatchToUser(targetUserId, {
            ...n,
            title: `[یادآوری مجدد] ${n.title}`,
            snoozedUntil: undefined,
          });
        }
      }
    } catch (err) {
      console.error('[NotificationScheduler] Error during checkReminders:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  public async dispatchToUser(userId: string, notification: Notification) {
    const devices = centralDb.getUserDevices(userId).filter((d) => d.enabled);

    // 1. Record In-App delivery
    const inAppDelivery: NotificationDelivery = {
      id: `del-inapp-${notification.id}-${Date.now()}`,
      notificationId: notification.id,
      userId,
      channel: DeliveryChannel.IN_APP,
      status: DeliveryStatus.DELIVERED,
      deliveredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await centralDb.recordDelivery(inAppDelivery);

    if (devices.length === 0) {
      console.log(`[NotificationScheduler] No registered push devices found for user ${userId}. In-app notification ready.`);
      return;
    }

    // 2. Send RFC8291 Web Push to each registered active device
    for (const dev of devices) {
      const pushDelivery: NotificationDelivery = {
        id: `del-push-${dev.id}-${notification.id}-${Date.now()}`,
        notificationId: notification.id,
        userId,
        notificationDeviceId: dev.id,
        deviceName: dev.deviceName,
        channel: DeliveryChannel.WEB_PUSH,
        status: DeliveryStatus.QUEUED,
        createdAt: new Date().toISOString(),
      };
      await centralDb.recordDelivery(pushDelivery);

      const res = await webPushService.sendNotification(dev, {
        title: notification.title,
        body: notification.message || notification.body || '',
        notificationId: notification.id,
        targetType: notification.relatedEntityType,
        targetId: notification.relatedEntityId,
        priority: notification.priority,
        url: notification.relatedEntityType
          ? `/?module=${notification.relatedEntityType}&id=${notification.relatedEntityId || ''}`
          : '/',
      });

      if (res.success) {
        await centralDb.updateDelivery(pushDelivery.id, {
          status: DeliveryStatus.SENT,
          sentAt: new Date().toISOString(),
          deliveredAt: new Date().toISOString(),
        });
      } else {
        await centralDb.updateDelivery(pushDelivery.id, {
          status: DeliveryStatus.FAILED,
          failedAt: new Date().toISOString(),
          failureReason: res.error || 'Push send error',
        });

        // If subscription has expired or unsubscribed on browser side, disable device
        if (res.expired) {
          console.log(`[NotificationScheduler] Device ${dev.id} (${dev.deviceName}) subscription expired. Disabling device.`);
          await centralDb.updateDevice(dev.id, { enabled: false });
        }
      }
    }
  }

  public async sendTestNotification(
    userId: string,
    title = 'آزمایش اعلان هوشمند MMBA',
    body = 'این پیام تستی برای بررسی کارکرد صحیح اعلان‌های سیستمی و هشدار صوتی ارسال شده است.'
  ) {
    const testNotif: Notification = {
      id: `test-notif-${Date.now()}`,
      userId,
      title,
      message: body,
      body,
      category: 'SYSTEM',
      priority: 'HIGH',
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await centralDb.saveNotification(testNotif);
    await this.dispatchToUser(userId, saved);
    return saved;
  }
}

export const notificationScheduler = new NotificationScheduler();
