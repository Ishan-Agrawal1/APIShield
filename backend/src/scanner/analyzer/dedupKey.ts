export function buildDedupKey(parts: {
  ruleId: string;
  endpointId: string;
  parameter?: string;
  objectContext?: string;
  authPair?: string;
}): string {
  return [parts.ruleId, parts.endpointId, parts.parameter ?? '-', parts.objectContext ?? '-', parts.authPair ?? '-'].join('|');
}
