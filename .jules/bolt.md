# Bolt's Performance Journal

## 2025-05-15 - [O(1) Map Lookup for Exercise Logs]
**Learning:** In applications where a large flat array of logs is filtered per item in a list (e.g., exercise cards), memoizing a Map grouping by ID reduces complexity from O(E*N) to O(N).
**Action:** Use a memoized Map for grouping and stable array references to enable effective use of React.memo.

## 2025-05-15 - [Early-Exit for Sorted Data]
**Learning:** When data is strictly sorted (e.g., descending timestamps), retrieval functions can use early-exit loops instead of `.filter()` to avoid redundant iterations over older data.
**Action:** Prefer `for...of` loops with `break` over `.filter()` for time-windowed slices of sorted arrays.
