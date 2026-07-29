## 2026-07-29 - Remove Date string conversions for today check
**Learning:** Instantiating `new Date()` and calling `.toDateString()` inside iteration blocks adds measurable overhead, especially when comparing against "today" in large arrays.
**Action:** Always prefer pre-computing integer representations (like day boundaries via `Math.floor()`) outside loops and comparing against derived integer values inside loops to prevent redundant object allocations and string processing.
