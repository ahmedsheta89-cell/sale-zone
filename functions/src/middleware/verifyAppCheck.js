function readAppCheckHeader(req) {
  return String(
    req.headers['x-firebase-appcheck']
      || req.headers['x-firebase-app-check']
      || req.headers['x-app-check']
      || ''
  ).trim();
}

function isAppCheckEnforced() {
  const value = String(process.env.APP_CHECK_ENFORCE || 'true').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(value);
}

function createVerifyAppCheck({ admin, logging }) {
  return async function verifyAppCheck(req, res, next) {
    if (!isAppCheckEnforced()) return next();

    const token = readAppCheckHeader(req);
    if (!token) {
      await logging.suspicious(req, {
        type: 'APP_CHECK_MISSING',
        message: 'Missing App Check token.'
      });
      return res.status(401).json({
        ok: false,
        error: { code: 'app-check/missing-token', message: 'Missing App Check token.' },
        requestId: req.requestId
      });
    }

    try {
      const decoded = await admin.appCheck().verifyToken(token);
      req.appCheck = decoded;
      return next();
    } catch (error) {
      await logging.suspicious(req, {
        type: 'APP_CHECK_INVALID',
        message: String(error && error.message || 'invalid app check token')
      });
      return res.status(403).json({
        ok: false,
        error: { code: 'app-check/invalid-token', message: 'Invalid App Check token.' },
        requestId: req.requestId
      });
    }
  };
}

module.exports = {
  createVerifyAppCheck
};
