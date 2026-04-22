## 2026-04-22 - Optimize log retrieval with Map and pre-sorting
**Learning:** In applications with growing history (like workout logs), performing (N)$ filtering and sorting in render-adjacent hooks or components creates a linear performance degradation. Pre-sorting the source of truth and using a memoized Map for grouping provides a significant $ performance boost for exercise-specific lookups.
**Action:** Always favor (1)$ Map lookups over (N)$ array filtering when retrieving child records (logs) for a parent entity (exercise) in React hooks.
