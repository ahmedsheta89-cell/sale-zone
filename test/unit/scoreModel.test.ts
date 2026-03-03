import { describe, expect, it } from 'vitest';
import { scoreCandidate } from '../../scripts/lib/scoreModel.js';

describe('score model', () => {
  it('rejects candidate if mandatory checks fail', () => {
    const score = scoreCandidate({
      sha: 'abc',
      mandatory: {
        contractPresent: true,
        processorsPresent: false,
        queueBindingsValid: true,
        heartbeatConfigured: true,
        workerEntrypointsPresent: true,
        redisConfigPresent: true
      },
      signals: {
        commitUnixTime: 1000,
        runtimePass: true,
        runtimeScore: 900,
        warnings: []
      }
    });
    expect(score.mandatoryPass).toBe(false);
    expect(score.score).toBe(-1);
  });

  it('scores deterministic for healthy candidate', () => {
    const score = scoreCandidate({
      sha: 'def',
      mandatory: {
        contractPresent: true,
        processorsPresent: true,
        queueBindingsValid: true,
        heartbeatConfigured: true,
        workerEntrypointsPresent: true,
        redisConfigPresent: true
      },
      signals: {
        commitUnixTime: 1_700_000_000,
        runtimePass: true,
        runtimeScore: 800,
        warnings: []
      }
    });
    expect(score.mandatoryPass).toBe(true);
    expect(score.score).toBeGreaterThan(0);
  });
});
