// Deterministic E2E policy checks for critical user journeys.
// Run: node tools/e2e-check.js

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const storeHtmlPath = path.join(root, '\u0645\u062a\u062c\u0631_2.HTML');
const adminHtmlPath = path.join(root, '\u0627\u062f\u0645\u0646_2.HTML');
const firebaseApiPath = path.join(root, 'firebase-api.js');

const storeHtml = fs.readFileSync(storeHtmlPath, 'utf8');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
const firebaseApi = fs.readFileSync(firebaseApiPath, 'utf8');

const failures = [];

function requirePattern(source, label, pattern, details) {
  if (!pattern.test(source)) {
    failures.push(`${label}: ${details}`);
  }
}

function forbidPattern(source, label, pattern, details) {
  if (pattern.test(source)) {
    failures.push(`${label}: ${details}`);
  }
}

// Store banner flow: must keep escaped fields.
requirePattern(
  storeHtml,
  'store-banner-render',
  /function\s+renderBanners\s*\(/,
  'renderBanners() is missing'
);
requirePattern(
  storeHtml,
  'store-banner-escape-title',
  /const\s+safeTitle\s*=\s*escapeHtml\(/,
  'banner title must be escaped'
);
requirePattern(
  storeHtml,
  'store-banner-escape-text',
  /const\s+safeText\s*=\s*escapeHtml\(/,
  'banner text must be escaped'
);
requirePattern(
  storeHtml,
  'store-banner-escape-button',
  /const\s+safeButton\s*=\s*escapeHtml\(/,
  'banner button text must be escaped'
);
requirePattern(
  storeHtml,
  'store-banner-safe-category',
  /data-category="\$\{safeCategory\}"/,
  'banner category binding should use safeCategory'
);
forbidPattern(
  storeHtml,
  'store-banner-inline-dynamic',
  /onclick="filterByCategory\('\$\{[^}]+\}'\)"/,
  'dynamic inline banner onclick is not allowed'
);

// Store order flow: idempotency key should remain part of write contract.
requirePattern(
  storeHtml,
  'store-order-idempotency',
  /idempotencyKey/,
  'order idempotency key wiring is missing'
);
requirePattern(
  firebaseApi,
  'api-order-idempotency',
  /idempotencyKey/,
  'API idempotency handling is missing'
);

// Admin order flow: cancel/archive only, no physical delete from Firestore orders.
requirePattern(
  adminHtml,
  'admin-deleteOrder-exists',
  /async\s+function\s+deleteOrder\s*\(\s*id\s*\)/,
  'deleteOrder() action is missing'
);
requirePattern(
  adminHtml,
  'admin-deleteOrder-soft-cancel',
  /updateOrderStatus\(\s*id\s*,\s*'cancelled'\s*\)/,
  'order action must convert to cancelled status (soft delete)'
);
forbidPattern(
  adminHtml,
  'admin-hard-delete-order',
  /collection\('orders'\)\.doc\([^)]+\)\.delete\(/,
  'hard delete on orders collection is forbidden'
);

// Admin table rendering: critical fields must remain escaped.
requirePattern(
  adminHtml,
  'admin-orders-escape-name',
  /const\s+safeCustomerName\s*=\s*escapeHtml\(/,
  'customer name must be escaped in orders table'
);
requirePattern(
  adminHtml,
  'admin-orders-escape-phone',
  /const\s+safeCustomerPhone\s*=\s*escapeHtml\(/,
  'customer phone must be escaped in orders table'
);
requirePattern(
  adminHtml,
  'admin-banners-escape-title',
  /const\s+safeTitle\s*=\s*escapeHtml\(/,
  'banner title must be escaped in admin table'
);

// Admin monitoring flow: UI must expose redacted monitor report only.
requirePattern(
  adminHtml,
  'admin-monitor-table',
  /id="adminFunctionsTable"/,
  'admin function monitor table is missing'
);
requirePattern(
  adminHtml,
  'admin-monitor-loader',
  /function\s+refreshAdminFunctionMonitorView\s*\(/,
  'admin function monitor loader is missing'
);
requirePattern(
  adminHtml,
  'admin-monitor-filters',
  /function\s+applyAdminFunctionFilters\s*\(/,
  'admin function monitor filters are missing'
);
forbidPattern(
  adminHtml,
  'admin-monitor-sensitive-patterns',
  /requiredPatterns/,
  'admin monitor UI must not expose requiredPatterns internals'
);
forbidPattern(
  adminHtml,
  'admin-monitor-sensitive-regex-findings',
  /regexValidationFindings/,
  'admin monitor UI must not expose regex validation internals'
);

if (failures.length) {
  console.error('E2E gate FAILED:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('E2E gate OK: critical store/admin journeys are protected.');
