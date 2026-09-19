import type { Confidence, Severity } from '@apishield/contracts';

export function bolaSeverity(confidence: Confidence): Severity {
  return confidence === 'confirmed' ? 'high' : confidence === 'potential' ? 'medium' : 'low';
}

export function authSeverity(confidence: Confidence): Severity {
  return confidence === 'confirmed' ? 'high' : 'medium';
}

export function misconfigSeverity(ruleId: string): Severity {
  if (ruleId === 'DEBUG_INFORMATION') {
    return 'medium';
  }
  if (ruleId === 'MISSING_SECURITY_DECLARATION') {
    return 'low';
  }
  return 'informational';
}
