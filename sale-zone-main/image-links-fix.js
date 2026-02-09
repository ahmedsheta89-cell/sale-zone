// =====================================================
// IMAGE LINKS FIX - إصلاح روابط الصور المعطلة
// =====================================================

(function fixImageLinks() {
    console.log('🖼️ Fixing broken image links...');
    
    // قائمة روابط Unsplash البديلة
    const unsplashReplacements = {
        'https://images.unsplash.com/photo-1522337360788-8b13dee73837?w=400': 'https://source.unsplash.com/400x400/?shampoo',
        'https://images.unsplash.com/photo-1556228720-195a0242c97e?w=400': 'https://source.unsplash.com/400x400/?skincare',
        'https://images.unsplash.com/photo-1620916566398-39f5a2b4c5d3?w=400': 'https://source.unsplash.com/400x400/?cosmetics',
        'https://images.unsplash.com/photo-1526947425960-945c6e2b4f6?w=400': 'https://source.unsplash.com/400x400/?beauty',
        'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=400': 'https://source.unsplash.com/400x400/?lotion',
        'https://images.unsplash.com/photo-1556905055-8f358a7a79b2?w=400': 'https://source.unsplash.com/400x400/?cream',
        'https://images.unsplash.com/photo-1608248593303-f7565da7e93f?w=400': 'https://source.unsplash.com/400x400/?oil',
        'https://images.unsplash.com/photo-1544006496-78989e3c8a9c?w=400': 'https://source.unsplash.com/400x400/?face',
        'https://images.unsplash.com/photo-1515378972037-c25eb934c1d0?w=400': 'https://source.unsplash.com/400x400/?natural'
    };
    
    // دالة إصلاح رابط واحد
    function fixSingleImage(img) {
        const originalSrc = img.src;
        const newSrc = unsplashReplacements[originalSrc];
        
        if (newSrc && newSrc !== originalSrc) {
            console.log('🖼️ Fixing image:', originalSrc, '→', newSrc);
            img.src = newSrc;
            
            // إضافة error handler للرابط الجديد
            img.onerror = function() {
                console.warn('⚠️ New image link also failed, using placeholder');
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI0Q0QUYzNyIvPjwvc3ZnPg==';
            };
        }
    }
    
    // إصلاح جميع الصور في الصفحة
    function fixAllImages() {
        const images = document.querySelectorAll('img[src*="unsplash.com"]');
        console.log(`🖼️ Found ${images.length} Unsplash images to fix`);
        
        images.forEach(fixSingleImage);
    }
    
    // إصلاح الصور عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixAllImages);
    } else {
        fixAllImages();
    }
    
    // إصلاح الصور الجديدة التي تضاف ديناميكياً
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const images = node.querySelectorAll && node.querySelectorAll('img[src*="unsplash.com"]');
                    if (images) {
                        images.forEach(fixSingleImage);
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('✅ Image links fix initialized');
})();

// تشغيل الإصلاح
fixImageLinks();
