// ============================================
// 🔍 Simple Error Detection System
// ============================================
// نظام بسيط لاكتشاف الأخطاء بدون مشاكل
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
        setInterval(() => {
            this.checkDOMHealth();
            this.checkNetworkHealth();
        }, 5000);
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

    // 📝 تسجيل الخطأ
    logError(error) {
        this.errors.push(error);
        
        if (this.errors.length > 100) {
            this.errors = this.errors.slice(-100);
        }
        
        console.error('🔴 ERROR:', error);
        
        if (window.errorDashboard) {
            window.errorDashboard.addError(error);
        }
    }

    // ⚠️ تسجيل تحذير
    logWarning(warning) {
        this.warnings.push(warning);
        
        if (this.warnings.length > 50) {
            this.warnings = this.warnings.slice(-50);
        }
        
        console.warn('🟡 WARNING:', warning);
    }

    // 👤 تسجيل إجراء المستخدم
    logUserAction(action) {
        this.userActions.push(action);
        
        if (this.userActions.length > 200) {
            this.userActions = this.userActions.slice(-200);
        }
    }

    // 🚀 بدء الفحص الصحي
    startHealthCheck() {
        setInterval(() => {
            this.performHealthCheck();
        }, 30000);
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
            userActions: this.userActions.slice(-20),
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

// تهيية نظام اكتشاف الأخطاء
window.errorDetection = new ErrorDetectionSystem();

// تصدير الدوال للاستخدام العام
window.errorDetectionSystem = {
    logError: (error) => window.errorDetection.logError(error),
    logWarning: (warning) => window.errorDetection.logWarning(warning),
    getReport: () => window.errorDetection.getFullReport(),
    clearLogs: () => window.errorDetection.clearLogs(),
    exportReport: () => window.errorDetection.exportReport()
};
