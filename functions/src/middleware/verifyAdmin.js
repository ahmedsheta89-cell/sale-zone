function hasAdminClaim(user) {
  if (!user || typeof user !== 'object') return false;
  return user.admin === true || user.role === 'admin';
}

function createLiveClaimsResolver({ admin, cacheMs = 30000 }) {
  const cache = new Map();

  return async function resolveLiveClaims(uid) {
    const safeUid = String(uid || '').trim();
    if (!safeUid) return {};

    const now = Date.now();
    const existing = cache.get(safeUid);
    if (existing && now - existing.storedAt <= cacheMs) {
      return existing.claims;
    }

    const user = await admin.auth().getUser(safeUid);
    const claims = user && user.customClaims && typeof user.customClaims === 'object'
      ? user.customClaims
      : {};

    cache.set(safeUid, {
      claims,
      storedAt: now
    });

    return claims;
  };
}

function createVerifyAdmin({ logging, admin }) {
  const cacheMsRaw = Number(process.env.ADMIN_CLAIMS_CACHE_MS || 30000);
  const cacheMs = Number.isFinite(cacheMsRaw) ? Math.max(0, Math.min(120000, cacheMsRaw)) : 30000;
  const resolveLiveClaims = createLiveClaimsResolver({ admin, cacheMs });

  return async function verifyAdmin(req, res, next) {
    const uid = String(req.user && req.user.uid || '');
    const tokenClaims = req.user && typeof req.user === 'object' ? req.user : {};

    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: { code: 'auth/invalid-token', message: 'Authentication failed.' },
        requestId: req.requestId
      });
    }

    try {
      const liveClaims = await resolveLiveClaims(uid);
      const liveAdmin = hasAdminClaim(liveClaims);
      const tokenAdmin = hasAdminClaim(tokenClaims);

      if (!liveAdmin && tokenAdmin) {
        await logging.suspicious(req, {
          type: 'ADMIN_STALE_TOKEN_BLOCKED',
          uid,
          message: 'Token has admin claim but live claims no longer grant admin.'
        });
      }

      if (liveAdmin) return next();

      await logging.suspicious(req, {
        type: 'ADMIN_ROUTE_FORBIDDEN',
        uid,
        message: 'Non-admin attempted admin endpoint access.'
      });

      return res.status(403).json({
        ok: false,
        error: { code: 'auth/admin-required', message: 'Admin privileges are required.' },
        requestId: req.requestId
      });
    } catch (error) {
      await logging.suspicious(req, {
        type: 'ADMIN_VERIFY_FAILED',
        uid,
        message: String(error && error.message || 'admin verification failed')
      });

      return res.status(403).json({
        ok: false,
        error: { code: 'auth/admin-required', message: 'Admin privileges are required.' },
        requestId: req.requestId
      });
    }
  };
}

module.exports = {
  createVerifyAdmin,
  hasAdminClaim
};
