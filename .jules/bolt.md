## 2025-05-15 - Memoized Map for O(1) Log Retrieval
**Learning:** Frequent filtering and sorting of large arrays (like workout logs) inside React rendering loops can lead to measurable UI lag, especially when multiple components (like `ExerciseCard`) perform these operations independently.
**Action:** Use a memoized `Map` to group data by its primary lookup key (e.g., `exerciseId`) once whenever the source data changes. This transforms $O(L)$ lookups into $O(1)$, which is critical for maintaining 60FPS when rendering long lists or frequently updating state (like a rest timer).
