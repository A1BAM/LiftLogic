## 2026-05-01 - Memoized Map for Exercise Log Retrieval
**Learning:** Filtering a large array (e.g., 5000+ logs) by exercise ID in every render cycle or via repeated hook calls is a major O(N) bottleneck.
**Action:** Use a memoized Map (O(1) lookup) to group logs by exercise ID. Ensure the underlying state is sorted newest-first to allow early-exit iteration in date-based filters (like today's logs), providing massive speedups.
