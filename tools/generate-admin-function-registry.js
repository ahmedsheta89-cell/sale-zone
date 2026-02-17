// Generates monitoring/admin-function-registry.json from admin source + policy.
// Run: node tools/generate-admin-function-registry.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseAdminFunctions } = require('./lib/admin-source-parser');

const DEFAULT_ADMIN_FILE = '\u0627\u062f\u0645\u0646_2.HTML';
const DEFAULT_POLICY_FILE = 'monitoring/admin-function-policy.json';
const DEFAULT_REGISTRY_FILE = 'monitoring/admin-function-registry.json';
const DEFAULT_GENERATOR_VERSION = '1.0.0';

function sha256(content) {
  return crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function readUtf8(root, relPath) {
  const absolute = path.join(root, relPath);
  return fs.readFileSync(absolute, 'utf8');
}

function readJson(root, relPath) {
  const raw = readUtf8(root, relPath);
  return { raw, data: JSON.parse(raw) };
}

function compileGroupRules(policy) {
  const rules = ensureArray(policy && policy.groupRules);
  return rules.map((rule, idx) => {
    const pattern = String(rule && rule.pattern || '').trim();
    const group = String(rule && rule.group || '').trim();
    if (!pattern || !group) {
      throw new Error(`Invalid group rule at index ${idx}`);
    }
    const flags = String(rule && rule.flags || '').replace(/g/g, '');
    return {
      group,
      regex: new RegExp(pattern, flags)
    };
  });
}

function classifyFunction(name, policy, compiledRules, criticalNames) {
  let group = 'utility';
  const functionName = String(name || '');

  for (const rule of compiledRules) {
    rule.regex.lastIndex = 0;
    if (rule.regex.test(functionName)) {
      group = rule.group;
      break;
    }
  }

  const groupConfig = (policy && policy.groups && policy.groups[group]) || (policy && policy.groups && policy.groups.utility) || {};
  const isCritical = criticalNames.has(functionName);

  return {
    group,
    monitorLevel: isCritical ? 'critical' : String(groupConfig.monitorLevel || 'info'),
    storeImpact: String(groupConfig.storeImpact || 'none'),
    mobileImpact: String(groupConfig.mobileImpact || 'none'),
    persistenceMode: String(groupConfig.persistenceMode || 'memory_only')
  };
}

function normalizeForHash(artifact) {
  return {
    generatorVersion: String(artifact && artifact.generatorVersion || ''),
    sourceHash: String(artifact && artifact.sourceHash || ''),
    policyHash: String(artifact && artifact.policyHash || ''),
    functions: ensureArray(artifact && artifact.functions)
  };
}

function buildArtifact(options = {}) {
  const root = options.root || process.cwd();
  const adminFile = options.adminFile || DEFAULT_ADMIN_FILE;
  const policyFile = options.policyFile || DEFAULT_POLICY_FILE;
  const generatedAt = options.generatedAt || new Date().toISOString();

  const adminSource = readUtf8(root, adminFile);
  const policyBundle = readJson(root, policyFile);
  const policy = policyBundle.data || {};

  const compiledRules = compileGroupRules(policy);
  const criticalNames = new Set(
    ensureArray(policy.criticalFunctions)
      .map((entry) => String(entry && entry.name || '').trim())
      .filter(Boolean)
  );

  const parsedSource = parseAdminFunctions(adminSource);
  const extracted = Array.isArray(parsedSource && parsedSource.functions) ? parsedSource.functions : [];
  const functions = extracted.map((entry) => {
    const classified = classifyFunction(entry.name, policy, compiledRules, criticalNames);
    const status = 'ok';
    const reasonCode = classified.monitorLevel === 'critical' ? 'CRITICAL_BASELINE' : 'BASELINE_OK';
    const reasonText = classified.monitorLevel === 'critical'
      ? '\u062a\u0645 \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u062f\u0627\u0644\u0629 \u0643\u062d\u0631\u062c\u0629 \u0648\u062a\u0639\u0645\u0644 \u062d\u0633\u0628 \u0627\u0644\u0633\u064a\u0627\u0633\u0629.'
      : '\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u0627\u0644\u0629 \u0636\u0645\u0646 \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629.';

    return {
      name: entry.name,
      isAsync: entry.isAsync === true,
      line: Number(entry.line || 0),
      scriptIndex: Number(entry.scriptIndex || 0),
      group: classified.group,
      monitorLevel: classified.monitorLevel,
      storeImpact: classified.storeImpact,
      mobileImpact: classified.mobileImpact,
      persistenceMode: classified.persistenceMode,
      status,
      reasonCode,
      reasonText
    };
  });

  const artifact = {
    generatorVersion: String(policy.generatorVersion || DEFAULT_GENERATOR_VERSION),
    generatedAt,
    sourceFile: adminFile,
    policyFile,
    sourceHash: sha256(stableStringify(extracted.map((entry) => ({
      name: String(entry && entry.name || ''),
      isAsync: Boolean(entry && entry.isAsync),
      line: Number(entry && entry.line || 0),
      scriptIndex: Number(entry && entry.scriptIndex || 0),
      canonicalBody: String(entry && entry.canonicalBody || '')
    })))),
    policyHash: sha256(stableStringify(policy)),
    functions
  };

  const normalized = normalizeForHash(artifact);
  artifact.registryHash = sha256(stableStringify(normalized));

  return {
    artifact,
    normalized,
    policy,
    adminSource,
    extracted
  };
}

function writeArtifact(root, relPath, artifact) {
  const absolute = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
}

function generateRegistryArtifact(options = {}) {
  const root = options.root || process.cwd();
  const outFile = options.outFile || DEFAULT_REGISTRY_FILE;
  const result = buildArtifact(options);

  if (options.writeFile !== false) {
    writeArtifact(root, outFile, result.artifact);
  }

  return result;
}

if (require.main === module) {
  try {
    const result = generateRegistryArtifact();
    console.log(`Admin function registry generated: ${DEFAULT_REGISTRY_FILE}`);
    console.log(`Functions: ${result.artifact.functions.length}`);
    console.log(`Registry hash: ${result.artifact.registryHash}`);
  } catch (error) {
    console.error(`Failed to generate admin function registry: ${error && error.message ? error.message : String(error)}`);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_ADMIN_FILE,
  DEFAULT_POLICY_FILE,
  DEFAULT_REGISTRY_FILE,
  sha256,
  stableStringify,
  normalizeForHash,
  buildArtifact,
  generateRegistryArtifact
};
