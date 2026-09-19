# APIShield supported features and limitations

## OpenAPI

| Version | Discovery | Generation | Execution |
| --- | --- | --- | --- |
| 3.0.x | Ordinary REST paths, parameters, JSON bodies, http/apiKey/bearer schemes | Supported subset | HTTP methods get/put/post/delete/options/head/patch/trace |
| 3.1.x | Same REST subset; JSON Schema 2020-12 keywords are preserved | Partial for composed schemas | Same as 3.0 |
| 3.2.x | Recognizes `query` and `additionalOperations` | Partial | Those forms are not executed |

External `$ref`s, file refs, and unbounded alias expansion are rejected. Uploaded `servers` values are metadata only.

## Checks

| Rule | What it proves | What it does not prove |
| --- | --- | --- |
| BOLA_READ_CROSS_USER | Confirmed cross-user read of a private object when both baselines succeed | Write/delete BOLA, IDOR beyond the configured fixtures |
| AUTH_BYPASS | Protected data returned without valid authentication | Full credential-stuffing or JWT cryptography review |
| SERVER_VERSION_DISCLOSURE | Observed header | Exploitability |
| DEBUG_INFORMATION | Stack-trace indicators on `/api/debug` | That every error message is sensitive |
| CORS_UNTRUSTED_ORIGIN | Header combination against an untrusted Origin | A browser-readable credentialed leak |
| Resource observations | Bounded timing/size notes | Unrestricted resource consumption / DoS |

A completed scan with zero findings means **no findings in tested scope**, not that the API is secure.

## Safety limits

See `shared/src/limits.ts`. Default demo scanning is loopback-only via server-side target profiles.
