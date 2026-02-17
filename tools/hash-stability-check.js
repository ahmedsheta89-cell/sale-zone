// Hash stability check:
// - Build registry artifacts twice in-memory.
// - Ensure source/policy/registry hashes are stable.
// - Ensure committed registry matches generated deterministic artifact.
// Run: node tools/hash-stability-check.js

'use strict';

const fs = require('fs');
const path = require('path');

const {
  DEFAULT_ADMIN_FILE,
  DEFAULT_POLICY_FILE,
  DEFAULT_REGISTRY_FILE,
  buildArtifact,
  normalizeForHash,
  stableStringify,
  sha256
} = require('./generate-admin-function-registry');

const ROOT = process.cwd();

function fail(message) {
  console.error(`Hash stability FAILED: ${message}`);
  process.exit(1);
}

function readCommittedRegistry() {
  const absolute = path.join(ROOT, DEFAULT_REGISTRY_FILE);
  if (!fs.existsSync(absolute)) {
    fail(`missing registry file: ${DEFAULT_REGISTRY_FILE}`);
  }

  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    fail(`invalid registry JSON: ${error && error.message ? error.message : String(error)}`);
  }
}

function hashSet(artifact) {
  return {
    sourceHash: String(artifact && artifact.sourceHash || ''),
    policyHash: String(artifact && artifact.policyHash || ''),
    registryHash: String(artifact && artifact.registryHash || '')
  };
}

function compareHashSets(first, second) {
  if (first.sourceHash !== second.sourceHash) fail('sourceHash changed between two in-memory generations');
  if (first.policyHash !== second.policyHash) fail('policyHash changed between two in-memory generations');
  if (first.registryHash !== second.registryHash) fail('registryHash changed between two in-memory generations');
}

function run() {
  const first = buildArtifact({
    root: ROOT,
    adminFile: DEFAULT_ADMIN_FILE,
    policyFile: DEFAULT_POLICY_FILE,
    generatedAt: new Date().toISOString()
  });
  const second = buildArtifact({
    root: ROOT,
    adminFile: DEFAULT_ADMIN_FILE,
    policyFile: DEFAULT_POLICY_FILE,
    generatedAt: new Date(Date.now() + 1000).toISOString()
  });

  compareHashSets(hashSet(first.artifact), hashSet(second.artifact));

  const committedRegistry = readCommittedRegistry();
  const committedNormalized = normalizeForHash(committedRegistry);
  const committedDerivedHash = sha256(stableStringify(committedNormalized));
  const committedRegistryHash = String(committedRegistry.registryHash || '');

  if (!committedRegistryHash) {
    fail('committed registryHash is missing');
  }
  if (committedRegistryHash !== committedDerivedHash) {
    fail('committed registryHash does not match committed registry content');
  }

  if (stableStringify(committedNormalized) !== stableStringify(first.normalized)) {
    fail('committed registry content differs from generated deterministic content');
  }

  if (committedRegistryHash !== String(first.artifact.registryHash || '')) {
    fail('committed registryHash differs from generated registryHash');
  }

  console.log('Hash stability OK: deterministic generation and committed registry are stable.');
}

run();
