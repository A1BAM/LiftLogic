# Palette's Journal

## 2025-04-10 - Improving Focus Visibility in Dark Mode
**Learning:** In dark-themed interfaces like LiftLogic (using Slate-900), standard focus outlines can be hard to see. Using `focus-visible:ring-2 focus-visible:ring-blue-500` provides a high-contrast indicator that is much more accessible for keyboard users.
**Action:** Always include high-contrast `focus-visible` ring styles for interactive elements in dark themes.

## 2025-04-10 - Form Label Accessibility
**Learning:** Many form fields in the app were using `label` tags without `htmlFor` attributes, or just generic headings. This prevents screen readers from correctly associating labels with their inputs and reduces the clickable hit area for the labels.
**Action:** Use proper `htmlFor` and `id` associations for all form fields to ensure full accessibility and better UX.

## 2026-04-16 - Modal Accessibility Standardization
**Learning:** Consistently adding `aria-label="Close"` and high-contrast `focus-visible` rings to modal close buttons and other icon-only actions significantly improves keyboard and screen-reader accessibility in a dark-themed UI.
**Action:** Standardize modal headers with explicit ARIA labels and focus indicators for all navigation/dismissal elements.
