(function (global) {
  'use strict';

  if (global.logger && global.logger.__isCentralLogger === true) {
    return;
  }

  var state = {
    release: 'unknown',
    sha: 'unknown',
    environment: detectEnvironment(),
    handlersAttached: false,
    remoteThrottleMs: 5000,
    lastRemoteKey: '',
    lastRemoteAt: 0
  };

  function detectEnvironment() {
    try {
      var host = String((global.location && global.location.hostname) || '').toLowerCase();
      if (!host) return 'unknown';
      if (host === 'localhost' || host === '127.0.0.1') return 'development';
      if (host.indexOf('github.io') !== -1) return 'production';
      return 'staging';
    } catch (_) {
      return 'unknown';
    }
  }

  function normalizeMeta(metadata) {
    if (typeof metadata === 'undefined' || metadata === null) return {};
    if (metadata instanceof Error) {
      return {
        name: metadata.name || 'Error',
        message: metadata.message || String(metadata),
        stack: metadata.stack || ''
      };
    }
    if (typeof metadata === 'object') return metadata;
    return { value: String(metadata) };
  }

  function resolveUserId() {
    try {
      if (global.firebase && typeof global.firebase.auth === 'function') {
        var auth = global.firebase.auth();
        var user = auth && auth.currentUser ? auth.currentUser : null;
        if (user && user.uid) return String(user.uid);
      }
    } catch (_) {}
    return '';
  }

  function buildEntry(level, code, message, context, metadata) {
    var safeLevel = String(level || 'info').toLowerCase();
    if (['debug', 'info', 'warn', 'error'].indexOf(safeLevel) === -1) safeLevel = 'info';

    var safeCode = String(code || 'APP_EVENT').trim().toUpperCase();
    var safeMessage = String(message || safeCode).trim();
    var safeContext = String(context || 'app').trim().toLowerCase();
    var safeMeta = normalizeMeta(metadata);

    return {
      level: safeLevel,
      code: safeCode,
      message: safeMessage,
      context: safeContext,
      metadata: safeMeta,
      timestamp: new Date().toISOString(),
      release: state.release,
      environment: state.environment,
      sha: state.sha,
      userId: resolveUserId(),
      page: String((global.location && global.location.pathname) || ''),
      href: String((global.location && global.location.href) || '')
    };
  }

  function writeConsole(entry) {
    try {
      var method = entry.level;
      var writer = (console && typeof console[method] === 'function') ? console[method].bind(console) : console.log.bind(console);
      writer('[' + entry.code + '] ' + entry.message, entry);
    } catch (_) {
      // Never throw from logger.
    }
  }

  function shouldThrottleRemote(entry) {
    var key = entry.code + '|' + entry.message + '|' + entry.context;
    var now = Date.now();
    if (state.lastRemoteKey === key && (now - state.lastRemoteAt) < state.remoteThrottleMs) {
      return true;
    }
    state.lastRemoteKey = key;
    state.lastRemoteAt = now;
    return false;
  }

  async function sendRemoteError(entry) {
    try {
      if (entry.level !== 'error') return;
      if (shouldThrottleRemote(entry)) return;
      if (typeof global.addClientErrorLog !== 'function') return;

      var payload = {
        error: {
          type: entry.code,
          message: entry.message,
          stack: String(entry.metadata && entry.metadata.stack ? entry.metadata.stack : ''),
          source: entry.context,
          timestamp: entry.timestamp
        },
        context: {
          page: entry.page,
          href: entry.href,
          userAgent: String((global.navigator && global.navigator.userAgent) || ''),
          language: String((global.navigator && global.navigator.language) || ''),
          online: (global.navigator && typeof global.navigator.onLine === 'boolean') ? global.navigator.onLine : null,
          logger: {
            release: entry.release,
            environment: entry.environment,
            sha: entry.sha,
            userId: entry.userId,
            metadata: entry.metadata
          }
        }
      };

      await global.addClientErrorLog(payload);
    } catch (_) {
      // Never throw from logger.
    }
  }

  function emit(level, code, message, context, metadata) {
    try {
      var entry = buildEntry(level, code, message, context, metadata);
      writeConsole(entry);
      if (entry.level === 'error') {
        Promise.resolve().then(function () {
          return sendRemoteError(entry);
        }).catch(function () {
          return null;
        });
      }
      return entry;
    } catch (_) {
      try {
        console.error('[LOGGER_INTERNAL_FAILURE] Logger emit failed');
      } catch (__unused) {}
      return null;
    }
  }

  function attachGlobalHandlers() {
    if (state.handlersAttached) return;
    state.handlersAttached = true;

    try {
      global.addEventListener('error', function (event) {
        var err = event && event.error ? event.error : null;
        emit(
          'error',
          'UNHANDLED_RUNTIME_ERROR',
          String((event && event.message) || 'Unhandled runtime error'),
          'global.window_error',
          {
            source: String((event && event.filename) || ''),
            lineno: event && event.lineno ? Number(event.lineno) : 0,
            colno: event && event.colno ? Number(event.colno) : 0,
            stack: err && err.stack ? String(err.stack) : ''
          }
        );
      }, true);

      global.addEventListener('unhandledrejection', function (event) {
        var reason = event && typeof event.reason !== 'undefined' ? event.reason : null;
        var reasonMessage = (reason && reason.message) ? reason.message : String(reason || 'Unhandled promise rejection');
        emit(
          'error',
          'UNHANDLED_PROMISE_REJECTION',
          String(reasonMessage),
          'global.unhandled_rejection',
          {
            stack: reason && reason.stack ? String(reason.stack) : ''
          }
        );
      }, true);
    } catch (_) {
      // Never throw from logger.
    }
  }

  async function hydrateReleaseInfo() {
    try {
      var res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res || !res.ok) return;
      var data = await res.json();
      if (data && data.version) state.release = String(data.version).trim() || state.release;
      if (data && data.sha) state.sha = String(data.sha).trim() || state.sha;
    } catch (_) {
      // Never throw from logger.
    }
  }

  var logger = {
    __isCentralLogger: true,
    info: function (code, message, context, metadata) { return emit('info', code, message, context, metadata); },
    warn: function (code, message, context, metadata) { return emit('warn', code, message, context, metadata); },
    error: function (code, message, context, metadata) { return emit('error', code, message, context, metadata); },
    debug: function (code, message, context, metadata) { return emit('debug', code, message, context, metadata); },
    setReleaseInfo: function (release, sha) {
      try {
        if (release) state.release = String(release).trim();
        if (sha) state.sha = String(sha).trim();
      } catch (_) {}
    },
    getState: function () {
      return {
        release: state.release,
        sha: state.sha,
        environment: state.environment
      };
    }
  };

  global.logger = logger;
  global.CentralLogger = logger;

  attachGlobalHandlers();
  hydrateReleaseInfo();
})(window);