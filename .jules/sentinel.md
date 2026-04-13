## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-15 - [Defense-in-Depth: Security Headers and Input Validation]
**Vulnerability:** The API was missing standard security headers (CSP, X-Frame-Options, etc.) and had loose input validation, relying only on parameterized queries for SQL injection protection.
**Learning:** Parameterized queries protect against SQL injection, but they don't prevent malformed data or oversized payloads from entering the system. Defense-in-depth requires multiple layers of validation.
**Prevention:** Always implement strict type and length validation at the API entry point and include standard security headers in all responses to protect against XSS, clickjacking, and MIME-type sniffing.
