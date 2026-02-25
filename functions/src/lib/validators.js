function toTrimmedString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function toEpochMs(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

function sanitizeSettingValue(value, depth = 0) {
  if (depth > 3) return null;
  if (value === null) return null;
  if (typeof value === 'string') return value.slice(0, 5000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeSettingValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const obj = {};
    for (const [k, v] of Object.entries(value)) {
      const key = toTrimmedString(k);
      if (!key || key.length > 64) continue;
      obj[key] = sanitizeSettingValue(v, depth + 1);
    }
    return obj;
  }
  return null;
}

function buildStoreSettingsPatch(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const nowIso = new Date().toISOString();
  const allowedKeys = new Set([
    'name', 'tagline', 'description', 'whatsappNumber', 'topBar', 'hero', 'seo', 'social',
    'theme', 'contact', 'support', 'currency', 'locale', 'branding', 'checkout',
    'announcement', 'businessHours', 'address', 'updatedBy'
  ]);

  const patch = {};
  for (const [key, value] of Object.entries(source)) {
    if (!allowedKeys.has(key)) continue;
    patch[key] = sanitizeSettingValue(value, 0);
  }

  if (!Object.keys(patch).length) {
    const error = new Error('No allowed settings keys found in patch.');
    error.code = 'validation/invalid-settings-patch';
    throw error;
  }

  patch.updatedAt = nowIso;
  return patch;
}

function buildReleaseGateStatePatch(input = {}, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const existing = options && typeof options === 'object' ? options : {};
  const nowIso = new Date().toISOString();
  const patch = {};
  const allowedKeys = new Set([
    'baselineAt',
    'baselineDigest',
    'pendingChangeAt',
    'pendingDigest',
    'changeAfterGateAt',
    'lastSeenAt',
    'lastSeenDigest',
    'gateState',
    'windowMs',
    'source',
    'updatedBy'
  ]);

  const unknownKeys = Object.keys(source).filter((key) => !allowedKeys.has(String(key || '')));
  if (unknownKeys.length) {
    const error = new Error(`Unknown release gate state keys: ${unknownKeys.join(', ')}`);
    error.code = 'validation/unknown-release-gate-state-keys';
    throw error;
  }

  if (Object.prototype.hasOwnProperty.call(source, 'baselineAt')) {
    patch.baselineAt = toEpochMs(source.baselineAt);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'baselineDigest')) {
    patch.baselineDigest = toTrimmedString(source.baselineDigest).slice(0, 128);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'pendingChangeAt')) {
    patch.pendingChangeAt = toEpochMs(source.pendingChangeAt);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'pendingDigest')) {
    patch.pendingDigest = toTrimmedString(source.pendingDigest).slice(0, 128);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'changeAfterGateAt')) {
    patch.changeAfterGateAt = toEpochMs(source.changeAfterGateAt);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'lastSeenAt')) {
    patch.lastSeenAt = toEpochMs(source.lastSeenAt);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'lastSeenDigest')) {
    patch.lastSeenDigest = toTrimmedString(source.lastSeenDigest).slice(0, 128);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'windowMs')) {
    const resolvedWindow = toEpochMs(source.windowMs);
    patch.windowMs = resolvedWindow > 0 ? resolvedWindow : (toEpochMs(existing.windowMs) || (24 * 60 * 60 * 1000));
  }
  if (Object.prototype.hasOwnProperty.call(source, 'updatedBy')) {
    patch.updatedBy = toTrimmedString(source.updatedBy).slice(0, 256);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'source')) {
    const allowedSources = new Set(['backend', 'cache', 'degraded']);
    const sourceValue = toTrimmedString(source.source).toLowerCase();
    patch.source = allowedSources.has(sourceValue) ? sourceValue : 'backend';
  }
  if (Object.prototype.hasOwnProperty.call(source, 'gateState')) {
    const allowedStates = new Set(['WAITING', 'READY', 'BLOCKED', 'DEGRADED']);
    const normalizedState = toTrimmedString(source.gateState).toUpperCase();
    patch.gateState = allowedStates.has(normalizedState) ? normalizedState : 'WAITING';
  }

  if (!Object.keys(patch).length) {
    const error = new Error('No allowed release gate keys found in patch.');
    error.code = 'validation/invalid-release-gate-state-patch';
    throw error;
  }

  patch.updatedAt = nowIso;
  return patch;
}

module.exports = {
  buildReleaseGateStatePatch,
  buildStoreSettingsPatch
};
