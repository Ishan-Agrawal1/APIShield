import { LIMITS, type ExecutionLimits } from '@apishield/contracts';

export function defaultExecutionLimits(): ExecutionLimits {
  return {
    httpTimeoutMs: LIMITS.httpTimeoutMs,
    maxHttpAttempts: LIMITS.maxHttpAttemptsPerScan,
    concurrentTargetRequests: LIMITS.concurrentTargetRequests,
    maxTargetRequestStartsPerSecond: LIMITS.maxTargetRequestStartsPerSecond,
    maxRequestBodyBytes: LIMITS.maxRequestBodyBytes,
    maxCapturedResponseBytes: LIMITS.maxCapturedResponseBytes,
    maxScanDurationMs: LIMITS.maxScanDurationMs,
    resourceProbeRepetition: LIMITS.resourceProbeRepetition,
  };
}

export function clampExecutionLimits(requested?: Partial<ExecutionLimits>): ExecutionLimits {
  const defaults = defaultExecutionLimits();
  if (!requested) {
    return defaults;
  }
  return {
    httpTimeoutMs: clamp(requested.httpTimeoutMs, 500, defaults.httpTimeoutMs),
    maxHttpAttempts: clamp(requested.maxHttpAttempts, 1, defaults.maxHttpAttempts),
    concurrentTargetRequests: clamp(requested.concurrentTargetRequests, 1, defaults.concurrentTargetRequests),
    maxTargetRequestStartsPerSecond: clamp(
      requested.maxTargetRequestStartsPerSecond,
      1,
      defaults.maxTargetRequestStartsPerSecond,
    ),
    maxRequestBodyBytes: clamp(requested.maxRequestBodyBytes, 256, defaults.maxRequestBodyBytes),
    maxCapturedResponseBytes: clamp(requested.maxCapturedResponseBytes, 1024, defaults.maxCapturedResponseBytes),
    maxScanDurationMs: clamp(requested.maxScanDurationMs, 1000, defaults.maxScanDurationMs),
    resourceProbeRepetition: clamp(requested.resourceProbeRepetition, 1, defaults.resourceProbeRepetition),
  };
}

function clamp(value: number | undefined, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return max;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export { LIMITS };
