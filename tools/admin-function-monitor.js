// Admin function monitor:
// - Registry is generated artifact only.
// - Drift between generated registry and committed artifact => FAIL.
// - Critical function missing => FAIL.
// - Critical regex checks use RegExp only (no includes-based checks).
// Run: node tools/admin-function-monitor.js

const fs = require('fs');
const path = require('path');

const {
  DEFAULT_ADMIN_FILE,
  DEFAULT_POLICY_FILE,
  DEFAULT_REGISTRY_FILE,
  stableStringify,
  sha256,
  normalizeForHash,
  buildArtifact
} = require('./generate-admin-function-registry');

const ROOT = process.cwd();
const OUTPUT_FILE = 'output/admin-function-monitor.json';

function readJson(root, relPath) {
  const absolute = path.join(root, relPath);
  const raw = fs.readFileSync(absolute, 'utf8');
  return { raw, data: JSON.parse(raw) };
}

function writeJson(root, relPath, payload) {
  const absolute = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function sanitizeStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'fail' || value === 'warn') return value;
  return 'ok';
}

function compileCriticalRegex(pattern, flags, indexLabel) {
  const safePattern = String(pattern || '').trim();
  const safeFlags = String(flags || 'm').replace(/g/g, '');
  if (!safePattern) {
    throw new Error(`Empty regex pattern (${indexLabel})`);
  }
  return new RegExp(safePattern, safeFlags);
}

function buildFunctionBlockMap(extracted) {
  const list = Array.isArray(extracted) ? [...extracted] : [];
  list.sort((a, b) => {
    const nameA = String(a && a.name || '');
    const nameB = String(b && b.name || '');
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    const lineA = Number(a && a.line || 0);
    const lineB = Number(b && b.line || 0);
    return lineA - lineB;
  });

  const duplicates = [];
  const blocks = new Map();
  for (const current of list) {
    const name = String(current && current.name || '').trim();
    if (!name) continue;
    if (blocks.has(name)) duplicates.push(name);
    blocks.set(name, String(current && current.canonicalBody || ''));
  }

  return { blocks, duplicates };
}

function indexRowsByName(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(String(row && row.name || ''), row);
  }
  return map;
}

function countBy(rows, field, allowedValues) {
  const summary = {};
  const values = Array.isArray(allowedValues) ? allowedValues : [];
  for (const value of values) {
    summary[value] = 0;
  }

  for (const row of rows) {
    const key = String(row && row[field] || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(summary, key)) {
      summary[key] += 1;
    }
  }

  return summary;
}

function runMonitor() {
  const nowIso = new Date().toISOString();

  const generated = buildArtifact({
    root: ROOT,
    adminFile: DEFAULT_ADMIN_FILE,
    policyFile: DEFAULT_POLICY_FILE,
    generatedAt: nowIso
  });

  const policy = generated.policy || {};
  const expectedRegistry = generated.artifact;
  const expectedNormalized = generated.normalized;
  const rows = (expectedRegistry.functions || []).map((row) => ({ ...row }));
  const rowMap = indexRowsByName(rows);

  const driftFindings = [];
  const missingCriticalFunctions = [];
  const regexValidationFindings = [];
  const failures = [];
  const warnings = [];
  let criticalFailures = 0;

  let committedRegistry = null;
  try {
    committedRegistry = readJson(ROOT, DEFAULT_REGISTRY_FILE).data;
  } catch (error) {
    criticalFailures += 1;
    driftFindings.push({
      code: 'REGISTRY_MISSING',
      message: `Registry file is missing or unreadable: ${DEFAULT_REGISTRY_FILE}`
    });
  }

  if (committedRegistry) {
    const committedNormalized = normalizeForHash(committedRegistry);
    const committedHash = sha256(stableStringify(committedNormalized));

    if (String(committedRegistry.registryHash || '') !== committedHash) {
      criticalFailures += 1;
      driftFindings.push({
        code: 'REGISTRY_HASH_INVALID',
        message: 'Committed registry hash does not match file content.'
      });
    }

    if (stableStringify(committedNormalized) !== stableStringify(expectedNormalized)) {
      criticalFailures += 1;
      driftFindings.push({
        code: 'REGISTRY_DRIFT',
        message: 'Committed registry differs from generated artifact.'
      });
    }

    if (String(committedRegistry.registryHash || '') !== String(expectedRegistry.registryHash || '')) {
      criticalFailures += 1;
      driftFindings.push({
        code: 'REGISTRY_HASH_MISMATCH',
        message: 'Committed registry hash differs from generated hash.'
      });
    }
  }

  const functionBlocks = buildFunctionBlockMap(generated.extracted);
  if (functionBlocks.duplicates.length) {
    warnings.push({
      code: 'DUPLICATE_FUNCTION_NAMES',
      message: `Duplicate function names detected: ${Array.from(new Set(functionBlocks.duplicates)).join(', ')}`
    });
  }

  const criticalDefinitions = Array.isArray(policy.criticalFunctions) ? policy.criticalFunctions : [];
  for (let idx = 0; idx < criticalDefinitions.length; idx += 1) {
    const definition = criticalDefinitions[idx] || {};
    const functionName = String(definition.name || '').trim();
    if (!functionName) {
      criticalFailures += 1;
      regexValidationFindings.push({
        code: 'POLICY_INVALID_CRITICAL_ENTRY',
        message: `Critical entry at index ${idx} has no function name.`
      });
      continue;
    }

    const row = rowMap.get(functionName);
    if (!row || !functionBlocks.blocks.has(functionName)) {
      criticalFailures += 1;
      missingCriticalFunctions.push({
        code: 'CRITICAL_FUNCTION_MISSING',
        functionName,
        message: 'Critical function is missing from admin source.'
      });
      failures.push({
        code: 'CRITICAL_FUNCTION_MISSING',
        functionName,
        message: 'Critical function is missing from admin source.'
      });
      continue;
    }

    const block = functionBlocks.blocks.get(functionName) || '';
    const requiredPatterns = Array.isArray(definition.requiredPatterns) ? definition.requiredPatterns : [];
    for (let pIdx = 0; pIdx < requiredPatterns.length; pIdx += 1) {
      const patternDef = requiredPatterns[pIdx] || {};
      const indexLabel = `${functionName}#${pIdx}`;
      let regex;

      try {
        regex = compileCriticalRegex(patternDef.pattern, patternDef.flags, indexLabel);
      } catch (error) {
        criticalFailures += 1;
        regexValidationFindings.push({
          code: 'POLICY_INVALID_REGEX',
          functionName,
          index: pIdx,
          message: error && error.message ? error.message : String(error)
        });
        failures.push({
          code: 'POLICY_INVALID_REGEX',
          functionName,
          message: 'Invalid regex definition in policy.'
        });
        row.status = 'fail';
        row.reasonCode = 'POLICY_INVALID_REGEX';
        row.reasonText = '\u0641\u0634\u0644 \u0625\u0639\u062f\u0627\u062f \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u0645\u0631\u0627\u0642\u0628\u0629.';
        continue;
      }

      regex.lastIndex = 0;
      if (!regex.test(block)) {
        criticalFailures += 1;
        const reasonCode = String(patternDef.reasonCode || 'CRITICAL_REGEX_MISSING');
        const reasonText = String(patternDef.reasonText || '\u0642\u0627\u0639\u062f\u0629 \u062d\u0631\u062c\u0629 \u063a\u064a\u0631 \u0645\u0637\u0628\u0642\u0629.');

        row.status = 'fail';
        row.reasonCode = reasonCode;
        row.reasonText = reasonText;

        failures.push({
          code: reasonCode,
          functionName,
          message: reasonText
        });
      }
    }

    if (sanitizeStatus(row.status) === 'ok') {
      row.status = 'ok';
      row.reasonCode = 'CRITICAL_CHECKS_OK';
      row.reasonText = '\u0627\u0644\u0641\u062d\u0648\u0635\u0627\u062a \u0627\u0644\u062d\u0631\u062c\u0629 \u0646\u0627\u062c\u062d\u0629.';
    }
  }

  for (const row of rows) {
    row.status = sanitizeStatus(row.status);
    if (row.status === 'warn' && !row.reasonCode) {
      row.reasonCode = 'WARN_BASELINE';
      row.reasonText = '\u062a\u062d\u0630\u064a\u0631 \u063a\u064a\u0631 \u062d\u0631\u062c.';
    }
    if (row.status === 'ok' && !row.reasonCode) {
      row.reasonCode = 'BASELINE_OK';
      row.reasonText = '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0644\u0627\u062d\u0638\u0627\u062a \u062d\u0631\u062c\u0629.';
    }
  }

  const summary = {
    totalFunctions: rows.length,
    criticalCount: rows.filter((row) => row.monitorLevel === 'critical').length,
    warningCount: rows.filter((row) => row.monitorLevel === 'warning').length,
    directStoreImpactCount: rows.filter((row) => row.storeImpact === 'direct').length,
    directMobileImpactCount: rows.filter((row) => row.mobileImpact === 'direct').length,
    storeImpact: countBy(rows, 'storeImpact', ['direct', 'indirect', 'none']),
    mobileImpact: countBy(rows, 'mobileImpact', ['direct', 'indirect', 'none']),
    persistenceModes: countBy(rows, 'persistenceMode', ['firebase_online', 'hybrid', 'local_temporary', 'memory_only']),
    criticalFailures
  };

  const monitorReport = {
    generatedAt: nowIso,
    sourceFile: DEFAULT_ADMIN_FILE,
    policyFile: DEFAULT_POLICY_FILE,
    sourceHash: expectedRegistry.sourceHash,
    policyHash: expectedRegistry.policyHash,
    expectedRegistryHash: expectedRegistry.registryHash,
    committedRegistryHash: committedRegistry ? String(committedRegistry.registryHash || '') : '',
    summary,
    functions: rows,
    driftFindings,
    missingCriticalFunctions,
    regexValidationFindings,
    warnings,
    failures
  };

  writeJson(ROOT, OUTPUT_FILE, monitorReport);

  console.log('Admin Function Monitor Report');
  console.log('='.repeat(32));
  console.log(`[INFO] total functions: ${summary.totalFunctions}`);
  console.log(`[INFO] critical functions: ${summary.criticalCount}`);
  console.log(`[INFO] critical failures: ${summary.criticalFailures}`);

  for (const finding of driftFindings) {
    console.log(`[FAIL] ${finding.code}: ${finding.message}`);
  }
  for (const finding of missingCriticalFunctions) {
    console.log(`[FAIL] ${finding.code}: ${finding.functionName}`);
  }
  for (const finding of regexValidationFindings) {
    console.log(`[FAIL] ${finding.code}: ${finding.functionName || 'policy'} (${finding.message})`);
  }
  for (const failure of failures) {
    console.log(`[FAIL] ${failure.code}: ${failure.functionName}`);
  }
  for (const warning of warnings) {
    console.log(`[WARN] ${warning.code}: ${warning.message}`);
  }

  if (criticalFailures > 0) {
    console.error(`\nAdmin function monitor FAILED: ${criticalFailures} critical finding(s).`);
    process.exit(1);
  }

  console.log('\nAdmin function monitor OK: all critical checks passed.');
}

runMonitor();
