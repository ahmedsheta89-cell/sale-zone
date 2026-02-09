// =====================================================
// SERVICE WORKER FIXED - إصلاح مشكلة "resolved with non-Response value 'undefined'"
// =====================================================

const CACHE_NAME = 'sale-zone-v1';
const RUNTIME_CACHE = 'sale-zone-runtime';

// الملفات المراد تخزينها مؤقتاً
const PRECACHE_URLS = [
    './',
    './index.html',
    './متجر_2.HTML',
    './ادمن_2.HTML',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './styles.css',
    './firebase-config.js',
    './firebase-api.js',
    './storage-keys.js',
    './enhancement-utils.js'
];

// Domains المسموح بها
const ALLOWED_DOMAINS = [
    'ahmedsheta89-cell.github.io',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'firebasestorage.googleapis.com',
    'www.gstatic.com',
    'source.unsplash.com',
    'images.unsplash.com',
    'picsum.photos',
    'via.placeholder.com'
];

// =====================================================
// Install Event
// =====================================================
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Caching app shell');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => {
                console.log('✅ Service Worker: Installed successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker: Installation failed', error);
            })
    );
});

// =====================================================
// Activate Event
// =====================================================
self.addEventListener('activate', (event) => {
    console.log('⚡ Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                        .map((name) => {
                            console.log('🗑️ Service Worker: Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('✅ Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

// =====================================================
// Fetch Event - الإصلاح الرئيسي
// =====================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // ✅ تجاهل external requests (دعها تعمل بشكل عادي)
    if (url.origin !== location.origin) {
        // السماح فقط للـ domains المعروفة
        const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
            url.hostname.includes(domain)
        );
        
        if (!isAllowedDomain) {
            console.log('🌐 Service Worker: Allowing external request:', request.url);
            return; // لا نستخدم event.respondWith()
        }
    }
    
    // ✅ تجاهل non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // ✅ تجاهل Firebase API calls
    if (url.hostname.includes('firebaseio.com') || 
        url.hostname.includes('googleapis.com') ||
        url.pathname.includes('/firebase/')) {
        return;
    }
    
    // استراتيجية التخزين المؤقت
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                // إذا موجود في الكاش، أرجعه
                if (cachedResponse) {
                    // تحديث الكاش في الخلفية
                    fetch(request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                return caches.open(RUNTIME_CACHE)
                                    .then((cache) => {
                                        cache.put(request, networkResponse.clone());
                                        return networkResponse;
                                    });
                            }
                        })
                        .catch(() => {
                            // تجاهل الأخطاء في التحديث الخلفي
                        });
                    
                    return cachedResponse;
                }
                
                // ✅ الإصلاح الرئيسي: محاولة fetch مع error handling صحيح
                return fetch(request)
                    .then((networkResponse) => {
                        // ✅ تحقق من Response صالح
                        if (!networkResponse || 
                            networkResponse.status !== 200 || 
                            networkResponse.type === 'error') {
                            return networkResponse;
                        }
                        
                        // تخزين في الكاش
                        const responseToCache = networkResponse.clone();
                        
                        caches.open(RUNTIME_CACHE)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            })
                            .catch((error) => {
                                console.warn('⚠️ Cache put failed:', error);
                            });
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.warn('⚠️ Fetch failed for:', request.url, error);
                        
                        // ✅ إرجاع offline response أو fallback
                        if (request.destination === 'document') {
                            return caches.match('./متجر_2.HTML')
                                .then((offlineResponse) => {
                                    return offlineResponse || new Response(
                                        '<h1>جاري التحميل...</h1>',
                                        { 
                                            headers: { 'Content-Type': 'text/html' }
                                        }
                                    );
                                });
                        }
                        
                        // ✅ إرجاع placeholder للصور
                        if (request.destination === 'image') {
                            return new Response(
                                '<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="8" fill="#999">📷</text></svg>',
                                { 
                                    headers: { 
                                        'Content-Type': 'image/svg+xml',
                                        'Cache-Control': 'no-cache'
                                    }
                                }
                            );
                        }
                        
                        // ✅ إرجاع response صالح للباقي
                        return new Response('', { 
                            status: 408,
                            statusText: 'Request Timeout'
                        });
                    });
            })
    );
});

// =====================================================
// Message Event - للتحديثات
// =====================================================
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data.action === 'clearCache') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => caches.delete(name))
                );
            })
        );
    }
});

console.log('✅ Service Worker FIXED script loaded');
