## 2024-04-12 - Single-pass journal statistics optimization
**Learning:** In React components processing large history arrays (like workout logs), multi-pass functional chains (`filter` -> `map` -> `Set` -> `reduce`) and repeated expensive string date formatting (`toDateString()`) can become a bottleneck. Using numeric day identifiers (`YYYYMMDD`) and a single `for...of` loop significantly reduces overhead.
**Action:** Favor single-pass loops and numeric comparisons for data grouping and statistics calculations in performance-sensitive components.
