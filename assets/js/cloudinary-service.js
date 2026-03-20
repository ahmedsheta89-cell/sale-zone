function cloudinaryDebugInfo() {}
function cloudinaryDebugGroup() {}
function cloudinaryDebugGroupEnd() {}
// cloudinary-service.js - Production Cloudinary uploader
// ======================================================

// Configure Cloudinary for production-safe unsigned uploads.
const CLOUDINARY_CONFIG = {
    cloudName: 'dwrfrfxnc',
    uploadPreset: 'salezone_basic'
};
const PRODUCT_IMAGE_FOLDER = 'salezone_products';
const PRODUCT_IMAGE_FALLBACK_PATH = 'assets/placeholder.svg';
const PRODUCT_IMAGE_TRANSFORMS = {
    card: 'f_auto,q_auto:best,w_800,h_800,c_pad,b_white,e_sharpen:50',
    thumbnail: 'f_auto,q_auto,w_400,h_400,c_pad,b_white',
    full: 'f_auto,q_auto:best,w_1200,h_1200,c_pad,b_white,e_sharpen:80',
    admin: 'f_auto,q_auto,w_120,h_120,c_pad,b_white'
};

// Ensure required Cloudinary settings are provided before upload.
function isCloudinaryConfigured() {
    return Boolean(CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset);
}

// Build structured upload errors so retry logic can classify transient failures.
function buildCloudinaryUploadError(message, options = {}) {
    const error = new Error(String(message || 'فشل رفع الصورة إلى Cloudinary.'));
    error.code = String(options.code || 'CLOUDINARY_UPLOAD_ERROR');
    if (Number.isFinite(Number(options.statusCode))) {
        error.statusCode = Number(options.statusCode);
    }
    error.transient = options.transient === true;
    return error;
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

function isLikelyImageUploadFile(file) {
    if (!file || typeof file !== 'object') return false;
    const type = String(file.type || '').toLowerCase();
    if (type.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|webp|gif|bmp|avif|svg)$/i.test(String(file.name || ''));
}

function cleanImageField(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';
    if (rawValue.startsWith('data:')) return rawValue;
    if (rawValue.startsWith('./') || rawValue.startsWith('assets/')) return rawValue;
    if (/^https?:\/\//i.test(rawValue)) return rawValue;
    let cleaned = rawValue
        .replace(/^\/+/, '')
        .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
    cleaned = cleaned
        .replace(/%/g, '_pct_')
        .replace(/\+/g, '_plus_')
        .replace(/\s+/g, '_')
        .replace(/[^\w\-_.]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return cleaned;
}

function isCloudinaryTransformSegment(segment) {
    const value = String(segment || '').trim();
    if (!value || /^v\d+$/i.test(value)) return false;
    const supportedKeys = new Set([
        'a', 'ac', 'af', 'ar', 'b', 'bo', 'c', 'co', 'd', 'dl', 'dn', 'dpi',
        'dr', 'du', 'e', 'eo', 'f', 'fl', 'fn', 'fps', 'g', 'h', 'ki', 'l',
        'o', 'p', 'pg', 'q', 'r', 'so', 'sp', 't', 'u', 'vc', 'w', 'x', 'y', 'z'
    ]);
    return value.split(',').every((part) => {
        const chunk = String(part || '').trim();
        const separatorIndex = chunk.indexOf('_');
        if (separatorIndex <= 0) return false;
        return supportedKeys.has(chunk.slice(0, separatorIndex));
    });
}

function extractCloudinaryAssetPath(url) {
    const rawUrl = String(url || '').trim();
    if (!isValidCloudinarySecureUrl(rawUrl)) return '';

    try {
        const parsed = new URL(rawUrl);
        const marker = `/${CLOUDINARY_CONFIG.cloudName}/image/upload/`;
        const markerIndex = parsed.pathname.indexOf(marker);
        if (markerIndex === -1) return '';
        const afterUpload = parsed.pathname.slice(markerIndex + marker.length);
        const segments = afterUpload.split('/').filter(Boolean);
        while (segments.length > 1 && isCloudinaryTransformSegment(segments[0])) {
            segments.shift();
        }
        if (segments.length > 1 && /^v\d+$/i.test(segments[0])) {
            segments.shift();
        }
        return segments.join('/');
    } catch (_) {
        return '';
    }
}

function getImageTransformPreset(size = 'card') {
    return PRODUCT_IMAGE_TRANSFORMS[String(size || 'card')] || PRODUCT_IMAGE_TRANSFORMS.card;
}

function encodePublicIdSegments(publicId) {
    return String(publicId || '')
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

function buildCloudinaryEnhancedUrl(assetPath, size = 'card') {
    const normalizedPath = String(assetPath || '').replace(/^\/+/, '');
    if (!normalizedPath) return PRODUCT_IMAGE_FALLBACK_PATH;
    const transforms = getImageTransformPreset(size);
    return `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/${transforms}/${normalizedPath}`;
}

function getTransformSizeFromWidth(width = 800) {
    const numericWidth = Math.max(120, Math.min(2000, Number(width) || 800));
    if (numericWidth <= 140) return 'admin';
    if (numericWidth <= 420) return 'thumbnail';
    if (numericWidth >= 1100) return 'full';
    return 'card';
}

function getOptimizedImageUrl(cloudinaryUrl, width = 800) {
    const rawUrl = String(cloudinaryUrl || '').trim();
    if (!isValidCloudinarySecureUrl(rawUrl)) return rawUrl;
    const assetPath = extractCloudinaryAssetPath(rawUrl);
    if (!assetPath) return rawUrl;
    return buildCloudinaryEnhancedUrl(assetPath, getTransformSizeFromWidth(width));
}

/**
 * Returns Cloudinary URL with product-optimized transforms
 * Unified white background, consistent dimensions, sharp
 */
function enhanceProductImageUrl(imageName, size = 'card') {
    const rawValue = String(imageName || '').trim();
    if (!rawValue) return PRODUCT_IMAGE_FALLBACK_PATH;
    if (rawValue.startsWith('data:')) return rawValue;
    if (rawValue.startsWith('./') || rawValue.startsWith('assets/')) return rawValue;
    if (rawValue.startsWith('/')) return PRODUCT_IMAGE_FALLBACK_PATH;

    if (isValidCloudinarySecureUrl(rawValue)) {
        const assetPath = extractCloudinaryAssetPath(rawValue);
        return assetPath ? buildCloudinaryEnhancedUrl(assetPath, size) : PRODUCT_IMAGE_FALLBACK_PATH;
    }

    if (/^https?:\/\//i.test(rawValue)) {
        return rawValue;
    }

    const cleanName = cleanImageField(rawValue);
    if (!cleanName || /^https?:\/\//i.test(cleanName)) return PRODUCT_IMAGE_FALLBACK_PATH;
    const encodedPublicId = encodePublicIdSegments(cleanName);
    const assetPath = cleanName.includes('/')
        ? encodedPublicId
        : `${PRODUCT_IMAGE_FOLDER}/${encodedPublicId}`;
    return buildCloudinaryEnhancedUrl(assetPath, size);
}

async function compressImageBeforeUpload(file, maxSizeKB = 500) {
    if (!file || typeof document === 'undefined') return file;
    if (Number(file.size || 0) <= maxSizeKB * 1024) return file;

    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve(file);
            return;
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        const cleanup = () => {
            try { URL.revokeObjectURL(objectUrl); } catch (_) {}
        };

        img.onerror = () => {
            cleanup();
            resolve(file);
        };

        img.onload = () => {
            const maxWidth = 1200;
            const scale = img.width > maxWidth ? (maxWidth / img.width) : 1;
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                cleanup();
                if (!blob || Number(blob.size || 0) <= 0 || Number(blob.size || 0) >= Number(file.size || 0)) {
                    resolve(file);
                    return;
                }
                const normalizedName = String(file.name || 'image.jpg').replace(/\.[^.]+$/u, '.jpg');
                resolve(new File([blob], normalizedName, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                }));
            }, 'image/jpeg', 0.85);
        };

        img.src = objectUrl;
    });
}

// Upload image with progress and fail-closed behavior (never fallback to base64).
async function uploadToCloudinary(file, options = {}) {
    if (!file) {
        return Promise.reject(buildCloudinaryUploadError('لم يتم اختيار صورة للرفع.', {
            code: 'CLOUDINARY_NO_FILE'
        }));
    }
    if (!isLikelyImageUploadFile(file)) {
        return Promise.reject(buildCloudinaryUploadError('الملف المحدد ليس صورة مدعومة.', {
            code: 'CLOUDINARY_INVALID_FILE',
            transient: false
        }));
    }
    if (!isCloudinaryConfigured()) {
        return Promise.reject(buildCloudinaryUploadError('إعدادات Cloudinary غير مكتملة.', {
            code: 'CLOUDINARY_CONFIG_MISSING'
        }));
    }

    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const folder = String(options.folder || 'salezone_products').trim();
    const publicId = String(options.publicId || '')
        .trim()
        .replace(/\.[^./]+$/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}_-]/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    const signal = options && typeof options === 'object' ? options.signal : null;
    const onAbort = typeof options.onAbort === 'function' ? options.onAbort : null;
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
    let uploadFile = file;

    try {
        uploadFile = await compressImageBeforeUpload(file);
    } catch (compressionError) {
        console.warn('[CLOUDINARY_UPLOAD] compression skipped:', compressionError);
        uploadFile = file;
    }

    return new Promise((resolve, reject) => {
        cloudinaryDebugGroup('[CLOUDINARY_UPLOAD] بدء رفع الصورة');
        cloudinaryDebugInfo('[CLOUDINARY_UPLOAD] file:', {
            name: uploadFile && uploadFile.name ? String(uploadFile.name) : '',
            size: Number(uploadFile && uploadFile.size || 0),
            type: String(uploadFile && uploadFile.type || ''),
            originalSize: Number(file && file.size || 0)
        });
        cloudinaryDebugInfo('[CLOUDINARY_UPLOAD] config:', {
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            folder,
            publicId: publicId || '(auto)'
        });

        if (signal && signal.aborted) {
            console.warn('[CLOUDINARY_UPLOAD] aborted before request start');
            cloudinaryDebugGroupEnd();
            reject(buildCloudinaryUploadError('تم إلغاء الرفع', {
                code: 'UPLOAD_ABORTED'
            }));
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint, true);
        let settled = false;
        let abortHandler = null;
        let abortNotified = false;

        const notifyAbort = () => {
            if (abortNotified) return;
            abortNotified = true;
            if (onAbort) {
                try { onAbort(); } catch (_) {}
            }
        };

        const cleanup = () => {
            if (signal && abortHandler) {
                signal.removeEventListener('abort', abortHandler);
            }
            abortHandler = null;
        };

        const safeResolve = (payload) => {
            if (settled) return;
            settled = true;
            cleanup();
            cloudinaryDebugInfo('[CLOUDINARY_UPLOAD] success:', {
                public_id: payload && payload.public_id ? String(payload.public_id) : '',
                secure_url: payload && payload.secure_url ? String(payload.secure_url) : ''
            });
            cloudinaryDebugGroupEnd();
            resolve(payload);
        };

        const safeReject = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            const normalized = error instanceof Error
                ? error
                : buildCloudinaryUploadError(String(error || 'Upload failed'), {
                    code: 'CLOUDINARY_UPLOAD_ERROR'
                });
            console.error('[CLOUDINARY_UPLOAD] failed:', {
                message: normalized.message,
                code: normalized.code || 'UNKNOWN',
                statusCode: normalized.statusCode || null,
                transient: normalized.transient === true
            });
            cloudinaryDebugGroupEnd();
            reject(normalized);
        };

        if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (event) => {
                if (!event || !event.lengthComputable) return;
                const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
                onProgress(percent);
            };
        }

        xhr.onerror = () => {
            safeReject(buildCloudinaryUploadError('تعذر الاتصال بـ Cloudinary. تحقق من الشبكة ثم حاول مرة أخرى.', {
                code: 'NETWORK_ERROR',
                transient: true
            }));
        };

        xhr.onabort = () => {
            notifyAbort();
            safeReject(buildCloudinaryUploadError('تم إلغاء الرفع', {
                code: 'UPLOAD_ABORTED'
            }));
        };

        xhr.onload = () => {
            const status = Number(xhr.status || 0);
            if (status < 200 || status >= 300) {
                const rawText = String(xhr.responseText || '');
                let parsedMessage = '';
                try {
                    const parsed = JSON.parse(rawText || '{}');
                    parsedMessage = String(parsed.error?.message || parsed.message || '').trim();
                } catch (_) {}

                if (status === 429) {
                    safeReject(buildCloudinaryUploadError('تم تجاوز حد الرفع المؤقت في Cloudinary. حاول مرة أخرى بعد دقيقة.', {
                        code: 'CLOUDINARY_RATE_LIMIT',
                        statusCode: status,
                        transient: true
                    }));
                    return;
                }
                if (/upload preset|preset/i.test(parsedMessage)) {
                    safeReject(buildCloudinaryUploadError('إعداد upload preset غير صالح أو غير مسموح.', {
                        code: 'CLOUDINARY_PRESET_INVALID',
                        statusCode: status,
                        transient: false
                    }));
                    return;
                }
                if (/unsigned upload|not allowed|not authorized|denied/i.test(parsedMessage)) {
                    safeReject(buildCloudinaryUploadError('إعدادات الرفع غير الموقّع غير مفعّلة لهذا الـ preset.', {
                        code: 'CLOUDINARY_PRESET_UNAUTHORIZED',
                        statusCode: status,
                        transient: false
                    }));
                    return;
                }
                if (/rate limit/i.test(parsedMessage)) {
                    safeReject(buildCloudinaryUploadError('تم تجاوز حد الرفع المؤقت في Cloudinary. حاول مرة أخرى بعد دقيقة.', {
                        code: 'CLOUDINARY_RATE_LIMIT',
                        statusCode: status,
                        transient: true
                    }));
                    return;
                }

                const snippet = (parsedMessage || rawText).slice(0, 260);
                safeReject(buildCloudinaryUploadError(`فشل رفع الصورة على Cloudinary (HTTP ${status}): ${snippet}`, {
                    code: 'HTTP_ERROR',
                    statusCode: status,
                    transient: status >= 500
                }));
                return;
            }

            let payload;
            try {
                payload = JSON.parse(xhr.responseText || '{}');
            } catch (_) {
                safeReject(buildCloudinaryUploadError('استجابة Cloudinary غير صالحة (JSON).', {
                    code: 'CLOUDINARY_BAD_RESPONSE'
                }));
                return;
            }

            const secureUrl = String(payload.secure_url || '').trim();
            if (!isValidCloudinarySecureUrl(secureUrl)) {
                safeReject(buildCloudinaryUploadError('تم استلام رابط صورة غير صالح من Cloudinary. تم إيقاف الحفظ لحماية البيانات.', {
                    code: 'CLOUDINARY_INVALID_URL'
                }));
                return;
            }

            safeResolve({
                secure_url: secureUrl,
                public_id: String(payload.public_id || ''),
                url: secureUrl,
                publicId: String(payload.public_id || ''),
                bytes: Number(payload.bytes || 0),
                width: Number(payload.width || 0),
                height: Number(payload.height || 0),
                format: String(payload.format || '')
            });
        };

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        if (folder) formData.append('folder', folder);
        if (publicId) formData.append('public_id', publicId);

        if (signal && typeof signal.addEventListener === 'function') {
            abortHandler = () => {
                if (settled) return;
                notifyAbort();
                try { xhr.abort(); } catch (_) {}
                safeReject(buildCloudinaryUploadError('تم إلغاء الرفع', {
                    code: 'UPLOAD_ABORTED'
                }));
            };
            signal.addEventListener('abort', abortHandler, { once: true });
        }

        try {
            xhr.send(formData);
        } catch (error) {
            safeReject(error);
        }
    });
}

if (typeof window !== 'undefined') {
    window.getOptimizedImageUrl = getOptimizedImageUrl;
    window.enhanceProductImageUrl = enhanceProductImageUrl;
    window.compressImageBeforeUpload = compressImageBeforeUpload;
}
