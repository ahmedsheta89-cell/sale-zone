// Contract-level release checks for admin/store parity and regressions.
// Run: node tools/contracts-check.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertContains(content, pattern, message) {
  if (!pattern.test(content)) errors.push(message);
}

function assertNotContains(content, pattern, message) {
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

function resolveChangedFilesFromEventPayload() {
  const eventPath = String(process.env.GITHUB_EVENT_PATH || '').trim();
  if (!eventPath) return [];

  try {
    const raw = fs.readFileSync(eventPath, 'utf8');
    const payload = JSON.parse(raw);
    const files = [];

    if (payload && payload.head_commit) {
      const headCommit = payload.head_commit;
      for (const key of ['added', 'modified', 'removed']) {
        if (Array.isArray(headCommit[key])) files.push(...headCommit[key]);
      }
    }

    if (payload && Array.isArray(payload.commits)) {
      for (const commit of payload.commits) {
        if (!commit || typeof commit !== 'object') continue;
        for (const key of ['added', 'modified', 'removed']) {
          if (Array.isArray(commit[key])) files.push(...commit[key]);
        }
      }
    }

    return [...new Set(files.map((item) => String(item || '').trim()).filter(Boolean))];
  } catch (_) {
    return [];
  }
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
  candidates.push(runGit('git diff-tree --no-commit-id --name-only -r HEAD'));
  candidates.push(runGit('git diff-tree --no-commit-id --name-only -r --root HEAD'));
  candidates.push(runGit('git show --pretty="" --name-only HEAD'));

  for (const output of candidates) {
    const files = parseChangedFiles(output);
    if (files.length) return [...new Set(files)];
  }

  const eventFiles = resolveChangedFilesFromEventPayload();
  if (eventFiles.length) return eventFiles;

  return [];
}

const adminHtml = read('\u0627\u062f\u0645\u0646_2.HTML');
const storeHtml = read('\u0645\u062a\u062c\u0631_2.HTML');
const firebaseApi = read('firebase-api.js');
const worker = read('product-search-worker.js');
const functionsApp = read('functions/src/app.js');
const ordersRoute = read('functions/src/routes/orders.js');
const deployProductionWorkflow = read('.github/workflows/deploy-production.yml');
const deployBackendWorkflow = read('.github/workflows/deploy-backend.yml');

// 1) Admin CRUD parity for entities that already expose update APIs.
const parityMatrix = [
  {
    entity: 'Banner',
    apiPattern: /function\s+updateBanner\s*\(/,
    adminPattern: /function\s+editBanner\s*\(/
  },
  {
    entity: 'Coupon',
    apiPattern: /function\s+updateCoupon\s*\(/,
    adminPattern: /function\s+editCoupon\s*\(/
  }
];

for (const item of parityMatrix) {
  if (item.apiPattern.test(firebaseApi) && !item.adminPattern.test(adminHtml)) {
    errors.push(`contracts: ${item.entity} update API exists without admin edit handler.`);
  }
}

// 2) Orders filter contract presence.
assertContains(adminHtml, /id="ordersStatusFilter"/, 'contracts: orders status filter id missing.');
assertContains(adminHtml, /id="ordersSearchInput"/, 'contracts: orders search filter id missing.');
assertContains(adminHtml, /id="ordersDateFrom"/, 'contracts: orders date-from filter id missing.');
assertContains(adminHtml, /id="ordersDateTo"/, 'contracts: orders date-to filter id missing.');
assertContains(adminHtml, /function\s+applyOrdersFilters\s*\(/, 'contracts: applyOrdersFilters() missing.');
assertContains(adminHtml, /function\s+clearOrdersFilters\s*\(/, 'contracts: clearOrdersFilters() missing.');
assertContains(
  adminHtml,
  /listOrdersPage\s*\(\s*\{[\s\S]*status\s*:\s*ordersFilters\.status[\s\S]*dateFromIso\s*:\s*ordersFilters\.dateFromIso[\s\S]*dateToIso\s*:\s*ordersFilters\.dateToIso[\s\S]*searchText\s*:\s*ordersFilters\.searchText[\s\S]*\}\s*\)/,
  'contracts: listOrdersPage must receive status/date/search filters.'
);
assertContains(adminHtml, /GATE_STATE_SOURCE/, 'contracts: admin diagnostics log GATE_STATE_SOURCE missing.');
assertContains(adminHtml, /GATE_STATE_MISMATCH/, 'contracts: admin diagnostics log GATE_STATE_MISMATCH missing.');
assertContains(adminHtml, /GATE_STATE_DEGRADED_BACKEND_UNAVAILABLE/, 'contracts: admin diagnostics log GATE_STATE_DEGRADED_BACKEND_UNAVAILABLE missing.');

// 2.1) Banner sync path contract presence.
assertContains(
  adminHtml,
  /const\s+collectionTasks\s*=\s*await\s+Promise\.allSettled\s*\(\s*\[/,
  'contracts: admin loadAllData must isolate collection failures via Promise.allSettled.'
);
assertContains(
  adminHtml,
  /getAllBanners\s*\(\s*\)/,
  'contracts: admin loadAllData must fetch banners from backend/Firebase source.'
);
assertContains(
  adminHtml,
  /bannersResult\.status\s*===\s*'fulfilled'\s*&&\s*Array\.isArray\(bannersResult\.value\)/,
  'contracts: admin loadAllData must apply isolated fallback for banners.'
);
assertContains(
  firebaseApi,
  /callBackendApi\('\/v1\/banners'/,
  'contracts: firebase-api getBanners must preserve public backend fetch path.'
);
assertContains(
  storeHtml,
  /typeof getBanners === 'function'\s*\?\s*getBanners\(\)\s*:\s*Promise\.resolve\(null\)/,
  'contracts: store loadData must read banners from canonical getBanners path.'
);

// 3) Price contract matrix.
assertContains(storeHtml, /function\s+resolveDisplayPrice\s*\(/, 'contracts: store resolveDisplayPrice() missing.');
assertContains(storeHtml, /function\s+resolveComparablePrice\s*\(/, 'contracts: store resolveComparablePrice() missing.');
assertContains(worker, /function\s+resolveDisplayPrice\s*\(/, 'contracts: worker resolveDisplayPrice() missing.');
assertContains(worker, /function\s+resolveComparablePrice\s*\(/, 'contracts: worker resolveComparablePrice() missing.');
assertNotContains(storeHtml, /sellPrice\s*\|\|\s*price/, 'contracts: store uses forbidden sellPrice || price pattern.');
assertNotContains(firebaseApi, /sellPrice\s*\|\|\s*price/, 'contracts: firebase-api uses forbidden sellPrice || price pattern.');
assertNotContains(worker, /sellPrice\s*\|\|\s*price/, 'contracts: worker uses forbidden sellPrice || price pattern.');

// 4) Sensitive client changes must include version.json bump in the same diff range.
const sensitiveClientFiles = new Set([
  '\u0645\u062a\u062c\u0631_2.HTML',
  'firebase-api.js',
  'firebase-data.js',
  'firebase-config.js',
  'sw.js',
  'product-search-worker.js'
]);

const changedFiles = resolveChangedFiles();

if (!changedFiles.length && String(process.env.CI || '').toLowerCase() === 'true') {
  console.warn('contracts: unable to resolve changed files in CI; skipping strict version diff check.');
}

if (changedFiles.length) {
  const changedBasenames = changedFiles.map((file) => path.basename(file));
  const touchedSensitive = changedBasenames.some((name) => sensitiveClientFiles.has(name));
  const touchedVersion = changedBasenames.includes('version.json');
  if (touchedSensitive && !touchedVersion) {
    errors.push('contracts: sensitive client files changed without version.json bump.');
  }
}

// 5) Zero-trust backend enforcement guardrails.
assertNotContains(
  firebaseApi,
  /\.collection\('orders'\)\.(add|doc\([^)]*\)\.(set|update|delete))/,
  'contracts: direct Firestore orders write detected in firebase-api.js.'
);
assertContains(
  firebaseApi,
  /requireBackendApiForSensitiveWrite\('order-create'\)/,
  'contracts: addOrder must fail closed when backend API is unavailable.'
);
assertContains(
  firebaseApi,
  /callBackendApi\(`\/v1\/admin\/orders\/\$\{encodeURIComponent\(orderId\)\}\/status`/,
  'contracts: updateOrderStatus must use backend admin route.'
);
assertContains(
  firebaseApi,
  /requireBackendApiForSensitiveWrite\('settings-update'\)/,
  'contracts: saveSettings must fail closed when backend API is unavailable.'
);
assertContains(firebaseApi, /function\s+getReleaseGateState\s*\(/, 'contracts: getReleaseGateState() wrapper missing.');
assertContains(firebaseApi, /function\s+saveReleaseGateState\s*\(/, 'contracts: saveReleaseGateState() wrapper missing.');
assertContains(firebaseApi, /\/v1\/admin\/countdown/, 'contracts: canonical countdown backend path missing in firebase-api.js.');

// 6) Critical route middleware chain guard.
assertContains(
  functionsApp,
  /adminRouter\.use\(verifyAppCheck,\s*verifyAuth,\s*verifyAdmin,\s*adminRateLimiter\)/,
  'contracts: /v1/admin middleware chain is incomplete.'
);
assertContains(
  functionsApp,
  /app\.use\('\/v1\/orders',\s*verifyAppCheck,\s*verifyAuth,\s*ordersRateLimiter,\s*createOrdersRouter/,
  'contracts: /v1/orders middleware chain is incomplete.'
);
assertContains(
  functionsApp,
  /app\.use\('\/v1\/media',\s*verifyAppCheck,\s*verifyAuth,\s*verifyAdmin,\s*mediaRateLimiter,\s*createMediaRouter/,
  'contracts: /v1/media middleware chain is incomplete.'
);

// 7) Business logic invariants guard.
assertContains(
  ordersRoute,
  /payload\.requestedTotal !== null && Math\.abs\(payload\.requestedTotal - total\) > 0\.01/,
  'contracts: server-side order total mismatch invariant is missing.'
);
assertContains(
  ordersRoute,
  /nextStock < 0/,
  'contracts: oversell stock guard is missing.'
);
assertContains(
  ordersRoute,
  /assertReplayNotSeen\(\{/,
  'contracts: replay protection is missing for orders/media paths.'
);
assertContains(
  ordersRoute,
  /createAdminOrdersRouter/,
  'contracts: admin orders router (status updates) is missing.'
);
assertContains(deployBackendWorkflow, /workflow_dispatch:/, 'contracts: deploy-backend workflow_dispatch missing.');
assertContains(deployBackendWorkflow, /name:\s*backend-\$\{\{\s*github\.event\.inputs\.target_sha\s*\}\}/, 'contracts: deploy-backend artifact contract missing.');
assertContains(deployProductionWorkflow, /deploy-backend\.yml/, 'contracts: deploy-production must gate on deploy-backend.yml.');
assertContains(deployProductionWorkflow, /backend-metadata\.json/, 'contracts: deploy-production must verify backend metadata file.');

if (errors.length) {
  console.error('Contracts check FAILED:');
  for (const item of errors) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

console.log('Contracts check OK: parity, price, filters, and version guard validated.');
