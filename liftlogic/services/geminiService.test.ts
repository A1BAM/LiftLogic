import { getWorkoutInsight } from './geminiService';
import { WorkoutLog, ExerciseDef } from '../types';

jest.mock('@google/genai');

describe('getWorkoutInsight', () => {
  const originalEnv = process.env;

  const mockExercise: ExerciseDef = {
    id: 'chest-press-id',
    name: 'Chest Press',
    muscleGroup: 'Chest',
    defaultWeight: 100,
    increment: 5,
    targetReps: 12,
    dayType: 'PUSH',
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.API_KEY = 'test-api-key';
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return a message when there is no workout history for an exercise', async () => {
    const logs: WorkoutLog[] = [];
    const result = await getWorkoutInsight(logs, mockExercise);

    expect(result).toBe("No history yet. Complete a workout to get AI insights!");
  });

  it('should return a message when there are no matching logs for the exercise', async () => {
    const logs: WorkoutLog[] = [
      {
        id: '1',
        exerciseId: 'different-id',
        timestamp: Date.now(),
        weight: 50,
        reps: 10,
        sets: 3,
      },
    ];
    const result = await getWorkoutInsight(logs, mockExercise);

    expect(result).toBe("No history yet. Complete a workout to get AI insights!");
  });
});
