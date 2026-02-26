const express = require('express');
const { listCollectionPage } = require('../lib/firestoreRepo');
const { buildProductPayload, parseLimit, toTrimmedString } = require('../lib/validators');

function normalizeSearchToken(input) {
  const token = toTrimmedString(input).toLowerCase();
  if (!token) return '';
  return token.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 64);
}

function attachPublicProductReadRoutes(router, { db }) {
  router.get('/products', async (req, res, next) => {
    try {
      const category = toTrimmedString(req.query.category);
      const q = normalizeSearchToken(req.query.q);
      const where = [{ field: 'isPublished', op: '==', value: true }];
      if (category) where.push({ field: 'category', op: '==', value: category });
      if (q) where.push({ field: 'searchTokens', op: 'array-contains', value: q });

      const page = await listCollectionPage(db.collection('products'), {
        limit: parseLimit(req.query.limit, { min: 1, max: 200, fallback: 30 }),
        cursor: req.query.cursor,
        where
      });

      return res.json({ ok: true, data: page, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });
}

function createAdminProductsRouter({ db, logging }) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const category = toTrimmedString(req.query.category);
      const q = normalizeSearchToken(req.query.q);
      const isPublishedRaw = toTrimmedString(req.query.isPublished);
      const where = [];
      if (category) where.push({ field: 'category', op: '==', value: category });
      if (q) where.push({ field: 'searchTokens', op: 'array-contains', value: q });
      if (isPublishedRaw === 'true' || isPublishedRaw === 'false') {
        where.push({ field: 'isPublished', op: '==', value: isPublishedRaw === 'true' });
      }

      const page = await listCollectionPage(db.collection('products'), {
        limit: parseLimit(req.query.limit, { min: 1, max: 200, fallback: 50 }),
        cursor: req.query.cursor,
        where
      });

      return res.json({ ok: true, data: page, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const payload = buildProductPayload(req.body || {}, {});
      const ref = await db.collection('products').add(payload);

      await logging.adminActivity(req, {
        action: 'PRODUCT_CREATED',
        targetId: ref.id,
        details: { name: payload.name, category: payload.category }
      });

      return res.status(201).json({
        ok: true,
        data: { id: ref.id, ...payload },
        requestId: req.requestId
      });
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
          error: { code: 'validation/invalid-id', message: 'Product id is required.' },
          requestId: req.requestId
        });
      }

      const ref = db.collection('products').doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        return res.status(404).json({
          ok: false,
          error: { code: 'not-found/product', message: 'Product not found.' },
          requestId: req.requestId
        });
      }

      const payload = buildProductPayload(req.body || {}, { existing: snapshot.data() || {} });
      await ref.set(payload, { merge: true });

      await logging.adminActivity(req, {
        action: 'PRODUCT_UPDATED',
        targetId: id,
        details: { name: payload.name, category: payload.category }
      });

      return res.json({
        ok: true,
        data: { id, ...payload },
        requestId: req.requestId
      });
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
          error: { code: 'validation/invalid-id', message: 'Product id is required.' },
          requestId: req.requestId
        });
      }

      await db.collection('products').doc(id).delete();
      await logging.adminActivity(req, {
        action: 'PRODUCT_DELETED',
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
  attachPublicProductReadRoutes,
  createAdminProductsRouter
};
