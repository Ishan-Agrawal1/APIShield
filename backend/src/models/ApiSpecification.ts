import mongoose from 'mongoose';
import type { ApiSpecification } from '@apishield/contracts';

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    sourceHash: { type: String, required: true, index: true },
    openapiVersion: { type: String, required: true },
    title: { type: String, required: true },
    createdAt: { type: String, required: true },
    normalizedEndpoints: { type: [mongoose.Schema.Types.Mixed], required: true },
    warnings: { type: [mongoose.Schema.Types.Mixed], default: [] },
    supportSummary: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { versionKey: false },
);

schema.index({ createdAt: -1 });

export const ApiSpecificationModel = mongoose.model('ApiSpecification', schema);

export function toApiSpecification(doc: { toObject(): Record<string, unknown> } & { _id: string }): ApiSpecification {
  const raw = doc.toObject();
  return {
    id: String(raw._id),
    sourceHash: String(raw.sourceHash),
    openapiVersion: String(raw.openapiVersion),
    title: String(raw.title),
    createdAt: String(raw.createdAt),
    normalizedEndpoints: raw.normalizedEndpoints as ApiSpecification['normalizedEndpoints'],
    warnings: raw.warnings as ApiSpecification['warnings'],
    supportSummary: raw.supportSummary as ApiSpecification['supportSummary'],
  };
}
