// ============================================
// 🚀 Service Worker Force Update Version
// ============================================
// إجبار تحديث ServiceWorker ومسح الكاش القديم
// ============================================

const CACHE_NAME = 'sale-zone-v3-force-update';
const urlsToCache = [
    '/',
    '/متجر_2.HTML',
    '/ادمن_2.HTML',
    '/ERROR_DETECTION_SYSTEM.js',
    '/MOBILE_EMERGENCY_FIX.js',
    '/firebase-config.js',
    '/firebase-api.js',
    '/storage-keys.js',
    '/icon-192.png',
    '/icon-512.png'
];

// 🚀 تثبيت ServiceWorker مع مسح شامل
self.addEventListener('install', event => {
    console.log('🔄 Force updating ServiceWorker...');
    
    // مسح جميع الكاش القديم فوراً
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    console.log('🗑️ Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            console.log('✅ All caches cleared, installing new version');
            return caches.open(CACHE_NAME)
                .then(cache => {
                    console.log('🚀 Service Worker: Caching files');
                    return cache.addAll(urlsToCache);
                });
        })
    );
});

// 🔄 تفعيل ServiceWorker مع force refresh
self.addEventListener('activate', event => {
    console.log('🔄 Activating new ServiceWorker...');
    
    event.waitUntil(
        self.clients.claim().then(() => {
            // إجبار جميع العملاء على التحديث
            return self.clients.matchAll().then(clients => {
                return Promise.all(
                    clients.map(client => {
                        console.log('📱 Notifying client to refresh');
                        return client.navigate(client.url);
                    })
                );
            });
        })
    );
});

// 📥 استراتيجية التخزين المحسّنة
self.addEventListener('fetch', event => {
    // التعامل مع الصور المعطلة أولاً
    if (event.request.url.includes('via.placeholder.com') || 
        event.request.url.includes('unsplash.com') ||
        event.request.url.includes('favicon.ico')) {
        
        event.respondWith(
            new Response('', {
                status: 200,
                statusText: 'OK',
                headers: {
                    'Content-Type': 'image/png',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache'
                }
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // إذا كان في الـ cache، أرجعه
                if (response) {
                    return response;
                }

                // محاولة جلب الطلب من الشبكة
                return fetch(event.request)
                    .then(response => {
                        // التحقق من أن الاستجابة صالحة
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // إضافة إلى الـ cache
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // في حالة فشل الشبكة، حاول من الـ cache
                        return caches.match(event.request);
                    });
            })
    );
});

console.log('🔄 Service Worker: Force update version loaded');
