import { LIMITS } from '@apishield/contracts';

type Job = (signal: AbortSignal) => Promise<void>;

const queue: Array<{ id: string; run: () => Promise<void> }> = [];
let active = 0;
const running = new Map<string, AbortController>();

export function enqueueScan(id: string, run: Job): AbortController {
  const controller = new AbortController();
  running.set(id, controller);
  queue.push({
    id,
    run: async () => {
      active += 1;
      try {
        await run(controller.signal);
      } finally {
        active -= 1;
        running.delete(id);
        pump();
      }
    },
  });
  pump();
  return controller;
}

function pump(): void {
  while (active < 1 && queue.length > 0 && queue.length <= LIMITS.maxScanQueue) {
    const job = queue.shift();
    if (!job) {
      return;
    }
    void job.run();
  }
}

export function cancelScan(id: string): boolean {
  const controller = running.get(id);
  if (!controller) {
    const index = queue.findIndex((item) => item.id === id);
    if (index >= 0) {
      queue.splice(index, 1);
      return true;
    }
    return false;
  }
  controller.abort();
  return true;
}

export function getScanAbortSignal(id: string): AbortSignal | undefined {
  return running.get(id)?.signal;
}

export function resetQueueForTests(): void {
  queue.length = 0;
  active = 0;
  running.clear();
}
