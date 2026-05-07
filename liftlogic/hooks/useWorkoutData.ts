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

  // Group logs by exercise ID for O(1) retrieval
  // Since logs is pre-sorted (newest first), the arrays in the map will also be newest-first
  const logsByExercise = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const log of logs) {
      if (!map.has(log.exerciseId)) {
        map.set(log.exerciseId, []);
      }
      map.get(log.exerciseId)!.push(log);
    }
    return map;
  }, [logs]);

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
      // Keep logs sorted descending (newest first)
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

    // Prepend new log to maintain newest-first order
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

  const getLogsForExercise = useCallback((id: string) => {
    return logsByExercise.get(id) || [];
  }, [logsByExercise]);

  const getTodaysLogs = useCallback((id: string) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const all = getLogsForExercise(id);
    const todays: WorkoutLog[] = [];

    // Efficient early-exit loop for sorted logs
    for (const log of all) {
      if (log.timestamp < startOfDay) break;
      if (log.timestamp < endOfDay) todays.push(log);
    }

    return todays.reverse(); // Match original behavior (oldest first for today)
  }, [getLogsForExercise]);

  const getLastSessionLogs = useCallback((id: string) => {
    const all = getLogsForExercise(id);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // 1. Find the first log before today (newest pre-today log)
    const lastLogNotToday = all.find(l => l.timestamp < startOfToday);
    if (!lastLogNotToday) return [];

    // 2. Determine day boundaries for that last log
    const d = new Date(lastLogNotToday.timestamp);
    const startOfLastDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endOfLastDay = startOfLastDay + 24 * 60 * 60 * 1000;

    // 3. Extract all logs from that specific day using early-exit
    const lastSessionLogs: WorkoutLog[] = [];
    for (const log of all) {
      if (log.timestamp < startOfLastDay) break;
      if (log.timestamp < endOfLastDay) {
        lastSessionLogs.push(log);
      }
    }

    return lastSessionLogs;
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
