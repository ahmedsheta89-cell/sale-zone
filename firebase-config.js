// ====================================================
// Firebase Configuration
// ====================================================
// استبدل هذه القيم بقيمك من Firebase Console

const firebaseConfig = {
    apiKey: "AIzaSyAtV6lPQkLfnchSPg1dwhAxh_2A-ZjzXuo",
    authDomain: "sale-zone-601f0.firebaseapp.com",
    projectId: "sale-zone-601f0",
    storageBucket: "sale-zone-601f0.firebasestorage.app",
    messagingSenderId: "2446302178",
    appId: "1:2446302178:web:2f25a3a4181ee6dcf137bb",
    measurementId: "G-V3JC43VQBC"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);

// الوصول للخدمات
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// إعدادات Firestore
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// تفعيل offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.log('The current browser does not support offline persistence');
        }
    });

// ====================================================
// Collections References (مراجع المجموعات)
// ====================================================
const productsRef = db.collection('products');
const ordersRef = db.collection('orders');
const usersRef = db.collection('users');
const couponsRef = db.collection('coupons');
const bannersRef = db.collection('banners');
const settingsRef = db.collection('settings');

// ====================================================
// Helper Functions
// ====================================================

// تحويل Timestamp لـ Date
function timestampToDate(timestamp) {
    if (!timestamp) return new Date();
    return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
}

// تحويل Date لـ Timestamp
function dateToTimestamp(date) {
    return firebase.firestore.Timestamp.fromDate(date || new Date());
}

// إنشاء ID فريد
function generateId() {
    return db.collection('temp').doc().id;
}

console.log('✅ Firebase initialized successfully');
