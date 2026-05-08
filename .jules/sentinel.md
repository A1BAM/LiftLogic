## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-15 - [Fail-Secure API Authentication]
**Vulnerability:** The API fallback logic would allow unauthenticated access if the `TARGET_HASH` environment variable was accidentally omitted, relying only on a logged warning.
**Learning:** Security controls should "fail-closed". If a required security configuration (like an auth secret) is missing, the system should disable the affected functionality rather than running in an insecure state.
**Prevention:** Explicitly check for required environment variables and return a 500 Error if they are missing before processing any requests.
