const express = require('express');
const { listCollectionPage } = require('../lib/firestoreRepo');
const { buildCouponPayload, parseLimit, toTrimmedString } = require('../lib/validators');

function attachPublicCouponReadRoutes(router, { db }) {
  router.get('/coupons', async (req, res, next) => {
    try {
      const page = await listCollectionPage(db.collection('coupons'), {
        limit: parseLimit(req.query.limit, { min: 1, max: 100, fallback: 30 }),
        cursor: req.query.cursor
      });
      return res.json({ ok: true, data: page, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });
}

async function assertCouponCodeUniqueTx(tx, db, code, ignoreId = '') {
  const querySnapshot = await tx.get(
    db.collection('coupons').where('code', '==', String(code || '').toUpperCase()).limit(5)
  );

  if (querySnapshot.empty) return;

  const conflict = querySnapshot.docs.find((doc) => String(doc.id) !== String(ignoreId || ''));
  if (conflict) {
    const error = new Error('Coupon code already exists.');
    error.code = 'validation/coupon-code-exists';
    error.status = 409;
    throw error;
  }
}

function createAdminCouponsRouter({ db, logging }) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const page = await listCollectionPage(db.collection('coupons'), {
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
      const payload = buildCouponPayload(req.body || {}, {});
      const ref = db.collection('coupons').doc();

      await db.runTransaction(async (tx) => {
        await assertCouponCodeUniqueTx(tx, db, payload.code, '');
        tx.set(ref, payload);
      });

      await logging.adminActivity(req, {
        action: 'COUPON_CREATED',
        targetId: ref.id,
        details: { code: payload.code, type: payload.type, value: payload.value }
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
          error: { code: 'validation/invalid-id', message: 'Coupon id is required.' },
          requestId: req.requestId
        });
      }

      const ref = db.collection('coupons').doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        return res.status(404).json({
          ok: false,
          error: { code: 'not-found/coupon', message: 'Coupon not found.' },
          requestId: req.requestId
        });
      }

      const payload = buildCouponPayload(req.body || {}, { existing: snapshot.data() || {} });

      await db.runTransaction(async (tx) => {
        await assertCouponCodeUniqueTx(tx, db, payload.code, id);
        tx.set(ref, payload, { merge: true });
      });

      await logging.adminActivity(req, {
        action: 'COUPON_UPDATED',
        targetId: id,
        details: { code: payload.code, type: payload.type, value: payload.value }
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
          error: { code: 'validation/invalid-id', message: 'Coupon id is required.' },
          requestId: req.requestId
        });
      }

      await db.collection('coupons').doc(id).delete();
      await logging.adminActivity(req, {
        action: 'COUPON_DELETED',
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
  attachPublicCouponReadRoutes,
  createAdminCouponsRouter
};
