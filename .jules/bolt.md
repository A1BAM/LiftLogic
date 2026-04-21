## 2025-05-15 - Data Structure Optimization for Log Retrieval
**Learning:** In applications with a growing history of logs (like workout trackers), filtering a flat array in every render or hook call ($O(N \cdot E)$) quickly becomes a bottleneck. Pre-grouping data into a `Map` during state updates ($O(N)$) and using $O(1)$ lookups in components significantly improves UI responsiveness.
**Action:** Always favor indexed data structures (Maps/Objects) for frequent lookups by ID, especially when dealing with time-series or relational data in React state.

## 2025-05-15 - Repository Hygiene for Build Artifacts
**Learning:** Committing `dist/` or local logs like `dev_server.log` is a major red flag in code reviews and can block PRs even if the logic is perfect.
**Action:** Ensure temporary artifacts and build directories are strictly excluded from the final submission, regardless of local verification needs.
