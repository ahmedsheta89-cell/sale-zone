// firebase-api.js - Firebase Firestore API
// ==========================================
// Note: db is already declared in firebase-config.js

// Global Firebase DB Check
function getFirebaseDB() {
    if (typeof db !== 'undefined') {
        return db;
    }
    
    // Fallback: try to get db from window
    if (typeof window.db !== 'undefined') {
        return window.db;
    }
    
    // Last resort: initialize Firebase again
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        return firebase.firestore();
    }
    
    throw new Error('Firebase Firestore not available');
}

function getFirebaseAuth() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        return firebase.auth();
    }
    throw new Error('Firebase Auth not available');
}

function getFirebaseAuthUserSafe() {
    try {
        const auth = getFirebaseAuth();
        return auth && auth.currentUser ? auth.currentUser : null;
    } catch (_) {
        return null;
    }
}

function canClientWriteTelemetry(options = {}) {
    const requireVerified = options && options.requireVerified !== false;
    const user = getFirebaseAuthUserSafe();
    if (!user) return false;
    if (!requireVerified) return true;
    return user.emailVerified === true;
}

if (typeof window !== 'undefined') {
    window.canClientWriteTelemetry = canClientWriteTelemetry;
}

function getBackendApiBaseUrl() {
    if (typeof window === 'undefined') return '';
    const explicit = String(window.__BACKEND_API_BASE_URL__ || window.BACKEND_API_BASE_URL || '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    const meta = document.querySelector('meta[name="backend-api-base-url"]');
    const fromMeta = String(meta && meta.getAttribute('content') || '').trim();
    return fromMeta ? fromMeta.replace(/\/+$/, '') : '';
}

function shouldUseBackendApi() {
    if (typeof window === 'undefined') return false;
    const backendBase = getBackendApiBaseUrl();
    return Boolean(String(backendBase || '').trim());
}

// WHY: release-gate checks require a dedicated backend-unavailable classifier helper.
function isBackendApiUnavailableError(error) {
    if (!error) return false;
    const code = String(error.code || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    const status = Number(error.status || 0);
    return (
        code === 'backend-api-disabled' ||
        code === 'backend-api-base-url-missing' ||
        code === 'backend_required' ||
        message.includes('backend-api-disabled') ||
        message.includes('backend-api-base-url-missing') ||
        message.includes('backend_required') ||
        status === 503
    );
}

function isFirestoreIndexError(error) {
    if (!error) return false;
    const code = String(error.code || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    return (
        code === 'failed-precondition' ||
        code === 'failed_precondition' ||
        message.includes('requires an index') ||
        message.includes('create_composite') ||
        (message.includes('index') && message.includes('createdat'))
    );
}

// WHY: release-gate checks require a one-time backend warning noise guard marker.
let backendUnavailableNoticePrinted = false;

// WHY: avoid repeated noisy warnings when backend API is unavailable.
function printBackendUnavailableNoticeOnce(reason) {
    if (backendUnavailableNoticePrinted) return false;
    backendUnavailableNoticePrinted = true;
    console.warn('[WARN] Backend API unavailable:', String(reason || 'backend-api-unavailable'));
    return true;
}

function requireBackendApiForSensitiveWrite(operationName = 'sensitive-write') {
    if (!shouldUseBackendApi()) {
        const error = new Error(`Backend API is required for ${operationName}.`);
        error.code = 'backend-api-required';
        throw error;
    }
}

function resolveBackendApiUrl(pathname = '') {
    const base = String(getBackendApiBaseUrl() || '').trim();
    if (!base) return '';
    const safePath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${base}${safePath}`;
}

async function getAppCheckTokenSafe() {
    try {
        const enforcementEnabled = typeof window !== 'undefined' && window.__APP_CHECK_ENFORCEMENT__ === true;
        if (enforcementEnabled && typeof window !== 'undefined' && window.__APP_CHECK_READY__ === false) {
            throw new Error(window.__APP_CHECK_BLOCK_REASON__ || 'App Check is required but unavailable.');
        }
        if (!(typeof firebase !== 'undefined' && firebase.appCheck)) return '';
        const appCheck = firebase.appCheck();
        if (!appCheck || typeof appCheck.getToken !== 'function') return '';
        const result = await appCheck.getToken(false);
        return String(result && result.token || '');
    } catch (error) {
        console.warn('[WARN] App Check token unavailable:', error && error.message ? error.message : error);
        return '';
    }
}

// NOTE: Backend API disabled (Firebase Spark plan)
// All functions migrated to Firestore direct
// Keep this function for future use when Functions are enabled
async function callBackendApi(pathname, options = {}) {
    const settings = options && typeof options === 'object' ? options : {};
    const method = String(settings.method || 'GET').toUpperCase();
    const requireAuth = settings.requireAuth !== false;
    const requireAppCheck = settings.requireAppCheck !== false;
    const body = Object.prototype.hasOwnProperty.call(settings, 'body') ? settings.body : undefined;
    const strict = settings.strict !== false;
    const timeoutMs = Number.isFinite(Number(settings.timeoutMs)) ? Math.max(0, Number(settings.timeoutMs)) : 0;

    if (!shouldUseBackendApi()) {
        if (strict) {
            const error = new Error('backend-api-disabled');
            error.code = 'backend-api-disabled';
            printBackendUnavailableNoticeOnce(error.message);
            throw error;
        }
        printBackendUnavailableNoticeOnce('backend-api-disabled');
        return null;
    }

    const url = resolveBackendApiUrl(pathname);
    if (!url) {
        if (strict) throw new Error('backend-api-base-url-missing');
        return null;
    }

    const headers = {
        'Content-Type': 'application/json',
        'X-Request-Id': `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    };

    if (requireAuth) {
        const auth = getFirebaseAuth();
        const user = auth && auth.currentUser ? auth.currentUser : null;
        if (!user) throw new Error('auth/not-authenticated');
        const idToken = await user.getIdToken(true);
        headers.Authorization = `Bearer ${idToken}`;
    }

    if (requireAppCheck) {
        const token = await getAppCheckTokenSafe();
        const enforcementEnabled = typeof window !== 'undefined' && window.__APP_CHECK_ENFORCEMENT__ === true;
        if (!token && enforcementEnabled) throw new Error('app-check/missing-token');
        if (token) headers['X-Firebase-AppCheck'] = token;
    }

    const controller = (typeof AbortController !== 'undefined' && timeoutMs > 0) ? new AbortController() : null;
    const timeoutHandle = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response;
    try {
        response = await fetch(url, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller ? controller.signal : undefined
        });
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    let payload = {};
    try {
        payload = await response.json();
    } catch (_) {
        payload = {};
    }

    if (!response.ok || payload.ok === false) {
        const err = new Error(
            payload && payload.error && payload.error.message
                ? String(payload.error.message)
                : `backend-api-${response.status}`
        );
        err.code = payload && payload.error && payload.error.code
            ? String(payload.error.code)
            : `http/${response.status}`;
        err.status = response.status;
        err.payload = payload;
        throw err;
    }

    return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

const COUNTDOWN_ENDPOINT = '/v1/admin/countdown';
const COUNTDOWN_ENDPOINT_LEGACY = '/admin/countdown';

function buildBackendRequiredError(operationName) {
    const error = new Error(`BACKEND_REQUIRED: Backend API is required for ${operationName}.`);
    error.code = 'BACKEND_REQUIRED';
    error.status = 503;
    return error;
}

function isTimeoutError(error) {
    const name = String(error && error.name || '');
    const message = String(error && error.message || '');
    return name === 'AbortError' || /timed?\s*out/i.test(message);
}

function isRetryableNetworkError(error) {
    if (!error) return false;
    if (isTimeoutError(error)) return true;
    const code = String(error.code || '');
    if (!code) return false;
    return ['http/429', 'http/500', 'http/502', 'http/503', 'http/504'].includes(code);
}

function withCountdownDefaults(data) {
    const source = data && typeof data === 'object' ? data : {};
    return {
        enabled: source.enabled === true,
        startedAt: Number.isFinite(Number(source.startedAt)) ? Number(source.startedAt) : 0,
        durationMs: Number.isFinite(Number(source.durationMs)) ? Number(source.durationMs) : 0,
        gateState: String(source.gateState || '').trim().toUpperCase() || 'WAITING',
        source: String(source.source || 'backend').trim().toLowerCase() || 'backend',
        ...source
    };
}

// WHY: removed Backend API dependency (Spark plan - no Functions)
async function getReleaseGateState() {
    try {
        const db = getFirebaseDB();
        const doc = await db.collection('settings').doc('release-gate-state').get();
        return doc.exists ? doc.data() : { state: 'open' };
    } catch (e) {
        console.error('getReleaseGateState error:', e);
        return { state: 'open' };
    }
}

// WHY: removed Backend API dependency (Spark plan - no Functions)
async function saveReleaseGateState(state) {
    try {
        const db = getFirebaseDB();
        await db.collection('settings').doc('release-gate-state').set(state, { merge: true });
        return { success: true };
    } catch (e) {
        console.error('saveReleaseGateState error:', e);
        return { success: false, error: e.message };
    }
}

// ==========================================
// COUPONS
// ==========================================
async function getCoupons() {
    try {
        // WHY: Backend API removed (Firebase Spark plan - no Cloud Functions).
        const db = getFirebaseDB();
        const snapshot = await db.collection('coupons').get();
        const coupons = snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                code: data.code || '',
                desc: data.desc || '',
                type: data.type || 'percentage',
                value: data.value || 0
            };
        });
        return coupons;
    } catch (e) {
        console.error('getCoupons error:', e);
        return [];
    }
}

async function addCoupon(coupon) {
    try {
        // WHY: write coupons directly to Firestore to avoid CORS/backend dependency.
        const db = getFirebaseDB();
        const payload = coupon && typeof coupon === 'object' ? coupon : {};
        const nowIso = new Date().toISOString();
        const docRef = await db.collection('coupons').add({
            ...payload,
            createdAt: payload.createdAt || nowIso,
            updatedAt: nowIso
        });
        return docRef.id;
    } catch (e) {
        console.error('addCoupon error:', e);
        throw e;
    }
}

async function updateCoupon(id, data) {
    try {
        // WHY: update coupons directly in Firestore.
        const db = getFirebaseDB();
        const docId = String(id || '').trim();
        if (!docId) throw new Error('coupon id is required');
        const payload = data && typeof data === 'object' ? data : {};
        await db.collection('coupons').doc(docId).set({
            ...payload,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.error('updateCoupon error:', e);
        throw e;
    }
}

async function deleteCoupon(id) {
    try {
        // WHY: delete coupons directly from Firestore.
        const db = getFirebaseDB();
        const docId = String(id || '').trim();
        if (!docId) throw new Error('coupon id is required');
        await db.collection('coupons').doc(docId).delete();
    } catch (e) {
        console.error('deleteCoupon error:', e);
        throw e;
    }
}

// ==========================================
// BANNERS
// ==========================================
async function getBanners() {
    try {
        // WHY: Backend API removed (Firebase Spark plan - no Cloud Functions).
        const db = getFirebaseDB();
        const snapshot = await db.collection('banners').get();
        const banners = snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                icon: data.icon || '🛍️',
                title: data.title || '',
                text: data.text || '',
                btn: data.btn || 'تسوق الآن',
                category: data.category || 'all'
            };
        });
        return banners;
    } catch (e) {
        console.error('getBanners error:', e);
        return [];
    }
}

async function addBanner(banner) {
    try {
        // WHY: write banners directly to Firestore to avoid backend dependency.
        const db = getFirebaseDB();
        const payload = banner && typeof banner === 'object' ? banner : {};
        const nowIso = new Date().toISOString();
        const docRef = await db.collection('banners').add({
            ...payload,
            createdAt: payload.createdAt || nowIso,
            updatedAt: nowIso
        });
        return docRef.id;
    } catch (e) {
        console.error('addBanner error:', e);
        throw e;
    }
}

async function updateBanner(id, data) {
    try {
        // WHY: update banners directly in Firestore.
        const db = getFirebaseDB();
        const docId = String(id || '').trim();
        if (!docId) throw new Error('banner id is required');
        const payload = data && typeof data === 'object' ? data : {};
        await db.collection('banners').doc(docId).set({
            ...payload,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.error('updateBanner error:', e);
        throw e;
    }
}

async function deleteBanner(id) {
    try {
        // WHY: delete banners directly from Firestore.
        const db = getFirebaseDB();
        const docId = String(id || '').trim();
        if (!docId) throw new Error('banner id is required');
        await db.collection('banners').doc(docId).delete();
    } catch (e) {
        console.error('deleteBanner error:', e);
        throw e;
    }
}

// ==========================================
// PRODUCTS
// ==========================================
function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number(fallback) || 0;
}

function roundMoney(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function resolveProductDisplayPrice(product) {
    const source = product && typeof product === 'object' ? product : {};
    const sellPrice = Number(source.sellPrice);
    if (Number.isFinite(sellPrice) && sellPrice >= 0) return roundMoney(sellPrice);

    const basePrice = Number(source.price);
    if (Number.isFinite(basePrice) && basePrice >= 0) return roundMoney(basePrice);

    return null;
}

function resolveComparableProductPrice(product) {
    const price = resolveProductDisplayPrice(product);
    return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[\u064b-\u065f]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/[ة]/g, 'ه')
        .replace(/[ى]/g, 'ي')
        .replace(/[^a-z0-9\u0621-\u064a\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeSearchText(value) {
    return normalizeSearchText(value)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
}

function buildProductSearchTokens(product) {
    const source = product && typeof product === 'object' ? product : {};
    const tokenSet = new Set();
    const addTokens = (value) => tokenizeSearchText(value).forEach((token) => tokenSet.add(token));

    addTokens(source.name);
    addTokens(source.desc);
    addTokens(source.code);
    addTokens(source.category);
    addTokens(source.supplierName);
    addTokens(source.supplierCode);

    return Array.from(tokenSet).slice(0, 120);
}

function normalizePricingFields(input) {
    const source = input && typeof input === 'object' ? input : {};
    const priceFallback = toFiniteNumber(source.price, 0);
    const costRaw = toFiniteNumber(source.costPrice, priceFallback);
    const costPrice = roundMoney(Math.max(0, costRaw));

    const marginRaw = toFiniteNumber(source.marginPercent, 0);
    const marginPercent = roundMoney(Math.max(0, Math.min(1000, marginRaw)));
    const manualPriceOverride = source.manualPriceOverride === true;

    const autoSellPrice = roundMoney(costPrice * (1 + (marginPercent / 100)));
    const requestedSellPrice = roundMoney(Math.max(0, toFiniteNumber(source.sellPrice, autoSellPrice)));
    const sellPrice = manualPriceOverride ? requestedSellPrice : autoSellPrice;
    const profitValue = roundMoney(sellPrice - costPrice);
    const profitMarginActual = sellPrice > 0 ? roundMoney((profitValue / sellPrice) * 100) : 0;
    return {
        costPrice,
        marginPercent,
        sellPrice,
        price: sellPrice,
        profitValue,
        profitMarginActual,
        manualPriceOverride,
        manualPriceReason: String(source.manualPriceReason || '').trim().slice(0, 300)
    };
}

function cleanImageField(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';
    if (rawValue.startsWith('data:')) return rawValue;
    if (rawValue.startsWith('./') || rawValue.startsWith('assets/')) return rawValue;
    if (/^https?:\/\//i.test(rawValue)) return rawValue;
    let cleaned = rawValue
        .replace(/^\/+/, '')
        .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
    cleaned = cleaned
        .replace(/%/g, '_pct_')
        .replace(/\+/g, '_plus_')
        .replace(/\s+/g, '_')
        .replace(/[^\w\-_.]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return cleaned;
}

let feedRegenerationTimer = null;
let pendingFeedProducts = null;
const FEED_REGEN_DEBOUNCE_MS = 3000;
const CATALOG_VERSION_DEBOUNCE_MS = FEED_REGEN_DEBOUNCE_MS;
const STORE_SETTINGS_COLLECTION = 'settings';
const STORE_SETTINGS_DOC_ID = 'store';
const CATALOG_VERSION_FIELD = 'catalogVersion';
const CATALOG_CACHE_FEATURE_FLAG_FIELD = 'featureFlags.catalogCacheEnabled';
let catalogVersionTimer = null;
let pendingCatalogVersion = '';

function clearPendingFeedRegeneration() {
    if (feedRegenerationTimer) {
        clearTimeout(feedRegenerationTimer);
        feedRegenerationTimer = null;
    }
    pendingFeedProducts = null;
}

async function runFeedRegeneration(products = null) {
    if (typeof window === 'undefined') return false;
    try {
        if (typeof window.regenerateFeed === 'function') {
            await window.regenerateFeed(Array.isArray(products) ? products : null);
            return true;
        }
        if (typeof window.triggerFeedRegeneration === 'function') {
            await window.triggerFeedRegeneration(Array.isArray(products) ? products : null);
            return true;
        }
    } catch (_) {
        // WHY: product persistence must not fail because feed caching failed.
    }
    return false;
}

function buildCatalogVersionToken() {
    return new Date().toISOString();
}

function clearPendingCatalogVersionUpdate() {
    if (catalogVersionTimer) {
        clearTimeout(catalogVersionTimer);
        catalogVersionTimer = null;
    }
    pendingCatalogVersion = '';
}

async function writeCatalogVersionToSettings(versionToken = '') {
    try {
        const db = getFirebaseDB();
        const nextVersion = String(versionToken || buildCatalogVersionToken()).trim() || buildCatalogVersionToken();
        await db.collection(STORE_SETTINGS_COLLECTION).doc(STORE_SETTINGS_DOC_ID).set({
            [CATALOG_VERSION_FIELD]: nextVersion
        }, {
            mergeFields: [CATALOG_VERSION_FIELD]
        });
        return nextVersion;
    } catch (error) {
        console.warn('[CatalogVersion] Failed to persist settings marker:', error && error.message ? error.message : error);
        return '';
    }
}

function queueCatalogVersionUpdate(versionToken = '') {
    pendingCatalogVersion = String(versionToken || pendingCatalogVersion || buildCatalogVersionToken()).trim() || buildCatalogVersionToken();
    if (catalogVersionTimer) clearTimeout(catalogVersionTimer);
    catalogVersionTimer = setTimeout(() => {
        const queuedVersion = String(pendingCatalogVersion || buildCatalogVersionToken()).trim() || buildCatalogVersionToken();
        catalogVersionTimer = null;
        pendingCatalogVersion = '';
        writeCatalogVersionToSettings(queuedVersion).catch(() => '');
    }, CATALOG_VERSION_DEBOUNCE_MS);
    return true;
}

async function flushCatalogVersionUpdate(versionToken = '') {
    clearPendingCatalogVersionUpdate();
    const committed = await writeCatalogVersionToSettings(versionToken);
    return Boolean(committed);
}

async function triggerFeedRegenerationAfterProductChange(options = {}) {
    const settings = options && typeof options === 'object' ? options : {};
    if (typeof window === 'undefined') return false;
    if (settings.cancelPending === true) {
        clearPendingFeedRegeneration();
        clearPendingCatalogVersionUpdate();
        return false;
    }
    // WHY: existing bulk callers already pass suppressFeedRegen on inner item writes.
    // Treat those writes as "suppress catalogVersion too" unless the caller explicitly opts out.
    const suppressCatalogVersion = settings.suppressCatalogVersion === true
        || (settings.suppressFeedRegen === true && settings.suppressCatalogVersion !== false);
    const suppressFeedRegen = settings.suppressFeedRegen === true;

    const explicitProducts = Array.isArray(settings.products) ? settings.products : null;
    const explicitCatalogVersion = String(settings.catalogVersion || '').trim();

    if (settings.immediate === true) {
        clearPendingFeedRegeneration();
        const [catalogUpdated, feedUpdated] = await Promise.all([
            suppressCatalogVersion ? Promise.resolve(false) : flushCatalogVersionUpdate(explicitCatalogVersion),
            suppressFeedRegen ? Promise.resolve(false) : runFeedRegeneration(explicitProducts)
        ]);
        return catalogUpdated || feedUpdated;
    }

    let scheduled = false;
    if (!suppressCatalogVersion) {
        scheduled = queueCatalogVersionUpdate(explicitCatalogVersion) || scheduled;
    }
    if (suppressFeedRegen) return scheduled;

    if (explicitProducts) {
        pendingFeedProducts = explicitProducts;
    }

    if (feedRegenerationTimer) clearTimeout(feedRegenerationTimer);
    feedRegenerationTimer = setTimeout(() => {
        const queuedProducts = Array.isArray(pendingFeedProducts) ? pendingFeedProducts : null;
        feedRegenerationTimer = null;
        pendingFeedProducts = null;
        runFeedRegeneration(queuedProducts).catch(() => false);
    }, FEED_REGEN_DEBOUNCE_MS);
    return true;
}

function normalizeProductPayloadForWrite(product, options = {}) {
    const input = product && typeof product === 'object' ? product : {};
    const nowIso = new Date().toISOString();
    const defaults = options.defaults && typeof options.defaults === 'object' ? options.defaults : {};

    const hasIsPublished = Object.prototype.hasOwnProperty.call(input, 'isPublished');
    const isPublished = hasIsPublished ? input.isPublished !== false : (defaults.isPublished !== false);
    const visibilityState = isPublished ? 'published' : 'hidden';

    const pricing = normalizePricingFields({
        price: input.price,
        costPrice: Object.prototype.hasOwnProperty.call(input, 'costPrice') ? input.costPrice : defaults.costPrice,
        marginPercent: Object.prototype.hasOwnProperty.call(input, 'marginPercent') ? input.marginPercent : defaults.marginPercent,
        sellPrice: Object.prototype.hasOwnProperty.call(input, 'sellPrice') ? input.sellPrice : defaults.sellPrice,
        manualPriceOverride: Object.prototype.hasOwnProperty.call(input, 'manualPriceOverride') ? input.manualPriceOverride : defaults.manualPriceOverride,
        manualPriceReason: Object.prototype.hasOwnProperty.call(input, 'manualPriceReason') ? input.manualPriceReason : defaults.manualPriceReason
    });

    const mergedForTokens = { ...defaults, ...input, ...pricing };
    const searchTokens = Array.isArray(input.searchTokens) && input.searchTokens.length
        ? input.searchTokens.map((token) => normalizeSearchText(token)).filter(Boolean).slice(0, 120)
        : buildProductSearchTokens(mergedForTokens);
    const cleanedImage = cleanImageField(Object.prototype.hasOwnProperty.call(input, 'image') ? input.image : defaults.image);
    const cleanedImageUrl = cleanImageField(Object.prototype.hasOwnProperty.call(input, 'imageUrl') ? input.imageUrl : (defaults.imageUrl || cleanedImage));

    return {
        ...input,
        supplierId: String(input.supplierId || defaults.supplierId || ''),
        supplierName: String(input.supplierName || defaults.supplierName || ''),
        supplierCode: String(input.supplierCode || defaults.supplierCode || ''),
        image: cleanedImage || cleanedImageUrl || '',
        imageUrl: cleanedImageUrl || cleanedImage || '',
        ...pricing,
        isPublished,
        visibilityState,
        importBatchId: input.importBatchId || defaults.importBatchId || '',
        importSource: input.importSource || defaults.importSource || '',
        searchTokens,
        createdAt: input.createdAt || defaults.createdAt || nowIso,
        updatedAt: nowIso
    };
}

async function getAllProducts() {
    try {
        // WHY: always use Firestore directly for admin products.
        const db = getFirebaseDB();
        const snapshot = await db.collection('products').get();
        const products = snapshot.docs.map(mapProductFromSnapshot);
        return products;
    } catch (e) {
        console.error('getAllProducts error:', e);
        return [];
    }
}

function mapProductFromSnapshot(doc) {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name || '',
        desc: data.desc || '',
        category: data.category || '',
        price: Number.isFinite(Number(data.price)) ? Number(data.price) : 0,
        oldPrice: data.oldPrice || null,
        image: cleanImageField(data.image || data.imageUrl || ''),
        imageUrl: cleanImageField(data.imageUrl || data.image || ''),
        rating: data.rating || 4.5,
        ratingCount: data.ratingCount || 0,
        code: data.code || '',
        stock: Number.isFinite(Number(data.stock)) ? Number(data.stock) : -1,
        trackInventory: data.trackInventory === true,
        supplierId: data.supplierId || '',
        supplierName: data.supplierName || '',
        supplierCode: data.supplierCode || '',
        costPrice: Number.isFinite(Number(data.costPrice)) ? Number(data.costPrice) : Number(data.price || 0),
        marginPercent: Number.isFinite(Number(data.marginPercent)) ? Number(data.marginPercent) : 0,
        sellPrice: Number.isFinite(Number(data.sellPrice)) ? Number(data.sellPrice) : Number(data.price || 0),
        profitValue: Number.isFinite(Number(data.profitValue)) ? Number(data.profitValue) : 0,
        profitMarginActual: Number.isFinite(Number(data.profitMarginActual)) ? Number(data.profitMarginActual) : 0,
        manualPriceOverride: data.manualPriceOverride === true,
        manualPriceReason: String(data.manualPriceReason || ''),
        searchTokens: Array.isArray(data.searchTokens) ? data.searchTokens : buildProductSearchTokens(data),
        isPublished: data.isPublished !== false,
        visibilityState: data.visibilityState || (data.isPublished === false ? 'hidden' : 'published'),
        importBatchId: data.importBatchId || '',
        importSource: data.importSource || '',
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || ''
    };
}

function isTrackedInventoryProduct(item) {
    return !!(item && typeof item === 'object' && item.trackInventory === true);
}

function getTrackedInventoryStockValue(item) {
    if (!isTrackedInventoryProduct(item)) return null;
    const stockValue = Number(item && item.stock);
    if (!Number.isFinite(stockValue)) return 0;
    return Math.max(0, stockValue);
}

async function getPublishedProducts() {
    try {
        // WHY: always read published products from Firestore.
        const db = getFirebaseDB();
        const snapshot = await db.collection('products')
            .where('isPublished', '==', true)
            .get();
        return snapshot.docs.map(mapProductFromSnapshot);
    } catch (e) {
        console.error('getPublishedProducts error:', e);
        return [];
    }
}

async function addProduct(product, options = {}) {
    try {
        const payload = normalizeProductPayloadForWrite(product, { defaults: { isPublished: true } });
        // WHY: create products directly in Firestore to remove backend dependency.
        const db = getFirebaseDB();
        const docRef = await db.collection('products').add(payload);
        await triggerFeedRegenerationAfterProductChange(options);
        return docRef.id;
    } catch (e) {
        console.error('addProduct error:', e);
        throw e;
    }
}

async function updateProduct(id, data, options = {}) {
    try {
        const payload = data && typeof data === 'object' ? data : {};
        const normalizedPayload = normalizeProductPayloadForWrite(payload, {
            defaults: { isPublished: true }
        });
        // WHY: update products directly in Firestore.
        const db = getFirebaseDB();
        const docId = String(id || '').trim();
        if (!docId) throw new Error('product id is required');
        await db.collection('products').doc(docId).set(normalizedPayload, { merge: true });
        await triggerFeedRegenerationAfterProductChange(options);
    } catch (e) {
        console.error('updateProduct error:', e);
        throw e;
    }
}

async function addProductsBatch(productsArray, options = {}) {
    try {
        const items = Array.isArray(productsArray) ? productsArray : [];
        if (items.length === 0) return [];
        const shouldRegenerateFeed = options.suppressFeedRegen !== true;

        const chunkSize = Math.max(1, Math.min(200, Number(options.chunkSize) || 100));
        const defaults = {
            isPublished: options.isPublished !== false ? true : false,
            importBatchId: String(options.importBatchId || ''),
            importSource: String(options.importSource || '')
        };

        const createdIds = [];
        if (shouldRegenerateFeed) {
            await triggerFeedRegenerationAfterProductChange({ cancelPending: true });
        }

        for (let offset = 0; offset < items.length; offset += chunkSize) {
            const chunk = items.slice(offset, offset + chunkSize);
            for (const item of chunk) {
                const payload = normalizeProductPayloadForWrite(item, { defaults });
                const createdId = await addProduct(payload, { suppressFeedRegen: true });
                if (createdId) createdIds.push(String(createdId));
            }
        }

        if (shouldRegenerateFeed) {
            await triggerFeedRegenerationAfterProductChange({ immediate: true });
        }
        return createdIds;
    } catch (e) {
        console.error('addProductsBatch error:', e);
        throw e;
    }
}

async function updateProductVisibility(id, isPublished) {
    try {
        const published = isPublished !== false;
        await updateProduct(String(id || ''), {
            isPublished: published,
            visibilityState: published ? 'published' : 'hidden'
        });
    } catch (e) {
        console.error('updateProductVisibility error:', e);
        throw e;
    }
}

async function updateProductsVisibilityBatch(ids, isPublished, options = {}) {
    try {
        const list = Array.isArray(ids) ? ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (list.length === 0) return 0;
        const shouldRegenerateFeed = options.suppressFeedRegen !== true;

        const published = isPublished !== false;
        const chunkSize = Math.max(1, Math.min(200, Number(options.chunkSize) || 100));
        let updatedCount = 0;

        if (shouldRegenerateFeed) {
            await triggerFeedRegenerationAfterProductChange({ cancelPending: true });
        }

        for (let offset = 0; offset < list.length; offset += chunkSize) {
            const chunk = list.slice(offset, offset + chunkSize);
            for (const productId of chunk) {
                await updateProduct(String(productId), {
                    isPublished: published,
                    visibilityState: published ? 'published' : 'hidden'
                }, { suppressFeedRegen: true });
                updatedCount += 1;
            }
        }

        if (shouldRegenerateFeed) {
            await triggerFeedRegenerationAfterProductChange({ immediate: true });
        }
        return updatedCount;
    } catch (e) {
        console.error('updateProductsVisibilityBatch error:', e);
        throw e;
    }
}

async function deleteProductsBatch(ids, options = {}) {
    try {
        const list = Array.isArray(ids) ? ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (list.length === 0) return 0;
        const shouldRegenerateFeed = options.suppressFeedRegen !== true;

        const chunkSize = Math.max(1, Math.min(200, Number(options.chunkSize) || 100));
        let deletedCount = 0;

        if (shouldRegenerateFeed) {
            await triggerFeedRegenerationAfterProductChange({ cancelPending: true });
        }

        for (let offset = 0; offset < list.length; offset += chunkSize) {
            const chunk = list.slice(offset, offset + chunkSize);
            for (const productId of chunk) {
                await deleteProductFromFirebase(productId, { suppressFeedRegen: true });
                deletedCount += 1;
            }
        }

        if (shouldRegenerateFeed) {
            await triggerFeedRegenerationAfterProductChange({ immediate: true });
        }
        return deletedCount;
    } catch (e) {
        console.error('deleteProductsBatch error:', e);
        throw e;
    }
}

async function deleteProductFromFirebase(id, options = {}) {
    try {
        // WHY: delete products directly from Firestore.
        const db = getFirebaseDB();
        const docId = String(id || '').trim();
        if (!docId) throw new Error('product id is required');
        await db.collection('products').doc(docId).delete();
        await triggerFeedRegenerationAfterProductChange(options);
    } catch (e) {
        console.error('deleteProduct error:', e);
        throw e;
    }
}

async function deleteProductImage(productId, options = {}) {
    try {
        // WHY: Cloudinary asset deletion requires backend signing, which is unavailable on Spark.
        // Remove image references from Firestore so the UI stops rendering the broken CDN asset.
        const db = getFirebaseDB();
        const docId = String(productId || '').trim();
        if (!docId) throw new Error('product id is required');
        await db.collection('products').doc(docId).set({
            image: null,
            imageUrl: null,
            imagePublicId: null,
            public_id: null,
            images: [],
            updatedAt: new Date().toISOString()
        }, { merge: true });
        await triggerFeedRegenerationAfterProductChange(options);
        return { success: true };
    } catch (e) {
        console.error('deleteProductImage error:', e);
        return { success: false, error: e && e.message ? e.message : String(e) };
    }
}

// ==========================================
// ORDERS
// ==========================================
const ORDER_QUEUE_STORAGE_KEY = 'sale_zone_order_queue';
const ORDER_QUEUE_SCHEMA_VERSION = '2026.02.15.01';
let orderQueueFlushInFlight = false;
let orderQueueAutoSyncStarted = false;
let orderQueueRetryTimer = null;

function buildDeterministicHash(value) {
    const input = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildOrderIdempotencyKey(order = {}) {
    const source = order && typeof order === 'object' ? order : {};
    const explicit = String(source.idempotencyKey || '').trim();
    if (explicit) return explicit;

    const items = Array.isArray(source.items) ? source.items : [];
    const fingerprint = items
        .map((item) => `${String(item && item.id || item && item.name || '')}:${Number(item && item.quantity || 0)}:${Number(item && item.price || 0)}`)
        .join('|');
    const nowBucket = Math.floor(Date.now() / 1000);
    const raw = [
        String(source.orderNumber || ''),
        String(source.uid || ''),
        String(source.customer && source.customer.phone || ''),
        Number(source.total || 0).toFixed(2),
        fingerprint,
        String(nowBucket)
    ].join('||');
    return `ok_${buildDeterministicHash(raw)}_${buildDeterministicHash(raw + ':v2')}`;
}

function normalizeOrderDocId(idempotencyKey = '') {
    const normalized = String(idempotencyKey || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 120);
    return normalized ? `ord_${normalized}` : `ord_${Date.now()}`;
}

function readOrderQueueLocal() {
    try {
        const raw = localStorage.getItem(ORDER_QUEUE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item) => item && typeof item === 'object' && item.schemaVersion === ORDER_QUEUE_SCHEMA_VERSION);
    } catch (_) {
        return [];
    }
}

function writeOrderQueueLocal(queue = []) {
    try {
        const safeQueue = Array.isArray(queue) ? queue : [];
        if (safeQueue.length === 0) {
            localStorage.removeItem(ORDER_QUEUE_STORAGE_KEY);
            return;
        }
        localStorage.setItem(ORDER_QUEUE_STORAGE_KEY, JSON.stringify(safeQueue));
    } catch (_) {}
}

function normalizeOrderPayloadForWrite(order = {}, options = {}) {
    const source = order && typeof order === 'object' ? order : {};
    const auth = getFirebaseAuth();
    const user = auth && auth.currentUser ? auth.currentUser : null;
    const authUid = String(user && user.uid || '').trim();
    const nowIso = new Date().toISOString();
    const suppliedUid = String(source.uid || source.userId || '').trim();
    if (!authUid) {
        const authError = new Error('User is not authenticated.');
        authError.code = 'auth/not-authenticated';
        throw authError;
    }
    if (suppliedUid && suppliedUid !== authUid) {
        try {
            console.warn('[WARN] ORDER_UID_MISMATCH: overriding payload uid with auth uid.', {
                suppliedUid,
                authUid,
                orderNumber: String(source.orderNumber || '')
            });
        } catch (_) {}
    }
    const normalizedUid = authUid;
    const normalizedEmail = String(source.email || (user && user.email) || '').trim().toLowerCase();
    const idempotencyKey = buildOrderIdempotencyKey({ ...source, uid: normalizedUid });
    const orderDocId = normalizeOrderDocId(idempotencyKey);

    return {
        ...source,
        id: String(source.id || orderDocId),
        uid: normalizedUid,
        email: normalizedEmail,
        idempotencyKey,
        version: Number(source.version) > 0 ? Number(source.version) : 1,
        source: String(source.source || options.source || 'store-web').trim() || 'store-web',
        createdAt: String(source.createdAt || nowIso),
        updatedAt: nowIso,
        status: String(source.status || 'pending'),
        statusHistory: Array.isArray(source.statusHistory) ? source.statusHistory : [
            { status: String(source.status || 'pending'), date: nowIso, note: 'تم استلام الطلب' }
        ]
    };
}

function enqueueOrderLocally(orderPayload, reason = 'offline') {
    const queue = readOrderQueueLocal();
    const existingIndex = queue.findIndex((entry) => String(entry.idempotencyKey || '') === String(orderPayload.idempotencyKey || ''));
    const queueItem = {
        queueId: existingIndex >= 0 ? queue[existingIndex].queueId : `oq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        schemaVersion: ORDER_QUEUE_SCHEMA_VERSION,
        idempotencyKey: String(orderPayload.idempotencyKey || ''),
        payload: orderPayload,
        status: 'queued',
        retryCount: existingIndex >= 0 ? Number(queue[existingIndex].retryCount || 0) : 0,
        reason: String(reason || 'offline'),
        queuedAt: existingIndex >= 0 ? String(queue[existingIndex].queuedAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        queue[existingIndex] = queueItem;
    } else {
        queue.push(queueItem);
    }

    writeOrderQueueLocal(queue);
    return queueItem;
}

async function appendOrderEvent(dbRef, eventType, orderPayload = {}, meta = {}) {
    // Trust boundary: order lifecycle events are backend-owned.
    if (shouldUseBackendApi()) return null;
    const type = String(eventType || '').trim().toUpperCase();
    if (!type) return null;

    const eventDoc = {
        type,
        orderId: String(orderPayload.id || ''),
        uid: String(orderPayload.uid || ''),
        idempotencyKey: String(orderPayload.idempotencyKey || ''),
        payload: meta && typeof meta.payload === 'object' ? meta.payload : {},
        source: String(meta && meta.source || orderPayload.source || 'store-web'),
        createdAt: new Date().toISOString(),
        actorUid: String(meta && meta.actorUid || orderPayload.uid || '')
    };

    return dbRef.collection('order_events').add(eventDoc);
}

async function appendAuditLog(dbRef, action, payload = {}) {
    // Trust boundary: audit logs are backend-owned.
    if (shouldUseBackendApi()) return null;
    const auth = getFirebaseAuth();
    const user = auth && auth.currentUser ? auth.currentUser : null;
    const row = {
        action: String(action || 'UNKNOWN_ACTION'),
        uid: String((payload && payload.uid) || (user && user.uid) || ''),
        targetId: String(payload && payload.targetId || ''),
        scope: String(payload && payload.scope || 'orders'),
        details: payload && payload.details && typeof payload.details === 'object' ? payload.details : {},
        createdAt: new Date().toISOString()
    };
    return dbRef.collection('audit_logs').add(row);
}

async function upsertOrderQueueDocument(dbRef, queueItem, status = 'queued', details = {}) {
    // Trust boundary: queue telemetry is backend-owned.
    if (shouldUseBackendApi()) return false;
    const queueId = String(queueItem && queueItem.queueId || '');
    if (!queueId) return false;

    const payload = {
        queueId,
        uid: String(queueItem && queueItem.payload && queueItem.payload.uid || ''),
        idempotencyKey: String(queueItem && queueItem.idempotencyKey || ''),
        status: String(status || 'queued'),
        retryCount: Number(queueItem && queueItem.retryCount || 0),
        source: String(queueItem && queueItem.payload && queueItem.payload.source || 'store-web'),
        queuedAt: String(queueItem && queueItem.queuedAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(),
        lastError: String(details && details.lastError || '')
    };

    await dbRef.collection('order_queue').doc(queueId).set(payload, { merge: true });
    return true;
}

async function persistOrderOnline(dbRef, orderPayload, meta = {}) {
    // WHY: Spark plan has no backend API, so order persistence must be Firestore-direct.
    const fireDB = dbRef || getFirebaseDB();
    const payload = orderPayload && typeof orderPayload === 'object' ? { ...orderPayload } : {};
    const nowIso = new Date().toISOString();
    const idempotencyKey = String(payload.idempotencyKey || '').trim();

    if (idempotencyKey) {
        const existingSnapshot = await fireDB
            .collection('orders')
            // Scope duplicate checks to the signed-in customer so the query satisfies order read rules.
            .where('uid', '==', String(payload.uid || '').trim())
            .where('idempotencyKey', '==', idempotencyKey)
            .limit(1)
            .get();
        if (!existingSnapshot.empty) {
            const existingDoc = existingSnapshot.docs[0];
            const existingData = existingDoc.data() || {};
            return {
                id: String(existingDoc.id || ''),
                status: String(existingData.status || 'saved'),
                duplicate: true,
                queued: false
            };
        }
    }

    const orderId = String(payload.id || normalizeOrderDocId(idempotencyKey)).trim();
    payload.id = orderId;
    payload.syncState = String(meta && meta.syncState || payload.syncState || 'synced');
    payload.updatedAt = nowIso;
    payload.createdAt = String(payload.createdAt || nowIso);

    await fireDB.collection('orders').doc(orderId).set(payload, { merge: true });
    await appendOrderEvent(fireDB, 'ORDER_CREATED', payload, {
        source: String(meta && meta.source || payload.source || 'store-web'),
        payload: { syncState: payload.syncState }
    });
    await appendAuditLog(fireDB, 'ORDER_CREATED', {
        targetId: orderId,
        scope: 'orders',
        uid: String(payload.uid || ''),
        details: { syncState: payload.syncState }
    });
    await createCustomerOrderNotifications(payload, {
        createdByRole: 'customer',
        source: 'order:create',
        pointsSource: 'order:points'
    }).catch((notificationError) => {
        console.warn('persistOrderOnline notification warning:', notificationError && notificationError.message ? notificationError.message : notificationError);
    });

    return {
        id: orderId,
        status: String(payload.status || 'saved'),
        duplicate: false,
        queued: false
    };
}

async function flushOrderQueue(options = {}) {
    if (orderQueueFlushInFlight) return { flushed: 0, pending: readOrderQueueLocal().length };
    // WHY: queue flush must run with Firestore direct writes even when backend API is disabled.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return { flushed: 0, pending: readOrderQueueLocal().length };
    }

    const source = String(options.source || 'manual');
    const maxItems = Math.max(1, Math.min(50, Number(options.maxItems || 20)));
    const dbRef = getFirebaseDB();
    let queue = readOrderQueueLocal();
    if (!queue.length) return { flushed: 0, pending: 0 };

    orderQueueFlushInFlight = true;
    let flushed = 0;

    try {
        for (const item of queue.slice(0, maxItems)) {
            try {
                const result = await persistOrderOnline(dbRef, item.payload, { source: `queue:${source}`, syncState: 'synced' });
                await upsertOrderQueueDocument(dbRef, item, 'processed');
                queue = queue.filter((entry) => String(entry.queueId) !== String(item.queueId));
                writeOrderQueueLocal(queue);
                flushed += 1;

                await appendOrderEvent(dbRef, 'ORDER_SYNCED_FROM_QUEUE', {
                    ...item.payload,
                    id: String(result.id || item.payload.id || '')
                }, {
                    source: `queue:${source}`,
                    payload: { queueId: item.queueId, result: result.status || 'saved' }
                });
            } catch (error) {
                item.retryCount = Number(item.retryCount || 0) + 1;
                item.updatedAt = new Date().toISOString();
                item.lastError = error && error.message ? String(error.message) : String(error);
                await upsertOrderQueueDocument(dbRef, item, 'failed', { lastError: item.lastError }).catch(() => null);
            }
        }
    } finally {
        writeOrderQueueLocal(queue);
        orderQueueFlushInFlight = false;
    }

    return { flushed, pending: queue.length };
}

function setupOrderQueueAutoSync() {
    if (orderQueueAutoSyncStarted) return;
    orderQueueAutoSyncStarted = true;

    const tryFlush = (source) => {
        flushOrderQueue({ source, maxItems: 20 }).catch((error) => {
            const message = error && error.message ? error.message : String(error || '');
            if (!/permission|denied/i.test(message)) {
                console.warn(`[WARN] flushOrderQueue (${source}) failed:`, message);
            }
        });
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => tryFlush('online'));
        window.addEventListener('focus', () => {
            if (navigator.onLine !== false) tryFlush('focus');
        });
    }

    if (orderQueueRetryTimer) clearInterval(orderQueueRetryTimer);
    orderQueueRetryTimer = setInterval(() => {
        if (navigator.onLine === false) return;
        tryFlush('interval');
    }, 30000);

    if (navigator.onLine !== false) {
        setTimeout(() => tryFlush('startup'), 2000);
    }
}

async function getAllOrders() {
    try {
        console.warn('[WARN] getAllOrders() is deprecated. Use listOrdersPage() for paginated admin views.');
        const db = getFirebaseDB();
        const snapshot = await db.collection('orders').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllOrders error:', e);
        return null;
    }
}

async function listOrdersPage(options = {}) {
    // WHY: list orders from Firestore directly (server truth without backend dependency).
    const db = getFirebaseDB();
    const safeLimit = Math.max(1, Math.min(200, Number(options && options.limit) || 50));
    const cursorId = String(options && options.cursor || '').trim();
    const rawStatus = String(options && options.status || '').trim().toLowerCase();
    const statusFilter = rawStatus ? rawStatus : '';
    const dateFromIso = String(options && options.dateFromIso || '').trim();
    const dateToIso = String(options && options.dateToIso || '').trim();
    const searchText = String(options && options.searchText || '').trim().toLowerCase();
    const searchTokens = searchText ? searchText.split(/\s+/).filter(Boolean) : [];
    const hasAnyFilter = Boolean(statusFilter || dateFromIso || dateToIso || searchTokens.length);

    const applyLocalFilter = (rows = []) => {
        return rows.filter((row) => {
            const safeRow = row && typeof row === 'object' ? row : {};
            if (statusFilter && String(safeRow.status || '').toLowerCase() !== statusFilter) return false;
            const createdAt = String(safeRow.createdAt || '');
            if (dateFromIso && createdAt && createdAt < dateFromIso) return false;
            if (dateToIso && createdAt && createdAt > dateToIso) return false;
            if (!searchTokens.length) return true;
            const haystack = String([
                safeRow.orderNumber || safeRow.id || '',
                safeRow.customer && safeRow.customer.name || '',
                safeRow.customer && safeRow.customer.phone || ''
            ].join(' ')).toLowerCase();
            return searchTokens.every((token) => haystack.includes(token));
        });
    };

    const buildQuery = (limitValue) => {
        let query = db.collection('orders');
        if (statusFilter) query = query.where('status', '==', statusFilter);
        if (dateFromIso) query = query.where('createdAt', '>=', dateFromIso);
        if (dateToIso) query = query.where('createdAt', '<=', dateToIso);
        query = query.orderBy('createdAt', 'desc').limit(limitValue);
        return query;
    };

    let query = buildQuery(hasAnyFilter ? Math.max(safeLimit, 500) : (safeLimit + 1));
    let fallbackToLocalFiltering = false;
    let indexFallbackUsed = false;

    if (cursorId) {
        const cursorSnapshot = await db.collection('orders').doc(cursorId).get();
        if (cursorSnapshot.exists) {
            query = query.startAfter(cursorSnapshot);
        }
    }

    let snapshot;
    try {
        snapshot = await query.get();
    } catch (error) {
        if (!hasAnyFilter) throw error;
        indexFallbackUsed = isFirestoreIndexError(error);
        if (indexFallbackUsed) {
            console.warn('[WARN] listOrdersPage orders filter index unavailable (status + createdAt). Falling back to local filtering:', error && error.message ? error.message : error);
        } else {
            console.warn('[WARN] listOrdersPage filter query fallback to local filtering:', error && error.message ? error.message : error);
        }
        fallbackToLocalFiltering = true;
        let fallbackQuery = db.collection('orders').orderBy('createdAt', 'desc').limit(Math.max(safeLimit, 500));
        if (cursorId) {
            const fallbackCursorSnapshot = await db.collection('orders').doc(cursorId).get();
            if (fallbackCursorSnapshot.exists) {
                fallbackQuery = fallbackQuery.startAfter(fallbackCursorSnapshot);
            }
        }
        snapshot = await fallbackQuery.get();
    }

    const docs = Array.isArray(snapshot && snapshot.docs) ? snapshot.docs : [];
    const allRows = docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const filteredRows = (hasAnyFilter || fallbackToLocalFiltering) ? applyLocalFilter(allRows) : allRows;

    if (hasAnyFilter || fallbackToLocalFiltering) {
        const items = filteredRows.slice(0, safeLimit);
        return {
            items,
            hasMore: false,
            nextCursor: '',
            indexFallbackUsed,
            fallbackReason: indexFallbackUsed ? 'orders-status-createdAt-index-unavailable' : (fallbackToLocalFiltering ? 'local-filter-fallback' : '')
        };
    }

    const hasMore = filteredRows.length > safeLimit;
    const pageRows = hasMore ? filteredRows.slice(0, safeLimit) : filteredRows;
    const nextCursor = hasMore && pageRows.length ? String(pageRows[pageRows.length - 1].id) : '';

    return {
        items: pageRows,
        hasMore,
        nextCursor,
        indexFallbackUsed: false,
        fallbackReason: ''
    };
}

async function getOrdersByCustomerUid(uid = '', limitCount = 50) {
    try {
        const dbRef = getFirebaseDB();
        const normalizedUid = String(uid || '').trim();
        if (!normalizedUid) return [];
        const safeLimit = Math.max(1, Math.min(200, Number(limitCount) || 50));
        const snapshot = await dbRef
            .collection('orders')
            .where('uid', '==', normalizedUid)
            .limit(safeLimit)
            .get();
        const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        rows.sort((a, b) => {
            const aTime = Date.parse(String(a && a.createdAt || '')) || 0;
            const bTime = Date.parse(String(b && b.createdAt || '')) || 0;
            return bTime - aTime;
        });
        return rows;
    } catch (error) {
        console.error('getOrdersByCustomerUid error:', error);
        return [];
    }
}

async function addOrder(order, options = {}) {
    try {
        const dbRef = getFirebaseDB();
        const normalizedOrder = normalizeOrderPayloadForWrite(order, options);
        const allowQueue = options && options.allowQueue !== false;
        const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

        if (isOffline && allowQueue) {
            const queueItem = enqueueOrderLocally(normalizedOrder, 'offline');
            await upsertOrderQueueDocument(dbRef, queueItem, 'queued').catch(() => null);
            return {
                id: queueItem.queueId,
                queueId: queueItem.queueId,
                idempotencyKey: queueItem.idempotencyKey,
                status: 'queued',
                queued: true
            };
        }

        try {
            const result = await persistOrderOnline(dbRef, normalizedOrder, { source: 'direct-create', syncState: 'synced' });
            return result;
        } catch (error) {
            if (allowQueue && isTransientTransportError(error)) {
                const queueItem = enqueueOrderLocally(normalizedOrder, 'transient-failure');
                await upsertOrderQueueDocument(dbRef, queueItem, 'queued', {
                    lastError: error && error.message ? String(error.message) : String(error)
                }).catch(() => null);

                return {
                    id: queueItem.queueId,
                    queueId: queueItem.queueId,
                    idempotencyKey: queueItem.idempotencyKey,
                    status: 'queued',
                    queued: true
                };
            }
            throw error;
        }
    } catch (e) {
        console.error('addOrder error:', e);
        throw e;
    }
}

async function ensureAdminSessionForOrderWrite() {
    const auth = getFirebaseAuth();
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) {
        const notAuthError = new Error('User is not authenticated.');
        notAuthError.code = 'auth/not-authenticated';
        throw notAuthError;
    }
    if (typeof user.reload === 'function') {
        await user.reload().catch(() => null);
    }
    if (typeof user.getIdToken === 'function') {
        await user.getIdToken(true).catch(() => null);
    }
    const tokenResult = typeof user.getIdTokenResult === 'function'
        ? await user.getIdTokenResult(true).catch(() => null)
        : null;
    if (user.emailVerified !== true) {
        const verifyError = new Error('Please verify your email first.');
        verifyError.code = 'auth/email-not-verified';
        throw verifyError;
    }
    const isAdmin = Boolean(tokenResult && tokenResult.claims && (
        tokenResult.claims.admin === true || tokenResult.claims.role === 'admin'
    ));
    if (!isAdmin) {
        const adminError = new Error('Admin claim is missing or stale.');
        adminError.code = 'auth/not-admin';
        throw adminError;
    }
    return { user, tokenResult };
}

async function updateOrderStatus(id, status) {
    try {
        const orderId = String(id || '').trim();
        const nextStatus = String(status || '').trim().toLowerCase();
        if (!orderId || !nextStatus) throw new Error('order id and status are required');
        await ensureAdminSessionForOrderWrite();
        // WHY: update order status directly in Firestore to remove backend dependency.
        const dbRef = getFirebaseDB();
        const docRef = dbRef.collection('orders').doc(orderId);
        const snapshot = await docRef.get();
        if (!snapshot.exists) throw new Error('order not found');
        const current = snapshot.data() || {};
        const nowIso = new Date().toISOString();
        const currentVersion = Number(current.version || 0);
        const nextVersion = Number.isFinite(currentVersion) && currentVersion > 0 ? currentVersion + 1 : 1;
        const statusHistory = Array.isArray(current.statusHistory) ? [...current.statusHistory] : [];
        statusHistory.push({ status: nextStatus, date: nowIso, note: 'تم تحديث حالة الطلب' });

        await docRef.set({
            status: nextStatus,
            updatedAt: nowIso,
            statusHistory,
            version: nextVersion
        }, { merge: true });

        try {
            await appendOrderEvent(dbRef, 'ORDER_STATUS_UPDATED', {
                id: orderId,
                uid: String(current.uid || ''),
                idempotencyKey: String(current.idempotencyKey || ''),
                source: String(current.source || 'admin-panel')
            }, {
                source: 'admin:status-update',
                payload: { from: String(current.status || ''), to: nextStatus }
            });
        } catch (eventError) {
            console.warn('updateOrderStatus order event log warning:', eventError && eventError.message ? eventError.message : eventError);
        }
        try {
            await appendAuditLog(dbRef, 'ORDER_STATUS_UPDATED', {
                targetId: orderId,
                scope: 'orders',
                uid: String(current.uid || ''),
                details: { from: String(current.status || ''), to: nextStatus }
            });
        } catch (auditError) {
            console.warn('updateOrderStatus audit log warning:', auditError && auditError.message ? auditError.message : auditError);
        }
        await createCustomerOrderNotifications({
            ...current,
            id: orderId,
            status: nextStatus,
            updatedAt: nowIso,
            statusHistory,
            version: nextVersion
        }, {
            createdByRole: 'admin',
            source: 'order:status-update',
            includePoints: false,
            statusChange: true
        }).catch((notificationError) => {
            console.warn('updateOrderStatus notification warning:', notificationError && notificationError.message ? notificationError.message : notificationError);
        });

    } catch (e) {
        console.error('updateOrderStatus error:', e);
        throw e;
    }
}

if (typeof window !== 'undefined') {
    window.__firebaseApiUpdateOrderStatus = updateOrderStatus;
    window.__firebaseApiAddOrder = addOrder;
    window.flushOrderQueue = flushOrderQueue;
}

setupOrderQueueAutoSync();

// ==========================================
// USERS
// ==========================================
async function getAllUsers() {
    const error = new Error('getAllUsers is deprecated. Use listCustomersPage() instead.');
    error.code = 'api/deprecated-getAllUsers';
    throw error;
}

function normalizeCustomerProfilePayload(payload, defaults = {}, options = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const opts = options && typeof options === 'object' ? options : {};
    const nowIso = new Date().toISOString();
    const includeAdminFields = opts.includeAdminFields === true;

    const uid = String(opts.uid || source.uid || base.uid || '').trim();
    const email = String(opts.email || source.email || base.email || '').trim().toLowerCase();
    const role = String(base.role || source.role || 'customer').trim().toLowerCase() || 'customer';
    const parsedPoints = Number(source.loyaltyPoints);
    const basePoints = Number(base.loyaltyPoints);
    const loyaltyPoints = Number.isFinite(parsedPoints)
        ? Math.max(0, parsedPoints)
        : (Number.isFinite(basePoints) ? Math.max(0, basePoints) : 0);
    const parsedOrders = Number(source.orders);
    const baseOrders = Number(base.orders);
    const orders = Number.isFinite(parsedOrders)
        ? Math.max(0, parsedOrders)
        : (Number.isFinite(baseOrders) ? Math.max(0, baseOrders) : 0);
    const status = String(source.status || base.status || 'active').trim() || 'active';
    const displayName = String(source.displayName || base.displayName || source.name || base.name || '').trim();
    const normalizedName = displayName || String(source.name || base.name || '').trim();
    const explicitIsActive = typeof source.isActive === 'boolean'
        ? source.isActive
        : (typeof base.isActive === 'boolean' ? base.isActive : status !== 'inactive');

    const normalized = {
        uid,
        email,
        phone: String(source.phone || base.phone || '').trim(),
        address: String(source.address || base.address || '').trim(),
        displayName,
        role: role === 'admin' ? 'admin' : 'customer',
        loyaltyPoints,
        status,
        createdAt: String(base.createdAt || source.createdAt || nowIso).trim() || nowIso,
        updatedAt: nowIso
    };

    if (includeAdminFields) {
        normalized.name = normalizedName;
        normalized.points = Number.isFinite(Number(source.points)) ? Math.max(0, Number(source.points)) : (Number.isFinite(Number(base.points)) ? Math.max(0, Number(base.points)) : loyaltyPoints);
        normalized.orders = orders;
        normalized.isActive = explicitIsActive;
    }

    return normalized;
}

async function registerCustomerByEmail(payload = {}) {
    const auth = getFirebaseAuth();
    const db = getFirebaseDB();
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const phone = String(payload.phone || '').trim();
    const address = String(payload.address || '').trim();
    const displayName = String(payload.displayName || '').trim();

    if (!email) throw new Error('email is required');
    if (!password || password.length < 6) throw new Error('password must be at least 6 characters');
    if (!phone) throw new Error('phone is required');
    if (!address) throw new Error('address is required');

    const credential = await auth.createUserWithEmailAndPassword(email, password);
    const user = credential && credential.user ? credential.user : null;
    if (!user || !user.uid) throw new Error('firebase auth registration failed');

    if (displayName && typeof user.updateProfile === 'function') {
        try {
            await user.updateProfile({ displayName });
        } catch (_) {
            // Non-blocking profile update.
        }
    }

    if (typeof user.sendEmailVerification === 'function') {
        await user.sendEmailVerification();
    }

    const profile = normalizeCustomerProfilePayload(
        { phone, address, displayName, role: 'customer' },
        {},
        { uid: String(user.uid), email: String(user.email || email) }
    );

    await db.collection('customers').doc(profile.uid).set(profile, { merge: true });
    return { user, profile };
}

async function loginCustomerByEmail(email, password) {
    const auth = getFirebaseAuth();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '');
    if (!normalizedEmail) throw new Error('email is required');
    if (!normalizedPassword) throw new Error('password is required');
    return auth.signInWithEmailAndPassword(normalizedEmail, normalizedPassword);
}

async function ensureEmailVerifiedOrThrow(options = {}) {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
        const notAuthError = new Error('User is not authenticated.');
        notAuthError.code = 'auth/not-authenticated';
        throw notAuthError;
    }

    const shouldReload = !options || options.reloadUser !== false;
    if (shouldReload && typeof user.reload === 'function') {
        await user.reload();
    }
    if (typeof user.getIdToken === 'function') {
        await user.getIdToken(true).catch(() => null);
    }

    if (!user.emailVerified) {
        const verifyError = new Error('Please verify your email first.');
        verifyError.code = 'auth/email-not-verified';
        verifyError.emailVerified = false;
        throw verifyError;
    }
    return user;
}

async function getMyCustomerProfile(uid = '') {
    const db = getFirebaseDB();
    let normalizedUid = String(uid || '').trim();
    if (!normalizedUid) {
        try {
            const auth = getFirebaseAuth();
            normalizedUid = String(auth.currentUser && auth.currentUser.uid || '').trim();
        } catch (_) {}
    }
    if (!normalizedUid) return null;

    const snapshot = await db.collection('customers').doc(normalizedUid).get();
    if (!snapshot.exists) return null;
    return { id: snapshot.id, ...snapshot.data() };
}

async function upsertMyCustomerProfile(uid = '', payload = {}) {
    const auth = getFirebaseAuth();
    const db = getFirebaseDB();
    const authUid = String(auth.currentUser && auth.currentUser.uid || '').trim();
    const targetUid = String(uid || authUid).trim();
    if (!targetUid || !authUid || targetUid !== authUid) {
        const uidError = new Error('profile uid mismatch');
        uidError.code = 'auth/uid-mismatch';
        throw uidError;
    }

    const docRef = db.collection('customers').doc(targetUid);
    const existingSnapshot = await docRef.get();
    const existing = existingSnapshot.exists ? (existingSnapshot.data() || {}) : {};
    const profile = normalizeCustomerProfilePayload(
        payload,
        existing,
        { uid: targetUid, email: String(auth.currentUser && auth.currentUser.email || existing.email || '') }
    );
    await docRef.set(profile, { merge: true });
    return { id: targetUid, ...profile };
}

async function listCustomersPage(options = {}) {
    const db = getFirebaseDB();
    const safeLimit = Math.max(1, Math.min(100, Number(options && options.limit) || 20));
    const cursorId = String(options && options.cursor || '').trim();
    let query = db.collection('customers').orderBy('createdAt', 'desc').limit(safeLimit + 1);

    if (cursorId) {
        const cursorSnapshot = await db.collection('customers').doc(cursorId).get();
        if (cursorSnapshot.exists) {
            query = query.startAfter(cursorSnapshot);
        }
    }

    const snapshot = await query.get();
    const docs = snapshot.docs || [];
    const hasMore = docs.length > safeLimit;
    const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;
    const items = pageDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const nextCursor = hasMore && pageDocs.length ? String(pageDocs[pageDocs.length - 1].id) : '';

    return {
        items,
        hasMore,
        nextCursor
    };
}

function subscribeCustomersRealtime(onData, onError, options = {}) {
    try {
        const db = getFirebaseDB();
        const settings = options && typeof options === 'object' ? options : {};
        const safeLimit = Math.max(1, Math.min(100, Number(settings.limit) || 40));
        return db
            .collection('customers')
            .orderBy('createdAt', 'desc')
            .limit(safeLimit)
            .onSnapshot(
                (snapshot) => {
                    const items = (snapshot.docs || []).map((doc) => ({ id: doc.id, ...doc.data() }));
                    if (typeof onData === 'function') onData(items);
                },
                (error) => {
                    if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeCustomersRealtime.listener'));
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(normalizeFirebaseError(e, 'subscribeCustomersRealtime.setup'));
        return null;
    }
}

async function searchProductsIndexed(query, filters = {}, sort = 'default', page = 1, pageSize = 24) {
    const normalize = (value) => normalizeSearchText(value || '');
    const queryText = normalize(query);
    const safeFilters = filters && typeof filters === 'object' ? filters : {};
    const safePageSize = Math.max(1, Math.min(120, Number(pageSize) || 24));
    const safePage = Math.max(1, Number(page) || 1);

    const products = await getAllProducts();
    const list = Array.isArray(products) ? products : [];

    let rows = list.filter((item) => item && item.isPublished !== false);

    if (safeFilters.category && safeFilters.category !== 'all') {
        rows = rows.filter((item) => String(item.category || '') === String(safeFilters.category));
    }
    if (safeFilters.supplierId) {
        rows = rows.filter((item) => String(item.supplierId || '') === String(safeFilters.supplierId));
    }

    const minPrice = Number(safeFilters.minPrice);
    const maxPrice = Number(safeFilters.maxPrice);
    if (Number.isFinite(minPrice)) {
        rows = rows.filter((item) => {
            const price = resolveProductDisplayPrice(item);
            return Number.isFinite(price) && price >= minPrice;
        });
    }
    if (Number.isFinite(maxPrice)) {
        rows = rows.filter((item) => {
            const price = resolveProductDisplayPrice(item);
            return Number.isFinite(price) && price <= maxPrice;
        });
    }
    if (safeFilters.inStock === true) {
        rows = rows.filter((item) => {
            const trackedStockValue = getTrackedInventoryStockValue(item);
            return trackedStockValue === null || trackedStockValue > 0;
        });
    }

    if (queryText) {
        const queryTokens = queryText.split(' ').filter(Boolean);
        rows = rows.filter((item) => {
            const haystack = normalize([
                item.name,
                item.desc,
                item.code,
                item.category,
                item.supplierName,
                ...(Array.isArray(item.searchTokens) ? item.searchTokens : [])
            ].join(' '));
            return queryTokens.every((token) => haystack.includes(token));
        });
    }

    switch (String(sort || 'default')) {
        case 'price-low':
            rows.sort((a, b) => resolveComparableProductPrice(a) - resolveComparableProductPrice(b));
            break;
        case 'price-high':
            rows.sort((a, b) => resolveComparableProductPrice(b) - resolveComparableProductPrice(a));
            break;
        case 'rating':
            rows.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
            break;
        case 'name':
            rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
            break;
        case 'updated':
            rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
            break;
        default:
            rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            break;
    }

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const currentPage = Math.min(safePage, totalPages);
    const start = (currentPage - 1) * safePageSize;

    return {
        items: rows.slice(start, start + safePageSize),
        total,
        page: currentPage,
        pageSize: safePageSize,
        totalPages
    };
}

// ==========================================
// SUPPLIERS
// ==========================================
function normalizeSupplierPayload(payload, defaults = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const nowIso = new Date().toISOString();
    return {
        name: String(source.name || base.name || '').trim(),
        code: String(source.code || base.code || '').trim().toUpperCase(),
        contactName: String(source.contactName || base.contactName || '').trim(),
        phone: String(source.phone || base.phone || '').trim(),
        email: String(source.email || base.email || '').trim(),
        address: String(source.address || base.address || '').trim(),
        notes: String(source.notes || base.notes || '').trim(),
        defaultMarginPercent: roundMoney(Math.max(0, Math.min(1000, toFiniteNumber(source.defaultMarginPercent, base.defaultMarginPercent || 0)))),
        active: source.active !== false,
        createdAt: source.createdAt || base.createdAt || nowIso,
        updatedAt: nowIso
    };
}

async function getSuppliers() {
    try {
        const db = getFirebaseDB();
        const snapshot = await db.collection('suppliers').orderBy('name', 'asc').get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getSuppliers error:', e);
        return null;
    }
}

async function addSupplier(payload) {
    try {
        const db = getFirebaseDB();
        const normalized = normalizeSupplierPayload(payload);
        const docRef = await db.collection('suppliers').add(normalized);
        return docRef.id;
    } catch (e) {
        console.error('addSupplier error:', e);
        throw e;
    }
}

async function updateSupplier(id, payload) {
    try {
        const db = getFirebaseDB();
        const ref = db.collection('suppliers').doc(String(id));
        const snapshot = await ref.get();
        const current = snapshot.exists ? (snapshot.data() || {}) : {};
        const normalized = normalizeSupplierPayload(payload, current);
        await ref.set(normalized, { merge: true });
    } catch (e) {
        console.error('updateSupplier error:', e);
        throw e;
    }
}

async function archiveSupplier(id) {
    try {
        const db = getFirebaseDB();
        await db.collection('suppliers').doc(String(id)).set({
            active: false,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.error('archiveSupplier error:', e);
        throw e;
    }
}

async function deleteSupplier(id) {
    try {
        const db = getFirebaseDB();
        await db.collection('suppliers').doc(String(id)).delete();
    } catch (e) {
        console.error('deleteSupplier error:', e);
        throw e;
    }
}

async function assignSupplierToProducts(productIds, supplierId, marginPercent = null) {
    const ids = Array.isArray(productIds) ? productIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
    if (!ids.length) return 0;

    const supplier = String(supplierId || '').trim();
    if (!supplier) throw new Error('supplierId is required');

    const products = await getAllProducts();
    const sourceRows = Array.isArray(products) ? products : [];
    let updated = 0;

    for (const id of ids) {
        const current = sourceRows.find((row) => String(row.id) === id) || { id };
        const patch = {
            supplierId: supplier
        };
        if (marginPercent !== null && marginPercent !== undefined && marginPercent !== '') {
            patch.marginPercent = roundMoney(Math.max(0, Math.min(1000, Number(marginPercent))));
        } else if (Number.isFinite(Number(current.marginPercent))) {
            patch.marginPercent = Number(current.marginPercent);
        }
        await updateProduct(id, patch);
        updated += 1;
    }

    return updated;
}

async function recalculateSupplierPrices(supplierId, mode = 'preserve_manual') {
    const supplier = String(supplierId || '').trim();
    if (!supplier) throw new Error('supplierId is required');

    const products = await getAllProducts();
    const rows = (Array.isArray(products) ? products : []).filter((row) => String(row.supplierId || '') === supplier);
    let updated = 0;

    for (const row of rows) {
        const isManual = row.manualPriceOverride === true;
        if (mode === 'preserve_manual' && isManual) continue;

        await updateProduct(String(row.id), {
            costPrice: Number.isFinite(Number(row.costPrice)) ? Number(row.costPrice) : Number(row.price || 0),
            marginPercent: Number.isFinite(Number(row.marginPercent)) ? Number(row.marginPercent) : 0,
            manualPriceOverride: mode === 'overwrite_manual' ? false : isManual
        });
        updated += 1;
    }

    return updated;
}

// Reduce noisy write retries when transport is unstable.
let telemetryWriteBackoffUntil = 0;
let telemetryBackoffLastReason = "";

function getErrorMessage(error) {
    if (!error) return "";
    if (typeof error.message === "string") return error.message;
    return String(error);
}

function isTransientTransportError(error) {
    const message = getErrorMessage(error).toLowerCase();
    return (
        message.includes("failed to fetch") ||
        message.includes("cors request did not succeed") ||
        message.includes("network request failed") ||
        message.includes("transport errored") ||
        message.includes("code=unavailable") ||
        message.includes("unavailable")
    );
}

function isAlreadyExistsWriteError(error) {
    const message = getErrorMessage(error).toLowerCase();
    const code = String((error && (error.code || error.status)) || "").toLowerCase();
    return (
        code.includes("already-exists") ||
        message.includes("document already exists") ||
        message.includes("already exists")
    );
}

function isTelemetryWriteSuspended() {
    return Date.now() < telemetryWriteBackoffUntil;
}

function suspendTelemetryWrites(reason, ms = 30000) {
    const until = Date.now() + Math.max(5000, Number(ms) || 30000);
    if (until <= telemetryWriteBackoffUntil) return;
    telemetryWriteBackoffUntil = until;
    const normalizedReason = String(reason || "transport error");
    if (normalizedReason !== telemetryBackoffLastReason) {
        telemetryBackoffLastReason = normalizedReason;
        console.warn(`[WARN] Telemetry writes paused for ${Math.round((telemetryWriteBackoffUntil - Date.now()) / 1000)}s: ${normalizedReason}`);
    }
}

function normalizePhoneForCustomer(value) {
    const raw = String(value || '').trim();
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.startsWith('20') && digits.length === 12) return `0${digits.slice(2)}`;
    return digits;
}

async function addCustomer() {
    const error = new Error('addCustomer is deprecated. Use registerCustomerByEmail() or upsertMyCustomerProfile().');
    error.code = 'api/deprecated-addCustomer';
    throw error;
}

async function updateCustomer(id, data) {
    try {
        const db = getFirebaseDB();
        const docId = String(id || '').trim();
        if (!docId) throw new Error('customer id is required');
        const snapshot = await db.collection('customers').doc(docId).get();
        const existing = snapshot.exists ? (snapshot.data() || {}) : {};
        const normalized = normalizeCustomerProfilePayload(data, existing, {
            uid: String(existing.uid || docId),
            email: String(existing.email || data && data.email || ''),
            includeAdminFields: true
        });
        await db.collection('customers').doc(docId).set(normalized, { merge: true });
    } catch (e) {
        console.error('updateCustomer error:', e);
        throw e;
    }
}

async function deleteCustomerFromFirebase(id) {
    try {
        const db = getFirebaseDB();
        await db.collection('customers').doc(String(id)).delete();
    } catch (e) {
        console.error('deleteCustomerFromFirebase error:', e);
        throw e;
    }
}

// ==========================================
// COUPONS
// ==========================================
async function getAllCoupons() {
    try {
        // WHY: admin coupons must use Firestore directly (no backend dependency).
        const db = getFirebaseDB();
        const snapshot = await db.collection('coupons').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllCoupons error:', e);
        return [];
    }
}

async function deleteCouponFromFirebase(id) {
    try {
        await deleteCoupon(id);
    } catch (e) {
        console.error('deleteCoupon error:', e);
        throw e;
    }
}

// ==========================================
// BANNERS
// ==========================================
async function getAllBanners() {
    try {
        // WHY: admin banners must use Firestore directly (no backend dependency).
        const db = getFirebaseDB();
        const snapshot = await db.collection('banners').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllBanners error:', e);
        return [];
    }
}

async function deleteBannerFromFirebase(id) {
    try {
        await deleteBanner(id);
    } catch (e) {
        console.error('deleteBanner error:', e);
        throw e;
    }
}

// ==========================================
// SETTINGS
// ==========================================
async function getSettings() {
    try {
        const db = getFirebaseDB();
        const doc = await db.collection('settings').doc('store').get();
        if (!doc.exists) return null;
        const data = doc.data() || {};
        return {
            ...data,
            catalogVersion: String(data.catalogVersion || '').trim(),
            featureFlags: {
                ...((data && data.featureFlags) || {}),
                catalogCacheEnabled: data && data.featureFlags && Object.prototype.hasOwnProperty.call(data.featureFlags, 'catalogCacheEnabled')
                    ? data.featureFlags.catalogCacheEnabled !== false
                    : false
            }
        };
    } catch (e) {
        console.error('getSettings error:', e);
        return null;
    }
}

async function saveSettings(settings) {
    // WHY: removed Backend API dependency (Spark plan - no Functions)
    try {
        const db = getFirebaseDB();
        const input = settings && typeof settings === 'object' ? settings : {};
        const featureFlags = input.featureFlags && typeof input.featureFlags === 'object'
            ? { ...input.featureFlags }
            : {};
        if (!Object.prototype.hasOwnProperty.call(featureFlags, 'catalogCacheEnabled')) {
            featureFlags.catalogCacheEnabled = false;
        }
        await db.collection('settings').doc('store').set({
            ...input,
            featureFlags
        }, { merge: true });
        return { success: true };
    } catch (e) {
        console.error('saveSettings error:', e);
        return { success: false, error: e.message };
    }
}

async function getStoreSettings() {
    try {
        return await getSettings() || {};
    } catch (e) {
        console.warn('[Settings] Using defaults:', e && e.message ? e.message : e);
        return {};
    }
}

async function updateStoreSettings(updates) {
    try {
        const result = await saveSettings(updates || {});
        return Boolean(result && result.success);
    } catch (e) {
        console.error('[Settings] Update failed:', e);
        return false;
    }
}

// ==========================================
// FAQ
// ==========================================
const FAQ_COLLECTION = 'faq';

function normalizeFaqKeywords(keywords, question = '', category = '') {
    const explicit = Array.isArray(keywords)
        ? keywords.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    if (explicit.length) return explicit;

    const generated = [question, category]
        .join(' ')
        .split(/[\s،,:;.!?؟\-_/\\]+/)
        .map((item) => String(item || '').trim())
        .filter((item) => item.length >= 2);
    return Array.from(new Set(generated)).slice(0, 12);
}

function normalizeFaqEntryPayload(payload = {}, defaults = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const nowIso = new Date().toISOString();
    const question = String(source.question || base.question || '').trim();
    const answer = String(source.answer || base.answer || source.response || base.response || '').trim();
    const category = String(source.category || base.category || 'عام').trim() || 'عام';
    const parsedOrder = Number(source.order);
    const baseOrder = Number(base.order);
    const order = Number.isFinite(parsedOrder)
        ? Math.max(0, parsedOrder)
        : (Number.isFinite(baseOrder) ? Math.max(0, baseOrder) : 0);
    const isActive = typeof source.isActive === 'boolean'
        ? source.isActive
        : (typeof base.isActive === 'boolean' ? base.isActive : true);
    const id = String(source.id || base.id || '').trim();
    return {
        id,
        question,
        answer,
        category,
        order,
        isActive,
        keywords: normalizeFaqKeywords(source.keywords || base.keywords, question, category),
        createdAt: String(base.createdAt || source.createdAt || nowIso).trim() || nowIso,
        updatedAt: nowIso
    };
}

async function listFAQItems(options = {}) {
    const db = getFirebaseDB();
    const settings = options && typeof options === 'object' ? options : {};
    const activeOnly = settings.activeOnly === true;
    const safeLimit = Math.max(1, Math.min(500, Number(settings.limit) || 200));

    try {
        let query = db.collection(FAQ_COLLECTION);
        if (activeOnly) query = query.where('isActive', '==', true);
        query = query.orderBy('order', 'asc').limit(safeLimit);
        const snapshot = await query.get();
        return snapshot.docs.map((doc) => normalizeFaqEntryPayload({ id: doc.id, ...doc.data() }, { id: doc.id, ...doc.data() }));
    } catch (error) {
        console.warn('listFAQItems warning:', error && error.message ? error.message : error);
        const snapshot = await db.collection(FAQ_COLLECTION).limit(safeLimit).get();
        return snapshot.docs
            .map((doc) => normalizeFaqEntryPayload({ id: doc.id, ...doc.data() }, { id: doc.id, ...doc.data() }))
            .filter((item) => (activeOnly ? item.isActive === true : true))
            .sort((a, b) => Number(a && a.order || 0) - Number(b && b.order || 0));
    }
}

async function saveFAQItems(items = []) {
    const db = getFirebaseDB();
    const rows = (Array.isArray(items) ? items : [])
        .map((item, index) => normalizeFaqEntryPayload(
            { ...(item || {}), order: Number(item && item.order) || index + 1 },
            item || {}
        ))
        .filter((item) => item.question && item.answer);

    const snapshot = await db.collection(FAQ_COLLECTION).get();
    const existingMap = new Map((snapshot.docs || []).map((doc) => [String(doc.id), doc]));
    const batch = db.batch();
    const keepIds = new Set();
    const persistedRows = [];

    rows.forEach((item, index) => {
        const docId = String(item.id || '').trim() || db.collection(FAQ_COLLECTION).doc().id;
        const existing = existingMap.get(docId);
        const normalized = normalizeFaqEntryPayload(
            { ...item, id: docId, order: index + 1 },
            existing ? { id: docId, ...existing.data() } : {}
        );
        keepIds.add(docId);
        persistedRows.push(normalized);
        batch.set(db.collection(FAQ_COLLECTION).doc(docId), normalized, { merge: true });
    });

    existingMap.forEach((doc, docId) => {
        if (keepIds.has(docId)) return;
        batch.delete(doc.ref);
    });

    await batch.commit();
    return persistedRows;
}

if (typeof window !== 'undefined') {
    window.getStoreSettings = getStoreSettings;
    window.updateStoreSettings = updateStoreSettings;
    window.ensureStorefrontFirestoreAuthReady = ensureStorefrontFirestoreAuthReady;
    window.getCustomerNotificationsAccessState = getCustomerNotificationsAccessState;
    window.getAdminNotificationsQueryState = getAdminNotificationsQueryState;
    window.saveCustomerNotification = saveCustomerNotification;
    window.saveAdminSystemNotification = saveAdminSystemNotification;
    window.listCustomerNotifications = listCustomerNotifications;
    window.subscribeCustomerNotifications = subscribeCustomerNotifications;
    window.listAdminNotifications = listAdminNotifications;
    window.subscribeAdminNotifications = subscribeAdminNotifications;
    window.markCustomerNotificationRead = markCustomerNotificationRead;
    window.markAllCustomerNotificationsRead = markAllCustomerNotificationsRead;
    window.markAdminNotificationRead = markAdminNotificationRead;
    window.markAllAdminNotificationsRead = markAllAdminNotificationsRead;
    window.subscribeCustomersRealtime = subscribeCustomersRealtime;
    window.listFAQItems = listFAQItems;
    window.saveFAQItems = saveFAQItems;
    window.ReleaseGateStateAPI = {
        getReleaseGateState,
        saveReleaseGateState
    };
}

// WHY: release-gate smoke checks require a Node/module bridge marker in firebase-api.js.
if (typeof module !== 'undefined' && module.exports) {
    module.exports.getStoreSettings = getStoreSettings;
    module.exports.updateStoreSettings = updateStoreSettings;
    module.exports.ensureStorefrontFirestoreAuthReady = ensureStorefrontFirestoreAuthReady;
    module.exports.getCustomerNotificationsAccessState = getCustomerNotificationsAccessState;
    module.exports.getAdminNotificationsQueryState = getAdminNotificationsQueryState;
    module.exports.saveCustomerNotification = saveCustomerNotification;
    module.exports.saveAdminSystemNotification = saveAdminSystemNotification;
    module.exports.listCustomerNotifications = listCustomerNotifications;
    module.exports.listAdminNotifications = listAdminNotifications;
    module.exports.markCustomerNotificationRead = markCustomerNotificationRead;
    module.exports.markAllCustomerNotificationsRead = markAllCustomerNotificationsRead;
    module.exports.markAdminNotificationRead = markAdminNotificationRead;
    module.exports.markAllAdminNotificationsRead = markAllAdminNotificationsRead;
    module.exports.subscribeCustomersRealtime = subscribeCustomersRealtime;
    module.exports.listFAQItems = listFAQItems;
    module.exports.saveFAQItems = saveFAQItems;
    module.exports.ReleaseGateStateAPI = {
        getReleaseGateState,
        saveReleaseGateState
    };
    module.exports.isBackendApiUnavailableError = isBackendApiUnavailableError;
    module.exports.backendUnavailableNoticePrinted = function backendUnavailableNoticePrintedState() {
        return backendUnavailableNoticePrinted;
    };
}

// ==========================================
// CLIENT ERROR LOGGING (Mobile/Tablet First)
// ==========================================
function normalizeClientErrorPayload(payload) {
    const now = new Date().toISOString();
    const safe = payload && typeof payload === 'object' ? payload : {};
    const error = safe.error && typeof safe.error === 'object' ? safe.error : {};
    const context = safe.context && typeof safe.context === 'object' ? safe.context : {};

    return {
        type: String(error.type || 'CLIENT_ERROR'),
        message: String(error.message || 'Unknown client error'),
        stack: error.stack ? String(error.stack).slice(0, 4000) : '',
        source: String(error.source || context.page || window.location.pathname || ''),
        timestamp: error.timestamp || now,
        context: {
            page: String(context.page || window.location.pathname || ''),
            href: String(context.href || window.location.href || ''),
            userAgent: String(context.userAgent || navigator.userAgent || ''),
            language: String(context.language || navigator.language || ''),
            platform: String(context.platform || navigator.platform || ''),
            online: typeof context.online === 'boolean' ? context.online : navigator.onLine,
            viewport: context.viewport || {
                width: window.innerWidth || 0,
                height: window.innerHeight || 0
            },
            deviceMemory: typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null,
            hardwareConcurrency: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null
        }
    };
}

async function addClientErrorLog(payload) {
    try {
        if (isTelemetryWriteSuspended()) {
            return { ok: false, error: "telemetry-write-paused" };
        }
        if (!canClientWriteTelemetry({ requireVerified: true })) {
            return { ok: false, error: "telemetry-auth-required" };
        }
        const fireDB = getFirebaseDB();
        const normalized = normalizeClientErrorPayload(payload);
        const docRef = await fireDB.collection('client_error_logs').add(normalized);
        return { ok: true, id: docRef.id };
    } catch (e) {
        if (isTransientTransportError(e)) {
            suspendTelemetryWrites(getErrorMessage(e), 45000);
        }
        console.warn('addClientErrorLog warning:', e && e.message ? e.message : e);
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
}
async function getClientErrorLogs(limitCount = 50) {
    try {
        const fireDB = getFirebaseDB();
        const safeLimit = Math.max(1, Math.min(200, Number(limitCount) || 50));
        const snapshot = await fireDB
            .collection('client_error_logs')
            .orderBy('timestamp', 'desc')
            .limit(safeLimit)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.warn('getClientErrorLogs warning:', e && e.message ? e.message : e);
        return [];
    }
}

// ==========================================
// STORE OPERATIONS MONITORING (Real-time)
// ==========================================
function normalizeStoreEventPayload(payload) {
    const safe = payload && typeof payload === 'object' ? payload : {};
    const context = safe.context && typeof safe.context === 'object' ? safe.context : {};
    const meta = safe.meta && typeof safe.meta === 'object' ? safe.meta : {};
    return {
        type: String(safe.type || 'STORE_EVENT'),
        level: String(safe.level || 'info'),
        message: String(safe.message || ''),
        source: String(safe.source || window.location.pathname || ''),
        timestamp: String(safe.timestamp || new Date().toISOString()),
        sessionId: String(safe.sessionId || ''),
        customerId: String(safe.customerId || ''),
        meta,
        context: {
            page: String(context.page || window.location.pathname || ''),
            href: String(context.href || window.location.href || ''),
            userAgent: String(context.userAgent || navigator.userAgent || ''),
            online: typeof context.online === 'boolean' ? context.online : navigator.onLine,
            viewport: context.viewport || {
                width: window.innerWidth || 0,
                height: window.innerHeight || 0
            }
        }
    };
}

async function addStoreEvent(payload) {
    try {
        if (isTelemetryWriteSuspended()) {
            return { ok: false, error: "telemetry-write-paused" };
        }
        if (!canClientWriteTelemetry({ requireVerified: true })) {
            return { ok: false, error: "telemetry-auth-required" };
        }
        const fireDB = getFirebaseDB();
        const normalized = normalizeStoreEventPayload(payload);
        const docRef = await fireDB.collection('store_events').add(normalized);
        return { ok: true, id: docRef.id };
    } catch (e) {
        if (isTransientTransportError(e)) {
            suspendTelemetryWrites(getErrorMessage(e), 45000);
        }
        if (isAlreadyExistsWriteError(e)) {
            return { ok: true, duplicate: true, id: "", error: "already-exists" };
        }
        console.warn('addStoreEvent warning:', e && e.message ? e.message : e);
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
}

async function getStoreEvents(limitCount = 100) {
    try {
        const fireDB = getFirebaseDB();
        const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 100));
        const snapshot = await fireDB
            .collection('store_events')
            .orderBy('timestamp', 'desc')
            .limit(safeLimit)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.warn('getStoreEvents warning:', e && e.message ? e.message : e);
        return [];
    }
}

function subscribeStoreEvents(onData, onError, limitCount = 100) {
    try {
        const fireDB = getFirebaseDB();
        const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 100));
        return fireDB
            .collection('store_events')
            .orderBy('timestamp', 'desc')
            .limit(safeLimit)
            .onSnapshot(
                (snapshot) => {
                    const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (typeof onData === 'function') onData(rows);
                },
                (error) => {
                    if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeStoreEvents.listener'));
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(normalizeFirebaseError(e, 'subscribeStoreEvents.setup'));
        return null;
    }
}

// ==========================================
// NOTIFICATIONS
// ==========================================
const NOTIFICATION_COLLECTION = 'notifications';
const NOTIFICATION_ALLOWED_TYPES = ['order', 'chat', 'stock', 'point', 'admin', 'product', 'system'];
const NOTIFICATION_ALLOWED_AUDIENCES = ['customer', 'admin', 'both'];
const NOTIFICATION_ALLOWED_SCOPES = ['customer', 'system'];
const NOTIFICATION_ALLOWED_ROLES = ['customer', 'admin', 'system'];
const notificationsDebugOnce = new Set();
let adminNotificationsQueryState = {
    mode: 'collectionGroup',
    fallbackReason: '',
    source: 'collectionGroup'
};

function logNotificationDebugOnce(key, message, meta) {
    const normalizedKey = normalizeNotificationText(key, 120);
    if (!normalizedKey || notificationsDebugOnce.has(normalizedKey)) return;
    notificationsDebugOnce.add(normalizedKey);
    if (typeof meta === 'undefined') {
        console.warn(message);
        return;
    }
    console.warn(message, meta);
}

function setAdminNotificationsQueryState(mode = 'collectionGroup', reason = '', source = '') {
    adminNotificationsQueryState = {
        mode: String(mode || 'collectionGroup').trim() || 'collectionGroup',
        fallbackReason: normalizeNotificationText(reason, 300),
        source: normalizeNotificationText(source, 120) || String(mode || 'collectionGroup').trim() || 'collectionGroup'
    };
    return getAdminNotificationsQueryState();
}

function getAdminNotificationsQueryState() {
    return { ...adminNotificationsQueryState };
}

function normalizeNotificationText(value, max = 400) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeNotificationTimestamp(value) {
    const raw = String(value || '').trim();
    return raw || new Date().toISOString();
}

function normalizeNotificationAction(action) {
    const source = action && typeof action === 'object' ? action : {};
    const normalized = {};
    const kind = normalizeNotificationText(source.kind, 60);
    if (kind) normalized.kind = kind;
    const tab = normalizeNotificationText(source.tab, 40);
    if (tab) normalized.tab = tab;
    const orderId = normalizeNotificationText(source.orderId, 120);
    if (orderId) normalized.orderId = orderId;
    const orderNumber = normalizeNotificationText(source.orderNumber, 120);
    if (orderNumber) normalized.orderNumber = orderNumber;
    const threadId = normalizeNotificationText(source.threadId, 120);
    if (threadId) normalized.threadId = threadId;
    const productId = normalizeNotificationText(source.productId, 120);
    if (productId) normalized.productId = productId;
    const section = normalizeNotificationText(source.section, 60);
    if (section) normalized.section = section;
    const status = normalizeNotificationText(source.status, 60);
    if (status) normalized.status = status;
    const customerUid = normalizeNotificationText(source.customerUid, 200);
    if (customerUid) normalized.customerUid = customerUid;
    return normalized;
}

function normalizeNotificationPayload(payload = {}, defaults = {}, options = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const opts = options && typeof options === 'object' ? options : {};
    const nowIso = new Date().toISOString();
    const customerUid = normalizeNotificationText(opts.customerUid || source.customerUid || base.customerUid, 200);
    const requestedScope = normalizeNotificationText(source.scope || base.scope || (customerUid ? 'customer' : 'system'), 30).toLowerCase();
    const requestedType = normalizeNotificationText(source.type || base.type || 'system', 30).toLowerCase();
    const requestedAudience = normalizeNotificationText(source.audience || base.audience || (customerUid ? 'customer' : 'admin'), 20).toLowerCase();
    const requestedRole = normalizeNotificationText(source.createdByRole || base.createdByRole || (opts.createdByRole || 'system'), 20).toLowerCase();
    const scope = NOTIFICATION_ALLOWED_SCOPES.includes(requestedScope) ? requestedScope : (customerUid ? 'customer' : 'system');
    const type = NOTIFICATION_ALLOWED_TYPES.includes(requestedType) ? requestedType : 'system';
    const audience = NOTIFICATION_ALLOWED_AUDIENCES.includes(requestedAudience) ? requestedAudience : (scope === 'system' ? 'admin' : 'customer');
    const createdByRole = NOTIFICATION_ALLOWED_ROLES.includes(requestedRole) ? requestedRole : 'system';
    const title = normalizeNotificationText(source.title || base.title, 160);
    const body = normalizeNotificationText(source.body || base.body, 600);
    const action = normalizeNotificationAction(source.action || base.action || {});
    const createdAt = normalizeNotificationTimestamp(source.createdAt || base.createdAt || nowIso);
    const updatedAt = normalizeNotificationTimestamp(source.updatedAt || nowIso);
    return {
        customerUid,
        scope,
        type,
        audience,
        title,
        body,
        action,
        source: normalizeNotificationText(source.source || base.source || 'app', 120),
        readByCustomer: source.readByCustomer === true,
        readByAdmin: source.readByAdmin === true,
        createdByRole,
        createdAt,
        updatedAt
    };
}

function isNotificationRecordVisibleToCustomer(row, uid) {
    const normalizedUid = normalizeNotificationText(uid, 200);
    if (!normalizedUid || !row) return false;
    return String(row.customerUid || '') === normalizedUid
        && (row.audience === 'customer' || row.audience === 'both');
}

function isNotificationRecordVisibleToAdmin(row) {
    if (!row) return false;
    return row.scope === 'system' || row.scope === 'customer';
}

function enrichNotificationRecord(data, id = '', refPath = '') {
    const normalized = normalizeNotificationPayload(data || {}, data || {}, {
        customerUid: data && data.customerUid ? data.customerUid : ''
    });
    return {
        id: String(id || '').trim(),
        refPath: String(refPath || '').trim(),
        ...normalized
    };
}

function getCustomerNotificationCollection(uid) {
    const normalizedUid = normalizeNotificationText(uid, 200);
    if (!normalizedUid) throw new Error('uid is required');
    return getFirebaseDB().collection('customers').doc(normalizedUid).collection(NOTIFICATION_COLLECTION);
}

function getCustomerNotificationsAccessState(uid) {
    const normalizedUid = normalizeNotificationText(uid, 200);
    const user = getFirebaseAuthUserSafe();
    const authUid = String(user && user.uid || '').trim();
    if (!normalizedUid) {
        return {
            allowed: false,
            reason: 'missing-uid',
            targetUid: '',
            authUid,
            authReady: Boolean(authUid)
        };
    }
    if (!authUid) {
        return {
            allowed: false,
            reason: 'auth-not-ready',
            targetUid: normalizedUid,
            authUid: '',
            authReady: false
        };
    }
    if (authUid !== normalizedUid) {
        return {
            allowed: false,
            reason: 'uid-mismatch',
            targetUid: normalizedUid,
            authUid,
            authReady: true
        };
    }
    return {
        allowed: true,
        reason: 'attempted-query',
        targetUid: normalizedUid,
        authUid,
        authReady: true
    };
}

function hasCustomerNotificationsAccess(uid) {
    return getCustomerNotificationsAccessState(uid).allowed;
}

async function ensureStorefrontFirestoreAuthReady(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const targetUid = normalizeNotificationText(opts.targetUid, 200);
    const timeoutMs = Math.max(250, Math.min(10000, Number(opts.timeoutMs) || 2500));
    const forceRefresh = opts.forceRefresh === true;

    let auth = null;
    try {
        auth = getFirebaseAuth();
    } catch (_) {
        return {
            ready: false,
            reason: targetUid ? 'auth-not-ready' : 'guest-path',
            authUid: '',
            targetUid
        };
    }

    const finalizeState = async (candidateUser = null) => {
        const user = candidateUser || getFirebaseAuthUserSafe();
        const authUid = String(user && user.uid || '').trim();
        if (!authUid) {
            return {
                ready: false,
                reason: targetUid ? 'auth-not-ready' : 'guest-path',
                authUid: '',
                targetUid
            };
        }
        if (targetUid && authUid !== targetUid) {
            return {
                ready: false,
                reason: 'uid-mismatch',
                authUid,
                targetUid
            };
        }
        if (typeof user.getIdToken === 'function') {
            await user.getIdToken(forceRefresh).catch(() => null);
        }
        const hydratedUser = getFirebaseAuthUserSafe() || user;
        const hydratedUid = String(hydratedUser && hydratedUser.uid || authUid).trim();
        if (!hydratedUid) {
            return {
                ready: false,
                reason: targetUid ? 'auth-not-ready' : 'guest-path',
                authUid: '',
                targetUid
            };
        }
        if (targetUid && hydratedUid !== targetUid) {
            return {
                ready: false,
                reason: 'uid-mismatch',
                authUid: hydratedUid,
                targetUid
            };
        }
        return {
            ready: true,
            reason: 'ready',
            authUid: hydratedUid,
            targetUid: targetUid || hydratedUid,
            user: hydratedUser
        };
    };

    const currentUser = getFirebaseAuthUserSafe();
    if (currentUser) {
        return finalizeState(currentUser);
    }

    if (auth && typeof auth.onAuthStateChanged === 'function') {
        const resolvedUser = await new Promise((resolve) => {
            let settled = false;
            let unsubscribe = null;
            let timeoutHandle = null;
            const finish = (user) => {
                if (settled) return;
                settled = true;
                if (timeoutHandle) clearTimeout(timeoutHandle);
                if (typeof unsubscribe === 'function') {
                    try { unsubscribe(); } catch (_) {}
                }
                resolve(user || null);
            };
            timeoutHandle = setTimeout(() => finish(getFirebaseAuthUserSafe()), timeoutMs);
            unsubscribe = auth.onAuthStateChanged(
                (user) => finish(user || getFirebaseAuthUserSafe()),
                () => finish(getFirebaseAuthUserSafe())
            );
        });
        return finalizeState(resolvedUser);
    }

    return finalizeState(null);
}

function getAdminSystemNotificationCollection(settingId = 'store') {
    const normalizedSettingId = normalizeNotificationText(settingId || 'store', 120) || 'store';
    return getFirebaseDB().collection('settings').doc(normalizedSettingId).collection(NOTIFICATION_COLLECTION);
}

function getAdminNotificationsCollectionGroup() {
    return getFirebaseDB().collectionGroup(NOTIFICATION_COLLECTION);
}

function buildNotificationQuery(collectionRef, readField, options = {}, limitValue = 100) {
    const safeLimit = Math.max(1, Math.min(500, Number(limitValue || 100)));
    const opts = options && typeof options === 'object' ? options : {};
    let query = collectionRef;
    if (opts.unreadOnly === true && readField) {
        query = query.where(readField, '==', false);
    }
    return query.orderBy('createdAt', 'desc').limit(safeLimit);
}

function applyAdminNotificationFilters(rows, options = {}, limitValue = 150) {
    const safeLimit = Math.max(1, Math.min(500, Number(limitValue || 150)));
    const opts = options && typeof options === 'object' ? options : {};
    let list = (Array.isArray(rows) ? rows : []).filter((row) => isNotificationRecordVisibleToAdmin(row));
    if (opts.unreadOnly === true) {
        list = list.filter((row) => row && row.readByAdmin !== true);
    }
    if (opts.type) {
        const wantedType = normalizeNotificationText(opts.type, 30).toLowerCase();
        list = list.filter((row) => String(row && row.type || '').toLowerCase() === wantedType);
    }
    const seen = new Set();
    list = list
        .slice()
        .sort((a, b) => String(b && b.createdAt || '').localeCompare(String(a && a.createdAt || '')))
        .filter((row) => {
            const key = String(row && (row.refPath || row.id) || '').trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    return list.slice(0, safeLimit);
}

function getAdminFallbackPerCustomerLimit(totalLimit, customerCount) {
    const safeTotal = Math.max(1, Math.min(500, Number(totalLimit || 150)));
    const safeCount = Math.max(1, Number(customerCount || 1));
    return Math.max(5, Math.min(25, Math.ceil(safeTotal / Math.min(safeCount, 20)) + 2));
}

async function listAdminNotificationCustomerIds(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const explicit = Array.isArray(opts.customerIds) ? opts.customerIds : [];
    const explicitIds = Array.from(new Set(explicit.map((value) => normalizeNotificationText(value, 200)).filter(Boolean)));
    if (explicitIds.length) return explicitIds;

    const maxCustomers = Math.max(1, Math.min(500, Number(opts.maxCustomerIds || 200)));
    const pageSize = Math.max(1, Math.min(100, Number(opts.customerPageSize || 100)));
    const collected = [];
    let cursor = '';
    let hasMore = true;

    while (hasMore && collected.length < maxCustomers) {
        const page = await listCustomersPage({
            cursor,
            limit: Math.min(pageSize, maxCustomers - collected.length)
        });
        const items = Array.isArray(page && page.items) ? page.items : [];
        items.forEach((item) => {
            const uid = normalizeNotificationText(item && (item.id || item.uid) || '', 200);
            if (uid) collected.push(uid);
        });
        cursor = String(page && page.nextCursor || '').trim();
        hasMore = page && page.hasMore === true && Boolean(cursor);
    }

    return Array.from(new Set(collected)).filter(Boolean);
}

async function listNotificationCollectionRows(collectionRef, options = {}, limitValue = 100) {
    const snapshot = await buildNotificationQuery(collectionRef, 'readByAdmin', options, limitValue).get();
    return snapshot.docs.map((doc) => enrichNotificationRecord(doc.data() || {}, doc.id, doc.ref.path));
}

async function listAdminNotificationsDirect(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const safeLimit = Math.max(1, Math.min(500, Number(opts.limit || 150)));
    const customerIds = await listAdminNotificationCustomerIds(opts);
    const perCustomerLimit = getAdminFallbackPerCustomerLimit(safeLimit, customerIds.length);
    const tasks = [
        listNotificationCollectionRows(getAdminSystemNotificationCollection(opts.settingId || 'store'), opts, Math.max(20, Math.min(100, safeLimit))),
        ...customerIds.map((uid) => listNotificationCollectionRows(getCustomerNotificationCollection(uid), opts, perCustomerLimit))
    ];
    const settled = await Promise.allSettled(tasks);
    const rows = [];
    let firstError = null;
    settled.forEach((result) => {
        if (result.status === 'fulfilled') {
            rows.push(...(Array.isArray(result.value) ? result.value : []));
            return;
        }
        if (!firstError) firstError = result.reason;
    });
    if (!rows.length && firstError) throw firstError;
    return applyAdminNotificationFilters(rows, opts, safeLimit);
}

function buildAdminNotificationsAccessError(code = 'auth/not-admin', message = 'Admin claim is missing or stale.') {
    const error = new Error(String(message || 'Admin notifications access denied.'));
    error.code = String(code || 'auth/not-admin');
    return error;
}

async function ensureAdminNotificationsAccess() {
    const user = getFirebaseAuthUserSafe();
    if (!user) {
        throw buildAdminNotificationsAccessError('auth/not-authenticated', 'User is not authenticated.');
    }
    if (typeof user.getIdToken === 'function') {
        await user.getIdToken(true).catch(() => null);
    }
    if (user.emailVerified !== true) {
        const verifyError = buildAdminNotificationsAccessError(
            'auth/email-not-verified',
            'Admin notifications require a verified email address. Verify the admin account email, refresh the session, and try again.'
        );
        verifyError.emailVerified = false;
        throw verifyError;
    }
    const tokenResult = typeof user.getIdTokenResult === 'function'
        ? await user.getIdTokenResult(true).catch(() => null)
        : null;
    const claims = tokenResult && tokenResult.claims && typeof tokenResult.claims === 'object'
        ? tokenResult.claims
        : {};
    const isAdmin = claims.admin === true || claims.role === 'admin';
    if (!isAdmin) {
        throw buildAdminNotificationsAccessError(
            'auth/not-admin',
            'Admin claim missing. Set a Firebase custom claim such as {"admin": true} and refresh the session.'
        );
    }
    return { user, tokenResult };
}

async function saveCustomerNotification(uid, payload, options = {}) {
    const normalizedUid = normalizeNotificationText(uid, 200);
    if (!normalizedUid) throw new Error('uid is required');
    const opts = options && typeof options === 'object' ? options : {};
    const normalized = normalizeNotificationPayload(payload || {}, {}, { customerUid: normalizedUid });
    if (!normalized.title || !normalized.body) throw new Error('notification title/body are required');
    const collectionRef = getCustomerNotificationCollection(normalizedUid);
    const docId = normalizeNotificationText(opts.id || payload && payload.id || '', 200);
    const docRef = docId ? collectionRef.doc(docId) : collectionRef.doc();
    await docRef.set(normalized, { merge: opts.merge !== false });
    return enrichNotificationRecord(normalized, docRef.id, docRef.path);
}

async function saveAdminSystemNotification(payload, options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const normalized = normalizeNotificationPayload({
        ...(payload && typeof payload === 'object' ? payload : {}),
        scope: 'system',
        audience: payload && payload.audience ? payload.audience : 'admin',
        customerUid: payload && payload.customerUid ? payload.customerUid : ''
    }, {}, { createdByRole: opts.createdByRole || 'system' });
    if (!normalized.title || !normalized.body) throw new Error('notification title/body are required');
    const collectionRef = getAdminSystemNotificationCollection(opts.settingId || 'store');
    const docId = normalizeNotificationText(opts.id || payload && payload.id || '', 200);
    const docRef = docId ? collectionRef.doc(docId) : collectionRef.doc();
    await docRef.set(normalized, { merge: opts.merge !== false });
    return enrichNotificationRecord(normalized, docRef.id, docRef.path);
}

async function listCustomerNotifications(uid, options = {}) {
    try {
        const readyState = await ensureStorefrontFirestoreAuthReady({ targetUid: uid });
        if (!readyState.ready || !readyState.targetUid) return [];
        const accessState = getCustomerNotificationsAccessState(readyState.targetUid);
        if (!accessState.allowed) return [];
        const opts = options && typeof options === 'object' ? options : {};
        const safeLimit = Math.max(1, Math.min(300, Number(opts.limit || 100)));
        const query = buildNotificationQuery(getCustomerNotificationCollection(accessState.targetUid), 'readByCustomer', opts, safeLimit);
        const snapshot = await query.get();
        return snapshot.docs
            .map((doc) => enrichNotificationRecord(doc.data() || {}, doc.id, doc.ref.path))
            .filter((row) => isNotificationRecordVisibleToCustomer(row, accessState.targetUid));
    } catch (error) {
        const normalized = normalizeFirebaseError(error, 'listCustomerNotifications');
        if (normalized.permissionDenied) {
            logNotificationDebugOnce(
                'customer.notifications.permission-denied-after-ready',
                '[Notifications] Customer notifications query denied after auth readiness completed.',
                normalized
            );
            return [];
        }
        console.error('listCustomerNotifications error:', error);
        return [];
    }
}

function subscribeCustomerNotifications(uid, onData, onError, options = {}) {
    try {
        let active = true;
        let liveUnsubscribe = null;
        const stop = () => {
            active = false;
            if (typeof liveUnsubscribe === 'function') {
                try { liveUnsubscribe(); } catch (_) {}
            }
            liveUnsubscribe = null;
        };
        Promise.resolve().then(async () => {
            const readyState = await ensureStorefrontFirestoreAuthReady({ targetUid: uid });
            if (!active || !readyState.ready || !readyState.targetUid) return;
            const accessState = getCustomerNotificationsAccessState(readyState.targetUid);
            if (!accessState.allowed) return;
            const opts = options && typeof options === 'object' ? options : {};
            const safeLimit = Math.max(1, Math.min(300, Number(opts.limit || 100)));
            const query = buildNotificationQuery(getCustomerNotificationCollection(accessState.targetUid), 'readByCustomer', opts, safeLimit);
            liveUnsubscribe = query.onSnapshot(
                (snapshot) => {
                    const rows = snapshot.docs
                        .map((doc) => enrichNotificationRecord(doc.data() || {}, doc.id, doc.ref.path))
                        .filter((row) => isNotificationRecordVisibleToCustomer(row, accessState.targetUid));
                    if (typeof onData === 'function') onData(rows);
                },
                (error) => {
                    const normalized = normalizeFirebaseError(error, 'subscribeCustomerNotifications.listener');
                    if (normalized.permissionDenied) {
                        normalized.reason = 'permission-denied-after-ready';
                    }
                    if (typeof onError === 'function') onError(normalized);
                }
            );
        }).catch((error) => {
            if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeCustomerNotifications.setup'));
        });
        return stop;
    } catch (error) {
        if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeCustomerNotifications.setup'));
        return () => {};
    }
}

async function listAdminNotifications(options = {}) {
    try {
        await ensureAdminNotificationsAccess();
        const opts = options && typeof options === 'object' ? options : {};
        const safeLimit = Math.max(1, Math.min(500, Number(opts.limit || 150)));
        const state = getAdminNotificationsQueryState();
        if (state.mode === 'direct-path') {
            return listAdminNotificationsDirect(opts);
        }

        try {
            const query = buildNotificationQuery(getAdminNotificationsCollectionGroup(), 'readByAdmin', opts, safeLimit);
            const snapshot = await query.get();
            const rows = snapshot.docs.map((doc) => enrichNotificationRecord(doc.data() || {}, doc.id, doc.ref.path));
            setAdminNotificationsQueryState('collectionGroup', '', 'collectionGroup');
            return applyAdminNotificationFilters(rows, opts, safeLimit);
        } catch (error) {
            const normalized = normalizeFirebaseError(error, 'listAdminNotifications.collectionGroup');
            if (!normalized.permissionDenied) throw error;
            setAdminNotificationsQueryState('direct-path', normalized.message, 'listAdminNotifications.collectionGroup');
            logNotificationDebugOnce(
                'admin.notifications.fallback.list',
                '[Notifications] collectionGroup denied, switching to direct-path mode.',
                { source: normalized.source, reason: normalized.message }
            );
            return listAdminNotificationsDirect(opts);
        }
    } catch (error) {
        console.error('listAdminNotifications error:', error);
        return [];
    }
}

function subscribeAdminNotifications(onData, onError, options = {}) {
    try {
        let active = true;
        let liveUnsubscribe = null;
        let directModeStarted = false;
        const stop = () => {
            active = false;
            if (typeof liveUnsubscribe === 'function') {
                try { liveUnsubscribe(); } catch (_) {}
            }
            liveUnsubscribe = null;
        };
        const startDirectMode = async (reasonError = null) => {
            if (!active) return;
            if (directModeStarted) return;
            directModeStarted = true;
            const normalized = normalizeFirebaseError(reasonError, 'subscribeAdminNotifications.collectionGroup');
            setAdminNotificationsQueryState('direct-path', normalized.message, normalized.source);
            logNotificationDebugOnce(
                'admin.notifications.fallback.subscribe',
                '[Notifications] realtime collectionGroup denied, switching to direct-path mode.',
                { source: normalized.source, reason: normalized.message }
            );
            const opts = options && typeof options === 'object' ? options : {};
            const safeLimit = Math.max(1, Math.min(500, Number(opts.limit || 150)));
            const customerIds = await listAdminNotificationCustomerIds(opts);
            const perCustomerLimit = getAdminFallbackPerCustomerLimit(safeLimit, customerIds.length);
            const rowsBySource = new Map();
            const unsubscribers = [];
            const emit = () => {
                const merged = [];
                rowsBySource.forEach((rows) => {
                    if (Array.isArray(rows)) merged.push(...rows);
                });
                if (typeof onData === 'function') onData(applyAdminNotificationFilters(merged, opts, safeLimit));
            };
            const attachListener = (sourceKey, collectionRef, limitValue) => {
                const query = buildNotificationQuery(collectionRef, 'readByAdmin', opts, limitValue);
                const unsubscribe = query.onSnapshot(
                    (snapshot) => {
                        rowsBySource.set(
                            sourceKey,
                            snapshot.docs.map((doc) => enrichNotificationRecord(doc.data() || {}, doc.id, doc.ref.path))
                        );
                        emit();
                    },
                    (error) => {
                        if (typeof onError === 'function') {
                            onError(normalizeFirebaseError(error, `subscribeAdminNotifications.direct.${sourceKey}`));
                        }
                    }
                );
                unsubscribers.push(unsubscribe);
            };

            attachListener(
                'settings/store',
                getAdminSystemNotificationCollection(opts.settingId || 'store'),
                Math.max(20, Math.min(100, safeLimit))
            );
            customerIds.forEach((uid) => {
                attachListener(`customers/${uid}`, getCustomerNotificationCollection(uid), perCustomerLimit);
            });
            liveUnsubscribe = () => {
                unsubscribers.forEach((unsubscribe) => {
                    if (typeof unsubscribe === 'function') {
                        try { unsubscribe(); } catch (_) {}
                    }
                });
            };
        };
        const opts = options && typeof options === 'object' ? options : {};
        const safeLimit = Math.max(1, Math.min(500, Number(opts.limit || 150)));
        Promise.resolve().then(async () => {
            await ensureAdminNotificationsAccess();
            if (!active) return;
            const state = getAdminNotificationsQueryState();
            if (state.mode === 'direct-path') {
                await startDirectMode(buildAdminNotificationsAccessError('notifications/direct-path', state.fallbackReason || 'Direct-path fallback already active.'));
                return;
            }
            const query = buildNotificationQuery(getAdminNotificationsCollectionGroup(), 'readByAdmin', opts, safeLimit);
            liveUnsubscribe = query.onSnapshot(
                (snapshot) => {
                    setAdminNotificationsQueryState('collectionGroup', '', 'collectionGroup');
                    const rows = snapshot.docs.map((doc) => enrichNotificationRecord(doc.data() || {}, doc.id, doc.ref.path));
                    if (typeof onData === 'function') onData(applyAdminNotificationFilters(rows, opts, safeLimit));
                },
                async (error) => {
                    const normalized = normalizeFirebaseError(error, 'subscribeAdminNotifications.listener');
                    if (normalized.permissionDenied) {
                        try {
                            if (typeof liveUnsubscribe === 'function') liveUnsubscribe();
                        } catch (_) {}
                        liveUnsubscribe = null;
                        await startDirectMode(normalized);
                        return;
                    }
                    if (typeof onError === 'function') onError(normalized);
                }
            );
        }).catch((error) => {
            if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeAdminNotifications.setup'));
        });
        return stop;
    } catch (error) {
        if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeAdminNotifications.setup'));
        return () => {};
    }
}

async function markCustomerNotificationRead(uid, notificationId) {
    try {
        const normalizedUid = normalizeNotificationText(uid, 200);
        const normalizedId = normalizeNotificationText(notificationId, 200);
        if (!normalizedUid || !normalizedId) return false;
        const readyState = await ensureStorefrontFirestoreAuthReady({ targetUid: normalizedUid });
        if (!readyState.ready || !hasCustomerNotificationsAccess(normalizedUid)) return false;
        await getCustomerNotificationCollection(normalizedUid).doc(normalizedId).set({
            readByCustomer: true,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error('markCustomerNotificationRead error:', error);
        return false;
    }
}

async function markAllCustomerNotificationsRead(uid) {
    try {
        const normalizedUid = normalizeNotificationText(uid, 200);
        if (!normalizedUid) return 0;
        const readyState = await ensureStorefrontFirestoreAuthReady({ targetUid: normalizedUid });
        if (!readyState.ready || !hasCustomerNotificationsAccess(normalizedUid)) return 0;
        const snapshot = await getCustomerNotificationCollection(normalizedUid)
            .where('readByCustomer', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(400)
            .get();
        if (snapshot.empty) return 0;
        const batch = getFirebaseDB().batch();
        const nowIso = new Date().toISOString();
        snapshot.docs.forEach((doc) => {
            batch.set(doc.ref, { readByCustomer: true, updatedAt: nowIso }, { merge: true });
        });
        await batch.commit();
        return snapshot.size;
    } catch (error) {
        console.error('markAllCustomerNotificationsRead error:', error);
        return 0;
    }
}

async function markAdminNotificationRead(refPathOrId) {
    try {
        const raw = normalizeNotificationText(refPathOrId, 600);
        if (!raw) return false;
        const db = getFirebaseDB();
        const ref = raw.includes('/')
            ? db.doc(raw)
            : getAdminSystemNotificationCollection('store').doc(raw);
        await ref.set({
            readByAdmin: true,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error('markAdminNotificationRead error:', error);
        return false;
    }
}

async function markAllAdminNotificationsRead(options = {}) {
    try {
        const rows = await listAdminNotifications({ ...(options || {}), unreadOnly: true, limit: 400 });
        if (!Array.isArray(rows) || !rows.length) return 0;
        const db = getFirebaseDB();
        const batch = db.batch();
        const nowIso = new Date().toISOString();
        rows.forEach((row) => {
            if (!row || !row.refPath) return;
            batch.set(db.doc(row.refPath), { readByAdmin: true, updatedAt: nowIso }, { merge: true });
        });
        await batch.commit();
        return rows.length;
    } catch (error) {
        console.error('markAllAdminNotificationsRead error:', error);
        return 0;
    }
}

function getNotificationOrderStatusLabel(status) {
    const value = normalizeNotificationText(status, 40).toLowerCase();
    const labels = {
        pending: '\u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629',
        confirmed: '\u0645\u0624\u0643\u062F',
        processing: '\u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632',
        shipped: '\u062A\u0645 \u0627\u0644\u0634\u062D\u0646',
        delivered: '\u062A\u0645 \u0627\u0644\u062A\u0633\u0644\u064A\u0645',
        completed: '\u0645\u0643\u062A\u0645\u0644',
        cancelled: '\u0645\u0644\u063A\u064A'
    };
    return labels[value] || value || '\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629';
}

async function createCustomerOrderNotifications(orderPayload = {}, options = {}) {
    const order = orderPayload && typeof orderPayload === 'object' ? orderPayload : {};
    const orderId = normalizeNotificationText(order.id, 160);
    const uid = normalizeNotificationText(order.uid, 200);
    if (!uid || !orderId) return [];
    const createdByRole = normalizeNotificationText(options.createdByRole || order.createdByRole || 'customer', 20).toLowerCase() || 'customer';
    const result = [];
    const orderNumber = normalizeNotificationText(order.orderNumber || order.id, 120) || orderId;
    const status = normalizeNotificationText(order.status || 'pending', 40).toLowerCase() || 'pending';
    const orderNotification = await saveCustomerNotification(uid, {
        scope: 'customer',
        type: 'order',
        audience: 'customer',
        title: options.statusChange === true ? `\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 #${orderNumber}` : `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u062C\u062F\u064A\u062F #${orderNumber}`,
        body: options.statusChange === true
            ? `\u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629: ${getNotificationOrderStatusLabel(status)}`
            : `\u0627\u0633\u062A\u0644\u0645\u0646\u0627 \u0637\u0644\u0628\u0643 \u0628\u0646\u062C\u0627\u062D. \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629: ${getNotificationOrderStatusLabel(status)}`,
        action: {
            kind: 'account-tab',
            tab: 'orders',
            orderId,
            orderNumber,
            status
        },
        source: options.source || (options.statusChange === true ? 'order:status-update' : 'order:create'),
        readByCustomer: false,
        readByAdmin: true,
        createdByRole
    }, {
        id: options.id || (options.statusChange === true ? `order_status_${orderId}_${status}` : `order_created_${orderId}`)
    }).catch(() => null);
    if (orderNotification) result.push(orderNotification);

    const earnedPoints = Number(order.earnedPoints || 0);
    const usedPoints = Number(order.usedPoints || 0);
    if (options.includePoints !== false && (earnedPoints > 0 || usedPoints > 0)) {
        const pointChunks = [];
        if (earnedPoints > 0) pointChunks.push(`\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 ${earnedPoints} \u0646\u0642\u0637\u0629`);
        if (usedPoints > 0) pointChunks.push(`\u062A\u0645 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 ${usedPoints} \u0646\u0642\u0637\u0629`);
        const pointsNotification = await saveCustomerNotification(uid, {
            scope: 'customer',
            type: 'point',
            audience: 'customer',
            title: '\u062A\u062D\u062F\u064A\u062B \u0646\u0642\u0627\u0637 \u0627\u0644\u0648\u0644\u0627\u0621',
            body: pointChunks.join(' \u2022 ') || '\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0646\u0642\u0627\u0637 \u0627\u0644\u0648\u0644\u0627\u0621 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0643.',
            action: {
                kind: 'account-tab',
                tab: 'points',
                orderId,
                orderNumber
            },
            source: options.pointsSource || 'order:points',
            readByCustomer: false,
            readByAdmin: true,
            createdByRole
        }, {
            id: `points_${orderId}`
        }).catch(() => null);
        if (pointsNotification) result.push(pointsNotification);
    }

    return result;
}

async function createSupportNotificationForMessage(threadId, messageRecord, threadRecord = {}) {
    const threadUid = normalizeNotificationText(threadId || threadRecord.uid, 200);
    if (!threadUid || !messageRecord) return null;
    const isCustomer = String(messageRecord.senderRole || '').trim().toLowerCase() === 'customer';
    const customerName = normalizeNotificationText(threadRecord.customerName || '\u0639\u0645\u064A\u0644', 120) || '\u0639\u0645\u064A\u0644';
    const previewSource = typeof buildSupportMessagePreview === 'function'
        ? buildSupportMessagePreview(messageRecord)
        : String(messageRecord.message || messageRecord.text || '').trim();
    const messagePreview = normalizeNotificationText(previewSource, 180);
    return saveCustomerNotification(threadUid, {
        scope: 'customer',
        type: 'chat',
        audience: isCustomer ? 'admin' : 'customer',
        title: isCustomer ? `\u0631\u0633\u0627\u0644\u0629 \u062F\u0639\u0645 \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 ${customerName}` : '\u0631\u0633\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 \u0627\u0644\u062F\u0639\u0645',
        body: messagePreview || (isCustomer ? '\u0623\u0631\u0633\u0644 \u0627\u0644\u0639\u0645\u064A\u0644 \u0631\u0633\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0625\u0644\u0649 \u0627\u0644\u062F\u0639\u0645.' : '\u0623\u0631\u0633\u0644 \u0627\u0644\u062F\u0639\u0645 \u0631\u0633\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0625\u0644\u0649 \u0627\u0644\u0639\u0645\u064A\u0644.'),
        action: {
            kind: 'support-thread',
            tab: 'messages',
            threadId: threadUid,
            customerUid: threadUid
        },
        source: isCustomer ? 'support:customer-message' : 'support:admin-message',
        readByCustomer: isCustomer,
        readByAdmin: !isCustomer,
        createdByRole: isCustomer ? 'customer' : 'admin'
    }, {
        id: `${isCustomer ? 'chat_admin' : 'chat_customer'}_${threadUid}_${normalizeNotificationText(messageRecord.id || '', 200) || Date.now()}`
    }).catch(() => null);
}

function normalizeLiveSessionPayload(payload) {
    const safe = payload && typeof payload === 'object' ? payload : {};
    const now = new Date().toISOString();
    return {
        sessionId: String(safe.sessionId || ''),
        page: String(safe.page || window.location.pathname || ''),
        href: String(safe.href || window.location.href || ''),
        online: typeof safe.online === 'boolean' ? safe.online : navigator.onLine,
        customerId: String(safe.customerId || ''),
        customerPhone: String(safe.customerPhone || ''),
        device: String(safe.device || ''),
        userAgent: String(safe.userAgent || navigator.userAgent || ''),
        updatedAt: String(safe.updatedAt || now),
        createdAt: String(safe.createdAt || now)
    };
}

async function upsertLiveSession(payload) {
    try {
        if (isTelemetryWriteSuspended()) {
            return { ok: false, skipped: true, reason: 'telemetry-write-paused' };
        }
        const normalized = normalizeLiveSessionPayload(payload);
        if (!normalized.sessionId) throw new Error('sessionId required');
        const readyState = await ensureStorefrontFirestoreAuthReady({
            targetUid: normalized.customerId,
            timeoutMs: 2500
        });
        if (!readyState.ready) {
            return {
                ok: false,
                skipped: true,
                reason: readyState.reason,
                authUid: readyState.authUid || '',
                id: normalized.sessionId
            };
        }
        const fireDB = getFirebaseDB();
        normalized.customerId = String(readyState.authUid || normalized.customerId || '').trim();
        await fireDB.collection('store_live_sessions').doc(normalized.sessionId).set(normalized, { merge: true });
        return {
            ok: true,
            id: normalized.sessionId,
            reason: 'authenticated-path',
            authUid: normalized.customerId
        };
    } catch (e) {
        if (isTransientTransportError(e)) {
            suspendTelemetryWrites(getErrorMessage(e), 45000);
        }
        const normalizedError = normalizeFirebaseError(e, 'upsertLiveSession');
        if (!normalizedError.permissionDenied) {
            console.warn('upsertLiveSession warning:', e && e.message ? e.message : e);
        }
        return {
            ok: false,
            skipped: false,
            reason: normalizedError.permissionDenied ? 'permission-denied-after-ready' : (normalizedError.code || 'unknown'),
            error: normalizedError.message,
            code: normalizedError.code || 'unknown'
        };
    }
}

async function removeLiveSession(sessionId) {
    try {
        const id = String(sessionId || '').trim();
        if (!id) return { ok: false, error: 'sessionId required' };
        // Soft-close instead of delete because delete is admin-only in Firestore rules.
        return await upsertLiveSession({
            sessionId: id,
            online: false,
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.warn('removeLiveSession warning:', e && e.message ? e.message : e);
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
}

function subscribeLiveSessions(onData, onError, limitCount = 200) {
    try {
        const fireDB = getFirebaseDB();
        const safeLimit = Math.max(1, Math.min(1000, Number(limitCount) || 200));
        return fireDB
            .collection('store_live_sessions')
            .orderBy('updatedAt', 'desc')
            .limit(safeLimit)
            .onSnapshot(
                (snapshot) => {
                    const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (typeof onData === 'function') onData(rows);
                },
                (error) => {
                    if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeLiveSessions.listener'));
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(normalizeFirebaseError(e, 'subscribeLiveSessions.setup'));
        return null;
    }
}

// ==========================================
// SUPPORT CHAT (Internal Customer/Admin)
// ==========================================
function getFirebaseErrorCode(error) {
    const rawCode = String(error && (error.code || error.errorCode) || '').trim().toLowerCase();
    if (!rawCode) return '';
    return rawCode.startsWith('firebase/') ? rawCode.slice('firebase/'.length) : rawCode;
}

function isPermissionDeniedError(error) {
    if (!error) return false;
    if (error.permissionDenied === true) return true;
    const code = getFirebaseErrorCode(error);
    if (code === 'permission-denied' || code === 'permission_denied') return true;
    const message = String(error && error.message || error || '').toLowerCase();
    return message.includes('missing or insufficient permissions')
        || message.includes('insufficient permissions')
        || message.includes('permission-denied');
}

function normalizeFirebaseError(error, source = '') {
    const code = getFirebaseErrorCode(error);
    const message = String(error && error.message || error || 'unknown firebase error');
    return {
        source: String(source || 'firebase'),
        code: code || 'unknown',
        message,
        permissionDenied: isPermissionDeniedError(error),
        original: error || null
    };
}

function normalizeSupportText(value, max = 4000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const SUPPORT_THREAD_STATUS_VALUES = ['open', 'active', 'waiting', 'pending', 'closed'];
const SUPPORT_MESSAGE_TYPE_VALUES = ['text', 'image', 'file', 'action'];
const SUPPORT_ALLOWED_ATTACHMENT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx'];
const SUPPORT_ALLOWED_ATTACHMENT_MIME_TYPES = {
    'image/jpeg': 'image',
    'image/jpg': 'image',
    'image/png': 'image',
    'image/webp': 'image',
    'image/gif': 'image',
    'application/pdf': 'file',
    'application/msword': 'file',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file'
};
const SUPPORT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function normalizeSupportStatus(value, fallback = 'active') {
    const raw = normalizeSupportText(value || fallback, 32).toLowerCase();
    if (raw === 'open') return 'active';
    return SUPPORT_THREAD_STATUS_VALUES.includes(raw) ? raw : fallback;
}

function normalizeSupportTypingPayload(payload, defaults = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const uid = normalizeSupportText(source.uid || base.uid, 200);
    if (!uid) return null;
    const role = ['customer', 'admin'].includes(String(source.role || base.role || 'customer'))
        ? String(source.role || base.role || 'customer')
        : 'customer';
    const timestampMs = Number(source.timestampMs || base.timestampMs || Date.now());
    return {
        uid,
        displayName: normalizeSupportText(source.displayName || base.displayName, 200),
        role,
        isTyping: source.isTyping === true,
        timestampMs: Number.isFinite(timestampMs) ? timestampMs : Date.now()
    };
}

function normalizeSupportRatingPayload(payload, defaults = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const score = Math.max(1, Math.min(5, Math.round(Number(source.score || base.score || 0))));
    const createdByUid = normalizeSupportText(source.createdByUid || base.createdByUid, 200);
    if (!score || !createdByUid) return null;
    return {
        score,
        comment: normalizeSupportText(source.comment || base.comment, 600),
        createdAt: normalizeSupportText(source.createdAt || base.createdAt || new Date().toISOString(), 60),
        createdByUid
    };
}

function getSupportAttachmentExtension(payload = {}) {
    const fileName = String(payload.name || payload.fileName || payload.publicId || '').trim();
    const match = fileName.match(/\.([a-z0-9]+)$/i);
    return match ? String(match[1] || '').toLowerCase() : '';
}

function normalizeSupportAttachmentPayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const url = normalizeSupportText(source.url || source.secure_url, 2000);
    if (!url) return null;
    const mimeType = normalizeSupportText(source.mimeType || source.type, 160).toLowerCase();
    const extension = getSupportAttachmentExtension(source);
    const inferredKind = SUPPORT_ALLOWED_ATTACHMENT_MIME_TYPES[mimeType]
        || (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? 'image' : 'file');
    if (mimeType && !(mimeType in SUPPORT_ALLOWED_ATTACHMENT_MIME_TYPES) && !SUPPORT_ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
        return null;
    }
    const size = Number(source.size || 0);
    return {
        url,
        publicId: normalizeSupportText(source.publicId || source.public_id, 400),
        name: normalizeSupportText(source.name || source.fileName || 'attachment', 240),
        size: Number.isFinite(size) ? Math.max(0, Math.min(size, SUPPORT_MAX_ATTACHMENT_BYTES)) : 0,
        mimeType,
        width: Number.isFinite(Number(source.width)) ? Math.max(0, Number(source.width)) : 0,
        height: Number.isFinite(Number(source.height)) ? Math.max(0, Number(source.height)) : 0,
        extension,
        kind: inferredKind
    };
}

function normalizeSupportActionPayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const kind = normalizeSupportText(source.kind, 32).toLowerCase();
    if (!['order', 'product'].includes(kind)) return null;
    if (kind === 'order') {
        return {
            kind,
            orderId: normalizeSupportText(source.orderId, 200),
            orderNumber: normalizeSupportText(source.orderNumber, 80),
            orderTotal: Number.isFinite(Number(source.orderTotal)) ? Number(source.orderTotal) : 0,
            orderStatus: normalizeSupportText(source.orderStatus, 40)
        };
    }
    return {
        kind,
        productId: normalizeSupportText(source.productId, 200),
        productName: normalizeSupportText(source.productName, 200),
        code: normalizeSupportText(source.code, 120),
        sku: normalizeSupportText(source.sku, 120),
        price: Number.isFinite(Number(source.price)) ? Number(source.price) : 0,
        image: normalizeSupportText(source.image, 800)
    };
}

function normalizeSupportThreadPayload(payload, defaults = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const now = new Date().toISOString();
    const threadUid = normalizeSupportText(source.uid || base.uid || source.customerUid || base.customerUid, 200);
    const typing = source.typing === null
        ? null
        : normalizeSupportTypingPayload(source.typing, base.typing || {});
    const rating = source.rating === null
        ? null
        : normalizeSupportRatingPayload(source.rating, base.rating || {});

    return {
        uid: threadUid,
        customerName: normalizeSupportText(source.customerName || base.customerName, 200),
        customerPhone: normalizeSupportText(source.customerPhone || base.customerPhone, 50),
        customerEmail: normalizeSupportText(source.customerEmail || base.customerEmail, 200).toLowerCase(),
        status: normalizeSupportStatus(source.status || base.status || 'active', normalizeSupportStatus(base.status || 'active', 'active')),
        lastMessage: normalizeSupportText(source.lastMessage || base.lastMessage, 600),
        lastMessageAt: normalizeSupportText(source.lastMessageAt || base.lastMessageAt || now, 60),
        lastSenderRole: ['customer', 'admin'].includes(String(source.lastSenderRole || base.lastSenderRole || 'customer'))
            ? String(source.lastSenderRole || base.lastSenderRole || 'customer')
            : 'customer',
        unreadForAdmin: Number.isFinite(Number(source.unreadForAdmin))
            ? Math.max(0, Number(source.unreadForAdmin))
            : Math.max(0, Number(base.unreadForAdmin || 0)),
        unreadForCustomer: Number.isFinite(Number(source.unreadForCustomer))
            ? Math.max(0, Number(source.unreadForCustomer))
            : Math.max(0, Number(base.unreadForCustomer || 0)),
        typing,
        rating,
        createdAt: normalizeSupportText(source.createdAt || base.createdAt || now, 60),
        updatedAt: normalizeSupportText(source.updatedAt || now, 60)
    };
}

function normalizeSupportThreadRecord(data, threadId = '') {
    const base = normalizeSupportThreadPayload(data || {});
    return {
        id: String(threadId || data && data.id || ''),
        uid: base.uid,
        customerUid: base.uid,
        customerId: String(base.uid || ''),
        customerName: base.customerName,
        customerPhone: base.customerPhone,
        customerEmail: base.customerEmail,
        status: normalizeSupportStatus(base.status || 'active', 'active'),
        lastMessage: base.lastMessage,
        lastMessageAt: base.lastMessageAt,
        lastSenderRole: base.lastSenderRole,
        unreadForAdmin: Math.max(0, Number(base.unreadForAdmin || 0)),
        unreadForCustomer: Math.max(0, Number(base.unreadForCustomer || 0)),
        typing: base.typing || null,
        rating: base.rating || null,
        createdAt: base.createdAt,
        updatedAt: base.updatedAt
    };
}

function normalizeSupportMessagePayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const attachment = normalizeSupportAttachmentPayload(source.attachment);
    const action = normalizeSupportActionPayload(source.action);
    const explicitType = normalizeSupportText(source.type || source.messageType, 20).toLowerCase();
    const createdAtMs = Number(source.createdAtMs);
    let type = SUPPORT_MESSAGE_TYPE_VALUES.includes(explicitType) ? explicitType : '';
    if (!type) {
        if (action) type = 'action';
        else if (attachment) type = attachment.kind === 'image' ? 'image' : 'file';
        else type = 'text';
    }
    const message = normalizeSupportText(source.message || source.text, 2000);
    return {
        threadId: normalizeSupportText(source.threadId, 200),
        senderRole: ['customer', 'admin'].includes(String(source.senderRole || 'customer'))
            ? String(source.senderRole || 'customer')
            : 'customer',
        senderUid: normalizeSupportText(source.senderUid, 200),
        senderName: normalizeSupportText(source.senderName, 200),
        message,
        text: message,
        type,
        attachment,
        action,
        createdAt: normalizeSupportText(source.createdAt || new Date().toISOString(), 60),
        createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : Date.now()
    };
}

function normalizeSupportMessageRecord(data, messageId = '') {
    const base = normalizeSupportMessagePayload(data || {});
    return {
        id: String(messageId || data && data.id || ''),
        threadId: base.threadId,
        senderRole: base.senderRole,
        senderUid: base.senderUid,
        senderName: base.senderName,
        message: base.message,
        text: base.text,
        type: base.type,
        attachment: base.attachment || null,
        action: base.action || null,
        createdAt: base.createdAt,
        createdAtMs: base.createdAtMs
    };
}

function buildSupportMessagePreview(messageRecord) {
    const record = normalizeSupportMessageRecord(messageRecord || {});
    if (record.type === 'action' && record.action) {
        if (record.action.kind === 'order') {
            return `إجراء طلب ${record.action.orderNumber || record.action.orderId || ''}`.trim();
        }
        if (record.action.kind === 'product') {
            return `إجراء منتج ${record.action.productName || record.action.code || record.action.productId || ''}`.trim();
        }
    }
    if (record.type === 'image') {
        return record.message || `أرسل صورة${record.attachment && record.attachment.name ? `: ${record.attachment.name}` : ''}`;
    }
    if (record.type === 'file') {
        return record.message || `أرسل ملفًا${record.attachment && record.attachment.name ? `: ${record.attachment.name}` : ''}`;
    }
    return record.message || 'رسالة جديدة';
}

function buildSupportThreadId(customerUid) {
    return normalizeSupportText(customerUid, 200);
}

async function ensureSupportThreadByUid(uid, profile = {}) {
    const normalizedUid = normalizeSupportText(uid, 200);
    if (!normalizedUid) throw new Error('uid is required');
    return getOrCreateSupportThread({
        uid: normalizedUid,
        customerUid: normalizedUid,
        customerName: profile.customerName || profile.displayName || profile.name || '',
        customerEmail: profile.customerEmail || profile.email || '',
        customerPhone: profile.customerPhone || profile.phone || ''
    });
}

async function sendSupportMessageByUid(uid, text, options = {}) {
    const normalizedUid = normalizeSupportText(uid, 200);
    const normalizedText = normalizeSupportText(text, 2000);
    const attachment = normalizeSupportAttachmentPayload(options.attachment);
    const action = normalizeSupportActionPayload(options.action);
    if (!normalizedUid) throw new Error('uid is required');
    if (!normalizedText && !attachment && !action) throw new Error('message required');

    const authUid = normalizeSupportText(options.senderUid || '', 200) || normalizedUid;
    const senderRole = options.senderRole === 'admin' ? 'admin' : 'customer';
    const senderName = normalizeSupportText(options.senderName || '', 200);

    await ensureSupportThreadByUid(normalizedUid, options.profile || {});

    return addSupportMessage({
        threadId: normalizedUid,
        senderRole,
        senderUid: authUid,
        senderName,
        message: normalizedText,
        type: options.messageType || options.type || '',
        attachment,
        action,
        createdAt: new Date().toISOString(),
        createdAtMs: Date.now()
    });
}

async function getOrCreateSupportThread(customerProfile) {
    try {
        const db = getFirebaseDB();
        const profile = customerProfile && typeof customerProfile === 'object' ? customerProfile : {};
        const customerUid = normalizeSupportText(profile.uid || profile.customerUid, 200);
        if (!customerUid) throw new Error('customer uid required');

        const threadId = buildSupportThreadId(customerUid);
        const ref = db.collection('support_threads').doc(threadId);
        let snapshot = null;
        let base = {};
        try {
            snapshot = await ref.get();
            base = snapshot.exists ? (snapshot.data() || {}) : {};
        } catch (readError) {
            const normalizedReadError = normalizeFirebaseError(readError, 'getOrCreateSupportThread.read');
            if (!normalizedReadError.permissionDenied) throw readError;
            // Firestore rules can deny reads on missing docs; proceed with write path.
            snapshot = null;
            base = {};
        }

        if (snapshot && snapshot.exists) {
            const uiRecord = normalizeSupportThreadPayload({
                ...base,
                uid: customerUid,
                customerName: profile.customerName || profile.name || base.customerName || '',
                customerPhone: profile.customerPhone || profile.phone || profile.phoneNormalized || base.customerPhone || '',
                customerEmail: profile.customerEmail || profile.email || base.customerEmail || ''
            }, base);
            return normalizeSupportThreadRecord(uiRecord, threadId);
        }

        const nowIso = new Date().toISOString();
        const normalized = normalizeSupportThreadPayload({
            uid: customerUid,
            customerName: profile.customerName || profile.name || '',
            customerPhone: profile.customerPhone || profile.phone || profile.phoneNormalized || '',
            customerEmail: profile.customerEmail || profile.email || '',
            status: 'active',
            createdAt: nowIso,
            updatedAt: nowIso
        }, {});
        if (normalized.rating == null) {
            delete normalized.rating;
        }

        await ref.set(normalized, { merge: true });
        return normalizeSupportThreadRecord(normalized, threadId);
    } catch (e) {
        console.error('getOrCreateSupportThread error:', e);
        throw e;
    }
}

async function addSupportMessage(payload) {
    try {
        const db = getFirebaseDB();
        const normalized = normalizeSupportMessagePayload(payload);
        if (!normalized.threadId) throw new Error('threadId required');
        if (!normalized.message && !normalized.attachment && !normalized.action) throw new Error('message required');

        const threadRef = db.collection('support_threads').doc(normalized.threadId);
        const threadSnapshot = await threadRef.get();
        if (!threadSnapshot.exists) {
            throw new Error('support thread not found');
        }
        const threadData = normalizeSupportThreadRecord(threadSnapshot.data() || {}, normalized.threadId);

        const messagePayload = {
            threadId: normalized.threadId,
            senderRole: normalized.senderRole,
            senderUid: normalized.senderUid,
            senderName: normalized.senderName,
            message: normalized.message,
            text: normalized.text,
            type: normalized.type,
            createdAt: normalized.createdAt,
            createdAtMs: normalized.createdAtMs
        };
        if (normalized.attachment) {
            messagePayload.attachment = normalized.attachment;
        }
        if (normalized.action) {
            messagePayload.action = normalized.action;
        }

        const messageRef = await threadRef
            .collection('messages')
            .add(messagePayload);

        const isCustomer = normalized.senderRole === 'customer';
        const unreadForAdmin = isCustomer
            ? Math.max(0, Number(threadData.unreadForAdmin || 0)) + 1
            : 0;
        const unreadForCustomer = isCustomer
            ? Math.max(0, Number(threadData.unreadForCustomer || 0))
            : Math.max(0, Number(threadData.unreadForCustomer || 0)) + 1;

        await threadRef.set({
            lastMessage: buildSupportMessagePreview(messagePayload).slice(0, 600),
            lastMessageAt: normalized.createdAt,
            lastSenderRole: normalized.senderRole,
            updatedAt: normalized.createdAt,
            status: isCustomer ? 'waiting' : 'pending',
            unreadForAdmin,
            unreadForCustomer,
            typing: {
                uid: normalized.senderUid,
                displayName: normalized.senderName,
                role: normalized.senderRole,
                isTyping: false,
                timestampMs: normalized.createdAtMs
            }
        }, { merge: true });

        const createdMessage = { id: messageRef.id, ...messagePayload };
        await createSupportNotificationForMessage(normalized.threadId, createdMessage, {
            ...threadData,
            customerName: threadData.customerName || '',
            customerEmail: threadData.customerEmail || '',
            customerPhone: threadData.customerPhone || ''
        }).catch((notificationError) => {
            console.warn('addSupportMessage notification warning:', notificationError && notificationError.message ? notificationError.message : notificationError);
        });

        return createdMessage;
    } catch (e) {
        console.error('addSupportMessage error:', e);
        throw e;
    }
}

async function getSupportThreads(limitCount = 100, options = {}) {
    try {
        const db = getFirebaseDB();
        const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 100));
        const snapshot = await db.collection('support_threads')
            .orderBy('updatedAt', 'desc')
            .limit(safeLimit)
            .get();
        return snapshot.docs.map((doc) => normalizeSupportThreadRecord(doc.data() || {}, doc.id));
    } catch (e) {
        const normalized = normalizeFirebaseError(e, 'getSupportThreads');
        console.error('getSupportThreads error:', normalized.message);
        if (options && options.strict === true) {
            throw normalized;
        }
        return [];
    }
}

async function getSupportThread(threadId) {
    try {
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return null;
        const db = getFirebaseDB();
        const snapshot = await db.collection('support_threads').doc(normalizedThreadId).get();
        if (!snapshot.exists) return null;
        return normalizeSupportThreadRecord(snapshot.data() || {}, snapshot.id);
    } catch (e) {
        console.error('getSupportThread error:', e);
        return null;
    }
}

async function getSupportMessages(threadId, limitCount = 200, options = {}) {
    try {
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return [];
        const db = getFirebaseDB();
        const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 200));
        const snapshot = await db.collection('support_threads')
            .doc(normalizedThreadId)
            .collection('messages')
            .orderBy('createdAtMs', 'desc')
            .limit(safeLimit)
            .get();
        return snapshot.docs.map((doc) => normalizeSupportMessageRecord(doc.data() || {}, doc.id)).reverse();
    } catch (e) {
        const normalized = normalizeFirebaseError(e, 'getSupportMessages');
        console.error('getSupportMessages error:', normalized.message);
        if (options && options.strict === true) {
            throw normalized;
        }
        return [];
    }
}

async function listSupportMessagesPage(threadId, options = {}) {
    try {
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return { items: [], hasMore: false, cursor: null };
        const db = getFirebaseDB();
        const safeLimit = Math.max(1, Math.min(200, Number(options.limit) || 50));
        const beforeCreatedAtMs = Number(options.beforeCreatedAtMs || 0);
        let query = db.collection('support_threads')
            .doc(normalizedThreadId)
            .collection('messages')
            .orderBy('createdAtMs', 'desc')
            .limit(safeLimit);
        if (Number.isFinite(beforeCreatedAtMs) && beforeCreatedAtMs > 0) {
            query = query.where('createdAtMs', '<', beforeCreatedAtMs);
        }
        const snapshot = await query.get();
        const items = snapshot.docs.map((doc) => normalizeSupportMessageRecord(doc.data() || {}, doc.id)).reverse();
        return {
            items,
            hasMore: snapshot.size >= safeLimit,
            cursor: items.length ? Number(items[0].createdAtMs || 0) : null
        };
    } catch (e) {
        const normalized = normalizeFirebaseError(e, 'listSupportMessagesPage');
        console.error('listSupportMessagesPage error:', normalized.message);
        if (options && options.strict === true) {
            throw normalized;
        }
        return { items: [], hasMore: false, cursor: null };
    }
}

function subscribeSupportThreads(onData, onError, limitCount = 100) {
    try {
        const db = getFirebaseDB();
        const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 100));
        return db.collection('support_threads')
            .orderBy('updatedAt', 'desc')
            .limit(safeLimit)
            .onSnapshot(
                (snapshot) => {
                    const rows = snapshot.docs.map((doc) => normalizeSupportThreadRecord(doc.data() || {}, doc.id));
                    if (typeof onData === 'function') onData(rows);
                },
                (error) => {
                    if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeSupportThreads.listener'));
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(normalizeFirebaseError(e, 'subscribeSupportThreads.setup'));
        return null;
    }
}

function subscribeSupportThread(threadId, onData, onError) {
    try {
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return null;
        const db = getFirebaseDB();
        return db.collection('support_threads')
            .doc(normalizedThreadId)
            .onSnapshot(
                (doc) => {
                    if (typeof onData === 'function') {
                        onData(doc.exists ? normalizeSupportThreadRecord(doc.data() || {}, doc.id) : null);
                    }
                },
                (error) => {
                    if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeSupportThread.listener'));
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(normalizeFirebaseError(e, 'subscribeSupportThread.setup'));
        return null;
    }
}

function subscribeSupportMessages(threadId, onData, onError, limitCount = 200) {
    try {
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return null;
        const db = getFirebaseDB();
        const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 200));
        return db.collection('support_threads')
            .doc(normalizedThreadId)
            .collection('messages')
            .orderBy('createdAtMs', 'desc')
            .limit(safeLimit)
            .onSnapshot(
                (snapshot) => {
                    const rows = snapshot.docs.map((doc) => normalizeSupportMessageRecord(doc.data() || {}, doc.id)).reverse();
                    if (typeof onData === 'function') onData(rows);
                },
                (error) => {
                    if (typeof onError === 'function') onError(normalizeFirebaseError(error, 'subscribeSupportMessages.listener'));
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(normalizeFirebaseError(e, 'subscribeSupportMessages.setup'));
        return null;
    }
}

async function markSupportThreadReadByAdmin(threadId) {
    try {
        const db = getFirebaseDB();
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return false;
        await db.collection('support_threads').doc(normalizedThreadId).set({
            unreadForAdmin: 0,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('markSupportThreadReadByAdmin error:', e);
        return false;
    }
}

async function markSupportThreadReadByCustomer(threadId) {
    try {
        const db = getFirebaseDB();
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return false;
        await db.collection('support_threads').doc(normalizedThreadId).set({
            unreadForCustomer: 0,
            updatedAt: new Date().toISOString(),
            typing: null
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('markSupportThreadReadByCustomer error:', e);
        return false;
    }
}

async function setSupportThreadTyping(threadId, payload = {}) {
    try {
        const db = getFirebaseDB();
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return false;
        const typing = normalizeSupportTypingPayload(payload, {
            uid: normalizeSupportText(payload.uid, 200),
            displayName: normalizeSupportText(payload.displayName || payload.senderName, 200),
            role: payload.role || payload.senderRole || 'customer',
            isTyping: payload.isTyping === true,
            timestampMs: Date.now()
        });
        await db.collection('support_threads').doc(normalizedThreadId).set({
            typing,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('setSupportThreadTyping error:', e);
        return false;
    }
}

async function reopenSupportThread(threadId) {
    try {
        const db = getFirebaseDB();
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return false;
        await db.collection('support_threads').doc(normalizedThreadId).set({
            status: 'active',
            typing: null,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('reopenSupportThread error:', e);
        return false;
    }
}

async function saveSupportThreadRating(threadId, payload = {}) {
    try {
        const db = getFirebaseDB();
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) throw new Error('threadId required');
        const rating = normalizeSupportRatingPayload(payload);
        if (!rating) throw new Error('rating required');
        const ref = db.collection('support_threads').doc(normalizedThreadId);
        const snapshot = await ref.get();
        if (!snapshot.exists) throw new Error('support thread not found');
        const thread = normalizeSupportThreadRecord(snapshot.data() || {}, snapshot.id);
        if (thread.status !== 'closed') throw new Error('thread must be closed before rating');
        if (thread.rating && Number(thread.rating.score || 0) > 0) {
            throw new Error('rating already submitted');
        }
        await ref.set({
            rating,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return rating;
    } catch (e) {
        console.error('saveSupportThreadRating error:', e);
        throw e;
    }
}

async function closeSupportThread(threadId) {
    try {
        const db = getFirebaseDB();
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return false;
        await db.collection('support_threads').doc(normalizedThreadId).set({
            status: 'closed',
            typing: null,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('closeSupportThread error:', e);
        return false;
    }
}

console.log('[OK] Firebase API loaded');
