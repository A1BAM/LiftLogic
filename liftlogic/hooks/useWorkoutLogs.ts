import { useState, useCallback, useMemo } from 'react';
import { WorkoutLog } from '../types';
import { workoutService } from '../services/workoutService';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';
import { getLocalDateKey, getLocalDayBounds } from '../utils/date';

export const useWorkoutLogs = (fetchDataAndSync: () => Promise<void>) => {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  const addLog = useCallback(async (exerciseId: string, weight: number, reps: number) => {
    const logToSave: WorkoutLog = {
      id: generateId(),
      exerciseId,
      timestamp: Date.now(),
      weight,
      reps,
      sets: 1
    };

    // Prepend to maintain descending chronological order (newest first)
    setLogs(prev => [logToSave, ...prev]);

    try {
      await workoutService.saveItem(logToSave);
    } catch (err) {
      logger.error("Failed to save log", err);
      fetchDataAndSync();
      throw err;
    }
  }, [fetchDataAndSync]);

  const removeLog = useCallback(async (logId: string) => {
    setLogs(prev => prev.filter(l => l.id !== logId));
    try {
      await workoutService.deleteItem({ id: logId });
    } catch (err) {
      logger.error("Failed to delete log", err);
      fetchDataAndSync();
      throw err;
    }
  }, [fetchDataAndSync]);

  const updateLog = useCallback(async (log: WorkoutLog) => {
    setLogs(prev => prev.map(l => l.id === log.id ? log : l));
    try {
      await workoutService.saveItem(log);
    } catch (err) {
      logger.error("Failed to update log", err);
      fetchDataAndSync();
      throw err;
    }
  }, [fetchDataAndSync]);

  const importLogs = useCallback(async (importedLogs: WorkoutLog[]) => {
    setLogs(prevLogs => {
      const importedMap = new Map(importedLogs.map(l => [l.id, l]));
      const merged = prevLogs.filter(l => !importedMap.has(l.id)).concat(Array.from(importedMap.values()));
      return merged.sort((a, b) => b.timestamp - a.timestamp);
    });

    try {
      await workoutService.saveItems(importedLogs);
    } catch (err: unknown) {
      throw new Error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Memoize logs grouped by exercise ID for O(1) retrieval
  const logsByExercise = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const log of logs) {
      if (!map.has(log.exerciseId)) {
        map.set(log.exerciseId, []);
      }
      map.get(log.exerciseId)!.push(log);
    }
    // Consumers (getTodaysLogs, getLastSessionLogs, ExerciseCard) early-exit on the
    // assumption that each bucket is in descending chronological order. Enforce it here
    // instead of assuming it: an edited timestamp or a partial update can otherwise leave
    // `logs` out of order, which silently truncates or merges sessions.
    for (const bucket of map.values()) {
      bucket.sort((a, b) => b.timestamp - a.timestamp);
    }
    return map;
  }, [logs]);

  const getLogsForExercise = useCallback((id: string) => {
    return logsByExercise.get(id) || [];
  }, [logsByExercise]);

  const getTodaysLogs = useCallback((id: string) => {
    const { start, end } = getLocalDayBounds();

    const exerciseLogs = getLogsForExercise(id);
    const results: WorkoutLog[] = [];

    // Early-exit loop on pre-sorted logs
    for (const log of exerciseLogs) {
      if (log.timestamp >= end) continue;
      if (log.timestamp < start) break;
      results.push(log);
    }

    // Return in ascending order (oldest first) as expected by the UI
    return results.reverse();
  }, [getLogsForExercise]);

  const getLastSessionLogs = useCallback((id: string) => {
    const exerciseLogs = getLogsForExercise(id);
    const { start: startOfToday } = getLocalDayBounds();

    // Find the first log before today
    const lastLogIndex = exerciseLogs.findIndex(l => l.timestamp < startOfToday);
    if (lastLogIndex === -1) return [];

    const lastSessionDate = getLocalDateKey(exerciseLogs[lastLogIndex].timestamp);

    const results: WorkoutLog[] = [];
    // Early-exit loop on pre-sorted logs starting from the session found
    for (let i = lastLogIndex; i < exerciseLogs.length; i++) {
      const log = exerciseLogs[i];
      if (getLocalDateKey(log.timestamp) !== lastSessionDate) break;
      results.push(log);
    }

    return results;
  }, [getLogsForExercise]);

  return {
    logs,
    setLogs,
    addLog,
    removeLog,
    updateLog,
    importLogs,
    getLogsForExercise,
    getTodaysLogs,
    getLastSessionLogs
  };
};
