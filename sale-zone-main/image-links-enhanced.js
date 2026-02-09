// =====================================================
// ENHANCED IMAGE LINKS FIX - تحسينات متقدمة لروابط الصور
// =====================================================

/**
 * إصلاح متقدم لروابط الصور مع:
 * - Multiple fallback strategies
 * - Performance optimization
 * - Error handling
 * - Lazy loading support
 */

// ===== استراتيجيات Fallback المتقدمة =====

// استراتيجية 1: Unsplash Source (الأكثر موثوقية)
function getUnsplashImage(keyword, width = 400, height = 400) {
    const unsplashBase = 'https://source.unsplash.com';
    const keywords = {
        'shampoo': 'shampoo,hair',
        'skincare': 'skincare,beauty',
        'cream': 'cream,lotion',
        'cosmetics': 'cosmetics,makeup',
        'oil': 'oil,hair',
        'face': 'face,skincare',
        'natural': 'natural,organic',
        'product': 'product,shopping',
        'beauty': 'beauty,cosmetics',
        'baby': 'baby,care',
        'medical': 'medical,health',
        'vitamins': 'vitamins,supplements',
        'medicine': 'medicine,pharmacy'
    };
    
    const searchKeywords = keywords[keyword] || keyword || 'product';
    return `${unsplashBase}/${width}x${height}/?${searchKeywords}&auto=format&fit=crop`;
}

// استراتيجية 2: Picsum Photos (بديل سريع)
function getPicsumImage(seed = 'random', width = 400, height = 400) {
    return `https://picsum.photos/seed/${seed}/${width}/${height}.jpg`;
}

// استراتيجية 3: Placeholder SVG (الأكثر موثوقية)
function getPlaceholderSVG(text = 'صورة', width = 400, height = 400, bgColor = '#D4AF37') {
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#D4AF37;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#B8960C;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad)"/>
            <text 
                x="50%" 
                y="50%" 
                font-family="Arial, sans-serif" 
                font-size="${Math.min(width/10, 24)}" 
                fill="white" 
                text-anchor="middle" 
                dominant-baseline="middle"
                font-weight="bold">
                ${text}
            </text>
        </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

// استراتيجية 4: Cloudinary (إذا كان متوفراً)
function getCloudinaryImage(publicId, width = 400, height = 400) {
    // يمكن تعديل هذا مع Cloudinary ID الخاص بك
    return `https://res.cloudinary.com/demo/image/upload/w_${width},h_${height}/c_fill/${publicId}.jpg`;
}

// ===== قائمة روابط Unsplash المعطلة (للتحديث) =====
const BROKEN_UNSPLASH_LINKS = {
    'https://images.unsplash.com/photo-1522337360788-8b13dee73837?w=400': getUnsplashImage('shampoo'),
    'https://images.unsplash.com/photo-1556228720-195a0242c97e?w=400': getUnsplashImage('skincare'),
    'https://images.unsplash.com/photo-1620916566398-39f5a2b4c5d3?w=400': getUnsplashImage('cosmetics'),
    'https://images.unsplash.com/photo-1526947425960-945c6e2b4f6?w=400': getUnsplashImage('beauty'),
    'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=400': getUnsplashImage('lotion'),
    'https://images.unsplash.com/photo-1556905055-8f358a7a79b2?w=400': getUnsplashImage('cream'),
    'https://images.unsplash.com/photo-1608248593303-f7565da7e93f?w=400': getUnsplashImage('oil'),
    'https://images.unsplash.com/photo-1544006496-78989e3c8a9c?w=400': getUnsplashImage('face'),
    'https://images.unsplash.com/photo-1515378972037-c25eb934c1d0?w=400': getUnsplashImage('natural')
};

// ===== دالة إصلاح متقدمة =====
function fixImageAdvanced(img, options = {}) {
    const {
        fallbackStrategy = 'unsplash', // 'unsplash', 'picsum', 'placeholder', 'cloudinary'
        retryCount = 3,
        lazyLoad = true,
        showLoading = true
    } = options;
    
    const originalSrc = img.src;
    let attempts = 0;
    
    // إذا كان الرابط معطلاً، استبدله
    if (BROKEN_UNSPLASH_LINKS[originalSrc]) {
        console.log('🖼️ Fixing broken image:', originalSrc);
        
        switch (fallbackStrategy) {
            case 'unsplash':
                img.src = BROKEN_UNSPLASH_LINKS[originalSrc];
                break;
            case 'picsum':
                img.src = getPicsumImage('product' + attempts, 400, 400);
                break;
            case 'placeholder':
                img.src = getPlaceholderSVG(img.alt || 'صورة', 400, 400);
                break;
            case 'cloudinary':
                img.src = getCloudinaryImage('sample', 400, 400);
                break;
        }
        
        // إضافة data attributes للتحليل
        img.dataset.originalSrc = originalSrc;
        img.dataset.fallbackStrategy = fallbackStrategy;
        img.dataset.fixedAt = new Date().toISOString();
    }
    
    // إضافة error handler متقدم
    img.onerror = function() {
        attempts++;
        console.warn(`⚠️ Image failed (attempt ${attempts}):`, this.src);
        
        if (attempts < retryCount) {
            // جرب استراتيجية مختلفة
            switch (attempts) {
                case 1:
                    this.src = getPicsumImage('fallback1', 400, 400);
                    break;
                case 2:
                    this.src = getPlaceholderSVG(this.alt || 'صورة', 400, 400, '#cccccc');
                    break;
                case 3:
                    this.src = getPlaceholderSVG('خطأ', 400, 400, '#ff0000');
                    break;
            }
        } else {
            // الفشل النهائي - استخدم placeholder نهائي
            this.src = getPlaceholderSVG('غير متاح', 400, 400, '#ffcccc');
            this.onerror = null; // منع infinite loop
        }
    };
    
    // إضافة loading indicator
    if (showLoading) {
        img.onload = function() {
            console.log('✅ Image loaded successfully:', this.src);
            this.classList.remove('image-loading');
        };
        
        img.classList.add('image-loading');
    }
    
    // إضافة lazy loading support
    if (lazyLoad && 'loading' in HTMLImageElement.prototype) {
        img.loading = 'lazy';
    }
}

// ===== إصلاح جميع الصور في الصفحة =====
function fixAllImagesAdvanced() {
    const images = document.querySelectorAll('img');
    console.log(`🖼️ Found ${images.length} images to analyze and fix`);
    
    let fixedCount = 0;
    let brokenCount = 0;
    
    images.forEach((img, index) => {
        let wasFixed = false;
        
        // التحقق من الروابط المعطلة
        if (BROKEN_UNSPLASH_LINKS[img.src]) {
            fixImageAdvanced(img, {
                fallbackStrategy: index % 3 === 0 ? 'unsplash' : index % 3 === 1 ? 'picsum' : 'placeholder'
            });
            wasFixed = true;
            fixedCount++;
        }
        
        // إضافة error handler لجميع الصور
        if (!img.hasAttribute('data-error-handler-added')) {
            img.setAttribute('data-error-handler-added', 'true');
            img.addEventListener('error', function() {
                if (!this.dataset.fallbackAttempted) {
                    this.dataset.fallbackAttempted = 'true';
                    console.warn('⚠️ Unexpected image error:', this.src);
                    this.src = getPlaceholderSVG(this.alt || 'خطأ', 400, 400, '#ff6666');
                }
            });
        }
        
        // إضافة loading styles
        if (!img.classList.contains('image-styles-added')) {
            img.classList.add('image-styles-added');
            img.style.cssText = `
                transition: opacity 0.3s ease;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            
            // إضافة loading indicator styles
            const style = document.createElement('style');
            style.textContent = `
                .image-loading {
                    opacity: 0.5;
                    filter: blur(2px);
                }
                .image-styles-added:hover {
                    transform: scale(1.02);
                    box-shadow: 0 4px 16px rgba(212,175,55,0.2);
                }
            `;
            document.head.appendChild(style);
        }
        
        if (wasFixed) brokenCount++;
    });
    
    console.log(`✅ Fixed ${fixedCount} images, ${brokenCount} were broken`);
    return { fixedCount, brokenCount, totalImages: images.length };
}

// ===== تحديث ديناميكي للصور =====
function updateDynamicImages() {
    console.log('🔄 Setting up dynamic image monitoring...');
    
    // مراقبة الصور الجديدة
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // صور جديدة مباشرة
                    if (node.tagName === 'IMG') {
                        fixImageAdvanced(node);
                    }
                    
                    // صور داخل عناصر أخرى
                    const images = node.querySelectorAll && node.querySelectorAll('img');
                    if (images) {
                        images.forEach(fixImageAdvanced);
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// ===== إضافة performance monitoring =====
function setupImagePerformanceMonitoring() {
    console.log('📊 Setting up image performance monitoring...');
    
    // مراقبة أداء تحميل الصور
    document.addEventListener('load', (event) => {
        if (event.target.tagName === 'IMG') {
            const loadTime = performance.now();
            const img = event.target;
            
            console.log(`📊 Image loaded: ${img.src} in ${loadTime.toFixed(2)}ms`);
            
            // تسجيل الصور البطيئة
            if (loadTime > 3000) {
                console.warn(`⚠️ Slow image detected: ${img.src} (${loadTime.toFixed(2)}ms)`);
            }
        }
    }, true);
}

// ===== التهيئة الرئيسية =====
function initializeImageFixes() {
    console.log('🚀 Initializing enhanced image fixes...');
    
    // إصلاح الصور الموجودة
    const results = fixAllImagesAdvanced();
    
    // إعداد المراقبة الديناميكية
    updateDynamicImages();
    
    // إعداد مراقبة الأداء
    setupImagePerformanceMonitoring();
    
    // إضافة global functions
    window.imageHelpers = {
        fixImageAdvanced,
        fixAllImagesAdvanced,
        getUnsplashImage,
        getPicsumImage,
        getPlaceholderSVG,
        getCloudinaryImage,
        updateDynamicImages,
        results
    };
    
    console.log('✅ Enhanced image fixes initialized');
    console.log(`📊 Results: ${results.fixedCount}/${results.totalImages} images processed`);
    
    return results;
}

// ===== التشغيل التلقائي =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeImageFixes);
} else {
    initializeImageFixes();
}

// Export للاستخدام في modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fixImageAdvanced,
        fixAllImagesAdvanced,
        getUnsplashImage,
        getPicsumImage,
        getPlaceholderSVG,
        getCloudinaryImage,
        updateDynamicImages,
        initializeImageFixes
    };
}

console.log('✅ Enhanced image helpers loaded');
