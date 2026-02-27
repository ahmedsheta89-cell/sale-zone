const { FieldValue } = require('firebase-admin/firestore');

function nowIso() {
  return new Date().toISOString();
}

function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function pickRequestId(req) {
  return safeString(req && req.requestId, `req_${Date.now()}`);
}

function pickIp(req) {
  const forwarded = safeString(req && req.headers && req.headers['x-forwarded-for'], '').split(',')[0].trim();
  if (forwarded) return forwarded;
  return safeString(req && req.ip, 'unknown');
}

function pickRetentionDays() {
  const raw = Number(process.env.LOG_RETENTION_DAYS || 30);
  if (!Number.isFinite(raw)) return 30;
  return Math.max(7, Math.min(365, Math.floor(raw)));
}

function writeStructured(severity, code, metadata = {}) {
  const payload = {
    severity,
    code,
    timestamp: nowIso(),
    ...metadata
  };
  const line = JSON.stringify(payload);
  if (severity === 'ERROR') {
    console.error(line);
    return;
  }
  if (severity === 'WARNING') {
    console.warn(line);
    return;
  }
  console.log(line);
}

async function writeCollectionLog(db, collectionName, doc = {}) {
  if (!db) return;
  const retentionDays = pickRetentionDays();
  await db.collection(collectionName).add({
    ...doc,
    retentionDays,
    expiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
    createdAt: FieldValue.serverTimestamp()
  });
}

function createLogging({ db }) {
  return {
    info(code, metadata = {}) {
      writeStructured('INFO', code, metadata);
    },
    warn(code, metadata = {}) {
      writeStructured('WARNING', code, metadata);
    },
    error(code, metadata = {}) {
      writeStructured('ERROR', code, metadata);
    },
    async adminActivity(req, details = {}) {
      try {
        await writeCollectionLog(db, 'admin_activity_logs', {
          requestId: pickRequestId(req),
          uid: safeString(req && req.user && req.user.uid, ''),
          route: safeString(req && req.originalUrl, ''),
          method: safeString(req && req.method, ''),
          ip: pickIp(req),
          userAgent: safeString(req && req.headers && req.headers['user-agent'], ''),
          ...details
        });
      } catch (error) {
        writeStructured('WARNING', 'ADMIN_ACTIVITY_LOG_WRITE_FAILED', {
          message: safeString(error && error.message, 'unknown')
        });
      }
    },
    async suspicious(req, details = {}) {
      try {
        await writeCollectionLog(db, 'suspicious_activity_logs', {
          requestId: pickRequestId(req),
          uid: safeString(req && req.user && req.user.uid, ''),
          route: safeString(req && req.originalUrl, ''),
          method: safeString(req && req.method, ''),
          ip: pickIp(req),
          userAgent: safeString(req && req.headers && req.headers['user-agent'], ''),
          ...details
        });
      } catch (error) {
        writeStructured('WARNING', 'SUSPICIOUS_LOG_WRITE_FAILED', {
          message: safeString(error && error.message, 'unknown')
        });
      }
    },
    async authFailed(req, details = {}) {
      try {
        await writeCollectionLog(db, 'auth_failed_attempts', {
          requestId: pickRequestId(req),
          route: safeString(req && req.originalUrl, ''),
          method: safeString(req && req.method, ''),
          ip: pickIp(req),
          userAgent: safeString(req && req.headers && req.headers['user-agent'], ''),
          ...details
        });
      } catch (error) {
        writeStructured('WARNING', 'AUTH_FAILED_LOG_WRITE_FAILED', {
          message: safeString(error && error.message, 'unknown')
        });
      }
    }
  };
}

module.exports = {
  createLogging
};
