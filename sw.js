const CACHE_NAME = 'salezone-v5';
const STATIC_CACHE = 'salezone-static-v5';
const DYNAMIC_CACHE = 'salezone-dynamic-v5';
const IMAGE_CACHE = 'salezone-images-v5';

// حساب المسار الأساسي (للعمل مع GitHub Pages subdirectories)
const BASE_PATH = self.location.pathname.replace(/\/[^\/]*$/, '');
console.log(' Base path:', BASE_PATH);

// Static files to cache immediately
const STATIC_URLS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/متجر_2.HTML',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/icon-192.png',
  BASE_PATH + '/icon-512.png',
  BASE_PATH + '/offline.html'
];

// Admin files (separate cache)
const ADMIN_URLS = [
  BASE_PATH + '/ادمن_2.HTML'
];

// Cache strategies
const cacheStrategies = {
  // Cache first for static assets
  cacheFirst: (request) => {
    return caches.match(request).then(response => {
      return response || fetch(request).then(fetchResponse => {
        return caches.open(STATIC_CACHE).then(cache => {
          cache.put(request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    });
  },

  // Network first for dynamic content
  networkFirst: (request) => {
    return fetch(request).then(response => {
      return caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, response.clone());
        return response;
      });
    }).catch(() => {
      return caches.match(request);
    });
  },

  // Cache first for images with expiration
  imageCacheFirst: (request) => {
    return caches.match(request).then(response => {
      if (response) {
        // Check if image is still fresh (7 days)
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const age = (Date.now() - new Date(dateHeader).getTime()) / (1000 * 60 * 60 * 24);
          if (age < 7) {
            return response;
          }
        }
      }
      
      return fetch(request).then(fetchResponse => {
        return caches.open(IMAGE_CACHE).then(cache => {
          cache.put(request, fetchResponse.clone());
          return fetchResponse;
        });
      }).catch(() => {
        return caches.match(request);
      });
    });
  }
};

// 1. Install (التثبيت)
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then(cache => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_URLS);
            }),
            caches.open(ADMIN_URLS.length > 0 ? DYNAMIC_CACHE : STATIC_CACHE).then(cache => {
                console.log('Service Worker: Caching admin files');
                return cache.addAll(ADMIN_URLS);
            })
        ]).then(() => self.skipWaiting())
        .catch(err => console.error('Service Worker: Cache failed', err))
    );
});

// 2. Activate (تنظيف الكاش القديم)
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== IMAGE_CACHE &&
                        !cacheName.startsWith('salezone-v')) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch (جلب البيانات والعمل بدون نت)
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // ❌ تجاهل أي حاجة تخص Firebase / Google
    if (
        url.origin.includes('googleapis.com') ||
        url.origin.includes('firebaseio.com') ||
        url.origin.includes('gstatic.com') ||
        url.href.includes('firestore.googleapis.com')
    ) {
        return;
    }
    
    if (event.request.method !== 'GET') return;
    
    // Choose strategy based on request type
    let response;
    
    if (STATIC_URLS.includes(url.pathname) || url.pathname.includes('/icon-')) {
        // Static assets - cache first
        response = cacheStrategies.cacheFirst(event.request);
    } else if (url.pathname.includes('/ادمن_2.HTML')) {
        // Admin files - network first
        response = cacheStrategies.networkFirst(event.request);
    } else if (event.request.destination === 'image' || url.pathname.includes('cloudinary')) {
        // Images - cache first with expiration
        response = cacheStrategies.imageCacheFirst(event.request);
    } else {
        // Dynamic content - network first
        response = cacheStrategies.networkFirst(event.request);
    }
    
    event.respondWith(response);
});

// 4. Background Sync (مزامنة الخلفية)
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(
            console.log('Service Worker: Background sync triggered')
        );
    }
});

// 5. Push Notifications (إشعارات الدفع)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        event.waitUntil(
            self.registration.showNotification(data.title, {
                body: data.body,
                icon: BASE_PATH + '/icon-192.png',
                badge: BASE_PATH + '/icon-192.png',
                tag: 'salezone-notification'
            })
        );
    }
});

// 6. Notification Click (نقر الإشعار)
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(BASE_PATH + '/متجر_2.HTML')
    );
});

console.log('Service Worker: Loaded successfully');
