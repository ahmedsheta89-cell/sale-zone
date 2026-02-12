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

// ==========================================
// COUPONS
// ==========================================
async function getCoupons() {
    try {
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
        return null;
    }
}

async function addCoupon(coupon) {
    try {
        const docRef = await db.collection('coupons').add(coupon);
        console.log('[OK] Coupon added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addCoupon error:', e);
        throw e;
    }
}

async function updateCoupon(id, data) {
    try {
        await db.collection('coupons').doc(id).set(data, { merge: true });
        console.log('[OK] Coupon updated in Firebase:', id);
    } catch (e) {
        console.error('updateCoupon error:', e);
        throw e;
    }
}

async function deleteCoupon(id) {
    try {
        await db.collection('coupons').doc(id).delete();
        console.log('[OK] Coupon deleted from Firebase:', id);
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
        return null;
    }
}

async function addBanner(banner) {
    try {
        const docRef = await db.collection('banners').add(banner);
        console.log('[OK] Banner added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addBanner error:', e);
        throw e;
    }
}

async function updateBanner(id, data) {
    try {
        await db.collection('banners').doc(id).set(data, { merge: true });
        console.log('[OK] Banner updated in Firebase:', id);
    } catch (e) {
        console.error('updateBanner error:', e);
        throw e;
    }
}

async function deleteBanner(id) {
    try {
        await db.collection('banners').doc(id).delete();
        console.log('[OK] Banner deleted from Firebase:', id);
    } catch (e) {
        console.error('deleteBanner error:', e);
        throw e;
    }
}

// ==========================================
// PRODUCTS
// ==========================================
async function getAllProducts() {
    try {
        const db = getFirebaseDB();
        const snapshot = await db.collection('products').get();
        const products = snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                name: data.name || '',
                desc: data.desc || '',
                category: data.category || '',
                price: data.price || 0,
                oldPrice: data.oldPrice || null,
                image: data.image || '',
                rating: data.rating || 4.5,
                ratingCount: data.ratingCount || 0
            };
        });
        return products;
    } catch (e) {
        console.error('getAllProducts error:', e);
        return null;
    }
}

async function addProduct(product) {
    try {
        const docRef = await db.collection('products').add(product);
        console.log('[OK] Product added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addProduct error:', e);
        throw e;
    }
}

async function updateProduct(id, data) {
    try {
        await db.collection('products').doc(id).set(data, { merge: true });
        console.log('[OK] Product updated in Firebase:', id);
    } catch (e) {
        console.error('updateProduct error:', e);
        throw e;
    }
}

async function deleteProductFromFirebase(id) {
    try {
        await db.collection('products').doc(id).delete();
        console.log('[OK] Product deleted from Firebase:', id);
    } catch (e) {
        console.error('deleteProduct error:', e);
        throw e;
    }
}

// ==========================================
// ORDERS
// ==========================================
async function getAllOrders() {
    try {
        const db = getFirebaseDB();
        const snapshot = await db.collection('orders').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllOrders error:', e);
        return null;
    }
}

async function addOrder(order) {
    try {
        const docRef = await db.collection('orders').add(order);
        console.log('[OK] Order added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addOrder error:', e);
        throw e;
    }
}

async function updateOrderStatus(id, status) {
    try {
        await db.collection('orders').doc(id).update({ status: status });
        console.log('[OK] Order status updated:', id);
    } catch (e) {
        console.error('updateOrderStatus error:', e);
        throw e;
    }
}

// ==========================================
// USERS
// ==========================================
async function getAllUsers() {
    try {
        const db = getFirebaseDB();
        const snapshot = await db.collection('customers').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllUsers error:', e);
        return null;
    }
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

async function addCustomer(customer) {
    try {
        const db = getFirebaseDB();
        const normalizedPhone = normalizePhoneForCustomer(customer && (customer.phoneNormalized || customer.phone));
        const payload = {
            ...(customer || {}),
            phoneNormalized: normalizedPhone || String(customer && customer.phoneNormalized || '')
        };

        if (normalizedPhone) {
            const existingSnapshot = await db
                .collection('customers')
                .where('phoneNormalized', '==', normalizedPhone)
                .limit(1)
                .get();

            if (!existingSnapshot.empty) {
                const existingDoc = existingSnapshot.docs[0];

                // When upserting an existing customer from the store client, we must not
                // accidentally change system fields (createdAt / loyaltyPoints / password).
                // This also keeps Firestore rules self-update checks happy.
                const existingData = existingDoc.data() || {};
                const safePayload = { ...payload };
                if ('createdAt' in existingData) safePayload.createdAt = existingData.createdAt;
                else delete safePayload.createdAt;
                if ('loyaltyPoints' in existingData) safePayload.loyaltyPoints = existingData.loyaltyPoints;
                else delete safePayload.loyaltyPoints;
                if ('password' in existingData) safePayload.password = existingData.password;
                else delete safePayload.password;

                await db.collection('customers').doc(existingDoc.id).set(safePayload, { merge: true });
                console.log('✅ Customer upserted in Firebase:', existingDoc.id);
                return existingDoc.id;
            }

            const deterministicId = `phone_${normalizedPhone}`;
            await db.collection('customers').doc(deterministicId).set(payload, { merge: true });
            console.log('✅ Customer added to Firebase:', deterministicId);
            return deterministicId;
        }

        const docRef = await db.collection('customers').add(payload);
        console.log('✅ Customer added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addCustomer error:', e);
        throw e;
    }
}

async function updateCustomer(id, data) {
    try {
        const db = getFirebaseDB();
        await db.collection('customers').doc(String(id)).set(data, { merge: true });
        console.log('✅ Customer updated in Firebase:', id);
    } catch (e) {
        console.error('updateCustomer error:', e);
        throw e;
    }
}

async function deleteCustomerFromFirebase(id) {
    try {
        const db = getFirebaseDB();
        await db.collection('customers').doc(String(id)).delete();
        console.log('✅ Customer deleted from Firebase:', id);
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
        const db = getFirebaseDB();
        const snapshot = await db.collection('coupons').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllCoupons error:', e);
        return null;
    }
}

async function addCoupon(coupon) {
    try {
        const docRef = await db.collection('coupons').add(coupon);
        console.log('[OK] Coupon added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addCoupon error:', e);
        throw e;
    }
}

async function deleteCouponFromFirebase(id) {
    try {
        await db.collection('coupons').doc(id).delete();
        console.log('[OK] Coupon deleted from Firebase:', id);
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
        const db = getFirebaseDB();
        const snapshot = await db.collection('banners').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllBanners error:', e);
        return null;
    }
}

async function addBanner(banner) {
    try {
        const docRef = await db.collection('banners').add(banner);
        console.log('[OK] Banner added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addBanner error:', e);
        throw e;
    }
}

async function deleteBannerFromFirebase(id) {
    try {
        await db.collection('banners').doc(id).delete();
        console.log('[OK] Banner deleted from Firebase:', id);
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
        return doc.exists ? doc.data() : null;
    } catch (e) {
        console.error('getSettings error:', e);
        return null;
    }
}

async function saveSettings(settings) {
    try {
        const db = getFirebaseDB();
        await db.collection('settings').doc('store').set(settings, { merge: true });
        console.log('[OK] Settings saved to Firebase');
    } catch (e) {
        console.error('saveSettings error:', e);
        throw e;
    }
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
        const fireDB = getFirebaseDB();
        const normalized = normalizeStoreEventPayload(payload);
        const docRef = await fireDB.collection('store_events').add(normalized);
        return { ok: true, id: docRef.id };
    } catch (e) {
        if (isTransientTransportError(e)) {
            suspendTelemetryWrites(getErrorMessage(e), 45000);
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
                    if (typeof onError === 'function') onError(error);
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(e);
        return null;
    }
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
            return { ok: false, error: "telemetry-write-paused" };
        }
        const fireDB = getFirebaseDB();
        const normalized = normalizeLiveSessionPayload(payload);
        if (!normalized.sessionId) throw new Error('sessionId required');
        await fireDB.collection('store_live_sessions').doc(normalized.sessionId).set(normalized, { merge: true });
        return { ok: true, id: normalized.sessionId };
    } catch (e) {
        if (isTransientTransportError(e)) {
            suspendTelemetryWrites(getErrorMessage(e), 45000);
        }
        console.warn('upsertLiveSession warning:', e && e.message ? e.message : e);
        return { ok: false, error: e && e.message ? e.message : String(e) };
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
                    if (typeof onError === 'function') onError(error);
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(e);
        return null;
    }
}

console.log('[OK] Firebase API loaded');
