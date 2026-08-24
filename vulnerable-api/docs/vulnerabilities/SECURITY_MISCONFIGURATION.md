# Security Misconfiguration

## 1. Vulnerability
Security Misconfiguration — The API server is configured with multiple
insecure defaults: missing security headers, verbose error messages that
leak internal details, overly permissive CORS, and exposed server information.

## 2. OWASP Category
**API8:2023 — Security Misconfiguration**

## 3. Vulnerable Endpoint
All endpoints — this is a server-wide configuration issue.

## 4. Expected Secure Behavior
- Security headers set (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).
- X-Powered-By header removed.
- CORS restricted to specific origins.
- Error responses return generic messages without internal details.
- Health endpoint does not expose internal server information.

## 5. Vulnerable Behavior
- **X-Powered-By: Express** header exposed.
- No X-Content-Type-Options, X-Frame-Options, or HSTS headers.
- CORS allows all origins (`*`).
- Error responses include full stack traces and error type.
- Health endpoint exposes Node.js version and environment.

## 6. How to Reproduce

```bash
# Check 1: Response headers (look for missing security headers)
curl -sI http://localhost:5001/api/products
# ❌ X-Powered-By: Express  (should be removed)
# ❌ No X-Content-Type-Options header
# ❌ No X-Frame-Options header

# Check 2: CORS (Access-Control-Allow-Origin should be restricted)
curl -s -H "Origin: http://evil.com" \
  -I http://localhost:5001/api/products
# ❌ Access-Control-Allow-Origin: *

# Check 3: Verbose errors (trigger a 500 error)
curl -s -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token-to-trigger-error"
# ❌ Response may contain stack trace

# Check 4: Health endpoint exposes internals
curl -s http://localhost:5001/api/health
# ❌ Shows nodeVersion, environment
```

## 7. Expected Scanner Result
```
Severity: MEDIUM
Finding:  Security Misconfiguration — Insecure server configuration
Details:
  - X-Powered-By header exposed
  - Missing security headers (X-Content-Type-Options, X-Frame-Options, HSTS)
  - CORS allows all origins
  - Verbose error messages with stack traces
  - Health endpoint information disclosure
```

## 8. Recommended Mitigation
- Use `helmet` middleware to set security headers.
- Disable `X-Powered-By`: `app.disable('x-powered-by')`.
- Restrict CORS to specific, trusted origins.
- Use a generic error handler that doesn't leak internals.
- Remove sensitive info from health/status endpoints.

```typescript
import helmet from 'helmet';

app.use(helmet());
app.disable('x-powered-by');
app.use(cors({ origin: 'https://your-app.com' }));

// Generic error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal Server Error' });
});
```
