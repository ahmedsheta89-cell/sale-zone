'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const root = process.cwd();
const baselinePath = path.join(root, '.github', 'branch-protection-baseline.json');

function readBaseline() {
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline file missing: ${baselinePath}`);
  }
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

function githubRequest(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sale-zone-governance-check'
      }
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Failed to parse GitHub response JSON: ${error.message}`));
          }
          return;
        }

        reject(new Error(`GitHub API ${res.statusCode}: ${body}`));
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function normalizeContexts(requiredStatusChecks) {
  if (!requiredStatusChecks) return [];
  if (Array.isArray(requiredStatusChecks.contexts)) {
    return requiredStatusChecks.contexts.map(String);
  }
  if (Array.isArray(requiredStatusChecks.checks)) {
    return requiredStatusChecks.checks
      .map((check) => String(check && check.context || '').trim())
      .filter(Boolean);
  }
  return [];
}

async function main() {
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  if (!token) {
    console.error('GITHUB_TOKEN is required to verify branch protection.');
    process.exit(1);
  }

  const baseline = readBaseline();
  const current = await githubRequest(
    'https://api.github.com/repos/ahmedsheta89-cell/sale-zone/branches/main/protection',
    token
  );

  const baselineContexts = new Set(normalizeContexts(baseline.required_status_checks));
  const currentContexts = new Set(normalizeContexts(current.required_status_checks));

  const missing = [...baselineContexts].filter((context) => !currentContexts.has(context));
  const extra = [...currentContexts].filter((context) => !baselineContexts.has(context));
  const failures = [];

  const currentStrict = Boolean(current.required_status_checks && current.required_status_checks.strict);
  const currentEnforceAdmins = Boolean(
    current.enforce_admins && typeof current.enforce_admins === 'object'
      ? current.enforce_admins.enabled
      : current.enforce_admins
  );
  const currentReviewCount = Number(
    current.required_pull_request_reviews && current.required_pull_request_reviews.required_approving_review_count || 0
  );
  const currentDismissStale = Boolean(
    current.required_pull_request_reviews && current.required_pull_request_reviews.dismiss_stale_reviews
  );

  if (currentStrict !== Boolean(baseline.required_status_checks.strict)) {
    failures.push(`strict mismatch: baseline=${baseline.required_status_checks.strict} current=${currentStrict}`);
  }
  if (currentEnforceAdmins !== Boolean(baseline.enforce_admins)) {
    failures.push(`enforce_admins mismatch: baseline=${baseline.enforce_admins} current=${currentEnforceAdmins}`);
  }
  if (currentReviewCount !== Number(baseline.required_approving_review_count)) {
    failures.push(`required_approving_review_count mismatch: baseline=${baseline.required_approving_review_count} current=${currentReviewCount}`);
  }
  if (currentDismissStale !== Boolean(baseline.dismiss_stale_reviews)) {
    failures.push(`dismiss_stale_reviews mismatch: baseline=${baseline.dismiss_stale_reviews} current=${currentDismissStale}`);
  }
  if (missing.length > 0) {
    failures.push(`missing required contexts: ${missing.join(', ')}`);
  }

  if (extra.length > 0) {
    console.warn(`EXTRA contexts (not in baseline): ${extra.join(', ')}`);
  }

  if (failures.length > 0) {
    console.error('Branch protection mismatch detected:');
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exit(1);
  }

  console.log('Branch protection: OK');
}

main().catch((error) => {
  console.error(`Branch protection verification failed: ${error.message}`);
  process.exit(1);
});
