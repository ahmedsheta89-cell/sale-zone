// ====================================================
// Firebase API Functions
// ====================================================

// ============================================
// 📦 Products API
// ============================================

// جلب جميع المنتجات
async function getAllProducts() {
    try {
        const snapshot = await productsRef.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: timestampToDate(doc.data().createdAt)
        }));
    } catch (error) {
        console.error('Error getting products:', error);
        return [];
    }
}

// إضافة منتج جديد
async function addProduct(product) {
    try {
        const docRef = await productsRef.add({
            ...product,
            createdAt: dateToTimestamp(),
            updatedAt: dateToTimestamp()
        });
        return { id: docRef.id, ...product };
    } catch (error) {
        console.error('Error adding product:', error);
        throw error;
    }
}

// تحديث منتج
async function updateProduct(id, updates) {
    try {
        await productsRef.doc(id).update({
            ...updates,
            updatedAt: dateToTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error updating product:', error);
        throw error;
    }
}

// حذف منتج
async function deleteProduct(id) {
    try {
        await productsRef.doc(id).delete();
        return true;
    } catch (error) {
        console.error('Error deleting product:', error);
        throw error;
    }
}

// البحث في المنتجات
async function searchProducts(searchTerm) {
    try {
        const snapshot = await productsRef.get();
        const products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        const term = searchTerm.toLowerCase();
        return products.filter(p => 
            p.name?.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term)
        );
    } catch (error) {
        console.error('Error searching products:', error);
        return [];
    }
}

// ============================================
// 🛍️ Orders API
// ============================================

// جلب جميع الطلبات
async function getAllOrders() {
    try {
        const snapshot = await ordersRef.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: timestampToDate(doc.data().createdAt)
        }));
    } catch (error) {
        console.error('Error getting orders:', error);
        return [];
    }
}

// إضافة طلب جديد
async function addOrder(order) {
    try {
        const docRef = await ordersRef.add({
            ...order,
            createdAt: dateToTimestamp(),
            updatedAt: dateToTimestamp()
        });
        return { id: docRef.id, ...order };
    } catch (error) {
        console.error('Error adding order:', error);
        throw error;
    }
}

// تحديث حالة الطلب
async function updateOrderStatus(orderId, status, note = '') {
    try {
        const orderDoc = await ordersRef.doc(orderId).get();
        const order = orderDoc.data();
        
        const statusHistory = order.statusHistory || [];
        statusHistory.push({
            status,
            date: new Date().toISOString(),
            note
        });
        
        await ordersRef.doc(orderId).update({
            status,
            statusHistory,
            updatedAt: dateToTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
    }
}

// حذف طلب
async function deleteOrder(id) {
    try {
        await ordersRef.doc(id).delete();
        return true;
    } catch (error) {
        console.error('Error deleting order:', error);
        throw error;
    }
}

// جلب طلبات مستخدم محدد
async function getUserOrders(userId) {
    try {
        const snapshot = await ordersRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: timestampToDate(doc.data().createdAt)
        }));
    } catch (error) {
        console.error('Error getting user orders:', error);
        return [];
    }
}

// ============================================
// 👥 Users API
// ============================================

// جلب جميع المستخدمين
async function getAllUsers() {
    try {
        const snapshot = await usersRef.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: timestampToDate(doc.data().createdAt)
        }));
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
}

// إضافة/تحديث مستخدم
async function saveUser(user) {
    try {
        const userId = user.id || generateId();
        await usersRef.doc(userId).set({
            ...user,
            updatedAt: dateToTimestamp(),
            createdAt: user.createdAt || dateToTimestamp()
        }, { merge: true });
        return { id: userId, ...user };
    } catch (error) {
        console.error('Error saving user:', error);
        throw error;
    }
}

// جلب مستخدم بالـ ID
async function getUserById(userId) {
    try {
        const doc = await usersRef.doc(userId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

// تحديث نقاط الولاء
async function updateUserLoyaltyPoints(userId, points) {
    try {
        await usersRef.doc(userId).update({
            loyaltyPoints: points,
            updatedAt: dateToTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error updating loyalty points:', error);
        throw error;
    }
}

// ============================================
// 🎫 Coupons API
// ============================================

// جلب جميع الكوبونات
async function getAllCoupons() {
    try {
        const snapshot = await couponsRef.get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting coupons:', error);
        return [];
    }
}

// إضافة كوبون
async function addCoupon(coupon) {
    try {
        const docRef = await couponsRef.add({
            ...coupon,
            createdAt: dateToTimestamp()
        });
        return { id: docRef.id, ...coupon };
    } catch (error) {
        console.error('Error adding coupon:', error);
        throw error;
    }
}

// تحديث كوبون
async function updateCoupon(id, updates) {
    try {
        await couponsRef.doc(id).update(updates);
        return true;
    } catch (error) {
        console.error('Error updating coupon:', error);
        throw error;
    }
}

// حذف كوبون
async function deleteCoupon(id) {
    try {
        await couponsRef.doc(id).delete();
        return true;
    } catch (error) {
        console.error('Error deleting coupon:', error);
        throw error;
    }
}

// التحقق من كوبون
async function validateCoupon(code) {
    try {
        const snapshot = await couponsRef.where('code', '==', code).get();
        if (snapshot.empty) return null;
        
        const coupon = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        
        // التحقق من الصلاحية
        if (!coupon.active) return null;
        if (coupon.expiresAt && timestampToDate(coupon.expiresAt) < new Date()) return null;
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return null;
        
        return coupon;
    } catch (error) {
        console.error('Error validating coupon:', error);
        return null;
    }
}

// ============================================
// 🎠 Banners API
// ============================================

// جلب جميع البانرات
async function getAllBanners() {
    try {
        const snapshot = await bannersRef.orderBy('order', 'asc').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting banners:', error);
        return [];
    }
}

// إضافة بانر
async function addBanner(banner) {
    try {
        const docRef = await bannersRef.add({
            ...banner,
            createdAt: dateToTimestamp()
        });
        return { id: docRef.id, ...banner };
    } catch (error) {
        console.error('Error adding banner:', error);
        throw error;
    }
}

// تحديث بانر
async function updateBanner(id, updates) {
    try {
        await bannersRef.doc(id).update(updates);
        return true;
    } catch (error) {
        console.error('Error updating banner:', error);
        throw error;
    }
}

// حذف بانر
async function deleteBanner(id) {
    try {
        await bannersRef.doc(id).delete();
        return true;
    } catch (error) {
        console.error('Error deleting banner:', error);
        throw error;
    }
}

// ============================================
// ⚙️ Settings API
// ============================================

// جلب الإعدادات
async function getSettings() {
    try {
        const doc = await settingsRef.doc('store').get();
        if (doc.exists) {
            return doc.data();
        }
        return {};
    } catch (error) {
        console.error('Error getting settings:', error);
        return {};
    }
}

// حفظ الإعدادات
async function saveSettings(settings) {
    try {
        await settingsRef.doc('store').set(settings, { merge: true });
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        throw error;
    }
}

// ============================================
// 🔄 Real-time Listeners (المستمعين المباشرين)
// ============================================

// الاستماع للتغييرات في المنتجات
function listenToProducts(callback) {
    return productsRef.onSnapshot(snapshot => {
        const products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(products);
    });
}

// الاستماع للتغييرات في الطلبات
function listenToOrders(callback) {
    return ordersRef.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: timestampToDate(doc.data().createdAt)
        }));
        callback(orders);
    });
}

// الاستماع لطلب محدد
function listenToOrder(orderId, callback) {
    return ordersRef.doc(orderId).onSnapshot(doc => {
        if (doc.exists) {
            callback({ id: doc.id, ...doc.data() });
        }
    });
}

console.log('✅ Firebase API functions loaded');
