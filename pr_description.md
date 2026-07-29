🎯 **What:** Replaced the `any` type with `unknown` for the incoming data payload in `validateWorkoutLogs` and `validateWorkoutLogItem` within `liftlogic/utils/validation.ts`.

💡 **Why:** Using `unknown` is safer for runtime validation logic. It forces proper type narrowing before property access (which we achieve by casting the verified object to `Record<string, unknown>`), eliminating implicit `any` behavior, satisfying TypeScript compiler constraints, and making the validation stricter and more readable.

✅ **Verification:**
- Type checked via `pnpm exec tsc --noEmit`. (Passed)
- Ran the full unit test suite via `pnpm test`. (Passed)

✨ **Result:** Improved type safety and maintainability without altering runtime behavior or breaking existing tests.
