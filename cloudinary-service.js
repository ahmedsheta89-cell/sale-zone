// cloudinary-service.js - Production Cloudinary uploader
// ======================================================

// Configure Cloudinary for production-safe unsigned uploads.
const CLOUDINARY_CONFIG = {
    cloudName: 'dwrfrfxnc',
    uploadPreset: 'salezone_basic'
};

// Ensure required Cloudinary settings are provided before upload.
function isCloudinaryConfigured() {
    return Boolean(CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset);
}

// Accept only secure Cloudinary URLs from the expected account.
function isValidCloudinarySecureUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (!url.startsWith('https://')) return false;

    try {
        const parsed = new URL(url);
        return (
            parsed.hostname === 'res.cloudinary.com' &&
            parsed.pathname.startsWith(`/${CLOUDINARY_CONFIG.cloudName}/`)
        );
    } catch (_) {
        return false;
    }
}

// Upload image with progress and fail-closed behavior (never fallback to base64).
function uploadToCloudinary(file, options = {}) {
    if (!file) {
        return Promise.reject(new Error('لم يتم اختيار صورة للرفع.'));
    }
    if (!isCloudinaryConfigured()) {
        return Promise.reject(new Error('إعدادات Cloudinary غير مكتملة.'));
    }

    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint, true);

        if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (event) => {
                if (!event || !event.lengthComputable) return;
                const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
                onProgress(percent);
            };
        }

        xhr.onerror = () => {
            reject(new Error('تعذر الاتصال بـ Cloudinary. تحقق من الشبكة ثم حاول مرة أخرى.'));
        };

        xhr.onload = () => {
            const status = Number(xhr.status || 0);
            if (status < 200 || status >= 300) {
                const responseText = String(xhr.responseText || '').slice(0, 300);
                reject(new Error(`فشل رفع الصورة على Cloudinary (HTTP ${status}): ${responseText}`));
                return;
            }

            let payload;
            try {
                payload = JSON.parse(xhr.responseText || '{}');
            } catch (_) {
                reject(new Error('استجابة Cloudinary غير صالحة (JSON).'));
                return;
            }

            const secureUrl = String(payload.secure_url || '').trim();
            if (!isValidCloudinarySecureUrl(secureUrl)) {
                reject(new Error('تم استلام رابط صورة غير صالح من Cloudinary. تم إيقاف الحفظ لحماية البيانات.'));
                return;
            }

            resolve({
                url: secureUrl,
                publicId: String(payload.public_id || ''),
                bytes: Number(payload.bytes || 0),
                width: Number(payload.width || 0),
                height: Number(payload.height || 0),
                format: String(payload.format || '')
            });
        };

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        xhr.send(formData);
    });
}
