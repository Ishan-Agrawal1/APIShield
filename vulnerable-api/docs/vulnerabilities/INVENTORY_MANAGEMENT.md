# Improper Inventory Management

## 1. Vulnerability
Improper Inventory Management — The API exposes endpoints that are not
documented in the OpenAPI specification. These include legacy versioned
endpoints, deprecated admin routes, and an internal health check.

## 2. OWASP Category
**API9:2023 — Improper Inventory Management**

## 3. Vulnerable Endpoints
```
GET /api/admin/users     — Admin panel (not in OpenAPI spec)
GET /api/v1/users        — Legacy versioned alias (not in OpenAPI spec)
GET /api/v1/users/:id    — Legacy versioned alias (not in OpenAPI spec)
GET /api/admin-old       — Deprecated legacy endpoint (not in OpenAPI spec)
GET /api/health          — Health check (not in OpenAPI spec)
```

## 4. Expected Secure Behavior
- All exposed endpoints are documented in the OpenAPI specification.
- Legacy/deprecated endpoints are removed or explicitly versioned.
- Internal endpoints (health checks) are not publicly accessible.
- API inventory is regularly audited.

## 5. Vulnerable Behavior
- The OpenAPI spec documents only 5 endpoints.
- The actual API exposes at least 9 endpoints.
- 4+ endpoints are undocumented and potentially unmonitored.
- Legacy endpoints may lack security controls.

## 6. How to Reproduce

```bash
# Step 1: Check documented endpoints (should all work)
curl -s http://localhost:5001/api/products     # ✅ Documented
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"userA@test.com","password":"password123"}'  # ✅ Documented

# Step 2: Check undocumented endpoints (should NOT exist per spec)
curl -s http://localhost:5001/api/admin/users   # ❌ Undocumented — responds
curl -s http://localhost:5001/api/admin-old     # ❌ Undocumented — responds  
curl -s http://localhost:5001/api/health        # ❌ Undocumented — responds

# Step 3: Check legacy versioned endpoint (requires auth)
# Login first, then:
curl -s http://localhost:5001/api/v1/users \
  -H "Authorization: Bearer <TOKEN>"            # ❌ Undocumented — responds

# Step 4: Compare OpenAPI spec endpoints vs actual
# OpenAPI spec:  5 documented paths
# Actual API:    9+ active paths
# Delta:         4 undocumented endpoints
```

## 7. Expected Scanner Result
```
Severity: LOW
Finding:  Improper Inventory Management — Undocumented endpoints detected
Details:
  - GET /api/admin/users  → Not in OpenAPI spec
  - GET /api/v1/users     → Not in OpenAPI spec (legacy version)
  - GET /api/admin-old    → Not in OpenAPI spec (deprecated)
  - GET /api/health       → Not in OpenAPI spec (internal)
```

## 8. Recommended Mitigation
- Remove or disable deprecated/legacy endpoints.
- Document all active endpoints in the OpenAPI specification.
- Implement API gateway routing to control exposed endpoints.
- Regularly audit deployed endpoints against documentation.
- Use automated tools to detect endpoint drift.

```yaml
# Add missing endpoints to openapi.yaml:
/api/admin/users:
  get:
    security:
      - BearerAuth: []
    # ... full documentation

# Or remove legacy endpoints from code:
# Delete: router.use('/v1/users', usersRouter);
# Delete: router.get('/admin-old', legacyAdminUsers);
```
