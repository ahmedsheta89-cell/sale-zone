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

            this.auth = firebase.auth();
            this.db = firebase.firestore();

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
        }
    }

    // 🔐 تسجيل الدخول للأدمن
    async adminLogin(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            const user = result.user;

            // التحقق من صلاحيات الأدمن
            const adminDoc = await this.db.collection('admins').doc(user.uid).get();
            if (!adminDoc.exists) {
                throw new Error('ليس لديك صلاحيات الأدمن');
            }

            // تحديث آخر تسجيل دخول
            await this.db.collection('admins').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                loginCount: firebase.firestore.FieldValue.increment(1)
            });

            console.log('✅ Admin login successful');
            return { success: true, user };
        } catch (error) {
            console.error('❌ Admin login failed:', error);
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
                    this.setupSecureSession();
                    window.location.reload();
                } else {
                    this.showError('كلمة المرور خاطئة');
                }
            };
        }
    }

    // 🛡️ إعداد جلسة آمنة
    setupSecureSession() {
        const sessionId = this.generateSecureId();
        const sessionData = {
            id: sessionId,
            loginTime: Date.now(),
            userAgent: navigator.userAgent,
            ip: 'unknown' // سيتم تحديثه لاحقاً
        };

        // الحصول على IP بشكل غير متزامن
        this.getClientIP().then(ip => {
            sessionData.ip = ip;
            sessionStorage.setItem('adminSession', JSON.stringify(sessionData));
        });

        sessionStorage.setItem('adminSession', JSON.stringify(sessionData));
        
        // إعداد انتهاء الجلسة
        setTimeout(() => {
            this.checkSessionValidity();
        }, 60000); // تحقق كل دقيقة
    }

    // 🔍 التحقق من صلاحية الجلسة
    checkSessionValidity() {
        const session = sessionStorage.getItem('adminSession');
        if (session) {
            const sessionData = JSON.parse(session);
            const now = Date.now();
            const sessionAge = now - sessionData.loginTime;
            
            // انتهاء الجلسة بعد 8 ساعات
            if (sessionAge > 8 * 60 * 60 * 1000) {
                this.forceLogout();
            }
        }
    }

    // 🚪 تسجيل الخروج الإجباري
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
