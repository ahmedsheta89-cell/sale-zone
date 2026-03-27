const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const errors = [];
const warnings = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertContains(content, pattern, message) {
  if (!pattern.test(content)) errors.push(message);
}

function assertNotContains(content, pattern, message) {
  if (pattern.test(content)) errors.push(message);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function isFunctionDefined(content, fn) {
  const escaped = escapeRegex(fn);
  const patterns = [
    new RegExp(`(?:async\\s+)?function\\s+${escaped}\\s*\\(`),
    new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s+)?function\\s*\\(`),
    new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=\\s*\\([^)]*\\)\\s*=>`),
    new RegExp(`window\\.${escaped}\\s*=\\s*(?:async\\s+)?function\\s*\\(`),
    new RegExp(`window\\.${escaped}\\s*=\\s*\\([^)]*\\)\\s*=>`)
  ];
  return patterns.some((pattern) => pattern.test(content));
}

function stripFunctionDefinitions(content, fn) {
  const escaped = escapeRegex(fn);
  const patterns = [
    new RegExp(`(?:async\\s+)?function\\s+${escaped}\\s*\\(`, 'g'),
    new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s+)?function\\s*\\(`, 'g'),
    new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=\\s*\\([^)]*\\)\\s*=>`, 'g'),
    new RegExp(`window\\.${escaped}\\s*=\\s*(?:async\\s+)?function\\s*\\(`, 'g'),
    new RegExp(`window\\.${escaped}\\s*=\\s*\\([^)]*\\)\\s*=>`, 'g')
  ];
  let stripped = content;
  for (const pattern of patterns) {
    stripped = stripped.replace(pattern, '');
  }
  return stripped;
}

function isFunctionCalled(content, fn) {
  const searchable = stripFunctionDefinitions(content, fn);
  return new RegExp(`\\b${escapeRegex(fn)}\\s*\\(`).test(searchable);
}

const adminHtml = read('ادمن_2.HTML');
const storeHtml = read('متجر_2.HTML');
const firebaseApi = read('assets/js/firebase-api.js');
const worker = read('assets/js/product-search-worker.js');
const deployProductionWorkflow = read('.github/workflows/deploy-production.yml');
const deployBackendWorkflow = read('.github/workflows/deploy-backend.yml');

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

assertContains(firebaseApi, /async function getReleaseGateState\s*\(/, 'contracts: getReleaseGateState wrapper is missing.');
assertContains(firebaseApi, /async function saveReleaseGateState\s*\(/, 'contracts: saveReleaseGateState wrapper is missing.');
assertContains(firebaseApi, /window\.ReleaseGateStateAPI\s*=/, 'contracts: ReleaseGateStateAPI browser bridge missing.');
assertContains(firebaseApi, /error\.code\s*=\s*['"]BACKEND_REQUIRED['"]/, 'contracts: BACKEND_REQUIRED fail-closed enforcement missing.');
const hasCanonicalAdmin24hHelper = /function\s+fetchCanonicalAdmin24hState\s*\(/.test(adminHtml);
const hasInlineBackendGateFetchFlow =
  /typeof\s+getReleaseGateState\s*!==\s*['"]function['"]/.test(adminHtml) &&
  /await\s+getReleaseGateState\s*\(\s*\{\s*retries\s*:\s*1\s*\}\s*\)/.test(adminHtml);
if (!hasCanonicalAdmin24hHelper && !hasInlineBackendGateFetchFlow) {
  errors.push('contracts: admin canonical release gate fetch helper missing.');
}
assertContains(adminHtml, /GATE_STATE_SOURCE/, 'contracts: missing GATE_STATE_SOURCE diagnostics.');
assertContains(adminHtml, /GATE_STATE_MISMATCH/, 'contracts: missing GATE_STATE_MISMATCH diagnostics.');
assertContains(adminHtml, /GATE_STATE_DEGRADED_BACKEND_UNAVAILABLE/, 'contracts: missing DEGRADED backend diagnostics.');

assertContains(storeHtml, /function\s+resolveDisplayPrice\s*\(/, 'contracts: store resolveDisplayPrice() missing.');
assertContains(storeHtml, /function\s+resolveComparablePrice\s*\(/, 'contracts: store resolveComparablePrice() missing.');
assertContains(worker, /function\s+resolveDisplayPrice\s*\(/, 'contracts: worker resolveDisplayPrice() missing.');
assertContains(worker, /function\s+resolveComparablePrice\s*\(/, 'contracts: worker resolveComparablePrice() missing.');
assertNotContains(storeHtml, /sellPrice\s*\|\|\s*price/, 'contracts: store uses forbidden sellPrice || price pattern.');
assertNotContains(firebaseApi, /sellPrice\s*\|\|\s*price/, 'contracts: firebase-api uses forbidden sellPrice || price pattern.');
assertNotContains(worker, /sellPrice\s*\|\|\s*price/, 'contracts: worker uses forbidden sellPrice || price pattern.');

const sensitiveClientFiles = new Set([
  'متجر_2.HTML',
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

assertContains(deployBackendWorkflow, /name:\s*Deploy Backend/, 'contracts: deploy-backend workflow missing.');
assertContains(deployBackendWorkflow, /project_id:\s*[\s\S]*required:\s*true/, 'contracts: deploy-backend project_id must be required.');
assertContains(deployBackendWorkflow, /deploy_functions:\s*[\s\S]*default:\s*"false"/, 'contracts: deploy-backend must default deploy_functions to false.');
assertContains(deployBackendWorkflow, /if:\s*\$\{\{\s*inputs\.target_sha\s*!=\s*''\s*\}\}/, 'contracts: deploy-backend must fail closed when target_sha is empty.');
assertContains(deployBackendWorkflow, /fetch-depth:\s*0/, 'contracts: deploy-backend checkout must use fetch-depth: 0.');
assertContains(deployBackendWorkflow, /"commitSha"\s*:/, 'contracts: deploy-backend metadata commitSha key missing.');
assertContains(deployBackendWorkflow, /"workflow"\s*:\s*"deploy-backend"/, 'contracts: deploy-backend metadata workflow key missing.');
assertContains(deployBackendWorkflow, /"createdAtUtc"\s*:/, 'contracts: deploy-backend metadata createdAtUtc key missing.');
assertContains(deployBackendWorkflow, /"functionsRequested"\s*:/, 'contracts: deploy-backend metadata functionsRequested key missing.');
assertContains(deployBackendWorkflow, /"functionsDeployed"\s*:/, 'contracts: deploy-backend metadata functionsDeployed key missing.');
assertContains(deployBackendWorkflow, /"indexesAttempted"\s*:\s*true/, 'contracts: deploy-backend metadata indexesAttempted=true missing.');
assertContains(deployProductionWorkflow, /deploy-backend\.yml/, 'contracts: deploy-production verify-gates missing deploy-backend dependency.');
assertContains(deployProductionWorkflow, /backend-\$\{targetSha\}/, 'contracts: deploy-production must validate backend artifact name by SHA.');
assertContains(deployProductionWorkflow, /Validate backend metadata artifact/, 'contracts: deploy-production backend metadata validation step missing.');
assertContains(deployProductionWorkflow, /backend metadata commitSha mismatch/, 'contracts: deploy-production must fail on backend metadata SHA mismatch.');
assertContains(deployProductionWorkflow, /backend metadata must confirm indexesAttempted=true/, 'contracts: deploy-production must require backend indexesAttempted=true.');

const featureRegistryPath = path.join(root, 'monitoring', 'feature-registry.json');
let featureRegistry = null;
try {
  featureRegistry = JSON.parse(fs.readFileSync(featureRegistryPath, 'utf8'));
} catch (error) {
  errors.push(`contracts: failed to read monitoring/feature-registry.json (${error.message}).`);
}

let verifiedIds = 0;
let verifiedDefinitions = 0;
let verifiedCalls = 0;
let verifiedStrings = 0;

if (featureRegistry && featureRegistry.files && typeof featureRegistry.files === 'object') {
  for (const [filename, checks] of Object.entries(featureRegistry.files)) {
    const filePath = path.join(root, filename);
    if (!fs.existsSync(filePath)) {
      errors.push(`❌ FILE MISSING: ${filename}`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    for (const id of checks.critical_ids || []) {
      verifiedIds += 1;
      if (!content.includes(`id=\"${id}\"`) && !content.includes(`id='${id}'`)) {
        errors.push(`❌ MISSING ID: id=\"${id}\" in ${filename}`);
      }
    }

    const functionChecks = checks.critical_functions || {};
    const mustBeDefined = Array.isArray(functionChecks)
      ? functionChecks
      : (functionChecks.must_be_defined || []);
    const mustBeCalled = Array.isArray(functionChecks)
      ? []
      : (functionChecks.must_be_called || []);

    for (const fn of mustBeDefined) {
      verifiedDefinitions += 1;
      if (!isFunctionDefined(content, fn)) {
        errors.push(`❌ MISSING DEFINITION: function ${fn}() not defined in ${filename}`);
      }
    }

    for (const fn of mustBeCalled) {
      verifiedCalls += 1;
      if (!isFunctionCalled(content, fn)) {
        warnings.push(`⚠️ NOT CALLED: ${fn}() has no call site in ${filename}`);
      }
    }

    for (const marker of checks.critical_strings || []) {
      verifiedStrings += 1;
      if (!content.includes(marker)) {
        errors.push(`❌ MISSING STRING: \"${marker}\" in ${filename}`);
      }
    }
  }
}

if (warnings.length) {
  console.warn('\nWARNINGS:');
  for (const item of warnings) {
    console.warn(item);
  }
}

if (errors.length) {
  console.error('\n❌ CONTRACTS FAILED:');
  for (const item of errors) {
    console.error(item);
  }
  console.error(`\nTotal errors: ${errors.length}`);
  process.exit(1);
}

try {
  execSync('node tools/usage-check.js', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('❌ Usage check failed — contracts FAIL');
  process.exit(1);
}

console.log('✅ Contracts check passed');
console.log(`   IDs verified: ${verifiedIds}`);
console.log(`   Definitions verified: ${verifiedDefinitions}`);
console.log(`   Calls verified: ${verifiedCalls}`);
console.log(`   Strings verified: ${verifiedStrings}`);
console.log('   Parity, price, filters, and version guard validated.');
process.exit(0);
