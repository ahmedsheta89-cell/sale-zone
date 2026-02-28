import { describe, expect, it } from 'vitest';
import { nextState, type RolloutState } from '../../scripts/lib/rolloutPhases.js';

describe('rollout progressive ramp', () => {
  it('walks deterministic phase order to complete', () => {
    const seen: string[] = [];
    let state: RolloutState = { phase: 'SHADOW_BOOT', trafficPercent: 0 };
    for (let i = 0; i < 10; i += 1) {
      seen.push(state.phase);
      if (state.phase === 'COMPLETE') break;
      state = nextState(state);
    }
    expect(seen).toEqual([
      'SHADOW_BOOT',
      'READINESS_BARRIER',
      'RAMP_5',
      'RAMP_25',
      'RAMP_50',
      'RAMP_100',
      'DRAIN_OLD',
      'COMPLETE'
    ]);
  });
});
