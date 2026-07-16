## 2025-02-20 - Concurrent DB queries for bulk inserts
**Learning:** Sequential database queries within chunked batch operations introduce N+1 network latency delays on the backend, dramatically inflating overall execution time compared to local iteration.
**Action:** Always collect Promises from operations inside a chunk loop into an array, and `await Promise.all()` at the end of the loop to parallelize network round trips, drastically improving speed.

## 2024-07-16 - Redundant Promise.all calls in backend
**Learning:** Redundant `await Promise.all()` calls on the same array of promises simply waste microtask ticks because the promises are already resolved by the first `await`.
**Action:** Remove redundant `await Promise.all()` calls where they exist to shave off unnecessary microtask overhead and improve request latency in performance-critical API paths.
