## 2024-05-30 - Optimize validation allocations in worker.ts
**Learning:** Validating large data structures (like arrays of objects in bulk insert endpoints) by returning `Response` objects from inside a tight loop causes massive unnecessary memory allocation overhead, severely impacting CPU performance and response latency.
**Action:** Refactor validation helpers called within loops to return lightweight primitives (like strings or `null`) instead of complex objects. Construct the necessary heavy response objects (like `Response`) exactly once at the top-level route boundary only when an error is detected.

## 2025-02-18 - DST-Safe Date Formatting & Caching
**Learning:** Re-instantiating `Intl.DateTimeFormat` or calling `toLocaleDateString` on Date objects repeatedly inside rendering loops is extremely heavy. Caching formatted dates using timezone-offset arithmetic is prone to bugs during Daylight Saving Time (DST) transitions. Caching with a simple template string key derived from local date properties (`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) is completely DST-safe, incredibly fast, and avoids date instantiation overhead.
**Action:** When optimizing date formatting inside render cycles, pre-initialize formatting objects at the module level and cache string results using a template string key of the date parts to prevent DST timezone errors.
