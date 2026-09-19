import type {
  AnalysisMode,
  CheckOutcome,
  Confidence,
  ExecutionOutcome,
  ParameterLocation,
  SafetyClass,
  ScanState,
  ScannerName,
  Severity,
  SupportStatus,
  TestVariant,
} from './enums.js';

export type JsonSchemaLike = Record<string, unknown>;

export interface SpecWarning {
  code: string;
  message: string;
  location?: string;
}

export interface SupportSummary {
  discovery: SupportStatus;
  validation: SupportStatus;
  generation: SupportStatus;
  execution: SupportStatus;
  unsupportedConstructs: Array<{ construct: string; location: string; reason: string }>;
}

export interface SecurityRequirement {
  [schemeName: string]: string[];
}

export interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  name?: string;
  in?: string;
  description?: string;
}

export interface ApiParameter {
  name: string;
  location: ParameterLocation;
  required: boolean;
  schema: JsonSchemaLike;
  example?: unknown;
  default?: unknown;
  style?: string;
  explode?: boolean;
}

export interface ApiRequestBody {
  required: boolean;
  contentType: string;
  schema?: JsonSchemaLike;
  example?: unknown;
}

export interface ApiResponse {
  description?: string;
  contentType?: string;
  schema?: JsonSchemaLike;
}

export interface ApiEndpoint {
  id: string;
  specificationId: string;
  operationId?: string;
  pathTemplate: string;
  method: string;
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: Record<string, ApiResponse>;
  effectiveSecurity: SecurityRequirement[];
  securitySchemes: Record<string, SecurityScheme>;
  serverCandidates: string[];
  supportStatus: SupportStatus;
  warnings: SpecWarning[];
}

export interface ApiSpecification {
  id: string;
  sourceHash: string;
  openapiVersion: string;
  title: string;
  createdAt: string;
  normalizedEndpoints: ApiEndpoint[];
  warnings: SpecWarning[];
  supportSummary: SupportSummary;
}

export interface ExecutionLimits {
  httpTimeoutMs: number;
  maxHttpAttempts: number;
  concurrentTargetRequests: number;
  maxTargetRequestStartsPerSecond: number;
  maxRequestBodyBytes: number;
  maxCapturedResponseBytes: number;
  maxScanDurationMs: number;
  resourceProbeRepetition: number;
}

export interface AccessPolicy {
  principals: Array<{
    id: string;
    label: string;
    credentialReference: string;
  }>;
  objects: Array<{
    objectId: string;
    ownerPrincipalId: string | null;
    visibility: 'private' | 'shared' | 'public';
  }>;
  rules: Array<{
    principalId: string;
    objectId: string;
    allowed: boolean;
  }>;
}

export interface BolaCase {
  endpointId: string;
  pathTemplate: string;
  method: string;
  objectParameterName: string;
  ownPrincipalId: string;
  foreignPrincipalId: string;
  ownObjectId: string;
  foreignObjectId: string;
  identitySelectors: string[];
  protectedFieldSelectors: string[];
  volatileFieldSelectors: string[];
}

export interface TargetProfile {
  id: string;
  label: string;
  approvedOrigin: string;
  basePath: string;
  pathScopePrefixes: string[];
  approvedMethods: string[];
  executionLimits: ExecutionLimits;
  credentialReferences: string[];
  accessPolicy: AccessPolicy;
  bolaCases: BolaCase[];
  supportedAuthentication: string[];
  optionalCheckSettings: {
    resourceObservations: boolean;
    corsBrowserConfirmation: boolean;
  };
  publicEndpointIds?: string[];
  loginPath?: string;
  expiredCredentialHelperPath?: string;
  authenticationProbes?: Array<{ method: string; pathTemplate: string }>;
}

export interface RequestTemplate {
  method: string;
  pathTemplate: string;
  pathValues: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body?: unknown;
  omitPathParameter?: string;
}

export interface TestCase {
  id: string;
  endpointId: string;
  scanner: ScannerName;
  variant: TestVariant;
  authContextId: string | null;
  requestTemplate: RequestTemplate;
  mutation: { target: string; kind: string; description: string } | null;
  prerequisites: string[];
  expectedBehavior: string;
  safetyClass: SafetyClass;
  executionEligibility: { eligible: boolean; reason?: string };
}

export interface ExecutionResult {
  id: string;
  scanId: string;
  testCaseId: string;
  endpointId: string;
  authContextId: string | null;
  startedAt: string;
  durationMs: number;
  request: {
    method: string;
    redactedUrl: string;
    redactedHeaders: Record<string, string>;
    redactedBody: unknown;
  };
  response: {
    status: number | null;
    redactedHeaders: Record<string, string>;
    redactedBody: unknown;
  };
  outcome: ExecutionOutcome;
  errorCode?: string;
  bodyTruncated: boolean;
  observedBytes: number;
}

export interface FindingEvidence {
  summary: string;
  policy?: unknown;
  requests?: Array<{
    method: string;
    redactedUrl: string;
    status: number | null;
    excerpt?: unknown;
  }>;
  objectIdentity?: unknown;
  conclusion: string;
}

export interface Finding {
  id: string;
  scanId: string;
  ruleId: string;
  vulnerability: string;
  severity: Severity;
  confidence: Confidence;
  endpointId: string;
  endpoint: string;
  method: string;
  parameter?: string;
  description: string;
  evidence: FindingEvidence;
  executionIds: string[];
  remediation: string;
  dedupKey: string;
  createdAt: string;
  analysisMode: AnalysisMode;
  optionalAiAnalysis?: {
    explanation: string;
    potentialImpact: string;
    remediation: string;
    developerSummary: string;
    provider: string;
    generatedAt: string;
  };
}

export interface ScanConfigurationSnapshot {
  targetProfileId: string;
  approvedOrigin: string;
  selectedEndpointIds: string[] | null;
  enabledScanners: ScannerName[];
  resourceObservations: boolean;
  dryRun: boolean;
  limits: ExecutionLimits;
}

export interface Scan {
  id: string;
  specificationId: string;
  targetProfileId: string;
  configurationSnapshot: ScanConfigurationSnapshot;
  status: ScanState;
  startedAt: string;
  completedAt: string | null;
  progress: {
    totalPlanned: number;
    executed: number;
    skipped: number;
    errored: number;
    percent: number;
  };
  summary: {
    findingsBySeverity: Record<Severity, number>;
    findingsByConfidence: Record<Confidence, number>;
  };
  coverage: Array<{
    scanner: string;
    outcome: CheckOutcome;
    reason?: string;
    casesPlanned: number;
    casesExecuted: number;
  }>;
  errors: Array<{ code: string; message: string; endpointId?: string }>;
}

export interface ControlApiError {
  error: {
    code: string;
    message: string;
  };
}
