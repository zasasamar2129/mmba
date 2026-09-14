import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { UserNotificationDevice } from '../src/types';

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

class WebPushService {
  private vapidKeys: VapidKeys;
  private isConfigured = false;
  private keysFilePath: string;

  constructor() {
    this.keysFilePath = path.resolve(process.cwd(), './data/vapid_keys.json');
    this.vapidKeys = this.loadOrGenerateVapidKeys();
    this.init();
  }

  private loadOrGenerateVapidKeys(): VapidKeys {
    // 1. Check environment variables
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      return {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
      };
    }

    // 2. Check persistent file in data directory
    try {
      const dir = path.dirname(this.keysFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.keysFilePath)) {
        const raw = fs.readFileSync(this.keysFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.publicKey && parsed.privateKey) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[WebPush] Could not read existing VAPID keys file:', e);
    }

    // 3. Generate fresh pair and save
    try {
      const keys = webpush.generateVAPIDKeys();
      fs.writeFileSync(this.keysFilePath, JSON.stringify(keys, null, 2), 'utf-8');
      console.log('[WebPush] Generated and saved new VAPID keypair');
      return keys;
    } catch (e) {
      console.error('[WebPush] Error generating VAPID keys:', e);
      // Fallback
      return {
        publicKey: '',
        privateKey: '',
      };
    }
  }

  private init() {
    if (!this.vapidKeys.publicKey || !this.vapidKeys.privateKey) {
      console.warn('[WebPush] Missing VAPID keys, push delivery will be simulated.');
      return;
    }

    try {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@mmba.ir',
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey
      );
      this.isConfigured = true;
      console.log('[WebPush] RFC8291 Web Push Service configured successfully.');
    } catch (err) {
      console.error('[WebPush] Failed to set VAPID details:', err);
    }
  }

  public getPublicKey(): string {
    return this.vapidKeys.publicKey;
  }

  public async sendNotification(
    device: UserNotificationDevice,
    payload: {
      title: string;
      body: string;
      notificationId?: string;
      targetType?: string;
      targetId?: string;
      priority?: string;
      url?: string;
    }
  ): Promise<{ success: boolean; statusCode?: number; error?: string; expired?: boolean }> {
    if (!device.pushEndpoint || !device.pushP256dhKey || !device.pushAuthKey) {
      return { success: false, error: 'Device does not have complete push subscription parameters' };
    }

    if (!this.isConfigured) {
      return { success: false, error: 'Web Push is not fully configured on the server' };
    }

    const pushSubscription = {
      endpoint: device.pushEndpoint,
      keys: {
        p256dh: device.pushP256dhKey,
        auth: device.pushAuthKey,
      },
    };

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.notificationId || `mmba-${Date.now()}`,
      priority: payload.priority || 'NORMAL',
      data: {
        notificationId: payload.notificationId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        url: payload.url || '/',
        timestamp: new Date().toISOString(),
      },
    });

    try {
      const response = await webpush.sendNotification(pushSubscription, notificationPayload, {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: payload.priority === 'URGENT' || payload.priority === 'HIGH' ? 'high' : 'normal',
      });

      return {
        success: true,
        statusCode: response.statusCode,
      };
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      const isExpired = statusCode === 404 || statusCode === 410;

      console.warn(`[WebPush] Push failed for device ${device.id} (${device.deviceName}):`, {
        statusCode,
        message: err.message,
        isExpired,
      });

      return {
        success: false,
        statusCode,
        error: err.message || 'Push sending error',
        expired: isExpired,
      };
    }
  }
}

export const webPushService = new WebPushService();
