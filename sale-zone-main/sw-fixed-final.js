// ============================================
// 🚀 Service Worker Fixed Version - Final
// ============================================
// إصلاح مشاكل الصور والتحميل
// ============================================

const CACHE_NAME = 'sale-zone-v2';
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
                // إذا كان في الـ cache، أرجعه
                if (response) {
                    return response;
                }

                // التعامل مع الصور المعطلة
                if (event.request.url.includes('via.placeholder.com') || 
                    event.request.url.includes('unsplash.com') ||
                    event.request.url.includes('favicon.ico')) {
                    
                    // إرجاع صورة بديلة أو فارغة
                    return new Response('', {
                        status: 200,
                        statusText: 'OK',
                        headers: {
                            'Content-Type': 'image/png',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
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

console.log('Service Worker: Fixed version loaded successfully');
