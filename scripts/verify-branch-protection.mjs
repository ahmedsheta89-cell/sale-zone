#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1];
const TOKEN = process.env.GITHUB_TOKEN;
const DEFAULT_BRANCH = 'main';
const OUT_FILE = 'branch-protection-evidence.json';
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
const missing = REQUIRED_CONTEXTS.filter((context) => !actual.includes(context));
const extra = actual.filter((context) => !REQUIRED_CONTEXTS.includes(context));
const strictMatches = Boolean(data?.required_status_checks?.strict) === baseline.strict;
const enforceAdminsMatches = Boolean(data?.enforce_admins?.enabled ?? data?.enforce_admins) === baseline.enforceAdmins;
const reviewCount = Number(data?.required_pull_request_reviews?.required_approving_review_count || 0);
const dismissStale = Boolean(data?.required_pull_request_reviews?.dismiss_stale_reviews);
const pass = missing.length === 0
  && strictMatches
  && enforceAdminsMatches
  && reviewCount === baseline.requiredApprovingReviewCount
  && dismissStale === baseline.dismissStaleReviews;

const evidence = {
  timestamp: new Date().toISOString(),
  branch: BRANCH,
  required_contexts: REQUIRED_CONTEXTS,
  actual_contexts: actual,
  missing_contexts: missing,
  extra_contexts: extra,
  strict_expected: baseline.strict,
  strict_actual: Boolean(data?.required_status_checks?.strict),
  enforce_admins_expected: baseline.enforceAdmins,
  enforce_admins_actual: Boolean(data?.enforce_admins?.enabled ?? data?.enforce_admins),
  required_approving_review_count_expected: baseline.requiredApprovingReviewCount,
  required_approving_review_count_actual: reviewCount,
  dismiss_stale_reviews_expected: baseline.dismissStaleReviews,
  dismiss_stale_reviews_actual: dismissStale,
  result: pass ? 'pass' : 'fail'
};

writeEvidence(evidence);

if (!pass) {
  console.error('Branch protection mismatch');
  if (missing.length) console.error(`Missing: ${missing.join(', ')}`);
  if (!strictMatches) console.error(`Strict mismatch: expected ${baseline.strict}, got ${Boolean(data?.required_status_checks?.strict)}`);
  if (!enforceAdminsMatches) {
    console.error(`enforce_admins mismatch: expected ${baseline.enforceAdmins}, got ${Boolean(data?.enforce_admins?.enabled ?? data?.enforce_admins)}`);
  }
  if (reviewCount !== baseline.requiredApprovingReviewCount) {
    console.error(`required_approving_review_count mismatch: expected ${baseline.requiredApprovingReviewCount}, got ${reviewCount}`);
  }
  if (dismissStale !== baseline.dismissStaleReviews) {
    console.error(`dismiss_stale_reviews mismatch: expected ${baseline.dismissStaleReviews}, got ${dismissStale}`);
  }
  if (extra.length) console.warn(`Extra contexts present (allowed): ${extra.join(', ')}`);
  process.exit(1);
}

if (extra.length) {
  console.warn(`Extra contexts present (not enforced by baseline): ${extra.join(', ')}`);
}

console.log('Branch protection verified - baseline requirements present');
