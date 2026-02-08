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
 * قراءة بيانات من localStorage مع تحقق من Firebase
 * @param {string} key - اسم المفتاح من STORAGE_KEYS
 * @param {boolean} useFirebase - استخدام Firebase كبديل
 * @returns {any|null} - البيانات أو null
 */
function getStorageData(key, useFirebase = false) {
  try {
    const storageKey = STORAGE_KEYS[key];
    if (!storageKey) {
      console.error(`❌ Invalid storage key: ${key}`);
      return null;
    }
    
    // محاولة الحصول على البيانات من localStorage
    let data = localStorage.getItem(storageKey);
    
    // إذا لم توجد بيانات و Firebase مطلوب
    if (!data && useFirebase && window.firebaseAPI) {
      console.log(`🔄 Trying Firebase for: ${key}`);
      return getFromFirebase(key);
    }
    
    if (!data) {
      console.log(`📭 No data found for: ${key}`);
      return null;
    }
    
    const parsed = JSON.parse(data);
    console.log(`✅ Loaded ${key}:`, parsed);
    return parsed;
    
  } catch (error) {
    console.error(`❌ Error reading ${key}:`, error);
    
    // تسجيل الخطأ في نظام المراقبة
    if (window.errorDetection) {
      window.errorDetection.logError({
        type: 'STORAGE_READ_ERROR',
        key: key,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    return null;
  }
}

/**
 * حفظ بيانات في localStorage مع مزامنة Firebase
 * @param {string} key - اسم المفتاح من STORAGE_KEYS
 * @param {any} data - البيانات المراد حفظها
 * @param {boolean} syncToFirebase - مزامنة مع Firebase
 * @returns {boolean} - true إذا نجح الحفظ
 */
function setStorageData(key, data, syncToFirebase = false) {
  try {
    const storageKey = STORAGE_KEYS[key];
    if (!storageKey) {
      console.error(`❌ Invalid storage key: ${key}`);
      return false;
    }
    
    // التحقق من حجم البيانات
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 5 * 1024 * 1024) { // 5MB limit
      console.warn(`⚠️ Large data size for ${key}: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // حفظ البيانات في localStorage
    localStorage.setItem(storageKey, JSON.stringify(data));
    
    // تحديث تاريخ آخر تحديث
    localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, Date.now().toString());
    
    // مزامنة مع Firebase إذا مطلوب
    if (syncToFirebase && window.firebaseAPI) {
      syncToFirebaseStorage(key, data);
    }
    
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
    
    // تسجيل الخطأ في نظام المراقبة
    if (window.errorDetection) {
      window.errorDetection.logError({
        type: 'STORAGE_SAVE_ERROR',
        key: key,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
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
// دوال مساعدة للتعامل مع Firebase
// ================================================

/**
 * الحصول على البيانات من Firebase
 * @param {string} key - مفتاح التخزين
 * @returns {any|null}
 */
async function getFromFirebase(key) {
  try {
    const firebaseFunctions = {
      'PRODUCTS': window.firebaseAPI?.getAllProducts,
      'ORDERS': window.firebaseAPI?.getAllOrders,
      'BANNERS': window.firebaseAPI?.getBanners,
      'COUPONS': window.firebaseAPI?.getCoupons,
      'USERS': window.firebaseAPI?.getAllUsers
    };
    
    const func = firebaseFunctions[key];
    if (func) {
      const data = await func();
      // حفظ البيانات في localStorage للتخزين المؤقت
      setStorageData(key, data);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Firebase sync error for ${key}:`, error);
    return null;
  }
}

/**
 * مزامنة البيانات مع Firebase
 * @param {string} key - مفتاح التخزين
 * @param {any} data - البيانات المراد مزامنتها
 */
async function syncToFirebaseStorage(key, data) {
  try {
    // فقط مزامنة البيانات المسموح بها
    const syncableKeys = ['PRODUCTS', 'ORDERS', 'BANNERS', 'COUPONS'];
    if (!syncableKeys.includes(key)) {
      return;
    }
    
    console.log(`🔄 Syncing ${key} to Firebase...`);
    
    // مزامنة حسب نوع البيانات
    switch (key) {
      case 'PRODUCTS':
        // مزامنة المنتجات
        for (const product of data) {
          if (product.id && product.id.startsWith('local_')) {
            await window.firebaseAPI.addProduct(product);
          }
        }
        break;
      case 'ORDERS':
        // مزامنة الطلبات
        for (const order of data) {
          if (order.id && order.id.startsWith('local_')) {
            await window.firebaseAPI.addOrder(order);
          }
        }
        break;
    }
    
    console.log(`✅ ${key} synced to Firebase`);
  } catch (error) {
    console.error(`❌ Firebase sync error for ${key}:`, error);
  }
}

/**
 * مزامنة جميع البيانات مع Firebase
 */
async function syncAllToFirebase() {
  try {
    console.log('🔄 Starting full Firebase sync...');
    
    const syncableKeys = ['PRODUCTS', 'ORDERS', 'BANNERS', 'COUPONS'];
    let synced = 0;
    
    for (const key of syncableKeys) {
      const data = getStorageData(key);
      if (data) {
        await syncToFirebaseStorage(key, data);
        synced++;
      }
    }
    
    console.log(`✅ Synced ${synced} collections to Firebase`);
    return synced;
  } catch (error) {
    console.error('❌ Full sync failed:', error);
    return 0;
  }
}

/**
 * التحقق من حالة الاتصال والتبديل التلقائي
 * @param {string} key - مفتاح التخزين
 * @returns {any|null}
 */
async function getStorageDataSmart(key) {
  // التحقق من اتصال Firebase
  const connection = await window.checkFirebaseConnection?.();
  
  if (connection?.connected) {
    // استخدام Firebase كأساس مع التخزين المؤقت
    return getStorageData(key, true);
  } else {
    // استخدام localStorage فقط
    return getStorageData(key, false);
  }
}

// ================================================
// تنظيف المفاتيح القديمة (تشغيل تلقائي)
// ================================================
(function cleanupOldKeys() {
  const oldKeys = [
    'banners', 'customers', 'footer', 'products', 'orders',
    'coupons', 'settings', 'cart', 'wishlist', 'user',
    // أضف أي مفاتيح قديمة أخرى
  ];
  
  let cleaned = 0;
  oldKeys.forEach(key => {
    if (localStorage.getItem(key) && !key.startsWith('sale_zone_')) {
      console.log(`🧹 Cleaning old key: ${key}`);
      localStorage.removeItem(key);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    console.log(`✅ Cleaned ${cleaned} old storage keys`);
  }
})();

// ================================================
// إعلام في Console
// ================================================
console.log('✅ storage-keys.js loaded successfully');
console.log('📦 Available functions:', {
  'getStorageData(key)': 'قراءة بيانات',
  'setStorageData(key, data)': 'حفظ بيانات',
  'removeStorageData(key)': 'حذف بيانات',
  'exportAllData()': 'تصدير كل البيانات',
  'importAllData(data)': 'استيراد البيانات',
  'clearAllData(true)': 'مسح كل البيانات',
  'getStorageSize()': 'حجم البيانات',
  'debugStorage()': 'معلومات التخزين'
});

console.log('💡 Example usage:');
console.log("  setStorageData('BANNERS', [{id: 1, title: 'Test'}])");
console.log("  getStorageData('BANNERS')");
console.log("  debugStorage()");
