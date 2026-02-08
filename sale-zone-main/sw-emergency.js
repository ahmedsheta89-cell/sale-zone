// ============================================
// 🚨 EMERGENCY ServiceWorker Fix
// ============================================
// حل جذري لمشاكل ServiceWorker
// ============================================

// 🗑️ مسح كل شيء فوراً
self.addEventListener('install', event => {
    self.skipWaiting();
    console.log('🚨 Emergency ServiceWorker installing...');
});

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            // مسح جميع الكاش
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        console.log('🗑️ Deleting cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            }),
            // السيطرة على جميع العملاء
            self.clients.claim()
        ]).then(() => {
            console.log('🚨 Emergency ServiceWorker activated');
            // إجبار تحديث جميع الصفحات
            return self.clients.matchAll().then(clients => {
                return Promise.all(
                    clients.map(client => {
                        console.log('📱 Force refreshing client:', client.url);
                        return client.postMessage({
                            type: 'FORCE_REFRESH'
                        });
                    })
                );
            });
        })
    );
});

// 📥 معالجة الطلبات - بسيطة وفعالة
self.addEventListener('fetch', event => {
    // التعامل مع الصور المعطلة
    if (event.request.url.includes('via.placeholder.com') || 
        event.request.url.includes('unsplash.com') ||
        event.request.url.includes('favicon.ico')) {
        
        event.respondWith(
            new Response('', {
                status: 200,
                statusText: 'OK',
                headers: {
                    'Content-Type': 'image/png',
                    'Access-Control-Allow-Origin': '*'
                }
            })
        );
        return;
    }

    // للملفات الأخرى - محاولة من الشبكة أولاً
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable'
            });
        })
    );
});

console.log('🚨 Emergency ServiceWorker loaded');
