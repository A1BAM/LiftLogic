import { useState, useEffect, useCallback, useMemo } from 'react';
import { WorkoutLog, ExerciseDef, UserProfile } from '../types';
import { DEFINITION_ID } from '../constants';
import { workoutService } from '../services/workoutService';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';

export const useWorkoutData = (isAuthenticated: boolean) => {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [syncedExercises, setSyncedExercises] = useState<ExerciseDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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
        await Promise.all(missingFromCloud.map(exercise => saveDefinitionToCloud(exercise)));
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

    // Prepend to maintain descending chronological order (newest first)
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

    try {
      await workoutService.saveItems(importedLogs);
    } catch (err: any) {
      logger.error("Failed to import logs in bulk", err);
      throw new Error(`Import failed: ${err.message}`);
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


  const saveProfile = async (profile: { heightCm: number, weightLbs: number }) => {
    try {
      await workoutService.saveProfile(profile);
      setUserProfile({ id: 'global_user', ...profile });
    } catch (err) {
      logger.error("Failed to save profile", err);
      throw err;
    }
  };

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
    userProfile,
    saveProfile
  };
};
