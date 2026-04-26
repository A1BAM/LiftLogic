## 2024-03-26 - Optimized Exercise Log Retrieval
**Learning:** The application was performing O(n) filtering and sorting for every exercise displayed on the dashboard, leading to O(Exercises * Logs) complexity. Memoizing grouped logs into a `Map` and maintaining a pre-sorted `logs` state reduces retrieval to O(1) per exercise and enables early-exit loops for time-based filtering.
**Action:** Use memoized Maps for grouping data by ID when multiple lookups are performed against a flat array in a single render cycle.
