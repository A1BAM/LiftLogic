## 2025-05-15 - Optimized log retrieval with sorted invariant

**Learning:** In a workout application where logs are frequently filtered by exercise and date, maintaining the `logs` state in descending chronological order (newest first) enables two significant optimizations:
1. O(1) retrieval of all logs for an exercise using a memoized Map (grouping by exerciseId).
2. O(K) retrieval for date-specific queries (like today's logs) by using early-exit iteration on the pre-sorted arrays, where K is the number of recent logs.

**Action:** Always maintain a sorted invariant in the primary data state when high-frequency filtering on time-series data is required. Ensure all state update sites (fetch, add, import) preserve this order.
