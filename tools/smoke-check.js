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
const securityUtils = read('security-utils.js');

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
assertContains(firebaseApi, /function\s+listOrdersPage\s*\(/, 'firebase-api.js: missing listOrdersPage()', errors);
assertContains(firebaseApi, /function\s+ensureSupportThreadByUid\s*\(/, 'firebase-api.js: missing ensureSupportThreadByUid()', errors);
assertContains(firebaseApi, /function\s+sendSupportMessageByUid\s*\(/, 'firebase-api.js: missing sendSupportMessageByUid()', errors);
assertContains(firebaseApi, /function\s+getSupportThreads\s*\(\s*limitCount\s*=\s*100\s*,\s*options\s*=\s*\{\}\s*\)/, 'firebase-api.js: getSupportThreads strict options missing', errors);
assertContains(firebaseApi, /function\s+getSupportMessages\s*\(\s*threadId\s*,\s*limitCount\s*=\s*200\s*,\s*options\s*=\s*\{\}\s*\)/, 'firebase-api.js: getSupportMessages strict options missing', errors);

assertContains(adminHtml, /id="suppliersSection"/, 'admin HTML: missing suppliers section', errors);
assertContains(adminHtml, /security-utils\.js/, 'admin HTML: missing security-utils.js include', errors);
assertContains(adminHtml, /id="productCostPrice"/, 'admin HTML: missing product cost input', errors);
assertContains(adminHtml, /function\s+runProductsSchemaMigration\s*\(/, 'admin HTML: missing schema migration action', errors);
assertContains(adminHtml, /supportAccess\s*=\s*\{/, 'admin HTML: supportAccess state missing', errors);
assertContains(adminHtml, /function\s+handleSupportAccessError\s*\(/, 'admin HTML: support access error handler missing', errors);
assertContains(adminHtml, /id="supportAccessNotice"/, 'admin HTML: support access notice missing', errors);
assertContains(adminHtml, /id="usersPaginationMeta"/, 'admin HTML: users pagination meta missing', errors);
assertContains(adminHtml, /function\s+loadCustomersPage\s*\(/, 'admin HTML: loadCustomersPage() missing', errors);
assertContains(adminHtml, /listCustomersPage\s*\(/, 'admin HTML: listCustomersPage() usage missing', errors);
assertContains(adminHtml, /id="ordersPaginationMeta"/, 'admin HTML: orders pagination meta missing', errors);
assertContains(adminHtml, /function\s+loadOrdersPage\s*\(/, 'admin HTML: loadOrdersPage() missing', errors);
assertContains(adminHtml, /function\s+hasAdminClaimFromTokenResult\s*\(/, 'admin HTML: admin claim validator missing', errors);
assertNotContains(adminHtml, /getAllUsers\s*\(/, 'admin HTML: legacy getAllUsers() usage still present', errors);
assertNotContains(adminHtml, /setStorageData\s*\(\s*['"]CUSTOMERS['"]/, 'admin HTML: legacy CUSTOMERS cache write still present', errors);
assertNotContains(adminHtml, /resetCustomerPassword\s*\('/, 'admin HTML: reset customer password action still present', errors);
assertNotContains(adminHtml, /ALLOW_BOOTSTRAP_ADMIN/, 'admin HTML: bootstrap admin flag must be removed', errors);
assertNotContains(adminHtml, /\$\{o\.customer\?\.name\s*\|\|\s*'-'\}/, 'admin HTML: orders table still renders raw customer name', errors);
assertNotContains(adminHtml, /\$\{u\.email\s*\|\|\s*'-'\}/, 'admin HTML: users table still renders raw email', errors);
assertNotContains(adminHtml, /innerHTML\s*=\s*`[^`]*\$\{\s*o\.customer/, 'admin HTML: innerHTML contains raw order customer payload', errors);
assertNotContains(adminHtml, /innerHTML\s*=\s*`[^`]*\$\{\s*u\.email/, 'admin HTML: innerHTML contains raw user email payload', errors);
assertNotContains(adminHtml, /onclick="[^"]*'\$\{[^"]+\}'[^"]*"/, 'admin HTML: inline onclick still injects dynamic string payload', errors);

assertContains(storeHtml, /product-search-worker\.js/, 'store HTML: missing worker reference path', errors);
assertContains(storeHtml, /security-utils\.js/, 'store HTML: missing security-utils.js include', errors);
assertContains(storeHtml, /id="productsPagination"/, 'store HTML: missing pagination container', errors);
assertContains(storeHtml, /function\s+runProductSearch\s*\(/, 'store HTML: missing runProductSearch()', errors);
assertContains(storeHtml, /id="loginIdentifier"/, 'store HTML: login identifier input not found', errors);
assertContains(storeHtml, /supportAccess\s*=\s*\{/, 'store HTML: supportAccess state missing', errors);
assertContains(storeHtml, /function\s+handleSupportAccessError\s*\(/, 'store HTML: support access error handler missing', errors);
assertContains(storeHtml, /function\s+fallbackSupportChatToFaq\s*\(/, 'store HTML: FAQ fallback handler missing', errors);
assertContains(storeHtml, /function\s+ensureVerifiedForSensitiveAction\s*\(/, 'store HTML: ensureVerifiedForSensitiveAction() missing', errors);
assertContains(storeHtml, /function\s+handleRegister\s*\(/, 'store HTML: register handler missing', errors);
assertContains(storeHtml, /function\s+handleLogin\s*\(/, 'store HTML: login handler missing', errors);
assertContains(storeHtml, /idempotencyKey/, 'store HTML: order idempotency key wiring missing', errors);
assertNotContains(storeHtml, /getAllUsers\s*\(/, 'store HTML: legacy getAllUsers() usage still present', errors);
assertNotContains(storeHtml, /setStorageData\s*\(\s*['"]CUSTOMERS['"]/, 'store HTML: legacy CUSTOMERS cache write still present', errors);
assertNotContains(storeHtml, /getStorageData\s*\(\s*['"]ORDERS['"]\s*\)/, 'store HTML: legacy ORDERS local source still present', errors);
assertNotContains(storeHtml, /setStorageData\s*\(\s*['"]ORDERS['"]\s*,/, 'store HTML: legacy ORDERS local write still present', errors);
assertNotContains(storeHtml, /customer_[^'"]+@salezone\.customer/, 'store HTML: legacy phone-auth email pattern still present', errors);
assertNotContains(storeHtml, /onclick="filterByCategory\('\$\{b\.category/, 'store HTML: banner category still injected into inline handler', errors);
assertNotContains(storeHtml, /onclick="copyCoupon\('\$\{c\.code\}'\)"/, 'store HTML: coupon code still injected into inline handler', errors);
assertNotContains(storeHtml, /<div class="notification-title">\$\{title\}<\/div>/, 'store HTML: notification title still injected via innerHTML', errors);
assertNotContains(storeHtml, /innerHTML\s*=\s*`[^`]*\$\{\s*p\.(name|desc)\b/, 'store HTML: innerHTML contains raw product text payload', errors);
assertNotContains(storeHtml, /innerHTML\s*=\s*`[^`]*\$\{\s*c\.(code|desc)\b/, 'store HTML: innerHTML contains raw coupon payload', errors);
assertNotContains(storeHtml, /onclick="[^"]*'\$\{[^"]+\}'[^"]*"/, 'store HTML: inline onclick still injects dynamic string payload', errors);

assertContains(firebaseConfig, /experimentalForceLongPolling:\s*true/, 'firebase-config.js: force long-polling not enabled', errors);
assertContains(firebaseData, /const\s+FIREBASE_POLLING_ENABLED\s*=\s*false/, 'firebase-data.js: polling fallback must be disabled', errors);
assertContains(firebaseData, /createResubscribingSnapshot\s*\(/, 'firebase-data.js: realtime auto-resubscribe guard missing', errors);
assertNotContains(realtimeSync, /getStorageData\s*\(\s*['"]PRODUCTS['"]\s*\)/, 'REAL_TIME_SYNC.js: products local sync should be removed', errors);
assertNotContains(realtimeSync, /getStorageData\s*\(\s*['"]COUPONS['"]\s*\)/, 'REAL_TIME_SYNC.js: coupons local sync should be removed', errors);
assertNotContains(realtimeSync, /getStorageData\s*\(\s*['"]BANNERS['"]\s*\)/, 'REAL_TIME_SYNC.js: banners local sync should be removed', errors);
assertContains(serviceWorker, /version\.json/, 'sw.js: version.json bypass guard missing', errors);
assertContains(serviceWorker, /CACHE_VERSION\s*=\s*'v6\.2\.2'/, 'sw.js: cache version was not bumped for rollout', errors);
assertContains(firestoreRules, /function\s+isAdmin\s*\(/, 'firestore.rules: isAdmin() missing', errors);
assertContains(firestoreRules, /request\.auth\.token\.email_verified\s*==\s*true/, 'firestore.rules: email_verified gate missing', errors);
assertNotContains(firestoreRules, /isBootstrapAdminEmail/, 'firestore.rules: bootstrap admin fallback must be removed', errors);
assertContains(firestoreRules, /match\s+\/customers\/\{uid\}/, 'firestore.rules: customers uid match missing', errors);
assertContains(firestoreRules, /!\(\"password\"\s+in\s+request\.resource\.data\)/, 'firestore.rules: password field guard missing', errors);
assertContains(firestoreRules, /request\.resource\.data\.uid\s*==\s*request\.auth\.uid/, 'firestore.rules: uid ownership guard missing', errors);
assertContains(firestoreRules, /match\s+\/order_queue\/\{queueId\}/, 'firestore.rules: order_queue match missing', errors);
assertContains(firestoreRules, /match\s+\/order_events\/\{eventId\}/, 'firestore.rules: order_events match missing', errors);
assertContains(firestoreRules, /match\s+\/audit_logs\/\{logId\}/, 'firestore.rules: audit_logs match missing', errors);
assertContains(firestoreRules, /match\s+\/support_threads\/\{uid\}/, 'firestore.rules: support_threads uid match missing', errors);
assertContains(firestoreRules, /allow create:\s*if isVerifiedUser\(\)\s*&&\s*isValidClientErrorCreate\(\)/, 'firestore.rules: client_error_logs create must require verified user', errors);
assertContains(firestoreRules, /allow create:\s*if isAdmin\(\)\s*\|\|\s*\(isVerifiedUser\(\)\s*&&\s*isValidStoreEventCreate\(\)\)/, 'firestore.rules: store_events create must require admin or verified user', errors);
assertContains(firestoreRules, /request\.resource\.data\.sessionId == sessionId/, 'firestore.rules: live session path/sessionId guard missing', errors);
assertContains(securityUtils, /function\s+escapeHtml\s*\(/, 'security-utils.js: escapeHtml helper missing', errors);

if (errors.length) {
  console.error('Smoke check FAILED:');
  for (const item of errors) console.error(` - ${item}`);
  process.exit(1);
}

console.log('Smoke check OK: core free-first features detected.');
