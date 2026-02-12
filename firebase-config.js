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
const urlParams = new URLSearchParams(window.location.search || "");
const forceLongPollingParam = urlParams.get("lp") === "1";
const isFirefoxFamily = /firefox|fxios/i.test(navigator.userAgent || "");
const shouldApplyStableTransport = isLocalDev || isGithubPages;
const shouldForceLongPolling = forceLongPollingParam || isFirefoxFamily;

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
            const settings = {
                useFetchStreams: false,
                // Keep merge on to avoid clobbering other settings, but always
                // explicitly disable the opposite long-polling flag. This
                // prevents "experimentalForceLongPolling and experimentalAutoDetectLongPolling cannot be used together"
                // when cached older settings exist.
                merge: true
            };

            if (shouldForceLongPolling) {
                settings.experimentalForceLongPolling = true;
                settings.experimentalAutoDetectLongPolling = false;
            } else {
                settings.experimentalAutoDetectLongPolling = true;
                settings.experimentalForceLongPolling = false;
            }

            db.settings(settings);
            window.__FIRESTORE_SETTINGS_APPLIED__ = true;
            window.__FIRESTORE_STABLE_TRANSPORT_MODE__ = shouldForceLongPolling ? 'force' : 'auto';
        }
        if (shouldForceLongPolling) {
            console.log("Firestore stable transport enabled (force long-polling)");
        } else {
            console.log("Firestore stable transport enabled (auto long-polling)");
        }
    } catch (e) {
        // Most common causes:
        // - settings already applied (cannot be changed after first use)
        // - conflicting long-polling flags from older cached code (now mitigated by explicit false)
        console.warn("Firestore transport settings could not be applied:", e);
        window.__FIRESTORE_SETTINGS_APPLIED__ = true;
    }
}

// GitHub Pages mode
if (isGithubPages) {
    // Keep Firebase online mode on production; realtime listeners are gated in firebase-data.js.
    console.log("GitHub Pages detected - Firebase online mode enabled");
} else {
    console.log("Firebase initialized");
}
