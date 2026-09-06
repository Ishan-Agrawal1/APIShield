# vulnerable-api

Intentionally vulnerable Notes REST API used as a **controlled local target** for APIShield.

This application is not the scanner. It exists so later APIShield work can compare:

- the declared OpenAPI inventory
- observed HTTP events / logs
- object identifiers (`note.id`, `userId`)
- authorization context (`authenticated`, `userId`)

against known Broken Object Level Authorization and related API weaknesses.

Do not "fix" the documented vulnerabilities in this service. They are the evaluation target.

## Requirements

- Node.js 20+
- MongoDB 7+ for local or Docker runs

Tests use an ephemeral in-memory MongoDB and do not require Docker.

## Install

```bash
cd vulnerable-api
npm install
```

Copy `.env.example` to `.env` if you want local overrides.

## Start the database

From the repository root:

```bash
docker compose up mongo
```

Or use any local MongoDB listening on `mongodb://localhost:27017`.  
This service uses the `vulnerable-api` database so it stays isolated from the APIShield scanner database.

If MongoDB is not running, `npm start` falls back to an ephemeral in-memory MongoDB so the lab can still run locally. That fallback is for development only; Docker Compose remains the reproducible setup.

## Seed / reset

```bash
npm run seed
```

This deletes users and notes, then inserts the deterministic lab fixtures.

The API also seeds automatically when it starts against an empty database.

## Start the API

```bash
npm run dev
```

or

```bash
npm start
```

API base URL: `http://localhost:5001`

## Run tests

```bash
npm test
npm run typecheck
```

Tests reset the database before each case.

## Test credentials

| id | email | password | role |
| -- | ----- | -------- | ---- |
| 1 | user1@test.com | password123 | user |
| 2 | user2@test.com | password123 | user |
| 3 | admin@test.com | password123 | admin |

Seeded notes:

| id | userId | title |
| -- | ------ | ----- |
| 1 | 1 | User 1 Note |
| 2 | 2 | User 2 Note |
| 3 | 3 | Admin Note |

## OpenAPI

Declared inventory: [`openapi.yaml`](./openapi.yaml)

Intentionally omitted from that file:

- `GET /api/v1/notes`
- `GET /api/v2/notes`
- `GET /api/debug`
- `GET /api/profile`

## Logging

Every API request writes one structured JSON event to stdout.

When `LOG_FILE` is set (default `logs/http-events.jsonl`), the same events are appended there.

Each event includes, when available:

- `timestamp`
- `method`
- `uri`
- `path`, `query`, `params`
- `statusCode`
- `authenticated`
- `userId`
- `objectId`
- redacted `requestBody` / `responseBody`

Passwords and bearer tokens are never logged. Authorization is recorded only as `authenticated`, `userId`, and `authorization: none | bearer | invalid`.

## Intentional vulnerabilities

| ID | Weakness | Actual target behavior |
| -- | -------- | ---------------------- |
| V1 | BOLA read | Authenticated User 1 can `GET /api/notes/2` |
| V2 | BOLA modify | Authenticated User 1 can `PATCH /api/notes/2` |
| V3 | Broken authentication | `GET /api/profile` succeeds without a valid token |
| V4 | Resource consumption | `GET /api/notes?limit=100000` is accepted |
| V5 | Improper inventory | Undocumented `/api/v1/notes`, `/api/v2/notes`, `/api/debug` |

Details: [`docs/vulnerability-matrix.md`](./docs/vulnerability-matrix.md) and [`docs/test-cases.md`](./docs/test-cases.md).

`DELETE /api/notes/{id}` and `GET /api/users/{id}` **do** enforce ownership. The missing check is specific to note read/modify by id.

## Reproduce BOLA

1. Login as User 1 and save the token.

```bash
curl -s -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user1@test.com\",\"password\":\"password123\"}"
```

2. Request Note 1 with that token. This is legitimate access.

```bash
curl -s http://localhost:5001/api/notes/1 \
  -H "Authorization: Bearer USER1_TOKEN"
```

3. Request Note 2 with the **same** token.

```bash
curl -s http://localhost:5001/api/notes/2 \
  -H "Authorization: Bearer USER1_TOKEN"
```

4. The second response is User 2's note, including `"userId": 2`. A secure API would return 403. This target returns 200 because object-level authorization is missing.

5. The same token can also modify Note 2:

```bash
curl -s -X PATCH http://localhost:5001/api/notes/2 \
  -H "Authorization: Bearer USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Modified by User 1\"}"
```

A follow-up `GET /api/notes/2` shows the stored title is `Modified by User 1` while `userId` remains `2`.

## Documented endpoints

| Method | Path |
| ------ | ---- |
| POST | `/auth/register` |
| POST | `/auth/login` |
| GET | `/auth/me` |
| GET | `/api/users` |
| GET | `/api/users/:id` |
| GET | `/api/notes` |
| POST | `/api/notes` |
| GET | `/api/notes/:id` |
| PATCH | `/api/notes/:id` |
| DELETE | `/api/notes/:id` |

## Project boundary

APIShield's scanner, CPN engine, and frontend live in sibling directories. This package must stay independently runnable and must not import scanner code.
