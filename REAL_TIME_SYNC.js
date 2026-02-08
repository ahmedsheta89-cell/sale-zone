// ================================================
// REAL-TIME SYNC - Sale Zone Store
// ================================================
// مزامنة فورية بين لوحة التحكم والمتجر
// ================================================

// 🔄 Event Listeners للتحديثات الفورية
function setupRealtimeSync() {
    console.log('🔄 Setting up real-time synchronization...');
    
    // الاستماع للتحديثات من نفس النافذة
    window.addEventListener('storageUpdated', function(e) {
        console.log('🔔 Storage updated:', e.detail);
        handleStorageUpdate(e.detail);
    });
    
    // الاستماع للتحديثات من التابات الأخرى
    window.addEventListener('storage', function(e) {
        if (e.key && e.key.startsWith('sale_zone_')) {
            console.log('🔔 Cross-tab storage change:', e.key);
            handleCrossTabUpdate(e.key);
        }
    });
    
    // فحص دوري للتحديثات
    setInterval(checkForUpdates, 2000);
    
    console.log('✅ Real-time sync setup complete');
}

// 🔄 معالجة التحديثات الداخلية
function handleStorageUpdate(detail) {
    const { key, data, action } = detail;
    
    switch(key) {
        case 'BANNERS':
            console.log('🎨 Banners updated, refreshing...');
            if (typeof renderBanners === 'function') {
                banners = data;
                renderBanners();
            }
            break;
            
        case 'PRODUCTS':
            console.log('🛍️ Products updated, refreshing...');
            if (typeof renderProducts === 'function') {
                products = data;
                renderProducts();
                updateCategoryCounts();
            }
            break;
            
        case 'COUPONS':
            console.log('🎫 Coupons updated, refreshing...');
            if (typeof renderCoupons === 'function') {
                coupons = data;
                renderCoupons();
            }
            break;
            
        case 'SETTINGS':
            console.log('⚙️ Settings updated, refreshing...');
            if (typeof applyStoreSettings === 'function') {
                storeSettings = data;
                applyStoreSettings();
            }
            break;
            
        case 'CUSTOMERS':
            console.log('👥 Customers updated, refreshing...');
            users = data;
            if (typeof checkLoggedInUser === 'function') {
                checkLoggedInUser();
            }
            break;
    }
}

// 🔄 معالجة التحديثات بين التابات
function handleCrossTabUpdate(storageKey) {
    console.log('🔄 Cross-tab update detected:', storageKey);
    
    // تحديث البيانات المحلية
    switch(storageKey) {
        case 'sale_zone_banners':
            banners = getStorageData('BANNERS') || [];
            if (typeof renderBanners === 'function') renderBanners();
            break;
            
        case 'sale_zone_products':
            products = getStorageData('PRODUCTS') || [];
            if (typeof renderProducts === 'function') {
                renderProducts();
                updateCategoryCounts();
            }
            break;
            
        case 'sale_zone_coupons':
            coupons = getStorageData('COUPONS') || [];
            if (typeof renderCoupons === 'function') renderCoupons();
            break;
            
        case 'sale_zone_settings':
            storeSettings = getStorageData('SETTINGS') || {};
            if (typeof applyStoreSettings === 'function') applyStoreSettings();
            break;
    }
}

// 🔄 فحص دوري للتحديثات
function checkForUpdates() {
    const lastUpdate = getLastUpdateTime();
    if (!lastUpdate) return;
    
    const now = Date.now();
    const diff = now - lastUpdate.getTime();
    
    // إذا كان هناك تحديث خلال آخر 5 ثواني
    if (diff < 5000) {
        console.log('🔄 Recent update detected, refreshing data...');
        refreshAllData();
    }
}

// 🔄 تحديث جميع البيانات
function refreshAllData() {
    console.log('🔄 Refreshing all data...');
    
    // تحديث من localStorage
    banners = getStorageData('BANNERS') || [];
    products = getStorageData('PRODUCTS') || [];
    coupons = getStorageData('COUPONS') || [];
    users = getStorageData('CUSTOMERS') || [];
    storeSettings = getStorageData('SETTINGS') || {};
    
    // إعادة العرض
    if (typeof renderBanners === 'function') renderBanners();
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderCoupons === 'function') renderCoupons();
    if (typeof applyStoreSettings === 'function') applyStoreSettings();
    if (typeof updateCategoryCounts === 'function') updateCategoryCounts();
    
    console.log('✅ All data refreshed');
}

// 🎯 دالة مساعدة للتحديث الفوري
function forceUpdate(type) {
    console.log(`🔄 Force updating ${type}...`);
    
    switch(type) {
        case 'banners':
            banners = getStorageData('BANNERS') || [];
            if (typeof renderBanners === 'function') renderBanners();
            break;
            
        case 'products':
            products = getStorageData('PRODUCTS') || [];
            if (typeof renderProducts === 'function') {
                renderProducts();
                updateCategoryCounts();
            }
            break;
            
        case 'coupons':
            coupons = getStorageData('COUPONS') || [];
            if (typeof renderCoupons === 'function') renderCoupons();
            break;
            
        case 'all':
            refreshAllData();
            break;
    }
}

// 🧪 دالة اختبار المزامنة
function testRealtimeSync() {
    console.log('🧪 Testing real-time sync...');
    
    // اختبار تحديث البانرات
    const testBanners = [
        { id: 999, icon: '🧪', title: 'Test Banner', text: 'Testing sync', btn: 'Test', category: 'all' }
    ];
    
    setStorageData('BANNERS', testBanners);
    
    setTimeout(() => {
        console.log('🧪 Test completed - check if banner updated');
    }, 1000);
}

// ================================================
// تهيئة المزامنة تلقائياً
// ================================================
document.addEventListener('DOMContentLoaded', function() {
    // انتظر قليلاً ثم ابدأ المزامنة
    setTimeout(setupRealtimeSync, 1000);
});

// ================================================
// دوال عالمية للاستخدام في أي مكان
// ================================================
window.realtimeSync = {
    forceUpdate,
    testRealtimeSync,
    refreshAllData,
    setupRealtimeSync
};

console.log('✅ REAL_TIME_SYNC.js loaded');
