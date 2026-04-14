# Palette's Journal

## 2025-04-10 - Improving Focus Visibility in Dark Mode
**Learning:** In dark-themed interfaces like LiftLogic (using Slate-900), standard focus outlines can be hard to see. Using `focus-visible:ring-2 focus-visible:ring-blue-500` provides a high-contrast indicator that is much more accessible for keyboard users.
**Action:** Always include high-contrast `focus-visible` ring styles for interactive elements in dark themes.

## 2025-04-10 - Form Label Accessibility
**Learning:** Many form fields in the app were using `label` tags without `htmlFor` attributes, or just generic headings. This prevents screen readers from correctly associating labels with their inputs and reduces the clickable hit area for the labels.
**Action:** Use proper `htmlFor` and `id` associations for all form fields to ensure full accessibility and better UX.

## 2026-04-14 - Standardizing Modal Accessibility and Polish
**Learning:** Modals across the app were inconsistent in their close button styling, ARIA labeling, and entry animations. Standardizing on `animate-in fade-in duration-200` for backdrops and a specific tailwind class set for close buttons ensures a predictable and high-quality user experience.
**Action:** Use the standardized close button pattern (`p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors` + `aria-label="Close"`) and backdrop animation for all new modal components.
