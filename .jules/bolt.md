## 2026-04-14 - Memoized Grouping for List Rendering
**Learning:** In applications where a global list (e.g., `logs`) is repeatedly filtered for multiple child components (e.g., `ExerciseCard`), the render complexity scales as $O(E \times L)$. Using `useMemo` to create a grouping Map reduces this to $O(L)$ total, ensuring $O(1)$ lookup for each child.
**Action:** Always check for redundant `.filter()` or `.find()` calls on large state arrays within loops or mapped components. Pre-calculate lookup Maps or Sets using `useMemo`.
