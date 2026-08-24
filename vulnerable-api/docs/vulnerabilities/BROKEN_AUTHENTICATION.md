# Broken Authentication

## 1. Vulnerability
Broken Authentication — The admin API endpoint does not require any
authentication. Any client can access sensitive admin-level data without
providing a JWT or any credentials.

## 2. OWASP Category
**API2:2023 — Broken Authentication**

## 3. Vulnerable Endpoint
```
GET /api/admin/users
```

## 4. Expected Secure Behavior
- Only authenticated admin users can access the admin endpoint.
- Unauthenticated requests receive `401 Unauthorized`.
- Non-admin users receive `403 Forbidden`.

## 5. Vulnerable Behavior
- The endpoint has **no authentication middleware**.
- Any client — even without a JWT — can access the full user list.
- No role-based access control is enforced.

## 6. How to Reproduce

```bash
# Step 1: Access admin endpoint WITHOUT any token
curl -s http://localhost:5001/api/admin/users
# ❌ Returns full user data — Broken Authentication confirmed

# Step 2: Compare with a protected endpoint (should return 401)
curl -s http://localhost:5001/api/users
# ✅ Returns 401 — this endpoint correctly requires auth
```

## 7. Expected Scanner Result
```
Severity: HIGH
Finding:  Broken Authentication — Unprotected admin endpoint
Endpoint: GET /api/admin/users
Detail:   Admin endpoint accessible without authentication
```

## 8. Recommended Mitigation
- Apply `authMiddleware` to the admin route.
- Add role-based authorization check (`req.user.role === 'admin'`).
- Use a dedicated admin middleware for consistent enforcement.

```typescript
// Secure implementation:
router.get('/', authMiddleware, adminOnly, getAdminUsers);

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}
```
