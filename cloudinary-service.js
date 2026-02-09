/**
 * ☁️ Cloudinary Service
 * خدمة رفع وإدارة الصور
 */

const CLOUDINARY = {
    cloudName: 'dwrfrfxnc',
    apiKey: '115934237535497',
    uploadPreset: 'salezone_unsigned',
    folder: 'salezone/products'
};

/**
 * رفع صورة إلى Cloudinary
 * @param {File} file - ملف الصورة من المستخدم
 * @returns {Promise<Object>} - بيانات الصورة المرفوعة
 */
async function uploadToCloudinary(file) {
    // 1. التحقق من الملف
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('❌ يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)');
    }
    
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('❌ حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)');
    }

    // 2. إعداد FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY.uploadPreset);
    formData.append('folder', CLOUDINARY.folder);
    
    // 3. إضافة تحسينات تلقائية
    formData.append('quality', 'auto'); // جودة تلقائية
    formData.append('fetch_format', 'auto'); // WebP للمتصفحات الداعمة

    try {
        showNotification('info', '📤 جاري الرفع...', 'يتم معالجة الصورة الآن');

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'فشل الاتصال بخدمة التخزين');
        }

        const data = await response.json();
        
        console.log('✅ تم الرفع:', data);
        
        return {
            url: data.secure_url,        // الرابط الآمن (HTTPS)
            publicId: data.public_id,    // ID للحذف لاحقاً
            width: data.width,
            height: data.height,
            format: data.format,
            size: data.bytes
        };

    } catch (error) {
        console.error('Cloudinary Error:', error);
        showNotification('error', '❌ فشل الرفع', error.message);
        throw error;
    }
}

/**
 * إنشاء روابط متجاوبة (Responsive URLs)
 * @param {string} url - الرابط الأصلي
 * @param {Object} options - الخيارات (width, height, crop)
 */
function getOptimizedImageUrl(url, options = {}) {
    const { width = 300, height = null, crop = 'fill' } = options;
    
    // استبدال /upload/ بـ /upload/w_300,h_400,c_fill/
    let optimizedUrl = url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_${crop}/`);
    
    if (height) {
        optimizedUrl = optimizedUrl.replace(`c_${crop}/`, `c_${crop},h_${height}/`);
    }
    
    return optimizedUrl;
}

/**
 * معاينة الصورة قبل الرفع
 * @param {File} file - ملف الصورة
 * @param {string} previewId - ID عنصر المعاينة
 */
function previewImage(file, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        // Clear previous content
        preview.innerHTML = '';
        
        // Create container div
        const container = document.createElement('div');
        container.style.cssText = 'position: relative; display: inline-block; margin-top: 10px;';
        
        // Create image element
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.cssText = 'max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid #D4AF37;';
        img.alt = 'Image preview';
        
        // Create preview badge
        const badge = document.createElement('span');
        badge.textContent = 'معاينة';
        badge.style.cssText = 'position: absolute; top: 5px; right: 5px; background: #D4AF37; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;';
        
        // Create file size info
        const sizeInfo = document.createElement('p');
        sizeInfo.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        sizeInfo.style.cssText = 'font-size: 12px; color: #666; margin-top: 5px;';
        
        // Assemble elements safely
        container.appendChild(img);
        container.appendChild(badge);
        container.appendChild(sizeInfo);
        preview.appendChild(container);
    };
    reader.readAsDataURL(file);
}