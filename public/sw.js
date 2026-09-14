// Service Worker for MMBA Web Push Notifications & Background Sync
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'سامانه MMBA',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'اعلان سامانه MMBA';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.tag || `mmba-notif-${Date.now()}`,
    vibrate: [200, 100, 200, 100, 200],
    renotify: true,
    requireInteraction: payload.priority === 'HIGH' || payload.priority === 'CRITICAL',
    data: {
      url: payload.url || '/',
      notificationId: payload.notificationId,
      targetType: payload.targetType,
      targetId: payload.targetId,
    },
    actions: [
      { action: 'open', title: 'مشاهده' },
      { action: 'snooze', title: 'یادآوری بعد (۱۵ دقیقه)' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === 'snooze' && data.notificationId) {
    event.waitUntil(
      fetch(`/api/v1/notifications/${data.notificationId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 15 }),
      }).catch((err) => console.error('[SW] Snooze fetch error:', err))
    );
    return;
  }

  const targetUrl = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
