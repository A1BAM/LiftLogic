## 2024-07-10 - Fix JSON Parsing Vulnerability in Auth Endpoints
**Vulnerability:** Empty POST requests to the `/logout` endpoint were throwing 400 Bad Request errors due to unconditional `await request.json()` execution in the generic request handler, failing the session termination.
**Learning:** Generic request handlers must explicitly check the `Content-Type` header before parsing `request.json()` because an empty body or missing JSON content will throw an exception, breaking endpoints that do not expect a body.
**Prevention:** Always verify `request.headers.get('Content-Type')?.includes('application/json')` before attempting to parse a JSON body from a Fetch API `Request` object in Cloudflare Workers.
