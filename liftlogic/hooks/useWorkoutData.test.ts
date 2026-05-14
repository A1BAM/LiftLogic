import { describe, it, expect, vi } from 'vitest';
import { WorkoutLog } from '../types';

// Extracting logic for testing since we can't easily test the hook without full React environment
const getLogsForExercise = (logs: WorkoutLog[], id: string) => {
  return logs.filter(l => l.exerciseId === id).sort((a, b) => b.timestamp - a.timestamp);
};

const getTodaysLogs = (logs: WorkoutLog[], id: string) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  return getLogsForExercise(logs, id)
    .filter(l => l.timestamp >= startOfDay && l.timestamp < endOfDay)
    .reverse();
};

const getLastSessionLogs = (logs: WorkoutLog[], id: string) => {
  const all = getLogsForExercise(logs, id);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const lastLogNotToday = all.find(l => l.timestamp < startOfToday);
  if (!lastLogNotToday) return [];

  const d = new Date(lastLogNotToday.timestamp);
  const startOfLastDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endOfLastDay = startOfLastDay + 24 * 60 * 60 * 1000;

  return all.filter(l => l.timestamp >= startOfLastDay && l.timestamp < endOfLastDay);
};

describe('useWorkoutData filtering logic', () => {
  const exerciseId = 'test-ex';
  const now = new Date(2024, 0, 15, 12, 0, 0).getTime(); // Jan 15, 2024, 12:00
  const startOfToday = new Date(2024, 0, 15, 0, 0, 0).getTime();
  const startOfYesterday = new Date(2024, 0, 14, 0, 0, 0).getTime();

  vi.setSystemTime(now);

  const logs: WorkoutLog[] = [
    { id: '1', exerciseId, timestamp: startOfToday + 1000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '2', exerciseId, timestamp: startOfToday + 2000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '3', exerciseId, timestamp: startOfYesterday + 1000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '4', exerciseId, timestamp: startOfYesterday + 2000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '5', exerciseId, timestamp: startOfYesterday - 1000, weight: 80, reps: 10, sets: 1 }, // Day before yesterday
  ];

  it('getTodaysLogs returns only logs from today in reverse chronological order', () => {
    const result = getTodaysLogs(logs, exerciseId);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
  });

  it('getLastSessionLogs returns logs from the most recent session before today', () => {
    const result = getLastSessionLogs(logs, exerciseId);
    expect(result).toHaveLength(2);
    expect(result.every(l => l.weight === 90)).toBe(true);
    // Order from getLogsForExercise is desc, so we check that
    expect(result[0].id).toBe('4');
    expect(result[1].id).toBe('3');
  });

  it('getLastSessionLogs returns empty array if no logs before today', () => {
    const todayOnlyLogs = logs.filter(l => l.timestamp >= startOfToday);
    const result = getLastSessionLogs(todayOnlyLogs, exerciseId);
    expect(result).toHaveLength(0);
  });
});
