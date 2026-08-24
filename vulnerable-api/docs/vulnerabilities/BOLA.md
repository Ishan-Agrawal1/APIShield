# BOLA — Broken Object Level Authorization

## 1. Vulnerability
Broken Object Level Authorization (BOLA) — The API endpoint returns user data
for any valid user ID without verifying that the requesting user owns (or is
authorized to access) the requested resource.

## 2. OWASP Category
**API1:2023 — Broken Object Level Authorization**

## 3. Vulnerable Endpoint
```
GET /api/users/:id
```

## 4. Expected Secure Behavior
- Users can only access their **own** profile (`req.user.userId === id`).
- Admin users can access any profile.
- Requesting another user's data returns `403 Forbidden`.

## 5. Vulnerable Behavior
- Any authenticated user can access **any** user's data by ID.
- User A (ID 101) can request User B's (ID 102) data and receive it.

## 6. How to Reproduce

```bash
# Step 1: Login as User A
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"userA@test.com","password":"password123"}'

# Step 2: Copy the token from the response

# Step 3: Access User A's own data (should work)
curl -s http://localhost:5001/api/users/101 \
  -H "Authorization: Bearer <TOKEN>"

# Step 4: Access User B's data (should be denied, but isn't)
curl -s http://localhost:5001/api/users/102 \
  -H "Authorization: Bearer <TOKEN>"
# ❌ Returns User B's data — BOLA vulnerability confirmed
```

## 7. Expected Scanner Result
```
Severity: HIGH
Finding:  BOLA — Broken Object Level Authorization
Endpoint: GET /api/users/:id
Detail:   Authenticated user can access other users' resources
```

## 8. Recommended Mitigation
- Implement server-side object-level authorization checks.
- Verify `req.user.userId === req.params.id` before returning data.
- Allow admin role to bypass the ownership check.
- Use an authorization middleware for consistent enforcement.

```typescript
// Secure implementation:
if (req.user?.userId !== id && req.user?.role !== 'admin') {
  return res.status(403).json({ error: 'Access denied.' });
}
```
