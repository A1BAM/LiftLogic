## 2025-05-04 - Memoized Map for O(1) Exercise Log Retrieval
**Learning:** In applications with growing datasets (like workout logs), performing O(N) filtering and sorting in the render path for every item in a list (e.g., exercise cards) creates a significant bottleneck. Maintaining a pre-sorted global state and using a memoized Map for grouping allows O(1) retrieval per exercise.
**Action:** Always prefer grouping flat lists into a Map if multiple components need to filter the same list by a specific key. Combine with early-exit loops on pre-sorted data for time-range filtering.
