## 2025-05-14 - LogModal Data Entry Enhancements
**Learning:** For numeric inputs that require high efficiency (like workout logging), combining `autoFocus`, `inputMode`, and `onFocus={e => e.target.select()}` creates a seamless experience that reduces friction on both mobile and desktop.
**Action:** Always implement this "efficiency trifecta" for numeric log fields to ensure users can quickly overwrite or adjust values with minimal taps/clicks.

## 2026-08-13 - Workout Progress Card Indicator
**Learning:** Adding a workout progress bar increases user motivation and clarity. Integrating detailed screen-reader ARIA landmarks and progress attributes (`role="region"`, `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`) ensures that the state transition and visual percentage are fully accessible to assistive technologies without cluttering the screen for sighted users.
**Action:** Always pair visual status tracking indicators with robust ARIA landmarks and dynamic helper micro-copy based on state boundaries.
