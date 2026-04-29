## 2025-05-15 - Performance Pattern: Memoized Map Retrieval

**Learning:** In applications with flat log structures (like workout history), exercise-specific retrieval via `.filter()` becomes a bottleneck as the dataset grows. Grouping logs into a memoized Map by ID reduces retrieval from O(N) to O(1), and maintaining a sorted invariant at the state level allows for early-exit optimizations during date-based filtering.

**Action:** Prefer maintaining sorted invariants in state and using grouped Maps for high-frequency lookups in data hooks.

## 2025-05-15 - Environment Quirk: pnpm lint

**Learning:** In this environment, `pnpm lint` triggers Android Lint instead of a standard web linter (like ESLint). This can cause confusion and fail to catch TypeScript/React issues.

**Action:** Use `npx tsc --noEmit` for type checking and rely on `npx vitest` for logic verification when standard scripts behave unexpectedly.
