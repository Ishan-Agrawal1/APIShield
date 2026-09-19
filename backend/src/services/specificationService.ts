import { LIMITS, type ApiSpecification } from '@apishield/contracts';
import { ApiSpecificationModel, toApiSpecification } from '../models/ApiSpecification.js';
import { assignEndpointIds, parseOpenApiDocument } from '../scanner/parser/openApiParser.js';
import { AppError } from '../utils/errors.js';
import { newId, nowIso } from '../utils/ids.js';
import { sanitize } from '../utils/sanitize.js';
import { pingMongo } from '../config/db.js';

export async function ingestSpecification(raw: string): Promise<ApiSpecification> {
  if (!(await pingMongo())) {
    throw new AppError(503, 'DB_UNAVAILABLE', 'MongoDB is not ready.');
  }
  if (Buffer.byteLength(raw, 'utf8') > LIMITS.openApiUploadBytes) {
    throw new AppError(413, 'UPLOAD_TOO_LARGE', 'OpenAPI document exceeds the 2 MiB limit.');
  }
  const parsed = parseOpenApiDocument(raw);
  const id = newId();
  const endpoints = assignEndpointIds(id, parsed.sourceHash, parsed.endpoints);
  const document: ApiSpecification = {
    id,
    sourceHash: parsed.sourceHash,
    openapiVersion: parsed.openapiVersion,
    title: parsed.title,
    createdAt: nowIso(),
    normalizedEndpoints: endpoints,
    warnings: parsed.warnings,
    supportSummary: parsed.supportSummary,
  };
  const sanitized = sanitize(document) as ApiSpecification;
  await ApiSpecificationModel.create({
    _id: sanitized.id,
    sourceHash: sanitized.sourceHash,
    openapiVersion: sanitized.openapiVersion,
    title: sanitized.title,
    createdAt: sanitized.createdAt,
    normalizedEndpoints: sanitized.normalizedEndpoints,
    warnings: sanitized.warnings,
    supportSummary: sanitized.supportSummary,
  });
  return sanitized;
}

export async function getSpecification(id: string): Promise<ApiSpecification> {
  const doc = await ApiSpecificationModel.findById(id);
  if (!doc) {
    throw new AppError(404, 'SPEC_NOT_FOUND', 'Specification not found.');
  }
  return toApiSpecification(doc);
}
