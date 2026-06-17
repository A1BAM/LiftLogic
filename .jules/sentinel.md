## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-20 - [Timing Attack in Token Verification]
**Vulnerability:** The Bearer token verification used the strict inequality operator (`!==`), which is susceptible to timing attacks. An attacker could potentially deduce the `TARGET_HASH` by measuring the response time of requests with different tokens.
**Learning:** String comparison in security-critical paths (like authentication) must be constant-time to prevent information leakage through execution time.
**Prevention:** Always use a constant-time comparison function for secrets and tokens.
## 2025-05-22 - Insufficient Input Validation on JSON Import
**Vulnerability:** Partial validation of user-provided JSON arrays (only checking the first item) allowed malformed data to bypass security checks.
**Learning:** Incomplete validation is a common pitfall. When accepting structured data, the entire structure must be validated recursively or iteratively before use.
**Prevention:** Always use a dedicated validation layer or schema validator to enforce data integrity for all items in a collection, not just samples.
