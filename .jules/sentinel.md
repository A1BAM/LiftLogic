## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2026-05-10 - [Defense-in-Depth and Input Validation]
**Vulnerability:** The API lacked basic security headers (MIME-sniffing/Clickjacking), had an overly permissive CORS configuration that reflected request origins when set to '*', and was vulnerable to potential DoS via unrestricted input lengths in the 'notes' field.
**Learning:** Even with authentication, lack of input validation and security headers leaves the application exposed to secondary attack vectors like XSS, Clickjacking, and resource exhaustion.
**Prevention:** Always implement strict type checking and length limits on user-provided data, and use a 'fail-secure' approach for environment-dependent features like authentication and CORS.
