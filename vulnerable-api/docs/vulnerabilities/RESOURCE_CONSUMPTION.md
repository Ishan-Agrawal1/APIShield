# Unrestricted Resource Consumption

## 1. Vulnerability
Unrestricted Resource Consumption — The login endpoint has no rate limiting,
allowing unlimited authentication attempts. An attacker can brute-force
credentials or overwhelm the server with requests.

## 2. OWASP Category
**API4:2023 — Unrestricted Resource Consumption**

## 3. Vulnerable Endpoint
```
POST /api/auth/login
```

## 4. Expected Secure Behavior
- Rate limiting is applied (e.g., max 5 attempts per minute per IP).
- Account lockout after repeated failed attempts.
- Response includes `Retry-After` header when rate limited.

## 5. Vulnerable Behavior
- No rate limiting is applied.
- Unlimited login attempts can be made.
- No account lockout mechanism exists.
- No `Retry-After` or `X-RateLimit-*` headers.

## 6. How to Reproduce

```bash
# Send 10 rapid login requests — all should succeed (no throttling)
for i in $(seq 1 10); do
  echo "Request $i:"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    -X POST http://localhost:5001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"userA@test.com","password":"password123"}'
done
# ❌ All 10 requests return HTTP 200 — No rate limiting

# PowerShell equivalent:
1..10 | ForEach-Object {
  $response = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body '{"email":"userA@test.com","password":"password123"}' `
    -UseBasicParsing
  "Request $_`: HTTP $($response.StatusCode)"
}
```

## 7. Expected Scanner Result
```
Severity: MEDIUM
Finding:  Unrestricted Resource Consumption — No rate limiting
Endpoint: POST /api/auth/login
Detail:   10/10 requests succeeded without throttling
```

## 8. Recommended Mitigation
- Implement rate limiting middleware (e.g., `express-rate-limit`).
- Add account lockout after N failed attempts.
- Return `429 Too Many Requests` with `Retry-After` header.
- Add `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers.

```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per window
  message: { error: 'Too many login attempts.' },
});

router.post('/login', loginLimiter, login);
```
