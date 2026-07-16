## 2025-02-20 - Concurrent DB queries for bulk inserts
**Learning:** Sequential database queries within chunked batch operations introduce N+1 network latency delays on the backend, dramatically inflating overall execution time compared to local iteration.
**Action:** Always collect Promises from operations inside a chunk loop into an array, and `await Promise.all()` at the end of the loop to parallelize network round trips, drastically improving speed.
## 2024-05-14 - Global History Stats Caching
**Learning:** Initializing caching structures (like date localization Maps) inside functions evaluated during every render cycle destroys the cache on every call, leading to extreme performance degradation for expensive operations like `toLocaleDateString()`.
**Action:** Always hoist caching structures to the module scope (or use `useMemo`/`useRef` correctly inside React components) when the cache should persist across multiple function invocations or re-renders.
## 2024-05-24 - Schema Alteration Query on Write Path
**Learning:** Running schema alterations (`ALTER TABLE ADD COLUMN IF NOT EXISTS`) dynamically on every API request is highly inefficient and significantly increases latency.
**Action:** Remove schema alteration statements from hot API routes. Handle schema migrations completely separate from application execution.
