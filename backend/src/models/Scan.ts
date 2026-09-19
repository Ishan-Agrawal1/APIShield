import mongoose from 'mongoose';
import type { Scan } from '@apishield/contracts';

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    specificationId: { type: String, required: true },
    targetProfileId: { type: String, required: true },
    configurationSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, required: true, index: true },
    startedAt: { type: String, required: true },
    completedAt: { type: String, default: null },
    progress: { type: mongoose.Schema.Types.Mixed, required: true },
    summary: { type: mongoose.Schema.Types.Mixed, required: true },
    coverage: { type: [mongoose.Schema.Types.Mixed], default: [] },
    errorLog: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { versionKey: false },
);

schema.index({ startedAt: -1 });
schema.index({ status: 1, startedAt: -1 });

export const ScanModel = mongoose.model('Scan', schema);

export function toScan(doc: { toObject(): Record<string, unknown> } & { _id: string }): Scan {
  const raw = doc.toObject();
  return {
    id: String(raw._id),
    specificationId: String(raw.specificationId),
    targetProfileId: String(raw.targetProfileId),
    configurationSnapshot: raw.configurationSnapshot as Scan['configurationSnapshot'],
    status: raw.status as Scan['status'],
    startedAt: String(raw.startedAt),
    completedAt: (raw.completedAt as string | null) ?? null,
    progress: raw.progress as Scan['progress'],
    summary: raw.summary as Scan['summary'],
    coverage: raw.coverage as Scan['coverage'],
    errors: raw.errorLog as Scan['errors'],
  };
}
