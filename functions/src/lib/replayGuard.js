const crypto = require('crypto');

function hashReplayKey(scope, key) {
  return crypto
    .createHash('sha256')
    .update(`${String(scope || '')}:${String(key || '')}`)
    .digest('hex');
}

function replayDocId(scope, key) {
  return `rp_${hashReplayKey(scope, key)}`;
}

async function assertReplayNotSeen({ db, scope, key, windowMs = 30000, metadata = {} }) {
  if (!db) return;
  const normalizedScope = String(scope || '').trim();
  const normalizedKey = String(key || '').trim();
  if (!normalizedScope || !normalizedKey) return;

  const docId = replayDocId(normalizedScope, normalizedKey);
  const ref = db.collection('request_replay_guards').doc(docId);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) {
      const data = snapshot.data() || {};
      const seenAtMs = Number(data.lastSeenMs || 0);
      if (seenAtMs > 0 && now - seenAtMs < windowMs) {
        const error = new Error('Replay detected within protected window.');
        error.code = 'abuse/replay-detected';
        error.status = 429;
        throw error;
      }
    }

    tx.set(ref, {
      scope: normalizedScope,
      keyHash: hashReplayKey(normalizedScope, normalizedKey),
      lastSeenMs: now,
      windowMs: Math.max(1000, Math.floor(windowMs)),
      expiresAt: new Date(now + Math.max(2000, windowMs * 2)),
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    }, { merge: true });
  });
}

module.exports = {
  assertReplayNotSeen,
  hashReplayKey
};
