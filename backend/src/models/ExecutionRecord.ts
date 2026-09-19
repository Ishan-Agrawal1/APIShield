import mongoose from 'mongoose';
import type { ExecutionResult } from '@apishield/contracts';

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    scanId: { type: String, required: true },
    testCaseId: { type: String, required: true },
    endpointId: { type: String, required: true },
    authContextId: { type: String, default: null },
    startedAt: { type: String, required: true },
    durationMs: { type: Number, required: true },
    request: { type: mongoose.Schema.Types.Mixed, required: true },
    response: { type: mongoose.Schema.Types.Mixed, required: true },
    outcome: { type: String, required: true },
    errorCode: { type: String },
    bodyTruncated: { type: Boolean, required: true },
    observedBytes: { type: Number, required: true },
  },
  { versionKey: false },
);

schema.index({ scanId: 1, testCaseId: 1 });
schema.index({ scanId: 1, startedAt: 1 });

export const ExecutionRecordModel = mongoose.model('ExecutionRecord', schema);

export function toExecutionResult(
  doc: { toObject(): Record<string, unknown> } & { _id: string },
): ExecutionResult {
  const raw = doc.toObject();
  return {
    id: String(raw._id),
    scanId: String(raw.scanId),
    testCaseId: String(raw.testCaseId),
    endpointId: String(raw.endpointId),
    authContextId: (raw.authContextId as string | null) ?? null,
    startedAt: String(raw.startedAt),
    durationMs: Number(raw.durationMs),
    request: raw.request as ExecutionResult['request'],
    response: raw.response as ExecutionResult['response'],
    outcome: raw.outcome as ExecutionResult['outcome'],
    errorCode: raw.errorCode as string | undefined,
    bodyTruncated: Boolean(raw.bodyTruncated),
    observedBytes: Number(raw.observedBytes),
  };
}
