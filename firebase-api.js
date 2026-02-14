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
