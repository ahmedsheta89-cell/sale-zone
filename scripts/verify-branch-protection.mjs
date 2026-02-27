#!/usr/bin/env node
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

function writeEvidence(evidence) {
  writeFileSync(OUT_FILE, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}

if (!TOKEN || !OWNER || !REPO) {
  writeEvidence({
    timestamp: new Date().toISOString(),
    branch: BRANCH,
    result: 'skipped',
    reason: 'missing_github_context',
    required_contexts: REQUIRED_CONTEXTS
  });
  process.exit(0);
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
  const err = await res.text();
  const skipped = res.status === 401 || res.status === 403 || res.status === 404;
  writeEvidence({
    timestamp: new Date().toISOString(),
    branch: BRANCH,
    result: skipped ? 'skipped' : 'fail',
    reason: 'verify_fetch_failed',
    http_status: res.status,
    response: err.slice(0, 2000),
    required_contexts: REQUIRED_CONTEXTS
  });
  process.exit(skipped ? 0 : 1);
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

writeEvidence(evidence);

if (!pass) {
  console.error('Branch protection mismatch');
  if (missing.length) console.error(`Missing: ${missing.join(', ')}`);
  if (extra.length) console.error(`Extra: ${extra.join(', ')}`);
  process.exit(1);
}

console.log('Branch protection verified - all contexts match');
