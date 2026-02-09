// cloudinary-service.js - Optional Cloudinary uploader
// ====================================================
// Professional default: use your own media hosting to avoid ORB/CORS issues.
// Configure these two values in production (unsigned upload preset).
const CLOUDINARY_CONFIG = {
    cloudName: "",
    uploadPreset: ""
};

function isCloudinaryConfigured() {
    return Boolean(CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset);
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

async function uploadToCloudinary(file) {
    if (!file) throw new Error("No file provided");

    if (!isCloudinaryConfigured()) {
        // Fallback: keep local data URL to avoid breaking the flow
        console.warn("Cloudinary not configured. Using local data URL fallback.");
        const dataUrl = await fileToDataUrl(file);
        return { url: dataUrl, isLocal: true };
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);

    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Cloudinary upload failed: ${text}`);
    }

    const data = await res.json();
    return { url: data.secure_url || data.url, publicId: data.public_id };
}
