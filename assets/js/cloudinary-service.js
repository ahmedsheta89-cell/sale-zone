/**
 * Cloudinary Service - Sale Zone
 * IIFE Module Pattern: zero top-level lexical collisions
 * Exports only the public API needed by the storefront/admin via window.
 */
;(function (global) {
  'use strict';

  function cloudinaryDebugInfo() {}
  function cloudinaryDebugGroup() {}
  function cloudinaryDebugGroupEnd() {}

  var CLOUD_NAME = 'dwrfrfxnc';
  var UPLOAD_PRESET = 'salezone_basic';
  var FOLDER = 'salezone_products';
  var FALLBACK_IMG = 'assets/placeholder.svg';

  var CLOUDINARY_CONFIG = {
    cloudName: CLOUD_NAME,
    uploadPreset: UPLOAD_PRESET
  };
  var MAX_FINAL_UPLOAD_BYTES = 5 * 1024 * 1024;
  var MAX_PRECOMPRESS_IMAGE_BYTES = 20 * 1024 * 1024;
  var MAX_COMPRESSED_DIMENSION = 1200;
  var DEFAULT_UPLOAD_QUALITY = 0.85;
  var ALLOWED_UPLOAD_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx'];
  var ALLOWED_UPLOAD_MIME_TYPES = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/webp': true,
    'image/gif': true,
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true
  };

  var TRANSFORMS = {
    card: 'f_auto,q_auto:best,w_800,h_800,c_pad,b_white,e_sharpen:50',
    thumbnail: 'f_auto,q_auto,w_400,h_400,c_pad,b_white',
    full: 'f_auto,q_auto:best,w_1200,h_1200,c_pad,b_white,e_sharpen:80',
    admin: 'f_auto,q_auto,w_120,h_120,c_pad,b_white',
    feed: 'f_auto,q_auto:best,w_800,h_800,c_pad,b_white'
  };

  function _cleanName(imageName) {
    if (typeof cleanImageField === 'function') {
      return cleanImageField(imageName);
    }
    return String(imageName || '')
      .trim()
      .replace(/^\/+/, '')
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '')
      .replace(/%/g, '_pct_')
      .replace(/\+/g, '_plus_')
      .replace(/\s+/g, '_')
      .replace(/[^\w\-_.]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function _fallback() {
    return (typeof PRODUCT_IMAGE_FALLBACK_PATH !== 'undefined')
      ? PRODUCT_IMAGE_FALLBACK_PATH
      : FALLBACK_IMG;
  }

  function _folder() {
    return (typeof PRODUCT_IMAGE_FOLDER !== 'undefined')
      ? PRODUCT_IMAGE_FOLDER
      : FOLDER;
  }

  function isCloudinaryConfigured() {
    return Boolean(CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset);
  }

  function buildCloudinaryUploadError(message, options) {
    var settings = options && typeof options === 'object' ? options : {};
    var error = new Error(String(message || 'فشل رفع الصورة إلى Cloudinary.'));
    error.code = String(settings.code || 'CLOUDINARY_UPLOAD_ERROR');
    if (Number.isFinite(Number(settings.statusCode))) {
      error.statusCode = Number(settings.statusCode);
    }
    error.transient = settings.transient === true;
    return error;
  }

  function isValidCloudinarySecureUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (!url.startsWith('https://')) return false;

    try {
      var parsed = new URL(url);
      return parsed.hostname === 'res.cloudinary.com'
        && parsed.pathname.indexOf('/' + CLOUDINARY_CONFIG.cloudName + '/') === 0;
    } catch (_) {
      return false;
    }
  }

  function isLikelyImageUploadFile(file) {
    if (!file || typeof file !== 'object') return false;
    var type = String(file.type || '').toLowerCase();
    var ext = getUploadFileExtension(file);
    if (ALLOWED_UPLOAD_MIME_TYPES[type] === true) return true;
    return ALLOWED_UPLOAD_EXTENSIONS.indexOf(ext) !== -1;
  }

  function getUploadFileExtension(file) {
    var name = String(file && file.name || '').trim();
    var match = name.match(/\.([a-z0-9]+)$/i);
    return match ? String(match[1] || '').toLowerCase() : '';
  }

  function validateUploadFile(file, options) {
    var type;
    var ext;
    var size;
    var settings;
    var maxBytes;
    var allowPrecompressLargeImage;
    var customMaxBytes;
    var limitLabel;

    if (!file || typeof file !== 'object') {
      throw buildCloudinaryUploadError('?? ??? ?????? ???? ?????.', {
        code: 'CLOUDINARY_NO_FILE',
        transient: false
      });
    }

    settings = options && typeof options === 'object' ? options : {};
    type = String(file.type || '').toLowerCase();
    ext = getUploadFileExtension(file);
    size = Number(file.size || 0);
    allowPrecompressLargeImage = settings.phase === 'precompress' && isLikelyImageUploadFile(file);
    customMaxBytes = Math.max(0, Number(settings.maxSize || 0));
    maxBytes = allowPrecompressLargeImage
      ? Math.max(MAX_PRECOMPRESS_IMAGE_BYTES, customMaxBytes || 0)
      : (customMaxBytes || MAX_FINAL_UPLOAD_BYTES);
    limitLabel = String(Math.round(maxBytes / (1024 * 1024)));

    if (!(ALLOWED_UPLOAD_MIME_TYPES[type] === true || ALLOWED_UPLOAD_EXTENSIONS.indexOf(ext) !== -1)) {
      throw buildCloudinaryUploadError('???? ?????? ??? ??????. ?????? JPG ?? PNG ?? WebP ???.', {
        code: 'CLOUDINARY_INVALID_FILE',
        transient: false
      });
    }

    if (size > maxBytes) {
      throw buildCloudinaryUploadError(allowPrecompressLargeImage
        ? 'حجم الصورة أكبر من ' + limitLabel + 'MB. اضغط الصورة أو اختر ملفاً أصغر.'
        : 'حجم الصورة أكبر من ' + limitLabel + 'MB. اضغط الصورة ثم حاول مرة أخرى.', {
        code: 'CLOUDINARY_FILE_TOO_LARGE',
        transient: false
      });
    }

    return {
      type: type,
      ext: ext,
      size: size
    };
  }

  function isCloudinaryTransformSegment(segment) {
    var value = String(segment || '').trim();
    var supportedKeys;
    if (!value || /^v\d+$/i.test(value)) return false;
    supportedKeys = {
      a: true, ac: true, af: true, ar: true, b: true, bo: true, c: true, co: true,
      d: true, dl: true, dn: true, dpi: true, dr: true, du: true, e: true, eo: true,
      f: true, fl: true, fn: true, fps: true, g: true, h: true, ki: true, l: true,
      o: true, p: true, pg: true, q: true, r: true, so: true, sp: true, t: true,
      u: true, vc: true, w: true, x: true, y: true, z: true
    };
    return value.split(',').every(function (part) {
      var chunk = String(part || '').trim();
      var separatorIndex = chunk.indexOf('_');
      if (separatorIndex <= 0) return false;
      return supportedKeys[chunk.slice(0, separatorIndex)] === true;
    });
  }

  function extractCloudinaryAssetPath(url) {
    var rawUrl = String(url || '').trim();
    var parsed;
    var marker;
    var markerIndex;
    var afterUpload;
    var segments;
    if (!isValidCloudinarySecureUrl(rawUrl)) return '';

    try {
      parsed = new URL(rawUrl);
      marker = '/' + CLOUDINARY_CONFIG.cloudName + '/image/upload/';
      markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex === -1) return '';
      afterUpload = parsed.pathname.slice(markerIndex + marker.length);
      segments = afterUpload.split('/').filter(Boolean);
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

  function getImageTransformPreset(size) {
    return TRANSFORMS[String(size || 'card')] || TRANSFORMS.card;
  }

  function encodePublicIdSegments(publicId) {
    return String(publicId || '')
      .split('/')
      .filter(Boolean)
      .map(function (segment) { return encodeURIComponent(segment); })
      .join('/');
  }

  function buildCloudinaryEnhancedUrl(assetPath, size) {
    var normalizedPath = String(assetPath || '').replace(/^\/+/, '');
    var transforms = getImageTransformPreset(size);
    if (!normalizedPath) return _fallback();
    return 'https://res.cloudinary.com/' + CLOUDINARY_CONFIG.cloudName
      + '/image/upload/' + transforms
      + '/' + normalizedPath;
  }

  function getTransformSizeFromWidth(width) {
    var numericWidth = Math.max(120, Math.min(2000, Number(width) || 800));
    if (numericWidth <= 140) return 'admin';
    if (numericWidth <= 420) return 'thumbnail';
    if (numericWidth >= 1100) return 'full';
    return 'card';
  }

  /**
   * Build optimized Cloudinary URL from a raw image name or existing Cloudinary URL.
   * @param {string|object} imageName
   * @param {string} size - card | thumbnail | full | admin | feed
   * @returns {string}
   */
  function enhanceProductImageUrl(imageName, size) {
    var rawValue;
    var clean;
    var encodedPublicId;
    var assetPath;

    size = size || 'card';
    rawValue = '';

    if (imageName && typeof imageName === 'object') {
      rawValue = String(imageName.imageUrl || imageName.image || '').trim();
    } else {
      rawValue = String(imageName || '').trim();
    }

    if (!rawValue) return _fallback();
    if (rawValue.indexOf('data:') === 0) return rawValue;
    if (rawValue.indexOf('./') === 0 || rawValue.indexOf('assets/') === 0) return rawValue;
    if (rawValue.indexOf('/') === 0 && !/^https?:\/\//i.test(rawValue)) return _fallback();

    if (isValidCloudinarySecureUrl(rawValue)) {
      assetPath = extractCloudinaryAssetPath(rawValue);
      return assetPath ? buildCloudinaryEnhancedUrl(assetPath, size) : _fallback();
    }

    if (/^https?:\/\//i.test(rawValue)) {
      return rawValue;
    }

    clean = _cleanName(rawValue);
    if (!clean || /^https?:\/\//i.test(clean)) return _fallback();

    encodedPublicId = encodePublicIdSegments(clean);
    assetPath = clean.indexOf('/') !== -1
      ? encodedPublicId
      : _folder() + '/' + encodedPublicId;

    return buildCloudinaryEnhancedUrl(assetPath, size);
  }

  /**
   * Legacy-compatible API.
   * Supports both width numbers and { size, width } option objects.
   */
  function getOptimizedImageUrl(imageName, options) {
    var size = 'card';
    if (typeof options === 'number') {
      size = getTransformSizeFromWidth(options);
    } else if (options && typeof options === 'object') {
      size = options.size || getTransformSizeFromWidth(options.width);
    }
    return enhanceProductImageUrl(imageName, size);
  }

  /**
   * Safe image getter with fallback.
   * Supports product objects and width-based calls used elsewhere in the app.
   */
  function getSafeImageUrl(imageInput, width) {
    var source = imageInput;
    var size = getTransformSizeFromWidth(width);

    if (source && typeof source === 'object') {
      return enhanceProductImageUrl(source.imageUrl || source.image || '', size);
    }

    if (!source) return _fallback();
    return enhanceProductImageUrl(source, size);
  }

  function normalizeBannerFocalPoint(focalPoint) {
    return String(focalPoint || 'subject').trim().toLowerCase() || 'subject';
  }

  function getBannerGravityTransform(focalPoint) {
    var normalized = normalizeBannerFocalPoint(focalPoint);
    var gravityMap = {
      face: 'g_auto:face',
      subject: 'g_auto:subject',
      auto: 'g_auto',
      center: 'g_center',
      top: 'g_north',
      north: 'g_north',
      bottom: 'g_south',
      south: 'g_south'
    };
    return gravityMap[normalized] || gravityMap.subject;
  }

  function getBannerTransformPreset(context, options) {
    var gravity = getBannerGravityTransform(options && options.focalPoint);
    var presets = {
      desktop: 'ar_16:9,c_fill,' + gravity + ',w_1200,q_auto:best,f_auto,dpr_auto',
      tablet: 'ar_4:3,c_fill,' + gravity + ',w_900,q_auto:best,f_auto,dpr_auto',
      mobile: 'ar_4:5,c_fill,' + gravity + ',w_600,q_auto:best,f_auto,dpr_auto',
      preview: 'ar_16:9,c_fill,' + gravity + ',w_400,q_auto,f_auto'
    };
    return presets[String(context || '').trim()] || presets.desktop;
  }

  function hasCloudinaryTransforms(url) {
    var rawUrl = String(url || '').trim();
    var parsed;
    var markerIndex;
    var afterUpload;
    var segments;
    if (!rawUrl || rawUrl.indexOf('cloudinary.com') === -1) return false;

    try {
      parsed = new URL(rawUrl);
      markerIndex = parsed.pathname.indexOf('/image/upload/');
      if (markerIndex === -1) return false;
      afterUpload = parsed.pathname.slice(markerIndex + '/image/upload/'.length);
      segments = afterUpload.split('/').filter(Boolean);
      if (!segments.length) return false;
      if (isCloudinaryTransformSegment(segments[0])) return true;
      if (segments.length > 1 && /^v\d+$/i.test(segments[0]) && isCloudinaryTransformSegment(segments[1])) {
        return true;
      }
    } catch (_) {
      return false;
    }

    return false;
  }

  function optimizeBannerImageUrl(url, context, options) {
    var rawUrl = String(url || '').trim();
    var transforms;
    if (!rawUrl || rawUrl.indexOf('cloudinary.com') === -1) {
      return rawUrl;
    }

    if (hasCloudinaryTransforms(rawUrl)) {
      return rawUrl;
    }

    transforms = getBannerTransformPreset(context, options);
    return rawUrl.replace('/image/upload/', '/image/upload/' + transforms + '/');
  }

  function buildBannerSrcset(url, focalPoint) {
    var rawUrl = String(url || '').trim();
    var safeFocalPoint = normalizeBannerFocalPoint(focalPoint);
    var mobileUrl;
    var tabletUrl;
    var desktopUrl;
    if (!rawUrl || rawUrl.indexOf('cloudinary.com') === -1) {
      return null;
    }

    mobileUrl = optimizeBannerImageUrl(rawUrl, 'mobile', { focalPoint: safeFocalPoint });
    tabletUrl = optimizeBannerImageUrl(rawUrl, 'tablet', { focalPoint: safeFocalPoint });
    desktopUrl = optimizeBannerImageUrl(rawUrl, 'desktop', { focalPoint: safeFocalPoint });

    return {
      srcset: mobileUrl + ' 600w, ' + tabletUrl + ' 900w, ' + desktopUrl + ' 1200w',
      sizes: '(max-width: 600px) 600px, (max-width: 900px) 900px, 1200px'
    };
  }

  /**
   * getUltimateBannerUrl
   * V4 professional banner image delivery.
   * Does NOT modify optimizeBannerImageUrl().
   *
   * @param {string} url Cloudinary asset URL
   * @param {string} context 'desktop'|'tablet'|'mobile'|'preview'
   * @param {object} options delivery options
   * @param {string} options.fitMode 'auto'|'pad'|'crop'|'scale'
   * @param {string} options.focalPoint
   *   'subject'|'face'|'auto'|'center'|'top'|'bottom'
   *   used only when fitMode is 'crop'
   * @returns {string} optimized URL or original if not applicable
   */
  function getUltimateBannerUrl(url, context, options) {
    if (!url || !url.includes('cloudinary.com')) {
      return url;
    }

    var uploadPath = String(url.split('/upload/')[1] || '');
    if (/(^|[,/])(ar_|c_|w_|h_|q_|f_|g_|b_)/.test(uploadPath)) {
      return url;
    }

    var fitMode = options && options.fitMode ? options.fitMode : 'auto';
    var contexts = {
      desktop: { ar: '16:9', w: '1200' },
      tablet: { ar: '4:3', w: '900' },
      mobile: { ar: '4:5', w: '600' },
      preview: { ar: '16:9', w: '400' }
    };
    var selectedContext = contexts[context] || contexts.desktop;
    var transform;

    switch (fitMode) {
      case 'pad':
        transform = 'w_' + selectedContext.w + ',c_pad,ar_' + selectedContext.ar + ',q_auto:good,f_auto';
        break;
      case 'crop':
        transform = 'w_' + selectedContext.w + ',c_fill,g_auto,ar_' + selectedContext.ar + ',q_auto:good,f_auto';
        break;
      case 'scale':
        transform = 'w_' + selectedContext.w + ',c_scale,q_auto:good,f_auto';
        break;
      case 'auto':
      default:
        transform = 'w_' + selectedContext.w + ',c_pad,ar_' + selectedContext.ar + ',q_auto:good,f_auto';
        break;
    }

    if (transform.indexOf('undefined') !== -1) {
      return url;
    }

    return url.replace('/upload/', '/upload/' + transform + '/');
  }

  function compressImageBeforeUpload(file, maxSizeKB) {
    var settings = (maxSizeKB && typeof maxSizeKB === 'object') ? maxSizeKB : {};
    var maxDimension = Math.max(120, Number(settings.maxDimension || MAX_COMPRESSED_DIMENSION));
    var hasBannerBox = Number(settings.maxWidth || 0) > 0 && Number(settings.maxHeight || 0) > 0;
    var maxWidth = Math.max(120, Number(settings.maxWidth || maxDimension));
    var maxHeight = Math.max(120, Number(settings.maxHeight || maxDimension));
    var quality = Math.max(0.5, Math.min(0.95, Number(settings.quality || DEFAULT_UPLOAD_QUALITY)));
    var validated;
    if (!file || typeof document === 'undefined') return Promise.resolve(file);

    try {
      validated = validateUploadFile(file, { phase: 'precompress' });
    } catch (error) {
      return Promise.reject(error);
    }

    if (!isLikelyImageUploadFile(file)) {
      return Promise.resolve(file);
    }

    if (!(ALLOWED_UPLOAD_MIME_TYPES[validated.type] === true || ALLOWED_UPLOAD_EXTENSIONS.indexOf(validated.ext) !== -1)) {
      return Promise.resolve(file);
    }

    return new Promise(function (resolve) {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var img;
      var objectUrl;
      if (!ctx) {
        resolve(file);
        return;
      }

      img = new Image();
      objectUrl = URL.createObjectURL(file);

      function cleanup() {
        try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      }

      img.onerror = function () {
        cleanup();
        resolve(file);
      };

      img.onload = function () {
        var targetWidth = hasBannerBox ? maxWidth : maxDimension;
        var targetHeight = hasBannerBox ? maxHeight : maxDimension;
        var widthScale = img.width > targetWidth ? (targetWidth / img.width) : 1;
        var heightScale = img.height > targetHeight ? (targetHeight / img.height) : 1;
        var scale = Math.min(widthScale, heightScale, 1);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          var normalizedName;
          cleanup();
          if (!blob || Number(blob.size || 0) <= 0 || Number(blob.size || 0) >= Number(file.size || 0)) {
            resolve(file);
            return;
          }
          normalizedName = String(file.name || 'image.jpg').replace(/\.[^.]+$/u, '.jpg');
          resolve(new File([blob], normalizedName, {
            type: 'image/jpeg',
            lastModified: Date.now()
          }));
        }, 'image/jpeg', quality);
      };

      img.src = objectUrl;
    });
  }

  function uploadToCloudinary(file, options) {
    var settings = options && typeof options === 'object' ? options : {};
    var compressOptions = settings.compress && typeof settings.compress === 'object'
      ? settings.compress
      : null;
    try {
      validateUploadFile(file, {
        phase: 'precompress',
        maxSize: settings.maxSize
      });
    } catch (validationError) {
      return Promise.reject(validationError);
    }
    if (!isCloudinaryConfigured()) {
      return Promise.reject(buildCloudinaryUploadError('إعدادات Cloudinary غير مكتملة.', {
        code: 'CLOUDINARY_CONFIG_MISSING'
      }));
    }

    return compressImageBeforeUpload(file, compressOptions || undefined).catch(function () {
      return file;
    }).then(function (uploadFile) {
      validateUploadFile(uploadFile, {
        phase: 'upload',
        maxSize: settings.maxSize
      });
      var onProgress = typeof settings.onProgress === 'function' ? settings.onProgress : null;
      var folder = String(settings.folder || _folder()).trim();
      var publicId = String(settings.publicId || '')
        .trim()
        .replace(/\.[^./]+$/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}_-]/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      var signal = settings.signal || null;
      var onAbort = typeof settings.onAbort === 'function' ? settings.onAbort : null;
      var resourceType = isLikelyImageUploadFile(uploadFile) ? 'image' : 'raw';
      var endpoint = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CONFIG.cloudName + '/' + resourceType + '/upload';

      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        var settled = false;
        var abortHandler = null;
        var abortNotified = false;

        function notifyAbort() {
          if (abortNotified) return;
          abortNotified = true;
          if (onAbort) {
            try { onAbort(); } catch (_) {}
          }
        }

        function cleanup() {
          if (signal && abortHandler) {
            signal.removeEventListener('abort', abortHandler);
          }
          abortHandler = null;
        }

        function safeResolve(payload) {
          if (settled) return;
          settled = true;
          cleanup();
          cloudinaryDebugInfo('[CLOUDINARY_UPLOAD] success:', {
            public_id: payload && payload.public_id ? String(payload.public_id) : '',
            secure_url: payload && payload.secure_url ? String(payload.secure_url) : ''
          });
          cloudinaryDebugGroupEnd();
          resolve(payload);
        }

        function safeReject(error) {
          var normalized;
          if (settled) return;
          settled = true;
          cleanup();
          normalized = error instanceof Error
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
        }

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
          folder: folder,
          publicId: publicId || '(auto)'
        });

        if (signal && signal.aborted) {
          cloudinaryDebugGroupEnd();
          reject(buildCloudinaryUploadError('تم إلغاء الرفع', {
            code: 'UPLOAD_ABORTED'
          }));
          return;
        }

        xhr.open('POST', endpoint, true);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = function (event) {
            var percent;
            if (!event || !event.lengthComputable) return;
            percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
            onProgress(percent);
          };
        }

        xhr.onerror = function () {
          safeReject(buildCloudinaryUploadError('تعذر الاتصال بـ Cloudinary. تحقق من الشبكة ثم حاول مرة أخرى.', {
            code: 'NETWORK_ERROR',
            transient: true
          }));
        };

        xhr.onabort = function () {
          notifyAbort();
          safeReject(buildCloudinaryUploadError('تم إلغاء الرفع', {
            code: 'UPLOAD_ABORTED'
          }));
        };

        xhr.onload = function () {
          var status = Number(xhr.status || 0);
          var rawText;
          var parsedMessage = '';
          var snippet;
          var payload;
          var secureUrl;

          if (status < 200 || status >= 300) {
            rawText = String(xhr.responseText || '');
            try {
              parsedMessage = String(JSON.parse(rawText || '{}').error?.message || JSON.parse(rawText || '{}').message || '').trim();
            } catch (_) {}

            if (status === 429 || /rate limit/i.test(parsedMessage)) {
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

            snippet = (parsedMessage || rawText).slice(0, 260);
            safeReject(buildCloudinaryUploadError('فشل رفع الصورة على Cloudinary (HTTP ' + status + '): ' + snippet, {
              code: 'HTTP_ERROR',
              statusCode: status,
              transient: status >= 500
            }));
            return;
          }

          try {
            payload = JSON.parse(xhr.responseText || '{}');
          } catch (_) {
            safeReject(buildCloudinaryUploadError('استجابة Cloudinary غير صالحة (JSON).', {
              code: 'CLOUDINARY_BAD_RESPONSE'
            }));
            return;
          }

          secureUrl = String(payload.secure_url || '').trim();
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

        if (signal && typeof signal.addEventListener === 'function') {
          abortHandler = function () {
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
          var formData = new FormData();
          formData.append('file', uploadFile);
          formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
          if (folder) formData.append('folder', folder);
          if (publicId) formData.append('public_id', publicId);
          xhr.send(formData);
        } catch (error) {
          safeReject(error);
        }
      });
    });
  }

  var CloudinaryService = {
    config: CLOUDINARY_CONFIG,
    transforms: TRANSFORMS,
    enhance: enhanceProductImageUrl,
    optimizeBanner: optimizeBannerImageUrl,
    buildBannerSrcset: buildBannerSrcset,
    getOptimized: getOptimizedImageUrl,
    getSafe: getSafeImageUrl,
    validateUpload: validateUploadFile,
    compressBeforeUpload: compressImageBeforeUpload,
    upload: uploadToCloudinary,
    isConfigured: isCloudinaryConfigured,
    buildUploadError: buildCloudinaryUploadError,
    uploadRules: {
      maxBytes: MAX_FINAL_UPLOAD_BYTES,
      maxPrecompressImageBytes: MAX_PRECOMPRESS_IMAGE_BYTES,
      maxDimension: MAX_COMPRESSED_DIMENSION,
      quality: DEFAULT_UPLOAD_QUALITY,
      allowedExtensions: ALLOWED_UPLOAD_EXTENSIONS.slice()
    }
  };

  global.CloudinaryService = CloudinaryService;

  global.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
  global.enhanceProductImageUrl = enhanceProductImageUrl;
  global.optimizeBannerImageUrl = optimizeBannerImageUrl;
  global.buildBannerSrcset = buildBannerSrcset;
  global.getUltimateBannerUrl = getUltimateBannerUrl;
  global.getOptimizedImageUrl = getOptimizedImageUrl;
  global.getSafeImageUrl = getSafeImageUrl;
  global.validateCloudinaryUploadFile = validateUploadFile;
  global.compressImageBeforeUpload = compressImageBeforeUpload;
  global.uploadToCloudinary = uploadToCloudinary;
  global.isCloudinaryConfigured = isCloudinaryConfigured;
  global.buildCloudinaryUploadError = buildCloudinaryUploadError;

})(window);
