// firebase-api.js - Firebase Firestore API
// ==========================================
// Note: db is already declared in firebase-config.js

// التحقق من توفر Firebase Services
function getFirebaseDB() {
    if (window.firebaseServices && window.firebaseServices.db) {
        return window.firebaseServices.db;
    }
    if (typeof db !== 'undefined') {
        return db;
    }
    throw new Error('Firebase Firestore not available');
}

// معالجة الأخطاء الموحدة
function handleFirebaseError(error, operation) {
    console.error(`${operation} error:`, error);
    
    // تسجيل الخطأ في نظام المراقبة
    if (window.errorDetection) {
        window.errorDetection.logError({
            type: 'FIREBASE_API_ERROR',
            operation: operation,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
    
    return error;
}

// ==========================================
// COUPONS
// ==========================================
async function getCoupons() {
    try {
        const database = getFirebaseDB();
        const snapshot = await database.collection('coupons').get();
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
        handleFirebaseError(e, 'getCoupons');
        return [];
    }
}

async function addCoupon(coupon) {
    try {
        const docRef = await db.collection('coupons').add(coupon);
        console.log('✅ Coupon added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addCoupon error:', e);
        throw e;
    }
}

async function updateCoupon(id, data) {
    try {
        const database = getFirebaseDB();
        await database.collection('coupons').doc(id).set(data, { merge: true });
        console.log('✅ Coupon updated in Firebase:', id);
    } catch (e) {
        handleFirebaseError(e, 'updateCoupon');
        throw e;
    }
}

async function deleteCoupon(id) {
    try {
        const database = getFirebaseDB();
        await database.collection('coupons').doc(id).delete();
        console.log('✅ Coupon deleted from Firebase:', id);
    } catch (e) {
        handleFirebaseError(e, 'deleteCoupon');
        throw e;
    }
}

// ==========================================
// BANNERS
// ==========================================
async function getBanners() {
    try {
        const database = getFirebaseDB();
        const snapshot = await database.collection('banners').get();
        const banners = snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                icon: data.icon || '🎉',
                title: data.title || '',
                text: data.text || '',
                btn: data.btn || 'تسوق الآن',
                category: data.category || 'all'
            };
        });
        return banners;
    } catch (e) {
        handleFirebaseError(e, 'getBanners');
        return [];
    }
}

async function addBanner(banner) {
    try {
        const docRef = await db.collection('banners').add(banner);
        console.log('✅ Banner added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addBanner error:', e);
        throw e;
    }
}

async function updateBanner(id, data) {
    try {
        const database = getFirebaseDB();
        await database.collection('banners').doc(id).set(data, { merge: true });
        console.log('✅ Banner updated in Firebase:', id);
    } catch (e) {
        handleFirebaseError(e, 'updateBanner');
        throw e;
    }
}

async function deleteBanner(id) {
    try {
        const database = getFirebaseDB();
        await database.collection('banners').doc(id).delete();
        console.log('✅ Banner deleted from Firebase:', id);
    } catch (e) {
        handleFirebaseError(e, 'deleteBanner');
        throw e;
    }
}

// ==========================================
// PRODUCTS
// ==========================================
async function getAllProducts() {
    try {
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
        return [];
    }
}

async function addProduct(product) {
    try {
        const docRef = await db.collection('products').add(product);
        console.log('✅ Product added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addProduct error:', e);
        throw e;
    }
}

async function updateProduct(id, data) {
    try {
        await db.collection('products').doc(id).set(data, { merge: true });
        console.log('✅ Product updated in Firebase:', id);
    } catch (e) {
        console.error('updateProduct error:', e);
        throw e;
    }
}

async function deleteProductFromFirebase(id) {
    try {
        await db.collection('products').doc(id).delete();
        console.log('✅ Product deleted from Firebase:', id);
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
        const snapshot = await db.collection('orders').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllOrders error:', e);
        return [];
    }
}

async function addOrder(order) {
    try {
        const docRef = await db.collection('orders').add(order);
        console.log('✅ Order added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addOrder error:', e);
        throw e;
    }
}

async function updateOrderStatus(id, status) {
    try {
        await db.collection('orders').doc(id).update({ status: status });
        console.log('✅ Order status updated:', id);
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
        const snapshot = await db.collection('users').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllUsers error:', e);
        return [];
    }
}

// ==========================================
// COUPONS
// ==========================================
async function getAllCoupons() {
    try {
        const snapshot = await db.collection('coupons').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllCoupons error:', e);
        return [];
    }
}

async function addCoupon(coupon) {
    try {
        const docRef = await db.collection('coupons').add(coupon);
        console.log('✅ Coupon added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addCoupon error:', e);
        throw e;
    }
}

async function deleteCouponFromFirebase(id) {
    try {
        await db.collection('coupons').doc(id).delete();
        console.log('✅ Coupon deleted from Firebase:', id);
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
        const snapshot = await db.collection('banners').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('getAllBanners error:', e);
        return [];
    }
}

async function addBanner(banner) {
    try {
        const docRef = await db.collection('banners').add(banner);
        console.log('✅ Banner added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('addBanner error:', e);
        throw e;
    }
}

async function deleteBannerFromFirebase(id) {
    try {
        await db.collection('banners').doc(id).delete();
        console.log('✅ Banner deleted from Firebase:', id);
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
        const doc = await db.collection('settings').doc('store').get();
        return doc.exists ? doc.data() : null;
    } catch (e) {
        console.error('getSettings error:', e);
        return null;
    }
}

async function saveSettings(settings) {
    try {
        await db.collection('settings').doc('store').set(settings, { merge: true });
        console.log('✅ Settings saved to Firebase');
    } catch (e) {
        console.error('saveSettings error:', e);
        throw e;
    }
}

console.log('✅ Firebase API loaded');
