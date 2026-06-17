## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-20 - [Timing Attack in Token Verification]
**Vulnerability:** The Bearer token verification used the strict inequality operator (`!==`), which is susceptible to timing attacks. An attacker could potentially deduce the `TARGET_HASH` by measuring the response time of requests with different tokens.
**Learning:** String comparison in security-critical paths (like authentication) must be constant-time to prevent information leakage through execution time.
**Prevention:** Always use a constant-time comparison function for secrets and tokens.

## 2025-06-15 - [API Input Validation and Security Headers]
**Vulnerability:** The API lacked input validation, making it susceptible to malformed data and potential DoS or logic bypass. It also lacked modern security headers to prevent protocol downgrades and ensure restrictive resource access.
**Learning:** Centralizing JSON parsing and implementing strict type/length validation at the entry point of the API handler significantly reduces the attack surface and improves error resilience.
**Prevention:** Always validate all incoming request parameters (type, length, range) and include modern security headers like HSTS and CSP in all API responses.
