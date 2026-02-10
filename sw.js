// 🚀 PROFESSIONAL SERVICEWORKER - 2025 Standards
// ==========================================
// Modern ServiceWorker implementation following best practices
// Progressive Web App (PWA) ready with offline support

// 📋 Cache Management - Version Control
const CACHE_VERSION = 'v6.0.2';
const CACHE_PREFIX = 'salezone';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;

// 🌐 GitHub Pages Path Detection
const BASE_PATH = self.location.pathname.replace(/\/[^\/]*$/, '') || '/';
const NORMALIZED_BASE = BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;
const withBase = (assetPath) => `${NORMALIZED_BASE}${assetPath}`;
const OFFLINE_URL = withBase('/offline.html');
console.log(`🚀 ServiceWorker initialized - Version ${CACHE_VERSION}`);
console.log(`📁 Base path: ${BASE_PATH}`);

// 📦 Critical Assets to Cache (LCP Optimization)
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/متجر_2.HTML',
  '/ادمن_2.HTML',
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

// 🎨 Admin Assets (Separate Cache)
const ADMIN_ASSETS = [
  '/ادمن_2.HTML'
];

// 🎯 Modern Cache Strategies (2025 Standards)
const CacheStrategies = {
  // 🚀 Cache First for Static Assets (Performance)
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
      console.warn(`⚠️ CacheFirst failed for ${request.url}:`, error);
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  },

  // 🌐 Network First for Dynamic Content (Freshness)
  networkFirst: async (request) => {
    try {
      const network = await fetch(request);
      if (network.ok) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, network.clone());
      }
      return network;
    } catch (error) {
      console.warn(`⚠️ NetworkFirst failed for ${request.url}:`, error);
      const cached = await caches.match(request);
      return cached || (await caches.match(OFFLINE_URL)) || Response.error();
    }
  },

  // 🖼️ Stale While Revalidate for Images (Performance + Freshness)
  staleWhileRevalidate: async (request) => {
    try {
      const cache = await caches.open(IMAGE_CACHE);
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
      console.warn(`⚠️ StaleWhileRevalidate failed for ${request.url}:`, error);
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  }
};

// 📱 Install Event (PWA Installation)
self.addEventListener('install', (event) => {
  console.log('🚀 ServiceWorker installing...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(CRITICAL_ASSETS.map(asset => withBase(asset)));
      console.log('✅ Critical assets cached');
      
      // Preload admin assets separately
      const adminCache = await caches.open(DYNAMIC_CACHE);
      await adminCache.addAll(ADMIN_ASSETS.map(asset => withBase(asset)));
      console.log('✅ Admin assets cached');
      
      return self.skipWaiting();
    })()
  );
});

// 🔄 Activate Event (Cache Cleanup)
self.addEventListener('activate', (event) => {
  console.log('🔄 ServiceWorker activating...');
  
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name.startsWith(CACHE_PREFIX) && !name.includes(CACHE_VERSION)
      );
      
      await Promise.all(oldCaches.map(name => {
        console.log(`🗑️ Deleting old cache: ${name}`);
        return caches.delete(name);
      }));
      
      console.log('✅ Cache cleanup completed');
      return self.clients.claim();
    })()
  );
});

// 🌐 Fetch Event (Smart Caching)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 🚫 Skip non-GET requests and external resources
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }
  
  // 🔥 Skip Firebase requests (let them handle their own caching)
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    return;
  }
  
  // 🎯 Smart Route Based on Request Type
  event.respondWith(
    (async () => {
      // 📦 Static Assets (CSS, JS, Fonts)
      if (url.pathname.match(/\.(css|js|woff|woff2|ttf|otf)$/)) {
        return CacheStrategies.cacheFirst(request);
      }
      
      // 🖼️ Images (Optimized for performance)
      if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
        return CacheStrategies.staleWhileRevalidate(request);
      }
      
      // 📄 HTML Pages (Fresh content)
      if (url.pathname.match(/\.html$/)) {
        return CacheStrategies.networkFirst(request);
      }
      
      // 🌐 API Requests (Always fresh)
      if (url.pathname.includes('/api/')) {
        return CacheStrategies.networkFirst(request);
      }
      
      // 🔄 Default: Network First with fallback
      return CacheStrategies.networkFirst(request);
    })()
  );
});

// 📨 Message Event (Communication with Main App)
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
        console.log('🗑️ All caches cleared');
      })();
      break;
      
    default:
      console.log(`📨 Unknown message type: ${type}`);
  }
});

// 🔄 Background Sync (Offline Support)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      (async () => {
        console.log('🔄 Background sync triggered');
        // Handle offline actions here
      })()
    );
  }
});

// 📱 Push Notifications (PWA Feature)
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

console.log('🚀 Professional ServiceWorker ready - PWA Enabled');
