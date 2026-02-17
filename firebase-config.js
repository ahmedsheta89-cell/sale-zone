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

    if (isGithubPages) {
        return { forceLongPolling: true, source: "github-pages-default" };
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

function resolveAppCheckSiteKey() {
    if (typeof window.FIREBASE_APP_CHECK_SITE_KEY === 'string' && window.FIREBASE_APP_CHECK_SITE_KEY.trim()) {
        return window.FIREBASE_APP_CHECK_SITE_KEY.trim();
    }

    const meta = document.querySelector('meta[name="firebase-app-check-site-key"]');
    const keyFromMeta = meta && meta.getAttribute('content') ? String(meta.getAttribute('content')).trim() : '';
    if (keyFromMeta) return keyFromMeta;

    return '';
}

function setupFirebaseAppCheck() {
    try {
        if (!(firebase && typeof firebase.appCheck === 'function')) {
            window.__FIREBASE_APP_CHECK_ACTIVE__ = false;
            window.__FIREBASE_APP_CHECK_REASON__ = 'sdk-missing';
            return;
        }

        const appCheckKey = resolveAppCheckSiteKey();
        if (!appCheckKey) {
            window.__FIREBASE_APP_CHECK_ACTIVE__ = false;
            window.__FIREBASE_APP_CHECK_REASON__ = 'site-key-missing';
            console.info('[INFO] Firebase App Check not activated (missing site key).');
            return;
        }

        const appCheck = firebase.appCheck();
        appCheck.activate(appCheckKey, true);
        window.__FIREBASE_APP_CHECK_ACTIVE__ = true;
        window.__FIREBASE_APP_CHECK_REASON__ = 'active';
        console.log('[OK] Firebase App Check activated');
    } catch (error) {
        window.__FIREBASE_APP_CHECK_ACTIVE__ = false;
        window.__FIREBASE_APP_CHECK_REASON__ = error && error.message ? String(error.message) : 'unknown';
        console.warn('Firebase App Check activation warning:', window.__FIREBASE_APP_CHECK_REASON__);
    }
}

function setupFirestoreAutoReconnect() {
    if (window.__FIRESTORE_AUTO_RECONNECT_READY__) return;
    window.__FIRESTORE_AUTO_RECONNECT_READY__ = true;

    const autoToggleOverride = parseOptionalBooleanFlag(urlParams.get('firestore_auto_toggle'));
    const shouldUseAutoNetworkToggle = autoToggleOverride !== null
        ? autoToggleOverride === true
        : (isGithubPages !== true && forcePollingTransport !== true);

    let enableInFlight = false;
    let disableInFlight = false;
    let networkState = navigator.onLine === false ? 'disabled' : 'enabled';
    let reconnectLocked = false;
    let lastEnableAttemptAt = 0;
    let networkDisabledByApp = false;
    const MIN_ENABLE_RETRY_MS = 15000;

    const safeEnableNetwork = async (source = 'manual', options = {}) => {
        const force = options && options.force === true;
        const automaticSource = source === 'online' || source === 'interval';
        if (automaticSource && !shouldUseAutoNetworkToggle && !force) {
            return { ok: false, skipped: 'auto-toggle-disabled' };
        }
        if (!networkDisabledByApp && !force) {
            return { ok: true, skipped: 'never-disabled' };
        }
        if (reconnectLocked && !force) return { ok: false, skipped: 'locked' };
        if (networkState === 'enabled' && !force) return { ok: true, skipped: 'already-enabled' };
        if (enableInFlight) return { ok: false, skipped: 'enable-in-flight' };

        const now = Date.now();
        if (!force && (now - lastEnableAttemptAt) < MIN_ENABLE_RETRY_MS) {
            return { ok: false, skipped: 'throttled' };
        }

        enableInFlight = true;
        lastEnableAttemptAt = now;
        try {
            if (typeof db.enableNetwork === 'function') {
                await db.enableNetwork();
            }
            networkState = 'enabled';
            networkDisabledByApp = false;
            window.__FIRESTORE_LAST_ENABLE_NETWORK_SOURCE__ = source;
            return { ok: true };
        } catch (error) {
            const message = error && error.message ? String(error.message) : String(error || '');
            if (/internal assertion failed/i.test(message)) {
                reconnectLocked = true;
                networkDisabledByApp = false;
                window.__FIRESTORE_AUTO_RECONNECT_LOCK_REASON__ = message;
                console.warn('[WARN] Firestore auto-reconnect paused due to SDK internal assertion. Reload page to recover cleanly.');
                return { ok: false, locked: true, error: message };
            }
            if (/already enabled/i.test(message)) {
                networkState = 'enabled';
                return { ok: true, skipped: 'already-enabled' };
            }
            if (!/already enabled/i.test(message)) {
                console.warn(`[WARN] Firestore enableNetwork failed (${source}):`, message);
            }
            return { ok: false, error: message };
        } finally {
            enableInFlight = false;
        }
    };

    const safeDisableNetwork = async (source = 'manual') => {
        const automaticSource = source === 'offline';
        if (automaticSource && !shouldUseAutoNetworkToggle) {
            return { ok: false, skipped: 'auto-toggle-disabled' };
        }
        if (disableInFlight) return { ok: false, skipped: 'disable-in-flight' };
        if (networkState === 'disabled') return { ok: true, skipped: 'already-disabled' };
        disableInFlight = true;
        try {
            if (typeof db.disableNetwork === 'function') {
                await db.disableNetwork();
            }
            networkState = 'disabled';
            networkDisabledByApp = true;
            window.__FIRESTORE_LAST_DISABLE_NETWORK_SOURCE__ = source;
            return { ok: true };
        } catch (error) {
            const message = error && error.message ? String(error.message) : String(error || '');
            if (/already disabled/i.test(message)) {
                networkState = 'disabled';
                return { ok: true, skipped: 'already-disabled' };
            }
            if (!/already disabled/i.test(message)) {
                console.warn(`[WARN] Firestore disableNetwork failed (${source}):`, message);
            }
            return { ok: false, error: message };
        } finally {
            disableInFlight = false;
        }
    };

    window.addEventListener('offline', () => {
        if (shouldUseAutoNetworkToggle) {
            safeDisableNetwork('offline').catch(() => null);
        }
    });

    window.addEventListener('online', () => {
        if (shouldUseAutoNetworkToggle) {
            safeEnableNetwork('online').catch(() => null);
        }
        if (typeof window.flushOrderQueue === 'function') {
            window.flushOrderQueue({ source: 'firestore-online', maxItems: 20 }).catch(() => null);
        }
    });

    // Do NOT force-enable Firestore on a timer by default.
    // Repeated enableNetwork() calls can destabilize some browsers/SDK states on long-polling transport.
    const intervalReconnectRequested = parseOptionalBooleanFlag(urlParams.get('firestore_reconnect_interval')) === true
        || window.__FIRESTORE_ENABLE_NETWORK_INTERVAL__ === true;
    const allowIntervalReconnect = intervalReconnectRequested === true
        && isGithubPages !== true
        && forcePollingTransport !== true;
    if (intervalReconnectRequested === true && allowIntervalReconnect !== true) {
        console.info('[INFO] Firestore interval reconnect override ignored for GitHub Pages/long-polling mode.');
    }
    if (allowIntervalReconnect) {
        setInterval(() => {
            if (navigator.onLine === false) return;
            safeEnableNetwork('interval').catch(() => null);
        }, 120000);
        console.log('[INFO] Firestore interval reconnect watchdog enabled (override mode).');
    }
    if (!shouldUseAutoNetworkToggle) {
        console.info('[INFO] Firestore auto network toggles disabled for stability (GitHub Pages/long-polling policy).');
    }

    window.__FIRESTORE_SAFE_ENABLE_NETWORK__ = safeEnableNetwork;
    window.__FIRESTORE_SAFE_DISABLE_NETWORK__ = safeDisableNetwork;
    window.__FIRESTORE_AUTO_NETWORK_TOGGLE_ALLOWED__ = shouldUseAutoNetworkToggle;
}

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

setupFirebaseAppCheck();
setupFirestoreAutoReconnect();
