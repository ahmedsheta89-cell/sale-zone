function toTrimmedString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toPositivePrice(value) {
  const num = toFiniteNumber(value);
  return num !== null && num > 0 ? num : null;
}

function parseLimit(value, defaults = { min: 1, max: 100, fallback: 20 }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaults.fallback;
  return Math.max(defaults.min, Math.min(defaults.max, Math.floor(parsed)));
}

function sanitizeIso(value) {
  const raw = toTrimmedString(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function tokenizeSearchText(...parts) {
  const source = parts
    .map((part) => toTrimmedString(part).toLowerCase())
    .join(' ')
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ');
  return [...new Set(source.split(/\s+/).map((item) => item.trim()).filter((item) => item.length >= 2))].slice(0, 80);
}

function buildProductPayload(input = {}, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const existing = options && typeof options.existing === 'object' ? options.existing : {};
  const nowIso = new Date().toISOString();

  const name = toTrimmedString(source.name || existing.name);
  const description = toTrimmedString(source.description || source.desc || existing.description || existing.desc);
  const category = toTrimmedString(source.category || existing.category);

  if (!name) throw new Error('Product name is required.');

  const suppliedSellPrice = toPositivePrice(source.sellPrice);
  const suppliedPrice = toPositivePrice(source.price);
  const existingSellPrice = toPositivePrice(existing.sellPrice);
  const existingPrice = toPositivePrice(existing.price);

  const resolvedSellPrice = suppliedSellPrice || existingSellPrice || null;
  const resolvedPrice = suppliedPrice || existingPrice || resolvedSellPrice || null;
  const effectivePrice = resolvedSellPrice || resolvedPrice || null;

  const image = toTrimmedString(source.image || source.imageUrl || existing.image || existing.imageUrl);
  const stock = Number.isFinite(Number(source.stock))
    ? Math.max(0, Math.floor(Number(source.stock)))
    : (Number.isFinite(Number(existing.stock)) ? Math.max(0, Math.floor(Number(existing.stock))) : 0);
  const isPublishedInput = source.isPublished;
  const isPublishedRequested = isPublishedInput === undefined
    ? (existing.isPublished !== false)
    : Boolean(isPublishedInput);

  if (isPublishedRequested && !effectivePrice) {
    const error = new Error('Published product requires a valid price greater than zero.');
    error.code = 'validation/invalid-price';
    throw error;
  }

  return {
    name,
    description,
    category,
    image,
    stock,
    sellPrice: resolvedSellPrice || null,
    price: resolvedPrice || null,
    isPublished: Boolean(isPublishedRequested && effectivePrice),
    updatedAt: nowIso,
    createdAt: toTrimmedString(existing.createdAt || source.createdAt) || nowIso,
    searchTokens: tokenizeSearchText(name, description, category)
  };
}

function buildBannerPayload(input = {}, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const existing = options && typeof options.existing === 'object' ? options.existing : {};
  const nowIso = new Date().toISOString();

  const title = toTrimmedString(source.title || existing.title);
  const image = toTrimmedString(source.image || source.imageUrl || existing.image || existing.imageUrl);
  if (!title) throw new Error('Banner title is required.');
  if (!image) throw new Error('Banner image is required.');

  return {
    title,
    subtitle: toTrimmedString(source.subtitle || existing.subtitle),
    image,
    link: toTrimmedString(source.link || existing.link),
    category: toTrimmedString(source.category || existing.category),
    isActive: source.isActive === undefined ? (existing.isActive !== false) : Boolean(source.isActive),
    updatedAt: nowIso,
    createdAt: toTrimmedString(existing.createdAt || source.createdAt) || nowIso
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildCouponPayload(input = {}, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const existing = options && typeof options.existing === 'object' ? options.existing : {};
  const nowIso = new Date().toISOString();

  const code = toTrimmedString(source.code || existing.code).toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error('Coupon code must be 3-32 chars [A-Z0-9_-].');

  const type = toTrimmedString(source.type || existing.type || 'percentage').toLowerCase();
  if (!['percentage', 'fixed'].includes(type)) throw new Error('Coupon type must be percentage or fixed.');

  const rawValue = toFiniteNumber(
    source.value !== undefined
      ? source.value
      : (source.discount !== undefined ? source.discount : (existing.value !== undefined ? existing.value : existing.discount))
  );
  if (rawValue === null || rawValue <= 0) throw new Error('Coupon value must be a valid positive number.');

  const value = type === 'percentage'
    ? clamp(rawValue, 1, 90)
    : clamp(rawValue, 1, 100000);

  const maxUses = toFiniteNumber(source.maxUses !== undefined ? source.maxUses : existing.maxUses);
  const minOrder = toFiniteNumber(source.minOrder !== undefined ? source.minOrder : existing.minOrder);
  const expiresAt = sanitizeIso(source.expiresAt || existing.expiresAt);

  return {
    code,
    title: toTrimmedString(source.title || existing.title),
    desc: toTrimmedString(source.desc || source.description || existing.desc || existing.description),
    description: toTrimmedString(source.description || source.desc || existing.description || existing.desc),
    type,
    value,
    discount: value,
    maxUses: maxUses === null ? null : Math.max(1, Math.min(100000, Math.floor(maxUses))),
    minOrder: minOrder === null ? 0 : clamp(minOrder, 0, 1000000),
    expiresAt: expiresAt || '',
    isActive: source.isActive === undefined ? (existing.isActive !== false) : Boolean(source.isActive),
    updatedAt: nowIso,
    createdAt: toTrimmedString(existing.createdAt || source.createdAt) || nowIso
  };
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

function toEpochMs(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

function buildReleaseGateStatePatch(input = {}, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const existing = options && typeof options.existing === 'object' ? options.existing : {};
  const nowIso = new Date().toISOString();
  const patch = {};

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
    const windowMs = toEpochMs(source.windowMs);
    patch.windowMs = windowMs > 0 ? windowMs : (toEpochMs(existing.windowMs) || (24 * 60 * 60 * 1000));
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

function buildOrderPayload(input = {}, user = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const nowIso = new Date().toISOString();
  const uid = toTrimmedString(user.uid);
  if (!uid) {
    const error = new Error('Authenticated user is required.');
    error.code = 'auth/not-authenticated';
    throw error;
  }

  const items = Array.isArray(source.items) ? source.items : [];
  if (items.length === 0) throw new Error('Order must include at least one item.');
  if (items.length > 100) throw new Error('Order items exceed maximum allowed count.');

  const normalizedItems = items.map((item, idx) => {
    const row = item && typeof item === 'object' ? item : {};
    const productId = toTrimmedString(row.id || row.productId);
    const qty = Number.isFinite(Number(row.qty || row.quantity)) ? Math.floor(Number(row.qty || row.quantity)) : 0;
    if (!productId) throw new Error(`Order item #${idx + 1} is missing product id.`);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100) throw new Error(`Order item #${idx + 1} has invalid quantity.`);
    return {
      id: productId,
      qty
    };
  });

  const customer = source.customer && typeof source.customer === 'object' ? source.customer : {};
  const orderNumber = toTrimmedString(source.orderNumber);
  const idempotencyKey = toTrimmedString(source.idempotencyKey);

  if (!orderNumber) throw new Error('orderNumber is required.');
  if (!idempotencyKey || idempotencyKey.length < 12) throw new Error('idempotencyKey is required.');

  return {
    id: toTrimmedString(source.id),
    uid,
    email: toTrimmedString(user.email).toLowerCase(),
    requestId: toTrimmedString(source.requestId),
    deviceId: toTrimmedString(source.deviceId),
    orderNumber,
    idempotencyKey,
    customer: {
      name: toTrimmedString(customer.name),
      phone: toTrimmedString(customer.phone),
      address: toTrimmedString(customer.address),
      notes: toTrimmedString(customer.notes)
    },
    items: normalizedItems,
    requestedTotal: toFiniteNumber(source.total),
    requestedSubtotal: toFiniteNumber(source.subtotal),
    requestedDiscount: toFiniteNumber(source.discount),
    couponCode: toTrimmedString(source.couponCode).toUpperCase(),
    usedPoints: toFiniteNumber(source.usedPoints) || 0,
    pointsDiscount: toFiniteNumber(source.pointsDiscount) || 0,
    earnedPoints: toFiniteNumber(source.earnedPoints) || 0,
    status: 'pending',
    statusHistory: [
      { status: 'pending', date: nowIso, note: 'Order submitted by customer' }
    ],
    source: toTrimmedString(source.source || 'store-web'),
    syncState: toTrimmedString(source.syncState || 'synced'),
    version: Number.isFinite(Number(source.version)) ? Math.max(1, Number(source.version)) : 1,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

function normalizeCursorId(value) {
  return toTrimmedString(value);
}

module.exports = {
  buildBannerPayload,
  buildCouponPayload,
  buildOrderPayload,
  buildProductPayload,
  buildReleaseGateStatePatch,
  buildStoreSettingsPatch,
  normalizeCursorId,
  parseLimit,
  sanitizeIso,
  toFiniteNumber,
  toTrimmedString
};
