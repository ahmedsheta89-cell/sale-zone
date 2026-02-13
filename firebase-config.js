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
const shouldApplyStableTransport = isLocalDev || isGithubPages;

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore
const db = firebase.firestore();

// Some networks/browsers break WebChannel. Stabilize transport consistently.
if (shouldApplyStableTransport) {
    try {
        if (!window.__FIRESTORE_SETTINGS_APPLIED__) {
            // Keep one deterministic mode to avoid runtime conflicts from mixed cached scripts.
            db.settings({
                experimentalForceLongPolling: true,
                useFetchStreams: false
            });
            window.__FIRESTORE_SETTINGS_APPLIED__ = true;
            window.__FIRESTORE_STABLE_TRANSPORT_MODE__ = "force";
        }
        console.log("Firestore stable transport enabled (force long-polling)");
    } catch (e) {
        // Non-fatal:
        // - settings already applied in this page lifecycle
        // - stale cached client executed an old conflicting config before this script
        const reason = e && e.message ? e.message : String(e);
        console.warn("Firestore transport settings could not be applied (non-fatal):", reason);
        window.__FIRESTORE_SETTINGS_APPLIED__ = true;
        window.__FIRESTORE_STABLE_TRANSPORT_ERROR__ = reason;
    }
}

// GitHub Pages mode
if (isGithubPages) {
    // Keep Firebase online mode on production; realtime listeners are gated in firebase-data.js.
    console.log("GitHub Pages detected - Firebase online mode enabled");
} else {
    console.log("Firebase initialized");
}
