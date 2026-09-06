# Test Cases

These cases describe the **local lab target**.  
They distinguish **secure expectation** from **intentional target behavior**.  
The weaknesses below are required evaluation conditions, not accidental defects to "fix" in this service.

Seeded actors:

| Actor | id | email | password | role |
| ----- | -- | ----- | -------- | ---- |
| User 1 | 1 | user1@test.com | password123 | user |
| User 2 | 2 | user2@test.com | password123 | user |
| Admin | 3 | admin@test.com | password123 | admin |

Seeded objects:

| Note | id | userId | title |
| ---- | -- | ------ | ----- |
| Note 1 | 1 | 1 | User 1 Note |
| Note 2 | 2 | 2 | User 2 Note |
| Note 3 | 3 | 3 | Admin Note |

Base URL: `http://localhost:5001`

---

## TC01 — User 1 logs in

**Request**

```http
POST /auth/login
Content-Type: application/json

{"email":"user1@test.com","password":"password123"}
```

**Secure expectation:** 200 with a token bound to user 1.

**Intentional target behavior:** Same. Authentication is intended to work so later BOLA cases have a legitimate attacker token.

```json
{ "token": "<jwt>", "userId": 1 }
```

---

## TC02 — User 1 retrieves Note 1

**Request**

```http
GET /api/notes/1
Authorization: Bearer <user-1-token>
```

**Secure expectation:** 200. User 1 owns Note 1.

**Intentional target behavior:** 200 with Note 1, including `userId: 1`.

---

## TC03 — User 1 creates a Note

**Request**

```http
POST /api/notes
Authorization: Bearer <user-1-token>
Content-Type: application/json

{"title":"Created by User 1","content":"Fresh note"}
```

**Secure expectation:** 201. The created note has `userId: 1`.

**Intentional target behavior:** Same.

---

## TC04 — User 1 modifies Note 1

**Request**

```http
PATCH /api/notes/1
Authorization: Bearer <user-1-token>
Content-Type: application/json

{"title":"Updated User 1 Note"}
```

**Secure expectation:** 200. The stored Note 1 title changes.

**Intentional target behavior:** Same.

---

## TC05 — User 1 requests Note 2 (BOLA read)

**Request**

```http
GET /api/notes/2
Authorization: Bearer <user-1-token>
```

**Secure expectation:** 403 Forbidden. Authentication is not authorization. Note 2 belongs to User 2.

**Intentional target behavior:** 200. The response exposes User 2's note, including `userId: 2`.

```json
{
  "id": 2,
  "userId": 2,
  "title": "User 2 Note",
  "content": "Private note belonging to User 2."
}
```

---

## TC06 — User 1 modifies Note 2 (BOLA modify)

**Request**

```http
PATCH /api/notes/2
Authorization: Bearer <user-1-token>
Content-Type: application/json

{"title":"Modified by User 1"}
```

**Secure expectation:** 403 Forbidden.

**Intentional target behavior:** 200. A subsequent `GET /api/notes/2` returns `title: "Modified by User 1"` and still `userId: 2`. The object actually changed; a status code alone is not sufficient evidence.

---

## TC07 — Protected profile requested without authentication

**Request**

```http
GET /api/profile
```

**Secure expectation:** 401 Unauthorized.

**Intentional target behavior:** 200 with a deterministic public profile for User 1. No `Authorization` header is required.

---

## TC08 — Protected profile requested with an invalid or expired token

**Requests**

```http
GET /api/profile
Authorization: Bearer not-a-valid-token
```

```http
GET /api/profile
Authorization: Bearer <expired-jwt>
```

**Secure expectation:** 401 Unauthorized.

**Intentional target behavior:** 200 with the same deterministic User 1 profile. Invalid and expired tokens are ignored rather than rejected.

Compare with a correctly protected route:

```http
GET /auth/me
Authorization: Bearer not-a-valid-token
```

**Secure expectation and actual behavior:** 401. Broken authentication is isolated to `/api/profile`.

---

## TC09 — Large notes limit requested

**Request**

```http
GET /api/notes?limit=100000
Authorization: Bearer <user-1-token>
```

**Secure expectation:** Reject or clamp the request with a client-visible limit policy (for example 400, or a documented maximum).

**Intentional target behavior:** 200. The request is accepted and the response echoes `limit: 100000`. Actual fetch work is internally capped so this remains a simulated vulnerability, not a real denial-of-service.

---

## TC10 — Undocumented endpoint discovered

**Requests**

```http
GET /api/v1/notes
Authorization: Bearer <user-1-token>
```

```http
GET /api/v2/notes
Authorization: Bearer <user-1-token>
```

```http
GET /api/debug
```

**Secure expectation:** Hidden, deprecated, or versioned endpoints are represented in the published inventory, or they do not exist.

**Intentional target behavior:** All three endpoints exist at runtime and are omitted from `openapi.yaml`. `/api/v1/notes` and `/api/v2/notes` return the same notes through different response structures. `/api/debug` returns harmless diagnostic metadata only.

---

## Additional normal paths

| ID | Case | Expected target behavior |
| -- | ---- | ------------------------ |
| TC11 | `GET /auth/me` with User 1 token | 200 identity for user 1 |
| TC12 | `GET /auth/me` without token | 401 |
| TC13 | `POST /auth/login` with a wrong password | 401 |
| TC14 | `POST /auth/register` with a new email | 201 `{ token, userId }` |
| TC15 | `GET /api/users/2` as User 1 | 403 (users are ownership-checked) |
| TC16 | `DELETE /api/notes/2` as User 1 | 403 (delete is ownership-checked) |
| TC17 | `GET /api/notes` without token | 401 |

These additional cases confirm that authentication still works on the main Notes API. BOLA is the missing object-ownership check on `GET`/`PATCH /api/notes/{id}`, not a total collapse of access control.
