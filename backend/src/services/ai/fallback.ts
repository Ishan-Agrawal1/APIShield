import type { Finding } from '@apishield/contracts';

const TEMPLATES: Record<string, { explanation: string; potentialImpact: string; remediation: string; developerSummary: string }> = {
  BOLA_READ_CROSS_USER: {
    explanation: 'The API returned another user\'s object to an authenticated caller who is not the owner.',
    potentialImpact: 'Attackers who know or guess object identifiers can read another user\'s private data.',
    remediation: 'Enforce object-level authorization on the server before returning the object.',
    developerSummary: 'Check ownership (or an explicit share policy) inside the handler for this object route.',
  },
  AUTH_BYPASS: {
    explanation: 'A protected operation returned protected data without a valid credential.',
    potentialImpact: 'Unauthenticated callers may obtain account or object data.',
    remediation: 'Reject missing, invalid, malformed, and expired credentials on every protected route.',
    developerSummary: 'Apply the same authentication middleware used by /auth/me to this operation.',
  },
  DEBUG_INFORMATION: {
    explanation: 'A debug endpoint or stack-trace indicator was observed in a response.',
    potentialImpact: 'Implementation details can help an attacker refine further attacks.',
    remediation: 'Disable debug endpoints outside local development and avoid returning stack traces.',
    developerSummary: 'Gate diagnostic routes behind an explicit local-only configuration flag.',
  },
  CORS_UNTRUSTED_ORIGIN: {
    explanation: 'The API reflected an untrusted Origin together with credentialed CORS headers.',
    potentialImpact: 'A malicious website may be able to read responses if a browser sends cookies or tokens.',
    remediation: 'Allow only explicit trusted origins; do not combine origin reflection with credentials.',
    developerSummary: 'Replace origin reflection with an allowlist.',
  },
  SERVER_VERSION_DISCLOSURE: {
    explanation: 'A server or framework version header was observed.',
    potentialImpact: 'The information is low impact by itself but can fingerprint the stack.',
    remediation: 'Remove or genericize Server and X-Powered-By headers.',
    developerSummary: 'Disable default framework identification headers.',
  },
};

const DEFAULT = {
  explanation: 'A rule-based check recorded this finding from observed responses.',
  potentialImpact: 'Impact depends on the data exposed by the operation.',
  remediation: 'Review the evidence and enforce the missing control on the server.',
  developerSummary: 'Treat this as a deterministic rule-based note, not an AI conclusion.',
};

export function ruleBasedAnalysis(finding: Finding) {
  return TEMPLATES[finding.ruleId] ?? DEFAULT;
}
