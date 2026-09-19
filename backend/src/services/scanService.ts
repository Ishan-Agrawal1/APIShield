import type { ScannerName, Scan, Severity, Confidence } from '@apishield/contracts';
import { SEVERITIES, CONFIDENCES } from '@apishield/contracts';
import { pingMongo } from '../config/db.js';
import { getTargetProfile } from '../config/targetProfiles.js';
import { clampExecutionLimits } from '../config/limits.js';
import { ScanModel, toScan } from '../models/Scan.js';
import { AppError } from '../utils/errors.js';
import { newId, nowIso } from '../utils/ids.js';
import { getSpecification } from './specificationService.js';
import { generateTestCases } from '../scanner/generator/testCaseGenerator.js';
import { enqueueScan, cancelScan } from '../scanner/engine/scanQueue.js';
import { runScan } from '../scanner/engine/scanEngine.js';
import { sanitize } from '../utils/sanitize.js';

export function emptyFindingSummary(): Scan['summary'] {
  return {
    findingsBySeverity: Object.fromEntries(SEVERITIES.map((item) => [item, 0])) as Record<Severity, number>,
    findingsByConfidence: Object.fromEntries(CONFIDENCES.map((item) => [item, 0])) as Record<Confidence, number>,
  };
}

export async function previewScan(input: { specificationId: string; targetProfileId: string }) {
  const spec = await getSpecification(input.specificationId);
  const profile = getTargetProfile(input.targetProfileId);
  if (!profile) {
    throw new AppError(404, 'TARGET_NOT_FOUND', 'Approved target profile not found.');
  }
  const cases = generateTestCases(spec, profile);
  return {
    specificationId: spec.id,
    targetProfileId: profile.id,
    endpointCount: spec.normalizedEndpoints.length,
    generated: cases.length,
    eligible: cases.filter((item) => item.executionEligibility.eligible).length,
    skipped: cases.filter((item) => !item.executionEligibility.eligible).length,
    cases: sanitize(cases),
  };
}

export interface RuntimeCredentialInput {
  reference: string;
  token: string;
}

export async function createScan(input: {
  specificationId: string;
  targetProfileId: string;
  selectedEndpointIds?: string[];
  enabledScanners?: ScannerName[];
  resourceObservations?: boolean;
  dryRun?: boolean;
  runtimeCredentials?: RuntimeCredentialInput[];
}) {
  if (!(await pingMongo())) {
    throw new AppError(503, 'DB_UNAVAILABLE', 'MongoDB is not ready.');
  }
  const spec = await getSpecification(input.specificationId);
  const profile = getTargetProfile(input.targetProfileId);
  if (!profile) {
    throw new AppError(404, 'TARGET_NOT_FOUND', 'Approved target profile not found.');
  }
  const enabledScanners = input.enabledScanners ?? ['bola', 'authentication', 'misconfiguration', 'resource'];
  const runtimeCredentials = normalizeRuntimeCredentials(input.runtimeCredentials, profile.credentialReferences);
  const scanId = newId();
  const startedAt = nowIso();
  const snapshot = {
    targetProfileId: profile.id,
    approvedOrigin: profile.approvedOrigin,
    selectedEndpointIds: input.selectedEndpointIds ?? null,
    enabledScanners,
    resourceObservations: Boolean(input.resourceObservations),
    dryRun: Boolean(input.dryRun),
    limits: clampExecutionLimits(profile.executionLimits),
  };
  await ScanModel.create({
    _id: scanId,
    specificationId: spec.id,
    targetProfileId: profile.id,
    configurationSnapshot: snapshot,
    status: 'queued',
    startedAt,
    completedAt: null,
    progress: { totalPlanned: 0, executed: 0, skipped: 0, errored: 0, percent: 0 },
    summary: emptyFindingSummary(),
    coverage: [],
    errorLog: [],
  });

  if (input.dryRun) {
    await ScanModel.updateOne(
      { _id: scanId },
      { $set: { status: 'completed', completedAt: nowIso(), progress: { totalPlanned: 0, executed: 0, skipped: 0, errored: 0, percent: 100 } } },
    );
    return getScan(scanId);
  }

  enqueueScan(scanId, (signal) =>
    runScan({
      scanId,
      spec,
      profile: { ...profile, executionLimits: snapshot.limits },
      enabledScanners,
      resourceObservations: snapshot.resourceObservations,
      runtimeCredentials,
      signal,
    }),
  );
  return getScan(scanId);
}

function normalizeRuntimeCredentials(
  input: RuntimeCredentialInput[] | undefined,
  allowed: string[],
): RuntimeCredentialInput[] {
  if (!input?.length) {
    return [];
  }
  const output: RuntimeCredentialInput[] = [];
  for (const item of input) {
    const reference = String(item.reference ?? '').trim();
    const token = String(item.token ?? '').trim();
    if (!reference && !token) {
      continue;
    }
    if (!allowed.includes(reference)) {
      throw new AppError(400, 'UNKNOWN_CREDENTIAL_REFERENCE', 'Runtime credential reference is not permitted for this target.');
    }
    if (!token) {
      continue;
    }
    output.push({ reference, token });
  }
  return output;
}

export async function getScan(id: string): Promise<Scan> {
  const doc = await ScanModel.findById(id);
  if (!doc) {
    throw new AppError(404, 'SCAN_NOT_FOUND', 'Scan not found.');
  }
  return toScan(doc);
}

export async function listScans(page = 1, limit = 20) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const [items, total] = await Promise.all([
    ScanModel.find().sort({ startedAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit),
    ScanModel.countDocuments(),
  ]);
  return { items: items.map((item) => toScan(item)), total, page: safePage, limit: safeLimit };
}

export async function cancelQueuedOrRunning(id: string): Promise<Scan> {
  const scan = await getScan(id);
  if (!['queued', 'running'].includes(scan.status)) {
    throw new AppError(409, 'SCAN_NOT_CANCELLABLE', 'Only queued or running scans can be cancelled.');
  }
  cancelScan(id);
  await ScanModel.updateOne(
    { _id: id, status: { $in: ['queued', 'running'] } },
    { $set: { status: 'cancelled', completedAt: nowIso() } },
  );
  return getScan(id);
}
