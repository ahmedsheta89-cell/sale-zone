// Executes real Firebase Emulator verification suites inside `firebase emulators:exec`.
// Usage: node tools/run-emulator-inner.js [--only-rules | --only-e2e]

'use strict';

const { spawnSync } = require('child_process');

const onlyRules = process.argv.includes('--only-rules');
const onlyE2e = process.argv.includes('--only-e2e');

const steps = [];
if (!onlyE2e) {
  steps.push({
    name: 'firestore-rules-emulator',
    bin: 'node',
    args: ['tests/firestore-rules-emulator.test.js']
  });
}
if (!onlyRules) {
  steps.push({
    name: 'playwright-emulator-e2e',
    bin: 'npx',
    args: ['playwright', 'test', '--config=playwright.emulator.config.js']
  });
}

for (const step of steps) {
  console.log(`\n[EMULATOR-INNER] Running ${step.name}...`);
  const res = spawnSync(step.bin, step.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (res.status !== 0) {
    console.error(`[EMULATOR-INNER] FAILED: ${step.name} (exit ${res.status})`);
    process.exit(res.status || 1);
  }
  console.log(`[EMULATOR-INNER] PASSED: ${step.name}`);
}
