// Verifies release-gate workflow parity against required local checks.
// Usage: node scripts/verify-ci-parity.js --strict

const fs = require('fs');
const path = require('path');

const strict = process.argv.includes('--strict');
const root = process.cwd();

const requiredChecks = ['preflight', 'contracts-check', 'security-regression-check', 'workers-paranoid-gate'];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function detectReleaseGateChecks(workflowText) {
  const detected = new Set();
  const mapping = [
    { key: 'preflight', pattern: /tools\/preflight\.js/ },
    { key: 'contracts-check', pattern: /tools\/contracts-check\.js/ },
    { key: 'security-regression-check', pattern: /tools\/security-regression-check\.js/ }
  ];
  for (const entry of mapping) {
    if (entry.pattern.test(workflowText)) detected.add(entry.key);
  }
  return detected;
}

function main() {
  const releaseGatePath = '.github/workflows/release-gate.yml';
  const workersGatePath = '.github/workflows/workers-paranoid-gate.yml';
  const localRunnerPath = 'tools/run-required-checks.js';

  const releaseGate = read(releaseGatePath);
  const localRunner = read(localRunnerPath);
  const workersGateExists = fs.existsSync(path.join(root, workersGatePath));

  const detected = detectReleaseGateChecks(releaseGate);
  if (workersGateExists) detected.add('workers-paranoid-gate');

  const localDetected = new Set();
  if (/name:\s*'preflight'|name:\s*"preflight"|name:\s*preflight/.test(localRunner)) localDetected.add('preflight');
  if (/contracts-check/.test(localRunner)) localDetected.add('contracts-check');
  if (/security-regression-check/.test(localRunner)) localDetected.add('security-regression-check');

  const missingInWorkflow = requiredChecks.filter((c) => !detected.has(c));
  const missingInLocal = requiredChecks.filter((c) => c !== 'workers-paranoid-gate' && !localDetected.has(c));

  const report = {
    generatedAt: new Date().toISOString(),
    strict,
    requiredChecks,
    workflowDetected: [...detected],
    localDetected: [...localDetected],
    missingInWorkflow,
    missingInLocal,
    pass: missingInWorkflow.length === 0 && missingInLocal.length === 0
  };

  const outputPath = path.join(root, 'reports', 'ci-parity-report.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  if (!report.pass && strict) {
    console.error('verify-ci-parity: FAILED (strict)');
    process.exit(1);
  }

  console.log(`verify-ci-parity: ${report.pass ? 'OK' : 'WARN'}`);
}

main();
