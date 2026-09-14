import { UserNotificationDevice, NotificationSettings } from '../types';

export type SoundType = 'crystal' | 'bell' | 'subtle' | 'urgent';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function detectDeviceInfo(): {
  deviceName: string;
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';
  browser: string;
  platform: string;
} {
  const ua = navigator.userAgent;
  let deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' = 'DESKTOP';
  if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'TABLET';
  } else if (/Mobi|Android|iPhone/i.test(ua)) {
    deviceType = 'MOBILE';
  }

  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let platform = 'Other';
  const navAny = navigator as any;
  if (navAny.userAgentData?.platform) {
    platform = navAny.userAgentData.platform;
  } else if (navigator.platform) {
    platform = navigator.platform;
  }

  const deviceName = `${browser} on ${platform} (${deviceType.toLowerCase()})`;
  return { deviceName, deviceType, browser, platform };
}

// Web Audio API Chimes (Pure synthesis, no external audio assets needed)
let audioCtx: AudioContext | null = null;

export function playNotificationSound(sound: SoundType = 'crystal', volume = 80) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const masterGain = audioCtx.createGain();
    masterGain.gain.value = Math.max(0, Math.min(1, volume / 100));
    masterGain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (sound === 'crystal') {
      // Elegant crystal chord (E5, G#5, B5)
      const freqs = [659.25, 830.61, 987.77, 1318.51];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx!.createOscillator();
        const gain = audioCtx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.2, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.6);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.65);
      });
    } else if (sound === 'bell') {
      // Soft metallic bell
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc2.frequency.setValueAtTime(1760, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(masterGain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.85);
      osc2.stop(now + 0.85);
    } else if (sound === 'urgent') {
      // Dual high-attention ping
      [0, 0.15].forEach((offset) => {
        const osc = audioCtx!.createOscillator();
        const gain = audioCtx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1174.66, now + offset); // D6
        gain.gain.setValueAtTime(0.35, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.25);
      });
    } else {
      // Subtle short pip
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (err) {
    console.warn('[PushService] Sound playback error:', err);
  }
}

class PushService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private currentDevice: UserNotificationDevice | null = null;

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  public isPushSupported(): boolean {
    return this.isSupported();
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  public getPermissionState(): NotificationPermission {
    return this.getPermissionStatus();
  }

  public playNotificationSound(sound: SoundType = 'crystal', volume = 80) {
    playNotificationSound(sound, volume);
  }

  public async initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) return null;
    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return this.swRegistration;
    } catch (err) {
      console.error('[PushService] Failed to register service worker:', err);
      return null;
    }
  }

  public async fetchVapidPublicKey(): Promise<string | null> {
    try {
      const res = await fetch('/api/v1/notifications/vapid-public-key');
      const data = await res.json();
      return data.publicKey || null;
    } catch (err) {
      console.error('[PushService] Failed to fetch VAPID key:', err);
      return null;
    }
  }

  public async subscribeUser(
    userId: string,
    userName?: string
  ): Promise<{ success: boolean; device?: UserNotificationDevice; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'مرورگر شما از اعلان‌های وب (Web Push) پشتیبانی نمی‌کند.' };
    }

    try {
      const reg = this.swRegistration || (await this.initServiceWorker());
      if (!reg) {
        return { success: false, error: 'راه‌اندازی سرویس‌ورکر ناموفق بود.' };
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'مجوز ارسال اعلان توسط کاربر صادر نشد.' };
      }

      const publicKey = await this.fetchVapidPublicKey();
      if (!publicKey) {
        return { success: false, error: 'دریافت کلید عمومی سرور با خطا مواجه شد.' };
      }

      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const subJson = subscription.toJSON();
      const info = detectDeviceInfo();

      const devicePayload: Partial<UserNotificationDevice> = {
        userId,
        userName: userName || 'کاربر سیستم',
        deviceName: info.deviceName,
        deviceType: info.deviceType,
        browser: info.browser,
        platform: info.platform,
        userAgent: navigator.userAgent,
        pushEndpoint: subscription.endpoint,
        pushP256dhKey: subJson.keys?.p256dh,
        pushAuthKey: subJson.keys?.auth,
        pushP256dh: subJson.keys?.p256dh,
        pushAuth: subJson.keys?.auth,
        enabled: true,
      };

      const res = await fetch('/api/v1/notifications/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(devicePayload),
      });

      const data = await res.json();
      if (data.success && data.device) {
        this.currentDevice = data.device;
        return { success: true, device: data.device };
      }
      return { success: false, error: data.message || 'خطا در ثبت دستگاه در سامانه' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در ثبت دستگاه' };
    }
  }

  public async getRegisteredDevices(userId?: string): Promise<UserNotificationDevice[]> {
    try {
      const url = userId ? `/api/v1/notifications/devices?userId=${encodeURIComponent(userId)}` : '/api/v1/notifications/devices';
      const res = await fetch(url);
      const data = await res.json();
      return data.devices || [];
    } catch (err) {
      console.error('[PushService] getRegisteredDevices error:', err);
      return [];
    }
  }

  public async toggleDevice(deviceId: string, enabled: boolean): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/notifications/devices/${deviceId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      return !!data.success;
    } catch (err) {
      console.error('[PushService] toggleDevice error:', err);
      return false;
    }
  }

  public async deleteDevice(deviceId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/notifications/devices/${deviceId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      return !!data.success;
    } catch (err) {
      console.error('[PushService] deleteDevice error:', err);
      return false;
    }
  }

  public async sendTestPush(
    userId?: string,
    title?: string,
    body?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/v1/notifications/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, body }),
      });
      const data = await res.json();
      return { success: !!data.success, error: data.error };
    } catch (err: any) {
      console.error('[PushService] sendTestPush error:', err);
      return { success: false, error: err.message };
    }
  }

  public async snooze(notificationId: string, minutes = 15): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/notifications/${notificationId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
      const data = await res.json();
      return !!data.success;
    } catch (err) {
      console.error('[PushService] snooze error:', err);
      return false;
    }
  }

  public async getSettings(): Promise<NotificationSettings> {
    try {
      const res = await fetch('/api/v1/notifications/settings');
      const data = await res.json();
      return (
        data.settings || {
          enableNotifications: true,
          enableSound: true,
          soundVolume: 80,
          soundChime: 'crystal',
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:30',
          defaultSnoozeMinutes: 15,
        }
      );
    } catch (err) {
      return {
        enableNotifications: true,
        enableSound: true,
        soundVolume: 80,
        soundChime: 'crystal',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:30',
        defaultSnoozeMinutes: 15,
      };
    }
  }

  public async saveSettings(settings: Partial<NotificationSettings>): Promise<boolean> {
    try {
      const res = await fetch('/api/v1/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      return !!data.success;
    } catch (err) {
      return false;
    }
  }
}

export const pushService = new PushService();
