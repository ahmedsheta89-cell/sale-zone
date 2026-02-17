// Quick daily governance check before push.
// Run: node tools/pre-push-quick-check.js

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  DEFAULT_ADMIN_FILE,
  DEFAULT_POLICY_FILE,
  DEFAULT_REGISTRY_FILE,
  buildArtifact,
  normalizeForHash,
  stableStringify,
  sha256
} = require('./generate-admin-function-registry');

const repoRoot = path.resolve(__dirname, '..');

function info(message) {
  console.log(`[governance:quick] ${message}`);
}

function fail(message) {
  console.error(`[governance:quick][FAIL] ${message}`);
  process.exit(1);
}

function runNode(args, label) {
  const result = spawnSync('node', args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    fail(`${label} failed (exit ${result.status}).`);
  }
}

function readRegistry() {
  const registryAbsolute = path.join(repoRoot, DEFAULT_REGISTRY_FILE);
  if (!fs.existsSync(registryAbsolute)) {
    fail(`Missing registry file: ${DEFAULT_REGISTRY_FILE}`);
  }

  try {
    return JSON.parse(fs.readFileSync(registryAbsolute, 'utf8'));
  } catch (error) {
    fail(`Registry JSON parse failed: ${error && error.message ? error.message : String(error)}`);
  }
}

function getHashSet(registry) {
  return {
    registryHash: String(registry && registry.registryHash || ''),
    sourceHash: String(registry && registry.sourceHash || ''),
    policyHash: String(registry && registry.policyHash || '')
  };
}

function assertHashSetIsNotEmpty(set, label) {
  if (!set.registryHash || !set.sourceHash || !set.policyHash) {
    fail(`${label}: one or more hashes are missing.`);
  }
}

function assertHashSetsEqual(a, b, label) {
  if (a.registryHash !== b.registryHash) {
    fail(`${label}: registryHash changed between runs.`);
  }
  if (a.sourceHash !== b.sourceHash) {
    fail(`${label}: sourceHash changed between runs.`);
  }
  if (a.policyHash !== b.policyHash) {
    fail(`${label}: policyHash changed between runs.`);
  }
}

function assertRegistryDriftFree(stageLabel) {
  const committedRegistry = readRegistry();
  const committedNormalized = normalizeForHash(committedRegistry);
  const committedDerivedHash = sha256(stableStringify(committedNormalized));
  const committedHash = String(committedRegistry.registryHash || '');

  if (committedHash !== committedDerivedHash) {
    fail(`${stageLabel}: committed registry hash is invalid (manual edit suspected).`);
  }

  const generated = buildArtifact({
    root: repoRoot,
    adminFile: DEFAULT_ADMIN_FILE,
    policyFile: DEFAULT_POLICY_FILE,
    generatedAt: committedRegistry.generatedAt || new Date().toISOString()
  });

  if (stableStringify(committedNormalized) !== stableStringify(generated.normalized)) {
    fail(`${stageLabel}: committed registry content drifts from generated artifact.`);
  }

  if (committedHash !== String(generated.artifact.registryHash || '')) {
    fail(`${stageLabel}: committed registry hash mismatches generated registry hash.`);
  }
}

function runQuickGovernanceCheck() {
  info('Step 1/4: verify registry is drift-free before generation.');
  assertRegistryDriftFree('pre-check');

  info('Step 2/4: run registry generator twice and compare hashes.');
  runNode(['tools/generate-admin-function-registry.js'], 'first generator run');
  const firstHashes = getHashSet(readRegistry());
  assertHashSetIsNotEmpty(firstHashes, 'first generator run');

  runNode(['tools/generate-admin-function-registry.js'], 'second generator run');
  const secondHashes = getHashSet(readRegistry());
  assertHashSetIsNotEmpty(secondHashes, 'second generator run');

  assertHashSetsEqual(firstHashes, secondHashes, 'hash consistency check');
  info(`Hash consistency OK (${firstHashes.registryHash}).`);

  info('Step 3/4: verify registry is still drift-free after double generation.');
  assertRegistryDriftFree('post-check');

  info('Step 4/4: run full required checks.');
  runNode(['tools/run-required-checks.js'], 'required checks');

  info('Quick governance check passed.');
}

runQuickGovernanceCheck();
