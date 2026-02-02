const CACHE_NAME = 'salezone-v2';
const urlsToCache = [
    '/متجر_2.HTML',
    '/ادمن_2.HTML',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// 1. Install (التثبيت)
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
            .catch(err => console.error('Service Worker: Cache failed', err))
    );
});

// 2. Fetch (جلب البيانات والعمل بدون نت)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // إرجاع من الكاش إذا وُجد
                if (response) {
                    console.log('Service Worker: Serving from cache', event.request.url);
                    return response;
                }
                
                // جلب من الشبكة وتخزين في الكاش
                return fetch(event.request)
                    .then(response => {
                        // التحقق من صحة الاستجابة
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }
                        
                        // نسخ الاستجابة للتخزين
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                                console.log('Service Worker: Cached new resource', event.request.url);
                            });
                        
                        return response;
                    })
                    .catch(err => {
                        console.error('Service Worker: Fetch failed', err);
                        // يمكن إرجاع صفحة offline مخصصة هنا
                        return new Response('Offline - يرجى التحقق من اتصال الإنترنت', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// 3. Activate (التفعيل وتنظيف الكاش القديم)
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('Service Worker: Deleting old cache', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// 4. Push Notification (الإشعارات)
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'إشعار جديد من Sale Zone',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'salezone-notification'
    };
    
    event.waitUntil(
        self.registration.showNotification('Sale Zone Store', options)
    );
});

// 5. Notification Click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/متجر_2.HTML')
    );
});
