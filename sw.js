// PROFESSIONAL SERVICE WORKER - 2025 standards
// Progressive Web App (PWA) with offline-first safeguards

const CACHE_VERSION = 'v6.2.3';
const CACHE_PREFIX = 'salezone';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;

const BASE_PATH = self.location.pathname.replace(/\/[^\/]*$/, '') || '/';
const NORMALIZED_BASE = BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;
const withBase = (assetPath) => `${NORMALIZED_BASE}${assetPath}`;
const OFFLINE_URL = withBase('/offline.html');

console.log(`[SW] initialized - version ${CACHE_VERSION}`);
console.log(`[SW] base path: ${BASE_PATH}`);

const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/متجر_2.HTML',
  '/ادمن_2.HTML',
  '/version.json',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/assets/placeholder.svg',
  '/assets/banner-placeholder.svg',
  '/cloudinary-service.js',
  '/product-search-worker.js',
  '/ADMIN_ERROR_DASHBOARD.js',
  '/offline.html'
];

const ADMIN_ASSETS = [
  '/ادمن_2.HTML'
];

const CacheStrategies = {
  cacheFirst: async (request) => {
    try {
      const cached = await caches.match(request);
      if (cached) return cached;

      const network = await fetch(request);
      if (network.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, network.clone());
      }
      return network;
    } catch (error) {
      console.warn(`[WARN] cacheFirst failed for ${request.url}:`, error);
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  },

  networkFirst: async (request, cacheName = DYNAMIC_CACHE, timeoutMs = 5000) => {
    try {
      const cache = await caches.open(cacheName);

      const networkPromise = fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      });

      const raceResponse = await Promise.race([networkPromise, timeoutPromise]);
      if (raceResponse) return raceResponse;

      const cached = await cache.match(request);
      if (cached) return cached;

      const finalNetwork = await networkPromise;
      if (finalNetwork) return finalNetwork;

      return (await caches.match(OFFLINE_URL)) || Response.error();
    } catch (error) {
      console.warn(`[WARN] networkFirst failed for ${request.url}:`, error);
      const cached = await caches.match(request);
      return cached || (await caches.match(OFFLINE_URL)) || Response.error();
    }
  },

  staleWhileRevalidate: async (request, cacheName = IMAGE_CACHE) => {
    try {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(request);

      const networkPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);

      return cached || (await networkPromise) || (await caches.match(OFFLINE_URL)) || Response.error();
    } catch (error) {
      console.warn(`[WARN] staleWhileRevalidate failed for ${request.url}:`, error);
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  }
};

self.addEventListener('install', (event) => {
  console.log('[SW] installing...');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(CRITICAL_ASSETS.map((asset) => withBase(asset)));
      console.log('[SW] critical assets cached');

      const adminCache = await caches.open(DYNAMIC_CACHE);
      await adminCache.addAll(ADMIN_ASSETS.map((asset) => withBase(asset)));
      console.log('[SW] admin assets cached');

      return self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activating...');

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter((name) =>
        name.startsWith(CACHE_PREFIX) && !name.includes(CACHE_VERSION)
      );

      await Promise.all(oldCaches.map((name) => {
        console.log(`[SW] deleting old cache: ${name}`);
        return caches.delete(name);
      }));

      console.log('[SW] cache cleanup completed');
      await self.clients.claim();

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
      });
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Never intercept runtime version checks to avoid stale/invalid SW responses.
  if (/\/version\.json$/i.test(url.pathname)) {
    return;
  }

  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    return;
  }

  event.respondWith(
    (async () => {
      if (url.pathname.match(/\.js$/)) {
        return CacheStrategies.networkFirst(request, STATIC_CACHE, 4000);
      }

      if (url.pathname.match(/\.(css|woff|woff2|ttf|otf)$/)) {
        return CacheStrategies.staleWhileRevalidate(request, STATIC_CACHE);
      }

      if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
        return CacheStrategies.staleWhileRevalidate(request);
      }

      if (url.pathname.match(/\.html$/i)) {
        return CacheStrategies.networkFirst(request, DYNAMIC_CACHE, 5000);
      }

      if (url.pathname.match(/\.json$/)) {
        return CacheStrategies.networkFirst(request, DYNAMIC_CACHE, 5000);
      }

      if (url.pathname.includes('/api/')) {
        return CacheStrategies.networkFirst(request);
      }

      return CacheStrategies.networkFirst(request);
    })()
  );
});

self.addEventListener('message', (event) => {
  const payload = event.data || {};
  const { type } = payload;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ version: CACHE_VERSION });
      }
      break;

    case 'CLEAR_CACHE':
      (async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        console.log('[SW] all caches cleared');
      })();
      break;

    default:
      if (typeof type !== 'undefined' && type !== null && String(type).trim()) {
        console.log(`[SW] unknown message type: ${type}`);
      }
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      (async () => {
        console.log('[SW] background sync triggered');
      })()
    );
  }
});

self.addEventListener('push', (event) => {
  const body = (event.data && event.data.text && event.data.text()) || 'New update available';
  const options = {
    body,
    icon: withBase('/icon-192.png'),
    badge: withBase('/icon-192.png'),
    vibrate: [200, 100, 200],
    data: { url: withBase('/') }
  };

  event.waitUntil(
    self.registration.showNotification('Sale Zone', options)
  );
});

console.log('[SW] ready - PWA enabled');
