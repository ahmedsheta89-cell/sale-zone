import path from 'node:path';
import { loadQueueContract } from './lib/queueContracts.js';
import { appendNdjson, writeJsonReport } from './lib/reportWriter.js';
import { buildRampPhase, nextState, type RolloutState } from './lib/rolloutPhases.js';
import { checkWorkerReadiness } from './lib/workerReadiness.js';

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === 'workers' ? path.resolve(cwd, '..') : cwd;
}

function resolveContractPath(): string {
  return path.resolve(resolveRepoRoot(), 'workers/contracts/queue-contract.json');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function resolvePhaseStabilityMs(defaultMs: number, phase: string): number {
  const map: Record<string, number> = {
    SHADOW_BOOT: Number(process.env.ROLLOUT_SHADOW_SEC ?? 30) * 1000,
    RAMP_5: Number(process.env.ROLLOUT_CANARY_SEC ?? 2 * 60 * 60) * 1000,
    RAMP_25: Number(process.env.ROLLOUT_RAMP25_SEC ?? 4 * 60 * 60) * 1000,
    RAMP_50: Number(process.env.ROLLOUT_RAMP50_SEC ?? 8 * 60 * 60) * 1000
  };
  if (phase in map) return Math.max(1000, map[phase] ?? defaultMs);
  return Math.max(1000, defaultMs);
}

function timelinePath(): string {
  return path.resolve(resolveRepoRoot(), 'workers/output/rollout-timeline.ndjson');
}

function reportPath(): string {
  return path.resolve(resolveRepoRoot(), 'workers/output/rollout-safe.report.json');
}

function legacyTimelinePath(): string {
  return path.resolve(resolveRepoRoot(), 'reports/rollout-timeline.ndjson');
}

function legacyReportPath(): string {
  return path.resolve(resolveRepoRoot(), 'reports/rollout-safe.report.json');
}

function writeTimeline(entry: Record<string, unknown>): void {
  const payload = { at: new Date().toISOString(), ...entry };
  appendNdjson(timelinePath(), payload);
  appendNdjson(legacyTimelinePath(), payload);
}

function writeFinalReport(payload: Record<string, unknown>): void {
  writeJsonReport(reportPath(), payload);
  writeJsonReport(legacyReportPath(), payload);
}

async function evaluateStep(state: RolloutState, stabilityMs: number): Promise<{ pass: boolean; reasons: string[] }> {
  const phaseStabilityMs = resolvePhaseStabilityMs(stabilityMs, state.phase);
  writeTimeline({ phase: state.phase, status: 'start', trafficPercent: state.trafficPercent });
  const repoRoot = resolveRepoRoot();
  const readiness = await checkWorkerReadiness(resolveContractPath(), repoRoot);
  if (!readiness.pass) {
    writeTimeline({
      phase: state.phase,
      status: 'fail',
      trafficPercent: state.trafficPercent,
      reasons: readiness.reasons
    });
    return { pass: false, reasons: readiness.reasons };
  }
  await sleep(phaseStabilityMs);
  writeTimeline({
    phase: state.phase,
    status: 'pass',
    trafficPercent: state.trafficPercent,
    redisRttMs: readiness.redisRttMs,
    stabilityMs: phaseStabilityMs
  });
  return { pass: true, reasons: [] };
}

async function main(): Promise<void> {
  const contract = loadQueueContract(resolveContractPath());
  const stabilityMs = contract.rollout.stepStabilitySec * 1000;
  const rampSteps = contract.rollout.stepsPercent;
  const stateHistory: RolloutState[] = [];

  let state: RolloutState = { phase: 'SHADOW_BOOT', trafficPercent: 0 };
  stateHistory.push(state);

  while (state.phase !== 'COMPLETE' && state.phase !== 'ROLLBACK') {
    if (state.phase.startsWith('RAMP_')) {
      const stepResult = await evaluateStep(state, stabilityMs);
      if (!stepResult.pass) {
        state = { phase: 'ROLLBACK', trafficPercent: 0, reason: stepResult.reasons.join(',') };
        stateHistory.push(state);
        writeTimeline({ phase: 'ROLLBACK', status: 'start', reason: state.reason });
        break;
      }
      state = nextState(state);
      stateHistory.push(state);
      continue;
    }

    if (state.phase === 'READINESS_BARRIER') {
      const readiness = await evaluateStep(state, Math.max(1000, stabilityMs / 2));
      if (!readiness.pass) {
        state = { phase: 'ROLLBACK', trafficPercent: 0, reason: readiness.reasons.join(',') };
        stateHistory.push(state);
        writeTimeline({ phase: 'ROLLBACK', status: 'start', reason: state.reason });
        break;
      }
      state = { phase: buildRampPhase(rampSteps[0] ?? 5), trafficPercent: rampSteps[0] ?? 5 };
      stateHistory.push(state);
      continue;
    }

    if (state.phase === 'SHADOW_BOOT') {
      const shadow = await evaluateStep(state, 1000);
      if (!shadow.pass) {
        state = { phase: 'ROLLBACK', trafficPercent: 0, reason: shadow.reasons.join(',') };
        stateHistory.push(state);
        writeTimeline({ phase: 'ROLLBACK', status: 'start', reason: state.reason });
        break;
      }
      state = nextState(state);
      stateHistory.push(state);
      continue;
    }

    if (state.phase === 'DRAIN_OLD') {
      const drainMs = Math.min(contract.rollout.maxDrainSec * 1000, 30_000);
      writeTimeline({ phase: state.phase, status: 'start', drainMs });
      await sleep(drainMs);
      writeTimeline({ phase: state.phase, status: 'pass' });
      state = nextState(state);
      stateHistory.push(state);
      continue;
    }

    state = nextState(state);
    stateHistory.push(state);
  }

  if (state.phase === 'ROLLBACK') {
    writeTimeline({ phase: 'ROLLBACK', status: 'complete', reason: state.reason });
    writeFinalReport({
      generatedAt: new Date().toISOString(),
      status: 'rollback',
      reason: state.reason ?? 'unknown',
      stateHistory
    });
    process.exitCode = 1;
    return;
  }

  writeTimeline({ phase: 'COMPLETE', status: 'pass' });
  writeFinalReport({
    generatedAt: new Date().toISOString(),
    status: 'complete',
    stateHistory
  });
  process.exitCode = 0;
}

main().catch((error) => {
  writeTimeline({ phase: 'ROLLBACK', status: 'fatal', reason: (error as Error).message });
  writeFinalReport({
    generatedAt: new Date().toISOString(),
    status: 'rollback',
    reason: (error as Error).message
  });
  process.exitCode = 2;
});
