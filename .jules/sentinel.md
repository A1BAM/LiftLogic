## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-15 - [API Hardening: Headers and Validation]
**Vulnerability:** The API lacked security headers (CSP, HSTS, etc.) and did not perform strict input validation, potentially allowing malformed data or clickjacking.
**Learning:** Even with authentication, APIs should enforce strict data schemas and defense-in-depth headers to prevent protocol-level attacks.
**Prevention:** Implement mandatory security headers (CSP, X-Frame-Options, etc.) and validate all request body fields for type, length, and range before processing.
