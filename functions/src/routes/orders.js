const crypto = require('crypto');
const express = require('express');
const { FieldPath } = require('firebase-admin/firestore');

const { buildOrderPayload, parseLimit, sanitizeIso, toFiniteNumber, toTrimmedString } = require('../lib/validators');
const { hasAdminClaim } = require('../middleware/verifyAdmin');
const { assertReplayNotSeen } = require('../lib/replayGuard');

function normalizeOrderDocId(idempotencyKey = '') {
  const safe = String(idempotencyKey || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  return safe ? `ord_${safe}` : `ord_${Date.now()}`;
}

function hashOrderFingerprint(payload) {
  const customer = payload && payload.customer && typeof payload.customer === 'object' ? payload.customer : {};
  const base = {
    uid: String(payload && payload.uid || ''),
    orderNumber: String(payload && payload.orderNumber || ''),
    couponCode: String(payload && payload.couponCode || ''),
    items: Array.isArray(payload && payload.items)
      ? payload.items.map((i) => ({ id: String(i && i.id || ''), qty: Number(i && i.qty || 0) })).sort((a, b) => a.id.localeCompare(b.id))
      : [],
    customerPhone: String(customer.phone || ''),
    customerAddress: String(customer.address || '')
  };

  return crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
}

function includesSearchText(order, searchText) {
  const token = String(searchText || '').trim().toLowerCase();
  if (!token) return true;
  const customer = order && typeof order.customer === 'object' ? order.customer : {};
  const haystack = [
    String(order && order.id || ''),
    String(order && order.orderNumber || ''),
    String(customer.name || ''),
    String(customer.phone || ''),
    String(order && order.email || '')
  ].join(' ').toLowerCase();
  return haystack.includes(token);
}

async function getCursorSnapshot(collectionRef, cursor) {
  const safe = toTrimmedString(cursor);
  if (!safe) return null;
  const snapshot = await collectionRef.doc(safe).get();
  return snapshot.exists ? snapshot : null;
}

function resolveProductPrice(product = {}) {
  const sellPrice = toFiniteNumber(product.sellPrice);
  if (sellPrice !== null && sellPrice > 0) return sellPrice;
  const price = toFiniteNumber(product.price);
  if (price !== null && price > 0) return price;
  return null;
}

function applyCouponToSubtotal(coupon, subtotal) {
  if (!coupon || typeof coupon !== 'object') return { discount: 0, couponCode: '' };
  const code = toTrimmedString(coupon.code).toUpperCase();
  const type = toTrimmedString(coupon.type || 'percentage').toLowerCase();
  const value = toFiniteNumber(coupon.value !== undefined ? coupon.value : coupon.discount);
  const minOrder = toFiniteNumber(coupon.minOrder);

  if (!code || value === null || value <= 0) return { discount: 0, couponCode: '' };
  if (minOrder !== null && subtotal < minOrder) return { discount: 0, couponCode: '' };

  let discount = 0;
  if (type === 'fixed') {
    discount = Math.min(subtotal, Math.max(0, value));
  } else {
    const pct = Math.max(0, Math.min(90, value));
    discount = subtotal * (pct / 100);
  }

  return {
    discount: Math.max(0, discount),
    couponCode: code
  };
}

async function loadCouponByCode(db, couponCode) {
  const safeCode = toTrimmedString(couponCode).toUpperCase();
  if (!safeCode) return null;

  const snapshot = await db
    .collection('coupons')
    .where('code', '==', safeCode)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() || null;
}

function buildCanonicalItems(itemRows, productMap) {
  const canonicalItems = [];
  let subtotal = 0;

  for (const row of itemRows) {
    const product = productMap.get(String(row.id));
    if (!product) {
      const error = new Error(`Product not found: ${row.id}`);
      error.code = 'validation/product-not-found';
      error.status = 400;
      throw error;
    }

    const unitPrice = resolveProductPrice(product);
    if (unitPrice === null) {
      const error = new Error(`Product price unavailable: ${row.id}`);
      error.code = 'validation/product-price-missing';
      error.status = 400;
      throw error;
    }

    const lineTotal = unitPrice * row.qty;
    subtotal += lineTotal;

    canonicalItems.push({
      id: String(row.id),
      productId: String(row.id),
      name: toTrimmedString(product.name),
      qty: row.qty,
      unitPrice,
      lineTotal
    });
  }

  return {
    canonicalItems,
    subtotal
  };
}

function createOrdersRouter({ db, logging }) {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    try {
      const payload = buildOrderPayload(req.body || {}, req.user || {});
      const orderFingerprint = hashOrderFingerprint(payload);

      await assertReplayNotSeen({
        db,
        scope: 'orders',
        key: `${payload.uid}:${orderFingerprint}`,
        windowMs: 20 * 1000,
        metadata: {
          uid: payload.uid,
          orderNumber: payload.orderNumber
        }
      });

      const orderId = normalizeOrderDocId(payload.idempotencyKey);
      const orderRef = db.collection('orders').doc(orderId);
      const eventRef = db.collection('order_events').doc();
      const auditRef = db.collection('audit_logs').doc();

      const productRefs = payload.items.map((item) => db.collection('products').doc(String(item.id)));
      const coupon = await loadCouponByCode(db, payload.couponCode);

      const transactionResult = await db.runTransaction(async (tx) => {
        const existing = await tx.get(orderRef);
        if (existing.exists) {
          return {
            duplicate: true,
            id: orderRef.id,
            status: String(existing.get('status') || 'pending')
          };
        }

        const productSnapshots = await Promise.all(productRefs.map((ref) => tx.get(ref)));
        const productMap = new Map();

        productSnapshots.forEach((snapshot, idx) => {
          if (!snapshot.exists) {
            const err = new Error(`Product not found: ${payload.items[idx].id}`);
            err.code = 'validation/product-not-found';
            err.status = 400;
            throw err;
          }
          productMap.set(String(payload.items[idx].id), snapshot.data() || {});
        });

        const { canonicalItems, subtotal } = buildCanonicalItems(payload.items, productMap);
        const couponResult = applyCouponToSubtotal(coupon, subtotal);
        const discount = couponResult.discount;
        const total = Math.max(0, subtotal - discount);

        if (payload.requestedTotal !== null && Math.abs(payload.requestedTotal - total) > 0.01) {
          const err = new Error('Client total does not match server-computed total.');
          err.code = 'validation/price-mismatch';
          err.status = 400;
          throw err;
        }

        if (total > subtotal) {
          const err = new Error('Invariant violation: total exceeds subtotal.');
          err.code = 'validation/invalid-total';
          err.status = 400;
          throw err;
        }

        const stockMutations = [];
        for (const item of canonicalItems) {
          const ref = db.collection('products').doc(item.id);
          const snapshot = productSnapshots.find((s, index) => String(payload.items[index].id) === item.id);
          const product = snapshot && snapshot.data ? (snapshot.data() || {}) : {};
          const stock = Number.isFinite(Number(product.stock)) ? Math.max(0, Math.floor(Number(product.stock))) : 0;
          const nextStock = stock - item.qty;
          if (nextStock < 0) {
            const err = new Error(`Insufficient stock for product ${item.id}`);
            err.code = 'validation/insufficient-stock';
            err.status = 409;
            throw err;
          }
          tx.update(ref, {
            stock: nextStock,
            updatedAt: payload.updatedAt
          });
          stockMutations.push({ productId: item.id, before: stock, after: nextStock, qty: item.qty });
        }

        const canonicalOrder = {
          ...payload,
          id: orderRef.id,
          items: canonicalItems,
          subtotal,
          discount,
          total,
          couponCode: couponResult.couponCode,
          requestFingerprint: orderFingerprint
        };

        tx.set(orderRef, canonicalOrder);

        tx.set(eventRef, {
          type: 'ORDER_CREATED',
          orderId: orderRef.id,
          uid: payload.uid,
          idempotencyKey: payload.idempotencyKey,
          payload: {
            orderNumber: payload.orderNumber,
            total,
            subtotal,
            discount
          },
          source: payload.source,
          createdAt: payload.createdAt
        });

        tx.set(auditRef, {
          action: 'ORDER_CREATED',
          scope: 'orders',
          targetId: orderRef.id,
          uid: payload.uid,
          details: {
            orderNumber: payload.orderNumber,
            total,
            subtotal,
            discount,
            stockMutations
          },
          createdAt: payload.createdAt
        });

        return {
          duplicate: false,
          id: orderRef.id,
          status: payload.status,
          total,
          subtotal,
          discount,
          stockMutations
        };
      });

      if (transactionResult.duplicate) {
        await logging.info('ORDER_DUPLICATE_REPLAY', {
          requestId: req.requestId,
          uid: String(req.user && req.user.uid || ''),
          orderId: transactionResult.id
        });
      } else {
        await logging.adminActivity(req, {
          action: 'ORDER_CREATED',
          targetId: transactionResult.id,
          details: {
            source: payload.source,
            total: transactionResult.total,
            subtotal: transactionResult.subtotal,
            stockMutations: transactionResult.stockMutations
          }
        });
      }

      return res.status(transactionResult.duplicate ? 200 : 201).json({
        ok: true,
        data: transactionResult,
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const isAdmin = hasAdminClaim(req.user);
      const safeLimit = parseLimit(req.query.limit, { min: 1, max: 200, fallback: 50 });
      const statusFilter = toTrimmedString(req.query.status);
      const dateFromIso = sanitizeIso(req.query.dateFrom);
      const dateToIso = sanitizeIso(req.query.dateTo);
      const searchText = toTrimmedString(req.query.search).toLowerCase();

      let query = db.collection('orders');
      if (!isAdmin) {
        query = query.where('uid', '==', String(req.user && req.user.uid || ''));
      }
      if (statusFilter) {
        query = query.where('status', '==', statusFilter);
      }
      if (dateFromIso) {
        query = query.where('createdAt', '>=', dateFromIso);
      }
      if (dateToIso) {
        query = query.where('createdAt', '<=', dateToIso);
      }
      query = query.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit((searchText ? safeLimit * 4 : safeLimit) + 1);

      const cursorSnapshot = await getCursorSnapshot(db.collection('orders'), req.query.cursor);
      if (cursorSnapshot) {
        query = query.startAfter(
          String(cursorSnapshot.get('createdAt') || ''),
          cursorSnapshot.id
        );
      }

      const snapshot = await query.get();
      let docs = snapshot.docs || [];
      if (searchText) {
        docs = docs.filter((doc) => includesSearchText({ id: doc.id, ...doc.data() }, searchText));
      }

      const hasMore = docs.length > safeLimit;
      const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;
      const nextCursor = hasMore && pageDocs.length ? pageDocs[pageDocs.length - 1].id : '';

      return res.json({
        ok: true,
        data: {
          items: pageDocs.map((doc) => ({ id: doc.id, ...doc.data() })),
          hasMore,
          nextCursor
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

function createAdminOrdersRouter({ db, logging }) {
  const router = express.Router();
  const allowedStatuses = new Set(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'failed']);

  router.patch('/:id/status', async (req, res, next) => {
    try {
      const orderId = toTrimmedString(req.params.id);
      const status = toTrimmedString(req.body && req.body.status).toLowerCase();

      if (!orderId) {
        return res.status(400).json({
          ok: false,
          error: { code: 'validation/invalid-id', message: 'Order id is required.' },
          requestId: req.requestId
        });
      }

      if (!allowedStatuses.has(status)) {
        return res.status(400).json({
          ok: false,
          error: { code: 'validation/invalid-status', message: 'Invalid order status.' },
          requestId: req.requestId
        });
      }

      const orderRef = db.collection('orders').doc(orderId);

      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(orderRef);
        if (!snapshot.exists) {
          const err = new Error('Order not found.');
          err.code = 'not-found/order';
          err.status = 404;
          throw err;
        }

        const data = snapshot.data() || {};
        const history = Array.isArray(data.statusHistory) ? [...data.statusHistory] : [];
        history.push({
          status,
          date: new Date().toISOString(),
          note: 'Status updated by admin API'
        });

        tx.set(orderRef, {
          status,
          statusHistory: history,
          updatedAt: new Date().toISOString(),
          version: Math.max(1, Number(data.version || 1)) + 1
        }, { merge: true });
      });

      await logging.adminActivity(req, {
        action: 'ORDER_STATUS_UPDATED',
        targetId: orderId,
        details: { status }
      });

      return res.json({
        ok: true,
        data: { id: orderId, status },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createOrdersRouter,
  createAdminOrdersRouter
};
