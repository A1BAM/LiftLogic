## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2026-05-05 - [Fail-Secure API Authentication & Defense-in-Depth]
**Vulnerability:** The API authentication check was optional; if the `TARGET_HASH` environment variable was not set, the API defaulted to unauthenticated mode. Additionally, the API lacked standard security headers and input type validation.
**Learning:** Security checks must be mandatory and fail-closed. Optional security configurations can lead to accidental exposure during environment misconfiguration.
**Prevention:** Always verify that required security environment variables are present and valid before processing requests. Implement defense-in-depth by adding strict CSP and security headers even on API endpoints.
