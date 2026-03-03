import { createQueue } from './core/queue-factory.js';
import { createStallGuard } from './core/stall-guard.js';
import { RuntimeHandle, withTimeout } from './core/runtime-handle.js';
import { bootEmailWorker } from './email.worker.js';
import { bootWebhookWorker } from './webhook.worker.js';
import { bootCleanupWorker } from './cleanup.worker.js';
import { startNodeRegistryHeartbeat } from './cluster/node-registry.js';
import { startParanoidWatchdogDaemon } from './watchdog/paranoid-monitor.js';
import { log } from './observability/logger.js';

type QueueRuntime = {
  queueName: string;
  queue: Awaited<ReturnType<typeof createQueue>>;
};

async function drainQueues(queues: QueueRuntime[], maxDrainMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started <= maxDrainMs) {
    let active = 0;
    for (const runtime of queues) {
      const counts = await runtime.queue.getJobCounts('active');
      active += counts.active ?? 0;
    }
    if (active === 0) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('queue_drain_timeout');
}

async function main(): Promise<void> {
  const stepTimeoutMs = Math.max(1000, Number(process.env.SHUTDOWN_STEP_TIMEOUT_MS ?? 10_000));
  const shutdownTimeoutMs = Math.max(10_000, Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 60_000));
  const maxDrainMs = Math.max(5000, Number(process.env.MAX_DRAIN_MS ?? 30_000));

  const workers = await Promise.all([bootEmailWorker(), bootWebhookWorker(), bootCleanupWorker()]);
  const stallGuards = (await Promise.all(workers.map((w) => createStallGuard(String(w.queueName))))).filter(Boolean) as RuntimeHandle[];
  const queueRuntimes = await Promise.all(
    workers.map(async (w) => ({ queueName: String(w.queueName), queue: await createQueue(String(w.queueName)) }))
  );
  const nodeHeartbeatStop = await startNodeRegistryHeartbeat(`bootstrap-${process.pid}`, queueRuntimes.map((q) => q.queueName), 30_000);
  const stopWatchdog = startParanoidWatchdogDaemon();

  log('info', 'workers bootstrap active', {
    workers: workers.map((w) => ({ name: w.name, queueName: w.queueName })),
    stallGuards: stallGuards.length
  });

  let shuttingDown = false;
  const shutdown = async (reason: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('warn', 'workers bootstrap shutdown start', { reason });
    const started = Date.now();
    try {
      await withTimeout('shutdown_total', async () => {
        await withTimeout('queue_pause', async () => {
          await Promise.all(queueRuntimes.map((q) => q.queue.pause()));
        }, stepTimeoutMs);

        await withTimeout('queue_drain', () => drainQueues(queueRuntimes, maxDrainMs), stepTimeoutMs + maxDrainMs);

        await withTimeout('close_workers', async () => {
          await Promise.all(workers.map((worker) => worker.close()));
        }, stepTimeoutMs);

        await withTimeout('close_events_and_stall', async () => {
          await Promise.all(stallGuards.map((guard) => guard.close()));
        }, stepTimeoutMs);

        await withTimeout('close_queues', async () => {
          await Promise.all(queueRuntimes.map((runtime) => runtime.queue.close()));
        }, stepTimeoutMs);

        await withTimeout('close_node_registry', async () => {
          await nodeHeartbeatStop();
        }, stepTimeoutMs);

        stopWatchdog();
      }, shutdownTimeoutMs);
      log('info', 'workers bootstrap shutdown complete', { reason, durationMs: Date.now() - started });
      process.exitCode = 0;
    } catch (error) {
      log('error', 'workers bootstrap shutdown failed', { reason, durationMs: Date.now() - started, message: (error as Error).message });
      process.exitCode = 1;
    }
  };

  process.once('SIGTERM', () => {
    void shutdown('sigterm');
  });
  process.once('SIGINT', () => {
    void shutdown('sigint');
  });
  process.once('beforeExit', () => {
    void shutdown('before_exit');
  });
}

main().catch((error) => {
  log('error', 'workers bootstrap fatal', { message: (error as Error).message });
  process.exitCode = 2;
});
