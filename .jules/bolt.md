## 2026-05-14 - Optimized Today's Summary Calculation
**Learning:** Replacing multiple array iterations (`filter`, `reduce`, `map`) with a single-pass `for...of` loop and using numeric timestamp comparisons instead of `Date.toDateString()` parsing inside the loop results in significant performance gains (\~43x speedup on 100,000 logs).
**Action:** Always prefer single-pass loops and numeric timestamp ranges for filtering large data sets in React `useMemo` blocks to minimize CPU work and GC pressure.
## 2026-05-14 - Fixed Async Race Condition in Worker
**Learning:** Returning a promise from an `async` function inside a `try...finally` block without `await`ing it causes the `finally` block to execute immediately upon the return of the promise object, rather than upon its resolution. This can lead to premature cleanup of resources like database pools.
**Action:** Always use `return await` when returning a promise from a `try...finally` block in a Cloudflare Worker if the `finally` block performs resource cleanup.
