## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-15 - [API Hardening with Security Headers and Input Validation]
**Vulnerability:** The API lacked basic security headers (CSP, X-Frame-Options, etc.), making it susceptible to various web-based attacks like clickjacking. Furthermore, it lacked server-side input validation, which could lead to data corruption or unexpected behavior if malformed data was sent.
**Learning:** Even if the frontend performs validation, the backend MUST independently verify all incoming data to maintain integrity and security. Security headers provide a critical layer of defense-in-depth at the browser level.
**Prevention:** Always implement strict type and range validation for all API inputs and include standard security headers in every response.
