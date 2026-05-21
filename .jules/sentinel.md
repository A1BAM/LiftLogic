## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-20 - [Timing Attack in Token Verification]
**Vulnerability:** The Bearer token verification used the strict inequality operator (`!==`), which is susceptible to timing attacks. An attacker could potentially deduce the `TARGET_HASH` by measuring the response time of requests with different tokens.
**Learning:** String comparison in security-critical paths (like authentication) must be constant-time to prevent information leakage through execution time.
**Prevention:** Always use a constant-time comparison function for secrets and tokens.

## 2026-05-21 - [Robust Input Validation and Secure JSON Parsing]
**Vulnerability:** The API was vulnerable to DoS and potential data corruption because it did not validate the types or ranges of incoming fields, and it lacked error handling for malformed JSON payloads.
**Learning:** Cloudflare Workers' `request.json()` throws on invalid JSON, which can lead to unhandled exceptions if not wrapped in try-catch. Centralizing body parsing and implementing a strict validation layer ensures the API fails gracefully with 400 Bad Request and protects downstream database integrity.
**Prevention:** Always wrap JSON parsing in try-catch and enforce strict schema validation (types, lengths, ranges) before processing any write operations.
