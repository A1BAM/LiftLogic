## 2025-02-20 - Concurrent DB queries for bulk inserts
**Learning:** Sequential database queries within chunked batch operations introduce N+1 network latency delays on the backend, dramatically inflating overall execution time compared to local iteration.
**Action:** Always collect Promises from operations inside a chunk loop into an array, and `await Promise.all()` at the end of the loop to parallelize network round trips, drastically improving speed.

## 2026-07-16 - Referential Stability in React Lists
**Learning:** Even with React.memo, list items will re-render if any prop reference changes. Common culprits are inline arrow functions for callbacks and fresh array/object references from .filter() or .map() in the parent.
**Action:** Wrap parent callbacks in useCallback (ensuring they don't depend on the item being rendered) and use a persistent cache (ref) in hooks to maintain stable references for filtered data subsets. Ensure state updaters remain pure by moving side effects (like localStorage) outside.
