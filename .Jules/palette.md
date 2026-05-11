# Palette's Journal

## 2025-04-10 - Improving Focus Visibility in Dark Mode
**Learning:** In dark-themed interfaces like LiftLogic (using Slate-900), standard focus outlines can be hard to see. Using `focus-visible:ring-2 focus-visible:ring-blue-500` provides a high-contrast indicator that is much more accessible for keyboard users.
**Action:** Always include high-contrast `focus-visible` ring styles for interactive elements in dark themes.

## 2025-04-10 - Form Label Accessibility
**Learning:** Many form fields in the app were using `label` tags without `htmlFor` attributes, or just generic headings. This prevents screen readers from correctly associating labels with their inputs and reduces the clickable hit area for the labels.
**Action:** Use proper `htmlFor` and `id` associations for all form fields to ensure full accessibility and better UX.

## 2025-05-11 - Semantic Labels for Non-Interactive Displays
**Learning:** In stepper-style interfaces (like weight/reps in LogModal), using read-only `input` elements instead of `div` allows for proper semantic association with `label` tags via `htmlFor`. However, to avoid creating friction for keyboard users, these read-only inputs should have `tabIndex={-1}` so they are skipped in the tab order while still remaining accessible to screen readers.
**Action:** Use `input readOnly tabIndex={-1}` for labeled numeric displays that are controlled by external buttons.
