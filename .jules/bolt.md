## 2025-05-15 - [O(1) Exercise Log Retrieval]
**Learning:** Mapping logs by `exerciseId` into a `Map` during the initial data processing phase prevents $O(N)$ filtering in every exercise card render, which would otherwise lead to $O(N \times M)$ total complexity for the dashboard.
**Action:** Always favor Map-based grouping for list views where child components need to filter a shared parent dataset.

## 2025-05-15 - [Stale Date Memoization]
**Learning:** Memoizing date-based boundaries (like `startOfToday`) with an empty dependency array in a React hook can lead to stale data if the application stays open across a midnight boundary.
**Action:** Calculate date boundaries inside the callbacks or effect handlers where they are used, unless the performance cost is proven to be significant.
