// ================================================
// storage-keys.js - Sale Zone Store
// ================================================
// ملف موحد لإدارة localStorage
// استخدمه في المتجر والأدمن معاً
// ================================================

/**
 * مفاتيح موحدة لـ localStorage
 * استخدم هذه المفاتيح في كل مكان
 */
const STORAGE_KEYS = {
  // المنتجات
  PRODUCTS: 'sale_zone_products',
  
  // الطلبات
  ORDERS: 'sale_zone_orders',
  
  // العملاء وشهاداتهم
  CUSTOMERS: 'sale_zone_customers',

  // الموردين
  SUPPLIERS: 'sale_zone_suppliers',
  
  // البنرات (الإعلانات/Sliders)
  BANNERS: 'sale_zone_banners',
  
  // الكوبونات
  COUPONS: 'sale_zone_coupons',
  
  // Footer (الجزء السفلي)
  FOOTER_DATA: 'sale_zone_footer',
  
  // الإعدادات العامة
  SETTINGS: 'sale_zone_settings',
  
  // سلة التسوق
  CART: 'sale_zone_cart',
  
  // المفضلة
  WISHLIST: 'sale_zone_wishlist',
  
  // تاريخ آخر تحديث (للمزامنة)
  LAST_UPDATE: 'sale_zone_last_update',
  
  // معلومات المستخدم
  USER_INFO: 'sale_zone_user_info',
  
  // نقاط الولاء
  LOYALTY_POINTS: 'sale_zone_loyalty_points'
};

/**
 * قراءة بيانات من localStorage
 * @param {string} key - اسم المفتاح من STORAGE_KEYS
 * @returns {any|null} - البيانات أو null
 */
function getStorageData(key) {
  try {
    const storageKey = STORAGE_KEYS[key];
    if (!storageKey) {
      console.error(`❌ Invalid storage key: ${key}`);
      return null;
    }
    
    const data = localStorage.getItem(storageKey);
    
    if (!data) {
      console.log(`📭 No data found for: ${key}`);
      return null;
    }
    
    const parsed = JSON.parse(data);
    console.log(`✅ Loaded ${key}:`, parsed);
    return parsed;
    
  } catch (error) {
    console.error(`❌ Error reading ${key}:`, error);
    return null;
  }
}

/**
 * حفظ بيانات في localStorage
 * @param {string} key - اسم المفتاح من STORAGE_KEYS
 * @param {any} data - البيانات المراد حفظها
 * @returns {boolean} - true إذا نجح الحفظ
 */
function setStorageData(key, data) {
  try {
    const storageKey = STORAGE_KEYS[key];
    if (!storageKey) {
      console.error(`❌ Invalid storage key: ${key}`);
      return false;
    }
    
    // حفظ البيانات
    const serialized = JSON.stringify(data);
    const previous = localStorage.getItem(storageKey);
    if (previous === serialized) {
      return true;
    }
    localStorage.setItem(storageKey, serialized);
    
    // تحديث تاريخ آخر تحديث
    localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, Date.now().toString());
    
    console.log(`💾 Saved ${key}:`, data);
    
    // إطلاق event للإشعار بالتحديث
    window.dispatchEvent(new CustomEvent('storageUpdated', {
      detail: { 
        key: key, 
        storageKey: storageKey,
        data: data,
        timestamp: Date.now()
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error saving ${key}:`, error);
    
    // تحقق من امتلاء localStorage
    if (error.name === 'QuotaExceededError') {
      alert('⚠️ مساحة التخزين ممتلئة! قم بتصدير البيانات ثم امسح القديمة.');
    }
    
    return false;
  }
}

/**
 * حذف بيانات من localStorage
 * @param {string} key - اسم المفتاح من STORAGE_KEYS
 * @returns {boolean} - true إذا نجح الحذف
 */
function removeStorageData(key) {
  try {
    const storageKey = STORAGE_KEYS[key];
    if (!storageKey) {
      console.error(`❌ Invalid storage key: ${key}`);
      return false;
    }
    
    localStorage.removeItem(storageKey);
    localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, Date.now().toString());
    
    console.log(`🗑️ Removed ${key}`);
    
    // إطلاق event
    window.dispatchEvent(new CustomEvent('storageUpdated', {
      detail: { 
        key: key,
        storageKey: storageKey,
        action: 'removed',
        timestamp: Date.now()
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error removing ${key}:`, error);
    return false;
  }
}

/**
 * الحصول على تاريخ آخر تحديث
 * @returns {Date|null}
 */
function getLastUpdateTime() {
  const timestamp = localStorage.getItem(STORAGE_KEYS.LAST_UPDATE);
  return timestamp ? new Date(parseInt(timestamp)) : null;
}

/**
 * تصدير جميع البيانات (للنسخ الاحتياطي)
 * @returns {object} - كل البيانات المحفوظة
 */
function exportAllData() {
  const allData = {};
  
  Object.keys(STORAGE_KEYS).forEach(key => {
    const data = getStorageData(key);
    if (data !== null) {
      allData[key] = data;
    }
  });
  
  console.log('📦 Exported all data:', allData);
  return allData;
}

/**
 * استيراد البيانات (من نسخة احتياطية)
 * @param {object} data - البيانات المراد استيرادها
 * @returns {boolean}
 */
function importAllData(data) {
  try {
    Object.keys(data).forEach(key => {
      if (STORAGE_KEYS[key]) {
        setStorageData(key, data[key]);
      }
    });
    
    console.log('✅ Data imported successfully');
    alert('✅ تم استيراد البيانات بنجاح!');
    return true;
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    alert('❌ فشل استيراد البيانات!');
    return false;
  }
}

/**
 * مسح جميع البيانات (حذر!)
 * @param {boolean} confirm - تأكيد الحذف
 */
function clearAllData(confirm = false) {
  if (!confirm) {
    console.warn('⚠️ clearAllData requires confirmation');
    return false;
  }
  
  Object.values(STORAGE_KEYS).forEach(storageKey => {
    localStorage.removeItem(storageKey);
  });
  
  console.log('🗑️ All data cleared');
  alert('✅ تم مسح جميع البيانات!');
  return true;
}

/**
 * الحصول على حجم البيانات المخزنة
 * @returns {object} - معلومات الحجم
 */
function getStorageSize() {
  let totalSize = 0;
  const sizes = {};
  
  Object.keys(STORAGE_KEYS).forEach(key => {
    const storageKey = STORAGE_KEYS[key];
    const data = localStorage.getItem(storageKey);
    
    if (data) {
      const size = new Blob([data]).size;
      totalSize += size;
      sizes[key] = {
        bytes: size,
        kb: (size / 1024).toFixed(2),
        mb: (size / 1024 / 1024).toFixed(2)
      };
    }
  });
  
  return {
    total: {
      bytes: totalSize,
      kb: (totalSize / 1024).toFixed(2),
      mb: (totalSize / 1024 / 1024).toFixed(2)
    },
    items: sizes
  };
}

/**
 * طباعة معلومات التخزين في Console
 */
function debugStorage() {
  console.group('🔍 Storage Debug Info');
  
  console.log('📊 Storage Size:', getStorageSize());
  console.log('🕒 Last Update:', getLastUpdateTime());
  
  console.group('📦 All Data:');
  Object.keys(STORAGE_KEYS).forEach(key => {
    const data = getStorageData(key);
    if (data) {
      console.log(`${key}:`, data);
    }
  });
  console.groupEnd();
  
  console.groupEnd();
}

// ================================================
// تنظيف المفاتيح القديمة (تشغيل تلقائي)
// ================================================
const STORAGE_SCHEMA_VERSION_KEY = 'sale_zone_storage_schema_version';
const STORAGE_SCHEMA_VERSION = '2026.02.12.01';
const SESSION_SCHEMA_VERSION_KEY = 'sale_zone_session_schema_version';
const SESSION_SCHEMA_VERSION = '2026.02.12.01';

(function migrateAndCleanupStorage() {
  const currentSchema = localStorage.getItem(STORAGE_SCHEMA_VERSION_KEY) || '';
  if (currentSchema === STORAGE_SCHEMA_VERSION) return;

  const deprecatedKeys = [
    'banners', 'customers', 'footer', 'products', 'orders',
    'coupons', 'settings', 'cart', 'wishlist', 'user',
    'salezone_products', 'salezone_orders', 'salezone_customers',
    'salezone_banners', 'salezone_coupons', 'salezone_footer',
    'salezone_settings', 'salezone_cart', 'salezone_wishlist',
    'salezone_user_info', 'salezone_loyalty_points', 'salezone_last_update',
    'salezone_sample_purge_done', 'sale_zone_bootstrap_admin',
    'sale_zone_bootstrap_email'
  ];

  const keepSet = new Set([
    ...Object.values(STORAGE_KEYS),
    'currentUser',
    'adminErrors',
    'salezone_app_version',
    STORAGE_SCHEMA_VERSION_KEY
  ]);

  let removed = 0;
  for (const key of deprecatedKeys) {
    if (!localStorage.getItem(key)) continue;
    if (keepSet.has(key)) continue;
    localStorage.removeItem(key);
    removed++;
  }

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('sale_zone_tmp_') || key.startsWith('sale_zone_legacy_')) {
      localStorage.removeItem(key);
      removed++;
    }
  });

  localStorage.setItem(STORAGE_SCHEMA_VERSION_KEY, STORAGE_SCHEMA_VERSION);
  if (removed > 0) {
    console.log(`[OK] Storage migration removed ${removed} old key(s).`);
  }
})();

(function migrateAndCleanupSessionStorage() {
  const currentSchema = sessionStorage.getItem(SESSION_SCHEMA_VERSION_KEY) || '';
  if (currentSchema === SESSION_SCHEMA_VERSION) return;

  const keepSet = new Set([
    'sale_zone_live_session_id',
    SESSION_SCHEMA_VERSION_KEY
  ]);

  let removed = 0;
  Object.keys(sessionStorage).forEach((key) => {
    if (keepSet.has(key)) return;
    if (
      key.startsWith('sale_zone_') ||
      key.startsWith('salezone_') ||
      key === 'currentUser' ||
      key.endsWith('_tmp')
    ) {
      sessionStorage.removeItem(key);
      removed++;
    }
  });

  sessionStorage.setItem(SESSION_SCHEMA_VERSION_KEY, SESSION_SCHEMA_VERSION);
  if (removed > 0) {
    console.log(`[OK] Session migration removed ${removed} old key(s).`);
  }
})();

// ================================================
// إعلام في Console
// ================================================
console.log('[OK] storage-keys.js loaded successfully');
console.log('Available functions:', {
  'getStorageData(key)': 'Read data',
  'setStorageData(key, data)': 'Write data',
  'removeStorageData(key)': 'Delete data',
  'exportAllData()': 'Export all data',
  'importAllData(data)': 'Import all data',
  'clearAllData(true)': 'Clear all data',
  'getStorageSize()': 'Storage size',
  'debugStorage()': 'Storage debug'
});

console.log('Example usage:');
console.log("  setStorageData('BANNERS', [{id: 1, title: 'Test'}])");
console.log("  getStorageData('BANNERS')");
console.log("  debugStorage()");
