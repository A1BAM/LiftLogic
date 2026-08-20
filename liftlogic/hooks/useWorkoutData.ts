import { useState, useEffect, useCallback } from 'react';
import { WorkoutLog, ExerciseDef } from '../types';
import { DEFINITION_ID } from '../constants';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';
import { useWorkoutExercises } from './useWorkoutExercises';
import { useWorkoutLogs } from './useWorkoutLogs';

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

export const useWorkoutData = (isAuthenticated: boolean) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forward declaration for mutual dependency
  let fetchDataAndSyncFn: () => Promise<void>;

  const {
    logs,
    setLogs,
    addLog,
    removeLog,
    updateLog,
    importLogs,
    getLogsForExercise,
    getTodaysLogs,
    getLastSessionLogs
  } = useWorkoutLogs(() => fetchDataAndSyncFn());

  const {
    syncedExercises,
    setSyncedExercises,
    saveDefinitionsToCloud,
    saveExercise,
    saveExercises,
    deleteExercisePermanently
  } = useWorkoutExercises(setLogs);

  const fetchDataAndSync = useCallback(async () => {
    try {
      setIsLoading(true);
      const allData = await workoutService.fetchWorkouts() as WorkoutLog[];

      const { fetchedLogs, cloudExercises, cloudIds } = parseFetchedData(allData);

      const localExercises = exerciseService.getLocalExercises();
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
      exerciseService.setLocalExercises(uniqueExercises);
      setError(null);
    } catch (err: unknown) {
      logger.error("Fetch and sync error:", err);
      setError(err instanceof Error ? err.message : "Could not load workout history.");
    } finally {
      setIsLoading(false);
    }
  }, [saveDefinitionsToCloud, setSyncedExercises, setLogs]);

  // Resolve the forward declaration
  fetchDataAndSyncFn = fetchDataAndSync;

  useEffect(() => {
    if (isAuthenticated) {
      fetchDataAndSync();
    }
  }, [isAuthenticated, fetchDataAndSync]);

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
