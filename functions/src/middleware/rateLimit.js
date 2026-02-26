function createMemoryRateLimitStore() {
  const buckets = new Map();

  function cleanup(nowMs) {
    for (const [key, state] of buckets.entries()) {
      if (!state || nowMs - state.windowStart > state.windowMs * 2) {
        buckets.delete(key);
      }
    }
  }

  function hit(key, max, windowMs) {
    const nowMs = Date.now();
    const bucketKey = String(key || 'anonymous');
    const current = buckets.get(bucketKey);
    if (!current || nowMs - current.windowStart >= windowMs) {
      buckets.set(bucketKey, {
        count: 1,
        windowStart: nowMs,
        windowMs
      });
      cleanup(nowMs);
      return { allowed: true, count: 1, resetAtMs: nowMs + windowMs };
    }

    current.count += 1;
    buckets.set(bucketKey, current);
    cleanup(nowMs);
    return {
      allowed: current.count <= max,
      count: current.count,
      resetAtMs: current.windowStart + windowMs
    };
  }

  return { hit };
}

function createFirestoreRateLimitStore(db) {
  return {
    async hit(key, max, windowMs) {
      const nowMs = Date.now();
      const bucketKey = String(key || 'anonymous').slice(0, 260);
      const ref = db.collection('rate_limit_buckets').doc(bucketKey.replace(/[^a-zA-Z0-9:_-]/g, '_'));

      return db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const current = snapshot.exists ? (snapshot.data() || {}) : null;

        if (!current || nowMs - Number(current.windowStart || 0) >= windowMs) {
          tx.set(ref, {
            key: bucketKey,
            count: 1,
            windowStart: nowMs,
            windowMs,
            updatedAt: new Date(nowMs),
            expiresAt: new Date(nowMs + windowMs * 3)
          }, { merge: true });

          return {
            allowed: true,
            count: 1,
            resetAtMs: nowMs + windowMs
          };
        }

        const count = Number(current.count || 0) + 1;
        tx.set(ref, {
          key: bucketKey,
          count,
          windowStart: Number(current.windowStart || nowMs),
          windowMs,
          updatedAt: new Date(nowMs),
          expiresAt: new Date(nowMs + windowMs * 3)
        }, { merge: true });

        return {
          allowed: count <= max,
          count,
          resetAtMs: Number(current.windowStart || nowMs) + windowMs
        };
      });
    }
  };
}

function createRateLimiter({ logging, db = null, mode = '', max = 60, windowMs = 60 * 1000, keyFn }) {
  const normalizedMode = String(mode || process.env.RATE_LIMIT_MODE || 'firestore').trim().toLowerCase();
  const useDistributed = normalizedMode !== 'memory' && db && typeof db.collection === 'function';
  const store = useDistributed ? createFirestoreRateLimitStore(db) : createMemoryRateLimitStore();

  return async function rateLimit(req, res, next) {
    const uid = String(req.user && req.user.uid || '');
    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
    const routeKey = String(req.baseUrl || req.path || req.originalUrl || 'route');
    const dynamicKey = typeof keyFn === 'function' ? keyFn(req) : '';
    const key = (dynamicKey || `${routeKey}:${uid || ip}`).slice(0, 280);

    const result = await store.hit(key, max, windowMs);
    if (result.allowed) {
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - result.count)));
      res.setHeader('X-RateLimit-Reset', String(result.resetAtMs || 0));
      return next();
    }

    await logging.suspicious(req, {
      type: 'RATE_LIMIT_BLOCK',
      route: routeKey,
      uid,
      ip,
      count: result.count,
      windowMs,
      max,
      distributed: useDistributed
    });

    return res.status(429).json({
      ok: false,
      error: { code: 'rate-limit/exceeded', message: 'Too many requests. Try again later.' },
      requestId: req.requestId
    });
  };
}

module.exports = {
  createRateLimiter
};
