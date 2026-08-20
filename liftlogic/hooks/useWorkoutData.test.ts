
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { WorkoutLog } from '../types';
import { renderHook, waitFor } from '@testing-library/react';
import { useWorkoutData } from './useWorkoutData';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import { logger } from '../utils/logger';
import { DEFINITION_ID } from '../constants';
describe('useWorkoutData filtering logic', () => {
  const exerciseId = 'test-ex';
  const now = new Date(2024, 0, 15, 12, 0, 0).getTime(); // Jan 15, 2024, 12:00
  const startOfToday = new Date(2024, 0, 15, 0, 0, 0).getTime();
  const startOfYesterday = new Date(2024, 0, 14, 0, 0, 0).getTime();

  const logs: WorkoutLog[] = [
    // Intentionally unsorted to verify that fetched API data is normalized by the hook.
    { id: '1', exerciseId, timestamp: startOfToday + 1000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '2', exerciseId, timestamp: startOfToday + 2000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '3', exerciseId, timestamp: startOfYesterday + 1000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '4', exerciseId, timestamp: startOfYesterday + 2000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '5', exerciseId, timestamp: startOfYesterday - 1000, weight: 80, reps: 10, sets: 1 }, // Day before yesterday
  ];

  beforeEach(() => {
    vi.setSystemTime(now);
    localStorage.clear();
    vi.spyOn(workoutService, 'fetchWorkouts').mockResolvedValue(logs);
    vi.spyOn(exerciseService, 'getLocalExercises').mockReturnValue([]);
    vi.spyOn(exerciseService, 'setLocalExercises').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('exposes normalized today and previous-session logs through the real hook', async () => {
    const { result } = renderHook(() => useWorkoutData(true));

    await waitFor(() => expect(result.current.logs).toHaveLength(logs.length));

    expect(result.current.getTodaysLogs(exerciseId).map(log => log.id)).toEqual(['1', '2']);
    expect(result.current.getLastSessionLogs(exerciseId).map(log => log.id)).toEqual(['4', '3']);
  });

  it('returns no previous session when the API only returns today\'s logs', async () => {
    vi.mocked(workoutService.fetchWorkouts).mockResolvedValue(
      logs.filter(log => log.timestamp >= startOfToday)
    );
    const { result } = renderHook(() => useWorkoutData(true));

    await waitFor(() => expect(result.current.logs).toHaveLength(2));

    expect(result.current.getLastSessionLogs(exerciseId)).toEqual([]);
  });

  it('uses the next local midnight as today\'s upper boundary', async () => {
    const lateToday = new Date(2024, 2, 10, 23, 30).getTime();
    const earlyTomorrow = new Date(2024, 2, 11, 0, 30).getTime();
    vi.setSystemTime(new Date(2024, 2, 10, 23, 45));
    vi.mocked(workoutService.fetchWorkouts).mockResolvedValue([
      { id: 'tomorrow', exerciseId, timestamp: earlyTomorrow, weight: 100, reps: 10, sets: 1 },
      { id: 'today', exerciseId, timestamp: lateToday, weight: 100, reps: 10, sets: 1 },
    ]);
    const { result } = renderHook(() => useWorkoutData(true));

    await waitFor(() => expect(result.current.logs).toHaveLength(2));

    expect(result.current.getTodaysLogs(exerciseId).map(log => log.id)).toEqual(['today']);
  });
});

describe('useWorkoutData fetching logic', () => {
  it('ignores malformed JSON definitions gracefully and parses remaining valid definitions', async () => {
    // Mock workoutService to return a mix of valid data and a malformed definition
    vi.spyOn(workoutService, 'fetchWorkouts').mockResolvedValue([
      {
        id: 'def_valid1',
        exerciseId: DEFINITION_ID,
        timestamp: 123,
        weight: 0,
        reps: 0,
        sets: 0,
        notes: JSON.stringify({ id: 'valid1', name: 'Valid Exercise 1' })
      },
      {
        id: 'bad-def',
        exerciseId: DEFINITION_ID,
        timestamp: 123,
        weight: 0,
        reps: 0,
        sets: 0,
        notes: 'this is not valid json'
      },
      {
        id: 'def_valid2',
        exerciseId: DEFINITION_ID,
        timestamp: 123,
        weight: 0,
        reps: 0,
        sets: 0,
        notes: JSON.stringify({ id: 'valid2', name: 'Valid Exercise 2' })
      }
    ]);

    // Mock getLocalExercises to prevent unrelated syncing behavior
    vi.spyOn(exerciseService, 'getLocalExercises').mockReturnValue([]);
    vi.spyOn(exerciseService, 'setLocalExercises').mockImplementation(() => {});

    const { result } = renderHook(() => useWorkoutData(true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.syncedExercises).toEqual([
      { id: 'valid1', name: 'Valid Exercise 1' },
      { id: 'valid2', name: 'Valid Exercise 2' }
    ]);
    expect(result.current.error).toBeNull(); // No error thrown or captured due to JSON.parse failure
  });

  it('throws wrapped error when importLogs API fails', async () => {
    vi.spyOn(workoutService, 'fetchWorkouts').mockResolvedValue([]);
    vi.spyOn(exerciseService, 'getLocalExercises').mockReturnValue([]);
    vi.spyOn(exerciseService, 'setLocalExercises').mockImplementation(() => {});

    vi.spyOn(workoutService, 'saveItems').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWorkoutData(true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const mockLog = { id: 'import1', exerciseId: 'ex1', timestamp: 12345, weight: 100, reps: 5, sets: 1 };

    await expect(result.current.importLogs([mockLog])).rejects.toThrow('Import failed: Network error');
  });
});
