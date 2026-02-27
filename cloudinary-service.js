// cloudinary-service.js - Enterprise signed upload flow
// =====================================================
// Security policy:
// - No unsigned preset uploads.
// - No DataURL/base64 fallback.
// - Upload is rejected unless backend signature endpoint is configured and reachable.

function resolveBackendBaseUrl() {
    if (typeof window === 'undefined') return '';
    const explicit = String(window.__BACKEND_API_BASE_URL__ || window.BACKEND_API_BASE_URL || '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    const meta = document.querySelector('meta[name="backend-api-base-url"]');
    const fromMeta = String(meta && meta.getAttribute('content') || '').trim();
    return fromMeta ? fromMeta.replace(/\/+$/, '') : '';
}

async function getCloudinaryUploadSignature(file) {
    const backendBase = resolveBackendBaseUrl();
    if (!backendBase) {
        throw new Error('Backend API base URL is missing. Signed upload is required.');
    }

    if (!(firebase && firebase.auth && firebase.auth().currentUser)) {
        throw new Error('Authentication required before upload.');
    }

    const user = firebase.auth().currentUser;
    const idToken = await user.getIdToken(true);

    let appCheckToken = '';
    try {
        if (firebase && firebase.appCheck) {
            const appCheck = firebase.appCheck();
            if (appCheck && typeof appCheck.getToken === 'function') {
                const tokenResult = await appCheck.getToken(false);
                appCheckToken = String(tokenResult && tokenResult.token || '');
            }
        }
    } catch (_) {}

    const body = {
        folder: 'sale-zone/products',
        resourceType: 'image',
        originalFilename: String(file && file.name || '')
    };

    const response = await fetch(`${backendBase}/v1/media/cloudinary-signature`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
            ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {})
        },
        body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
        const message = payload && payload.error && payload.error.message
            ? String(payload.error.message)
            : `Signature request failed (${response.status})`;
        throw new Error(message);
    }

    const data = payload && payload.data ? payload.data : payload;
    const requiredFields = ['signature', 'timestamp', 'cloudName', 'apiKey', 'folder'];
    for (const field of requiredFields) {
        if (!String(data && data[field] || '').trim()) {
            throw new Error(`Invalid signature response: missing ${field}`);
        }
    }

    return data;
}

async function uploadToCloudinary(file) {
    if (!file) throw new Error('No file provided');

    const signatureData = await getCloudinaryUploadSignature(file);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`;

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', String(signatureData.apiKey));
    form.append('timestamp', String(signatureData.timestamp));
    form.append('signature', String(signatureData.signature));
    form.append('folder', String(signatureData.folder));
    if (signatureData.publicId) {
        form.append('public_id', String(signatureData.publicId));
    }

    const response = await fetch(uploadUrl, { method: 'POST', body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload && payload.error && payload.error.message
            ? String(payload.error.message)
            : `Cloudinary upload failed (${response.status})`;
        throw new Error(message);
    }

    const secureUrl = String(payload && (payload.secure_url || payload.url) || '').trim();
    if (!secureUrl) throw new Error('Cloudinary response missing secure_url');

    return {
        url: secureUrl,
        publicId: String(payload && payload.public_id || '').trim()
    };
}
