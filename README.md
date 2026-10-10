# APIShield

Automated REST API vulnerability detection for **authorized** local targets. This repository implements the connected MVP:

```text
OpenAPI YAML/JSON  OR  a single pasted route
  -> route analysis / discovery
  -> deterministic security test-case generation
  -> central HTTP executor
  -> local notes API (vulnerable and fixed modes)
  -> BOLA, authentication, and misconfiguration checks
  -> MongoDB findings
  -> rule-based explanation (optional AI)
  -> dashboard and printable report
```

## Two ways to start a scan

1. **Route test (quickest).** Paste one authorized route — URL, method, headers, path/query
   parameters, body, and an optional bearer token — and click **Start Security Test**. APIShield
   generates ~10–20 controlled cases (normal request, cross-object ids, boundary/malformed ids,
   missing/invalid/malformed credential, CORS and method probes), executes them, and reports
   findings. UI: `/scans/route`; API: `POST /api/scans/route` (and `POST /api/scans/route/preview`).
   Restricted to loopback targets or an approved profile origin.
2. **Spec-driven.** Upload an OpenAPI document, pick a server-side target profile, and scan the
   whole declared surface.

Both paths share one pipeline and persist to the same collections, so the scan, finding, and
report views are identical.

## Stack

- Backend: Express 5 + TypeScript + MongoDB/Mongoose
- Frontend: Next.js App Router + TypeScript
- Lab target: `vulnerable-api/` (intentionally vulnerable Notes API, plus a fixed-mode twin)
- Contracts: `shared/` (`@apishield/contracts`)

PostgreSQL is not used.

## Requirements

- Node.js 20+
- MongoDB 7 on `127.0.0.1:27017` (Docker Compose provided)
- Docker is optional but is the reproducible way to start Mongo and the lab APIs

## Setup

```bash
node scripts/bootstrap-secrets.mjs
npm run install:all
```

Copy `.env.example` files if you prefer to edit them by hand. Bootstrap will not overwrite existing values.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start vulnerable-api, backend, and Next.js on loopback |
| `npm run demo:up` | Start Mongo via Compose and the vulnerable/fixed lab APIs |
| `npm run demo:seed` | Idempotently reseed only the demo databases |
| `npm run demo:verify` | Drive APIShield through its control API (requires `APISHIELD_OPERATOR_TOKEN`) |
| `npm run demo:down` | Stop owned Compose services |
| `npm run test:unit` | Unit tests |
| `npm run test:integration` | Backend integration tests (ephemeral Mongo + local lab process) |
| `npm run verify` | lint, typecheck, unit, integration, build |

Default ports: backend `127.0.0.1:5000`, frontend `127.0.0.1:3000`, vulnerable API `127.0.0.1:5001`, fixed API `127.0.0.1:5002`.

## Dashboard

The Next.js UI is a connected operator console, not an analytics product.

- `/` scan history
- `/scans/route` paste-a-route security test (URL, method, headers, path/query params, body, token), with case preview
- `/specifications/new` OpenAPI upload
- `/specifications/[id]` discovery and support matrix
- `/scans/new` target selection, ownership fixtures, optional runtime tokens (component state only), case preview
- `/scans/[id]` live progress, coverage, findings
- `/findings/[id]` evidence and rule-based or AI-assisted explanation
- `/scans/[id]/report` JSON/HTML export

The browser never receives `APISHIELD_OPERATOR_TOKEN`. Next.js route handlers inject it server-side.

## Authorized use

Scan only the server-side target profiles. Uploaded OpenAPI `servers` values and browser-submitted URLs cannot grant network access.

Demonstration credentials (`user1@test.com` / `password123`) are local lab fixtures. They are not APIShield operator credentials.

## Layout

```text
APIShield/
  backend/          Control API and scanners
  frontend/         Next.js dashboard
  vulnerable-api/   Intentionally vulnerable / fixed local target
  shared/           Canonical contracts
  scripts/          Portable Node orchestration
  docs/             Plans, status, support matrix
```

`cpn-engine/` remains out of MVP scope.
