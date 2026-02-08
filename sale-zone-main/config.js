// config.js - Secure Configuration Loader
// ==========================================
// 🔒 هذا الملف يحمي API Keys من التعرض

// Helper function to get environment variables safely
function getEnvVar(key, devKey = null, defaultValue = null) {
    // Try production environment variables first
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key];
    }
    
    // Try development environment variables
    if (typeof process !== 'undefined' && process.env && devKey && process.env[devKey]) {
        return process.env[devKey];
    }
    
    // Fallback to default values (for development only)
    if (defaultValue) {
        console.warn(`⚠️ Using default value for ${key} - Set environment variable in production!`);
        return defaultValue;
    }
    
    throw new Error(`❌ Missing environment variable: ${key}`);
}

// Load environment variables securely
const ENV_VARS = {
    FIREBASE_API_KEY: getEnvVar('FIREBASE_API_KEY', 'DEV_FIREBASE_API_KEY', 'AIzaSyAtV6lPQkLfnchSPg1dwhAxh_2A-ZjzXuo'),
    FIREBASE_AUTH_DOMAIN: getEnvVar('FIREBASE_AUTH_DOMAIN', 'DEV_FIREBASE_AUTH_DOMAIN', 'sale-zone-601f0.firebaseapp.com'),
    FIREBASE_PROJECT_ID: getEnvVar('FIREBASE_PROJECT_ID', 'DEV_FIREBASE_PROJECT_ID', 'sale-zone-601f0'),
    FIREBASE_STORAGE_BUCKET: getEnvVar('FIREBASE_STORAGE_BUCKET', 'DEV_FIREBASE_STORAGE_BUCKET', 'sale-zone-601f0.firebasestorage.app'),
    FIREBASE_MESSAGING_SENDER_ID: getEnvVar('FIREBASE_MESSAGING_SENDER_ID', 'DEV_FIREBASE_MESSAGING_SENDER_ID', '2446302178'),
    FIREBASE_APP_ID: getEnvVar('FIREBASE_APP_ID', 'DEV_FIREBASE_APP_ID', '1:2446302178:web:2f25a3a4181ee6dcf137bb'),
    FIREBASE_MEASUREMENT_ID: getEnvVar('FIREBASE_MEASUREMENT_ID', 'DEV_FIREBASE_MEASUREMENT_ID', 'G-V3JC43VQBC'),
    
    CLOUDINARY_CLOUD_NAME: getEnvVar('CLOUDINARY_CLOUD_NAME', 'DEV_CLOUDINARY_CLOUD_NAME', 'dwrfrfxnc'),
    CLOUDINARY_API_KEY: getEnvVar('CLOUDINARY_API_KEY', 'DEV_CLOUDINARY_API_KEY', '115934237535497'),
    CLOUDINARY_UPLOAD_PRESET: getEnvVar('CLOUDINARY_UPLOAD_PRESET', 'DEV_CLOUDINARY_UPLOAD_PRESET', 'salezone_unsigned'),
    
    GA_MEASUREMENT_ID: getEnvVar('GA_MEASUREMENT_ID', 'DEV_GA_MEASUREMENT_ID', 'G-V3JC43VQBC'),
    
    ADMIN_PASSWORD_HASH: getEnvVar('ADMIN_PASSWORD_HASH', 'DEV_ADMIN_PASSWORD_HASH', 'SaleZone@2024!Admin'),
    SESSION_SECRET: getEnvVar('SESSION_SECRET', null, 'default-session-secret-change-in-production'),
    NODE_ENV: getEnvVar('NODE_ENV', null, 'development')
};

// Firebase Configuration (Secure)
const firebaseConfig = {
    apiKey: ENV_VARS.FIREBASE_API_KEY,
    authDomain: ENV_VARS.FIREBASE_AUTH_DOMAIN,
    projectId: ENV_VARS.FIREBASE_PROJECT_ID,
    storageBucket: ENV_VARS.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: ENV_VARS.FIREBASE_MESSAGING_SENDER_ID,
    appId: ENV_VARS.FIREBASE_APP_ID,
    measurementId: ENV_VARS.FIREBASE_MEASUREMENT_ID
};

// Cloudinary Configuration (Secure)
const cloudinaryConfig = {
    cloudName: ENV_VARS.CLOUDINARY_CLOUD_NAME,
    apiKey: ENV_VARS.CLOUDINARY_API_KEY,
    uploadPreset: ENV_VARS.CLOUDINARY_UPLOAD_PRESET,
    folder: 'salezone/products'
};

// Google Analytics Configuration
const gaConfig = {
    measurementId: ENV_VARS.GA_MEASUREMENT_ID
};

// Admin Security (Enhanced)
const adminConfig = {
    passwordHash: ENV_VARS.ADMIN_PASSWORD_HASH,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    sessionSecret: ENV_VARS.SESSION_SECRET,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    requirePasswordChange: ENV_VARS.NODE_ENV === 'production'
};

// Security Settings
const securityConfig = {
    enableRateLimit: true,
    maxRequestsPerMinute: 100,
    enableCSRFProtection: true,
    enableXSSProtection: true,
    logSecurityEvents: ENV_VARS.NODE_ENV === 'production'
};

// Development Warning
if (ENV_VARS.NODE_ENV === 'production' && 
    (ENV_VARS.ADMIN_PASSWORD_HASH === 'SaleZone@2024!Admin' || 
     ENV_VARS.SESSION_SECRET === 'default-session-secret-change-in-production')) {
    console.error('🚨 SECURITY WARNING: Using default credentials in production!');
    console.error('Please set proper environment variables before deploying to production!');
}

// Make configurations available globally
window.firebaseConfig = firebaseConfig;
window.cloudinaryConfig = cloudinaryConfig;
window.gaConfig = gaConfig;
window.adminConfig = adminConfig;
window.securityConfig = securityConfig;

console.log('✅ Configuration loaded securely');
console.log(`🔧 Environment: ${ENV_VARS.NODE_ENV}`);
