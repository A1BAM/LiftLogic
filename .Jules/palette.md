## 2025-05-15 - [autoFocus vs. Mobile UX]
**Learning:** While `autoFocus` should be avoided on numeric inputs (like reps/weight) to prevent the mobile keyboard from obscuring the UI or popping up uninvited, it remains essential for keyboard accessibility on primary text inputs (like password or exercise names) in modals.
**Action:** Always maintain `autoFocus` on the primary entry field of a modal if it is a text-based search or name field, ensuring immediate keyboard focus for desktop users while carefully omitting it from numeric fields that utilize the "Efficiency Trifecta" pattern.
