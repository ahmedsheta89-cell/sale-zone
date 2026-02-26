function extractBearerToken(req) {
  const header = String(req.headers.authorization || '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

function createVerifyAuth({ admin, logging }) {
  return async function verifyAuth(req, res, next) {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        await logging.authFailed(req, { reason: 'missing-authorization-header' });
        return res.status(401).json({
          ok: false,
          error: { code: 'auth/missing-token', message: 'Missing Authorization Bearer token.' },
          requestId: req.requestId
        });
      }

      const decoded = await admin.auth().verifyIdToken(token, true);
      if (!decoded || !decoded.uid) {
        await logging.authFailed(req, { reason: 'token-decoding-failed' });
        return res.status(401).json({
          ok: false,
          error: { code: 'auth/invalid-token', message: 'Invalid authentication token.' },
          requestId: req.requestId
        });
      }

      if (decoded.email_verified !== true) {
        await logging.authFailed(req, { reason: 'email-not-verified', uid: decoded.uid });
        return res.status(403).json({
          ok: false,
          error: { code: 'auth/email-not-verified', message: 'Email must be verified.' },
          requestId: req.requestId
        });
      }

      req.user = decoded;
      return next();
    } catch (error) {
      await logging.authFailed(req, {
        reason: 'verify-id-token-error',
        message: String(error && error.message || 'unknown')
      });
      return res.status(401).json({
        ok: false,
        error: { code: 'auth/invalid-token', message: 'Authentication failed.' },
        requestId: req.requestId
      });
    }
  };
}

module.exports = {
  createVerifyAuth
};
