# Palette's Journal

## 2025-04-10 - Improving Focus Visibility in Dark Mode
**Learning:** In dark-themed interfaces like LiftLogic (using Slate-900), standard focus outlines can be hard to see. Using `focus-visible:ring-2 focus-visible:ring-blue-500` provides a high-contrast indicator that is much more accessible for keyboard users.
**Action:** Always include high-contrast `focus-visible` ring styles for interactive elements in dark themes.

## 2025-04-10 - Form Label Accessibility
**Learning:** Many form fields in the app were using `label` tags without `htmlFor` attributes, or just generic headings. This prevents screen readers from correctly associating labels with their inputs and reduces the clickable hit area for the labels.
**Action:** Use proper `htmlFor` and `id` associations for all form fields to ensure full accessibility and better UX.

## 2025-05-15 - Standardizing Interactive Feedback and Controls
**Learning:** Icon-only buttons MUST have explicit `aria-label` attributes to be accessible. Standardizing these across the app (especially Close, Restore, and Delete buttons) ensures a predictable experience for screen reader users. Additionally, providing subtle haptic feedback (`navigator.vibrate?.(10)`) on mobile devices significantly enhances the "tactile" feel of the UI during rapid interactions like logging sets.
**Action:** Always verify `aria-label` on icon-only buttons and implement subtle haptic feedback for primary user actions to improve mobile UX.
