## 2025-05-15 - Memoized Map for O(1) Log Retrieval

**Learning:** In applications with growing history (like workout logs), $O(N)$ filtering in the main render hook (`useWorkoutData`) becomes a significant bottleneck as history scales. Transitioning to a write-side sorting strategy (sorting on fetch/add/import) allows for a memoized $O(1)$ Map-based retrieval and $O(K)$ early-exit filtering on the read-side.

**Action:** Prefer maintaining sorted arrays for time-series data and use memoized Maps for grouping by category/ID to avoid repeated full-array scans and sorts during UI updates.
