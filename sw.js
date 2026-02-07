const CACHE_NAME = 'salezone-v4';

// حساب المسار الأساسي (للعمل مع GitHub Pages subdirectories)
const BASE_PATH = self.location.pathname.replace(/\/[^\/]*$/, '');
console.log(' Base path:', BASE_PATH);

const urlsToCache = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/متجر_2.HTML',
  BASE_PATH + '/ادمن_2.HTML',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/icon-192.png',
  BASE_PATH + '/icon-512.png'
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
