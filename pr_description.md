🎯 **What:** Extract subcomponents `ImportLogsView`, `TodaySummaryCard`, `StatsSummaryRow`, and `ChronologicalLogList` from the large render method of `GlobalHistoryModal`.
💡 **Why:** To improve code maintainability and readability by breaking down a monolithic complex component into cohesive, smaller, reusable pieces.
✅ **Verification:** Verified by running `tsc --noEmit` and the full `vitest` suite, ensuring all tests pass and no functionality breaks.
✨ **Result:** A cleaner, more modular `GlobalHistoryModal.tsx` file with better separation of concerns and easier-to-read JSX.
