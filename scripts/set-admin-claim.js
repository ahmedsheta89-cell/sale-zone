#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function usage(exitCode = 1) {
  console.error('Usage: node scripts/set-admin-claim.js <email-or-uid>');
  process.exit(exitCode);
}

const input = String(process.argv[2] || '').trim();
if (!input) usage(1);

const repoRoot = path.resolve(__dirname, '..');
const toolPath = path.join(repoRoot, 'tools', 'set-admin-claim.js');
const defaultServiceAccountPath = path.join(__dirname, 'service-account-key.json');
const serviceAccountPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultServiceAccountPath).trim();

if (!fs.existsSync(toolPath)) {
  console.error(`Missing tool: ${toolPath}`);
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account key not found.');
  console.error(`Expected at: ${serviceAccountPath}`);
  console.error('Download it from Firebase Console -> Project Settings -> Service Accounts');
  console.error('Or set GOOGLE_APPLICATION_CREDENTIALS to a valid JSON key path.');
  process.exit(1);
}

const args = [
  toolPath,
  '--service-account',
  serviceAccountPath,
  '--role',
  'admin',
  '--compat-admin-bool'
];

if (input.includes('@')) {
  args.push('--email', input);
} else {
  args.push('--uid', input);
}

const result = spawnSync(process.execPath, args, {
  cwd: repoRoot,
  stdio: 'inherit'
});

if (result.error) {
  console.error(result.error.message || result.error);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 0);
