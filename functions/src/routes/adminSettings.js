const express = require('express');
const { buildStoreSettingsPatch } = require('../lib/validators');

function createAdminSettingsRouter({ db, logging }) {
  const router = express.Router();

  router.patch('/store', async (req, res, next) => {
    try {
      const patch = buildStoreSettingsPatch(req.body || {});
      await db.collection('settings').doc('store').set(patch, { merge: true });
      await logging.adminActivity(req, {
        action: 'SETTINGS_UPDATED',
        targetId: 'store',
        details: { keys: Object.keys(patch || {}).slice(0, 50) }
      });
      return res.json({
        ok: true,
        data: { id: 'store', ...patch },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

function normalizeCountdownState(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const enabled = source.enabled === true;
  const startedAt = Number(source.startedAt || 0);
  const durationMs = Number(source.durationMs || 0);
  const windowMs = Number(source.windowMs || 0);
  const updatedAt = new Date().toISOString();

  return {
    enabled,
    startedAt: Number.isFinite(startedAt) && startedAt > 0 ? Math.floor(startedAt) : 0,
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? Math.floor(durationMs) : 0,
    windowMs: Number.isFinite(windowMs) && windowMs >= 0 ? Math.floor(windowMs) : 0,
    gateState: String(source.gateState || '').trim().toUpperCase() || 'WAITING',
    baselineDigest: String(source.baselineDigest || '').trim().slice(0, 128),
    pendingDigest: String(source.pendingDigest || '').trim().slice(0, 128),
    baselineAt: Number.isFinite(Number(source.baselineAt)) ? Math.max(0, Math.floor(Number(source.baselineAt))) : 0,
    pendingChangeAt: Number.isFinite(Number(source.pendingChangeAt)) ? Math.max(0, Math.floor(Number(source.pendingChangeAt))) : 0,
    changeAfterGateAt: Number.isFinite(Number(source.changeAfterGateAt)) ? Math.max(0, Math.floor(Number(source.changeAfterGateAt))) : 0,
    lastSeenAt: Number.isFinite(Number(source.lastSeenAt)) ? Math.max(0, Math.floor(Number(source.lastSeenAt))) : 0,
    lastSeenDigest: String(source.lastSeenDigest || '').trim().slice(0, 128),
    source: String(source.source || '').trim().toLowerCase().slice(0, 32) || 'backend',
    updatedAt
  };
}

function createAdminCountdownRouter({ db, logging }) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const doc = await db.collection('settings').doc('countdown').get();
      const data = doc.exists ? (doc.data() || {}) : { enabled: false };
      return res.json({
        ok: true,
        data,
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const patch = normalizeCountdownState(req.body || {});
      await db.collection('settings').doc('countdown').set(patch, { merge: true });
      await logging.adminActivity(req, {
        action: 'COUNTDOWN_UPDATED',
        targetId: 'countdown',
        details: { keys: Object.keys(patch) }
      });
      return res.json({
        ok: true,
        data: patch,
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createAdminSettingsRouter,
  createAdminCountdownRouter
};
