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

## 2026-07-21 - Enforce Input String Length Limits to Prevent Timing-safe CPU Exhaustion DoS
**Vulnerability:** Unconstrained input lengths for variables compared using constant-time string comparison (`timingSafeEqual`) allow an attacker to send extremely long payloads (such as several megabytes), forcing the comparison loop to run excessively and causing CPU-based Denial of Service (DoS) in Cloudflare Workers.
**Learning:** While `timingSafeEqual` prevents timing attacks by running a full loop regardless of character matches, its complexity scales linearly with the input length `O(N)`. If input lengths are not strictly capped before comparison, attackers can trigger resource exhaustion/DoS.
**Prevention:** Always implement strict, reasonable input length limits (e.g., maximum 100 characters for SHA-256 hex hashes and 200 characters for Authorization headers) and validate the payload type BEFORE executing any constant-time comparison.

## 2026-07-22 - Strict Permissions-Policy and CSP Hardening for Static Assets
**Vulnerability:** Lack of explicit browser permission constraints allowed modern features (such as camera, microphone, and geolocation) to run in the application context by default, and a standard CSP lacked explicit restrictions on object-src and base-uri.
**Learning:** Hardening headers is a vital part of defense-in-depth, preventing future injection-based vector bypasses and disabling unnecessary browser APIs to reduce the overall attack surface.
**Prevention:** Always include a strict `Permissions-Policy` header on all responses and ensure static asset CSPs explicitly disable `object-src` and restrict `base-uri` to `self`.
