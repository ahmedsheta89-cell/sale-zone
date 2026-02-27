#!/usr/bin/env node
/**
 * enforce-branch-protection.mjs
 * Applies required branch protection contexts to main via GitHub API.
 * Runs inside CI only — uses GITHUB_TOKEN automatically.
 */

const OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1];
const TOKEN = process.env.GITHUB_TOKEN;
const BRANCH = 'main';
const DRY_RUN = process.argv.includes('--dry-run');

const REQUIRED_CONTEXTS = [
  'preflight',
  'contracts-check',
  'security-regression-check',
  'workers-paranoid-gate',
  'ci-parity'
];

const payload = {
  required_status_checks: {
    strict: true,
    contexts: REQUIRED_CONTEXTS
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    required_approving_review_count: 1,
    dismiss_stale_reviews: true
  },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false
};

if (DRY_RUN) {
  console.log('[dry-run] Would apply payload:');
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

if (!TOKEN || !OWNER || !REPO) {
  console.error('Missing GITHUB_TOKEN, GITHUB_REPOSITORY_OWNER, or GITHUB_REPOSITORY');
  process.exit(1);
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
  console.error(`Failed to apply protection: ${res.status}\n${err}`);
  process.exit(1);
}

console.log(`✅ Branch protection applied to ${BRANCH}`);
console.log(`   Contexts: ${REQUIRED_CONTEXTS.join(', ')}`);
