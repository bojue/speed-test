import type { LighthouseReport } from './lighthouseProbe';
import { runLighthouse } from './lighthouseProbe';

/**
 * Serialized Lighthouse job queue.
 *
 * `runLighthouse` launches a full headless Chrome instance per audit, so running many
 * audits concurrently would exhaust memory and CPU and crash the probe node. This queue
 * processes audits one at a time (a single "worker" slot); callers await the promise they
 * enqueue, so the HTTP handler stays asynchronous while Chrome usage stays bounded.
 */

type Job = () => Promise<void>;

const queue: Job[] = [];
let running = false;

function drain(): void {
  if (running || queue.length === 0) return;
  running = true;
  const job = queue.shift()!;
  void job();
}

/** Enqueue a Lighthouse audit and resolve with its report (or null on failure/timeout). */
export function enqueueLighthouse(url: string, timeoutMs?: number, deviceProfile?: string): Promise<LighthouseReport | null> {
  return new Promise((resolve) => {
    const job: Job = async () => {
      try {
        resolve(await runLighthouse(url, timeoutMs, deviceProfile));
      } catch {
        resolve(null);
      } finally {
        running = false;
        drain();
      }
    };
    queue.push(job);
    drain();
  });
}
