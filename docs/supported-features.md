# APIShield supported features and limitations

## OpenAPI

| Version | Discovery | Generation | Execution |
| --- | --- | --- | --- |
| 3.0.x | Ordinary REST paths, parameters, JSON bodies, http/apiKey/bearer schemes | Supported subset | HTTP methods get/put/post/delete/options/head/patch/trace |
| 3.1.x | Same REST subset; JSON Schema 2020-12 keywords are preserved | Partial for composed schemas | Same as 3.0 |
| 3.2.x | Recognizes `query` and `additionalOperations` | Partial | Those forms are not executed |

External `$ref`s, file refs, and unbounded alias expansion are rejected. Uploaded `servers` values are metadata only.

## Input modes

| Mode | Input | Authority for the target |
| --- | --- | --- |
| Spec-driven | Upload an OpenAPI document, pick a server-side target profile | The target profile (its approved origin, ownership fixtures, and BOLA cases) |
| Route (ad-hoc) | Paste one route: URL, method, headers, path/query params, body, optional bearer token | The pasted origin, restricted to loopback (`127.0.0.1` / `localhost` / `::1`) or an approved profile origin; the executor's DNS guard still blocks metadata/private ranges |

Both modes feed the same generator → executor → scanners → findings pipeline and persist to the same collections, so the dashboard, finding detail, and report views are identical.

## Checks

| Rule | Mode | What it proves | What it does not prove |
| --- | --- | --- | --- |
| BOLA_READ_CROSS_USER | Spec | Confirmed cross-user read of a private object when both baselines succeed | Write/delete BOLA, IDOR beyond the configured fixtures |
| BOLA_READ_CROSS_OBJECT | Route | Same credential retrieved distinct neighbouring objects; `confirmed` only when a returned object's owner field differs from the baseline owner, otherwise `potential` | That the extra objects are private (they may be shared/public without an ownership fixture) |
| AUTH_BYPASS | Spec | Protected data returned without valid authentication on a declared-protected operation | Full credential-stuffing or JWT cryptography review |
| AUTH_WEAK_ENFORCEMENT | Route | Protected-shaped data returned after the credential was removed or invalidated (`potential`) | That the route is not intentionally public |
| SERVER_VERSION_DISCLOSURE | Both | Observed header | Exploitability |
| DEBUG_INFORMATION | Both | Stack-trace indicators in an error/debug response | That every error message is sensitive |
| CORS_UNTRUSTED_ORIGIN | Both | Header combination against an untrusted Origin | A browser-readable credentialed leak |
| OBSERVED_ALLOW_HEADER | Route | Methods advertised by `OPTIONS`/`Allow` | That an advertised method is an executable exploit |
| Resource observations | Spec | Bounded timing/size notes | Unrestricted resource consumption / DoS |

Route mode generates object-level mutation probes only for safe methods (`GET`/`HEAD`), so an ad-hoc run never modifies or deletes a neighbouring object. A completed scan with zero findings means **no findings in tested scope**, not that the API is secure.

## Safety limits

See `shared/src/limits.ts`. Default demo scanning is loopback-only via server-side target profiles.
