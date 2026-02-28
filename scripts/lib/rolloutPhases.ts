export const ROLLOUT_PHASES = [
  'SHADOW_BOOT',
  'READINESS_BARRIER',
  'RAMP_5',
  'RAMP_25',
  'RAMP_50',
  'RAMP_100',
  'DRAIN_OLD',
  'COMPLETE',
  'ROLLBACK'
] as const;

export type RolloutPhase = (typeof ROLLOUT_PHASES)[number];

export type RolloutState = {
  phase: RolloutPhase;
  trafficPercent: number;
  reason?: string;
};

export function buildRampPhase(trafficPercent: number): RolloutPhase {
  switch (trafficPercent) {
    case 5:
      return 'RAMP_5';
    case 25:
      return 'RAMP_25';
    case 50:
      return 'RAMP_50';
    case 100:
      return 'RAMP_100';
    default:
      throw new Error(`unsupported_ramp_step:${trafficPercent}`);
  }
}

export function nextState(current: RolloutState): RolloutState {
  if (current.phase === 'ROLLBACK' || current.phase === 'COMPLETE') {
    return current;
  }
  if (current.phase === 'SHADOW_BOOT') return { phase: 'READINESS_BARRIER', trafficPercent: 0 };
  if (current.phase === 'READINESS_BARRIER') return { phase: 'RAMP_5', trafficPercent: 5 };
  if (current.phase === 'RAMP_5') return { phase: 'RAMP_25', trafficPercent: 25 };
  if (current.phase === 'RAMP_25') return { phase: 'RAMP_50', trafficPercent: 50 };
  if (current.phase === 'RAMP_50') return { phase: 'RAMP_100', trafficPercent: 100 };
  if (current.phase === 'RAMP_100') return { phase: 'DRAIN_OLD', trafficPercent: 100 };
  if (current.phase === 'DRAIN_OLD') return { phase: 'COMPLETE', trafficPercent: 100 };
  return current;
}
