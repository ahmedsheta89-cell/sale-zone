// firebase-api.js - Firebase Firestore API
// ==========================================
// نسخة محسنة مع معالجة أخطاء موحدة
// ==========================================

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
        const database = getFirebaseDB();
        const docRef = await database.collection('coupons').add(coupon);
        console.log('✅ Coupon added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        handleFirebaseError(e, 'addCoupon');
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
        const database = getFirebaseDB();
        const docRef = await database.collection('banners').add(banner);
        console.log('✅ Banner added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        handleFirebaseError(e, 'addBanner');
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
        const database = getFirebaseDB();
        const snapshot = await database.collection('products').get();
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
                ratingCount: data.ratingCount || 0,
                stock: data.stock || 0,
                featured: data.featured || false
            };
        });
        return products;
    } catch (e) {
        handleFirebaseError(e, 'getAllProducts');
        return [];
    }
}

async function addProduct(product) {
    try {
        const database = getFirebaseDB();
        const docRef = await database.collection('products').add(product);
        console.log('✅ Product added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        handleFirebaseError(e, 'addProduct');
        throw e;
    }
}

async function updateProduct(id, data) {
    try {
        const database = getFirebaseDB();
        await database.collection('products').doc(id).set(data, { merge: true });
        console.log('✅ Product updated in Firebase:', id);
    } catch (e) {
        handleFirebaseError(e, 'updateProduct');
        throw e;
    }
}

async function deleteProductFromFirebase(id) {
    try {
        const database = getFirebaseDB();
        await database.collection('products').doc(id).delete();
        console.log('✅ Product deleted from Firebase:', id);
    } catch (e) {
        handleFirebaseError(e, 'deleteProductFromFirebase');
        throw e;
    }
}

// ==========================================
// ORDERS
// ==========================================
async function getAllOrders() {
    try {
        const database = getFirebaseDB();
        const snapshot = await database.collection('orders').get();
        return snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
    } catch (e) {
        handleFirebaseError(e, 'getAllOrders');
        return [];
    }
}

async function addOrder(order) {
    try {
        const database = getFirebaseDB();
        const docRef = await database.collection('orders').add(order);
        console.log('✅ Order added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        handleFirebaseError(e, 'addOrder');
        throw e;
    }
}

async function updateOrderStatus(id, status) {
    try {
        const database = getFirebaseDB();
        await database.collection('orders').doc(id).update({ 
            status: status,
            updatedAt: new Date().toISOString()
        });
        console.log('✅ Order status updated:', id);
    } catch (e) {
        handleFirebaseError(e, 'updateOrderStatus');
        throw e;
    }
}

// ==========================================
// USERS
// ==========================================
async function getAllUsers() {
    try {
        const database = getFirebaseDB();
        const snapshot = await database.collection('users').get();
        return snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
    } catch (e) {
        handleFirebaseError(e, 'getAllUsers');
        return [];
    }
}

async function addUser(user) {
    try {
        const database = getFirebaseDB();
        const docRef = await database.collection('users').add(user);
        console.log('✅ User added to Firebase:', docRef.id);
        return docRef.id;
    } catch (e) {
        handleFirebaseError(e, 'addUser');
        throw e;
    }
}

async function updateUser(id, data) {
    try {
        const database = getFirebaseDB();
        await database.collection('users').doc(id).set(data, { merge: true });
        console.log('✅ User updated in Firebase:', id);
    } catch (e) {
        handleFirebaseError(e, 'updateUser');
        throw e;
    }
}

// ==========================================
// ADMIN OPERATIONS
// ==========================================
async function getAdminStats() {
    try {
        const database = getFirebaseDB();
        const [products, orders, users, coupons] = await Promise.all([
            database.collection('products').get(),
            database.collection('orders').get(),
            database.collection('users').get(),
            database.collection('coupons').get()
        ]);

        return {
            totalProducts: products.size,
            totalOrders: orders.size,
            totalUsers: users.size,
            totalCoupons: coupons.size,
            recentOrders: orders.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 10)
        };
    } catch (e) {
        handleFirebaseError(e, 'getAdminStats');
        return {
            totalProducts: 0,
            totalOrders: 0,
            totalUsers: 0,
            totalCoupons: 0,
            recentOrders: []
        };
    }
}

// ==========================================
// BATCH OPERATIONS
// ==========================================
async function batchDelete(collection, ids) {
    try {
        const database = getFirebaseDB();
        const batch = database.batch();
        
        ids.forEach(id => {
            const docRef = database.collection(collection).doc(id);
            batch.delete(docRef);
        });
        
        await batch.commit();
        console.log(`✅ Batch deleted ${ids.length} items from ${collection}`);
        return true;
    } catch (e) {
        handleFirebaseError(e, 'batchDelete');
        throw e;
    }
}

// ==========================================
// SEARCH OPERATIONS
// ==========================================
async function searchProducts(query) {
    try {
        const database = getFirebaseDB();
        const snapshot = await database.collection('products')
            .where('name', '>=', query)
            .where('name', '<=', query + '\uf8ff')
            .limit(20)
            .get();
            
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (e) {
        handleFirebaseError(e, 'searchProducts');
        return [];
    }
}

// ==========================================
// REAL-TIME LISTENERS
// ==========================================
function listenToOrders(callback) {
    try {
        const database = getFirebaseDB();
        return database.collection('orders')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                const orders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                callback(orders);
            });
    } catch (e) {
        handleFirebaseError(e, 'listenToOrders');
        return null;
    }
}

function listenToProducts(callback) {
    try {
        const database = getFirebaseDB();
        return database.collection('products')
            .onSnapshot(snapshot => {
                const products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                callback(products);
            });
    } catch (e) {
        handleFirebaseError(e, 'listenToProducts');
        return null;
    }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
async function backupData() {
    try {
        const database = getFirebaseDB();
        const collections = ['products', 'orders', 'users', 'coupons', 'banners'];
        const backup = {};
        
        for (const collection of collections) {
            const snapshot = await database.collection(collection).get();
            backup[collection] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }
        
        console.log('✅ Data backup completed');
        return backup;
    } catch (e) {
        handleFirebaseError(e, 'backupData');
        throw e;
    }
}

async function restoreData(backup) {
    try {
        const database = getFirebaseDB();
        const batch = database.batch();
        
        for (const [collection, items] of Object.entries(backup)) {
            items.forEach(item => {
                const docRef = database.collection(collection).doc(item.id);
                batch.set(docRef, item);
            });
        }
        
        await batch.commit();
        console.log('✅ Data restore completed');
        return true;
    } catch (e) {
        handleFirebaseError(e, 'restoreData');
        throw e;
    }
}

// تصدير الدوال للاستخدام العام
window.firebaseAPI = {
    // Coupons
    getCoupons, addCoupon, updateCoupon, deleteCoupon,
    // Banners
    getBanners, addBanner, updateBanner, deleteBanner,
    // Products
    getAllProducts, addProduct, updateProduct, deleteProductFromFirebase, searchProducts,
    // Orders
    getAllOrders, addOrder, updateOrderStatus, listenToOrders,
    // Users
    getAllUsers, addUser, updateUser,
    // Admin
    getAdminStats,
    // Batch
    batchDelete,
    // Real-time
    listenToProducts,
    // Utility
    backupData, restoreData
};
