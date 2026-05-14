# Bolt's Journal - Critical Learnings Only

## 2025-05-15 - Journal Initialization
**Learning:** Initializing Bolt's journal to track critical performance insights.
**Action:** Use this journal to document surprising performance discoveries.

## 2025-05-15 - O(1) Log Retrieval Optimization
**Learning:** The previous $O(M \times N)$ filtering approach in `useWorkoutData.ts` was a major bottleneck for users with large histories. Implementing a memoized `Map` for grouping and sorting once per state change provides an $O(1)$ retrieval path that scales significantly better.
**Action:** Prioritize Map-based grouping for any component that needs to filter a global "logs" array by a specific ID.
