#!/bin/bash
git -C liftlogic push -u origin test-save-exercise-error
gh pr create -R liftlogic --head test-save-exercise-error --title "🧪 [testing improvement] Add test for saveExercise error path" --body "🎯 **What**: Added missing test coverage for the API failure path in \`saveExercise\` within \`useWorkoutData.ts\`.
📊 **Coverage**: The scenario where \`saveDefinitionToCloud\` fails is now tested, verifying that the logger is called and the error is correctly re-thrown.
✨ **Result**: Improved test coverage and reliability for workout data synchronization."
