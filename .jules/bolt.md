## 2025-05-14 - Optimized Workout Log Retrieval with Memoized Map
**Learning:** In applications with growing historical data, repeated O(N) array operations (filtering and sorting) within render-critical paths (like hooks used by multiple list items) can cause significant UI lag. Pre-sorting the source state and using a memoized Map for grouping enables O(1) retrieval and efficient early-exit loops.
**Action:** Always consider the growth of data arrays over time and prioritize O(1) or O(M) retrieval patterns using Maps or Objects when data is frequently accessed by a unique key.
