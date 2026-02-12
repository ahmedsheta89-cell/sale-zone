// firebase-config.js - Firebase Configuration
// ==========================================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAtV6lPQkLfnchSPg1dwhAxh_2A-ZjzXuo",
    authDomain: "sale-zone-601f0.firebaseapp.com",
    projectId: "sale-zone-601f0",
    storageBucket: "sale-zone-601f0.firebasestorage.app",
    messagingSenderId: "2446302178",
    appId: "1:2446302178:web:2f25a3a4181ee6dcf137bb",
    measurementId: "G-V3JC43VQBC"
};

function isLocalLikeHost(hostname) {
    const host = String(hostname || "").trim().toLowerCase();
    if (!host) return false;

    if (/^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1|\[::1\])$/.test(host)) return true;
    if (/^10(?:\.\d{1,3}){3}$/.test(host)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host)) return true;
    return host.endsWith(".local");
}

const hostname = window.location.hostname || "";
const isGithubPages = /(^|\.)github\.io$/i.test(hostname);
const isLocalDev = isLocalLikeHost(hostname);

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore
const db = firebase.firestore();

// Local/dev networks can break WebChannel; this improves stability.
if (isLocalDev) {
    try {
        if (!window.__FIRESTORE_SETTINGS_APPLIED__) {
            db.settings({
                experimentalAutoDetectLongPolling: true,
                useFetchStreams: false
            });
            window.__FIRESTORE_SETTINGS_APPLIED__ = true;
        }
        console.log("Local/network dev mode - Firestore long-polling auto-detect enabled");
    } catch (e) {
        console.warn("Firestore settings already initialized:", e);
    }
}

// GitHub Pages mode
if (isGithubPages) {
    // Keep Firebase online mode on production; realtime listeners are gated in firebase-data.js.
    console.log("GitHub Pages detected - Firebase online mode enabled");
} else {
    console.log("Firebase initialized");
}
