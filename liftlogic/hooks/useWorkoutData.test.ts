import { describe, it, expect, vi } from 'vitest';
import { WorkoutLog } from '../types';

// Simplified Map simulation for testing
const getLogsByExerciseMap = (logs: WorkoutLog[]) => {
  const map = new Map<string, WorkoutLog[]>();
  logs.forEach(log => {
    if (!map.has(log.exerciseId)) {
      map.set(log.exerciseId, []);
    }
    map.get(log.exerciseId)!.push(log);
  });
  return map;
};

const getLogsForExercise = (map: Map<string, WorkoutLog[]>, id: string) => {
  return map.get(id) || [];
};

const getTodaysLogs = (map: Map<string, WorkoutLog[]>, id: string) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  const exerciseLogs = map.get(id) || [];
  const results: WorkoutLog[] = [];

  for (const log of exerciseLogs) {
    if (log.timestamp >= startOfDay && log.timestamp < endOfDay) {
      results.push(log);
    } else if (log.timestamp < startOfDay) {
      break;
    }
  }
  return results.reverse();
};

const getLastSessionLogs = (map: Map<string, WorkoutLog[]>, id: string) => {
  const exerciseLogs = map.get(id) || [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const lastLogNotToday = exerciseLogs.find(l => l.timestamp < startOfToday);
  if (!lastLogNotToday) return [];

  const d = new Date(lastLogNotToday.timestamp);
  const startOfLastDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endOfLastDay = startOfLastDay + 24 * 60 * 60 * 1000;

  const results: WorkoutLog[] = [];
  for (const log of exerciseLogs) {
    if (log.timestamp >= startOfLastDay && log.timestamp < endOfLastDay) {
      results.push(log);
    } else if (log.timestamp < startOfLastDay) {
      break;
    }
  }
  return results;
};

describe('useWorkoutData optimized filtering logic', () => {
  const exerciseId = 'test-ex';
  const now = new Date(2024, 0, 15, 12, 0, 0).getTime(); // Jan 15, 2024, 12:00
  const startOfToday = new Date(2024, 0, 15, 0, 0, 0).getTime();
  const startOfYesterday = new Date(2024, 0, 14, 0, 0, 0).getTime();

  vi.setSystemTime(now);

  // Pre-sorted descending as it would be in the hook
  const logs: WorkoutLog[] = [
    { id: '2', exerciseId, timestamp: startOfToday + 2000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '1', exerciseId, timestamp: startOfToday + 1000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '4', exerciseId, timestamp: startOfYesterday + 2000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '3', exerciseId, timestamp: startOfYesterday + 1000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '5', exerciseId, timestamp: startOfYesterday - 1000, weight: 80, reps: 10, sets: 1 }, // Day before yesterday
  ];

  const map = getLogsByExerciseMap(logs);

  it('getTodaysLogs returns only logs from today in reverse chronological order (original reverse = ascending by timestamp)', () => {
    // In original code: logs.filter(today).reverse().
    // If logs are [newest...oldest], filter(today) gives [newest_today...oldest_today].
    // reverse() gives [oldest_today...newest_today]
    const result = getTodaysLogs(map, exerciseId);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
  });

  it('getLastSessionLogs returns logs from the most recent session before today', () => {
    const result = getLastSessionLogs(map, exerciseId);
    expect(result).toHaveLength(2);
    expect(result.every(l => l.weight === 90)).toBe(true);
    expect(result[0].id).toBe('4');
    expect(result[1].id).toBe('3');
  });

  it('getLastSessionLogs returns empty array if no logs before today', () => {
    const todayOnlyLogs = logs.filter(l => l.timestamp >= startOfToday);
    const result = getLastSessionLogs(getLogsByExerciseMap(todayOnlyLogs), exerciseId);
    expect(result).toHaveLength(0);
  });
});
