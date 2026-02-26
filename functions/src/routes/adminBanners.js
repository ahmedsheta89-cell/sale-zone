const express = require('express');
const { listCollectionPage } = require('../lib/firestoreRepo');
const { buildBannerPayload, parseLimit, toTrimmedString } = require('../lib/validators');

function attachPublicBannerReadRoutes(router, { db }) {
  router.get('/banners', async (req, res, next) => {
    try {
      const page = await listCollectionPage(db.collection('banners'), {
        limit: parseLimit(req.query.limit, { min: 1, max: 100, fallback: 20 }),
        cursor: req.query.cursor
      });
      return res.json({ ok: true, data: page, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });
}

function createAdminBannersRouter({ db, logging }) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const page = await listCollectionPage(db.collection('banners'), {
        limit: parseLimit(req.query.limit, { min: 1, max: 200, fallback: 50 }),
        cursor: req.query.cursor
      });
      return res.json({ ok: true, data: page, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const payload = buildBannerPayload(req.body || {}, {});
      const ref = await db.collection('banners').add(payload);
      await logging.adminActivity(req, {
        action: 'BANNER_CREATED',
        targetId: ref.id,
        details: { title: payload.title }
      });
      return res.status(201).json({ ok: true, data: { id: ref.id, ...payload }, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const id = toTrimmedString(req.params.id);
      if (!id) {
        return res.status(400).json({
          ok: false,
          error: { code: 'validation/invalid-id', message: 'Banner id is required.' },
          requestId: req.requestId
        });
      }

      const ref = db.collection('banners').doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        return res.status(404).json({
          ok: false,
          error: { code: 'not-found/banner', message: 'Banner not found.' },
          requestId: req.requestId
        });
      }

      const payload = buildBannerPayload(req.body || {}, { existing: snapshot.data() || {} });
      await ref.set(payload, { merge: true });
      await logging.adminActivity(req, {
        action: 'BANNER_UPDATED',
        targetId: id,
        details: { title: payload.title }
      });
      return res.json({ ok: true, data: { id, ...payload }, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = toTrimmedString(req.params.id);
      if (!id) {
        return res.status(400).json({
          ok: false,
          error: { code: 'validation/invalid-id', message: 'Banner id is required.' },
          requestId: req.requestId
        });
      }

      await db.collection('banners').doc(id).delete();
      await logging.adminActivity(req, {
        action: 'BANNER_DELETED',
        targetId: id
      });
      return res.json({ ok: true, data: { id }, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  attachPublicBannerReadRoutes,
  createAdminBannersRouter
};
