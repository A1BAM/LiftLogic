## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2026-05-12 - [Hardening API Security Headers and Input Validation]
**Vulnerability:** The API lacked defensive security headers (CSP-related), used inconsistent error response formats (plain text vs JSON), and didn't strictly validate the types or lengths of user-supplied fields like `id` and `notes`.
**Learning:** Even with authentication, lack of input validation and security headers can leave the application vulnerable to DoS (via large payloads) or MIME-sniffing/clickjacking. Consistency in response types is also critical for client-side stability and security parsing.
**Prevention:** Always implement strict type and length validation on the backend, even for authenticated requests. Use standard security headers like `X-Content-Type-Options` and `X-Frame-Options` on every response.
