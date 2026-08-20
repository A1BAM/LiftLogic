import { useState, useCallback, useMemo, useRef } from 'react';
import { WorkoutLog } from '../types';
import { workoutService } from '../services/workoutService';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';

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
    // logs is already maintained in descending chronological order (newest first)
    // enabling early-exit optimizations in consumers like getTodaysLogs.
    for (const log of logs) {
      if (!map.has(log.exerciseId)) {
        map.set(log.exerciseId, []);
      }
      map.get(log.exerciseId)!.push(log);
    }
    return map;
  }, [logs]);

  const getLogsForExercise = useCallback((id: string) => {
    return logsByExercise.get(id) || [];
  }, [logsByExercise]);

  // Cache day boundaries to avoid redundant Date allocations on every render
  const todayCache = useRef<{ startOfDay: number, endOfDay: number, timestamp: number } | null>(null);

  const getDayBoundaries = useCallback(() => {
    const nowTimestamp = Date.now();
    // Cache valid for 1 minute to handle midnight crossing while avoiding per-render allocations
    if (!todayCache.current || nowTimestamp - todayCache.current.timestamp > 60000) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      todayCache.current = {
        startOfDay,
        endOfDay,
        timestamp: nowTimestamp
      };
    }
    return todayCache.current;
  }, []);

  const getTodaysLogs = useCallback((id: string) => {
    const { startOfDay, endOfDay } = getDayBoundaries();

    const exerciseLogs = getLogsForExercise(id);
    const results: WorkoutLog[] = [];

    // Early-exit loop on pre-sorted logs
    for (const log of exerciseLogs) {
      if (log.timestamp >= endOfDay) continue; // Future logs (safety)
      if (log.timestamp < startOfDay) break; // Reached previous days
      results.push(log);
    }

    // Return in ascending order (oldest first) as expected by the UI
    return results.reverse();
  }, [getLogsForExercise, getDayBoundaries]);

  const getLastSessionLogs = useCallback((id: string) => {
    const exerciseLogs = getLogsForExercise(id);
    const { startOfDay: startOfToday } = getDayBoundaries();

    // Find the first log before today
    const lastLogIndex = exerciseLogs.findIndex(l => l.timestamp < startOfToday);
    if (lastLogIndex === -1) return [];

    const lastLog = exerciseLogs[lastLogIndex];
    const d = new Date(lastLog.timestamp);
    const startOfLastDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    const results: WorkoutLog[] = [];
    // Early-exit loop on pre-sorted logs starting from the session found
    for (let i = lastLogIndex; i < exerciseLogs.length; i++) {
      const log = exerciseLogs[i];
      if (log.timestamp < startOfLastDay) break;
      results.push(log);
    }

    return results;
  }, [getLogsForExercise, getDayBoundaries]);

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
