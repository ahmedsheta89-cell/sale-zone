// Unified release gate runner.
// Run: node tools/run-required-checks.js

const { spawnSync } = require('child_process');

const checks = [
  { name: 'preflight', command: ['node', 'tools/preflight.js'] },
  { name: 'smoke-check', command: ['node', 'tools/smoke-check.js'] },
  { name: 'admin-function-monitor', command: ['node', 'tools/admin-function-monitor.js'] },
  { name: 'rules', command: ['node', 'tools/rules-test.js'] },
  { name: 'e2e', command: ['node', 'tools/e2e-check.js'] }
];

const failures = [];

for (const check of checks) {
  const startedAt = Date.now();
  console.log(`\n[RUN] ${check.name}`);

  const [bin, ...args] = check.command;
  const result = spawnSync(bin, args, {
    stdio: 'inherit',
    shell: false
  });

  const durationMs = Date.now() - startedAt;
  if (result.status !== 0) {
    failures.push(`${check.name} (exit ${result.status})`);
    console.log(`[FAIL] ${check.name} (${durationMs} ms)`);
    continue;
  }

  console.log(`[PASS] ${check.name} (${durationMs} ms)`);
}

if (failures.length) {
  console.error('\nRelease gate FAILED:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('\nRelease gate OK: all required checks passed.');
