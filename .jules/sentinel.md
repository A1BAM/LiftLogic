## 2025-02-27 - Fail Secure on Missing TARGET_HASH
**Vulnerability:** The API allowed unauthenticated access (and logged a warning) if the `TARGET_HASH` environment variable was accidentally omitted from the Cloudflare Worker configuration.
**Learning:** Development conveniences (bypassing auth when secrets aren't set) create high-risk production vulnerabilities if configuration deployments fail or secrets are accidentally deleted.
**Prevention:** Always implement a "fail secure" default. If authentication configuration is missing, the service should return a `500 Internal Server Error` (Configuration Error) and refuse all state-changing or data-access requests rather than degrading to an unauthenticated mode.

## 2025-05-15 - Auth Bypass via Overly Broad Route Matching
**Vulnerability:** The API allowed unauthenticated access to workout data via `GET /gym-api/login` because the authentication bypass logic used `url.pathname.endsWith('/login')` without validating the HTTP method.
**Learning:** Routing and authentication bypasses must be as specific as possible. Using `endsWith` or similar partial matches for security-sensitive paths can lead to unintended bypasses on other methods or sub-paths.
**Prevention:** Use exact path matching (e.g., `url.pathname === '/gym-api/login'`) and always validate the HTTP method (e.g., `request.method === 'POST'`) when defining authentication bypass rules.
