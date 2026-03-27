#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1];
const TOKEN = process.env.GITHUB_TOKEN;
const DEFAULT_BRANCH = 'main';
const OUT_FILE = 'branch-protection-evidence.json';
const DRY_RUN = process.argv.includes('--dry-run');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(REPO_ROOT, '.github', 'branch-protection-baseline.json');

function readBaseline() {
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const checks = raw.required_status_checks || {};
  const contexts = Array.from(new Set((checks.contexts || []).map((context) => String(context).trim()).filter(Boolean)));
  return {
    branch: String(raw.branch || DEFAULT_BRANCH),
    strict: Boolean(checks.strict),
    contexts,
    enforceAdmins: Boolean(raw.enforce_admins),
    requiredApprovingReviewCount: Number(raw.required_approving_review_count || 0),
    dismissStaleReviews: Boolean(raw.dismiss_stale_reviews)
  };
}

const baseline = readBaseline();
const BRANCH = baseline.branch;
const REQUIRED_CONTEXTS = baseline.contexts;

const payload = {
  required_status_checks: {
    strict: baseline.strict,
    contexts: REQUIRED_CONTEXTS
  },
  enforce_admins: baseline.enforceAdmins,
  required_pull_request_reviews: {
    required_approving_review_count: baseline.requiredApprovingReviewCount,
    dismiss_stale_reviews: baseline.dismissStaleReviews
  },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false
};

function writeEvidence(evidence) {
  writeFileSync(OUT_FILE, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}

if (DRY_RUN) {
  console.log('[dry-run] Would apply payload:');
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
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
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

if (!res.ok) {
  const err = await res.text();
  const skipped = res.status === 401 || res.status === 403 || res.status === 404;
  writeEvidence({
    timestamp: new Date().toISOString(),
    branch: BRANCH,
    result: skipped ? 'skipped' : 'fail',
    reason: 'apply_failed',
    http_status: res.status,
    response: err.slice(0, 2000),
    required_contexts: REQUIRED_CONTEXTS
  });
  process.exit(skipped ? 0 : 1);
}

writeEvidence({
  timestamp: new Date().toISOString(),
  branch: BRANCH,
  result: 'pass',
  reason: 'applied',
  required_contexts: REQUIRED_CONTEXTS
});

console.log(`Branch protection applied to ${BRANCH}`);
console.log(`Contexts: ${REQUIRED_CONTEXTS.join(', ')}`);
