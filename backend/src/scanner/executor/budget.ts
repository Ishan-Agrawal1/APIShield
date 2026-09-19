export class ScanBudget {
  readonly maxAttempts: number;
  readonly maxConcurrent: number;
  readonly maxStartsPerSecond: number;
  readonly deadlineMs: number;
  attempts = 0;
  inFlight = 0;
  stoppedForThrottle = false;
  private readonly timestamps: number[] = [];
  private readonly startedAt = Date.now();

  constructor(options: {
    maxAttempts: number;
    maxConcurrent: number;
    maxStartsPerSecond: number;
    maxDurationMs: number;
  }) {
    this.maxAttempts = options.maxAttempts;
    this.maxConcurrent = options.maxConcurrent;
    this.maxStartsPerSecond = options.maxStartsPerSecond;
    this.deadlineMs = this.startedAt + options.maxDurationMs;
  }

  remaining(): number {
    return Math.max(0, this.maxAttempts - this.attempts);
  }

  expired(): boolean {
    return Date.now() >= this.deadlineMs;
  }

  canStart(): boolean {
    return !this.stoppedForThrottle && !this.expired() && this.remaining() > 0 && this.inFlight < this.maxConcurrent;
  }

  async acquire(): Promise<boolean> {
    if (this.stoppedForThrottle || this.expired() || this.remaining() <= 0) {
      return false;
    }
    while (this.inFlight >= this.maxConcurrent) {
      await delay(25);
      if (this.stoppedForThrottle || this.expired()) {
        return false;
      }
    }
    while (startsInLastSecond(this.timestamps) >= this.maxStartsPerSecond) {
      await delay(50);
      if (this.stoppedForThrottle || this.expired()) {
        return false;
      }
    }
    this.attempts += 1;
    this.inFlight += 1;
    this.timestamps.push(Date.now());
    return true;
  }

  release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }

  noteThrottle(): void {
    this.stoppedForThrottle = true;
  }
}

function startsInLastSecond(timestamps: number[]): number {
  const cutoff = Date.now() - 1000;
  while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
    timestamps.shift();
  }
  return timestamps.length;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
