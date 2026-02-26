const express = require('express');
const cors = require('cors');

const { createVerifyAuth } = require('./middleware/verifyAuth');
const { createVerifyAdmin } = require('./middleware/verifyAdmin');
const { createVerifyAppCheck } = require('./middleware/verifyAppCheck');
const { createRateLimiter } = require('./middleware/rateLimit');

const { createAdminProductsRouter, attachPublicProductReadRoutes } = require('./routes/adminProducts');
const { createAdminBannersRouter, attachPublicBannerReadRoutes } = require('./routes/adminBanners');
const { createAdminCouponsRouter, attachPublicCouponReadRoutes } = require('./routes/adminCoupons');
const { createAdminSettingsRouter, createAdminCountdownRouter } = require('./routes/adminSettings');
const { createOrdersRouter, createAdminOrdersRouter } = require('./routes/orders');
const { createMediaRouter } = require('./routes/media');

function createRequestId(req, _res, next) {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  req.requestId = incoming || `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  next();
}

function toPublicErrorMessage(code, fallbackMessage) {
  const safeCode = String(code || 'internal/error');
  if (safeCode.startsWith('validation/')) return String(fallbackMessage || 'Request validation failed.');
  if (safeCode.startsWith('auth/')) return String(fallbackMessage || 'Authentication failed.');
  if (safeCode.startsWith('app-check/')) return String(fallbackMessage || 'App Check verification failed.');
  if (safeCode.startsWith('rate-limit/')) return String(fallbackMessage || 'Too many requests.');
  if (safeCode.startsWith('abuse/')) return String(fallbackMessage || 'Request blocked by abuse protection.');
  return 'Request failed.';
}

function createApp(deps) {
  const {
    admin,
    db,
    logging,
    secretsProvider
  } = deps;

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(createRequestId);

  const verifyAppCheck = createVerifyAppCheck({ admin, logging });
  const verifyAuth = createVerifyAuth({ admin, logging });
  const verifyAdmin = createVerifyAdmin({ logging, admin });

  // Trust boundary contract:
  // - Browser is untrusted input surface.
  // - `/v1/admin/*`, `/v1/orders`, `/v1/media/*` are backend security boundaries.
  // - All business writes must pass App Check + Auth + route-specific authorization + rate limiting.
  const adminRateLimiter = createRateLimiter({
    logging,
    db,
    mode: 'firestore',
    max: 90,
    windowMs: 60 * 1000
  });
  const ordersRateLimiter = createRateLimiter({
    logging,
    db,
    mode: 'firestore',
    max: 30,
    windowMs: 60 * 1000
  });
  const mediaRateLimiter = createRateLimiter({
    logging,
    db,
    mode: 'firestore',
    max: 10,
    windowMs: 60 * 1000
  });

  app.get('/v1/health', (_req, res) => {
    res.json({ ok: true, data: { status: 'healthy', service: 'sale-zone-api' } });
  });

  attachPublicProductReadRoutes(app, { db });
  attachPublicBannerReadRoutes(app, { db });
  attachPublicCouponReadRoutes(app, { db });

  const adminRouter = express.Router();
  adminRouter.use(verifyAppCheck, verifyAuth, verifyAdmin, adminRateLimiter);
  adminRouter.use('/products', createAdminProductsRouter({ db, logging }));
  adminRouter.use('/banners', createAdminBannersRouter({ db, logging }));
  adminRouter.use('/coupons', createAdminCouponsRouter({ db, logging }));
  adminRouter.use('/settings', createAdminSettingsRouter({ db, logging }));
  adminRouter.use('/countdown', createAdminCountdownRouter({ db, logging }));
  adminRouter.use('/orders', createAdminOrdersRouter({ db, logging }));
  app.use('/v1/admin', adminRouter);
  app.use('/admin/countdown', verifyAppCheck, verifyAuth, verifyAdmin, adminRateLimiter, createAdminCountdownRouter({ db, logging }));

  app.use('/v1/orders', verifyAppCheck, verifyAuth, ordersRateLimiter, createOrdersRouter({ db, logging }));
  app.use('/v1/media', verifyAppCheck, verifyAuth, verifyAdmin, mediaRateLimiter, createMediaRouter({ db, logging, secretsProvider }));

  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      error: { code: 'http/not-found', message: 'Endpoint not found.' },
      requestId: req.requestId
    });
  });

  app.use((error, req, res, _next) => {
    const code = String(error && error.code || 'internal/error');
    const status = Number(error && error.status) || (
      code.startsWith('validation/') ? 400 : (
        code.startsWith('auth/') ? 401 : (
          code.startsWith('app-check/') ? 403 : (
            code.startsWith('rate-limit/') || code.startsWith('abuse/') ? 429 : 500
          )
        )
      )
    );

    const internalMessage = String(error && error.message || 'Internal server error.');
    const message = toPublicErrorMessage(code, internalMessage);

    logging.error('API_ROUTE_ERROR', {
      requestId: req.requestId,
      route: String(req && req.originalUrl || ''),
      method: String(req && req.method || ''),
      uid: String(req && req.user && req.user.uid || ''),
      code,
      internalMessage
    });

    res.status(status).json({
      ok: false,
      error: { code, message },
      requestId: req.requestId
    });
  });

  return app;
}

module.exports = {
  createApp
};
