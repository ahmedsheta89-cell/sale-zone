// Ensure local git hooks are enforced from .githooks.
// Run: node tools/ensure-githooks.js

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function isCiEnvironment() {
  return String(process.env.CI || '').toLowerCase() === 'true'
    || String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';
}

if (isCiEnvironment()) {
  console.log('[ensure-githooks] CI environment detected; skipping git hooks setup.');
  process.exit(0);
}

function getHooksPath() {
  try {
    return String(execSync('git config --get core.hooksPath', { cwd: ROOT, encoding: 'utf8' }) || '').trim();
  } catch (_) {
    return '';
  }
}

const current = getHooksPath();
if (current === '.githooks') {
  console.log('[ensure-githooks] core.hooksPath already set to .githooks');
  process.exit(0);
}

execSync('git config core.hooksPath .githooks', { cwd: ROOT, stdio: 'inherit' });
console.log('[ensure-githooks] core.hooksPath set to .githooks');
