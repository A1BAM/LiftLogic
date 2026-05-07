## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-04-11 - [Fail-Secure Configuration for Mandatory Secrets]
**Vulnerability:** The API used a "fail-open" authentication pattern where missing configuration (TARGET_HASH) would result in a warning but allow unauthenticated access.
**Learning:** Security-critical configuration must be enforced with a "fail-closed" (fail-secure) approach. If a secret or hash is required for authentication, the application should refuse to start or return errors if it is missing.
**Prevention:** Validate the presence of mandatory security environment variables at the start of the request/process and return a 500 error if they are missing.
