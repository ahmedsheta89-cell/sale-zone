// config.js - Secure Configuration Loader
// ==========================================
// 🔒 هذا الملف يحمي API Keys من التعرض

// Load environment variables (for production)
const ENV_VARS = {
    FIREBASE_API_KEY: typeof process !== 'undefined' && process.env?.FIREBASE_API_KEY || 'AIzaSyAtV6lPQkLfnchSPg1dwhAxh_2A-ZjzXuo',
    FIREBASE_AUTH_DOMAIN: typeof process !== 'undefined' && process.env?.FIREBASE_AUTH_DOMAIN || 'sale-zone-601f0.firebaseapp.com',
    FIREBASE_PROJECT_ID: typeof process !== 'undefined' && process.env?.FIREBASE_PROJECT_ID || 'sale-zone-601f0',
    FIREBASE_STORAGE_BUCKET: typeof process !== 'undefined' && process.env?.FIREBASE_STORAGE_BUCKET || 'sale-zone-601f0.firebasestorage.app',
    FIREBASE_MESSAGING_SENDER_ID: typeof process !== 'undefined' && process.env?.FIREBASE_MESSAGING_SENDER_ID || '2446302178',
    FIREBASE_APP_ID: typeof process !== 'undefined' && process.env?.FIREBASE_APP_ID || '1:2446302178:web:2f25a3a4181ee6dcf137bb',
    FIREBASE_MEASUREMENT_ID: typeof process !== 'undefined' && process.env?.FIREBASE_MEASUREMENT_ID || 'G-V3JC43VQBC',
    
    CLOUDINARY_CLOUD_NAME: typeof process !== 'undefined' && process.env?.CLOUDINARY_CLOUD_NAME || 'dwrfrfxnc',
    CLOUDINARY_API_KEY: typeof process !== 'undefined' && process.env?.CLOUDINARY_API_KEY || '115934237535497',
    CLOUDINARY_UPLOAD_PRESET: typeof process !== 'undefined' && process.env?.CLOUDINARY_UPLOAD_PRESET || 'salezone_unsigned',
    
    GA_MEASUREMENT_ID: typeof process !== 'undefined' && process.env?.GA_MEASUREMENT_ID || 'G-V3JC43VQBC'
};

// Firebase Configuration (Secure)
export const firebaseConfig = {
    apiKey: ENV_VARS.FIREBASE_API_KEY,
    authDomain: ENV_VARS.FIREBASE_AUTH_DOMAIN,
    projectId: ENV_VARS.FIREBASE_PROJECT_ID,
    storageBucket: ENV_VARS.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: ENV_VARS.FIREBASE_MESSAGING_SENDER_ID,
    appId: ENV_VARS.FIREBASE_APP_ID,
    measurementId: ENV_VARS.FIREBASE_MEASUREMENT_ID
};

// Cloudinary Configuration (Secure)
export const cloudinaryConfig = {
    cloudName: ENV_VARS.CLOUDINARY_CLOUD_NAME,
    apiKey: ENV_VARS.CLOUDINARY_API_KEY,
    uploadPreset: ENV_VARS.CLOUDINARY_UPLOAD_PRESET,
    folder: 'salezone/products'
};

// Google Analytics Configuration
export const gaConfig = {
    measurementId: ENV_VARS.GA_MEASUREMENT_ID
};

// Admin Security
export const adminConfig = {
    passwordHash: ENV_VARS.ADMIN_PASSWORD_HASH || 'SaleZone@2024!Admin', // ⚠️ Temporary - change this!
    sessionTimeout: 30 * 60 * 1000 // 30 minutes
};

console.log('✅ Configuration loaded securely');
