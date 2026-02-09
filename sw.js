// 🚫 SERVICEWORKER COMPLETELY REMOVED - FIXED
// This ServiceWorker has been completely disabled to prevent all errors
// No fetch handling, no caching, no interference with browser

console.log('🚫 ServiceWorker completely disabled - FIXED');

// 1. Install (التثبيت) - COMPLETELY DISABLED
self.addEventListener('install', event => {
    console.log('🚫 ServiceWorker install event - COMPLETELY DISABLED');
    event.waitUntil(self.skipWaiting());
});

// 2. Activate (تنظيف الكاش القديم) - COMPLETELY DISABLED
self.addEventListener('activate', event => {
    console.log('🚫 ServiceWorker activate event - COMPLETELY DISABLED');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    console.log('🧹 Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch (جلب البيانات) - COMPLETELY DISABLED - NO INTERFERENCE
self.addEventListener('fetch', event => {
    // 🚫 DO NOT HANDLE ANY REQUESTS - let browser handle everything
    // 🚫 NO CACHING - NO FETCHING - NO INTERFERENCE
    console.log('🚫 ServiceWorker fetch event - COMPLETELY DISABLED for:', event.request.url);
    // 🚫 DO NOT CALL respondWith() - THIS WAS CAUSING THE ERROR
    return;
});

// 4. Background Sync - DISABLED
self.addEventListener('sync', event => {
    console.log('🚫 ServiceWorker sync event - DISABLED');
});

// 5. Push Notifications - DISABLED
self.addEventListener('push', event => {
    console.log('🚫 ServiceWorker push event - DISABLED');
});

// 6. Notification Click - DISABLED
self.addEventListener('notificationclick', event => {
    console.log('🚫 ServiceWorker notification click event - DISABLED');
});

// 7. Message Handling - DISABLED
self.addEventListener('message', event => {
    console.log('🚫 ServiceWorker message event - DISABLED');
});

console.log('🚫 ServiceWorker: Disabled successfully');
