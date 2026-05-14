## 2025-04-10 - [API Authentication and Error Sanitization]
**Vulnerability:** The API was completely unauthenticated, allowing anyone with the URL to read, write, and delete workout data. Additionally, error messages leaked database internal details.
**Learning:** Hardcoded hashes in the frontend do not provide server-side security. Authentication must be enforced at the API layer.
**Prevention:** Use server-side secrets for authentication and ensure catch blocks do not return raw error objects or messages to the client.
## 2025-05-14 - [CORS Origin Reflection]
**Vulnerability:** The CORS policy reflected the 'Origin' request header when 'ALLOWED_ORIGIN' was set to '*', which is an overly permissive configuration.
**Learning:** When using '*' for CORS, the 'Access-Control-Allow-Origin' header should return '*' literally, rather than reflecting the request's origin. This ensures the policy is explicitly public and prevents unintended behavior with credentialed requests (though '*' doesn't allow credentials anyway, reflecting the origin might).
**Prevention:** Explicitly check for '*' and return it. For specific origins, ensure an exact match before reflecting.
