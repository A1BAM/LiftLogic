import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WorkoutLog, ExerciseDef } from '../types';
import { DEFINITION_ID } from '../constants';
import { workoutService } from '../services/workoutService';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';

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

      const fetchedLogs: WorkoutLog[] = [];
      const cloudExercises: ExerciseDef[] = [];
      const cloudIds = new Set<string>();

      // Optimization: Single-pass processing of fetched data
      for (const item of allData) {
        if (item.exerciseId === DEFINITION_ID) {
          try {
            const ex = JSON.parse(item.notes || "");
            if (ex && ex.id) {
              cloudExercises.push(ex);
              cloudIds.add(ex.id);
            }
          } catch (e) {
            // Ignore malformed definitions
          }
        } else {
          fetchedLogs.push(item);
        }
      }

      const localExercises = workoutService.getLocalExercises();
      const missingFromCloud: ExerciseDef[] = [];
      for (const ex of localExercises) {
        if (!cloudIds.has(ex.id)) {
          missingFromCloud.push(ex);
        }
      }

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
    } catch (err: any) {
      logger.error("Fetch and sync error:", err);
      setError(err.message || "Could not load workout history.");
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
      const logMap = new Map(prevLogs.map(l => [l.id, l]));
      importedLogs.forEach(l => logMap.set(l.id, l));
      return Array.from(logMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    });

    try {
      await workoutService.saveItems(importedLogs);
    } catch (err: any) {
      throw new Error(`Import failed: ${err.message}`);
    }
  }, []);

  const saveExercise = useCallback(async (exercise: ExerciseDef) => {
    setSyncedExercises(prev => {
      const existingIndex = prev.findIndex(ex => ex.id === exercise.id);
      let updatedSynced;
      if (existingIndex >= 0) {
        updatedSynced = prev.map(ex => ex.id === exercise.id ? exercise : ex);
      } else {
        updatedSynced = [...prev, exercise];
      }
      return updatedSynced;
    });

    try {
      // Perform side effects outside of the state updater
      const localEx = workoutService.getLocalExercises();
      const existingIdx = localEx.findIndex(ex => ex.id === exercise.id);
      let updatedLocal;
      if (existingIdx >= 0) {
        updatedLocal = localEx.map(ex => ex.id === exercise.id ? exercise : ex);
      } else {
        updatedLocal = [...localEx, exercise];
      }
      workoutService.setLocalExercises(updatedLocal);

      await saveDefinitionToCloud(exercise);
    } catch (err) {
      logger.error("Failed to sync exercise to cloud", err);
      throw err;
    }
  }, [saveDefinitionToCloud]);

  const deleteExercisePermanently = useCallback(async (exerciseId: string) => {
    setSyncedExercises(prev => prev.filter(e => e.id !== exerciseId));
    setLogs(prev => prev.filter(l => l.exerciseId !== exerciseId));

    try {
      // Side effect outside of updater
      const localEx = workoutService.getLocalExercises();
      workoutService.setLocalExercises(localEx.filter(e => e.id !== exerciseId));

      await workoutService.deleteItem({ exerciseId });
      await workoutService.deleteItem({ id: `def_${exerciseId}` });
    } catch (err) {
      logger.error("Failed to delete exercise from cloud", err);
      throw err;
    }
  }, []);

  // Cache to maintain referential stability for log arrays per exercise
  const logsByExerciseCache = useRef<Map<string, WorkoutLog[]>>(new Map());

  // Memoize logs grouped by exercise ID for O(1) retrieval
  const logsByExercise = useMemo(() => {
    const newMap = new Map<string, WorkoutLog[]>();
    // Group logs by exerciseId
    for (const log of logs) {
      if (!newMap.has(log.exerciseId)) {
        newMap.set(log.exerciseId, []);
      }
      newMap.get(log.exerciseId)!.push(log);
    }

    // Stabilize references: if the logs for an exercise haven't changed, reuse the old array
    const stabilizedMap = new Map<string, WorkoutLog[]>();
    newMap.forEach((newLogs, exerciseId) => {
      const prevLogs = logsByExerciseCache.current.get(exerciseId);
      if (prevLogs && prevLogs.length === newLogs.length && prevLogs.every((v, i) => v === newLogs[i])) {
        stabilizedMap.set(exerciseId, prevLogs);
      } else {
        stabilizedMap.set(exerciseId, newLogs);
      }
    });

    logsByExerciseCache.current = stabilizedMap;
    return stabilizedMap;
  }, [logs]);

  const getLogsForExercise = useCallback((id: string) => {
    return logsByExercise.get(id) || [];
  }, [logsByExercise]);

  const getTodaysLogs = useCallback((id: string) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

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
  }, [getLogsForExercise]);

  const getLastSessionLogs = useCallback((id: string) => {
    const exerciseLogs = getLogsForExercise(id);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

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
  }, [getLogsForExercise]);

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
    deleteExercisePermanently,
    getLogsForExercise,
    getTodaysLogs,
    getLastSessionLogs,
  };
};
