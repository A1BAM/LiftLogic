## 2026-05-14 - Optimized Today's Summary Calculation
**Learning:** Replacing multiple array iterations (`filter`, `reduce`, `map`) with a single-pass `for...of` loop and using numeric timestamp comparisons instead of `Date.toDateString()` parsing inside the loop results in significant performance gains (\~43x speedup on 100,000 logs).
**Action:** Always prefer single-pass loops and numeric timestamp ranges for filtering large data sets in React `useMemo` blocks to minimize CPU work and GC pressure.
## 2026-05-14 - Fixed Async Race Condition in Worker
**Learning:** Returning a promise from an `async` function inside a `try...finally` block without `await`ing it causes the `finally` block to execute immediately upon the return of the promise object, rather than upon its resolution. This can lead to premature cleanup of resources like database pools.
**Action:** Always use `return await` when returning a promise from a `try...finally` block in a Cloudflare Worker if the `finally` block performs resource cleanup.
## 2026-05-14 - Optimized Session Grouping in ExerciseCard
**Learning:** Leveraging pre-sorted data (descending timestamps) allows for a single-pass (N)$ grouping of logs into sessions, avoiding expensive intermediate Record objects and explicit sorting. Replacing `.find()` with (1)$ index access for identifying specific sessions (today vs. previous) further reduces computation.
**Action:** Always check if input data is already sorted before implementing grouping logic; if so, use a single-pass loop with boundary detection for maximum efficiency.
## 2026-06-17 - Optimize Date instantiation in GlobalHistoryModal loop
**Optimization:** Replaced redundant `new Date()` and `.toDateString()` calls inside the `for (const log of sortedLogs)` loop with a bucketing approach.
**Measurement:** By storing `currentDayStart` and taking advantage of the `newest-to-oldest` sorting order of `sortedLogs`, execution time for 100,000 logs was reduced from ~151ms to ~64ms (~2.3x speedup).
**Learning:** For large date-sorted lists, instantiating `Date` objects inside the loop creates massive GC pressure and unnecessary CPU usage. Precomputing loop-invariant boundary variables solves this efficiently.

## 2026-06-18 - Global Sorted State for Log History
**Learning:** Maintaining the primary `logs` state in descending chronological order globally (via `unshift` or prepending) eliminates redundant $O(N \log N)$ sorting and $O(N)$ filtering across multiple UI components (HistoryModal, GlobalHistoryModal).
**Action:** Establish a "source of truth" sort order in the primary data hook to allow $O(1)$ or early-exit $O(K)$ retrieval in child components.

## 2026-06-19 - Single-Pass Data Synchronization
**Learning:** Refactoring chained array traversals (`filter`, `map`) into a single-pass `for...of` loop during complex data synchronization reduces CPU overhead and avoids the creation of multiple intermediate arrays, leading to better performance and reduced GC pressure on large datasets.
**Action:** Always prefer a single-pass loop for processing large, mixed-type data streams to minimize iterations and memory allocations.
## 2025-03-01 - Bulk API Insertion Optimization
**Learning:** Browser connection limits (max ~6 concurrent requests per domain) turn Promise.all/Promise.allSettled into N+1 bottlenecks. By replacing a loop of single POSTs with a single bulk POST containing an array of payloads, I bypassed the connection pool queue completely.
**Action:** When saving large lists (like importing logs or saving definitions), create a bulk API endpoint instead of looping. Also ensure Postgres parameterized query generation uses `$1` notation correctly (e.g., `$\${index + 1}`) instead of injecting literal numbers.
