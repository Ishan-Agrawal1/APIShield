# APIShield MVP status

Living checklist for the connected MVP. Updated after Phase G verification on 2026-09-19.

## Gates

| Gate | Status |
| --- | --- |
| CORE DEMO VERIFIED | PASS — `npm run demo:verify` wrote `docs/reports/verification-1789810606744.md`. Vulnerable mode produced confirmed BOLA, AUTH_BYPASS, and seeded misconfiguration. Fixed mode produced none of those three. Repeatable classification matched. |
| AI BOUNDARY VERIFIED | PASS — AI disabled by default, `rule_based` fallback, injected-provider unit tests |
| LIVE AI VERIFIED | NOT_RUN / BLOCKED_CONFIG — no provider credentials in this repository |
| Browser smoke | PASS against the live local stack (scan history, scan detail, finding, report, upload validation, scan configuration) |

## Roadmap coverage

| Area | Status |
| --- | --- |
| Day 1 foundation / parser | Implemented |
| Day 2 discovery / generator | Implemented |
| Day 3 executor / scan queue | Implemented (cancel abort is wired into `runScan`) |
| Day 4 vulnerable+fixed target / BOLA | Implemented |
| Day 5 auth, misconfig, resource observations | Implemented |
| Day 6 Mongo persistence, control API, reports | Implemented |
| Day 7 sanitizer, AI interface, Next.js dashboard | Implemented |

## Route (ad-hoc) testing mode — added 2026-10-08

A single pasted route can now be tested without an OpenAPI upload, matching the prompt's
"paste a route → Start Security Test" flow. It reuses the existing executor, credential store,
persistence, and dashboard.

- Input: `POST /api/scans/route` and `POST /api/scans/route/preview`; UI at `/scans/route`.
- Route analyzer: `backend/src/scanner/adhoc/routeAnalyzer.ts` (normalizes URL/method/params into the shared `ApiEndpoint`; loopback-or-approved-origin guard).
- Generator: `backend/src/scanner/adhoc/adhocGenerator.ts` (deterministic 10–20 cases; object-level mutation probes only for safe methods).
- Runner/analysis: `backend/src/scanner/adhoc/adhocRunner.ts` (new rules `BOLA_READ_CROSS_OBJECT`, `AUTH_WEAK_ENFORCEMENT`, plus the shared misconfiguration rules).
- Safety: ad-hoc origins are restricted to loopback or an approved profile origin; the DNS guard still blocks metadata/private ranges; runtime tokens are never persisted.

## Fresh checks (2026-10-08)

| Command | Result |
| --- | --- |
| `npm run typecheck` (all packages) | PASS |
| backend `npm run test:unit` | PASS 28/28 (18 prior + 10 ad-hoc route/generator) |
| backend `npm run test:integration` (ephemeral in-memory Mongo) | PASS 13/13 (10 prior + 3 ad-hoc, incl. live BOLA from a pasted route) |
| frontend `npm run build` | PASS (includes `/scans/route`) |
| Live local boot (in-memory Mongo, real backend + vulnerable-api) | PASS — paste-a-route demo found HIGH confirmed BOLA on `/api/notes/{id}`; spec-driven demo found 8 findings incl. BOLA/AUTH/misconfig |
| `npm run demo:verify` | NOT_RUN this pass — requires Docker Mongo (`demo:up`), and the Docker daemon is stopped on this host |
| Playwright `E2E_FULL` connected flow | NOT_RUN — browsers not installed in this environment |

### Environment note (2026-10-08)

The Docker daemon was stopped and `backend/.env` `MONGO_URI` pointed at a remote cluster, so the
Docker-based `demo:up` / `demo:verify` path was not exercised. Verification instead used an
isolated in-memory MongoDB for the backend and the vulnerable-api's built-in in-memory fallback.
For the standard Docker workflow, start Docker Desktop and run `npm run demo:up`.

## Known gaps

- OpenAPI 3.2 `query` / `additionalOperations` are discovered and marked non-executable.
- Live AI calls are not part of the default demo.
- Authentication findings are recorded per failed context (`none` / `invalid` / `malformed` / `expired`) on `GET /api/profile`.
- Scan progress can show executed > planned when scanners reuse extra probes inside coverage counters.
- Dashboard CSS is custom (not a Tailwind 4 rewrite). Next.js App Router + TypeScript is the shipped UI.
- `backend/.env` must keep `PORT=5000`. A leftover `PORT=5001` collides with the lab API.
