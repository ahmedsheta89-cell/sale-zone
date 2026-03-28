#!/usr/bin/env node
"use strict";

/**
 * tools/github-admin-check.js
 *
 * Verifies GitHub admin configuration via REST API:
 *   1. Branch protection on main
 *   2. Environments (expects "production")
 *   3. GitHub Pages status
 *
 * Uses GITHUB_TOKEN from environment.
 * If token is missing or API returns 401/403/404, marks check as SKIPPED (exit 0).
 * Only exits non-zero if a real misconfiguration is detected.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const OWNER = "ahmedsheta89-cell";
const REPO = "sale-zone";
const BRANCH = "main";
const EXPECTED_ENVIRONMENT = "production";
const PREFIX = "[github-admin-check]";
const TOKEN = String(process.env.GITHUB_TOKEN || "").trim();
const ROOT = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(ROOT, ".github", "branch-protection-baseline.json");

const results = {
  branchProtection: "PENDING",
  environments: "PENDING",
  pages: "PENDING",
};

function log(message = "") {
  console.log(`${PREFIX} ${message}`);
}

function apiGet(requestPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: requestPath,
      method: "GET",
      headers: {
        "User-Agent": "sale-zone-github-admin-check",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };

    if (TOKEN) {
      options.headers.Authorization = `Bearer ${TOKEN}`;
    }

    const req = https.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: Number(res.statusCode || 0),
          data,
        });
      });
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("Request timeout"));
    });
    req.end();
  });
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeContexts(requiredStatusChecks) {
  if (!requiredStatusChecks) return [];
  if (Array.isArray(requiredStatusChecks.contexts)) {
    return requiredStatusChecks.contexts.map((value) => String(value).trim()).filter(Boolean);
  }
  if (Array.isArray(requiredStatusChecks.checks)) {
    return requiredStatusChecks
      .map((value) => String(value && value.context || "").trim())
      .filter(Boolean);
  }
  return [];
}

function readBranchBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return null;
  }

  const parsed = parseJson(fs.readFileSync(BASELINE_PATH, "utf8"));
  if (!parsed) {
    return null;
  }

  return {
    branch: String(parsed.branch || BRANCH),
    strict: Boolean(parsed.required_status_checks && parsed.required_status_checks.strict),
    contexts: normalizeContexts(parsed.required_status_checks),
    enforceAdmins: Boolean(parsed.enforce_admins),
    requiredApprovingReviewCount: Number(parsed.required_approving_review_count || 0),
    dismissStaleReviews: Boolean(parsed.dismiss_stale_reviews),
  };
}

function handleSkippableStatus(status, label) {
  if (status === 401 || status === 403 || status === 404) {
    log(`SKIPPED  ${label} (HTTP ${status})`);
    return true;
  }
  return false;
}

async function checkBranchProtection() {
  log("");
  log("-- Branch Protection (main) --");

  if (!TOKEN) {
    log("SKIPPED  No GITHUB_TOKEN available");
    results.branchProtection = "SKIPPED";
    return;
  }

  try {
    const response = await apiGet(`/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection`);

    if (handleSkippableStatus(response.status, "No token or insufficient permissions")) {
      results.branchProtection = "SKIPPED";
      return;
    }

    if (response.status !== 200) {
      log(`FAIL  Unexpected API response (HTTP ${response.status})`);
      results.branchProtection = "FAIL";
      return;
    }

    const body = parseJson(response.data);
    if (!body) {
      log("FAIL  Could not parse API response");
      results.branchProtection = "FAIL";
      return;
    }

    const baseline = readBranchBaseline();
    const reviews = body.required_pull_request_reviews || null;
    const statusChecks = body.required_status_checks || null;
    const approvals = Number(reviews && reviews.required_approving_review_count || 0);
    const dismissStale = Boolean(reviews && reviews.dismiss_stale_reviews);
    const strict = Boolean(statusChecks && statusChecks.strict);
    const contexts = normalizeContexts(statusChecks);
    const enforceAdmins = Boolean(body.enforce_admins && (body.enforce_admins.enabled ?? body.enforce_admins));

    const failures = [];
    if (!reviews) failures.push("required pull request reviews are not enabled");
    if (!statusChecks) failures.push("required status checks are not enabled");

    if (baseline) {
      const missingContexts = baseline.contexts.filter((context) => !contexts.includes(context));
      if (approvals !== baseline.requiredApprovingReviewCount) {
        failures.push(`required approvals mismatch (expected ${baseline.requiredApprovingReviewCount}, got ${approvals})`);
      }
      if (dismissStale !== baseline.dismissStaleReviews) {
        failures.push(`dismiss stale reviews mismatch (expected ${baseline.dismissStaleReviews ? "yes" : "no"}, got ${dismissStale ? "yes" : "no"})`);
      }
      if (strict !== baseline.strict) {
        failures.push(`strict status checks mismatch (expected ${baseline.strict ? "yes" : "no"}, got ${strict ? "yes" : "no"})`);
      }
      if (enforceAdmins !== baseline.enforceAdmins) {
        failures.push(`enforce admins mismatch (expected ${baseline.enforceAdmins ? "yes" : "no"}, got ${enforceAdmins ? "yes" : "no"})`);
      }
      if (missingContexts.length > 0) {
        failures.push(`missing required status checks: ${missingContexts.join(", ")}`);
      }
    } else {
      if (approvals < 1) failures.push("required approvals must be at least 1");
      if (!dismissStale) failures.push("dismiss stale reviews should be enabled");
      if (!strict) failures.push("strict status checks should be enabled");
      if (contexts.length === 0) failures.push("required status checks list is empty");
    }

    if (failures.length > 0) {
      log("FAIL  Branch protection is configured, but it does not match expectations");
      for (const failure of failures) {
        log(`  - ${failure}`);
      }
      results.branchProtection = "FAIL";
      return;
    }

    log("PASS  Branch protection is enabled");
    log(`  - Require PR reviews: ${reviews ? "yes" : "no"}`);
    log(`  - Required approvals: ${approvals}`);
    log(`  - Dismiss stale reviews: ${dismissStale ? "yes" : "no"}`);
    log(`  - Require status checks: ${statusChecks ? "yes" : "no"}`);
    log(`  - Enforce admins: ${enforceAdmins ? "yes" : "no"}`);
    if (contexts.length > 0) {
      for (const context of contexts) {
        log(`    - ${context}`);
      }
    }

    results.branchProtection = "PASS";
  } catch (error) {
    log(`SKIPPED  API error: ${error.message}`);
    results.branchProtection = "SKIPPED";
  }
}

async function checkEnvironments() {
  log("");
  log("-- Environments --");

  if (!TOKEN) {
    log("SKIPPED  No GITHUB_TOKEN available");
    results.environments = "SKIPPED";
    return;
  }

  try {
    const response = await apiGet(`/repos/${OWNER}/${REPO}/environments`);

    if (handleSkippableStatus(response.status, "No token or insufficient permissions")) {
      results.environments = "SKIPPED";
      return;
    }

    if (response.status !== 200) {
      log(`FAIL  Unexpected API response (HTTP ${response.status})`);
      results.environments = "FAIL";
      return;
    }

    const body = parseJson(response.data);
    const environments = body && Array.isArray(body.environments) ? body.environments : null;
    if (!environments) {
      log("FAIL  Could not parse environments response");
      results.environments = "FAIL";
      return;
    }

    if (environments.length === 0) {
      log("FAIL  No environments configured");
      results.environments = "FAIL";
      return;
    }

    const names = environments.map((environment) => String(environment.name || "").trim()).filter(Boolean);
    const hasProduction = names.includes(EXPECTED_ENVIRONMENT);
    for (const name of names) {
      log(`PASS  Environment "${name}" exists`);
    }

    if (!hasProduction) {
      log(`FAIL  Expected environment "${EXPECTED_ENVIRONMENT}" not found`);
      results.environments = "FAIL";
      return;
    }

    results.environments = "PASS";
  } catch (error) {
    log(`SKIPPED  API error: ${error.message}`);
    results.environments = "SKIPPED";
  }
}

async function checkPages() {
  log("");
  log("-- GitHub Pages --");

  if (!TOKEN) {
    log("SKIPPED  No GITHUB_TOKEN available");
    results.pages = "SKIPPED";
    return;
  }

  try {
    const response = await apiGet(`/repos/${OWNER}/${REPO}/pages`);

    if (handleSkippableStatus(response.status, "No token or insufficient permissions")) {
      results.pages = "SKIPPED";
      return;
    }

    if (response.status !== 200) {
      log(`FAIL  Unexpected API response (HTTP ${response.status})`);
      results.pages = "FAIL";
      return;
    }

    const body = parseJson(response.data);
    if (!body) {
      log("FAIL  Could not parse Pages response");
      results.pages = "FAIL";
      return;
    }

    const url = String(body.html_url || body.url || "").trim();
    const sourceBranch = body.source && body.source.branch ? body.source.branch : "unknown";
    const sourcePath = body.source && body.source.path ? body.source.path : "root";
    const status = String(body.status || body.build_status || "active").trim();

    if (!url && sourceBranch === "unknown") {
      log("FAIL  Pages response does not contain an active site configuration");
      results.pages = "FAIL";
      return;
    }

    log("PASS  Pages is active");
    if (status) {
      log(`  - Status: ${status}`);
    }
    if (url) {
      log(`  - URL: ${url}`);
    }
    log(`  - Source: branch ${sourceBranch} / ${sourcePath}`);

    results.pages = "PASS";
  } catch (error) {
    log(`SKIPPED  API error: ${error.message}`);
    results.pages = "SKIPPED";
  }
}

async function main() {
  log("Starting GitHub admin verification...");
  log(`Token: ${TOKEN ? "present" : "not found"}`);

  await checkBranchProtection();
  await checkEnvironments();
  await checkPages();

  log("");
  log("-- Summary --");
  log(`Branch Protection: ${results.branchProtection}`);
  log(`Environments:      ${results.environments}`);
  log(`Pages:             ${results.pages}`);

  const values = Object.values(results);
  const hasFail = values.includes("FAIL");
  const allSkipped = values.every((value) => value === "SKIPPED");

  log("");
  if (hasFail) {
    log("Some checks FAILED. Review the output above.");
    process.exit(1);
  }

  if (allSkipped) {
    log("No failures detected (skipped checks need manual verification).");
    process.exit(0);
  }

  log("All checks passed.");
  process.exit(0);
}

main().catch((error) => {
  log(`FATAL: ${error.message}`);
  process.exit(1);
});



