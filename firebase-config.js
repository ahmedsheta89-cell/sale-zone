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

function parseOptionalBooleanFlag(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
    if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
    return null;
}

function resolveFirestoreTransportPolicy() {
    const queryForcePoll = parseOptionalBooleanFlag(urlParams.get("forcepoll"));
    if (queryForcePoll !== null) {
        return { forceLongPolling: queryForcePoll, source: "query:forcepoll" };
    }

    // Backward compatibility with old links that use ?lp=1 / ?lp=0.
    const legacyLongPolling = parseOptionalBooleanFlag(urlParams.get("lp"));
    if (legacyLongPolling !== null) {
        return { forceLongPolling: legacyLongPolling, source: "query:lp" };
    }

    if (typeof window.FORCE_FIRESTORE_FORCE_LONG_POLLING === "boolean") {
        return {
            forceLongPolling: window.FORCE_FIRESTORE_FORCE_LONG_POLLING === true,
            source: "window-flag"
        };
    }

    if (isLocalDev) {
        return { forceLongPolling: true, source: "local-default" };
    }

    return { forceLongPolling: false, source: "default" };
}

const transportPolicy = resolveFirestoreTransportPolicy();
const forcePollingTransport = transportPolicy.forceLongPolling === true;
const shouldApplyStableTransport = forcePollingTransport;

window.__FIRESTORE_TRANSPORT_POLICY__ = {
    host: hostname,
    isLocalDev,
    isGithubPages,
    forceLongPolling: forcePollingTransport,
    source: transportPolicy.source
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore
const db = firebase.firestore();

// Reduce Firestore SDK noise in production consoles (transport retries are handled internally).
try {
    if (firebase && firebase.firestore && typeof firebase.firestore.setLogLevel === "function") {
        firebase.firestore.setLogLevel("error");
    }
} catch (_) {}

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
        const normalizedReason = String(reason || "").toLowerCase();
        const settingsAlreadyLocked =
            normalizedReason.includes("settings can no longer be changed") ||
            normalizedReason.includes("already been started") ||
            normalizedReason.includes("already started") ||
            normalizedReason.includes("must be set before any other methods") ||
            normalizedReason.includes("cannot be changed once you've started using cloud firestore");

        console.warn("Firestore transport settings could not be applied (non-fatal):", reason);
        // Mark as applied only when Firestore is already locked in this page lifecycle.
        window.__FIRESTORE_SETTINGS_APPLIED__ = settingsAlreadyLocked;
        window.__FIRESTORE_STABLE_TRANSPORT_ERROR__ = reason;
    }
}

// GitHub Pages mode
if (isGithubPages) {
    // Keep Firebase online mode on production; realtime listeners are gated in firebase-data.js.
    if (forcePollingTransport) {
        console.log(`GitHub Pages detected - Firebase online mode enabled (forced long-polling via ${transportPolicy.source})`);
    } else {
        console.log("GitHub Pages detected - Firebase online mode enabled");
    }
} else {
    if (forcePollingTransport) {
        console.log(`Firebase initialized (forced long-polling via ${transportPolicy.source})`);
    } else {
        console.log("Firebase initialized");
    }
}
