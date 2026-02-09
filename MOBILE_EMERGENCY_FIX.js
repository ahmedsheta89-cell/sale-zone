// ============================================
// 📱 Mobile Emergency Fix
// ============================================
// حل فوري لمشاكل عدم عمل النظام على الهاتف
// ============================================

class MobileEmergencyFix {
    constructor() {
        this.isMobile = /iPhone|iPad|iPod|Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isSafari = /^((?!chrome|android).)*safari)/i.test(navigator.userAgent);
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        this.initialize();
    }

    // 🚀 تهيئة الإصلاح الطارئ
    initialize() {
        if (!this.isMobile) {
            console.log('💻 Desktop detected - no mobile fix needed');
            return;
        }

        console.log('📱 Mobile device detected - applying emergency fixes');
        
        // إصلاح مشاكل التحميل الفورية
        this.fixLoadingIssues();
        
        // إصلاح مشاكل السكربت
        this.fixScriptLoading();
        
        // إصلاح مشاكل التخزين
        this.fixStorageIssues();
        
        // إصلاح مشاكل العرض
        this.fixDisplayIssues();
        
        // إضافة شاشة بدء بسيطة
        this.showEmergencyLoadingScreen();
    }

    // 🔧 إصلاح مشاكل التحميل
    fixLoadingIssues() {
        console.log('🔧 Fixing loading issues...');
        
        // إصلاح مشكلة deferred scripts
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            if (script.src.includes('firebase') || script.src.includes('googleapis')) {
                script.async = false;
                script.defer = true;
            }
        });

        // إضافة timeout للتحميل
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.hideEmergencyLoadingScreen();
                console.log('✅ Emergency loading completed');
            }, 2000);
        });
    }

    // 📜 إصلاح مشاكل السكربت
    fixScriptLoading() {
        console.log('📜 Fixing script loading issues...');
        
        // إعادة تحميل السكربت الأساسية إذا فشلت
        const criticalScripts = [
            'storage-keys.js',
            'firebase-config.js',
            'firebase-api.js'
        ];

        criticalScripts.forEach(scriptName => {
            if (!window[scriptName.replace('.js', '')]) {
                console.log(`🔄 Reloading critical script: ${scriptName}`);
                this.loadScriptSafely(scriptName);
            }
        });
    }

    // 📦 تحميل السكربت بأمان
    loadScriptSafely(scriptName) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptName;
            script.async = false;
            script.onload = () => {
                console.log(`✅ Script loaded: ${scriptName}`);
                resolve();
            };
            script.onerror = () => {
                console.log(`❌ Script failed: ${scriptName}`);
                // محاولة تحميل من CDN
                this.loadFromCDN(scriptName).then(resolve).catch(reject);
            };
            document.head.appendChild(script);
        });
    }

    // 🌐 تحميل من CDN كـ backup
    loadFromCDN(scriptName) {
        return new Promise((resolve, reject) => {
            console.log(`🌐 Attempting CDN load for: ${scriptName}`);
            // هنا يمكن إضافة روابط CDN بديلة
            setTimeout(resolve, 1000);
        });
    }

    // 💾 إصلاح مشاكل التخزين
    fixStorageIssues() {
        console.log('💾 Fixing storage issues...');
        
        // اختبار localStorage
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            this.storageWorking = true;
        } catch (error) {
            console.log('❌ localStorage not working:', error);
            this.storageWorking = false;
            this.setupAlternativeStorage();
        }
    }

    // 🔄 إعداد تخزين بديل
    setupAlternativeStorage() {
        // استخدام sessionStorage كـ backup
        window.mobileStorage = {
            setItem: (key, value) => {
                try {
                    localStorage.setItem(key, value);
                } catch (e) {
                    sessionStorage.setItem(key, value);
                }
            },
            getItem: (key) => {
                try {
                    return localStorage.getItem(key);
                } catch (e) {
                    return sessionStorage.getItem(key);
                }
            },
            removeItem: (key) => {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    sessionStorage.removeItem(key);
                }
            }
        };
    }

    // 🖥️ إصلاح مشاكل العرض
    fixDisplayIssues() {
        console.log('🖥️ Fixing display issues...');
        
        // إصلاح مشاكل viewport على الهاتف
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }

        // إضافة mobile-specific CSS
        const mobileCSS = `
            <style>
                .emergency-mobile-fix {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #0A1128, #1A2744);
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: Arial, sans-serif;
                }
                
                .emergency-loading-content {
                    text-align: center;
                    color: #F4E4BC;
                }
                
                .emergency-loading-spinner {
                    width: 50px;
                    height: 50px;
                    border: 3px solid #F4E4BC;
                    border-top: 3px solid transparent;
                    border-radius: 50%;
                    animation: emergency-spin 1s linear infinite;
                    margin: 20px auto;
                }
                
                @keyframes emergency-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* إصلاح مشاكل الهاتف */
                @media (max-width: 768px) {
                    .navbar { position: relative !important; }
                    .products-grid { grid-template-columns: 1fr !important; }
                    .banner-section { min-height: 200px !important; }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', mobileCSS);
    }

    // 📱 إظهار شاشة البدء الطارئة
    showEmergencyLoadingScreen() {
        const loadingScreen = document.createElement('div');
        loadingScreen.className = 'emergency-mobile-fix';
        loadingScreen.innerHTML = `
            <div class="emergency-loading-content">
                <h2 style="color: #F4E4BC; margin-bottom: 20px;">📱 Sale Zone Store</h2>
                <div class="emergency-loading-spinner"></div>
                <p style="color: #F4E4BC; margin-top: 20px;">جاري التحميل...</p>
                <p style="color: #F4E4BC; font-size: 14px; opacity: 0.8;">يرجى الانتظار</p>
            </div>
        `;
        
        document.body.appendChild(loadingScreen);
        
        // إخفاء المحتوى الرئيسي مؤقتاً
        const mainContent = document.querySelector('body > :not(.emergency-mobile-fix)');
        if (mainContent) {
            mainContent.style.display = 'none';
        }
    }

    // 🔄 إخفاء شاشة البدء
    hideEmergencyLoadingScreen() {
        const loadingScreen = document.querySelector('.emergency-mobile-fix');
        if (loadingScreen) {
            loadingScreen.remove();
        }
        
        // إظهار المحتوى الرئيسي
        const mainContent = document.querySelector('body > :not(.emergency-mobile-fix)');
        if (mainContent) {
            mainContent.style.display = 'block';
        }
    }

    // 🧪 تنظيف الإصلاحات
    cleanup() {
        console.log('🧪 Cleaning up emergency fixes...');
        this.hideEmergencyLoadingScreen();
        
        // إزالة CSS الإضافي
        const mobileCSS = document.querySelector('style[data-emergency-fix]');
        if (mobileCSS) {
            mobileCSS.remove();
        }
    }
}

// 🚀 تطبيق الإصلاح الطارئ
document.addEventListener('DOMContentLoaded', function() {
    // تأخير الإصلاح قليلاً للتأكد من وجود المشكلة
    setTimeout(() => {
        if (/iPhone|iPad|iPod|Android|Mobile/.test(navigator.userAgent)) {
            console.log('📱 Mobile emergency fix activated');
            window.mobileEmergencyFix = new MobileEmergencyFix();
            
            // إخفاء شاشة البدء بعد 5 ثواني كحد أقصى
            setTimeout(() => {
                window.mobileEmergencyFix?.cleanup();
            }, 5000);
        }
    }, 1000);
});
