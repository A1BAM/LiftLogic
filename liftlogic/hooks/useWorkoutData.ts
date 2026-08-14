import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WorkoutLog, ExerciseDef } from '../types';
import { DEFINITION_ID } from '../constants';
import { workoutService } from '../services/workoutService';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';

const parseFetchedData = (allData: WorkoutLog[]) => {
  const fetchedLogs: WorkoutLog[] = [];
  const cloudExercises: ExerciseDef[] = [];
  const cloudIds = new Set<string>();

  // Optimization: Single-pass processing of fetched data
  for (const item of allData) {
    if (item.exerciseId === DEFINITION_ID) {
      const extractedId = item.id.startsWith('def_') ? item.id.slice(4) : null;
      if (extractedId && cloudIds.has(extractedId)) {
        continue; // Skip expensive JSON.parse if we already have this definition
      }

      const notes = item.notes;
      // Fast path: skip JSON.parse entirely if notes is empty or doesn't look like a JSON object
      if (!notes || notes.length < 2 || notes[0] !== '{') {
        if (extractedId) cloudIds.add(extractedId); // Avoid retrying this bad ID later
        continue;
      }

      try {
        const ex = JSON.parse(notes);
        if (ex && ex.id) {
          cloudExercises.push(ex);
          cloudIds.add(ex.id);
        }
        if (extractedId) cloudIds.add(extractedId); // Always track extractedId so we don't try it again
      } catch (e) {
        // Ignore malformed definitions
        if (extractedId) cloudIds.add(extractedId); // Mark as processed so we don't parse it again if duplicate
      }
    } else {
      fetchedLogs.push(item);
    }
  }

  return { fetchedLogs, cloudExercises, cloudIds };
};

const getMissingLocalExercises = (localExercises: ExerciseDef[], cloudIds: Set<string>) => {
  const missingFromCloud: ExerciseDef[] = [];
  for (const ex of localExercises) {
    if (!cloudIds.has(ex.id)) {
      missingFromCloud.push(ex);
    }
  }
  return missingFromCloud;
};


let cachedStartOfDay = 0;
let cachedEndOfDay = 0;

const getTodayBoundaries = () => {
  const now = Date.now();
  if (now < cachedStartOfDay || now >= cachedEndOfDay) {
    const d = new Date(now);
    cachedStartOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    cachedEndOfDay = cachedStartOfDay + 24 * 60 * 60 * 1000;
  }
  return { startOfDay: cachedStartOfDay, endOfDay: cachedEndOfDay };
};

export const useWorkoutData = (isAuthenticated: boolean) => {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [syncedExercises, setSyncedExercises] = useState<ExerciseDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveDefinitionsToCloud = useCallback(async (exercises: ExerciseDef[]) => {
    const payloads = exercises.map(exercise => ({
      id: `def_${exercise.id}`,
      exerciseId: DEFINITION_ID,
      timestamp: Date.now(),
      weight: 0,
      reps: 0,
      sets: 0,
      notes: JSON.stringify(exercise)
    }));
    if (payloads.length > 0) {
      await workoutService.saveItems(payloads);
    }
  }, []);

  const saveDefinitionToCloud = useCallback(async (exercise: ExerciseDef) => {
    await saveDefinitionsToCloud([exercise]);
  }, [saveDefinitionsToCloud]);

  const fetchDataAndSync = useCallback(async () => {
    try {
      setIsLoading(true);
      const allData = await workoutService.fetchWorkouts() as WorkoutLog[];

      const { fetchedLogs, cloudExercises, cloudIds } = parseFetchedData(allData);

      const localExercises = workoutService.getLocalExercises();
      const missingFromCloud = getMissingLocalExercises(localExercises, cloudIds);

      if (missingFromCloud.length > 0) {
        logger.info("Syncing up exercises to cloud:", missingFromCloud.length);
        await saveDefinitionsToCloud(missingFromCloud);
      }

      const mergedExercises = [...cloudExercises, ...missingFromCloud];
      const uniqueExercises = Array.from(new Map(mergedExercises.map(e => [e.id, e])).values());

      setSyncedExercises(uniqueExercises);
      // Maintain descending chronological order (newest first)
      setLogs(fetchedLogs.sort((a, b) => b.timestamp - a.timestamp));
      workoutService.setLocalExercises(uniqueExercises);
      setError(null);
    } catch (err: unknown) {
      logger.error("Fetch and sync error:", err);
      setError(err instanceof Error ? err.message : "Could not load workout history.");
    } finally {
      setIsLoading(false);
    }
  }, [saveDefinitionsToCloud]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDataAndSync();
    }
  }, [isAuthenticated, fetchDataAndSync]);

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

  const saveExercises = useCallback(async (exercisesToSave: ExerciseDef[]) => {
    if (exercisesToSave.length === 0) return;

    setSyncedExercises(prevSynced => {
      const updatedMap = new Map(prevSynced.map(ex => [ex.id, ex]));
      exercisesToSave.forEach(ex => updatedMap.set(ex.id, ex));
      const updatedSynced = Array.from(updatedMap.values());
      workoutService.setLocalExercises(updatedSynced);
      return updatedSynced;
    });

    try {
      await saveDefinitionsToCloud(exercisesToSave);
    } catch (err) {
      logger.error("Failed to sync exercises to cloud", err);
      throw err;
    }
  }, [saveDefinitionsToCloud]);

  const saveExercise = useCallback(async (exercise: ExerciseDef) => {
    await saveExercises([exercise]);
  }, [saveExercises]);

  const deleteExercisePermanently = useCallback(async (exerciseId: string) => {
    setSyncedExercises(prevSynced => {
      const updatedSynced = prevSynced.filter(e => e.id !== exerciseId);
      workoutService.setLocalExercises(updatedSynced);
      return updatedSynced;
    });
    setLogs(prev => prev.filter(l => l.exerciseId !== exerciseId));

    try {
      await workoutService.deleteItem({ exerciseId });
      await workoutService.deleteItem({ id: `def_${exerciseId}` });
    } catch (err) {
      logger.error("Failed to delete exercise from cloud", err);
      throw err;
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
      todayCache.current = {
        startOfDay,
        endOfDay: startOfDay + 24 * 60 * 60 * 1000,
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
    const localOffsetMs = d.getTimezoneOffset() * 60000;
    const lastDayId = Math.floor((lastLog.timestamp - localOffsetMs) / 86400000);
    const startOfLastDay = lastDayId * 86400000 + localOffsetMs;

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
    syncedExercises,
    isLoading,
    error,
    fetchDataAndSync,
    addLog,
    removeLog,
    updateLog,
    importLogs,
    saveExercise,
    saveExercises,
    deleteExercisePermanently,
    getLogsForExercise,
    getTodaysLogs,

    getLastSessionLogs,
  };
};
