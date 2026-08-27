import { WorkoutLog } from '../types';

function validateWorkoutLogItem(item: unknown, i: number): void {
  const indexStr = `at index ${i}`;

  if (typeof item !== 'object' || item === null) {
    throw new Error(`Invalid data: Item ${indexStr} is not an object.`);
  }

  const obj = item as Record<string, unknown>;

  // Required fields validation
  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    throw new Error(`Invalid data: Item ${indexStr} is missing a valid 'id'.`);
  }
  if (obj.id.length > 50) {
    throw new Error(`Invalid data: Item ${indexStr} 'id' is too long (max 50 chars).`);
  }

  if (typeof obj.exerciseId !== 'string' || !obj.exerciseId.trim()) {
    throw new Error(`Invalid data: Item ${indexStr} is missing a valid 'exerciseId'.`);
  }
  if (obj.exerciseId.length > 50) {
    throw new Error(`Invalid data: Item ${indexStr} 'exerciseId' is too long (max 50 chars).`);
  }

  if (typeof obj.timestamp !== 'number' || isNaN(obj.timestamp) || obj.timestamp <= 0) {
    throw new Error(`Invalid data: Item ${indexStr} has an invalid 'timestamp'.`);
  }

  if (typeof obj.weight !== 'number' || isNaN(obj.weight) || obj.weight < 0 || obj.weight > 2000) {
    throw new Error(`Invalid data: Item ${indexStr} has an invalid 'weight'.`);
  }

  if (typeof obj.reps !== 'number' || isNaN(obj.reps) || obj.reps < 0 || obj.reps > 1000) {
    throw new Error(`Invalid data: Item ${indexStr} has an invalid 'reps'.`);
  }

  if (typeof obj.sets !== 'number' || isNaN(obj.sets) || obj.sets < 0 || obj.sets > 100) {
    throw new Error(`Invalid data: Item ${indexStr} has an invalid 'sets'.`);
  }

  // Optional fields validation
  if (obj.notes !== undefined && obj.notes !== null) {
    if (typeof obj.notes !== 'string') {
      throw new Error(`Invalid data: Item ${indexStr} 'notes' must be a string.`);
    }
    if (obj.notes.length > 500) {
      throw new Error(`Invalid data: Item ${indexStr} 'notes' is too long (max 500 chars).`);
    }
  }
}

/**
 * Validates an array of workout logs to ensure they meet the WorkoutLog interface requirements.
 * Throws an error if any item is invalid.
 */
export function validateWorkoutLogs(data: unknown): WorkoutLog[] {
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
