## 2025-02-20 - Concurrent DB queries for bulk inserts
**Learning:** Sequential database queries within chunked batch operations introduce N+1 network latency delays on the backend, dramatically inflating overall execution time compared to local iteration.
**Action:** Always collect Promises from operations inside a chunk loop into an array, and `await Promise.all()` at the end of the loop to parallelize network round trips, drastically improving speed.
