// Preflight backup + verification helper for paranoid rollout.
// Usage:
//   node scripts/preflight-verify.js --create
//   node scripts/preflight-verify.js

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'output');
const bundlePath = path.join(outputDir, 'preflight-backup.bundle');
const baselinePath = path.join(outputDir, 'preflight-baseline.json');
const verifyPath = path.join(outputDir, 'preflight-verify.json');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    shell: false,
    encoding: 'utf8'
  });
  if (result.error) {
    return {
      ok: false,
      status: result.status,
      stdout: String(result.stdout || '').trim(),
      stderr: String(result.stderr || '').trim(),
      error: String(result.error.message || result.error)
    };
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    error: null
  };
}

function parseWorktrees(raw) {
  const entries = [];
  const chunks = raw.split(/\n\n+/).map((chunk) => chunk.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/);
    const item = {};
    for (const line of lines) {
      const [key, ...rest] = line.split(' ');
      item[key] = rest.join(' ');
    }
    if (item.worktree) entries.push(item);
  }
  return entries;
}

function collectBaseline() {
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout;
  const head = run('git', ['rev-parse', 'HEAD']).stdout;
  const upstreamRes = run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const upstream = upstreamRes.ok ? upstreamRes.stdout : null;
  const aheadBehind = upstream
    ? run('git', ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]).stdout
    : null;
  const worktreesRaw = run('git', ['worktree', 'list', '--porcelain']).stdout;
  return {
    generatedAt: new Date().toISOString(),
    branch,
    head,
    upstream,
    aheadBehind,
    worktrees: parseWorktrees(worktreesRaw)
  };
}

function ensureOutputDir() {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
}

function main() {
  const createMode = process.argv.includes('--create');
  ensureOutputDir();

  const checks = [];

  if (createMode) {
    const bundleCreate = run('git', ['bundle', 'create', bundlePath, '--all']);
    checks.push({ name: 'bundle_create', pass: bundleCreate.ok, details: bundleCreate });
    const baseline = collectBaseline();
    fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  }

  const bundleExists = fs.existsSync(bundlePath);
  checks.push({ name: 'bundle_exists', pass: bundleExists, details: { bundlePath } });
  if (bundleExists) {
    const bundleVerify = run('git', ['bundle', 'verify', bundlePath]);
    checks.push({ name: 'bundle_verify', pass: bundleVerify.ok, details: bundleVerify });
  }

  const baselineExists = fs.existsSync(baselinePath);
  checks.push({ name: 'baseline_exists', pass: baselineExists, details: { baselinePath } });
  if (baselineExists) {
    const raw = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const baselineValid = Boolean(raw.branch && raw.head && Array.isArray(raw.worktrees));
    checks.push({ name: 'baseline_shape_valid', pass: baselineValid, details: { branch: raw.branch, head: raw.head } });
  }

  const rollbackHeadVerify = run('git', ['rev-parse', '--verify', 'HEAD']);
  checks.push({ name: 'rollback_head_verify', pass: rollbackHeadVerify.ok, details: rollbackHeadVerify });
  if (bundleExists) {
    const rollbackSyntax = run('git', ['bundle', 'verify', bundlePath]);
    checks.push({ name: 'rollback_bundle_verify_syntax', pass: rollbackSyntax.ok, details: rollbackSyntax });
  } else {
    checks.push({
      name: 'rollback_bundle_verify_syntax',
      pass: false,
      details: { bundlePath, reason: 'bundle_missing' }
    });
  }

  const pass = checks.every((check) => check.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    createMode,
    pass,
    checks
  };

  fs.writeFileSync(verifyPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!pass) {
    console.error('preflight-verify: FAILED');
    process.exit(1);
  }
  console.log('preflight-verify: OK');
}

main();
