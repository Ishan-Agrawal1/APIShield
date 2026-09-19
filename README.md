# APIShield

Automated REST API vulnerability detection for **authorized** local targets. This repository implements the connected MVP:

```text
OpenAPI YAML/JSON
  -> parser / discovery
  -> deterministic test-case generation
  -> central HTTP executor
  -> local notes API (vulnerable and fixed modes)
  -> BOLA, authentication, and misconfiguration checks
  -> MongoDB findings
  -> rule-based explanation (optional AI)
  -> dashboard and printable report
```

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
