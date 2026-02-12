// Firebase Data Initializer
// ==========================

// Initialize Firebase (sample data seeding disabled in production)
const ENABLE_SAMPLE_DATA = false; // set true فقط في بيئة التطوير

function isLocalLikeHost(hostname) {
    const host = String(hostname || '').trim().toLowerCase();
    if (!host) return false;
    if (/^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1|\[::1\])$/.test(host)) return true;
    if (/^10(?:\.\d{1,3}){3}$/.test(host)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host)) return true;
    return host.endsWith('.local');
}

function shouldEnableRealtimeListeners() {
    const hostname = window.location.hostname || '';
    const isGithubPages = /(^|\.)github\.io$/i.test(hostname);
    const isLocalDev = isLocalLikeHost(hostname);
    const isInsecureRemoteHttp = window.location.protocol === 'http:' && !isLocalDev;
    const forceRealtime = new URLSearchParams(window.location.search).get('realtime') === '1' ||
        window.FORCE_FIREBASE_REALTIME === true;

    if (isGithubPages && !forceRealtime) {
        // Production must stay in online-sync mode across devices.
        return true;
    }

    if (isLocalDev && !forceRealtime) {
        console.log('Local/network dev detected - skipping Firestore real-time listeners (add ?realtime=1 to enable)');
        return false;
    }

    if (isInsecureRemoteHttp && !forceRealtime) {
        console.log('Non-HTTPS host detected - skipping Firestore real-time listeners (add ?realtime=1 to enable)');
        return false;
    }

    return true;
}

const REALTIME_LISTENERS_ENABLED = shouldEnableRealtimeListeners();

const FIREBASE_SYNC_POLL_INTERVAL_MS = 15000;
const FIREBASE_SYNC_STALE_MS = 45000;
const FIREBASE_SYNC_STATUS = window.__FIREBASE_SYNC_STATUS__ || {
    realtimeEnabled: false,
    pollingEnabled: false,
    lastSuccessAt: 0,
    lastErrorAt: 0,
    consecutiveErrors: 0,
    lastSource: '',
    lastError: '',
    lastDetails: null
};
window.__FIREBASE_SYNC_STATUS__ = FIREBASE_SYNC_STATUS;

let firebasePollingTimer = null;
let firebasePollingInFlight = false;

function setFirebaseSyncStatus(patch) {
    Object.assign(FIREBASE_SYNC_STATUS, patch || {});
    window.__FIREBASE_SYNC_STATUS__ = FIREBASE_SYNC_STATUS;
}

function markFirebaseSyncSuccess(source, details = null) {
    const now = Date.now();
    setFirebaseSyncStatus({
        lastSuccessAt: now,
        consecutiveErrors: 0,
        lastSource: String(source || ''),
        lastError: '',
        lastDetails: details && typeof details === 'object' ? details : null
    });
    window.__STORE_LAST_FIREBASE_SYNC_AT__ = new Date(now).toISOString();
}

function markFirebaseSyncError(source, error) {
    const message = error && error.message ? String(error.message) : String(error || 'unknown');
    setFirebaseSyncStatus({
        lastErrorAt: Date.now(),
        consecutiveErrors: (Number(FIREBASE_SYNC_STATUS.consecutiveErrors) || 0) + 1,
        lastSource: String(source || ''),
        lastError: message
    });
}

function persistSyncedCollection(storageKey, list, fallbackRender) {
    let persisted = false;
    try {
        if (typeof setStorageData === 'function') {
            persisted = setStorageData(storageKey, list) !== false;
        }
    } catch (_) {}

    if (!persisted && typeof fallbackRender === 'function') {
        try { fallbackRender(); } catch (_) {}
    }
}

async function pullStoreCollectionsFromFirebase(source = 'poll') {
    const tasks = [
        typeof getAllProducts === 'function' ? getAllProducts() : Promise.resolve(null),
        typeof getCoupons === 'function' ? getCoupons() : Promise.resolve(null),
        typeof getBanners === 'function' ? getBanners() : Promise.resolve(null)
    ];

    const [productsResult, couponsResult, bannersResult] = await Promise.allSettled(tasks);
    let syncedCollections = 0;
    const details = { products: null, coupons: null, banners: null };

    if (productsResult.status === 'fulfilled' && Array.isArray(productsResult.value)) {
        products = productsResult.value;
        details.products = products.length;
        syncedCollections++;
        persistSyncedCollection('PRODUCTS', products, () => {
            if (typeof renderProducts === 'function') renderProducts();
            if (typeof updateCategoryCounts === 'function') updateCategoryCounts();
            if (typeof updateProductsDisplay === 'function') updateProductsDisplay();
        });
    }

    if (couponsResult.status === 'fulfilled' && Array.isArray(couponsResult.value)) {
        coupons = couponsResult.value;
        details.coupons = coupons.length;
        syncedCollections++;
        persistSyncedCollection('COUPONS', coupons, () => {
            if (typeof renderCoupons === 'function') renderCoupons();
            if (typeof updateCouponsDisplay === 'function') updateCouponsDisplay();
        });
    }

    if (bannersResult.status === 'fulfilled' && Array.isArray(bannersResult.value)) {
        banners = bannersResult.value;
        details.banners = banners.length;
        syncedCollections++;
        persistSyncedCollection('BANNERS', banners, () => {
            if (typeof renderBanners === 'function') renderBanners();
            if (typeof updateBannersDisplay === 'function') updateBannersDisplay();
        });
    }

    if (syncedCollections === 0) {
        throw new Error('No Firebase collections could be synchronized.');
    }

    markFirebaseSyncSuccess(source, details);
    return details;
}

function shouldRunPollingSync(force = false) {
    if (force) return true;
    if (!REALTIME_LISTENERS_ENABLED) return true;
    if ((Number(FIREBASE_SYNC_STATUS.consecutiveErrors) || 0) > 0) return true;

    const lastSuccessAt = Number(FIREBASE_SYNC_STATUS.lastSuccessAt) || 0;
    if (!lastSuccessAt) return true;

    return (Date.now() - lastSuccessAt) >= FIREBASE_SYNC_STALE_MS;
}

async function runPollingSync({ force = false, reason = 'interval' } = {}) {
    if (firebasePollingInFlight) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!shouldRunPollingSync(force)) return;

    firebasePollingInFlight = true;
    try {
        const details = await pullStoreCollectionsFromFirebase(`poll:${reason}`);
        if (force || (Number(FIREBASE_SYNC_STATUS.consecutiveErrors) || 0) > 0) {
            console.log('[OK] Firebase polling sync completed:', details);
        }
    } catch (error) {
        markFirebaseSyncError(`poll:${reason}`, error);
        console.warn('Firebase polling sync warning:', error && error.message ? error.message : error);
    } finally {
        firebasePollingInFlight = false;
    }
}

function startPollingSyncFallback() {
    if (firebasePollingTimer) return;

    setFirebaseSyncStatus({ pollingEnabled: true });
    runPollingSync({ force: true, reason: 'boot' });

    firebasePollingTimer = setInterval(() => {
        runPollingSync({ force: false, reason: 'interval' });
    }, FIREBASE_SYNC_POLL_INTERVAL_MS);

    window.addEventListener('online', () => {
        runPollingSync({ force: true, reason: 'online' });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            runPollingSync({ force: true, reason: 'visible' });
        }
    });

    console.log(`[OK] Firebase polling fallback enabled (${FIREBASE_SYNC_POLL_INTERVAL_MS / 1000}s interval)`);
}

async function initializeFirebaseData() {
    try {
        // Check if products collection exists
        const productsSnapshot = await db.collection('products').get();
        
        if (productsSnapshot.empty) {
            if (!ENABLE_SAMPLE_DATA) {
                console.log('ℹ️ Sample data seeding disabled (products).');
            } else {
                console.log('🔥 Initializing Firebase with sample data...');
            
            // Sample Products
            const sampleProducts = [
                {
                    name: 'شامبو كيراتين فاخر',
                    desc: 'شامبو احترافي بالكيراتين لتنعيم الشعر',
                    category: 'عناية بالشعر',
                    price: 189,
                    oldPrice: 249,
                    image: './assets/placeholder.svg',
                    rating: 4.8,
                    ratingCount: 124,
                    stock: 50,
                    featured: true,
                    createdAt: new Date()
                },
                {
                    name: 'سيروم فيتامين C',
                    desc: 'سيروم مضاد للأكسدة للبشرة المشرقة',
                    category: 'عناية بالبشرة',
                    price: 299,
                    oldPrice: 399,
                    image: './assets/placeholder.svg',
                    rating: 4.9,
                    ratingCount: 89,
                    stock: 30,
                    featured: true,
                    createdAt: new Date()
                },
                {
                    name: 'حليب الأطفال المخصص',
                    desc: 'حليب طبيعي للأطفال من 0-6 أشهر',
                    category: 'العناية بالطفل',
                    price: 159,
                    oldPrice: 199,
                    image: './assets/placeholder.svg',
                    rating: 4.7,
                    ratingCount: 67,
                    stock: 40,
                    featured: false,
                    createdAt: new Date()
                },
                {
                    name: 'فيتامينات متعددة',
                    desc: 'مجموعة فيتامينات شاملة للصحة',
                    category: 'مكملات غذائية',
                    price: 129,
                    oldPrice: 169,
                    image: './assets/placeholder.svg',
                    rating: 4.6,
                    ratingCount: 203,
                    stock: 100,
                    featured: false,
                    createdAt: new Date()
                },
                {
                    name: 'كريم مرطب للوجه',
                    desc: 'كريم مرطب عميق للبشرة الجافة',
                    category: 'عناية بالبشرة',
                    price: 219,
                    oldPrice: 279,
                    image: './assets/placeholder.svg',
                    rating: 4.8,
                    ratingCount: 156,
                    stock: 25,
                    featured: true,
                    createdAt: new Date()
                },
                {
                    name: 'بلسم الشعر المعالج',
                    desc: 'بلسم للشعر التالف والمجهد',
                    category: 'عناية بالشعر',
                    price: 139,
                    oldPrice: 179,
                    image: './assets/placeholder.svg',
                    rating: 4.5,
                    ratingCount: 98,
                    stock: 60,
                    featured: false,
                    createdAt: new Date()
                },
                {
                    name: 'زيت الأطفال اللطيف',
                    desc: 'زيت طبيعي لتدليك الأطفال',
                    category: 'العناية بالطفل',
                    price: 89,
                    oldPrice: 119,
                    image: './assets/placeholder.svg',
                    rating: 4.9,
                    ratingCount: 45,
                    stock: 80,
                    featured: false,
                    createdAt: new Date()
                }
            ];
            
                // Add products to Firestore
                for (const product of sampleProducts) {
                    await db.collection('products').add(product);
                }
                
                console.log('✅ Sample products added to Firebase');
            }
        }
        
        // Check if banners collection exists
        const bannersSnapshot = await db.collection('banners').get();
        
        if (bannersSnapshot.empty) {
            if (!ENABLE_SAMPLE_DATA) {
                console.log('ℹ️ Sample data seeding disabled (banners).');
            } else {
                const sampleBanners = [
                {
                    title: 'خصم 30%',
                    subtitle: 'على جميع منتجات العناية بالشعر',
                    image: './assets/banner-placeholder.svg',
                    link: '#hair-care',
                    active: true,
                    order: 1,
                    createdAt: new Date()
                },
                {
                    title: 'جديدنا',
                    subtitle: 'سيروم فيتامين C',
                    image: './assets/banner-placeholder.svg',
                    link: '#skin-care',
                    active: true,
                    order: 2,
                    createdAt: new Date()
                }
            ];
            
                for (const banner of sampleBanners) {
                    await db.collection('banners').add(banner);
                }
                
                console.log('✅ Sample banners added to Firebase');
            }
        }
        
        // Check if coupons collection exists
        const couponsSnapshot = await db.collection('coupons').get();
        
        if (couponsSnapshot.empty) {
            if (!ENABLE_SAMPLE_DATA) {
                console.log('ℹ️ Sample data seeding disabled (coupons).');
            } else {
                const sampleCoupons = [
                {
                    code: 'WELCOME20',
                    discount: 20,
                    type: 'percentage',
                    minAmount: 100,
                    maxDiscount: 50,
                    usageLimit: 100,
                    usedCount: 0,
                    active: true,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    createdAt: new Date()
                },
                {
                    code: 'SALE50',
                    discount: 50,
                    type: 'fixed',
                    minAmount: 200,
                    usageLimit: 50,
                    usedCount: 0,
                    active: true,
                    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
                    createdAt: new Date()
                }
            ];
            
                for (const coupon of sampleCoupons) {
                    await db.collection('coupons').add(coupon);
                }
                
                console.log('✅ Sample coupons added to Firebase');
            }
        }
        
        console.log('🎉 Firebase initialization completed!');
        
        // Setup real-time listeners for live updates
        // GitHub Pages can block Firestore listen channel (CORS). Skip to avoid spam.
        if (REALTIME_LISTENERS_ENABLED) {
            setupRealtimeListeners();
        }
        startPollingSyncFallback();
        
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
    }
}

// Real-time listeners for live updates
function setupRealtimeListeners() {
    if (!REALTIME_LISTENERS_ENABLED) {
        setFirebaseSyncStatus({ realtimeEnabled: false });
        return;
    }
    setFirebaseSyncStatus({ realtimeEnabled: true });

    // Listen for banners changes
    db.collection('banners').onSnapshot((snapshot) => {
        banners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('🎨 Banners updated in real-time:', banners.length);
        let persisted = false;
        try {
            if (typeof setStorageData === 'function') {
                persisted = setStorageData('BANNERS', banners) !== false;
            }
        } catch (_) {}
        if (!persisted) {
            if (typeof renderBanners === 'function') {
                try { renderBanners(); } catch (_) {}
            } else {
                updateBannersDisplay();
            }
        }
        markFirebaseSyncSuccess('realtime:banners', { banners: banners.length });
    }, (error) => {
        markFirebaseSyncError('realtime:banners', error);
        console.error('Banners listener error:', error);
    });

    // Listen for coupons changes
    db.collection('coupons').onSnapshot((snapshot) => {
        coupons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('🎫 Coupons updated in real-time:', coupons.length);
        let persisted = false;
        try {
            if (typeof setStorageData === 'function') {
                persisted = setStorageData('COUPONS', coupons) !== false;
            }
        } catch (_) {}
        if (!persisted) {
            if (typeof renderCoupons === 'function') {
                try { renderCoupons(); } catch (_) {}
            } else {
                updateCouponsDisplay();
            }
        }
        markFirebaseSyncSuccess('realtime:coupons', { coupons: coupons.length });
    }, (error) => {
        markFirebaseSyncError('realtime:coupons', error);
        console.error('Coupons listener error:', error);
    });

    // Listen for products changes
    db.collection('products').onSnapshot((snapshot) => {
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('🛍️ Products updated in real-time:', products.length);
        let persisted = false;
        try {
            if (typeof setStorageData === 'function') {
                persisted = setStorageData('PRODUCTS', products) !== false;
            }
        } catch (_) {}
        if (!persisted) {
            if (typeof renderProducts === 'function') {
                try {
                    renderProducts();
                    if (typeof updateCategoryCounts === 'function') updateCategoryCounts();
                } catch (_) {}
            } else if (typeof updateProductsDisplay === 'function') {
                updateProductsDisplay();
            }
        }
        markFirebaseSyncSuccess('realtime:products', { products: products.length });
    }, (error) => {
        markFirebaseSyncError('realtime:products', error);
        console.error('Products listener error:', error);
    });

    console.log('🔄 Real-time listeners setup complete');
}

// Update functions for UI
function updateBannersDisplay() {
    const bannerContainer = document.querySelector('.hero-slider');
    if (bannerContainer && banners.length > 0) {
        // Update banner display
        console.log('🎨 Updating banner display with', banners.length, 'banners');
    }
}

function updateCouponsDisplay() {
    // Update coupon display in store
    console.log('🎫 Updating coupon display with', coupons.length, 'coupons');
}

// Auto-initialize only on store page to avoid unnecessary admin listeners/network calls
const currentPage = (document.documentElement && document.documentElement.dataset && document.documentElement.dataset.page) || '';
const isStorePage = String(currentPage).toLowerCase() === 'store';

if (isStorePage) {
    if (typeof db !== 'undefined') {
        initializeFirebaseData();
    } else {
        // Wait for Firebase to load
        setTimeout(initializeFirebaseData, 2000);
    }
}
