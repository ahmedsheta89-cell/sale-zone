const express = require('express');
const { buildReleaseGateStatePatch, buildStoreSettingsPatch } = require('../lib/validators');

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

  router.get('/release-gate-state', async (req, res, next) => {
    try {
      const snapshot = await db.collection('settings').doc('release_gate_state').get();
      const data = snapshot.exists ? (snapshot.data() || {}) : {};
      return res.json({
        ok: true,
        data: {
          id: 'release_gate_state',
          baselineAt: Number(data.baselineAt || 0),
          baselineDigest: String(data.baselineDigest || ''),
          pendingChangeAt: Number(data.pendingChangeAt || 0),
          pendingDigest: String(data.pendingDigest || ''),
          changeAfterGateAt: Number(data.changeAfterGateAt || 0),
          lastSeenAt: Number(data.lastSeenAt || 0),
          lastSeenDigest: String(data.lastSeenDigest || ''),
          gateState: String(data.gateState || 'WAITING').toUpperCase(),
          windowMs: Number(data.windowMs || (24 * 60 * 60 * 1000)),
          source: String(data.source || 'backend'),
          updatedAt: String(data.updatedAt || ''),
          updatedBy: String(data.updatedBy || '')
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/release-gate-state', async (req, res, next) => {
    try {
      const ref = db.collection('settings').doc('release_gate_state');
      const existing = await ref.get();
      const existingData = existing.exists ? (existing.data() || {}) : {};
      const patch = buildReleaseGateStatePatch(req.body || {}, existingData);
      await ref.set(patch, { merge: true });
      await logging.adminActivity(req, {
        action: 'RELEASE_GATE_STATE_UPDATED',
        targetId: 'release_gate_state',
        details: {
          gateState: String(patch.gateState || ''),
          source: String(patch.source || '')
        }
      });
      return res.json({
        ok: true,
        data: { id: 'release_gate_state', ...existingData, ...patch },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createAdminSettingsRouter
};
