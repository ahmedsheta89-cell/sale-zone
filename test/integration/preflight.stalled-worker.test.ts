import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { createStallGuard } from '../../workers/core/stall-guard.js';

const runIntegration = process.env.RUN_REDIS_INTEGRATION === 'true';

describe.skipIf(!runIntegration)('preflight stalled-worker guard bootstrap', () => {
  let container: StartedTestContainer | null = null;

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
    const host = container.getHost();
    const port = container.getMappedPort(6379);
    process.env.REDIS_URL = `redis://${host}:${port}`;
    process.env.REDIS_TLS = 'false';
  }, 30_000);

  afterAll(async () => {
    if (container) await container.stop();
  }, 30_000);

  it('creates stall guard successfully with live redis', async () => {
    const guard = await createStallGuard('prod:cleanup');
    expect(guard).not.toBeNull();
    if (guard) await guard.close();
  }, 30_000);
});
