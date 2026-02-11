// ًںڑ€ PROFESSIONAL SERVICEWORKER - 2025 Standards
// ==========================================
// Modern ServiceWorker implementation following best practices
// Progressive Web App (PWA) ready with offline support

// ًں“‹ Cache Management - Version Control
const CACHE_VERSION = 'v6.0.5';
const CACHE_PREFIX = 'salezone';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;

// ًںŒگ GitHub Pages Path Detection
const BASE_PATH = self.location.pathname.replace(/\/[^\/]*$/, '') || '/';
const NORMALIZED_BASE = BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;
const withBase = (assetPath) => `${NORMALIZED_BASE}${assetPath}`;
const OFFLINE_URL = withBase('/offline.html');
console.log(`ًںڑ€ ServiceWorker initialized - Version ${CACHE_VERSION}`);
console.log(`ًں“پ Base path: ${BASE_PATH}`);

// ًں“¦ Critical Assets to Cache (LCP Optimization)
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/ظ…طھط¬ط±_2.HTML',
  '/ط§ط¯ظ…ظ†_2.HTML',
  '/version.json',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/assets/placeholder.svg',
  '/assets/banner-placeholder.svg',
  '/cloudinary-service.js',
  '/ADMIN_ERROR_DASHBOARD.js',
  '/offline.html'
];

// ًںژ¨ Admin Assets (Separate Cache)
const ADMIN_ASSETS = [
  '/ط§ط¯ظ…ظ†_2.HTML'
];

// ًںژ¯ Modern Cache Strategies (2025 Standards)
const CacheStrategies = {
  // ًںڑ€ Cache First for Static Assets (Performance)
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
      console.warn(`âڑ ï¸ڈ CacheFirst failed for ${request.url}:`, error);
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  },

  // ًںŒگ Network First for Fresh Assets with timeout fallback
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
      console.warn(`âڑ ï¸ڈ NetworkFirst failed for ${request.url}:`, error);
      const cached = await caches.match(request);
      return cached || (await caches.match(OFFLINE_URL)) || Response.error();
    }
  },

  // ًں–¼ï¸ڈ Stale While Revalidate for Images (Performance + Freshness)
  staleWhileRevalidate: async (request, cacheName = IMAGE_CACHE) => {
    try {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(request);
      
      const networkPromise = fetch(request)
        .then(response => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);

      return cached || (await networkPromise) || (await caches.match(OFFLINE_URL)) || Response.error();
    } catch (error) {
      console.warn(`âڑ ï¸ڈ StaleWhileRevalidate failed for ${request.url}:`, error);
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  }
};

// ًں“± Install Event (PWA Installation)
self.addEventListener('install', (event) => {
  console.log('ًںڑ€ ServiceWorker installing...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(CRITICAL_ASSETS.map(asset => withBase(asset)));
      console.log('âœ… Critical assets cached');
      
      // Preload admin assets separately
      const adminCache = await caches.open(DYNAMIC_CACHE);
      await adminCache.addAll(ADMIN_ASSETS.map(asset => withBase(asset)));
      console.log('âœ… Admin assets cached');
      
      return self.skipWaiting();
    })()
  );
});

// ًں”„ Activate Event (Cache Cleanup)
self.addEventListener('activate', (event) => {
  console.log('ًں”„ ServiceWorker activating...');
  
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name.startsWith(CACHE_PREFIX) && !name.includes(CACHE_VERSION)
      );
      
      await Promise.all(oldCaches.map(name => {
        console.log(`ًں—‘ï¸ڈ Deleting old cache: ${name}`);
        return caches.delete(name);
      }));
      
      console.log('âœ… Cache cleanup completed');
      await self.clients.claim();

      // ًں”” Notify clients that a fresh SW is active (auto-refresh)
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach(client => {
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
      });
    })()
  );
});

// ًںŒگ Fetch Event (Smart Caching)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // ًںڑ« Skip non-GET requests and external resources
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }
  
  // ًں”¥ Skip Firebase requests (let them handle their own caching)
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    return;
  }
  
  // ًںژ¯ Smart Route Based on Request Type
  event.respondWith(
    (async () => {
      // ًں§  JavaScript should be fresh first to avoid stale logic on mobile
      if (url.pathname.match(/\.js$/)) {
        return CacheStrategies.networkFirst(request, STATIC_CACHE, 4000);
      }

      // ًں“¦ CSS/Fonts (fast cached + background refresh)
      if (url.pathname.match(/\.(css|woff|woff2|ttf|otf)$/)) {
        return CacheStrategies.staleWhileRevalidate(request, STATIC_CACHE);
      }
      
      // ًں–¼ï¸ڈ Images (Optimized for performance)
      if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
        return CacheStrategies.staleWhileRevalidate(request);
      }
      
      // ًں“„ HTML Pages (Fresh content)
      if (url.pathname.match(/\.html$/)) {
        return CacheStrategies.networkFirst(request, DYNAMIC_CACHE, 5000);
      }

      // ًں“„ JSON files (version/config)
      if (url.pathname.match(/\.json$/)) {
        return CacheStrategies.networkFirst(request, DYNAMIC_CACHE, 5000);
      }
      
      // ًںŒگ API Requests (Always fresh)
      if (url.pathname.includes('/api/')) {
        return CacheStrategies.networkFirst(request);
      }
      
      // ًں”„ Default: Network First with fallback
      return CacheStrategies.networkFirst(request);
    })()
  );
});

// ًں“¨ Message Event (Communication with Main App)
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      (async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('ًں—‘ï¸ڈ All caches cleared');
      })();
      break;
      
    default:
      console.log(`ًں“¨ Unknown message type: ${type}`);
  }
});

// ًں”„ Background Sync (Offline Support)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      (async () => {
        console.log('ًں”„ Background sync triggered');
        // Handle offline actions here
      })()
    );
  }
});

// ًں“± Push Notifications (PWA Feature)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };
  
  event.waitUntil(
    self.registration.showNotification('Sale Zone', options)
  );
});

console.log('ًںڑ€ Professional ServiceWorker ready - PWA Enabled');

