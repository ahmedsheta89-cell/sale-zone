// Lightweight structural smoke checks for critical store/admin flows.
// Run: node tools/smoke-check.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function runGit(command) {
  try {
    return String(execSync(command, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore']
    }) || '').trim();
  } catch (_) {
    return '';
  }
}

function parseChangedFiles(output) {
  return output
    ? output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
}

function resolveChangedFiles() {
  const candidates = [];

  const mergeBaseMain = runGit('git merge-base HEAD origin/main');
  if (mergeBaseMain) {
    candidates.push(runGit(`git diff --name-only ${mergeBaseMain}..HEAD`));
  }

  const baseRef = String(process.env.GITHUB_BASE_REF || '').trim();
  if (baseRef && /^[A-Za-z0-9._/-]+$/.test(baseRef)) {
    const baseRemoteRef = `origin/${baseRef}`;
    let mergeBaseBaseRef = runGit(`git merge-base HEAD ${baseRemoteRef}`);
    if (!mergeBaseBaseRef) {
      runGit(`git fetch --no-tags --depth=200 origin +refs/heads/${baseRef}:refs/remotes/origin/${baseRef}`);
      mergeBaseBaseRef = runGit(`git merge-base HEAD ${baseRemoteRef}`);
    }
    if (mergeBaseBaseRef) {
      candidates.push(runGit(`git diff --name-only ${mergeBaseBaseRef}..HEAD`));
    }
  }

  const eventBefore = String(process.env.GITHUB_EVENT_BEFORE || '').trim();
  const eventSha = String(process.env.GITHUB_SHA || '').trim();
  if (
    eventBefore &&
    eventSha &&
    eventBefore !== '0000000000000000000000000000000000000000' &&
    /^[0-9a-f]{40}$/i.test(eventBefore) &&
    /^[0-9a-f]{40}$/i.test(eventSha)
  ) {
    candidates.push(runGit(`git diff --name-only ${eventBefore}..${eventSha}`));
  }

  candidates.push(runGit('git diff --name-only HEAD^1 HEAD'));
  candidates.push(runGit('git diff --name-only HEAD~1 HEAD'));
  candidates.push(runGit('git show --pretty="" --name-only HEAD'));

  for (const output of candidates) {
    const files = parseChangedFiles(output);
    if (files.length) return [...new Set(files)];
  }

  return [];
}

const errors = [];

const adminHtml = read('\u0627\u062f\u0645\u0646_2.HTML');
const storeHtml = read('\u0645\u062a\u062c\u0631_2.HTML');
const firebaseApi = read('assets/js/firebase-api.js');
const firebaseConfig = read('assets/js/firebase-config.js');
const firebaseData = read('assets/js/firebase-data.js');
const productSearchWorker = read('assets/js/product-search-worker.js');
const realtimeSync = read('assets/js/REAL_TIME_SYNC.js');
const serviceWorker = read('sw.js');
const firestoreRules = read('firestore.rules');
const securityUtils = read('assets/js/security-utils.js');
const coreLogger = read('assets/js/core/logger.js');
const adminMonitorScript = read('tools/admin-function-monitor.js');
const adminRegistryGeneratorScript = read('tools/generate-admin-function-registry.js');
const adminFunctionPolicy = read('monitoring/admin-function-policy.json');
const adminFunctionRegistry = read('monitoring/admin-function-registry.json');
const deployProductionWorkflow = read('.github/workflows/deploy-production.yml');
const deployBackendWorkflowPath = path.join(root, '.github/workflows/deploy-backend.yml');
const deployBackendWorkflow = fs.existsSync(deployBackendWorkflowPath) ? read('.github/workflows/deploy-backend.yml') : '';

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
assertContains(firebaseApi, /async function getReleaseGateState\s*\(/, 'firebase-api.js: missing getReleaseGateState() wrapper', errors);
assertContains(firebaseApi, /async function saveReleaseGateState\s*\(/, 'firebase-api.js: missing saveReleaseGateState() wrapper', errors);
assertContains(firebaseApi, /error\.code\s*=\s*['"]BACKEND_REQUIRED['"]/, 'firebase-api.js: BACKEND_REQUIRED fail-closed code missing', errors);
assertContains(firebaseApi, /window\.ReleaseGateStateAPI\s*=/, 'firebase-api.js: ReleaseGateStateAPI browser bridge missing', errors);
assertContains(firebaseApi, /module\.exports/, 'firebase-api.js: ReleaseGateStateAPI module bridge missing', errors);
assertContains(firebaseApi, /function\s+ensureSupportThreadByUid\s*\(/, 'firebase-api.js: missing ensureSupportThreadByUid()', errors);
assertContains(firebaseApi, /function\s+sendSupportMessageByUid\s*\(/, 'firebase-api.js: missing sendSupportMessageByUid()', errors);
assertContains(firebaseApi, /function\s+getSupportThreads\s*\(\s*limitCount\s*=\s*100\s*,\s*options\s*=\s*\{\}\s*\)/, 'firebase-api.js: getSupportThreads strict options missing', errors);
assertContains(firebaseApi, /function\s+getSupportMessages\s*\(\s*threadId\s*,\s*limitCount\s*=\s*200\s*,\s*options\s*=\s*\{\}\s*\)/, 'firebase-api.js: getSupportMessages strict options missing', errors);

assertContains(adminHtml, /id="suppliersSection"/, 'admin HTML: missing suppliers section', errors);
assertContains(adminHtml, /security-utils\.js/, 'admin HTML: missing security-utils.js include', errors);
assertContains(adminHtml, /core\/logger\.js/, 'admin HTML: missing core/logger.js include', errors);
assertContains(adminHtml, /id="productCostPrice"/, 'admin HTML: missing product cost input', errors);
assertContains(adminHtml, /function\s+runProductsSchemaMigration\s*\(/, 'admin HTML: missing schema migration action', errors);
assertContains(adminHtml, /supportAccess\s*=\s*\{/, 'admin HTML: supportAccess state missing', errors);
assertContains(adminHtml, /storeOpsAccess\s*=\s*\{/, 'admin HTML: storeOpsAccess state missing', errors);
assertContains(adminHtml, /function\s+handleSupportAccessError\s*\(/, 'admin HTML: support access error handler missing', errors);
assertContains(adminHtml, /function\s+handleStoreOpsAccessError\s*\(/, 'admin HTML: store operations access error handler missing', errors);
assertContains(adminHtml, /function\s+canUseStoreOps\s*\(/, 'admin HTML: canUseStoreOps guard missing', errors);
assertContains(adminHtml, /id="supportAccessNotice"/, 'admin HTML: support access notice missing', errors);
assertContains(adminHtml, /id="storeOpsAccessNotice"/, 'admin HTML: store operations access notice missing', errors);
assertContains(
  adminHtml,
  /async\s+function\s+startStoreOperationsMonitoring\s*\([\s\S]*await\s+requireAdminPermission\(\)[\s\S]*subscribeStoreEvents\(/,
  'admin HTML: store operations must require admin permission before subscriptions',
  errors
);
assertContains(adminHtml, /id="usersPaginationMeta"/, 'admin HTML: users pagination meta missing', errors);
assertContains(adminHtml, /function\s+loadCustomersPage\s*\(/, 'admin HTML: loadCustomersPage() missing', errors);
assertContains(adminHtml, /listCustomersPage\s*\(/, 'admin HTML: listCustomersPage() usage missing', errors);
assertContains(adminHtml, /id="ordersPaginationMeta"/, 'admin HTML: orders pagination meta missing', errors);
assertContains(adminHtml, /function\s+loadOrdersPage\s*\(/, 'admin HTML: loadOrdersPage() missing', errors);
assertContains(adminHtml, /id="ordersStatusFilter"/, 'admin HTML: orders status filter missing', errors);
assertContains(adminHtml, /id="ordersSearchInput"/, 'admin HTML: orders search input missing', errors);
assertContains(adminHtml, /id="ordersDateFrom"/, 'admin HTML: orders date-from input missing', errors);
assertContains(adminHtml, /id="ordersDateTo"/, 'admin HTML: orders date-to input missing', errors);
assertContains(adminHtml, /function\s+clearOrdersFilters\s*\(/, 'admin HTML: clearOrdersFilters() missing', errors);
assertContains(adminHtml, /function\s+applyOrdersFilters\s*\(/, 'admin HTML: applyOrdersFilters() missing', errors);
// WHY: accept the explicit canonical helper OR direct backend fetch flow in the 24h gate monitor.
const hasCanonicalAdmin24hHelper = /function\s+fetchCanonicalAdmin24hState\s*\(/.test(adminHtml);
// WHY: support backend-authoritative fetch flow currently implemented inside checkAdmin24hChangeAlert().
const hasInlineBackendGateFetchFlow =
  /typeof\s+getReleaseGateState\s*!==\s*['"]function['"]/.test(adminHtml) &&
  /await\s+getReleaseGateState\s*\(\s*\{\s*retries\s*:\s*1\s*\}\s*\)/.test(adminHtml);
// WHY: fail only if both canonical contract forms are absent.
if (!hasCanonicalAdmin24hHelper && !hasInlineBackendGateFetchFlow) {
  errors.push('admin HTML: missing backend canonical release-gate fetch helper');
}
assertContains(adminHtml, /GATE_STATE_SOURCE/, 'admin HTML: missing GATE_STATE_SOURCE diagnostics', errors);
assertContains(adminHtml, /GATE_STATE_MISMATCH/, 'admin HTML: missing GATE_STATE_MISMATCH diagnostics', errors);
assertContains(adminHtml, /GATE_STATE_DEGRADED_BACKEND_UNAVAILABLE/, 'admin HTML: missing DEGRADED backend diagnostics', errors);
assertContains(adminHtml, /function\s+editBanner\s*\(/, 'admin HTML: banner edit handler missing', errors);
assertContains(adminHtml, /function\s+editCoupon\s*\(/, 'admin HTML: coupon edit handler missing', errors);
assertContains(adminHtml, /id="admin24hGateBadge"/, 'admin HTML: 24h gate badge missing', errors);
assertContains(adminHtml, /id="admin24hTimeline"/, 'admin HTML: 24h gate timeline missing', errors);
assertContains(adminHtml, /function\s+hasAdminClaimFromTokenResult\s*\(/, 'admin HTML: admin claim validator missing', errors);
assertContains(adminHtml, /id="adminFunctionsTable"/, 'admin HTML: admin function monitor table missing', errors);
assertContains(adminHtml, /function\s+refreshAdminFunctionMonitorView\s*\(/, 'admin HTML: admin function monitor loader missing', errors);
assertContains(adminHtml, /function\s+applyAdminFunctionFilters\s*\(/, 'admin HTML: admin function monitor filters missing', errors);
assertNotContains(adminHtml, /getAllUsers\s*\(/, 'admin HTML: legacy getAllUsers() usage still present', errors);
assertNotContains(adminHtml, /setStorageData\s*\(\s*['"]CUSTOMERS['"]/, 'admin HTML: legacy CUSTOMERS cache write still present', errors);
assertNotContains(adminHtml, /resetCustomerPassword\s*\('/, 'admin HTML: reset customer password action still present', errors);
assertNotContains(adminHtml, /ALLOW_BOOTSTRAP_ADMIN/, 'admin HTML: bootstrap admin flag must be removed', errors);
assertNotContains(adminHtml, /\$\{o\.customer\?\.name\s*\|\|\s*'-'\}/, 'admin HTML: orders table still renders raw customer name', errors);
assertNotContains(adminHtml, /\$\{u\.email\s*\|\|\s*'-'\}/, 'admin HTML: users table still renders raw email', errors);
assertNotContains(adminHtml, /innerHTML\s*=\s*`[^`]*\$\{\s*o\.customer/, 'admin HTML: innerHTML contains raw order customer payload', errors);
assertNotContains(adminHtml, /innerHTML\s*=\s*`[^`]*\$\{\s*u\.email/, 'admin HTML: innerHTML contains raw user email payload', errors);
assertNotContains(adminHtml, /onclick="[^"]*'\$\{[^"]+\}'[^"]*"/, 'admin HTML: inline onclick still injects dynamic string payload', errors);
assertNotContains(adminHtml, /window\.onerror\s*=/, 'admin HTML: direct window.onerror assignment is not allowed', errors);
assertNotContains(adminHtml, /window\.onunhandledrejection\s*=/, 'admin HTML: direct window.onunhandledrejection assignment is not allowed', errors);
assertNotContains(adminHtml, /requiredPatterns/, 'admin HTML: sensitive pattern internals must not be rendered in UI', errors);
assertNotContains(adminHtml, /regexValidationFindings/, 'admin HTML: sensitive regex internals must not be rendered in UI', errors);
assertNotContains(adminHtml, /console\.error\(\s*['"]store events listener error:/, 'admin HTML: noisy store events listener console.error should be removed', errors);
assertNotContains(adminHtml, /console\.error\(\s*['"]live sessions listener error:/, 'admin HTML: noisy live sessions listener console.error should be removed', errors);
assertNotContains(adminHtml, /console\.error\(\s*['"]support messages listener error:/, 'admin HTML: noisy support messages listener console.error should be removed', errors);
assertNotContains(adminHtml, /console\.error\(\s*['"]support threads listener error:/, 'admin HTML: noisy support threads listener console.error should be removed', errors);

assertContains(storeHtml, /product-search-worker\.js/, 'store HTML: missing worker reference path', errors);
assertContains(storeHtml, /security-utils\.js/, 'store HTML: missing security-utils.js include', errors);
assertContains(storeHtml, /core\/logger\.js/, 'store HTML: missing core/logger.js include', errors);
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
assertContains(storeHtml, /function\s+resolveDisplayPrice\s*\(/, 'store HTML: resolveDisplayPrice() missing', errors);
assertContains(storeHtml, /function\s+resolveComparablePrice\s*\(/, 'store HTML: resolveComparablePrice() missing', errors);
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
assertNotContains(storeHtml, /window\.onerror\s*=/, 'store HTML: direct window.onerror assignment is not allowed', errors);
assertNotContains(storeHtml, /window\.onunhandledrejection\s*=/, 'store HTML: direct window.onunhandledrejection assignment is not allowed', errors);
assertNotContains(storeHtml, /sellPrice\s*\|\|\s*price/, 'store HTML: legacy sellPrice || price anti-pattern still present', errors);
assertNotContains(firebaseApi, /sellPrice\s*\|\|\s*price/, 'firebase-api.js: legacy sellPrice || price anti-pattern still present', errors);
assertNotContains(productSearchWorker, /sellPrice\s*\|\|\s*price/, 'product-search-worker.js: legacy sellPrice || price anti-pattern still present', errors);

assertContains(firebaseConfig, /experimentalForceLongPolling:\s*true/, 'firebase-config.js: force long-polling not enabled', errors);
assertContains(firebaseConfig, /intervalReconnectRequested/, 'firebase-config.js: interval reconnect request guard missing', errors);
assertContains(firebaseConfig, /&&\s*isGithubPages\s*!==\s*true/, 'firebase-config.js: interval reconnect must be blocked on GitHub Pages', errors);
assertContains(firebaseConfig, /&&\s*forcePollingTransport\s*!==\s*true/, 'firebase-config.js: interval reconnect must be blocked on long-polling mode', errors);
assertContains(firebaseData, /const\s+FIREBASE_POLLING_ENABLED\s*=\s*false/, 'firebase-data.js: polling fallback must be disabled in current release cycle', errors);
assertContains(firebaseData, /createResubscribingSnapshot\s*\(/, 'firebase-data.js: realtime auto-resubscribe guard missing', errors);
assertNotContains(realtimeSync, /getStorageData\s*\(\s*['"]PRODUCTS['"]\s*\)/, 'REAL_TIME_SYNC.js: products local sync should be removed', errors);
assertNotContains(realtimeSync, /getStorageData\s*\(\s*['"]COUPONS['"]\s*\)/, 'REAL_TIME_SYNC.js: coupons local sync should be removed', errors);
assertNotContains(realtimeSync, /getStorageData\s*\(\s*['"]BANNERS['"]\s*\)/, 'REAL_TIME_SYNC.js: banners local sync should be removed', errors);
assertContains(serviceWorker, /version\.json/, 'sw.js: version.json bypass guard missing', errors);
assertContains(serviceWorker, /CACHE_VERSION\s*=\s*'v6\.2\.3'/, 'sw.js: cache version was not bumped for rollout', errors);
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
assertContains(coreLogger, /__isCentralLogger/, 'core/logger.js: central logger marker missing', errors);
assertContains(coreLogger, /global\.logger\s*=\s*logger/, 'core/logger.js: global logger export missing', errors);
assertContains(coreLogger, /addEventListener\('error'/, 'core/logger.js: global error handler missing', errors);
assertContains(coreLogger, /addEventListener\('unhandledrejection'/, 'core/logger.js: global rejection handler missing', errors);
assertContains(coreLogger, /addClientErrorLog/, 'core/logger.js: remote client error logging hook missing', errors);
assertContains(adminMonitorScript, /compileCriticalRegex/, 'admin-function-monitor.js: compileCriticalRegex helper missing', errors);
assertContains(adminMonitorScript, /new\s+RegExp\(/, 'admin-function-monitor.js: regex-based validation missing', errors);
assertContains(adminMonitorScript, /POLICY_INVALID_REGEX/, 'admin-function-monitor.js: invalid policy regex guard missing', errors);
assertContains(adminMonitorScript, /CRITICAL_FUNCTION_MISSING/, 'admin-function-monitor.js: missing critical function guard missing', errors);
assertContains(adminMonitorScript, /REGISTRY_DRIFT|REGISTRY_HASH_MISMATCH/, 'admin-function-monitor.js: registry drift guard missing', errors);
assertContains(adminRegistryGeneratorScript, /function\s+generateRegistryArtifact\s*\(/, 'generate-admin-function-registry.js: registry generator entry missing', errors);
assertContains(adminRegistryGeneratorScript, /registryHash/, 'generate-admin-function-registry.js: registry hash generation missing', errors);
assertContains(adminFunctionPolicy, /"policyVersion"\s*:/, 'admin-function-policy.json: policyVersion field missing', errors);
assertContains(adminFunctionPolicy, /"criticalFunctions"\s*:/, 'admin-function-policy.json: criticalFunctions section missing', errors);
assertContains(adminFunctionPolicy, /"groupRules"\s*:/, 'admin-function-policy.json: groupRules section missing', errors);
assertContains(adminFunctionRegistry, /"registryHash"\s*:/, 'admin-function-registry.json: registryHash field missing', errors);
assertContains(adminFunctionRegistry, /"sourceHash"\s*:/, 'admin-function-registry.json: sourceHash field missing', errors);
assertContains(adminFunctionRegistry, /"policyHash"\s*:/, 'admin-function-registry.json: policyHash field missing', errors);
assertContains(deployBackendWorkflow, /name:\s*Deploy Backend/, 'workflow: deploy-backend.yml is missing', errors);
assertContains(deployBackendWorkflow, /project_id:\s*[\s\S]*required:\s*true/, 'workflow: deploy-backend must require project_id input', errors);
assertContains(deployBackendWorkflow, /if:\s*\$\{\{\s*inputs\.target_sha\s*!=\s*''\s*\}\}/, 'workflow: deploy-backend must fail closed when target_sha is empty', errors);
assertContains(deployBackendWorkflow, /fetch-depth:\s*0/, 'workflow: deploy-backend checkout must use fetch-depth: 0', errors);
assertContains(deployBackendWorkflow, /"commitSha"\s*:/, 'workflow: deploy-backend metadata commitSha key missing', errors);
assertContains(deployBackendWorkflow, /"workflow"\s*:\s*"deploy-backend"/, 'workflow: deploy-backend metadata workflow key missing', errors);
assertContains(deployBackendWorkflow, /"createdAtUtc"\s*:/, 'workflow: deploy-backend metadata createdAtUtc key missing', errors);
assertContains(deployBackendWorkflow, /"functionsDeployed"\s*:\s*true/, 'workflow: deploy-backend metadata functionsDeployed=true missing', errors);
assertContains(deployBackendWorkflow, /"indexesAttempted"\s*:\s*true/, 'workflow: deploy-backend metadata indexesAttempted=true missing', errors);
assertContains(deployProductionWorkflow, /deploy-backend\.yml/, 'workflow: deploy-production must require deploy-backend.yml in verify-gates', errors);
assertContains(deployProductionWorkflow, /backend-\$\{targetSha\}/, 'workflow: deploy-production must assert backend artifact name by SHA', errors);
assertContains(deployProductionWorkflow, /Validate backend metadata artifact/, 'workflow: deploy-production backend metadata validation step missing', errors);
assertContains(deployProductionWorkflow, /backend metadata commitSha mismatch/, 'workflow: deploy-production must hard fail on backend metadata SHA mismatch', errors);

const sensitiveClientFiles = new Set([
  '\u0645\u062a\u062c\u0631_2.HTML',
  'firebase-api.js',
  'firebase-data.js',
  'firebase-config.js',
  'sw.js',
  'product-search-worker.js'
]);

const changedFiles = resolveChangedFiles();

if (changedFiles.length) {
  const changedBasenames = changedFiles.map((file) => path.basename(file));
  const touchedSensitive = changedBasenames.some((name) => sensitiveClientFiles.has(name));
  const touchedVersion = changedBasenames.includes('version.json');
  if (touchedSensitive && !touchedVersion) {
    errors.push('version guard: sensitive client files changed without version.json bump');
  }
} else if (String(process.env.CI || '').toLowerCase() === 'true') {
  errors.push('version guard: unable to resolve changed files in CI');
}

if (errors.length) {
  console.error('Smoke check FAILED:');
  for (const item of errors) console.error(` - ${item}`);
  process.exit(1);
}

console.log('Smoke check OK: core free-first features detected.');
