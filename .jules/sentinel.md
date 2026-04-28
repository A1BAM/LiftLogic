## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-15 - [API Input Validation]
**Vulnerability:** The API lacked robust input validation, accepting any data sent in POST/DELETE requests. This could lead to database corruption, DoS through oversized notes, or logic errors.
**Learning:** Even with authentication, input must be strictly validated on the server side to ensure data integrity and prevent resource exhaustion.
**Prevention:** Implement a centralized validation utility that enforces type checking, string length limits (IDs <= 100, Notes <= 1000), and numeric range constraints for all API payloads.
