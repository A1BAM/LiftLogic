## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.

## 2025-05-15 - [API Hardening and CSP Constraints]
**Vulnerability:** The API lacked standard security headers and strict input validation, potentially exposing it to various attacks and invalid data states.
**Learning:** In a Cloudflare Worker + Assets architecture where the worker might handle both API and asset routing (via `run_worker_first`), applying a restrictive `Content-Security-Policy` (e.g., `default-src 'none'`) globally in the worker can break the frontend by blocking asset loading.
**Prevention:** Hardened the API with `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`. Implemented strict type and length validation for all API inputs. CSP should be applied carefully, ideally specifically to the frontend HTML response or with proper source allow-listing.
