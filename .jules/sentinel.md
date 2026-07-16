## 2025-02-27 - Fail Secure on Missing TARGET_HASH
**Vulnerability:** The API allowed unauthenticated access (and logged a warning) if the `TARGET_HASH` environment variable was accidentally omitted from the Cloudflare Worker configuration.
**Learning:** Development conveniences (bypassing auth when secrets aren't set) create high-risk production vulnerabilities if configuration deployments fail or secrets are accidentally deleted.
**Prevention:** Always implement a "fail secure" default. If authentication configuration is missing, the service should return a `500 Internal Server Error` (Configuration Error) and refuse all state-changing or data-access requests rather than degrading to an unauthenticated mode.
## 2026-07-16 - Fix Overly Permissive CORS Configuration with Credentials
**Vulnerability:** Allowed wildcard origin  with credentials  which is a security violation and can lead to cross-origin data theft if the browser honors it.
**Learning:** Returning  alongside  is disallowed by modern browsers but setting it manually in the backend code creates ambiguity and security risks.
**Prevention:** Always remove  if  is set to .
## 2024-05-28 - Fix Overly Permissive CORS Configuration with Credentials
**Vulnerability:** Allowed wildcard origin `*` with credentials `Access-Control-Allow-Credentials: true` which is a security violation and can lead to cross-origin data theft.
**Learning:** Returning `Access-Control-Allow-Origin: *` alongside `Access-Control-Allow-Credentials: true` creates ambiguity and security risks.
**Prevention:** Always remove `Access-Control-Allow-Credentials: true` if `Access-Control-Allow-Origin` is set to `*`.
