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

let changedFiles = [];
const mergeBase = runGit('git merge-base HEAD origin/main');
if (mergeBase) {
  const diffOutput = runGit(`git diff --name-only ${mergeBase}..HEAD`);
  changedFiles = diffOutput ? diffOutput.split(/\r?\n/).filter(Boolean) : [];
}

if (!changedFiles.length) {
  const fallbackDiff = runGit('git diff --name-only HEAD~1 HEAD');
  changedFiles = fallbackDiff ? fallbackDiff.split(/\r?\n/).filter(Boolean) : [];
}

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
