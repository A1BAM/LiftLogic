## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-15 - [API Robustness and Input Validation]
**Vulnerability:** The API lacked strict type and length validation for incoming data, and some error responses were plain text, potentially leaking information or allowing malformed data to reach the database.
**Learning:** Cloudflare Workers should explicitly validate every field in the request body for type, length, and range to prevent injection or DoS.
**Prevention:** Implement a standard validation layer for all state-changing operations (POST/DELETE) and ensure all responses are JSON-formatted with security headers.
