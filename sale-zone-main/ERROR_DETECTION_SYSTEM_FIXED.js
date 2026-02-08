// ============================================
// 🔍 Professional Error Detection System - Fixed
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
        this.setupMobileSpecificMonitoring();
        
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

    // 🔥 مراقبة Firebase محسنة
    setupFirebaseMonitoring() {
        // التحقق من بيئة التشغيل
        const isGitHubPages = window.location.hostname === 'ahmedsheta89-cell.github.io';
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isGitHubPages) {
            console.log('🔥 GitHub Pages detected - using safe Firebase monitoring');
            this.setupSafeFirebaseMonitoring();
            return;
        }
        
        if (!isLocalhost && !window.firebaseServices) {
            console.log('🔥 Firebase not available - skipping monitoring');
            return;
        }
        
        // مراقبة استدعاءات Firebase في بيئة التطوير
        this.setupAdvancedFirebaseMonitoring();
    }
    
    // 🛡️ مراقبة Firebase آمنة
    setupSafeFirebaseMonitoring() {
        // مراقبة حالة Firebase فقط بدون اعتراض الاستدعاءات
        setInterval(() => {
            this.checkFirebaseHealth();
        }, 10000);
    }
    
    // 🔍 مراقبة Firebase متقدمة
    setupAdvancedFirebaseMonitoring() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const startTime = performance.now();
            
            try {
                const response = await originalFetch.apply(this, args);
                
                // مراقبة استدعاءات Firebase
                if (this.isFirebaseCall(args[0])) {
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
                if (this.isFirebaseCall(args[0])) {
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
    
    // 🔍 التحقق من أن الاستدعاء لـ Firebase
    isFirebaseCall(url) {
        if (!url || typeof url !== 'string') return false;
        return url.includes('firebaseio') || 
               url.includes('googleapis') || 
               url.includes('firebase') ||
               url.includes('google.com');
    }

    // 📱 مراقبة خاصة بالجوال
    setupMobileSpecificMonitoring() {
        // التحقق من أن الجهاز جوال
        if (!this.isMobileDevice()) {
            return;
        }
        
        console.log('📱 Mobile device detected - enabling mobile monitoring');
        
        // مراقبة اتجاه الشاشة
        window.addEventListener('orientationchange', () => {
            this.logUserAction({
                type: 'ORIENTATION_CHANGE',
                orientation: window.orientation,
                timestamp: new Date().toISOString()
            });
        });
        
        // مراقبة حجم الشاشة
        window.addEventListener('resize', () => {
            this.logUserAction({
                type: 'SCREEN_RESIZE',
                width: window.innerWidth,
                height: window.innerHeight,
                timestamp: new Date().toISOString()
            });
        });
        
        // مراقبة البطارية (إذا كانت مدعومة)
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                battery.addEventListener('levelchange', () => {
                    this.logUserAction({
                        type: 'BATTERY_LEVEL',
                        level: battery.level,
                        timestamp: new Date().toISOString()
                    });
                });
            });
        }
    }
    
    // 📱 التحقق من أن الجهاز جوال
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    // 💾 مراقبة localStorage
    setupLocalStorageMonitoring() {
        // مراقبة تغيرات localStorage
        window.addEventListener('storage', (event) => {
            this.logUserAction({
                type: 'STORAGE_CHANGE',
                key: event.key,
                oldValue: event.oldValue,
                newValue: event.newValue,
                timestamp: new Date().toISOString()
            });
        });

        // فحص مساحة التخزين
        setInterval(() => {
            this.checkStorageHealth();
        }, 30000);
    }

    // 🏥 فحص صحة DOM
    checkDOMHealth() {
        try {
            const criticalElements = ['body', 'head'];
            const missing = criticalElements.filter(tag => !document.querySelector(tag));
            
            if (missing.length > 0) {
                this.logError({
                    type: 'DOM_HEALTH_ERROR',
                    message: `Missing critical elements: ${missing.join(', ')}`,
                    timestamp: new Date().toISOString()
                });
            }
            
            this.systemHealth.dom = missing.length === 0;
        } catch (error) {
            this.logError({
                type: 'DOM_CHECK_ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            });
            this.systemHealth.dom = false;
        }
    }

    // 🌐 فحص صحة الشبكة
    checkNetworkHealth() {
        try {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            
            if (connection) {
                if (connection.effectiveType === 'slow-2g' || connection.downlink < 0.1) {
                    this.logWarning({
                        type: 'SLOW_NETWORK',
                        message: `Slow connection detected: ${connection.effectiveType}`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            this.systemHealth.network = navigator.onLine;
        } catch (error) {
            this.systemHealth.network = true;
        }
    }

    // 🔥 فحص صحة Firebase
    checkFirebaseHealth() {
        try {
            if (window.firebaseServices) {
                this.systemHealth.firebase = true;
            } else {
                this.logWarning({
                    type: 'FIREBASE_UNAVAILABLE',
                    message: 'Firebase services not available',
                    timestamp: new Date().toISOString()
                });
                this.systemHealth.firebase = false;
            }
        } catch (error) {
            this.logError({
                type: 'FIREBASE_HEALTH_ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            });
            this.systemHealth.firebase = false;
        }
    }

    // 💾 فحص صحة التخزين
    checkStorageHealth() {
        try {
            const testKey = 'health_check_' + Date.now();
            const testValue = 'test';
            
            localStorage.setItem(testKey, testValue);
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            if (retrieved !== testValue) {
                throw new Error('LocalStorage read/write test failed');
            }
            
            this.systemHealth.localStorage = true;
        } catch (error) {
            this.logError({
                type: 'STORAGE_HEALTH_ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            });
            this.systemHealth.localStorage = false;
        }
    }

    // 📝 تسجيل الخطأ
    logError(error) {
        this.errors.push(error);
        
        // الحفاظ على آخر 100 خطأ فقط
        if (this.errors.length > 100) {
            this.errors = this.errors.slice(-100);
        }
        
        console.error('🔴 ERROR:', error);
        
        // إرسال إلى لوحة التحكم إذا كانت متاحة
        if (window.errorDashboard) {
            window.errorDashboard.addError(error);
        }
    }

    // ⚠️ تسجيل تحذير
    logWarning(warning) {
        this.warnings.push(warning);
        
        // الحفاظ على آخر 50 تحذير فقط
        if (this.warnings.length > 50) {
            this.warnings = this.warnings.slice(-50);
        }
        
        console.warn('🟡 WARNING:', warning);
    }

    // 👤 تسجيل إجراء المستخدم
    logUserAction(action) {
        this.userActions.push(action);
        
        // الحفاظ على آخر 200 إجراء فقط
        if (this.userActions.length > 200) {
            this.userActions = this.userActions.slice(-200);
        }
    }

    // 🔥 تسجيل استدعاء Firebase
    logFirebaseCall(call) {
        if (!this.performance.firebaseCalls) {
            this.performance.firebaseCalls = [];
        }
        
        this.performance.firebaseCalls.push(call);
        
        // الحفاظ على آخر 50 استدعاء فقط
        if (this.performance.firebaseCalls.length > 50) {
            this.performance.firebaseCalls = this.performance.firebaseCalls.slice(-50);
        }
        
        // تسجيل الاستدعاءات البطيئة
        if (call.duration > 2000) {
            this.logWarning({
                type: 'SLOW_FIREBASE_CALL',
                message: `Slow Firebase call: ${call.url} (${call.duration.toFixed(2)}ms)`,
                timestamp: new Date().toISOString()
            });
        }
    }

    // 🚀 بدء الفحص الصحي
    startHealthCheck() {
        setInterval(() => {
            this.performHealthCheck();
        }, 30000); // كل 30 ثانية
    }

    // 🔍 إجراء الفحص الصحي
    performHealthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            systemHealth: { ...this.systemHealth },
            performance: {
                pageLoadTime: this.performance.pageLoadTime,
                domLoadTime: this.performance.domLoadTime,
                errorCount: this.errors.length,
                warningCount: this.warnings.length
            },
            memory: this.getMemoryUsage()
        };
        
        // تسجيل المشاكل الحرجة
        Object.entries(health.systemHealth).forEach(([component, status]) => {
            if (!status) {
                this.logError({
                    type: 'CRITICAL_SYSTEM_ERROR',
                    message: `System component ${component} is unhealthy`,
                    timestamp: new Date().toISOString(),
                    health: health
                });
            }
        });
        
        return health;
    }

    // 🧠 الحصول على استخدام الذاكرة
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
            };
        }
        return null;
    }

    // 📊 الحصول على تقرير كامل
    getFullReport() {
        return {
            timestamp: new Date().toISOString(),
            errors: this.errors,
            warnings: this.warnings,
            userActions: this.userActions.slice(-20), // آخر 20 إجراء
            performance: this.performance,
            systemHealth: this.systemHealth,
            memory: this.getMemoryUsage()
        };
    }

    // 🧹 مسح السجلات
    clearLogs() {
        this.errors = [];
        this.warnings = [];
        this.userActions = [];
        this.performance = {};
        console.log('🧹 Error detection logs cleared');
    }

    // 📤 تصدير التقرير
    exportReport() {
        const report = this.getFullReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('📤 Error report exported');
    }
}

// تهيئة نظام اكتشاف الأخطاء
window.errorDetection = new ErrorDetectionSystem();

// تصدير الدوال للاستخدام العام
window.errorDetectionSystem = {
    logError: (error) => window.errorDetection.logError(error),
    logWarning: (warning) => window.errorDetection.logWarning(warning),
    getReport: () => window.errorDetection.getFullReport(),
    clearLogs: () => window.errorDetection.clearLogs(),
    exportReport: () => window.errorDetection.exportReport()
};
