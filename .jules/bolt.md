## 2025-04-23 - Memoized Map and Early-Exit retrieval
**Learning:** Filtering and sorting the entire log history in every render cycle of a list (e.g., exercise cards) creates a massive O(N*M) bottleneck as the dataset grows. Maintaining a pre-sorted state and using a memoized Map for grouping enables O(1) retrieval and O(K) early-exit filtering where K is only the recent logs needed.
**Action:** Use a memoized Map for grouped data retrieval and maintain sorted invariants in state to enable early-exit optimizations.
