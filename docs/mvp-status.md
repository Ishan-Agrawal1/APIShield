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

## Fresh checks (2026-09-19)

| Command | Result |
| --- | --- |
| `npm run typecheck` (all packages) | PASS |
| backend `npm run test:unit` | PASS 18/18 |
| backend `npm run test:integration` (Docker Mongo via `TEST_MONGO_URI`) | PASS 10/10 |
| frontend `npm run build` | PASS |
| `npm run demo:verify` | PASS (12 discovered operations, 36 generated cases, repeatable vulnerable findings, fixed control clean of seeded BOLA/auth/misconfig) |
| Playwright `E2E_FULL` connected flow | NOT_RUN in this pass — smoke spec exists; browsers were not installed as part of this run |
| `npm run test:unit` for `vulnerable-api` | NOT_RE-RUN here (lab package unchanged in Phase G; prior session 26/26). mongodb-memory-server download was stalled on this host. |

## Known gaps

- OpenAPI 3.2 `query` / `additionalOperations` are discovered and marked non-executable.
- Live AI calls are not part of the default demo.
- Authentication findings are recorded per failed context (`none` / `invalid` / `malformed` / `expired`) on `GET /api/profile`.
- Scan progress can show executed > planned when scanners reuse extra probes inside coverage counters.
- Dashboard CSS is custom (not a Tailwind 4 rewrite). Next.js App Router + TypeScript is the shipped UI.
- `backend/.env` must keep `PORT=5000`. A leftover `PORT=5001` collides with the lab API.
