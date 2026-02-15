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

function assertNotContains(content, pattern, message, errors) {
  if (pattern.test(content)) errors.push(message);
}

const errors = [];

const adminHtml = read('\u0627\u062f\u0645\u0646_2.HTML');
const storeHtml = read('\u0645\u062a\u062c\u0631_2.HTML');
const firebaseApi = read('firebase-api.js');
const firebaseConfig = read('firebase-config.js');
const firebaseData = read('firebase-data.js');
const realtimeSync = read('REAL_TIME_SYNC.js');
const serviceWorker = read('sw.js');
const firestoreRules = read('firestore.rules');

assertContains(firebaseApi, /function\s+getSuppliers\s*\(/, 'firebase-api.js: missing getSuppliers()', errors);
assertContains(firebaseApi, /function\s+addSupplier\s*\(/, 'firebase-api.js: missing addSupplier()', errors);
assertContains(firebaseApi, /function\s+searchProductsIndexed\s*\(/, 'firebase-api.js: missing searchProductsIndexed()', errors);
assertContains(firebaseApi, /function\s+getFirebaseErrorCode\s*\(/, 'firebase-api.js: missing getFirebaseErrorCode()', errors);
assertContains(firebaseApi, /function\s+isPermissionDeniedError\s*\(/, 'firebase-api.js: missing isPermissionDeniedError()', errors);
assertContains(firebaseApi, /function\s+normalizeFirebaseError\s*\(/, 'firebase-api.js: missing normalizeFirebaseError()', errors);
assertContains(firebaseApi, /function\s+registerCustomerByEmail\s*\(/, 'firebase-api.js: missing registerCustomerByEmail()', errors);
assertContains(firebaseApi, /function\s+loginCustomerByEmail\s*\(/, 'firebase-api.js: missing loginCustomerByEmail()', errors);
assertContains(firebaseApi, /function\s+ensureEmailVerifiedOrThrow\s*\(/, 'firebase-api.js: missing ensureEmailVerifiedOrThrow()', errors);
assertContains(firebaseApi, /function\s+getMyCustomerProfile\s*\(/, 'firebase-api.js: missing getMyCustomerProfile()', errors);
assertContains(firebaseApi, /function\s+upsertMyCustomerProfile\s*\(/, 'firebase-api.js: missing upsertMyCustomerProfile()', errors);
assertContains(firebaseApi, /function\s+listCustomersPage\s*\(/, 'firebase-api.js: missing listCustomersPage()', errors);
assertContains(firebaseApi, /function\s+ensureSupportThreadByUid\s*\(/, 'firebase-api.js: missing ensureSupportThreadByUid()', errors);
assertContains(firebaseApi, /function\s+sendSupportMessageByUid\s*\(/, 'firebase-api.js: missing sendSupportMessageByUid()', errors);
assertContains(firebaseApi, /function\s+getSupportThreads\s*\(\s*limitCount\s*=\s*100\s*,\s*options\s*=\s*\{\}\s*\)/, 'firebase-api.js: getSupportThreads strict options missing', errors);
assertContains(firebaseApi, /function\s+getSupportMessages\s*\(\s*threadId\s*,\s*limitCount\s*=\s*200\s*,\s*options\s*=\s*\{\}\s*\)/, 'firebase-api.js: getSupportMessages strict options missing', errors);

assertContains(adminHtml, /id="suppliersSection"/, 'admin HTML: missing suppliers section', errors);
assertContains(adminHtml, /id="productCostPrice"/, 'admin HTML: missing product cost input', errors);
assertContains(adminHtml, /function\s+runProductsSchemaMigration\s*\(/, 'admin HTML: missing schema migration action', errors);
assertContains(adminHtml, /supportAccess\s*=\s*\{/, 'admin HTML: supportAccess state missing', errors);
assertContains(adminHtml, /function\s+handleSupportAccessError\s*\(/, 'admin HTML: support access error handler missing', errors);
assertContains(adminHtml, /id="supportAccessNotice"/, 'admin HTML: support access notice missing', errors);
assertContains(adminHtml, /id="usersPaginationMeta"/, 'admin HTML: users pagination meta missing', errors);
assertContains(adminHtml, /function\s+loadCustomersPage\s*\(/, 'admin HTML: loadCustomersPage() missing', errors);
assertContains(adminHtml, /listCustomersPage\s*\(/, 'admin HTML: listCustomersPage() usage missing', errors);
assertNotContains(adminHtml, /getAllUsers\s*\(/, 'admin HTML: legacy getAllUsers() usage still present', errors);
assertNotContains(adminHtml, /setStorageData\s*\(\s*['"]CUSTOMERS['"]/, 'admin HTML: legacy CUSTOMERS cache write still present', errors);
assertNotContains(adminHtml, /resetCustomerPassword\s*\('/, 'admin HTML: reset customer password action still present', errors);

assertContains(storeHtml, /product-search-worker\.js/, 'store HTML: missing worker reference path', errors);
assertContains(storeHtml, /id="productsPagination"/, 'store HTML: missing pagination container', errors);
assertContains(storeHtml, /function\s+runProductSearch\s*\(/, 'store HTML: missing runProductSearch()', errors);
assertContains(storeHtml, /id="loginIdentifier"/, 'store HTML: login identifier input not found', errors);
assertContains(storeHtml, /supportAccess\s*=\s*\{/, 'store HTML: supportAccess state missing', errors);
assertContains(storeHtml, /function\s+handleSupportAccessError\s*\(/, 'store HTML: support access error handler missing', errors);
assertContains(storeHtml, /function\s+fallbackSupportChatToFaq\s*\(/, 'store HTML: FAQ fallback handler missing', errors);
assertContains(storeHtml, /function\s+ensureVerifiedForSensitiveAction\s*\(/, 'store HTML: ensureVerifiedForSensitiveAction() missing', errors);
assertContains(storeHtml, /function\s+handleRegister\s*\(/, 'store HTML: register handler missing', errors);
assertContains(storeHtml, /function\s+handleLogin\s*\(/, 'store HTML: login handler missing', errors);
assertNotContains(storeHtml, /getAllUsers\s*\(/, 'store HTML: legacy getAllUsers() usage still present', errors);
assertNotContains(storeHtml, /setStorageData\s*\(\s*['"]CUSTOMERS['"]/, 'store HTML: legacy CUSTOMERS cache write still present', errors);
assertNotContains(storeHtml, /getStorageData\s*\(\s*['"]ORDERS['"]\s*\)/, 'store HTML: legacy ORDERS local source still present', errors);
assertNotContains(storeHtml, /setStorageData\s*\(\s*['"]ORDERS['"]\s*,/, 'store HTML: legacy ORDERS local write still present', errors);
assertNotContains(storeHtml, /customer_[^'"]+@salezone\.customer/, 'store HTML: legacy phone-auth email pattern still present', errors);

assertContains(firebaseConfig, /experimentalForceLongPolling:\s*true/, 'firebase-config.js: force long-polling not enabled', errors);
assertContains(firebaseData, /const\s+FIREBASE_POLLING_ENABLED\s*=\s*false/, 'firebase-data.js: polling fallback must be disabled', errors);
assertNotContains(realtimeSync, /getStorageData\s*\(\s*['"]PRODUCTS['"]\s*\)/, 'REAL_TIME_SYNC.js: products local sync should be removed', errors);
assertNotContains(realtimeSync, /getStorageData\s*\(\s*['"]COUPONS['"]\s*\)/, 'REAL_TIME_SYNC.js: coupons local sync should be removed', errors);
assertNotContains(realtimeSync, /getStorageData\s*\(\s*['"]BANNERS['"]\s*\)/, 'REAL_TIME_SYNC.js: banners local sync should be removed', errors);
assertContains(serviceWorker, /version\.json/, 'sw.js: version.json bypass guard missing', errors);
assertContains(serviceWorker, /CACHE_VERSION\s*=\s*'v6\.2\.0'/, 'sw.js: cache version was not bumped for rollout', errors);
assertContains(firestoreRules, /function\s+isAdmin\s*\(/, 'firestore.rules: isAdmin() missing', errors);
assertContains(firestoreRules, /request\.auth\.token\.email_verified\s*==\s*true/, 'firestore.rules: email_verified gate missing', errors);
assertContains(firestoreRules, /match\s+\/customers\/\{uid\}/, 'firestore.rules: customers uid match missing', errors);
assertContains(firestoreRules, /!\(\"password\"\s+in\s+request\.resource\.data\)/, 'firestore.rules: password field guard missing', errors);
assertContains(firestoreRules, /request\.resource\.data\.uid\s*==\s*request\.auth\.uid/, 'firestore.rules: uid ownership guard missing', errors);
assertContains(firestoreRules, /match\s+\/support_threads\/\{uid\}/, 'firestore.rules: support_threads uid match missing', errors);

if (errors.length) {
  console.error('Smoke check FAILED:');
  for (const item of errors) console.error(` - ${item}`);
  process.exit(1);
}

console.log('Smoke check OK: core free-first features detected.');
