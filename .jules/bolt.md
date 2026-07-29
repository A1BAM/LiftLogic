## 2025-02-14 - Optimize Date Instantiations in Render Getters
**Learning:** Calling `new Date()` multiple times inside a getter that executes repeatedly inside render loops (like mapping over a list of components) incurs measurable CPU and allocation overhead.
**Action:** Extract Date-based boundary logic (e.g., `startOfDay`, `endOfDay`) to module-level cache variables. Use `Date.now()` (which is significantly faster than object allocation) to check cache validity, recalculating full Date objects only when the time period rolls over.
