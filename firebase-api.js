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
        const db = getFirebaseDB();
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
        const db = getFirebaseDB();
        await db.collection('coupons').doc(id).set(data, { merge: true });
        console.log('[OK] Coupon updated in Firebase:', id);
    } catch (e) {
        console.error('updateCoupon error:', e);
        throw e;
    }
}

async function deleteCoupon(id) {
    try {
        const db = getFirebaseDB();
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
        const db = getFirebaseDB();
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
        const db = getFirebaseDB();
        await db.collection('banners').doc(id).set(data, { merge: true });
        console.log('[OK] Banner updated in Firebase:', id);
    } catch (e) {
        console.error('updateBanner error:', e);
        throw e;
    }
}

async function deleteBanner(id) {
    try {
        const db = getFirebaseDB();
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
function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number(fallback) || 0;
}

function roundMoney(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round((parsed + Number.EPSILON) * 100) / 100;
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

    return {
        ...input,
        supplierId: String(input.supplierId || defaults.supplierId || ''),
        supplierName: String(input.supplierName || defaults.supplierName || ''),
        supplierCode: String(input.supplierCode || defaults.supplierCode || ''),
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
        const db = getFirebaseDB();
        const snapshot = await db.collection('products').get();
        const products = snapshot.docs.map(mapProductFromSnapshot);
        return products;
    } catch (e) {
        console.error('getAllProducts error:', e);
        return null;
    }
}

function mapProductFromSnapshot(doc) {
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
        ratingCount: data.ratingCount || 0,
        code: data.code || '',
        stock: Number.isFinite(Number(data.stock)) ? Number(data.stock) : -1,
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

async function getPublishedProducts() {
    try {
        const db = getFirebaseDB();
        const snapshot = await db.collection('products')
            .where('isPublished', '==', true)
            .get();
        return snapshot.docs.map(mapProductFromSnapshot);
    } catch (e) {
        console.error('getPublishedProducts error:', e);
        return null;
    }
}

async function addProduct(product) {
    try {
        const db = getFirebaseDB();
        const payload = normalizeProductPayloadForWrite(product, { defaults: { isPublished: true } });
        const docRef = await db.collection('products').add(payload);
        console.log('[OK] Product added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addProduct error:', e);
        throw e;
    }
}

async function updateProduct(id, data) {
    try {
        const db = getFirebaseDB();
        const payload = data && typeof data === 'object' ? data : {};
        const ref = db.collection('products').doc(String(id));
        const existingDoc = await ref.get();
        const existing = existingDoc.exists ? (existingDoc.data() || {}) : {};
        const normalizedPayload = normalizeProductPayloadForWrite({
            ...existing,
            ...payload
        }, {
            defaults: {
                isPublished: existing.isPublished !== false
            }
        });
        await ref.set(normalizedPayload, { merge: true });
        console.log('[OK] Product updated in Firebase:', id);
    } catch (e) {
        console.error('updateProduct error:', e);
        throw e;
    }
}

async function addProductsBatch(productsArray, options = {}) {
    try {
        const db = getFirebaseDB();
        const items = Array.isArray(productsArray) ? productsArray : [];
        if (items.length === 0) return [];

        const chunkSize = Math.max(1, Math.min(400, Number(options.chunkSize) || 300));
        const defaults = {
            isPublished: options.isPublished !== false ? true : false,
            importBatchId: String(options.importBatchId || ''),
            importSource: String(options.importSource || '')
        };

        const createdIds = [];

        for (let offset = 0; offset < items.length; offset += chunkSize) {
            const chunk = items.slice(offset, offset + chunkSize);
            const batch = db.batch();
            const refs = [];

            chunk.forEach((item) => {
                const ref = db.collection('products').doc();
                refs.push(ref);
                batch.set(ref, normalizeProductPayloadForWrite(item, { defaults }));
            });

            await batch.commit();
            refs.forEach((ref) => createdIds.push(ref.id));
        }

        console.log('[OK] Products batch added to Firebase:', createdIds.length);
        return createdIds;
    } catch (e) {
        console.error('addProductsBatch error:', e);
        throw e;
    }
}

async function updateProductVisibility(id, isPublished) {
    try {
        const db = getFirebaseDB();
        const published = isPublished !== false;
        await db.collection('products').doc(String(id)).set({
            isPublished: published,
            visibilityState: published ? 'published' : 'hidden',
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('[OK] Product visibility updated:', id, published);
    } catch (e) {
        console.error('updateProductVisibility error:', e);
        throw e;
    }
}

async function updateProductsVisibilityBatch(ids, isPublished, options = {}) {
    try {
        const db = getFirebaseDB();
        const list = Array.isArray(ids) ? ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (list.length === 0) return 0;

        const published = isPublished !== false;
        const chunkSize = Math.max(1, Math.min(400, Number(options.chunkSize) || 300));
        let updatedCount = 0;

        for (let offset = 0; offset < list.length; offset += chunkSize) {
            const chunk = list.slice(offset, offset + chunkSize);
            const batch = db.batch();

            chunk.forEach((id) => {
                const ref = db.collection('products').doc(id);
                batch.set(ref, {
                    isPublished: published,
                    visibilityState: published ? 'published' : 'hidden',
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            });

            await batch.commit();
            updatedCount += chunk.length;
        }

        console.log('[OK] Products visibility batch updated:', updatedCount);
        return updatedCount;
    } catch (e) {
        console.error('updateProductsVisibilityBatch error:', e);
        throw e;
    }
}

async function deleteProductsBatch(ids, options = {}) {
    try {
        const db = getFirebaseDB();
        const list = Array.isArray(ids) ? ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (list.length === 0) return 0;

        const chunkSize = Math.max(1, Math.min(400, Number(options.chunkSize) || 300));
        let deletedCount = 0;

        for (let offset = 0; offset < list.length; offset += chunkSize) {
            const chunk = list.slice(offset, offset + chunkSize);
            const batch = db.batch();

            chunk.forEach((id) => {
                const ref = db.collection('products').doc(id);
                batch.delete(ref);
            });

            await batch.commit();
            deletedCount += chunk.length;
        }

        console.log('[OK] Products batch deleted:', deletedCount);
        return deletedCount;
    } catch (e) {
        console.error('deleteProductsBatch error:', e);
        throw e;
    }
}

async function deleteProductFromFirebase(id) {
    try {
        const db = getFirebaseDB();
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
    const nowIso = new Date().toISOString();
    const normalizedUid = String(source.uid || source.userId || (user && user.uid) || '').trim();
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
    const orderId = normalizeOrderDocId(orderPayload.idempotencyKey);
    const orderRef = dbRef.collection('orders').doc(orderId);
    const snapshot = await orderRef.get();
    if (snapshot.exists) {
        return { id: orderId, status: 'duplicate', duplicate: true, queued: false };
    }

    const writePayload = {
        ...orderPayload,
        id: orderId,
        updatedAt: new Date().toISOString(),
        syncState: String(meta && meta.syncState || 'synced')
    };

    await orderRef.set(writePayload, { merge: false });
    await appendOrderEvent(dbRef, 'ORDER_CREATED', writePayload, {
        source: meta && meta.source ? meta.source : 'order-create',
        payload: {
            orderNumber: writePayload.orderNumber,
            total: writePayload.total,
            itemsCount: Array.isArray(writePayload.items) ? writePayload.items.length : 0
        }
    });
    await appendAuditLog(dbRef, 'ORDER_CREATED', {
        uid: writePayload.uid,
        targetId: orderId,
        details: {
            orderNumber: writePayload.orderNumber,
            idempotencyKey: writePayload.idempotencyKey
        }
    });
    return { id: orderId, status: 'saved', duplicate: false, queued: false };
}

async function flushOrderQueue(options = {}) {
    if (orderQueueFlushInFlight) return { flushed: 0, pending: readOrderQueueLocal().length };
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
    const db = getFirebaseDB();
    const safeLimit = Math.max(1, Math.min(200, Number(options && options.limit) || 50));
    const cursorId = String(options && options.cursor || '').trim();

    let query = db.collection('orders').orderBy('createdAt', 'desc').limit(safeLimit + 1);

    if (cursorId) {
        const cursorSnapshot = await db.collection('orders').doc(cursorId).get();
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

async function updateOrderStatus(id, status) {
    try {
        const dbRef = getFirebaseDB();
        const orderId = String(id || '').trim();
        const nextStatus = String(status || '').trim().toLowerCase();
        if (!orderId || !nextStatus) throw new Error('order id and status are required');

        const orderRef = dbRef.collection('orders').doc(orderId);
        const snapshot = await orderRef.get();
        if (!snapshot.exists) throw new Error('order not found');

        const data = snapshot.data() || {};
        const nowIso = new Date().toISOString();
        const statusHistory = Array.isArray(data.statusHistory) ? [...data.statusHistory] : [];
        statusHistory.push({
            status: nextStatus,
            date: nowIso
        });

        await orderRef.set({
            status: nextStatus,
            statusHistory,
            updatedAt: nowIso,
            version: Math.max(1, Number(data.version || 1)) + 1
        }, { merge: true });

        await appendOrderEvent(dbRef, 'ORDER_STATUS_CHANGED', {
            id: orderId,
            uid: String(data.uid || ''),
            idempotencyKey: String(data.idempotencyKey || ''),
            source: 'admin-panel'
        }, {
            payload: {
                previousStatus: String(data.status || 'pending'),
                nextStatus
            }
        });

        await appendAuditLog(dbRef, 'ORDER_STATUS_CHANGED', {
            uid: String(data.uid || ''),
            targetId: orderId,
            details: {
                previousStatus: String(data.status || 'pending'),
                nextStatus
            }
        });

        console.log('[OK] Order status updated:', orderId);
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

    const uid = String(opts.uid || source.uid || base.uid || '').trim();
    const email = String(opts.email || source.email || base.email || '').trim().toLowerCase();
    const role = String(base.role || source.role || 'customer').trim().toLowerCase() || 'customer';
    const parsedPoints = Number(source.loyaltyPoints);
    const basePoints = Number(base.loyaltyPoints);
    const loyaltyPoints = Number.isFinite(parsedPoints)
        ? Math.max(0, parsedPoints)
        : (Number.isFinite(basePoints) ? Math.max(0, basePoints) : 0);
    const status = String(source.status || base.status || 'active').trim() || 'active';

    return {
        uid,
        email,
        phone: String(source.phone || base.phone || '').trim(),
        address: String(source.address || base.address || '').trim(),
        displayName: String(source.displayName || base.displayName || source.name || base.name || '').trim(),
        role: role === 'admin' ? 'admin' : 'customer',
        loyaltyPoints,
        status,
        createdAt: String(base.createdAt || source.createdAt || nowIso).trim() || nowIso,
        updatedAt: nowIso
    };
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
    if (Number.isFinite(minPrice)) rows = rows.filter((item) => Number(item.sellPrice || item.price || 0) >= minPrice);
    if (Number.isFinite(maxPrice)) rows = rows.filter((item) => Number(item.sellPrice || item.price || 0) <= maxPrice);
    if (safeFilters.inStock === true) rows = rows.filter((item) => Number(item.stock || 0) > 0);

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
            rows.sort((a, b) => Number(a.sellPrice || a.price || 0) - Number(b.sellPrice || b.price || 0));
            break;
        case 'price-high':
            rows.sort((a, b) => Number(b.sellPrice || b.price || 0) - Number(a.sellPrice || a.price || 0));
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
        console.log('[OK] Supplier added to Firebase:', docRef.id);
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
        console.log('[OK] Supplier updated in Firebase:', id);
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
        console.log('[OK] Supplier archived in Firebase:', id);
    } catch (e) {
        console.error('archiveSupplier error:', e);
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
            email: String(existing.email || data && data.email || '')
        });
        await db.collection('customers').doc(docId).set(normalized, { merge: true });
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

async function deleteCouponFromFirebase(id) {
    try {
        const db = getFirebaseDB();
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

async function deleteBannerFromFirebase(id) {
    try {
        const db = getFirebaseDB();
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

function normalizeSupportThreadPayload(payload, defaults = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const base = defaults && typeof defaults === 'object' ? defaults : {};
    const now = new Date().toISOString();
    const threadUid = normalizeSupportText(source.uid || base.uid || source.customerUid || base.customerUid, 200);

    return {
        uid: threadUid,
        customerName: normalizeSupportText(source.customerName || base.customerName, 200),
        customerPhone: normalizeSupportText(source.customerPhone || base.customerPhone, 50),
        customerEmail: normalizeSupportText(source.customerEmail || base.customerEmail, 200).toLowerCase(),
        status: ['open', 'closed'].includes(String(source.status || base.status || 'open'))
            ? String(source.status || base.status || 'open')
            : 'open',
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
        status: base.status,
        lastMessage: base.lastMessage,
        lastMessageAt: base.lastMessageAt,
        lastSenderRole: base.lastSenderRole,
        unreadForAdmin: Math.max(0, Number(base.unreadForAdmin || 0)),
        unreadForCustomer: Math.max(0, Number(base.unreadForCustomer || 0)),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt
    };
}

function normalizeSupportMessagePayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const createdAtMs = Number(source.createdAtMs);
    return {
        threadId: normalizeSupportText(source.threadId, 200),
        senderRole: ['customer', 'admin'].includes(String(source.senderRole || 'customer'))
            ? String(source.senderRole || 'customer')
            : 'customer',
        senderUid: normalizeSupportText(source.senderUid, 200),
        senderName: normalizeSupportText(source.senderName, 200),
        message: normalizeSupportText(source.message, 2000),
        createdAt: normalizeSupportText(source.createdAt || new Date().toISOString(), 60),
        createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : Date.now()
    };
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
    if (!normalizedUid) throw new Error('uid is required');
    if (!normalizedText) throw new Error('message required');

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

        const normalized = normalizeSupportThreadPayload({
            ...base,
            uid: customerUid,
            customerName: profile.customerName || profile.name || base.customerName || '',
            customerPhone: profile.customerPhone || profile.phone || profile.phoneNormalized || base.customerPhone || '',
            customerEmail: profile.customerEmail || profile.email || base.customerEmail || '',
            status: base.status || 'open',
            updatedAt: new Date().toISOString()
        }, base);

        if (!(snapshot && snapshot.exists)) {
            normalized.createdAt = normalized.updatedAt;
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
        if (!normalized.message) throw new Error('message required');

        const threadRef = db.collection('support_threads').doc(normalized.threadId);
        const threadSnapshot = await threadRef.get();
        if (!threadSnapshot.exists) {
            throw new Error('support thread not found');
        }
        const threadData = normalizeSupportThreadRecord(threadSnapshot.data() || {}, normalized.threadId);

        const messageRef = await threadRef
            .collection('messages')
            .add(normalized);

        const isCustomer = normalized.senderRole === 'customer';
        const unreadForAdmin = isCustomer
            ? Math.max(0, Number(threadData.unreadForAdmin || 0)) + 1
            : 0;
        const unreadForCustomer = isCustomer
            ? Math.max(0, Number(threadData.unreadForCustomer || 0))
            : Math.max(0, Number(threadData.unreadForCustomer || 0)) + 1;

        await threadRef.set({
            lastMessage: normalized.message.slice(0, 600),
            lastMessageAt: normalized.createdAt,
            lastSenderRole: normalized.senderRole,
            updatedAt: normalized.createdAt,
            status: 'open',
            unreadForAdmin,
            unreadForCustomer
        }, { merge: true });

        return { id: messageRef.id, ...normalized };
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
            .orderBy('createdAtMs', 'asc')
            .limit(safeLimit)
            .get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        const normalized = normalizeFirebaseError(e, 'getSupportMessages');
        console.error('getSupportMessages error:', normalized.message);
        if (options && options.strict === true) {
            throw normalized;
        }
        return [];
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
                    if (typeof onError === 'function') onError(error);
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(e);
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
                    if (typeof onError === 'function') onError(error);
                }
            );
    } catch (e) {
        if (typeof onError === 'function') onError(e);
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
            .orderBy('createdAtMs', 'asc')
            .limit(safeLimit)
            .onSnapshot(
                (snapshot) => {
                    const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('markSupportThreadReadByCustomer error:', e);
        return false;
    }
}

async function closeSupportThread(threadId) {
    try {
        const db = getFirebaseDB();
        const normalizedThreadId = normalizeSupportText(threadId, 200);
        if (!normalizedThreadId) return false;
        await db.collection('support_threads').doc(normalizedThreadId).set({
            status: 'closed',
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('closeSupportThread error:', e);
        return false;
    }
}

console.log('[OK] Firebase API loaded');
