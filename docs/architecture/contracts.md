# APIShield Shared Contracts, Limits, and Collection Design

Companion to [`../mvp-implementation-plan.md`](../mvp-implementation-plan.md). Derived from prompt sections 4 and 5, adapted to the confirmed stack (TypeScript + Mongoose + Next.js).

This document is the single source of truth for shapes. Nothing here is implemented yet — it is the specification the Phase A work builds.

---

## 1. Where these live

```text
shared/
  package.json          # name: "@apishield/contracts", type: module
  src/
    enums.ts            # runtime values: scan states, outcomes, severities, confidence
    limits.ts           # runtime values: every numeric cap
    contracts.ts        # type-only interfaces
    index.ts
```

`backend` and `frontend` both declare `"@apishield/contracts": "file:../shared"`. Next.js adds `transpilePackages: ['@apishield/contracts']`. Mongoose schemas in `backend/src/models/` are written to satisfy these interfaces, not to redefine them.

---

## 2. Enumerations

```ts
export const SCAN_STATES = ['queued', 'running', 'completed', 'partial', 'failed', 'cancelled'] as const;

export const CHECK_OUTCOMES = ['finding', 'no_finding', 'inconclusive', 'skipped', 'error'] as const;

export const EXECUTION_OUTCOMES = ['response', 'timeout', 'transport_error', 'blocked_by_policy',
                                   'cancelled', 'not_executed_budget', 'not_executed_ineligible'] as const;

export const SEVERITIES   = ['critical', 'high', 'medium', 'low', 'informational'] as const;
export const CONFIDENCES  = ['confirmed', 'potential', 'inconclusive'] as const;
export const ANALYSIS_MODES = ['rule_based', 'ai_assisted'] as const;

export const SAFETY_CLASSES = ['read_only', 'mutating', 'destructive', 'unsupported'] as const;

export const SUPPORT_STATUSES = ['supported', 'partial', 'unsupported'] as const;
```

Semantics that must hold in code:

- A timeout is an `EXECUTION_OUTCOME`, never a `finding`.
- An unsupported check is `skipped`, never `no_finding`.
- A `completed` scan with zero findings means "no findings in tested scope" — it is never presented as "secure".
- `partial` means at least one selected check was `skipped` or `error` while others completed. `failed` means the scan could not produce trustworthy coverage at all.

---

## 3. Core interfaces

### 3.1 Specification and discovery

```ts
interface ApiSpecification {
  id: string;
  sourceHash: string;               // hash of the uploaded bytes; the raw upload is not retained
  openapiVersion: string;           // preserved verbatim from the document
  title: string;
  createdAt: string;                // UTC ISO 8601
  normalizedEndpoints: ApiEndpoint[];
  warnings: SpecWarning[];
  supportSummary: SupportSummary;
}

interface ApiEndpoint {
  id: string;                       // stable: hash(sourceHash + method + pathTemplate)
  specificationId: string;
  operationId?: string;             // never used alone as the identity
  pathTemplate: string;             // e.g. "/api/notes/{id}"
  method: string;                   // original spelling preserved (incl. 3.2 "query")
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: Record<string, ApiResponse>;
  effectiveSecurity: SecurityRequirement[];   // alternatives preserved, never flattened
  securitySchemes: Record<string, SecurityScheme>;
  serverCandidates: string[];       // metadata only — grants no network access
  supportStatus: SupportStatus;
  warnings: SpecWarning[];
}

interface ApiParameter {
  name: string;
  location: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  schema: JsonSchemaLike;           // preserved, not reduced to a string
  example?: unknown;
  default?: unknown;
  style?: string;
  explode?: boolean;
}

interface SupportSummary {
  discovery: SupportStatus;
  validation: SupportStatus;
  generation: SupportStatus;
  execution: SupportStatus;
  unsupportedConstructs: Array<{ construct: string; location: string; reason: string }>;
}
```

`effectiveSecurity` is computed with version-appropriate rules: operation `security` overrides root `security`; `security: []` and anonymous alternatives mean authentication is **not** required; alternatives and AND-combinations are both preserved.

### 3.2 Target profile — the only source of execution authority

```ts
interface TargetProfile {
  id: string;
  label: string;
  approvedOrigin: string;           // exact scheme + host + port, e.g. "http://127.0.0.1:5001"
  basePath: string;                 // preserved when building URLs; "/api/v1" must survive
  approvedMethods: string[];        // read-only by default
  executionLimits: ExecutionLimits;  // never exceeds server maxima in limits.ts
  credentialReferences: string[];   // labels only, e.g. "demo.userA" — never token values
  accessPolicy: AccessPolicy;
  bolaCases: BolaCase[];
  supportedAuthentication: string[];
  optionalCheckSettings: { resourceObservations: boolean; corsBrowserConfirmation: boolean };
}

interface AccessPolicy {
  principals: Array<{ id: string; label: string; credentialReference: string }>;
  objects: Array<{ objectId: string; ownerPrincipalId: string | null; visibility: 'private' | 'shared' | 'public' }>;
  rules: Array<{ principalId: string; objectId: string; allowed: boolean }>;
}

interface BolaCase {
  endpointId: string;
  objectParameterName: string;
  ownPrincipalId: string;           // A
  foreignPrincipalId: string;       // B
  ownObjectId: string;
  foreignObjectId: string;
  identitySelectors: string[];      // e.g. ["userId", "id"] — used for identity comparison
  protectedFieldSelectors: string[];// e.g. ["title", "content"]
  volatileFieldSelectors: string[]; // ignored during comparison
}
```

Profiles are server-side configuration (`backend/src/config/targetProfiles.ts`, seeded from `vulnerable-api/fixtures/target-profiles.json`). A browser-submitted URL or an uploaded `servers:` value can never become a profile.

### 3.3 Test cases

```ts
interface TestCase {
  id: string;                       // deterministic: hash(endpointId + scanner + variant + authContextId)
  endpointId: string;
  scanner: 'bola' | 'authentication' | 'misconfiguration' | 'resource';
  variant: 'valid' | 'invalid' | 'missing' | 'boundary' | 'other_user' | 'extra_field'
         | 'empty_body' | 'wrong_type' | 'no_credential' | 'invalid_credential'
         | 'malformed_credential' | 'expired_credential' | 'untrusted_origin' | 'unexpected_method';
  authContextId: string | null;
  requestTemplate: RequestTemplate; // method, pathTemplate, pathValues, query, headers, body
  mutation: { target: string; kind: string; description: string } | null;
  prerequisites: string[];
  expectedBehavior: string;
  safetyClass: SafetyClass;
  executionEligibility: { eligible: boolean; reason?: string };
}
```

Generation is deterministic: the same specification plus the same profile produces the same case IDs **and the same ordering**. Generating a mutating or destructive case never implies permission to execute it.

### 3.4 Execution evidence

```ts
interface ExecutionResult {
  id: string;
  scanId: string;
  testCaseId: string;
  endpointId: string;
  authContextId: string | null;
  startedAt: string;                // UTC ISO 8601
  durationMs: number;               // monotonic clock
  request: { method: string; redactedUrl: string; redactedHeaders: Record<string, string>; redactedBody: unknown };
  response: { status: number | null; redactedHeaders: Record<string, string>; redactedBody: unknown };
  outcome: ExecutionOutcome;
  errorCode?: string;
  bodyTruncated: boolean;
  observedBytes: number;
}
```

`response.status` is `null` for every transport failure — a status is never fabricated. Raw responses stay in memory for deterministic analysis and are never written to Mongo.

### 3.5 Findings

```ts
interface Finding {
  id: string;
  scanId: string;
  ruleId: string;                   // e.g. "BOLA_READ_CROSS_USER"
  vulnerability: string;            // OWASP label, e.g. "API1:2023 Broken Object Level Authorization"
  severity: Severity;
  confidence: Confidence;
  endpointId: string;
  endpoint: string;                 // path template
  method: string;
  parameter?: string;
  description: string;
  evidence: FindingEvidence;        // sanitized, self-explanatory
  executionIds: string[];
  remediation: string;
  dedupKey: string;
  createdAt: string;
  analysisMode: AnalysisMode;       // 'rule_based' unless AI ran successfully
  optionalAiAnalysis?: {
    explanation: string; potentialImpact: string; remediation: string; developerSummary: string;
    provider: string; generatedAt: string;
  };
}
```

`dedupKey = ruleId | endpointId | parameter ?? '-' | objectContext ?? '-' | authPair ?? '-'`, unique within a scan. Repeated evidence merges `executionIds` into the existing finding.

### 3.6 Scans

```ts
interface Scan {
  id: string;
  specificationId: string;
  targetProfileId: string;
  configurationSnapshot: ScanConfigurationSnapshot;  // no credentials, only references
  status: ScanState;
  startedAt: string;
  completedAt: string | null;
  progress: { totalPlanned: number; executed: number; skipped: number; errored: number; percent: number };
  summary: { findingsBySeverity: Record<Severity, number>; findingsByConfidence: Record<Confidence, number> };
  coverage: Array<{ scanner: string; outcome: CheckOutcome; reason?: string; casesPlanned: number; casesExecuted: number }>;
  errors: Array<{ code: string; message: string; endpointId?: string }>;
}
```

`progress.percent` is always derived from real counters. The UI never computes or animates a fabricated value.

---

## 4. Limits (`shared/src/limits.ts`)

Project defaults from prompt §5, not standards-mandated thresholds. Centralized so the API can clamp client requests to server-approved maxima.

| Limit | Default |
| --- | ---: |
| OpenAPI upload size | 2 MiB |
| HTTP timeout, including response consumption | 5 s |
| Maximum HTTP attempts per scan (incl. baselines) | 100 |
| Concurrent target requests | 2 |
| Maximum target request starts | 2 / second |
| Maximum request body | 64 KiB |
| Maximum captured/decompressed response body | 256 KiB |
| Resource-probe repetition | 5 requests, inside the scan budget |
| Document nesting depth | 32 |
| Document node count | 20 000 |
| `$ref` resolution expansions | 500 |
| Generated cases per endpoint | 12 |
| Generated cases per scan | 400 |
| URL length | 2 048 chars |
| Single header value length | 4 096 chars |
| Total scan duration | 120 s |
| BOLA baseline reservation | 3 attempts per BOLA case, reserved before other checks |
| AI request timeout | 10 s |
| AI response size | 32 KiB |

No unbounded loops and no automatic retries anywhere. A `429` or `Retry-After` stops the relevant probe rather than triggering a retry.

---

## 5. MongoDB collection design

Database: `apishield` (distinct from the target's `vulnerable-api` and `vulnerable-api-fixed` databases).

| Collection | Key fields | Indexes |
| --- | --- | --- |
| `apispecifications` | `sourceHash`, `openapiVersion`, `normalizedEndpoints[]`, `supportSummary` | `{ sourceHash: 1 }`, `{ createdAt: -1 }` |
| `scans` | `status`, `specificationId`, `targetProfileId`, `progress`, `coverage` | `{ status: 1, startedAt: -1 }`, `{ startedAt: -1 }` |
| `findings` | `scanId`, `ruleId`, `severity`, `confidence`, `dedupKey` | **unique** `{ scanId: 1, dedupKey: 1 }`, `{ scanId: 1, severity: 1 }`, `{ scanId: 1, createdAt: -1 }` |
| `executionrecords` | `scanId`, `testCaseId`, sanitized request/response | `{ scanId: 1, testCaseId: 1 }`, `{ scanId: 1, startedAt: 1 }`, optional TTL on `startedAt` |

Rules that the models must enforce:

- Every document is passed through the sanitizer before write. There is no "raw copy for debugging".
- Timestamps are stored in UTC.
- A failed write surfaces as an error; it is never reported as a saved finding.
- Reports are read back from Mongo. The UI is never built from hardcoded fixtures or process memory.
- Mongo unavailability makes `GET /ready` and `POST /api/scans` fail clearly rather than degrading silently.
- `TestCase` documents are not persisted as durable records: generation is deterministic, so cases are regenerated on demand. Only redacted previews are stored when a preview is explicitly requested.

---

## 6. Control API surface

Existing `GET /api/v1/health` is preserved as an alias. All `/api/*` routes below require operator authentication.

| Method and route | Responsibility |
| --- | --- |
| `GET /health` | Process health |
| `GET /ready` | Required dependency readiness (real Mongo ping) |
| `POST /api/specifications` | Upload, validate, and normalize an OpenAPI document (bounded) |
| `GET /api/specifications/:id/endpoints` | Discovery and support information |
| `GET /api/targets` | Approved profiles, without secrets |
| `POST /api/scans/preview` | Deterministic redacted case preview with safety eligibility |
| `POST /api/scans` | Validate configuration, persist the job, return `202` and a scan ID |
| `GET /api/scans` | Paginated scan history |
| `GET /api/scans/:id` | Status, progress, coverage, summary |
| `POST /api/scans/:id/cancel` | Cancel eligible queued/running work |
| `GET /api/scans/:id/findings` | Paginated, filterable persisted findings |
| `GET /api/findings/:id` | Finding detail with redacted evidence |
| `GET /api/scans/:id/report?format=json` | Machine-readable report |
| `GET /api/scans/:id/report?format=html` | Escaped, print-friendly report |

Error envelope: `{ "error": { "code": "<STABLE_CODE>", "message": "<safe message>" } }`. Runtime credentials, if supplied through the API, are validated, held only as long as the job needs them, and never echoed back.

---

## 7. Fixture contract for the demo target

Checked into `vulnerable-api/fixtures/`, read by the scanner. Contains no signing secret and no `vulnerable=true` flag — the scanner must derive findings from observed behavior alone.

```text
principals.json      user A -> id 1 (user1@test.com), user B -> id 2 (user2@test.com), admin -> id 3
ownership.json       note 1 -> owner 1 (private)
                     note 2 -> owner 2 (private)      <- the BOLA target
                     note 3 -> owner 3 (private)
                     note 4 -> shared/public          <- negative control: cross-user read is legitimate
                     note 999 -> absent               <- negative control: 404
target-profiles.json demo-vulnerable -> http://127.0.0.1:5001
                     demo-fixed      -> http://127.0.0.1:5002
```

Credential values for `demo.userA`, `demo.userB`, and `demo.expired` are produced at demo-seed time into the runtime credential store, never committed.
