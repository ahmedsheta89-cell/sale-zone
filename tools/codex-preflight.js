'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const root = process.cwd();

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function runNodeScript(relPath) {
  const result = spawnSync(process.execPath, [path.join(root, relPath)], {
    cwd: root,
    env: process.env,
    encoding: 'utf8'
  });

  return {
    pass: result.status === 0,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
}

function githubGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sale-zone-codex-preflight'
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
            reject(new Error(`GitHub response parse failed: ${error.message}`));
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

async function isMainReleaseGatePassing() {
  const data = await githubGet('https://api.github.com/repos/ahmedsheta89-cell/sale-zone/actions/runs?branch=main&per_page=10');
  const releaseGate = Array.isArray(data.workflow_runs)
    ? data.workflow_runs.find((run) => run && run.name === 'Release Gate')
    : null;

  if (!releaseGate) {
    return { pass: false, detail: 'No Release Gate run found for main.' };
  }

  const pass = releaseGate.status === 'completed' && releaseGate.conclusion === 'success';
  return {
    pass,
    detail: `status=${releaseGate.status} conclusion=${releaseGate.conclusion} sha=${releaseGate.head_sha}`
  };
}

async function main() {
  const checks = [];

  try {
    const mainGate = await isMainReleaseGatePassing();
    checks.push({
      name: 'Main Release Gate passing',
      pass: mainGate.pass,
      detail: mainGate.detail
    });
  } catch (error) {
    checks.push({
      name: 'Main Release Gate passing',
      pass: false,
      detail: error.message
    });
  }

  checks.push({
    name: 'GOVERNANCE.md exists',
    pass: exists('GOVERNANCE.md')
  });
  checks.push({
    name: 'PR template exists',
    pass: exists('.github/pull_request_template.md')
  });
  checks.push({
    name: 'Branch protection baseline exists',
    pass: exists('.github/branch-protection-baseline.json')
  });
  checks.push({
    name: 'Daily health check workflow exists',
    pass: exists('.github/workflows/daily-health-check.yml')
  });

  const governanceCheck = runNodeScript('tools/verify-branch-protection.js');
  checks.push({
    name: 'Branch protection matches baseline',
    pass: governanceCheck.pass,
    detail: governanceCheck.pass ? 'OK' : (governanceCheck.stderr || governanceCheck.stdout || 'Failed')
  });

  const smokeCheck = runNodeScript('tools/smoke-check.js');
  checks.push({
    name: 'smoke-check',
    pass: smokeCheck.pass,
    detail: smokeCheck.pass ? 'PASS' : (smokeCheck.stderr || smokeCheck.stdout || 'Failed')
  });

  const contractsCheck = runNodeScript('tools/contracts-check.js');
  checks.push({
    name: 'contracts-check',
    pass: contractsCheck.pass,
    detail: contractsCheck.pass ? 'PASS' : (contractsCheck.stderr || contractsCheck.stdout || 'Failed')
  });

  const adminMonitorCheck = runNodeScript('tools/admin-function-monitor.js');
  checks.push({
    name: 'admin-function-monitor',
    pass: adminMonitorCheck.pass,
    detail: adminMonitorCheck.pass ? 'PASS' : (adminMonitorCheck.stderr || adminMonitorCheck.stdout || 'Failed')
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CODEX PREFLIGHT REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let allPass = true;
  for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
    if (check.detail) {
      console.log(`   ${check.detail}`);
    }
    if (!check.pass) {
      allPass = false;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!allPass) {
    console.error('PREFLIGHT FAILED — fix issues before starting work');
    process.exit(1);
  }

  console.log('✅ All checks passed — safe to start work');
}

main().catch((error) => {
  console.error(`PREFLIGHT FAILED — ${error.message}`);
  process.exit(1);
});
