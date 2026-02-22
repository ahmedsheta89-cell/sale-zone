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

const adminHtml = read('\u0627\u062f\u0645\u0646_2.HTML');
const storeHtml = read('\u0645\u062a\u062c\u0631_2.HTML');
const firebaseApi = read('firebase-api.js');
const worker = read('product-search-worker.js');

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
  errors.push('contracts: unable to resolve changed files for version.json guard.');
}

if (changedFiles.length) {
  const changedBasenames = changedFiles.map((file) => path.basename(file));
  const touchedSensitive = changedBasenames.some((name) => sensitiveClientFiles.has(name));
  const touchedVersion = changedBasenames.includes('version.json');
  if (touchedSensitive && !touchedVersion) {
    errors.push('contracts: sensitive client files changed without version.json bump.');
  }
}

if (errors.length) {
  console.error('Contracts check FAILED:');
  for (const item of errors) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

console.log('Contracts check OK: parity, price, filters, and version guard validated.');
