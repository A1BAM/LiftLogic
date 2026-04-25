## 2025-05-14 - Map-based retrieval for workout logs

**Learning:** In the `useWorkoutData` hook, each exercise card in the dashboard triggers a re-retrieval of its logs. With the original O(N) filtering and sorting, this leads to O(M*N) complexity where M is the number of exercises and N is the total number of logs. A memoized `Map` lookup reduces this to O(N) overall.

**Action:** Maintain `logs` in a pre-sorted state at the source (fetch/import/add) so that grouping into a `Map` preserves chronological order without redundant sorting of subgroups.
