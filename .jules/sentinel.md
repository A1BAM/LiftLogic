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
## 2025-02-28 - Prevent Timing Attacks in Password Caching
**Vulnerability:** The password caching logic in the Cloudflare worker (`worker.ts`) used the standard strict equality operator (`===`) to compare the cached password against the current `PASSWORD` environment variable. This could potentially allow an attacker to guess the cached password via a timing attack by measuring the time it takes for the comparison to fail.
**Learning:** Standard string comparison operators fail early when they encounter a mismatch, which means the time taken depends on the number of matching characters. This can leak information about the secret being compared.
**Prevention:** Always use constant-time comparison functions (like `timingSafeEqual`) when comparing sensitive values such as passwords, hashes, or tokens, even when comparing them against internal environment variables or cache states.

## 2026-07-20 - Strict Route Matching to Prevent Authentication Bypass
**Vulnerability:** The API used loose `.endsWith()` matching to skip authentication for login and logout endpoints. This created a security risk where an unauthenticated attacker could access private routes (such as fetching private workout logs) by appending `/login` or `/logout` as trailing URL segments to the endpoint paths.
**Learning:** Checking request paths using substrings or loose suffix helpers like `.endsWith` allows suffix overlaps and route spoofing. Route matching logic should always explicitly check for both exact path equality and the associated HTTP method.
**Prevention:** Avoid wildcard or suffix matches (`endsWith`, `includes`) for authentication-exempt route filters. Explicitly validate both the exact path and the HTTP method allowed for each exemption.
