## 2025-05-15 - Optimize log retrieval with memoized indexing
**Learning:** In applications with frequent re-renders (like a workout tracker updating timers or inputs), O(L) operations (filtering/sorting) in the render loop for each item in a list can quickly become a bottleneck as the dataset grows (e.g., hundreds of workout logs).
**Action:** Use `useMemo` to pre-calculate an index (e.g., a Map) for data that is frequently accessed by a specific key. This reduces complexity from O(E * L) to O(L log L) for the initial group/sort and O(E) for the subsequent render lookups.
