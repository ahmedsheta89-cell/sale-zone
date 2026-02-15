// ================================================
// REAL-TIME SYNC - Sale Zone Store (lockdown mode)
// ================================================
// Local cross-tab sync is restricted to local-only keys.
// Firebase-managed data (products/coupons/banners/customers) is excluded.
// ================================================

const FIREBASE_MANAGED_KEYS = new Set(['PRODUCTS', 'COUPONS', 'BANNERS', 'CUSTOMERS']);
const FIREBASE_MANAGED_STORAGE_KEYS = new Set([
    'sale_zone_products',
    'sale_zone_coupons',
    'sale_zone_banners',
    'sale_zone_customers'
]);

function shouldIgnoreLogicalKey(key) {
    return FIREBASE_MANAGED_KEYS.has(String(key || '').toUpperCase());
}

function shouldIgnoreStorageKey(key) {
    const raw = String(key || '').toLowerCase();
    if (!raw) return true;
    if (!raw.startsWith('sale_zone_')) return true;
    if (raw === 'sale_zone_last_update') return true;
    if (raw === 'sale_zone_storage_schema_version') return true;
    return FIREBASE_MANAGED_STORAGE_KEYS.has(raw);
}

function setupRealtimeSync() {
    console.log('🔄 Setting up real-time synchronization...');

    window.addEventListener('storageUpdated', (event) => {
        const detail = event && event.detail ? event.detail : null;
        const key = detail && detail.key ? String(detail.key) : '';
        if (!key || shouldIgnoreLogicalKey(key)) return;
        handleStorageUpdate(detail);
    });

    window.addEventListener('storage', (event) => {
        const key = event && event.key ? String(event.key) : '';
        if (shouldIgnoreStorageKey(key)) return;
        handleCrossTabUpdate(key);
    });

    console.log('✅ Real-time sync setup complete');
}

function handleStorageUpdate(detail) {
    const key = String((detail && detail.key) || '');
    if (!key || shouldIgnoreLogicalKey(key)) return;

    switch (key) {
        case 'SETTINGS': {
            const data = detail && detail.data && typeof detail.data === 'object' ? detail.data : {};
            if (typeof applyStoreSettings === 'function') {
                storeSettings = data;
                applyStoreSettings();
            }
            break;
        }
        default:
            break;
    }
}

function handleCrossTabUpdate(storageKey) {
    const key = String(storageKey || '');
    if (shouldIgnoreStorageKey(key)) return;

    if (key === 'sale_zone_settings') {
        const data = typeof getStorageData === 'function' ? (getStorageData('SETTINGS') || {}) : {};
        if (typeof applyStoreSettings === 'function') {
            storeSettings = data;
            applyStoreSettings();
        }
    }
}

function refreshAllData() {
    if (typeof applyStoreSettings === 'function') {
        const data = typeof getStorageData === 'function' ? (getStorageData('SETTINGS') || {}) : {};
        storeSettings = data;
        applyStoreSettings();
    }
}

function forceUpdate(type) {
    void type;
    refreshAllData();
}

function testRealtimeSync() {
    console.log('Realtime sync test: active');
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupRealtimeSync, 1000);
});

window.realtimeSync = {
    forceUpdate,
    testRealtimeSync,
    refreshAllData,
    setupRealtimeSync
};

console.log('✅ REAL_TIME_SYNC.js loaded');
