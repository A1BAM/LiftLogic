# Bolt's Journal - Critical Learnings

## 2025-05-15 - Single-pass Data Processing
**Learning:** Combining multiple array operations (filter, map, reduce) into a single `for...of` loop can provide significant performance gains (up to 5x-10x) for datasets tracking thousands of items, especially when combined with numeric date comparisons to avoid string allocations.
**Action:** Always check `useMemo` blocks for multiple passes over the same large collection and consider consolidating them into a single pass.
