## 2024-05-30 - Optimize validation allocations in worker.ts
**Learning:** Validating large data structures (like arrays of objects in bulk insert endpoints) by returning `Response` objects from inside a tight loop causes massive unnecessary memory allocation overhead, severely impacting CPU performance and response latency.
**Action:** Refactor validation helpers called within loops to return lightweight primitives (like strings or `null`) instead of complex objects. Construct the necessary heavy response objects (like `Response`) exactly once at the top-level route boundary only when an error is detected.

## 2025-02-18 - DST-Safe Date Formatting & Caching
**Learning:** Re-instantiating `Intl.DateTimeFormat` or calling `toLocaleDateString` on Date objects repeatedly inside rendering loops is extremely heavy. Caching formatted dates using timezone-offset arithmetic is prone to bugs during Daylight Saving Time (DST) transitions. Caching with a simple template string key derived from local date properties (`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) is completely DST-safe, incredibly fast, and avoids date instantiation overhead.
**Action:** When optimizing date formatting inside render cycles, pre-initialize formatting objects at the module level and cache string results using a template string key of the date parts to prevent DST timezone errors.

## 2025-02-23 - Bulk API Endpoints for N+1 Avoidance
**Learning:** Browsers have concurrent connection limits per origin (e.g. 6). Using `Promise.allSettled` to execute 500 parallel HTTP operations locally appears fast in unit tests, but in a realistic browser environment, it encounters heavy throttling.
**Action:** Always favor a single bulk data transfer endpoint for array processing. Implementing parameterized queries with placeholder chunking in PostgreSQL limits HTTP calls and scales significantly better, saving huge amounts of time (e.g., 4000+ms down to ~50ms).

## 2024-05-18 - Optimized Date Formatting in GlobalHistoryModal
**Learning:** Instantiating new `Date` objects and repeatedly invoking `toLocaleDateString` on cache misses inside processing loops generates significant CPU and memory overhead (object allocation and repeated timezone locale resolution). Using a pre-initialized `Intl.DateTimeFormat` and formatting raw numerical timestamps directly avoids `Date` allocations entirely and drastically improves cache miss performance (approx. 25x faster in benchmarks).
**Action:** Extract formatters using `Intl.DateTimeFormat` or `Intl.NumberFormat` to the module level and avoid passing string/Date object intermediates in tight loops where possible.

## 2025-02-24 - Pre-compute Render-loop Dictionary Lookups in React
**Learning:** Calling lookup methods (like `getLogsForExercise`) within an array map in a JSX render loop creates O(1) dictionary lookup overhead on every single render. When the parent component re-renders frequently (e.g. due to ticks from an active rest timer), this causes unnecessary CPU overhead.
**Action:** Pre-compute the association of lookup items with their respective objects using `useMemo` outside the render loop. This ensures reference stability, completely avoids O(1) loop lookup costs, and prevents redundant renders.
