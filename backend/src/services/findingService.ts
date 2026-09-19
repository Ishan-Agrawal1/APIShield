import type { ExecutionResult, Finding } from '@apishield/contracts';
import { ExecutionRecordModel } from '../models/ExecutionRecord.js';
import { FindingModel, toFinding } from '../models/Finding.js';
import { AppError } from '../utils/errors.js';
import { sanitize } from '../utils/sanitize.js';
import { pingMongo } from '../config/db.js';

export async function persistExecutions(executions: ExecutionResult[]): Promise<void> {
  if (executions.length === 0) {
    return;
  }
  if (!(await pingMongo())) {
    throw new AppError(503, 'DB_UNAVAILABLE', 'MongoDB is not ready.');
  }
  const docs = executions.map((item) => {
    const sanitized = sanitize(item) as ExecutionResult;
    return {
      _id: sanitized.id,
      scanId: sanitized.scanId,
      testCaseId: sanitized.testCaseId,
      endpointId: sanitized.endpointId,
      authContextId: sanitized.authContextId,
      startedAt: sanitized.startedAt,
      durationMs: sanitized.durationMs,
      request: sanitized.request,
      response: sanitized.response,
      outcome: sanitized.outcome,
      errorCode: sanitized.errorCode,
      bodyTruncated: sanitized.bodyTruncated,
      observedBytes: sanitized.observedBytes,
    };
  });
  await ExecutionRecordModel.insertMany(docs, { ordered: false }).catch((error: { code?: number }) => {
    if (error.code !== 11000) {
      throw error;
    }
  });
}

export async function persistFindings(findings: Finding[]): Promise<void> {
  if (!(await pingMongo())) {
    throw new AppError(503, 'DB_UNAVAILABLE', 'MongoDB is not ready.');
  }
  for (const finding of findings) {
    const sanitized = sanitize(finding) as Finding;
    try {
      await FindingModel.updateOne(
        { scanId: sanitized.scanId, dedupKey: sanitized.dedupKey },
        {
          $setOnInsert: {
            _id: sanitized.id,
            scanId: sanitized.scanId,
            ruleId: sanitized.ruleId,
            vulnerability: sanitized.vulnerability,
            severity: sanitized.severity,
            confidence: sanitized.confidence,
            endpointId: sanitized.endpointId,
            endpoint: sanitized.endpoint,
            method: sanitized.method,
            parameter: sanitized.parameter,
            description: sanitized.description,
            evidence: sanitized.evidence,
            remediation: sanitized.remediation,
            dedupKey: sanitized.dedupKey,
            createdAt: sanitized.createdAt,
            analysisMode: sanitized.analysisMode,
            optionalAiAnalysis: sanitized.optionalAiAnalysis,
          },
          $addToSet: { executionIds: { $each: sanitized.executionIds } },
        },
        { upsert: true },
      );
    } catch (error) {
      throw new AppError(500, 'FINDING_WRITE_FAILED', 'Failed to persist a finding.', false);
    }
  }
}

export async function listFindings(scanId: string, query: { severity?: string; vulnerability?: string; page?: number; limit?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const filter: Record<string, unknown> = { scanId };
  if (query.severity) {
    filter.severity = query.severity;
  }
  if (query.vulnerability) {
    filter.vulnerability = query.vulnerability;
  }
  const [items, total] = await Promise.all([
    FindingModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    FindingModel.countDocuments(filter),
  ]);
  return { items: items.map((item) => toFinding(item)), total, page, limit };
}

export async function getFinding(id: string): Promise<Finding> {
  const doc = await FindingModel.findById(id);
  if (!doc) {
    throw new AppError(404, 'FINDING_NOT_FOUND', 'Finding not found.');
  }
  return toFinding(doc);
}
