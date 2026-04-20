## 2026-04-20 - O(N*E) Filtering Anti-pattern in Exercise Lists
**Learning:** The application was filtering the entire workout history for every exercise card displayed, leading to O(N*E) complexity on every render. This becomes a significant bottleneck as the user's history grows and when high-frequency updates (like a rest timer) trigger re-renders.
**Action:** Use a memoized Map to index logs by exercise ID in the data hook. Maintain the main log array in a sorted state (descending) to allow retrieval functions to use early-exit iteration (break), reducing search time for recent logs.
