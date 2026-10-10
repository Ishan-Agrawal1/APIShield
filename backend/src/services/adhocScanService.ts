import type { ApiSpecification, RouteScanInput, ScannerName } from '@apishield/contracts';
import { pingMongo } from '../config/db.js';
import { clampExecutionLimits, defaultExecutionLimits } from '../config/limits.js';
import { ApiSpecificationModel } from '../models/ApiSpecification.js';
import { ScanModel } from '../models/Scan.js';
import { assignEndpointIds } from '../scanner/parser/openApiParser.js';
import { analyzeRoute } from '../scanner/adhoc/routeAnalyzer.js';
import { generateAdhocProbes } from '../scanner/adhoc/adhocGenerator.js';
import { runAdhocScan } from '../scanner/adhoc/adhocRunner.js';
import { enqueueScan } from '../scanner/engine/scanQueue.js';
import { AppError } from '../utils/errors.js';
import { newId, nowIso, sha256Hex } from '../utils/ids.js';
import { sanitize } from '../utils/sanitize.js';
import { emptyFindingSummary, getScan } from './scanService.js';

const DEFAULT_ADHOC_SCANNERS: ScannerName[] = ['bola', 'authentication', 'misconfiguration'];

function selectScanners(requested: ScannerName[] | undefined): ScannerName[] {
  if (!requested?.length) {
    return DEFAULT_ADHOC_SCANNERS;
  }
  const allowed = requested.filter((scanner) => DEFAULT_ADHOC_SCANNERS.includes(scanner));
  return allowed.length > 0 ? allowed : DEFAULT_ADHOC_SCANNERS;
}

function buildRouteSpecification(input: RouteScanInput) {
  const route = analyzeRoute(input);
  const specId = newId();
  const sourceHash = sha256Hex(`${route.method} ${route.origin}${route.endpoint.pathTemplate}`);
  const [endpoint] = assignEndpointIds(specId, sourceHash, [route.endpoint]);
  if (!endpoint) {
    throw new AppError(400, 'ROUTE_ANALYSIS_FAILED', 'The route could not be normalized into a testable endpoint.');
  }
  const specification: ApiSpecification = {
    id: specId,
    sourceHash,
    openapiVersion: 'route',
    title: input.label?.trim() || `${route.method} ${route.endpoint.pathTemplate}`,
    createdAt: nowIso(),
    normalizedEndpoints: [endpoint],
    warnings: [],
    supportSummary: {
      discovery: 'supported',
      validation: 'supported',
      generation: 'supported',
      execution: 'supported',
      unsupportedConstructs: [],
    },
  };
  return { route, endpoint, specification };
}

export function previewRouteScan(input: RouteScanInput) {
  const { route, endpoint } = buildRouteSpecification(input);
  const probes = generateAdhocProbes(route, endpoint.id);
  const cases = probes.map((probe) => probe.testCase);
  return {
    origin: route.origin,
    method: route.method,
    pathTemplate: route.endpoint.pathTemplate,
    objectIdParameter: route.objectIdParameter,
    authenticated: route.authorizationHeader !== null,
    generated: cases.length,
    eligible: cases.filter((item) => item.executionEligibility.eligible).length,
    skipped: cases.filter((item) => !item.executionEligibility.eligible).length,
    cases: sanitize(cases),
  };
}

export async function createRouteScan(input: RouteScanInput) {
  if (!(await pingMongo())) {
    throw new AppError(503, 'DB_UNAVAILABLE', 'MongoDB is not ready.');
  }
  const { route, endpoint, specification } = buildRouteSpecification(input);
  const enabledScanners = selectScanners(input.enabledScanners);

  // The synthesized specification is sanitized before persistence; the runtime
  // Authorization value is never part of it or of the scan snapshot.
  const persistableSpec = sanitize(specification) as ApiSpecification;
  await ApiSpecificationModel.create({
    _id: persistableSpec.id,
    sourceHash: persistableSpec.sourceHash,
    openapiVersion: persistableSpec.openapiVersion,
    title: persistableSpec.title,
    createdAt: persistableSpec.createdAt,
    normalizedEndpoints: persistableSpec.normalizedEndpoints,
    warnings: persistableSpec.warnings,
    supportSummary: persistableSpec.supportSummary,
  });

  const scanId = newId();
  await ScanModel.create({
    _id: scanId,
    specificationId: specification.id,
    targetProfileId: 'adhoc',
    configurationSnapshot: {
      targetProfileId: 'adhoc',
      approvedOrigin: route.origin,
      selectedEndpointIds: [endpoint.id],
      enabledScanners,
      resourceObservations: false,
      dryRun: false,
      limits: clampExecutionLimits(defaultExecutionLimits()),
    },
    status: 'queued',
    startedAt: nowIso(),
    completedAt: null,
    progress: { totalPlanned: 0, executed: 0, skipped: 0, errored: 0, percent: 0 },
    summary: emptyFindingSummary(),
    coverage: [],
    errorLog: [],
  });

  enqueueScan(scanId, (signal) =>
    runAdhocScan({ scanId, endpoint, route, enabledScanners, signal }),
  );

  return getScan(scanId);
}
