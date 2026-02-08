// ============================================
// 🔥 Firebase Configuration Template
// ============================================
// انسخ هذا الملف إلى firebase-config.js وأضف بيانات مشروعك
// ============================================

// Firebase Configuration - استبدل هذه القيم ببيانات مشروعك
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID" // اختياري لـ Google Analytics
};

// تهيئة Firebase
try {
    // التحقق من وجود Firebase SDK
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded - check script tags in HTML');
    }

    // تهيئة Firebase
    firebase.initializeApp(firebaseConfig);
    
    // تهيئة الخدمات
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    
    // إعدادات Firestore للأداء
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        timestampsInSnapshots: true
    });
    
    // تمكين الاستمرارية في وضع عدم الاتصال
    db.enablePersistence({
        synchronizeTabs: true
    }).catch(err => {
        console.warn('Firestore persistence disabled:', err);
    });
    
    // إعدادات المصادقة
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    
    // تصدير الخدمات للاستخدام العام
    window.firebaseServices = {
        auth,
        db,
        storage,
        config: firebaseConfig
    };
    
    console.log('✅ Firebase initialized successfully');
    
} catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    
    // Fallback mode - استخدام localStorage كبديل
    window.firebaseServices = {
        isFallback: true,
        error: error.message
    };
    
    // إرسال خطأ إلى نظام مراقبة الأخطاء
    if (window.errorDetection) {
        window.errorDetection.logError({
            type: 'FIREBASE_INIT_ERROR',
            message: error.message,
            timestamp: new Date().toISOString(),
            critical: true
        });
    }
}

// دوال مساعدة للتحقق من الاتصال
window.checkFirebaseConnection = async function() {
    try {
        if (window.firebaseServices.isFallback) {
            return { connected: false, mode: 'fallback' };
        }
        
        const testDoc = await db.collection('connection_test').doc('test').get();
        return { connected: true, mode: 'firebase' };
    } catch (error) {
        return { connected: false, error: error.message, mode: 'error' };
    }
};

// دالة لإعادة تهيئة Firebase
window.reinitializeFirebase = async function(newConfig) {
    try {
        if (firebase.apps.length > 0) {
            await firebase.app().delete();
        }
        
        Object.assign(firebaseConfig, newConfig);
        firebase.initializeApp(firebaseConfig);
        
        console.log('✅ Firebase reinitialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Firebase reinitialization failed:', error);
        return false;
    }
};
