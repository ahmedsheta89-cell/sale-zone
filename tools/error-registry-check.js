#!/usr/bin/env node
/**
 * error-registry-check.js
 * Governance check: validates Error Registry, Patterns, and Decision Log
 * exist and contain meaningful content.
 */

const fs = require('fs');
const path = require('path');

let passed = true;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ? ${label}`);
  } else {
    console.error(`  ? ${label} — ${detail}`);
    passed = false;
  }
}

console.log('');
console.log('??? Error Registry Governance Check ???');
console.log('');

const registryPath = path.join(__dirname, '..', 'docs', 'ERROR_REGISTRY.md');
console.log('--- docs/ERROR_REGISTRY.md ---');

if (fs.existsSync(registryPath)) {
  const registry = fs.readFileSync(registryPath, 'utf8');
  check('File exists', true, '');
  check('Not empty (>500 chars)', registry.length > 500, `Only ${registry.length} chars`);

  const errIds = (registry.match(/### ERR-\d+/g) || []);
  check(`Errors logged: ${errIds.length}`, errIds.length > 0, 'No ERR- entries found');

  const solutions = (registry.match(/\*\*Solution[:\*]/g) || []);
  check(`Solutions documented: ${solutions.length}`, solutions.length > 0, 'No solutions found');

  const hasTemplate = registry.includes('Template');
  check('Template section present', hasTemplate, 'Missing template for new errors');

  const hasConflict = /(<{7}|>{7}|={7})/.test(registry);
  check('No conflict markers', !hasConflict, 'Conflict markers found!');
} else {
  check('File exists', false, `Not found at ${registryPath}`);
}

console.log('');

const patternsPath = path.join(__dirname, '..', 'docs', 'PATTERNS.md');
console.log('--- docs/PATTERNS.md ---');

if (fs.existsSync(patternsPath)) {
  const patterns = fs.readFileSync(patternsPath, 'utf8');
  check('File exists', true, '');
  check('Not empty (>300 chars)', patterns.length > 300, `Only ${patterns.length} chars`);

  const patternIds = (patterns.match(/## PATTERN-\d+/g) || []);
  check(`Patterns logged: ${patternIds.length}`, patternIds.length > 0, 'No PATTERN- entries found');

  const hasRelated = patterns.includes('Related Errors');
  check('Errors cross-referenced', hasRelated, 'No error cross-references found');

  const hasConflict = /(<{7}|>{7}|={7})/.test(patterns);
  check('No conflict markers', !hasConflict, 'Conflict markers found!');
} else {
  check('File exists', false, `Not found at ${patternsPath}`);
}

console.log('');

const decisionsPath = path.join(__dirname, '..', 'docs', 'DECISION_LOG.md');
console.log('--- docs/DECISION_LOG.md ---');

if (fs.existsSync(decisionsPath)) {
  const decisions = fs.readFileSync(decisionsPath, 'utf8');
  check('File exists', true, '');
  check('Not empty (>300 chars)', decisions.length > 300, `Only ${decisions.length} chars`);

  const decIds = (decisions.match(/## DEC-\d+/g) || []);
  check(`Decisions logged: ${decIds.length}`, decIds.length > 0, 'No DEC- entries found');

  const hasReason = decisions.includes('Reason');
  check('Rationale documented', hasReason, 'No reasoning found');

  const hasConflict = /(<{7}|>{7}|={7})/.test(decisions);
  check('No conflict markers', !hasConflict, 'Conflict markers found!');
} else {
  check('File exists', false, `Not found at ${decisionsPath}`);
}

console.log('');
console.log('--- Cross-reference Validation ---');

if (fs.existsSync(registryPath) && fs.existsSync(patternsPath)) {
  const registry = fs.readFileSync(registryPath, 'utf8');
  const patterns = fs.readFileSync(patternsPath, 'utf8');

  const registryErrs = (registry.match(/### ERR-\d+/g) || []).map((e) => e.replace('### ', ''));
  const patternRefs = (patterns.match(/ERR-\d+/g) || []);
  const uniquePatternRefs = [...new Set(patternRefs)];

  check(
    `${uniquePatternRefs.length}/${registryErrs.length} errors referenced in patterns`,
    uniquePatternRefs.length > 0,
    'No errors cross-referenced in patterns'
  );
}

console.log('');

if (passed) {
  console.log('??? ? Error Registry Check: PASSED ???');
  console.log('');
  process.exit(0);
} else {
  console.log('??? ? Error Registry Check: FAILED ???');
  console.log('');
  process.exit(1);
}
