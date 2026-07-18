## 2024-06-25 - Cache password hash in getTargetHash to avoid repeated computation
**Learning:** Cloudflare Workers preserve module-level state across requests in the same isolate. Computing a cryptographic hash via `crypto.subtle.digest` on every request introduces significant unnecessary overhead.
**Action:** Use module-scope variables to cache the computed hash and the input string (for validation). This simple memoization drops repeated hash times from milliseconds to microseconds while ensuring correctness if configuration values change.
