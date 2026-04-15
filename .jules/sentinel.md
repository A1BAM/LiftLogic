## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-15 - [API Security Hardening]
**Vulnerability:** The API lacked basic security headers (CSP, HSTS, etc.) and relied on loose type checking for incoming data, potentially leading to malformed data injection or client-side attacks like clickjacking.
**Learning:** Even internal/small APIs should implement defense-in-depth via security headers and strict schema validation at the edge.
**Prevention:** Always include standard security headers in worker responses and enforce strict type/length validation on all writable endpoints (POST/DELETE).
