## 2026-05-14 - Improving Type Safety in useWorkoutData
**Learning:** Explicitly typing API responses and callback parameters improves maintainability by allowing the TypeScript compiler to catch potential property mismatches early. In this case, replacing 'any' with 'WorkoutLog' confirms that the 'notes' field (used for ExerciseDef serialization) is correctly handled.
**Action:** Always prefer explicit types over 'any' when the shape of the data is known, especially for shared hooks and services.
