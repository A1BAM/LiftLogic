## 2025-02-27 - Fail Secure on Missing TARGET_HASH
**Vulnerability:** The API allowed unauthenticated access (and logged a warning) if the `TARGET_HASH` environment variable was accidentally omitted from the Cloudflare Worker configuration.
**Learning:** Development conveniences (bypassing auth when secrets aren't set) create high-risk production vulnerabilities if configuration deployments fail or secrets are accidentally deleted.
**Prevention:** Always implement a "fail secure" default. If authentication configuration is missing, the service should return a `500 Internal Server Error` (Configuration Error) and refuse all state-changing or data-access requests rather than degrading to an unauthenticated mode.
