// ============================================
// 🚀 Service Worker Fixed Version
// ============================================
// إصلاح مشاكل الشاشة البيضاء والتحميل
// ============================================

const CACHE_NAME = 'sale-zone-v1';
const urlsToCache = [
    '/',
    '/متجر_2.HTML',
    '/ادمن_2.HTML',
    '/ERROR_DETECTION_SYSTEM.js',
    '/MOBILE_EMERGENCY_FIX.js',
    '/firebase-config.js',
    '/firebase-api.js',
    '/storage-keys.js'
];

// 🚀 تثبيت Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('🚀 Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
    );
});

// 🔄 تفعيل Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Service Worker: Deleting old cache');
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 📥 استراتيجية التخزين المحسّنة
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 🎯 إذا كان في الكاش، استخدمه
                if (response) {
                    return response;
                }

                // 🚨 إذا لم يكن في الكاش، جلب من الشبكة
                return fetch(event.request)
                    .then(response => {
                        // 📝 التحقق من الاستجابة الصالحة
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // 💾 تخزين الاستجابة في الكاش
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // 🚨 في حالة فشل الشبكة، إرجاع صفحة offline
                        if (event.request.destination === 'document') {
                            return caches.match('/offline.html');
                        }
                        
                        // 📱 للملفات الأخرى، إرجاع placeholder
                        return new Response('Offline - No Internet Connection', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// 🔄 مزامنة في الخلفية
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

// 📊 مزامنة البيانات
async function syncData() {
    try {
        // مزامنة البيانات مع Firebase
        console.log('🔄 Syncing data with Firebase');
        // ... منطق المزامنة
    } catch (error) {
        console.error('❌ Sync failed:', error);
    }
}

// 📱 إشعارات الدفع
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(
        self.registration.showNotification('Sale Zone Store', options)
    );
});
