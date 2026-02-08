// ============================================
// 🔐 Firebase Authentication Implementation
// ============================================
// نظام مصادقة احترافي مع Firebase
// ============================================

class FirebaseAuthentication {
    constructor() {
        this.auth = null;
        this.db = null;
        this.currentUser = null;
        this.isAdmin = false;
        this.initialize();
    }

    // 🚀 تهيئة Firebase Authentication
    async initialize() {
        try {
            // التحقق من وجود Firebase
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded');
            }

            // التحقق من وجود Services
            if (!window.firebaseServices) {
                throw new Error('Firebase services not initialized');
            }

            this.auth = window.firebaseServices.auth;
            this.db = window.firebaseServices.db;

            if (!this.auth || !this.db) {
                throw new Error('Firebase auth or db not available');
            }

            // مراقبة حالة المصادقة
            this.auth.onAuthStateChanged((user) => {
                this.handleAuthStateChange(user);
            });

            console.log('🔐 Firebase Authentication initialized');
        } catch (error) {
            console.error('❌ Firebase Auth initialization failed:', error);
            // Fallback to localStorage
            this.initializeFallback();
        }
    }

    // 🔄 معالجة تغيير حالة المصادقة
    handleAuthStateChange(user) {
        this.currentUser = user;
        if (user) {
            this.checkAdminStatus(user);
        } else {
            this.isAdmin = false;
            this.redirectToLogin();
        }
    }

    // 🛡️ التحقق من صلاحيات الأدمن
    async checkAdminStatus(user) {
        try {
            if (!this.db) {
                throw new Error('Firestore not available');
            }

            const userDoc = await this.db.collection('admins').doc(user.uid).get();
            this.isAdmin = userDoc.exists;
            
            if (this.isAdmin) {
                console.log('👤 Admin user authenticated');
                this.setupAdminFeatures();
            } else {
                console.log('👤 Regular user authenticated');
                this.setupUserFeatures();
            }
        } catch (error) {
            console.error('❌ Admin status check failed:', error);
            this.isAdmin = false;
            
            // Fallback - التحقق من localStorage
            const adminStatus = localStorage.getItem('admin_status');
            this.isAdmin = adminStatus === user.uid;
        }
    }

    // 🔐 تسجيل الدخول للأدمن
    async adminLogin(email, password) {
        try {
            if (!this.auth) {
                throw new Error('Firebase Auth not initialized');
            }

            const result = await this.auth.signInWithEmailAndPassword(email, password);
            const user = result.user;

            // التحقق من صلاحيات الأدمن
            if (this.db) {
                const adminDoc = await this.db.collection('admins').doc(user.uid).get();
                if (!adminDoc.exists) {
                    throw new Error('ليس لديك صلاحيات الأدمن');
                }

                // تحديث آخر تسجيل دخول
                await this.db.collection('admins').doc(user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                    loginCount: firebase.firestore.FieldValue.increment(1)
                });
            } else {
                // Fallback verification
                const adminEmails = ['admin@salezone.com', 'ahmedsheta89@gmail.com'];
                if (!adminEmails.includes(email)) {
                    throw new Error('ليس لديك صلاحيات الأدمن');
                }
                localStorage.setItem('admin_status', user.uid);
            }

            console.log('✅ Admin login successful');
            return { success: true, user };
        } catch (error) {
            console.error('❌ Admin login failed:', error);
            
            // تسجيل الخطأ في نظام المراقبة
            if (window.errorDetection) {
                window.errorDetection.logError({
                    type: 'ADMIN_LOGIN_ERROR',
                    message: error.message,
                    email: email,
                    timestamp: new Date().toISOString()
                });
            }
            
            return { success: false, error: error.message };
        }
    }

    // 🚪 تسجيل الخروج
    async logout() {
        try {
            await this.auth.signOut();
            console.log('✅ Logout successful');
            return { success: true };
        } catch (error) {
            console.error('❌ Logout failed:', error);
            return { success: false, error: error.message };
        }
    }

    // 📱 إعداد مميزات الأدمن
    setupAdminFeatures() {
        // إضافة مميزات الأدمن
        this.enableAdminControls();
        this.startAdminMonitoring();
    }

    // 👤 إعداد مميزات المستخدم
    setupUserFeatures() {
        // إضافة مميزات المستخدم
        this.enableUserControls();
        this.startUserTracking();
    }

    // 🔄 توجيه لصفحة تسجيل الدخول
    redirectToLogin() {
        if (window.location.pathname.includes('ادمن')) {
            // توجيه لصفحة تسجيل الدخول
            this.showLoginModal();
        }
    }

    // 📋 عرض نافذة تسجيل الدخول
    showLoginModal() {
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-modal-content">
                <h2>🔐 تسجيل دخول الأدمن</h2>
                <form id="adminLoginForm">
                    <div class="form-group">
                        <label>البريد الإلكتروني</label>
                        <input type="email" id="adminEmail" required>
                    </div>
                    <div class="form-group">
                        <label>كلمة المرور</label>
                        <input type="password" id="adminPassword" required>
                    </div>
                    <button type="submit">دخول</button>
                    <div id="loginError" class="error-message"></div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupLoginForm();
    }

    // 📝 إعداد نموذج تسجيل الدخول
    setupLoginForm() {
        const form = document.getElementById('adminLoginForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            const errorDiv = document.getElementById('loginError');

            const result = await this.adminLogin(email, password);
            if (result.success) {
                document.querySelector('.auth-modal').remove();
            } else {
                errorDiv.textContent = result.error;
            }
        });
    }

    // 🛡️ Fallback للنظام القديم
    initializeFallback() {
        console.log('🔄 Using fallback authentication');
        // استخدام النظام القديم مع تحسينات
        this.setupLegacyAuth();
    }

    // 🔄 إعداد المصادقة القديمة
    setupLegacyAuth() {
        // تحسين النظام القديم
        const originalLogin = window.handleLogin;
        if (originalLogin) {
            window.handleLogin = async (e) => {
                e.preventDefault();
                const pass = document.getElementById('adminPassword').value;
                
                // Rate limiting
                if (this.isRateLimited()) {
                    this.showError('محاولات كثيرة، حاول لاحقاً');
                    return;
                }

                // تحقق من كلمة المرور
                const adminPassword = localStorage.getItem('adminPassword') || 'SaleZone@2026!Admin';
                if (pass === adminPassword) {
                    localStorage.setItem('adminLoggedIn', 'true');
                    localStorage.setItem('adminLoginTime', new Date().toISOString());
                    this.isAdmin = true;
                    this.setupAdminFeatures();
                    this.hideLoginScreen();
                } else {
                    this.showError('كلمة المرور غير صحيحة');
                    this.incrementFailedAttempts();
                }
            };
        }
    }

    // ⏱️ التحقق من Rate Limiting
    isRateLimited() {
        const attempts = parseInt(localStorage.getItem('failedAttempts') || '0');
        const lastAttempt = localStorage.getItem('lastAttempt');
        const now = new Date().getTime();
        
        if (attempts >= 5 && lastAttempt && (now - parseInt(lastAttempt)) < 300000) {
            return true; // 5 دقائق حظر
        }
        return false;
    }

    // 📈 زيادة المحاولات الفاشلة
    incrementFailedAttempts() {
        const attempts = parseInt(localStorage.getItem('failedAttempts') || '0');
        localStorage.setItem('failedAttempts', (attempts + 1).toString());
        localStorage.setItem('lastAttempt', new Date().getTime().toString());
    }

    // 🚨 عرض رسالة خطأ
    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }

    // 🙈 إخفاء شاشة تسجيل الدخول
    hideLoginScreen() {
        const loginScreen = document.querySelector('.login-screen');
        if (loginScreen) {
            loginScreen.style.display = 'none';
        }
    }

    // 🎛️ تمكين تحكمات الأدمن
    enableAdminControls() {
        // إضافة تحكمات الأدمن للواجهة
        document.body.classList.add('admin-mode');
    }

    // 📊 بدء مراقبة الأدمن
    startAdminMonitoring() {
        // مراقبة نشاط الأدمن
        setInterval(() => {
            this.checkSessionValidity();
        }, 60000); // كل دقيقة
    }

    // 👤 تمكين تحكمات المستخدم
    enableUserControls() {
        // إضافة تحكمات المستخدم
        document.body.classList.add('user-mode');
    }

    // 📈 بدء تتبع المستخدم
    startUserTracking() {
        // تتبع نشاط المستخدم
        console.log('👤 User tracking started');
    }

    // 🔍 التحقق من صلاحية الجلسة
    checkSessionValidity() {
        if (this.currentUser) {
            const lastActivity = localStorage.getItem('lastActivity');
            const now = new Date().getTime();
            
            if (lastActivity && (now - parseInt(lastActivity)) > 3600000) {
                // انتهت صلاحية الجلسة (ساعة)
                this.logout();
            }
        }
    }
}

// تهيئة نظام المصادقة
window.firebaseAuth = new FirebaseAuthentication();
    forceLogout() {
        sessionStorage.removeItem('adminSession');
        localStorage.removeItem('adminSession');
        window.location.reload();
    }

    // 🎲 إنشاء معرّف آمن
    generateSecureId() {
        return Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // 🚨 التحقق من Rate Limiting
    isRateLimited() {
        const attempts = parseInt(localStorage.getItem('loginAttempts') || '0');
        const lastAttempt = parseInt(localStorage.getItem('lastLoginAttempt') || '0');
        const now = Date.now();
        
        // إعادة تعيين المحاولات بعد 15 دقيقة
        if (now - lastAttempt > 15 * 60 * 1000) {
            localStorage.setItem('loginAttempts', '0');
            return false;
        }
        
        // حظر بعد 5 محاولات
        return attempts >= 5;
    }

    // 📱 الحصول على IP العميل
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    // 📊 بدء مراقبة الأدمن
    startAdminMonitoring() {
        // مراقبة نشاط الأدمن
        this.trackAdminActions();
        this.logSecurityEvents();
    }

    // 📊 تتبع إجراءات الأدمن
    trackAdminActions() {
        document.addEventListener('click', (e) => {
            if (this.isAdmin) {
                this.logAdminAction('click', e.target);
            }
        });
    }

    // 📝 تسجيل أحداث الأمان
    logSecurityEvents() {
        // تسجيل محاولات تسجيل الدخول
        // تسجيل التغييرات المهمة
        // تسجيل الأنشطة المشبوهة
    }

    // 🚨 عرض رسالة خطأ
    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }
}

// 🚀 تهيئة نظام المصادقة
document.addEventListener('DOMContentLoaded', () => {
    window.firebaseAuth = new FirebaseAuthentication();
});
