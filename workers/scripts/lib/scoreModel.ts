export type CandidateMandatory = {
  contractPresent: boolean;
  processorsPresent: boolean;
  queueBindingsValid: boolean;
  heartbeatConfigured: boolean;
  workerEntrypointsPresent: boolean;
  redisConfigPresent: boolean;
};

export type CandidateSignals = {
  commitUnixTime: number;
  runtimePass: boolean;
  runtimeScore: number;
  warnings: string[];
};

export type CandidateScoreInput = {
  sha: string;
  mandatory: CandidateMandatory;
  signals: CandidateSignals;
};

export type CandidateScore = {
  sha: string;
  mandatoryPass: boolean;
  score: number;
  reasons: string[];
};

export function scoreCandidate(input: CandidateScoreInput): CandidateScore {
  const reasons: string[] = [];
  const mandatory = input.mandatory;
  for (const [key, value] of Object.entries(mandatory)) {
    if (!value) reasons.push(`mandatory_failed:${key}`);
  }
  if (!input.signals.runtimePass) reasons.push('runtime_probe_failed');
  reasons.push(...input.signals.warnings.map((warning) => `warning:${warning}`));

  const mandatoryPass = reasons.filter((reason) => reason.startsWith('mandatory_failed')).length === 0;
  if (!mandatoryPass || !input.signals.runtimePass) {
    return { sha: input.sha, mandatoryPass: false, score: -1, reasons };
  }

  const runtimeComponent = Math.max(0, Math.min(1000, input.signals.runtimeScore));
  const recencyComponent = Math.floor(input.signals.commitUnixTime / 1000);
  return {
    sha: input.sha,
    mandatoryPass: true,
    score: runtimeComponent * 1_000_000 + recencyComponent,
    reasons
  };
}
