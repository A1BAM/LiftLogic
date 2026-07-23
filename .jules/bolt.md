## 2024-05-19 - Pre-compute JSX render loop lookups
**Learning:** O(1) dictionary lookups inside JSX render loops (`.map`) can add significant overhead during React's render phase, especially for large arrays or components that re-render frequently due to other state changes (like typing in an input).
**Action:** When a mapped array's items need secondary data (like resolving an ID to a full object), pre-compute that relationship within the memoized data preparation step. Build a new array of `{ item, resolvedData }` so the render loop only accesses pre-existing properties, eliminating calculation during React's render phase.

## 2025-02-18 - Prevent render cascading from frequent state ticks
**Learning:** In applications with frequent state ticks (like a ticking Rest Timer that updates parent component state every second), child components in list views will repeatedly re-render if they aren't memoized. Even with `React.memo`, any inline handlers (like arrow functions in a `.map` loop) will recreate on every render, invalidating the memoization.
**Action:** Always wrap heavy list-item components in `React.memo`, elevate callbacks to stable handlers wrapped in `useCallback`, and update the child prop interfaces to accept the list item's ID or object rather than relying on inline closures.
