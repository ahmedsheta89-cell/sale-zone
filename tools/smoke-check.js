// Lightweight structural smoke checks for critical store/admin flows.
// Run: node tools/smoke-check.js

const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertContains(content, pattern, message, errors) {
  if (!pattern.test(content)) errors.push(message);
}

const errors = [];

const adminHtml = read('\u0627\u062f\u0645\u0646_2.HTML');
const storeHtml = read('\u0645\u062a\u062c\u0631_2.HTML');
const firebaseApi = read('firebase-api.js');
const firebaseConfig = read('firebase-config.js');

assertContains(firebaseApi, /function\s+getSuppliers\s*\(/, 'firebase-api.js: missing getSuppliers()', errors);
assertContains(firebaseApi, /function\s+addSupplier\s*\(/, 'firebase-api.js: missing addSupplier()', errors);
assertContains(firebaseApi, /function\s+searchProductsIndexed\s*\(/, 'firebase-api.js: missing searchProductsIndexed()', errors);
assertContains(firebaseApi, /function\s+getFirebaseErrorCode\s*\(/, 'firebase-api.js: missing getFirebaseErrorCode()', errors);
assertContains(firebaseApi, /function\s+isPermissionDeniedError\s*\(/, 'firebase-api.js: missing isPermissionDeniedError()', errors);
assertContains(firebaseApi, /function\s+normalizeFirebaseError\s*\(/, 'firebase-api.js: missing normalizeFirebaseError()', errors);
assertContains(firebaseApi, /function\s+getSupportThreads\s*\(\s*limitCount\s*=\s*100\s*,\s*options\s*=\s*\{\}\s*\)/, 'firebase-api.js: getSupportThreads strict options missing', errors);
assertContains(firebaseApi, /function\s+getSupportMessages\s*\(\s*threadId\s*,\s*limitCount\s*=\s*200\s*,\s*options\s*=\s*\{\}\s*\)/, 'firebase-api.js: getSupportMessages strict options missing', errors);

assertContains(adminHtml, /id="suppliersSection"/, 'admin HTML: missing suppliers section', errors);
assertContains(adminHtml, /id="productCostPrice"/, 'admin HTML: missing product cost input', errors);
assertContains(adminHtml, /function\s+runProductsSchemaMigration\s*\(/, 'admin HTML: missing schema migration action', errors);
assertContains(adminHtml, /supportAccess\s*=\s*\{/, 'admin HTML: supportAccess state missing', errors);
assertContains(adminHtml, /function\s+handleSupportAccessError\s*\(/, 'admin HTML: support access error handler missing', errors);
assertContains(adminHtml, /id="supportAccessNotice"/, 'admin HTML: support access notice missing', errors);

assertContains(storeHtml, /product-search-worker\.js/, 'store HTML: missing worker reference path', errors);
assertContains(storeHtml, /id="productsPagination"/, 'store HTML: missing pagination container', errors);
assertContains(storeHtml, /function\s+runProductSearch\s*\(/, 'store HTML: missing runProductSearch()', errors);
assertContains(storeHtml, /id="loginIdentifier"/, 'store HTML: login identifier input not found', errors);
assertContains(storeHtml, /supportAccess\s*=\s*\{/, 'store HTML: supportAccess state missing', errors);
assertContains(storeHtml, /function\s+handleSupportAccessError\s*\(/, 'store HTML: support access error handler missing', errors);
assertContains(storeHtml, /function\s+fallbackSupportChatToFaq\s*\(/, 'store HTML: FAQ fallback handler missing', errors);

assertContains(firebaseConfig, /experimentalForceLongPolling:\s*true/, 'firebase-config.js: force long-polling not enabled', errors);

if (errors.length) {
  console.error('Smoke check FAILED:');
  for (const item of errors) console.error(` - ${item}`);
  process.exit(1);
}

console.log('Smoke check OK: core free-first features detected.');
