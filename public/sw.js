// MMBA Service Worker — Production PWA & Web Push
// =================================================
// Scope: Controlled application shell caching, safe offline fallback,
//        Web Push event handling, notification click routing.
// Security: No business data cached. No secrets in service worker.
// Lifecycle: install → activate → fetch (controlled caching).
// =================================================

const CACHE_VERSION = 'mmba-v3';
const STATIC_CACHE = `mmba-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `mmba-runtime-${CACHE_VERSION}`;

// Static assets to cache on install (immutable, hashed by build)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/icon-96.png',
  '/icon-144.png',
  '/icon-384.png',
  '/icon-180.png',
  '/logo.svg',
];

// Routes that should NOT be cached (sensitive API, auth, etc.)
const BYPASS_CACHE_PATTERNS = [
  /\/api\/v1\/auth\//,
  /\/api\/v1\/notifications\/vapid-public-key/,
  /\/api\/v1\/notifications\/devices/,
  /\/api\/v1\/notifications\/settings/,
];

function isBypassed(url) {
  return BYPASS_CACHE_PATTERNS.some((p) => p.test(url));
}

// --------------------------------------------------
// INSTALL — Pre-cache application shell
// --------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Do NOT call skipWaiting() here. Let the user choose when to update.
      // The update prompt will be handled by the app.
    })
  );
});

// --------------------------------------------------
// ACTIVATE — Clean obsolete caches, claim clients
// --------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// --------------------------------------------------
// FETCH — Controlled caching strategy
// --------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass cache for sensitive API routes
  if (isBypassed(request.url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests: network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: cache-first
  // Vite dev modules (/src/, /@vite/, and ?v=-versioned deps) must NEVER be
  // cache-first: in development Vite serves fresh file contents at stable URLs,
  // so a cached copy goes stale the moment a file changes → stale-module import
  // mismatch → blank page. Network-only here (dev data, not business data).
  if (isViteDevAsset(url)) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API requests: network-only (no business data caching)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Default: network-first with cache fallback
  event.respondWith(networkFirst(request));
});

function isViteDevAsset(url) {
  return (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/node_modules/.vite/') ||
    url.search.includes('v=')
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.match(/\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|ico|webp|mp4|webm)$/i) ||
    STATIC_ASSETS.some((a) => url.pathname === a || url.pathname.startsWith(a + '?'))
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Return offline fallback for images
    if (request.destination === 'image') {
      return new Response('', { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Don't cache Vite dev internals — stale cache causes blank pages on reload
    const p = new URL(request.url).pathname;
    const isViteInternal = p.startsWith('/node_modules/') || p.includes('@vite') || p.includes('@react-refresh');
    if (response.ok && !isViteInternal) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // For navigation requests, return the cached index.html
    if (request.mode === 'navigate') {
      const cachedIndex = await caches.match('/index.html');
      if (cachedIndex) {
        return cachedIndex;
      }
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'OFFLINE', message: 'You are offline. This action has not been submitted.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// --------------------------------------------------
// PUSH — Handle incoming push notifications
// --------------------------------------------------
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'MMBA',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'MMBA | Business OS';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || `mmba-notif-${Date.now()}`,
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
      { action: 'dismiss', title: 'بستن' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// --------------------------------------------------
// NOTIFICATIONCLICK — Safe deep-link routing
// --------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  // Handle snooze action
  if (action === 'snooze' && data.notificationId) {
    event.waitUntil(
      fetch(`/api/v1/notifications/${data.notificationId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 15 }),
      }).catch(() => {})
    );
    return;
  }

  // Handle dismiss
  if (action === 'dismiss') {
    return;
  }

  // Validate and sanitize the target URL
  const targetUrl = sanitizeUrl(data.url || '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find an existing MMBA window and focus it
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          // Only focus windows that are on our origin
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.origin === self.location.origin) {
              client.navigate(targetUrl);
              return client.focus();
            }
          } catch {
            // Skip invalid URLs
          }
        }
      }
      // Open a new window if no existing MMBA window found
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// --------------------------------------------------
// MESSAGE — Handle messages from the app
// --------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_CACHE_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

// --------------------------------------------------
// UTILITIES
// --------------------------------------------------
function sanitizeUrl(url) {
  // Only allow trusted internal routes
  if (!url) return '/';
  try {
    const parsed = new URL(url, self.location.origin);
    // Only allow same-origin URLs
    if (parsed.origin !== self.location.origin) {
      return '/';
    }
    // Only allow safe paths (no protocol injection, no external links)
    const pathname = parsed.pathname;
    if (pathname.startsWith('/') && !pathname.includes('//') && !pathname.includes('javascript:')) {
      return pathname;
    }
    return '/';
  } catch {
    return '/';
  }
}
