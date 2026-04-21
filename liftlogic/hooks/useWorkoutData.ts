import { useState, useEffect, useCallback, useMemo } from 'react';
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

  const saveDefinitionToCloud = async (exercise: ExerciseDef) => {
    const payload = {
      id: `def_${exercise.id}`,
      exerciseId: DEFINITION_ID,
      timestamp: Date.now(),
      weight: 0,
      reps: 0,
      sets: 0,
      notes: JSON.stringify(exercise)
    };
    await workoutService.saveItem(payload);
  };

  const fetchDataAndSync = useCallback(async () => {
    try {
      setIsLoading(true);
      const allData = await workoutService.fetchWorkouts() as any[];

      const fetchedLogs = allData.filter((item: any) => item.exerciseId !== DEFINITION_ID);
      const fetchedDefinitions = allData.filter((item: any) => item.exerciseId === DEFINITION_ID);

      const cloudExercises: ExerciseDef[] = fetchedDefinitions.map((def: any) => {
        try {
          return JSON.parse(def.notes);
        } catch (e) { return null; }
      }).filter(Boolean);

      const localExercises = workoutService.getLocalExercises();

      const cloudIds = new Set(cloudExercises.map(e => e.id));
      const missingFromCloud = localExercises.filter(e => !cloudIds.has(e.id));

      if (missingFromCloud.length > 0) {
        logger.info("Syncing up exercises to cloud:", missingFromCloud.length);
        await Promise.all(missingFromCloud.map(exercise => saveDefinitionToCloud(exercise)));
      }

      const mergedExercises = [...cloudExercises, ...missingFromCloud];
      const uniqueExercises = Array.from(new Map(mergedExercises.map(e => [e.id, e])).values());

      setSyncedExercises(uniqueExercises);
      // Sort logs descending (newest first) once at fetch time
      setLogs(fetchedLogs.sort((a, b) => b.timestamp - a.timestamp));
      workoutService.setLocalExercises(uniqueExercises);
      setError(null);
    } catch (err: any) {
      logger.error("Fetch and sync error:", err);
      setError(err.message || "Could not load workout history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDataAndSync();
    }
  }, [isAuthenticated, fetchDataAndSync]);

  const addLog = async (exerciseId: string, weight: number, reps: number) => {
    const logToSave: WorkoutLog = {
      id: generateId(),
      exerciseId,
      timestamp: Date.now(),
      weight,
      reps,
      sets: 1
    };

    // Prepend new log to maintain descending order
    setLogs(prev => [logToSave, ...prev]);

    try {
      await workoutService.saveItem(logToSave);
    } catch (err) {
      logger.error("Failed to save log", err);
      fetchDataAndSync();
      throw err;
    }
  };

  const removeLog = async (logId: string) => {
    setLogs(prev => prev.filter(l => l.id !== logId));
    try {
      await workoutService.deleteItem({ id: logId });
    } catch (err) {
      logger.error("Failed to delete log", err);
      fetchDataAndSync();
      throw err;
    }
  };

  const updateLog = async (log: WorkoutLog) => {
    setLogs(prev => prev.map(l => l.id === log.id ? log : l));
    try {
      await workoutService.saveItem(log);
    } catch (err) {
      logger.error("Failed to update log", err);
      fetchDataAndSync();
      throw err;
    }
  };

  const importLogs = async (importedLogs: WorkoutLog[]) => {
    setLogs(prevLogs => {
      const logMap = new Map(prevLogs.map(l => [l.id, l]));
      importedLogs.forEach(l => logMap.set(l.id, l));
      // Sort after merge to maintain order
      return Array.from(logMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    });

    const results = await Promise.allSettled(
      importedLogs.map(log => workoutService.saveItem(log))
    );

    const errorCount = results.filter(r => r.status === 'rejected').length;
    if (errorCount > 0) {
      throw new Error(`Import finished with ${errorCount} errors.`);
    }
  };

  const saveExercise = async (exercise: ExerciseDef) => {
    const existingIndex = syncedExercises.findIndex(ex => ex.id === exercise.id);
    let updatedSynced;
    if (existingIndex >= 0) {
      updatedSynced = syncedExercises.map(ex => ex.id === exercise.id ? exercise : ex);
    } else {
      updatedSynced = [...syncedExercises, exercise];
    }

    setSyncedExercises(updatedSynced);
    workoutService.setLocalExercises(updatedSynced);

    try {
      await saveDefinitionToCloud(exercise);
    } catch (err) {
      logger.error("Failed to sync exercise to cloud", err);
      throw err;
    }
  };

  const deleteExercisePermanently = async (exerciseId: string) => {
    const updatedSynced = syncedExercises.filter(e => e.id !== exerciseId);
    setSyncedExercises(updatedSynced);
    workoutService.setLocalExercises(updatedSynced);
    setLogs(prev => prev.filter(l => l.exerciseId !== exerciseId));

    try {
      await workoutService.deleteItem({ exerciseId });
      await workoutService.deleteItem({ id: `def_${exerciseId}` });
    } catch (err) {
      logger.error("Failed to delete exercise from cloud", err);
      throw err;
    }
  };

  // Group logs by exercise ID once when logs change
  // Provides O(1) retrieval for components instead of O(L) filtering
  const logsByExercise = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    logs.forEach(log => {
      const list = map.get(log.exerciseId) || [];
      list.push(log);
      map.set(log.exerciseId, list);
    });
    return map;
  }, [logs]);

  const getLogsForExercise = useCallback((id: string) => {
    return logsByExercise.get(id) || [];
  }, [logsByExercise]);

  const getTodaysLogs = useCallback((id: string) => {
    const all = getLogsForExercise(id);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const results: WorkoutLog[] = [];
    // Since logs are sorted newest first, we can stop once we're before today
    for (const log of all) {
      if (log.timestamp < startOfDay) break;
      if (log.timestamp < endOfDay) {
        results.push(log);
      }
    }
    // Result expected to be oldest-first for the "Today's Sets" list UI
    return results.reverse();
  }, [getLogsForExercise]);

  const getLastSessionLogs = useCallback((id: string) => {
    const all = getLogsForExercise(id);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const lastLogNotToday = all.find(l => l.timestamp < startOfToday);
    if (!lastLogNotToday) return [];

    const d = new Date(lastLogNotToday.timestamp);
    const startOfLastDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endOfLastDay = startOfLastDay + 24 * 60 * 60 * 1000;

    const results: WorkoutLog[] = [];
    // Leverages sorted order to early-exit once we pass the target day
    for (const log of all) {
      if (log.timestamp < startOfLastDay) break;
      if (log.timestamp < endOfLastDay) {
        results.push(log);
      }
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
    getLastSessionLogs
  };
};
