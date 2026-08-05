## 2024-05-19 - Pre-compute JSX render loop lookups
**Learning:** O(1) dictionary lookups inside JSX render loops (`.map`) can add significant overhead during React's render phase, especially for large arrays or components that re-render frequently due to other state changes (like typing in an input).
**Action:** When a mapped array's items need secondary data (like resolving an ID to a full object), pre-compute that relationship within the memoized data preparation step. Build a new array of `{ item, resolvedData }` so the render loop only accesses pre-existing properties, eliminating calculation during React's render phase.

## 2025-02-18 - Prevent render cascading from frequent state ticks
**Learning:** In applications with frequent state ticks (like a ticking Rest Timer that updates parent component state every second), child components in list views will repeatedly re-render if they aren't memoized. Even with `React.memo`, any inline handlers (like arrow functions in a `.map` loop) will recreate on every render, invalidating the memoization.
**Action:** Always wrap heavy list-item components in `React.memo`, elevate callbacks to stable handlers wrapped in `useCallback`, and update the child prop interfaces to accept the list item's ID or object rather than relying on inline closures.
Memory recording:
## 2026-07-23 - Optimize Date allocation in loops
**Learning:** Instantiating `new Date(timestamp)` inside a tight array processing loop to check for day boundaries is a huge CPU drain and causes lots of garbage collection.
**Action:** Use timezone-offset integer math: `Math.floor((timestamp - tzOffsetMs) / 86400000)` to calculate local 'day IDs' instead of re-instantiating `Date` objects in a loop. Only instantiate the `Date` when formatting is required (cache miss).

## 2023-10-27 - Optimize JSON parsing for duplicate Exercise Definitions
**Learning:** `JSON.parse` is an expensive CPU operation. When processing arrays containing potentially duplicate encoded data (like exercise definitions in a workout history fetch), parsing the same data multiple times causes significant overhead.
**Action:** Extract a stable identifier from the raw data (if available, e.g. from a wrapping ID like `def_${exerciseId}`) to check against a cache/set of already parsed items. Skip parsing for duplicates to achieve >2x performance improvements on large data sets.

## 2026-07-24 - Optimize Date allocation in loops using DST-Safe Timezone Offset math
**Learning:** Instantiating multiple `Date` objects inside tight loops or frequent callbacks (like grouping sessions in `ExerciseCard` or calculating `getLastSessionLogs`) is expensive and puts pressure on garbage collection. Using a static global timezone offset (`new Date().getTimezoneOffset()`) for timezone-shifted integer math fails across Daylight Saving Time (DST) boundaries because the offset itself shifts.
**Action:** Calculate the local timezone offset dynamically for each day/session boundary from its specific `Date` object (`d.getTimezoneOffset()`), avoiding static module-level offsets. Use this log-specific offset to perform integer-based day ID and day-start calculations, avoiding duplicate Date instantiations (such as constructing a midnight date to obtain its timestamp) and caching date strings.

## 2026-07-24 - Remove N+1 API Calls using Bulk Endpoints
**Learning:** Sequential `await` calls in a loop (the N+1 query pattern) or mapped `Promise.all` over small independent items can introduce massive latency due to network round-trips (e.g. ~20x slower).
**Action:** Always batch related data modifications that are dispatched close to each other into a bulk payload and use a singular API request. Extract batched state update methods (e.g., `saveExercises`) so parent components can perform singular operations rather than iterating sequential API operations (e.g., in `handleSwitchExercise`).
