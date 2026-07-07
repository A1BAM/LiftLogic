## 2025-02-23 - Bulk API Endpoints for N+1 Avoidance
**Learning:** Browsers have concurrent connection limits per origin (e.g. 6). Using `Promise.allSettled` to execute 500 parallel HTTP operations locally appears fast in unit tests, but in a realistic browser environment, it encounters heavy throttling.
**Action:** Always favor a single bulk data transfer endpoint for array processing. Implementing parameterized queries with placeholder chunking in PostgreSQL limits HTTP calls and scales significantly better, saving huge amounts of time (e.g., 4000+ms down to ~50ms).
