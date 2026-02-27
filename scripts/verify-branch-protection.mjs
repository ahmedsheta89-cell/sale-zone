#!/usr/bin/env node
/**
 * verify-branch-protection.mjs
 * Verifies that branch protection contexts exactly match required list.
 * Emits JSON evidence artifact and exits non-zero on mismatch.
 */

import { writeFileSync } from 'node:fs';

const OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1];
const TOKEN = process.env.GITHUB_TOKEN;
const BRANCH = 'main';
const OUT_FILE = 'branch-protection-evidence.json';

const REQUIRED_CONTEXTS = [
  'preflight',
  'contracts-check',
  'security-regression-check',
  'workers-paranoid-gate',
  'ci-parity'
];

if (!TOKEN || !OWNER || !REPO) {
  console.error('Missing GITHUB_TOKEN, GITHUB_REPOSITORY_OWNER, or GITHUB_REPOSITORY');
  process.exit(1);
}

const url = `https://api.github.com/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection`;

const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

if (!res.ok) {
  console.error(`Failed to fetch protection: ${res.status}`);
  process.exit(1);
}

const data = await res.json();
const actual = data?.required_status_checks?.contexts ?? [];
const missing = REQUIRED_CONTEXTS.filter((c) => !actual.includes(c));
const extra = actual.filter((c) => !REQUIRED_CONTEXTS.includes(c));
const pass = missing.length === 0 && extra.length === 0;

const evidence = {
  timestamp: new Date().toISOString(),
  branch: BRANCH,
  required_contexts: REQUIRED_CONTEXTS,
  actual_contexts: actual,
  missing_contexts: missing,
  extra_contexts: extra,
  enforce_admins: data?.enforce_admins?.enabled ?? false,
  allow_force_pushes: data?.allow_force_pushes?.enabled ?? true,
  result: pass ? 'pass' : 'fail'
};

writeFileSync(OUT_FILE, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));

if (!pass) {
  console.error('\n❌ Branch protection mismatch');
  if (missing.length) console.error(`   Missing: ${missing.join(', ')}`);
  if (extra.length) console.error(`   Extra:   ${extra.join(', ')}`);
  process.exit(1);
}

console.log('\n✅ Branch protection verified — all contexts match');
