// Security regression guardrails for launch-critical invariants.
// Run: node tools/security-regression-check.js

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertContains(content, pattern, message) {
  if (!pattern.test(content)) errors.push(message);
}

const ordersRoute = read('functions/src/routes/orders.js');
const mediaRoute = read('functions/src/routes/media.js');
const verifyAdmin = read('functions/src/middleware/verifyAdmin.js');
const rateLimit = read('functions/src/middleware/rateLimit.js');
const couponsRoute = read('functions/src/routes/adminCoupons.js');
const appJs = read('functions/src/app.js');

// Price manipulation protection.
assertContains(
  ordersRoute,
  /requestedTotal !== null && Math\.abs\(payload\.requestedTotal - total\) > 0\.01/,
  'security-regression: missing server-side total mismatch guard.'
);

// Oversell race protection.
assertContains(
  ordersRoute,
  /db\.runTransaction\(/,
  'security-regression: order create is not transaction-based.'
);
assertContains(
  ordersRoute,
  /nextStock < 0/,
  'security-regression: stock underflow guard missing.'
);

// Stale admin token protection.
assertContains(
  verifyAdmin,
  /admin\.auth\(\)\.getUser\(/,
  'security-regression: verifyAdmin does not re-check live claims.'
);
assertContains(
  verifyAdmin,
  /ADMIN_STALE_TOKEN_BLOCKED/,
  'security-regression: stale-admin-token security signal missing.'
);

// Burst flood protection.
assertContains(
  rateLimit,
  /collection\('rate_limit_buckets'\)/,
  'security-regression: distributed rate limiter storage missing.'
);
assertContains(
  appJs,
  /ordersRateLimiter/,
  'security-regression: orders route limiter missing.'
);
assertContains(
  appJs,
  /mediaRateLimiter/,
  'security-regression: media route limiter missing.'
);

// Media replay protection.
assertContains(
  mediaRoute,
  /assertReplayNotSeen\(\{/,
  'security-regression: media replay guard missing.'
);

// Coupon duplication race protection.
assertContains(
  couponsRoute,
  /assertCouponCodeUniqueTx/,
  'security-regression: coupon uniqueness guard missing.'
);
assertContains(
  couponsRoute,
  /runTransaction\(/,
  'security-regression: coupon writes are not transaction-protected.'
);

if (errors.length) {
  console.error('Security regression check FAILED:');
  for (const err of errors) {
    console.error(` - ${err}`);
  }
  process.exit(1);
}

console.log('Security regression check OK: launch-critical invariants present.');

