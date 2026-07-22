import { WorkoutLog } from '../types';

function validateWorkoutLogItem(item: any, i: number): void {
  const indexStr = `at index ${i}`;

  if (typeof item !== 'object' || item === null) {
    throw new Error(`Invalid data: Item ${indexStr} is not an object.`);
  }

  // Required fields validation
  if (typeof item.id !== 'string' || !item.id.trim()) {
    throw new Error(`Invalid data: Item ${indexStr} is missing a valid 'id'.`);
  }
  if (item.id.length > 50) {
    throw new Error(`Invalid data: Item ${indexStr} 'id' is too long (max 50 chars).`);
  }

  if (typeof item.exerciseId !== 'string' || !item.exerciseId.trim()) {
    throw new Error(`Invalid data: Item ${indexStr} is missing a valid 'exerciseId'.`);
  }
  if (item.exerciseId.length > 50) {
    throw new Error(`Invalid data: Item ${indexStr} 'exerciseId' is too long (max 50 chars).`);
  }

  if (typeof item.timestamp !== 'number' || isNaN(item.timestamp) || item.timestamp <= 0) {
    throw new Error(`Invalid data: Item ${indexStr} has an invalid 'timestamp'.`);
  }

  if (typeof item.weight !== 'number' || isNaN(item.weight) || item.weight < 0) {
    throw new Error(`Invalid data: Item ${indexStr} has an invalid 'weight'.`);
  }

  if (typeof item.reps !== 'number' || isNaN(item.reps) || item.reps < 0) {
    throw new Error(`Invalid data: Item ${indexStr} has an invalid 'reps'.`);
  }

  if (typeof item.sets !== 'number' || isNaN(item.sets) || item.sets < 0) {
    throw new Error(`Invalid data: Item ${indexStr} has an invalid 'sets'.`);
  }

  // Optional fields validation
  if (item.notes !== undefined && item.notes !== null) {
    if (typeof item.notes !== 'string') {
      throw new Error(`Invalid data: Item ${indexStr} 'notes' must be a string.`);
    }
    if (item.notes.length > 500) {
      throw new Error(`Invalid data: Item ${indexStr} 'notes' is too long (max 500 chars).`);
    }
  }
}

/**
 * Validates an array of workout logs to ensure they meet the WorkoutLog interface requirements.
 * Throws an error if any item is invalid.
 */
export function validateWorkoutLogs(data: any): WorkoutLog[] {
  if (!Array.isArray(data)) {
    throw new Error("Data must be a list (array) of workouts.");
  }

  if (data.length > 10000) {
    throw new Error("Import failed: Too many logs (max 10,000).");
  }

  for (let i = 0; i < data.length; i++) {
    validateWorkoutLogItem(data[i], i);
  }

  return data as WorkoutLog[];
}
