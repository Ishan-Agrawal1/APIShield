import mongoose from 'mongoose';
import type { Finding } from '@apishield/contracts';

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    scanId: { type: String, required: true },
    ruleId: { type: String, required: true },
    vulnerability: { type: String, required: true },
    severity: { type: String, required: true },
    confidence: { type: String, required: true },
    endpointId: { type: String, required: true },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    parameter: { type: String },
    description: { type: String, required: true },
    evidence: { type: mongoose.Schema.Types.Mixed, required: true },
    executionIds: { type: [String], default: [] },
    remediation: { type: String, required: true },
    dedupKey: { type: String, required: true },
    createdAt: { type: String, required: true },
    analysisMode: { type: String, required: true },
    optionalAiAnalysis: { type: mongoose.Schema.Types.Mixed },
  },
  { versionKey: false },
);

schema.index({ scanId: 1, dedupKey: 1 }, { unique: true });
schema.index({ scanId: 1, severity: 1 });
schema.index({ scanId: 1, createdAt: -1 });

export const FindingModel = mongoose.model('Finding', schema);

export function toFinding(doc: { toObject(): Record<string, unknown> } & { _id: string }): Finding {
  const raw = doc.toObject();
  return {
    id: String(raw._id),
    scanId: String(raw.scanId),
    ruleId: String(raw.ruleId),
    vulnerability: String(raw.vulnerability),
    severity: raw.severity as Finding['severity'],
    confidence: raw.confidence as Finding['confidence'],
    endpointId: String(raw.endpointId),
    endpoint: String(raw.endpoint),
    method: String(raw.method),
    parameter: raw.parameter as string | undefined,
    description: String(raw.description),
    evidence: raw.evidence as Finding['evidence'],
    executionIds: raw.executionIds as string[],
    remediation: String(raw.remediation),
    dedupKey: String(raw.dedupKey),
    createdAt: String(raw.createdAt),
    analysisMode: raw.analysisMode as Finding['analysisMode'],
    optionalAiAnalysis: raw.optionalAiAnalysis as Finding['optionalAiAnalysis'],
  };
}
