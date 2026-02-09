// 🚫 SERVICEWORKER DISABLED - causing errors
// This ServiceWorker has been disabled to prevent errors
// Use serviceworker-ultimate-killer.js to completely remove ServiceWorkers

console.log('🚫 ServiceWorker disabled - causing fetch errors');

// 1. Install (التثبيت) - DISABLED
self.addEventListener('install', event => {
    console.log('🚫 ServiceWorker install event - DISABLED');
    event.waitUntil(self.skipWaiting());
});

// 2. Activate (تنظيف الكاش القديم) - DISABLED
self.addEventListener('activate', event => {
    console.log('🚫 ServiceWorker activate event - DISABLED');
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

// 3. Fetch (جلب البيانات) - DISABLED
self.addEventListener('fetch', event => {
    // 🚫 DO NOT HANDLE ANY REQUESTS - let browser handle them
    console.log('🚫 ServiceWorker fetch event - DISABLED for:', event.request.url);
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
