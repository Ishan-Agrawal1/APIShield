# APIShield MVP — Implementation Plan

Source requirement: `APIShield_Cursor_Opus_MVP_Prompt.md` (seven-day roadmap, sections 1–16).
Companion document: [`architecture/contracts.md`](./architecture/contracts.md) — canonical data contracts, limits, and collection design.

This document is a plan only. No production code is written by it.

---

## 1. Confirmed stack decisions

The source prompt's defaults are overridden where the project already made a different choice, or where the owner has decided otherwise. These are the binding decisions for the MVP.

| Area | Decision | Relation to the prompt |
| --- | --- | --- |
| Language | TypeScript everywhere (ESM, `tsx` for dev/test) | Prompt's default was JS + JSDoc; §3 says retain the existing language, and the repo is already TS. |
| Backend | Express 5 (`backend/`) | Matches. |
| Persistence | MongoDB 7 + Mongoose 9 | Matches the prompt default. PostgreSQL is **not** used. |
| Frontend | Next.js App Router + TypeScript + Tailwind 4, replacing `frontend/` in place | Deliberate deviation from the prompt's "React + Vite" default. Justified: `frontend/` is an empty, currently non-building scaffold. |
| Target fixture | Keep and extend the existing `vulnerable-api/` (Notes domain), adding a separate fixed-mode service | Prompt §9 allows existing equivalent fixtures instead of its orders/products example. |
| Test runner | `node:test` + `tsx` (as `vulnerable-api/` already uses); Playwright for browser E2E | Prompt allows "a compatible existing runner". Backend's unused `jest` dependency is dropped. |
| Monorepo | Root `package.json` for orchestration scripts only — **no** npm workspaces; packages stay independently installable | Owner decision. |
| AI | Provider interface, disabled by default, with a deterministic `rule_based` fallback | No provider is configured in this repo, so `LIVE AI VERIFIED` stays out of reach until explicitly configured. |
| CPN engine | Out of MVP scope | Prompt §1 excludes CPN/conformance work. |

### Recorded deviations from the prompt's literal text

1. Next.js instead of Vite (above).
2. Fixture domain stays Notes (`note 1` owned by user 1, `note 2` owned by user 2) rather than the prompt's `orders 101/102`.
3. No npm workspaces; shared contracts are distributed via a local `file:` dependency (see §5.1) rather than a workspace package.
4. `docs/` is used for the prompt's `docs/mvp-status.md` and supported-features documents; the prompt's suggested `server/` layout is mapped onto the existing `backend/src/` tree.

---

## 2. Baseline: what actually exists today

Verified by inspection of the working tree at the start of this plan (branch `main`, 4 commits, 6 uncommitted changes in `frontend/`).

### 2.1 `vulnerable-api/` — substantially complete, the strongest asset

Express 5 + Mongoose 9 + JWT, ESM, `tsx`. Independently runnable on port 5001.

- **15 runtime operations.** 10 are declared in `openapi.yaml` (OpenAPI 3.0.3): `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /api/users`, `GET /api/users/{id}`, `GET|POST /api/notes`, `GET|PATCH|DELETE /api/notes/{id}`. Undeclared on purpose: `GET /api/health`, `GET /api/profile`, `GET /api/v1/notes`, `GET /api/v2/notes`, `GET /api/debug`.
- **Seeded fixtures** (`src/config/fixtures.ts`): users 1/2/3 (`user1@test.com`, `user2@test.com`, `admin@test.com`, all `password123`), notes 1/2/3 owned by users 1/2/3.
- **Seeded weaknesses** (`docs/vulnerability-matrix.md`): V1 BOLA read on `GET /api/notes/{id}`, V2 BOLA modify on `PATCH /api/notes/{id}`, V3 broken authentication on `GET /api/profile`, V4 unbounded `limit` on `GET /api/notes`, V5 undocumented inventory.
- **Negative controls already present**: `GET /api/users/{id}` and `DELETE /api/notes/{id}` correctly enforce ownership; `GET /auth/me` correctly rejects bad tokens.
- **Already hardened where it matters**: `app.disable('x-powered-by')`, `express.json({ limit: '100kb' })`, CORS locked to a single origin, structured JSON HTTP logging with key-based redaction (`src/middleware/httpLogger.ts`, `src/utils/redact.ts`).
- **8 test files** using `node:test` + `supertest` + `mongodb-memory-server`, with per-case reseeding (`tests/helpers.ts`).
- `Dockerfile` present; wired into root `docker-compose.yml`.

### 2.2 `backend/` — scaffolding only

Express 5 + Mongoose 9 + TypeScript, ESM, `tsx`. Roughly 2.8 KB of source in total.

- Working: `src/app.ts` (cors + json + logger + router + 404 + error handler), `src/server.ts` (connect then listen on 5000), `src/config/db.ts` (Mongoose connect), `src/routes/root.ts` (`GET /`, `GET /api/v1/health`).
- **Two 0-byte placeholder files**: `src/scanner/discovery/openApiScanner.ts`, `src/scanner/engine/scanEngine.ts`.
- **Empty directories awaiting content**: `src/controllers`, `src/models`, `src/services`, `src/types`, `src/utils`, `src/scanner/{authentication,authorization,configuration,inventory,resource,utils}`, `tests`.
- Dependencies already installed and usable: `express`, `mongoose`, `cors`, `dotenv`, `jsonwebtoken`, `bcrypt`, `yaml`, `axios`. Dev: `tsx`, `typescript`, `supertest`, `jest` (+types), `nodemon`.

### 2.3 Known defects in the baseline that the plan must fix

| # | Defect | Location |
| --- | --- | --- |
| D1 | `frontend/` does not build: `App.tsx` imports `./assets/react.svg`, `./assets/vite.svg`, `./assets/hero.png`, and `./App.css`, all of which are deleted or absent. | `frontend/src/App.tsx` |
| D2 | `.gitignore` ignores `package-lock.json`, so reproducible installs are impossible — directly contradicts prompt §3. | `.gitignore` |
| D3 | `docker-compose.yml` publishes MongoDB on `0.0.0.0:27017`; prompt §5 forbids exposing demo ports on every interface. | `docker-compose.yml` |
| D4 | `backend` error handler returns `err.message` to the client; no error codes, no envelope. | `backend/src/middleware/errorHandler.ts` |
| D5 | `backend` logger writes raw method/URL with no redaction and no request correlation ID. | `backend/src/middleware/logger.ts` |
| D6 | `backend/src/config/db.ts` calls `process.exit(1)` on connection failure instead of surfacing an unready state. | `backend/src/config/db.ts` |
| D7 | `backend/tsconfig.json` sets `"types": []` (so `process`/`Buffer` are untyped), `moduleResolution: "node16"` against `module: "nodenext"`, and a stray `jsx: "react-jsx"`. No `include`/`exclude`. | `backend/tsconfig.json` |
| D8 | Stray leftover directory `backend/vulnerable-api/` containing only `package.json` + lockfile. | `backend/vulnerable-api/` |
| D9 | `backend` declares `"test": "jest"` with no jest config, no ESM transform, and no tests. | `backend/package.json` |
| D10 | `vulnerable-api` seed deletes all users and notes with no guard that the database is a demo database; prompt §9 requires a reset that cannot touch a non-demo database. | `vulnerable-api/src/config/seed.ts` |
| D11 | `cors({ origin: 'http://localhost:5173' })` is hardcoded to the old Vite port. | `vulnerable-api/src/app.ts` |
| D12 | No `.env.example` anywhere; `.env` files exist but are gitignored, so a fresh clone has no configuration template. | all packages |
| D13 | `docs/` contains five empty directories and no documents. | `docs/` |

### 2.4 Coverage of the roadmap today

| Roadmap day | Requirement | Status |
| --- | --- | --- |
| Day 1.1 | Foundation: config validation, DB lifecycle, health/readiness, central errors, bounded upload, redacted logs, graceful shutdown | ~10% — a naive health route and a naive error handler exist |
| Day 1.2 | OpenAPI parser (3.0/3.1/3.2 subset) | 0% |
| Day 2.1 | Discovery view | 0% |
| Day 2.2 | Deterministic test generator | 0% |
| Day 3.1 | Central HTTP executor | 0% |
| Day 3.2 | Scan state manager | 0% (empty `scanEngine.ts`) |
| Day 4.1 | Controlled vulnerable target | ~75% — vulnerable mode done; **fixed mode, `openapi.json`, ownership fixtures, misconfiguration fixtures, and the expired-token helper are missing** |
| Day 4.2 | BOLA scanner | 0% |
| Day 5.1 | Authentication scanner | 0% |
| Day 5.2 | Misconfiguration scanner | 0% (and the target has no CORS/version-disclosure fixtures yet — `docs/vulnerability-matrix.md` currently declares them out of scope) |
| Day 5.3 | Bounded resource observations | 0% scanner side; target-side V4 fixture exists |
| Day 6.1 | Mongo persistence (Scan/Finding/…) | 0% |
| Day 6.2 | Control API | ~5% (health route only) |
| Day 6.3 | JSON + HTML reports | 0% |
| Day 7.1 | Sensitive-data boundary | ~20% — `vulnerable-api` has a redactor; the backend has none, and no shared sanitizer exists |
| Day 7.2 | AI Security Analyst | 0% |
| Day 7.3 | Connected frontend | 0% (and currently broken) |
| §13/§14 | Verification matrix, root commands, `demo:verify` | 0% — no root `package.json` exists |

---

## 3. Target repository layout

```text
APIShield/
  package.json                   # NEW — orchestration scripts only (no workspaces)
  compose.yaml                   # RENAMED/extended from docker-compose.yml
  .env.example                   # NEW
  scripts/                       # NEW — portable Node orchestration (Windows-safe)
    demo-up.mjs  demo-seed.mjs  demo-verify.mjs  demo-down.mjs
    verify.mjs   wait-for-http.mjs  run-in.mjs
  shared/                        # NEW — canonical contracts, consumed via file: dependency
    package.json                 # name: @apishield/contracts
    src/{contracts.ts, enums.ts, limits.ts, index.ts}
  backend/
    src/
      app.ts  server.ts
      config/      { env.ts, limits.ts, db.ts, targetProfiles.ts, credentialStore.ts }
      middleware/  { logger.ts, errorHandler.ts, operatorAuth.ts, hostCheck.ts, upload.ts }
      models/      { ApiSpecification.ts, ExecutionRecord.ts, Finding.ts, Scan.ts }
      routes/      { root.ts, specifications.ts, targets.ts, scans.ts, findings.ts, reports.ts }
      controllers/ (one per route group)
      services/    { specificationService.ts, scanService.ts, findingService.ts, reportService.ts,
                     ai/{provider.ts, openAiCompatibleProvider.ts, fallback.ts, aiService.ts} }
      scanner/
        parser/        { openApiParser.ts, refResolver.ts, supportMatrix.ts, versionRules.ts }
        discovery/     { openApiScanner.ts, normalizeEndpoints.ts, endpointId.ts }
        generator/     { testCaseGenerator.ts, valueFactory.ts, serialization.ts }
        executor/      { httpExecutor.ts, targetPolicy.ts, dnsGuard.ts, budget.ts, bodyReader.ts }
        analyzer/      { responseAnalyzer.ts, severity.ts, dedupKey.ts }
        authorization/ bolaScanner.ts
        authentication/ authScanner.ts
        configuration/ misconfigurationScanner.ts
        resource/      resourceObservations.ts
        engine/        { scanEngine.ts, scanQueue.ts, coverage.ts }
        inventory/     (reserved — post-MVP API9)
      utils/       { sanitize.ts, hash.ts, ids.ts, clock.ts, errors.ts }
    tests/
      unit/ integration/ boundary/
      fixtures/openapi/  (3.0 / 3.1 / 3.2 / malformed / recursive / oversized pairs)
  vulnerable-api/
    src/ ...                     # extended: mode config, fixtures router, misconfig fixtures
    fixtures/                    # NEW — ownership.json, principals.json, target-profiles.json
    openapi.yaml  openapi.json   # NEW json, generated from yaml
    scripts/openapi-json.mjs     # NEW
  frontend/                      # REPLACED — Next.js App Router
    app/  components/  lib/  e2e/
  docs/
    mvp-implementation-plan.md   # this file
    mvp-status.md                # NEW — living checklist (created in Phase A)
    supported-features.md        # NEW — support matrix + limitations
    architecture/contracts.md    # companion to this plan
    reports/verification-*.md    # NEW — sanitized verification records
```

---

## 4. Cross-cutting foundations (built once, in Phase A)

### 4.1 Shared contracts

All contracts listed in prompt §4 are defined once in `shared/src/contracts.ts` and consumed by `backend` and `frontend` through a `"@apishield/contracts": "file:../shared"` dependency. Because there are no workspaces, this keeps both packages independently installable while preventing three incompatible definitions of `Finding`.

- Types are compile-time only; runtime values (`enums.ts`, `limits.ts`) are real exports.
- Next.js consumes it via `transpilePackages: ['@apishield/contracts']`.
- Fallback if `file:` linking proves awkward on Windows: keep `shared/` as the source of truth and add a `scripts/sync-contracts.mjs` copy step plus a contract test asserting the copies are byte-identical.

Full definitions live in [`architecture/contracts.md`](./architecture/contracts.md).

### 4.2 One configuration and limits module

`backend/src/config/limits.ts` holds every numeric cap from prompt §5 (2 MiB upload, 5 s timeout, 100 HTTP attempts per scan, concurrency 2, 2 requests/second, 64 KiB request body, 256 KiB captured response, 5 resource probes, plus document nesting, generated-case, URL/header length, and scan duration bounds). `backend/src/config/env.ts` validates environment variables at startup and fails loudly. The API accepts client-supplied values only when they are within these server-side maxima.

### 4.3 Execution safety layer

A single `targetPolicy.ts` gates every outbound request: exact origin+port allowlist from a server-side target profile, path-scope prefix check, HTTP/HTTPS only, `redirect: 'manual'`, rejection of embedded URL credentials, DNS resolution pinning (resolve, validate the resolved address, then connect to that address), denial of link-local/metadata addresses, and loopback permitted only for the configured demo ports. Uploaded `servers:` values and browser-submitted URLs are metadata only and never grant network access.

### 4.4 One sanitizer

`backend/src/utils/sanitize.ts` is the single redaction implementation used by logs, persisted evidence, API responses, reports, and the stricter AI payload boundary. It is built in Phase A (so nothing unsanitized is ever persisted) and hardened in Phase F. `vulnerable-api`'s own `redact.ts` stays independent — the target must not import scanner code.

### 4.5 Operator authentication

Control and data routes require an operator bearer token (`APISHIELD_OPERATOR_TOKEN`). The Next.js frontend never holds it: browser requests go to Next Route Handlers that act as a server-side proxy and inject the token. Host/Origin validation is applied to the control API, and dev servers bind to `127.0.0.1`.

---

## 5. Phased plan

Increments follow prompt §15 (A–G). Each phase ends with its own targeted tests plus a smoke check before the next begins. `docs/mvp-status.md` is updated at every phase boundary.

---

### Phase A — Repository hygiene, contracts, configuration, bootstrap
*Covers Day 1 Task 1.1. Fixes D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13.*

**Tasks**

1. Root `package.json` (private, scripts only) and `scripts/*.mjs` orchestration written as portable Node — no shell-only assumptions, since the primary development host is Windows.
2. `.gitignore`: stop ignoring `package-lock.json`; commit the three existing lockfiles. Keep ignoring `.env`.
3. `.env.example` for root, `backend/`, `vulnerable-api/`, `frontend/`. No working secrets. A `scripts/bootstrap-secrets.mjs` helper generates missing local-demo secrets without overwriting populated `.env` files.
4. `shared/` contracts package per §4.1, plus `enums.ts` (scan states, check outcomes, severities, confidence) and `limits.ts`.
5. Backend foundation rewrite: `config/env.ts` (validated), `config/db.ts` (connect/disconnect/readiness, no `process.exit`), `middleware/logger.ts` (structured JSON + request ID + sanitizer), `middleware/errorHandler.ts` (typed `AppError`, `{ error: { code, message } }` envelope, no leaked internals), `middleware/upload.ts` (2 MiB bounded, content-type checked), `middleware/operatorAuth.ts`, `middleware/hostCheck.ts`, graceful shutdown in `server.ts`, and `app.ts` split from `listen()` so tests can instantiate the app.
6. Health and readiness: add `GET /health` and `GET /ready` (real Mongo ping). Keep the existing `GET /api/v1/health` as a preserved alias.
7. Fix `backend/tsconfig.json` (`types: ["node"]`, `moduleResolution: "nodenext"`, drop `jsx`, add `include`/`exclude`). Remove the `jest` dependency and the stray `backend/vulnerable-api/` directory. Wire `node:test` + `tsx` as the test runner.
8. `compose.yaml`: bind every published port to `127.0.0.1`, add the `apishield-backend` service, and add the `vulnerable-api-fixed` service placeholder (filled in Phase D).
9. `vulnerable-api`: add a demo-database-name guard to `seedDatabase()` so a reset cannot touch a non-demo database; make the CORS origin configurable.
10. Create `docs/mvp-status.md` as the living checklist.

**Exit criteria** — `npm run typecheck`, `npm run lint`, and `npm run test:unit` pass at the root; `GET /health` returns OK and `GET /ready` fails correctly when Mongo is stopped; `vulnerable-api`'s 8 existing test files still pass unchanged.

---

### Phase B — Parser, discovery, deterministic generation
*Covers Day 1 Task 1.2 and Day 2 Tasks 2.1–2.2.*

**Tasks**

1. **Parser** (`scanner/parser/`). Parse uploaded YAML/JSON content only — never execute tags, fetch URLs, or read files referenced by the upload. Use the already-installed `yaml` package with safe options plus a hand-written bounded `$ref` resolver (depth, node count, and alias-expansion caps) rather than a library that resolves external references by default. Add `ajv` + `ajv-formats` for schema handling.
2. **Version rules** (`versionRules.ts`). Version-appropriate semantics per prompt §6: operation parameters override path parameters by name+location; operation `security` overrides root `security`; an empty `security: []` and anonymous alternatives must not become "authentication required"; alternatives and combinations are preserved, not flattened. Preserve the declared version string — never rewrite it to satisfy a validator.
3. **Support matrix** (`supportMatrix.ts`). Per-construct discovery / validation / generation / execution support, tracked separately, for 3.0.x, 3.1.x, and 3.2.x. 3.2's `query` operation and `additionalOperations` are recognized in discovery and explicitly marked non-executable rather than dropped. Any unimplemented version support is published as an explicit gap.
4. **Discovery** (`scanner/discovery/`). Fill the 0-byte `openApiScanner.ts`. Produce `ApiEndpoint[]` with stable IDs derived from specification identity + method + path template (never `operationId` alone), preserved schemas and examples, effective security, server candidates as metadata, and base-path preservation (`/api/v1` must survive URL construction). Route precedence is preserved for the demo. Metadata keys are not counted as endpoints.
5. **Specification storage.** `ApiSpecification` model persists the normalized model, `sourceHash`, warnings, and support summary. The raw upload is not retained by default; persisted examples are sanitized.
6. **Generator** (`scanner/generator/`). Deterministic, bounded case generation for the supported subset (primitives, enums, required fields, bounded arrays/objects, numeric/string bounds, ordinary JSON bodies). Examples, defaults, and enums are reused only after Ajv-validating them against the relevant schema; otherwise deterministic schema-derived values are used. Per-operation variants: valid, invalid, missing, boundary, and configured other-user cases for resource reads; valid, missing-required, empty, wrong-type, and extra-field for JSON creates. One constraint mutated at a time. Standards-aware path/query/header/cookie serialization, honoring `style`/`explode` for claimed-supported cases — no naive global string replacement, and never the literal text `undefined`. Anything unsupported becomes `skipped` with a reason, never "valid" data that is knowingly invalid.
7. **Preview endpoints.** `POST /api/specifications`, `GET /api/specifications/:id/endpoints`, `POST /api/scans/preview` (redacted, deterministic, with safety eligibility).
8. **Fixture corpus.** `backend/tests/fixtures/openapi/`: YAML/JSON pairs, 3.0/3.1/3.2 variants, internal refs, forbidden external refs, recursive schemas, malformed documents, duplicate paths, oversized documents.
9. Generate `vulnerable-api/openapi.json` from `openapi.yaml` via `vulnerable-api/scripts/openapi-json.mjs` so the YAML/JSON equivalence test has a real pair.

**Exit criteria** — YAML and JSON of the same document normalize identically; generation is byte-stable across repeated runs (IDs and ordering); unsupported constructs appear in the support report; invalid input returns actionable errors rather than an empty success; a valid document with zero operations is distinguishable from a parse failure; unsafe-method cases are generated but marked ineligible for execution.

---

### Phase C — Central executor and scan state
*Covers Day 3 Tasks 3.1–3.2.*

**Tasks**

1. **`httpExecutor.ts`** — the only module in the repository permitted to make target requests. Built on Node's built-in `fetch`/undici with `redirect: 'manual'`, `AbortSignal.timeout`, monotonic-clock duration measurement, streaming body consumption with a byte cap enforced *while* reading (including a decompressed-size cap), and a fresh request context per case so no cookie or `Authorization` header leaks between auth contexts. Non-2xx responses are evidence, not exceptions. Transport failures get `outcome: 'error'` with an error code and **no** fabricated HTTP status. Handles 204/empty, JSON, text, unexpected content types, malformed JSON, connection refusal, timeout, TLS/DNS failure, and cancellation.
2. **Import-boundary check.** A test that scans `backend/src/scanner/**` (excluding `executor/`) and `services/**` for `fetch(`, `axios`, `http.request`, `https.request`, `undici` and fails on any hit. The `axios` dependency is removed from `backend/package.json`; the AI provider client is a separate `fetch`-based module outside the scanner tree.
3. **Budget and throttle** (`budget.ts`) — per-scan attempt counter, concurrency 2, 2 requests/second, scan-duration cap, reserved allocation for BOLA baselines, and an explicit "not executed, budget exhausted" marker rather than silent omission. Honors `429`/`Retry-After` by stopping, not retrying.
4. **`ExecutionRecord` model** — sanitized request/response evidence only, with truncation flags and observed byte counts. Raw responses stay in memory for analysis and are never persisted.
5. **`scanQueue.ts` + `scanEngine.ts`** — a bounded in-process queue (no Redis). A scan is persisted before `202` is returned. Real progress is exposed via polling. Cancellation aborts in-flight requests and blocks new dispatch. Timers, clients, credentials, and queues are cleaned up on completion and shutdown. On startup, orphaned `queued`/`running` scans are reconciled to `failed` with an `interrupted` reason — never silently resumed.
6. **Coverage model** (`coverage.ts`) — per-check `executed` / `skipped` / `error` accounting that defines when a scan is `partial` versus `failed`.
7. **Runtime credential store** (`config/credentialStore.ts`) — in-memory, scoped to a scan's lifetime, never persisted, never echoed in an API response.

**Exit criteria** — integration tests (against the real local `vulnerable-api`) confirm correct method/URL/base path/body construction, credential isolation across contexts, timeouts, denied redirects and denied destinations, response caps, throttle and budget enforcement, progress reporting, cancellation, and restart reconciliation. Forbidden-destination tests use a fake DNS/transport and contact nothing real. The import-boundary test passes.

---

### Phase D — Fixed-mode target, ownership fixtures, BOLA, persistence, report API
*Covers Day 4 Tasks 4.1–4.2 plus Day 6 Tasks 6.1 and the report slice of 6.2/6.3.*

**Target-side tasks (`vulnerable-api/`)**

1. **Mode configuration.** `APP_MODE=vulnerable|fixed` read once at startup into a frozen config object. Authorization behavior is never toggled on a live instance. `compose.yaml` runs `vulnerable-api` on `127.0.0.1:5001` and `vulnerable-api-fixed` on `127.0.0.1:5002` against separate databases (`vulnerable-api`, `vulnerable-api-fixed`). Fixed mode repairs V1–V4 and the misconfiguration fixtures while keeping response contracts comparable, and uses proper credential validation.
2. **Documented operation count.** Add `GET /api/health` and a genuinely public endpoint (a public-by-design notice/status list) to `openapi.yaml`, taking declared operations from 10 to 12. The public endpoint is an intentional negative control: unauthenticated access there must never be reported as a finding.
3. **Ownership and profile fixtures** (`vulnerable-api/fixtures/`): `principals.json`, `ownership.json` (object → owner, plus a shared/public object), `target-profiles.json`. Checked in, containing no `vulnerable=true` flag and no signing secret. The scanner reads these; it never imports target source or reads target internals.
4. **Shared/public object control.** Seed note 4 as explicitly shared/public in `ownership.json` so cross-user access to it must produce *no* BOLA finding.
5. **Expired-token helper.** A fixture-only, local-demo-gated helper (`ENABLE_FIXTURE_HELPERS=true`) that mints a genuinely expired but correctly signed token. The scanner receives the token, never the signing secret. An invalid signature is never labeled an expired-token test.
6. **Idempotent reset.** `npm run demo:seed` reseeds only the demo databases, guarded by the database-name check from Phase A.
7. Update `docs/vulnerability-matrix.md` and `docs/test-cases.md` to describe fixed mode, the new negative controls, and the new fixture rows.

**Scanner-side tasks (`backend/`)**

8. **`bolaScanner.ts`** driven entirely by generic endpoint + ownership + access-policy configuration. Three executions per case through the shared executor: A→A's object (legitimate baseline), B→B's object (proves the foreign object exists and is accessible to its owner), A→B's object (the cross-user check). Object identity and protected fields are compared using configured response selectors, with configured volatile fields ignored — never whole-response string comparison.
9. **Confidence rules.** `confirmed` only when both baselines are usable, the configured policy forbids the access, and A's response actually exposes B's protected object. `potential` / `inconclusive` for weaker evidence. Absent objects, public/shared objects, failed baselines, identical generic error bodies, a login page returned with 200, truncated evidence, and missing credentials can never become `confirmed`. A foreign-object 403/404 yields no finding for that check and no claim that the API is secure.
10. **Persistence** (Day 6.1): `Scan`, `Finding`, `ExecutionRecord`, `ApiSpecification` Mongoose models with UTC timestamps, indexes on common queries, and a unique `(scanId, dedupKey)` index where `dedupKey` combines rule, endpoint, parameter/object context, and auth pair. Repeated evidence merges into the existing finding instead of duplicating it. Everything is sanitized before write. Reports are read back from Mongo — never from process memory or hardcoded fixtures. A failed write is never reported as a saved finding, and Mongo unavailability makes readiness and scan creation fail clearly.
11. **Report API slice**: `POST /api/scans`, `GET /api/scans`, `GET /api/scans/:id`, `POST /api/scans/:id/cancel`, `GET /api/scans/:id/findings`, `GET /api/findings/:id`.

**Exit criteria** — the vulnerable target yields an evidence-backed BOLA finding on `GET /api/notes/{id}` naming the accessing principal, object owner, object, severity, evidence, and remediation; fixed mode yields none. Negative and inconclusive controls all pass: public/shared object, ownership-enforced `GET /api/users/{id}` and `DELETE /api/notes/{id}`, nonexistent object, expired principal, generic-200 error body, and truncated evidence. Detection still works when object IDs and endpoint names are changed in the fixtures. Findings survive a backend restart, and repeated insertion deduplicates.

---

### Phase E — Authentication, misconfiguration, bounded resource observations
*Covers Day 5 Tasks 5.1–5.3.*

**Tasks**

1. **`authScanner.ts`.** Effective OpenAPI security plus explicit target policy. Establish a valid authenticated baseline, then test missing, invalid, malformed, and genuinely expired credentials. Each auth context is built independently so no second credential channel accidentally satisfies authentication. Scope is the demo bearer flow; other parsed schemes are preserved and reported as unsupported for execution. A finding requires a protected operation exposing protected behavior or data without valid authentication — `GET /api/profile` (V3) qualifies; the public endpoint and `GET /auth/me`'s correct 401 do not. Unavailable expiry fixtures produce an explicit skip.
2. **`misconfigurationScanner.ts`** with five evidence-based rules: missing security declaration (documentation warning versus demonstrated unauthorized access, honoring declared public/optional access), server/version disclosure (observed header recorded at low/informational severity), debug information (specific debug/stack-trace indicators with bounded evidence — `GET /api/debug` is the fixture), CORS (probe a controlled untrusted `Origin` and evaluate the actual header combination against target policy; wildcard-plus-credentials is not by itself proof of a browser-readable credentialed leak), and unexpected methods (bounded safe probes; an `OPTIONS`/`Allow` advertisement is an observation, not proof of an executable dangerous operation).
3. **New target fixtures for rule 2 and rule 4.** Vulnerable mode adds a version-disclosing `Server`/`X-Powered-By` header and permissive origin-reflecting CORS; fixed mode does not. This is an intentional scope expansion of `vulnerable-api` — the existing `docs/vulnerability-matrix.md` declares CORS and header misconfiguration out of scope, and that document is updated as part of Phase D task 7.
4. **`resourceObservations.ts`** — opt-in, local-demo-only by default. At most 5 repeated requests or one bounded oversized payload/parameter, inside the central scan budget. Records sizes, durations, statuses, timeouts, and any limiting behavior, using relative comparison against a small baseline with machine-variance-tolerant assertions. Stops on throttling, repeated errors, or exhausted budget. Output is labeled an observation — a single slow response, an accepted larger payload, or the absence of a `429` within five requests never becomes a confirmed unrestricted-resource-consumption vulnerability.
5. **Severity/confidence calibration** centralized in `analyzer/severity.ts`, with each rule publishing scope, evidence, severity, confidence, and remediation.

**Exit criteria** — the seeded authentication failure is detected while fixed mode denies every bad context; public and optional-auth fixtures produce no such finding; misconfiguration rules pass both positive and negative fixtures with warnings clearly distinguishable from confirmed vulnerabilities; no destructive method executes without explicit profile approval; disabled resource mode sends zero probes and enabled mode stays within all caps.

---

### Phase F — Sensitive-data boundary, reports, AI analyst, full control API
*Covers Day 7 Tasks 7.1–7.2 and the remainder of Day 6 Tasks 6.2–6.3.*

**Tasks**

1. **Harden `utils/sanitize.ts`.** Recursive handling of nested objects and arrays; case-insensitive credential field matching; `Authorization` and `Proxy-Authorization`; cookies; API keys, passwords, tokens; sensitive query-string values including URL-encoded ones; configured personal-data fields; email redaction. Never mutates the input object used for deterministic analysis. Bounded work (depth, node count, string length).
2. **AI payload boundary.** A stricter allowlist projection: only named structured fields are forwarded, concrete request paths are replaced by endpoint templates, and non-sensitive or pseudonymous identifiers are retained for correlation. Unknown free text that cannot be safely minimized is omitted rather than assumed safe. A sanitization failure **blocks** transmission — there is no fallback to sending original data.
3. **AI provider interface** (`services/ai/`). Detection, severity, confidence, and evidence stay rule-based; AI only produces explanation, potential impact, remediation, and a developer summary. It cannot invent or change findings, execute tools, or make target requests. Implementation: an OpenAI-compatible provider driven by `AI_PROVIDER`, `AI_BASE_URL`, and `AI_API_KEY`, disabled unless all are present, with a request timeout, a response-size cap, zod-validated structured output, and explicit disclosure/consent before any external transmission. Target content is treated as untrusted data with no system-prompt or tool authority.
4. **Rule-based fallback** (`fallback.ts`). Deterministic per-`ruleId` explanation and remediation templates, labeled `rule_based` — never "AI-generated". Provider failure degrades to the fallback without erasing a finding or breaking the report. Tests use an injected fake provider and assert that it receives only the minimized payload, and nothing at all when AI is disabled or sanitization fails.
5. **Complete the control API** per prompt §11: add `GET /api/targets` (no secrets) and `GET /api/scans/:id/report?format=json|html`. Validate identifiers, file formats, endpoint IDs, profile IDs, pagination, filters, and limits. Block Mongo query operators and mass-assignment fields from reaching queries. Consistent error envelope; explicit handling of missing resources and invalid scan-state transitions.
6. **Reports** (`reportService.ts`). JSON and escaped, print-friendly HTML built from persisted findings and execution summaries: target/profile identity, scan times, tested scope, real counters, findings by severity, evidence, remediation, coverage gaps, transport errors, and AI/fallback status. No native PDF service. Target response text and AI output are never rendered as trusted HTML. Zero findings renders as "no findings in tested scope", never "secure".

**Exit criteria** — seeded secrets are absent from saved documents, logs, API responses, and reports while useful evidence is retained; API and report counts agree with Mongo; invalid requests fail predictably; sanitizer tests cover nested values, arrays, URL-encoded query secrets, mixed-case headers, echoed credentials in response bodies, malformed text, truncation boundaries, repeated secrets, and injection strings; AI tests cover disabled mode, honest fallback, a valid mocked sanitized flow, timeout and malformed response, attempted prompt injection, and no-send on sanitizer failure.

---

### Phase G — Next.js dashboard, browser E2E, verification
*Covers Day 7 Task 7.3 plus prompt §13–§14.*

**Tasks**

1. **Replace `frontend/`** with a Next.js App Router + TypeScript + Tailwind 4 application (fixes D1). Tailwind and TypeScript are retained from the current dependency set; `recharts` is dropped — prompt §12 forbids chart-heavy analytics.
2. **Server-side proxy.** Route handlers under `app/api/proxy/[...path]/route.ts` forward to the backend and inject the operator token server-side, so it never reaches the browser bundle.
3. **Pages** forming one coherent workflow: scan history (`/`), upload (`/specifications/new`), discovery with support matrix (`/specifications/[id]`), scan configuration with target selection, permitted runtime auth/ownership settings and case preview (`/scans/new`), live scan progress and coverage (`/scans/[id]`), findings list with severity/type filters, finding detail with readable evidence and remediation (`/findings/[id]`), and report view with JSON/HTML export links (`/scans/[id]/report`).
4. **Honest UI states.** Loading, empty, validation error, disconnected backend, failed scan, plus clear labels for warnings and for `inconclusive` / `skipped` / `error` outcomes, and a visible distinction between AI-generated and `rule_based` explanations. No fabricated progress percentages or counts — every number comes from the backend.
5. **Client discipline.** Double-submit guard on scan start; polling cleanup and cancellation via `AbortController` in `useEffect` teardown; runtime target credentials held in component state only, never in `localStorage` or `sessionStorage`; all target-derived and AI-derived text rendered as React text with no `dangerouslySetInnerHTML`.
6. **Playwright E2E** (`frontend/e2e/`) driving upload → discovery → preview → scan → findings → report against the real local stack, plus failed upload, failed scan, zero findings, skipped checks, and unavailable AI. Asserts that no sensitive input appears in browser console logs or persisted browser state.
7. **`scripts/demo-verify.mjs`** drives APIShield through its **control API** only — no direct Mongo inserts, no calling scanner internals. It uploads the supplied specification, asserts at least 10 discovered operations, generates a real preview, starts a bounded scan, waits with a deadline, inspects persisted results, retrieves a report, then repeats the run against the fixed target and the negative scenarios. It runs twice from independently reseeded state and compares findings, classifications, and counters — not timestamps or measured durations. It writes a sanitized verification report to `docs/reports/`.
8. **`scripts/verify.mjs`** runs lint → typecheck → unit → integration → build → demo verification in order, propagates failures, reports unavailable prerequisites as blockers rather than skips, uses bounded health polling instead of fixed sleeps, and never kills unrelated processes to free a port.
9. **Documentation**: update root `README.md`, finalize `docs/mvp-status.md`, write `docs/supported-features.md` (OpenAPI support matrix, implemented rules, explicit limitations), and commit the sanitized verification report.

**Exit criteria** — the browser smoke test passes against the real local stack; `npm run verify` passes end to end or reports precise environmental blockers; the vulnerable demo shows evidence-backed BOLA, an authentication failure, and the seeded misconfiguration, while the fixed control shows none of those three; legitimate unrelated observations are preserved rather than suppressed to force a zero total.

---

## 6. Root command contract

Implemented in root `package.json` + `scripts/` **before** being documented as available. All orchestration is portable Node so it works in PowerShell.

| Command | Behavior |
| --- | --- |
| `npm run install:all` | Install `shared`, `backend`, `vulnerable-api`, `frontend` from committed lockfiles |
| `npm run dev` | Start Mongo check, `vulnerable-api` (5001), backend (5000), Next.js (3000) |
| `npm run lint` | ESLint across backend, frontend, vulnerable-api |
| `npm run typecheck` | `tsc --noEmit` in every package |
| `npm run test:unit` | Deterministic `node:test` unit tests (no network, no real Mongo) |
| `npm run test:integration` | Backend + real isolated MongoDB + local `vulnerable-api` |
| `npm run test:e2e` | Playwright browser workflow |
| `npm run build` | Backend `tsc`, frontend `next build`, shared build |
| `npm run demo:up` | Start Mongo, `vulnerable-api` (5001), `vulnerable-api-fixed` (5002); bounded health polling |
| `npm run demo:seed` | Idempotently reseed only the demo databases |
| `npm run demo:verify` | Full control-API-driven vulnerable + fixed verification, run twice |
| `npm run demo:down` | Stop only the services this repo owns |
| `npm run verify` | Ordered lint → typecheck → unit → integration → build → demo verification |

---

## 7. Verification matrix → concrete test locations

Per prompt §13. "Tests added" is not acceptable evidence; each row names where the assertion lives.

| Area | Location | Key negative controls |
| --- | --- | --- |
| Existing behavior | `vulnerable-api/tests/*.test.ts` (all 8 files kept passing) | Baseline recorded before Phase A, rerun after each phase |
| Parser | `backend/tests/unit/parser.*.test.ts` | Malformed, oversized, recursive, forbidden external ref, duplicate paths, zero-operation valid document |
| Discovery | `backend/tests/unit/discovery.*.test.ts` | Metadata keys not counted; base path preserved; route precedence |
| Generator | `backend/tests/unit/generator.*.test.ts` | Determinism across runs; missing ownership fixture → visible skip; unsafe cases generated but ineligible |
| Executor | `backend/tests/integration/executor.*.test.ts` | Timeout, refusal, denied redirect, denied destination (fake DNS), body cap, cancellation, budget, concurrency, credential isolation |
| Import boundary | `backend/tests/boundary/no-direct-http.test.ts` | Any direct HTTP client outside `executor/` fails the build |
| BOLA | `backend/tests/integration/bola.*.test.ts` | Fixed-mode negative, public/shared object, denied, nonexistent, generic 200 error body, bad credentials, changed IDs, truncated evidence |
| Authentication | `backend/tests/integration/auth-scanner.*.test.ts` | Optional/public operation, no fallback credential leakage, missing expiry fixture → skip |
| Misconfiguration | `backend/tests/integration/misconfig.*.test.ts` | Fixed-mode negatives; observation versus finding; safe method probes; CORS interpretation |
| Resource observations | `backend/tests/integration/resource.*.test.ts` | Disabled mode sends zero probes; stop conditions; no DoS conclusion |
| Persistence | `backend/tests/integration/persistence.*.test.ts` (real Mongo) | Restart survival, dedup index, pagination, write failure, readiness failure, isolated cleanup |
| Sanitization | `backend/tests/unit/sanitize.*.test.ts` + assertions inside persistence and report tests | Seeded secrets absent from documents, logs, API output, reports, AI requests, browser state |
| AI | `backend/tests/unit/ai.*.test.ts` | Disabled, fallback labeling, mocked sanitized flow, timeout, malformed response, prompt injection, no-send on sanitizer failure |
| UI | `frontend/e2e/*.spec.ts` | Error, empty, loading states; no fabricated counts |
| Lifecycle | `backend/tests/integration/lifecycle.*.test.ts` | Concurrent start policy, terminal-state consistency, cancellation, interrupted-process reconciliation, no dangling handles |
| Reproducibility | `scripts/verify.mjs` + `scripts/demo-verify.mjs` | Clean install, full build, isolated reseed, repeated demo run |

---

## 8. Risks and known blockers

| Risk | Handling |
| --- | --- |
| Docker Desktop may be unavailable on the Windows host | `demo:up` performs a bounded health probe and reports a **blocker** with exact recovery commands. Integration tests requiring real Mongo are reported `BLOCKED`, never converted to passes. The `mongodb-memory-server` fallback is used only for unit-level tests, never as a substitute for the real-Mongo integration milestone. |
| Declared dependency versions (`typescript ^7.0.2`, `mongoose ^9.9.2`, `express ^5.2.1`, `@types/node ^26`, `next`) must be confirmed to resolve and to expose the APIs assumed here | Phase A begins with a clean install and an API check against installed package documentation. No version numbers are assumed without verification; no forced upgrades are used as a shortcut. |
| Lockfiles are currently gitignored (D2) | Fixed first in Phase A; reproducible install becomes a verification row. |
| OpenAPI 3.2 execution support is genuinely partial | Published as an explicit gap in `docs/supported-features.md` and in the support matrix, not silently marked done. |
| No AI provider is configured in this repository | `AI BOUNDARY VERIFIED` is achievable; `LIVE AI VERIFIED` is recorded as `BLOCKED_CONFIG` / `NOT_RUN`. No provider endpoint is invented and no external call is made to hide the gap. |
| Extending `vulnerable-api` with CORS and version-disclosure fixtures contradicts its current documented scope | Treated as a deliberate, documented fixture expansion; `docs/vulnerability-matrix.md` is updated in the same phase. |
| Frontend framework swap discards the committed Vite scaffold | Safe: that scaffold is non-building (D1) and contains no application logic. |

---

## 9. Sequencing summary

| Phase | Roadmap coverage | Depends on | Primary deliverable |
| --- | --- | --- | --- |
| A | Day 1.1 | — | Trustworthy foundation, contracts, root commands |
| B | Day 1.2, Day 2 | A | Upload → parse → discover → deterministic preview |
| C | Day 3 | B | Central executor + bounded scan lifecycle |
| D | Day 4, Day 6.1 | C | Fixed-mode target, BOLA finding persisted and retrievable |
| E | Day 5 | D | Authentication, misconfiguration, resource observations |
| F | Day 6.2/6.3, Day 7.1/7.2 | E | Sanitizer boundary, full control API, reports, AI interface |
| G | Day 7.3, §13–§14 | F | Next.js dashboard, E2E, `verify` and `demo:verify` |

Phases C and D deliberately wire the local target and a minimal database slice earlier than their roadmap day labels so integration is testable from Phase C onward, as prompt §15 permits.

---

## 10. Completion gates

From prompt §15. These are the only acceptable claims of completion.

- **CORE DEMO VERIFIED** — parser, discovery, generator, executor, BOLA, basic scanners, persistence, report, and the connected UI pass real local checks including fixed controls and safety limits.
- **AI BOUNDARY VERIFIED** — minimization, sanitization, provider contract, failure handling, and honest fallback pass. This does **not** mean external AI ran.
- **LIVE AI VERIFIED** — expected to remain unreached; requires an explicitly configured and authorized provider.
- **NOT READY** — any core gate failed, or required integration verification could not be performed.

The OpenAPI 3.2 execution gap and the AI gap are reported separately and are never folded into a core-gate pass.
