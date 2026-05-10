## 2025-05-15 - Memoized Map & Early-Exit Retrieval

**Learning:** Repeatedly filtering a large, unsorted array in React render cycles (e.g., in `getLogsForExercise`) causes $O(N \times M)$ complexity where $N$ is total logs and $M$ is displayed exercises. Maintaining a sorted state invariant allows $O(1)$ Map lookups and $O(K)$ early-exit filtering for date-specific logs.

**Action:** Always maintain chronological order at the state level for time-series data to enable $O(1)$ lookups and efficient partial scans.
