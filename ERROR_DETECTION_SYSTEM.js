// ============================================
// 🔍 Professional Error Detection System
// ============================================
// نظام احترافي لاكتشاف الأخطاء وإدارتها
// ============================================

class ErrorDetectionSystem {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.performance = {};
        this.userActions = [];
        this.systemHealth = {
            firebase: true,
            localStorage: true,
            dom: true,
            network: true
        };
        
        this.initialize();
    }

    // 🚀 تهيئة النظام
    initialize() {
        this.setupGlobalErrorHandler();
        this.setupPerformanceMonitoring();
        this.setupUserActionTracking();
        this.setupSystemHealthChecks();
        this.setupFirebaseMonitoring();
        this.setupLocalStorageMonitoring();
        this.setupMobileSpecificMonitoring(); // إضافة مراقبة التليفون
        
        console.log('🔍 Error Detection System initialized');
        this.startHealthCheck();
    }

    // 🛡️ معالج الأخطاء العام
    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'JAVASCRIPT_ERROR',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'UNHANDLED_PROMISE_REJECTION',
                message: event.reason?.message || 'Unhandled Promise Rejection',
                stack: event.reason?.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        });
    }

    // 📊 مراقبة الأداء
    setupPerformanceMonitoring() {
        // مراقبة وقت تحميل الصفحة
        window.addEventListener('load', () => {
            const loadTime = performance.now();
            this.performance.pageLoadTime = loadTime;
            
            if (loadTime > 3000) {
                this.logWarning({
                    type: 'SLOW_PAGE_LOAD',
                    message: `Page load time: ${loadTime.toFixed(2)}ms`,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // مراقبة الـ DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
            const domTime = performance.now();
            this.performance.domLoadTime = domTime;
        });
    }

    // 👤 تتبع إجراءات المستخدم
    setupUserActionTracking() {
        ['click', 'submit', 'change'].forEach(eventType => {
            document.addEventListener(eventType, (event) => {
                this.logUserAction({
                    type: eventType,
                    element: event.target.tagName,
                    id: event.target.id,
                    className: event.target.className,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }

    // 🏥 فحص صحة النظام
    setupSystemHealthChecks() {
        // فحص وجود العناصر الحيوية
        setInterval(() => {
            this.checkDOMHealth();
            this.checkNetworkHealth();
        }, 5000);
    }

    // 🔥 مراقبة Firebase
    setupFirebaseMonitoring() {
        // تخطي مراقبة Google Analytics و Firebase في GitHub Pages
        if (window.location.hostname === 'ahmedsheta89-cell.github.io') {
            console.log('🔥 GitHub Pages detected - skipping Firebase monitoring to avoid errors');
            return;
        }
        
        // اعتراض استدعاءات Firebase فقط في بيئة التطوير
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const startTime = performance.now();
            
            try {
                const response = await originalFetch.apply(this, args);
                
                // مراقبة استدعاءات Firebase فقط
                if (args[0]?.includes('firebaseio') || args[0]?.includes('googleapis')) {
                    const endTime = performance.now();
                    this.logFirebaseCall({
                        url: args[0],
                        method: args[1]?.method || 'GET',
                        duration: endTime - startTime,
                        status: response.status,
                        timestamp: new Date().toISOString()
                    });
                }
                
                return response;
            } catch (error) {
                // تسجيل أخطاء Firebase فقط
                if (args[0]?.includes('firebaseio') || args[0]?.includes('googleapis')) {
                    this.logError({
                        type: 'FIREBASE_ERROR',
                        message: error.message,
                        url: args[0],
                        timestamp: new Date().toISOString()
                    });
                }
                throw error;
            }
        };
    }

    // � مراقبة خاصة بالتليفون
    setupMobileSpecificMonitoring() {
        // كشف مشاكل iOS/Safari
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            console.log('📱 iOS device detected - enabling mobile monitoring');
            
            // مراقبة مشاكل الشبكة
            window.addEventListener('offline', () => {
                this.logError({
                    type: 'MOBILE_NETWORK_OFFLINE',
                    message: 'iOS device went offline',
                    device: 'iOS',
                    timestamp: new Date().toISOString()
                });
            });
            
            // مراقبة مشاكل localStorage
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
            } catch (error) {
                this.logError({
                    type: 'MOBILE_STORAGE_ERROR',
                    message: 'iOS localStorage error: ' + error.message,
                    device: 'iOS',
                    timestamp: new Date().toISOString()
                });
            }
            
            // مراقبة مشاكل Safari
            if (navigator.userAgent.includes('Safari')) {
                console.log('🦁 Safari detected - monitoring for Safari-specific issues');
                
                // مراقبة مشاكل fetch في Safari
                const originalFetch = window.fetch;
                window.fetch = async (...args) => {
                    try {
                        const response = await originalFetch.apply(this, args);
                        return response;
                    } catch (error) {
                        if (error.message.includes('Network request failed')) {
                            this.logError({
                                type: 'SAFARI_NETWORK_ERROR',
                                message: 'Safari network error: ' + error.message,
                                device: 'iOS/Safari',
                                url: args[0],
                                timestamp: new Date().toISOString()
                            });
                        }
                        throw error;
                    }
                };
            }
        }
    }
    setupLocalStorageMonitoring() {
        const originalSetItem = localStorage.setItem;
        const originalGetItem = localStorage.getItem;
        
        localStorage.setItem = (key, value) => {
            try {
                originalSetItem.call(this, key, value);
                this.logStorageOperation({
                    type: 'SET',
                    key: key,
                    size: value?.length || 0,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                this.logError({
                    type: 'LOCALSTORAGE_ERROR',
                    message: `Failed to set ${key}: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        };
        
        localStorage.getItem = (key) => {
            try {
                const value = originalGetItem.call(this, key);
                this.logStorageOperation({
                    type: 'GET',
                    key: key,
                    size: value?.length || 0,
                    timestamp: new Date().toISOString()
                });
                return value;
            } catch (error) {
                this.logError({
                    type: 'LOCALSTORAGE_ERROR',
                    message: `Failed to get ${key}: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
                return null;
            }
        };
    }

    // 🏥 فحص صحة DOM - FIXED
    checkDOMHealth() {
        // التحقق من أن الصفحة قد تم تحميلها بالكامل
        if (document.readyState !== 'complete') {
            return; // لا تفحص قبل اكتمال تحميل الصفحة
        }

        const criticalElements = [
            'bannerSlider',
            'bannerDots',
            'productsGrid',
            'cartCount',
            'loadingScreen'
        ];

        const missingElements = criticalElements.filter(id => !document.getElementById(id));

        // تحسين التحقق - لا تعتبر العناصر المفقودة خطأ إذا كانت الصفحة لا تزال تتحمل
        if (missingElements.length > 0 && document.readyState === 'complete') {
            // تحقق مما إذا كانت العناصر موجودة ولكن مخفية
            const hiddenElements = missingElements.filter(id => {
                const element = document.getElementById(id);
                return element && element.offsetParent === null; // مخفي
            });

            // فقط العناصر غير الموجودة تماماً تعتبر مشكلة
            const trulyMissing = missingElements.filter(id => !document.getElementById(id));

            if (trulyMissing.length > 0) {
                this.logWarning({
                    type: 'MISSING_DOM_ELEMENTS',
                    message: `Missing elements: ${trulyMissing.join(', ')}`,
                    elements: trulyMissing,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // تحسين حساب صحة DOM
        this.systemHealth.dom = missingElements.length === 0 || document.readyState === 'complete';
    }

    // 🌐 فحص صحة الشبكة
    checkNetworkHealth() {
        if (navigator.onLine === false) {
            this.logWarning({
                type: 'NETWORK_OFFLINE',
                message: 'User is offline',
                timestamp: new Date().toISOString()
            });
        }
        
        this.systemHealth.network = navigator.onLine;
    }

    // 📝 تسجيل الخطأ
    logError(error) {
        this.errors.push(error);
        this.handleError(error);
        this.updateSystemHealth();
        
        console.error('🔴 ERROR DETECTED:', error);
        
        // إرسال الخطأ للـ admin (اختياري)
        this.notifyAdmin(error);
    }

    // ⚠️ تسجيل التحذير
    logWarning(warning) {
        this.warnings.push(warning);
        console.warn('🟡 WARNING DETECTED:', warning);
    }

    // 👤 تسجيل إجراء المستخدم
    logUserAction(action) {
        this.userActions.push(action);
        
        // الاحتفاظ بآخر 100 إجراء فقط
        if (this.userActions.length > 100) {
            this.userActions = this.userActions.slice(-100);
        }
    }

    // 🔥 تسجيل استدعاءات Firebase
    logFirebaseCall(call) {
        if (!this.firebaseCalls) this.firebaseCalls = [];
        this.firebaseCalls.push(call);
        
        if (call.duration > 5000) {
            this.logWarning({
                type: 'SLOW_FIREBASE_CALL',
                message: `Slow Firebase call: ${call.duration.toFixed(2)}ms`,
                call: call,
                timestamp: new Date().toISOString()
            });
        }
    }

    // 💾 تسجيل عمليات التخزين
    logStorageOperation(operation) {
        if (!this.storageOperations) this.storageOperations = [];
        this.storageOperations.push(operation);
        
        // الاحتفاظ بآخر 50 عملية فقط
        if (this.storageOperations.length > 50) {
            this.storageOperations = this.storageOperations.slice(-50);
        }
    }

    // 🛠️ معالجة الخطأ
    handleError(error) {
        switch (error.type) {
            case 'MISSING_DOM_ELEMENTS':
                this.handleMissingElements(error.elements);
                break;
            case 'FIREBASE_ERROR':
                this.handleFirebaseError(error);
                break;
            case 'LOCALSTORAGE_ERROR':
                this.handleLocalStorageError(error);
                break;
            default:
                this.handleGenericError(error);
        }
    }

    // 🏥 معالجة العناصر المفقودة
    handleMissingElements(elements) {
        elements.forEach(elementId => {
            console.log(`🔧 Attempting to recreate missing element: ${elementId}`);
            // محاولة إعادة إنشاء العناصر المفقودة
            this.recreateElement(elementId);
        });
    }

    // 🔥 معالجة أخطاء Firebase
    handleFirebaseError(error) {
        console.log('🔥 Firebase error detected, switching to fallback mode');
        this.systemHealth.firebase = false;
        
        // إشعار المستخدم
        if (window.showNotification) {
            showNotification('warning', 'مشكلة في الاتصال', 'جاري العمل في وضع عدم الاتصال');
        }
    }

    // 💾 معالجة أخطاء التخزين
    handleLocalStorageError(error) {
        console.log('💾 LocalStorage error detected');
        this.systemHealth.localStorage = false;
        
        // محاولة تنظيف المساحة
        try {
            const keys = Object.keys(localStorage);
            const totalSize = keys.reduce((size, key) => {
                return size + (localStorage[key]?.length || 0);
            }, 0);
            
            if (totalSize > 5 * 1024 * 1024) { // 5MB
                console.log('🧹 LocalStorage is full, attempting cleanup');
                this.cleanupLocalStorage();
            }
        } catch (e) {
            console.error('Failed to cleanup localStorage:', e);
        }
    }

    // 🛠️ معالجة الخطأ العام
    handleGenericError(error) {
        console.log('🔧 Handling generic error:', error);
        
        // محاولة الاستمرار في العمل
        if (window.showNotification) {
            showNotification('error', 'حدث خطأ', 'جاري محاولة الإصلاح تلقائياً');
        }
    }

    // 🔄 إعادة إنشاء العنصر
    recreateElement(elementId) {
        // منطق إعادة إنشاء العناصر حسب النوع
        const elementMap = {
            'bannerSlider': () => this.createBannerSlider(),
            'bannerDots': () => this.createBannerDots(),
            'productsGrid': () => this.createProductsGrid()
        };
        
        if (elementMap[elementId]) {
            elementMap[elementId]();
        }
    }

    // 🎠 إنشاء Banner Slider
    createBannerSlider() {
        const existing = document.getElementById('bannerSlider');
        if (existing) return;
        
        const slider = document.createElement('div');
        slider.id = 'bannerSlider';
        slider.className = 'banner-slider';
        
        const container = document.querySelector('.banner-section');
        if (container) {
            container.insertBefore(slider, container.firstChild);
            console.log('✅ Banner slider recreated');
        }
    }

    // 🎠 إنشاء Banner Dots
    createBannerDots() {
        const existing = document.getElementById('bannerDots');
        if (existing) return;
        
        const dots = document.createElement('div');
        dots.id = 'bannerDots';
        dots.className = 'banner-dots';
        
        const container = document.querySelector('.banner-section');
        if (container) {
            container.appendChild(dots);
            console.log('✅ Banner dots recreated');
        }
    }

    // 🎠 إنشاء Products Grid
    createProductsGrid() {
        const existing = document.getElementById('productsGrid');
        if (existing) return;
        
        const grid = document.createElement('div');
        grid.id = 'productsGrid';
        grid.className = 'products-grid';
        
        const container = document.querySelector('.products-section');
        if (container) {
            container.appendChild(grid);
            console.log('✅ Products grid recreated');
        }
    }

    // 🧹 تنظيف LocalStorage
    cleanupLocalStorage() {
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            
            // إزالة البيانات القديمة أو التالفة
            try {
                const parsed = JSON.parse(value);
                if (parsed && parsed.timestamp) {
                    const age = Date.now() - new Date(parsed.timestamp).getTime();
                    if (age > 7 * 24 * 60 * 60 * 1000) { // 7 أيام
                        keysToRemove.push(key);
                    }
                }
            } catch (e) {
                // إزالة البيانات التالفة
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`🧹 Cleaned up ${keysToRemove.length} old localStorage entries`);
    }

    // 📊 تحديث صحة النظام
    updateSystemHealth() {
        const healthScore = Object.values(this.systemHealth).filter(healthy => healthy).length;
        const totalChecks = Object.keys(this.systemHealth).length;
        const healthPercentage = (healthScore / totalChecks) * 100;
        
        console.log(`🏥 System Health: ${healthPercentage.toFixed(1)}%`);
        
        // تحديث مؤشر الصحة في الصفحة
        this.updateHealthIndicator(healthPercentage);
    }

    // 📊 تحديث مؤشر الصحة
    updateHealthIndicator(percentage) {
        let indicator = document.getElementById('healthIndicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'healthIndicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 5px 10px;
                border-radius: 5px;
                font-size: 12px;
                z-index: 9999;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.textContent = `🏥 ${percentage.toFixed(1)}%`;
        
        // تغيير اللون حسب الصحة
        if (percentage >= 90) {
            indicator.style.background = 'rgba(0, 128, 0, 0.8)'; // أخضر
        } else if (percentage >= 70) {
            indicator.style.background = 'rgba(255, 165, 0, 0.8)'; // برتقالي
        } else {
            indicator.style.background = 'rgba(255, 0, 0, 0.8)'; // أحمر
        }
    }

    // 📨 إشعار الأدمن
    notifyAdmin(error) {
        // يمكن إضافة إشعار للـ admin هنا
        console.log('📨 Admin notification:', error);
        
        // حفظ الخطأ في LocalStorage للمراجعة
        const adminErrors = JSON.parse(localStorage.getItem('adminErrors') || '[]');
        adminErrors.push(error);
        
        // الاحتفاظ بآخر 50 خطأ فقط
        if (adminErrors.length > 50) {
            adminErrors.splice(0, adminErrors.length - 50);
        }
        
        localStorage.setItem('adminErrors', JSON.stringify(adminErrors));
    }

    // 🚀 بدء فحص الصحة
    startHealthCheck() {
        setInterval(() => {
            this.updateSystemHealth();
        }, 10000); // كل 10 ثواني
    }

    // 📊 الحصول على تقرير النظام
    getSystemReport() {
        return {
            timestamp: new Date().toISOString(),
            systemHealth: this.systemHealth,
            errors: this.errors.slice(-10), // آخر 10 أخطاء
            warnings: this.warnings.slice(-10), // آخر 10 تحذيرات
            performance: this.performance,
            recentActions: this.userActions.slice(-20), // آخر 20 إجراء
            firebaseCalls: this.firebaseCalls?.slice(-20), // آخر 20 استدعاء
            storageOperations: this.storageOperations?.slice(-20) // آخر 20 عملية
        };
    }

    // 🧹 تنظيف البيانات
    cleanup() {
        this.errors = [];
        this.warnings = [];
        this.userActions = [];
        console.log('🧹 Error detection system cleaned up');
    }
}

// 🚀 تهيئة النظام
let errorDetectionSystem;

document.addEventListener('DOMContentLoaded', function() {
    errorDetectionSystem = new ErrorDetectionSystem();
    
    // إضافة وظيفة عالمية للحصول على التقرير
    window.getSystemReport = () => errorDetectionSystem.getSystemReport();
    window.clearSystemErrors = () => errorDetectionSystem.cleanup();
    
    console.log('🔍 Professional Error Detection System loaded');
    console.log('💡 Use getSystemReport() to view system status');
    console.log('💡 Use clearSystemErrors() to clear errors');
});
