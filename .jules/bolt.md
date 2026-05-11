## 2026-05-11 - [Optimization of Log Retrieval]
**Learning:** In applications where the primary data access pattern is filtering by a specific ID (e.g., `exerciseId`) and date ranges, maintaining a sorted state invariant combined with a memoized grouping Map can yield massive performance gains.
**Action:** Always maintain chronological order at the state level (source of truth) to enable early-exit iterations in retrieval logic. Use a `Map` for grouping to avoid repeated $O(N)$ filtering.
