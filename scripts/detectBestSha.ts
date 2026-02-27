import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { QueueContractSchema, validateContractConsistency } from './lib/queueContracts.js';
import { validateRuntime } from './lib/runtimeValidators.js';
import { getCommitUnixTime, listCandidateShas, pathExistsAtSha, readFileAtSha } from './lib/gitCandidates.js';
import { scoreCandidate, type CandidateMandatory, type CandidateScore } from './lib/scoreModel.js';
import { writeJsonReport } from './lib/reportWriter.js';

type CandidateAudit = {
  sha: string;
  mandatory: CandidateMandatory;
  runtime: { pass: boolean; score: number; warnings: string[] };
  score: CandidateScore;
};

const CONTRACT_PATH = 'workers/contracts/queue-contract.json';
const WORKER_ENTRYPOINTS = ['workers/email.worker.ts', 'workers/webhook.worker.ts', 'workers/cleanup.worker.ts'];
const REDIS_CONFIG_PATHS = ['infra/redis/connection.ts', 'infra/redis/redis.config.ts', 'infra/redis/healthcheck.ts'];

function getHeadSha(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === 'workers' ? path.resolve(cwd, '..') : cwd;
}

function buildMandatoryChecks(sha: string): CandidateMandatory {
  const contractPresent = pathExistsAtSha(sha, CONTRACT_PATH);
  let processorsPresent = false;
  let queueBindingsValid = false;
  let heartbeatConfigured = false;

  if (contractPresent) {
    try {
      const contractRaw = readFileAtSha(sha, CONTRACT_PATH);
      const contract = QueueContractSchema.parse(JSON.parse(contractRaw));
      const consistency = validateContractConsistency(contract);
      processorsPresent = contract.processors.every((p) => pathExistsAtSha(sha, p.module));
      queueBindingsValid = consistency.pass;
      heartbeatConfigured = contract.heartbeat.intervalMs > 0 && contract.heartbeat.requiredBeats > 0;
    } catch {
      processorsPresent = false;
      queueBindingsValid = false;
      heartbeatConfigured = false;
    }
  }

  const workerEntrypointsPresent = WORKER_ENTRYPOINTS.every((entry) => pathExistsAtSha(sha, entry));
  const redisConfigPresent = REDIS_CONFIG_PATHS.every((entry) => pathExistsAtSha(sha, entry));

  return {
    contractPresent,
    processorsPresent,
    queueBindingsValid,
    heartbeatConfigured,
    workerEntrypointsPresent,
    redisConfigPresent
  };
}

async function runtimeProbeForHeadSha(candidateSha: string, headSha: string): Promise<{ pass: boolean; score: number; warnings: string[] }> {
  if (candidateSha !== headSha) {
    return { pass: false, score: 0, warnings: ['runtime_probe_skipped_non_head_sha'] };
  }

  const repoRoot = resolveRepoRoot();
  const checks = await validateRuntime(path.resolve(repoRoot, CONTRACT_PATH), repoRoot);
  const failed = checks.filter((check) => !check.pass);
  const passed = checks.length - failed.length;
  const score = checks.length === 0 ? 0 : Math.round((passed / checks.length) * 1000);

  return {
    pass: failed.length === 0,
    score,
    warnings: failed.map((check) => check.name)
  };
}

function printTable(rows: CandidateAudit[]): void {
  const header = ['sha', 'mandatory', 'runtime', 'score', 'reasons'];
  console.log(header.join('\t'));
  for (const row of rows) {
    const reasons = row.score.reasons.join(',') || '-';
    console.log([row.sha, row.score.mandatoryPass ? 'pass' : 'fail', row.runtime.pass ? 'pass' : 'fail', String(row.score.score), reasons].join('\t'));
  }
}

async function main(): Promise<void> {
  const repoRoot = resolveRepoRoot();
  const maxCandidates = Number(process.env.MAX_CANDIDATES ?? '20');
  const candidates = listCandidateShas(maxCandidates);
  const headSha = getHeadSha();
  const audits: CandidateAudit[] = [];

  for (const sha of candidates) {
    const mandatory = buildMandatoryChecks(sha);
    const runtime = await runtimeProbeForHeadSha(sha, headSha);
    const score = scoreCandidate({
      sha,
      mandatory,
      signals: {
        commitUnixTime: getCommitUnixTime(sha),
        runtimePass: runtime.pass,
        runtimeScore: runtime.score,
        warnings: runtime.warnings
      }
    });
    audits.push({ sha, mandatory, runtime, score });
  }

  audits.sort((a, b) => b.score.score - a.score.score);
  const selected = audits.find((audit) => audit.score.mandatoryPass && audit.runtime.pass) ?? null;

  const report = {
    generatedAt: new Date().toISOString(),
    selectedSha: selected?.sha ?? null,
    mode: 'fail-closed',
    candidateCount: audits.length,
    candidates: audits
  };

  const outputPrimary = path.resolve(repoRoot, 'workers/output/detect-best-sha.report.json');
  const outputSecondary = path.resolve(repoRoot, 'reports/paranoid-ultra-scan.json');
  writeJsonReport(outputPrimary, report);
  writeJsonReport(outputSecondary, report);
  printTable(audits);

  process.exitCode = selected ? 0 : 1;
}

main().catch((error) => {
  const repoRoot = resolveRepoRoot();
  const outputPrimary = path.resolve(repoRoot, 'workers/output/detect-best-sha.report.json');
  const outputSecondary = path.resolve(repoRoot, 'reports/paranoid-ultra-scan.json');
  const payload = {
    generatedAt: new Date().toISOString(),
    selectedSha: null,
    fatal: (error as Error).message
  };
  writeJsonReport(outputPrimary, payload);
  writeJsonReport(outputSecondary, payload);
  process.exitCode = 2;
});
