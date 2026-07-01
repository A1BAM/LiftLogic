## 2025-05-14 - LogModal Numeric Input UX
**Learning:** Using string state for numeric inputs that allow decimals (like weight) is critical to prevent React from stripping the trailing decimal point while the user is typing (e.g., "135."). Additionally, `onFocus={(e) => e.target.select()}` provides a much smoother experience for overwriting values compared to manual deletion.
**Action:** Always prefer string state for decimal-capable numeric inputs and include auto-selection on focus for improved data entry speed.
