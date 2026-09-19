export const SCAN_STATES = [
  'queued',
  'running',
  'completed',
  'partial',
  'failed',
  'cancelled',
] as const;
export type ScanState = (typeof SCAN_STATES)[number];

export const CHECK_OUTCOMES = [
  'finding',
  'no_finding',
  'inconclusive',
  'skipped',
  'error',
] as const;
export type CheckOutcome = (typeof CHECK_OUTCOMES)[number];

export const EXECUTION_OUTCOMES = [
  'response',
  'timeout',
  'transport_error',
  'blocked_by_policy',
  'cancelled',
  'not_executed_budget',
  'not_executed_ineligible',
] as const;
export type ExecutionOutcome = (typeof EXECUTION_OUTCOMES)[number];

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'informational'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ['confirmed', 'potential', 'inconclusive'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const ANALYSIS_MODES = ['rule_based', 'ai_assisted'] as const;
export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

export const SAFETY_CLASSES = ['read_only', 'mutating', 'destructive', 'unsupported'] as const;
export type SafetyClass = (typeof SAFETY_CLASSES)[number];

export const SUPPORT_STATUSES = ['supported', 'partial', 'unsupported'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const TEST_VARIANTS = [
  'valid',
  'invalid',
  'missing',
  'boundary',
  'other_user',
  'extra_field',
  'empty_body',
  'wrong_type',
  'no_credential',
  'invalid_credential',
  'malformed_credential',
  'expired_credential',
  'untrusted_origin',
  'unexpected_method',
] as const;
export type TestVariant = (typeof TEST_VARIANTS)[number];

export const SCANNERS = ['bola', 'authentication', 'misconfiguration', 'resource'] as const;
export type ScannerName = (typeof SCANNERS)[number];

export const PARAMETER_LOCATIONS = ['path', 'query', 'header', 'cookie'] as const;
export type ParameterLocation = (typeof PARAMETER_LOCATIONS)[number];
