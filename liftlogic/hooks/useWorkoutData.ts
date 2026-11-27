import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkoutLog, ExerciseDef } from '../types';
import { DEFINITION_ID } from '../constants';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
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

export const useWorkoutData = (signal: AbortSignal) => {
  const [isLoading, setIsLoading] = useState(false);
  // False until the first fetch has answered, one way or the other. Before
  // that there is no history to show, only the absence of one.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The logs hook re-syncs from the cloud when a write fails, and the sync
  // itself needs the logs hook. A ref breaks that cycle without handing the
  // logs hook a new function on every render, which would rebuild addLog,
  // removeLog and updateLog each time and undo their memoisation.
  const fetchDataAndSyncRef = useRef<() => Promise<void>>(async () => {});
  const resyncOnFailure = useCallback(() => fetchDataAndSyncRef.current(), []);

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
  } = useWorkoutLogs(resyncOnFailure, signal);

  const {
    syncedExercises,
    setSyncedExercises,
    saveDefinitionsToCloud,
    saveExercise,
    saveExercises,
    deleteExercisePermanently
  } = useWorkoutExercises(setLogs, signal);

  const fetchDataAndSync = useCallback(async () => {
    try {
      setIsLoading(true);
      const allData = await workoutService.fetchWorkouts(signal) as WorkoutLog[];
      if (signal.aborted) return;

      const { fetchedLogs, cloudExercises, cloudIds } = parseFetchedData(allData);

      const localExercises = exerciseService.getLocalExercises();
      const missingFromCloud = getMissingLocalExercises(localExercises, cloudIds);

      if (missingFromCloud.length > 0) {
        logger.info("Syncing up exercises to cloud:", missingFromCloud.length);
        await saveDefinitionsToCloud(missingFromCloud);
        if (signal.aborted) return;
      }

      const mergedExercises = [...cloudExercises, ...missingFromCloud];
      const uniqueExercises = Array.from(new Map(mergedExercises.map(e => [e.id, e])).values());

      setSyncedExercises(uniqueExercises);
      // Maintain descending chronological order (newest first)
      setLogs(fetchedLogs.sort((a, b) => b.timestamp - a.timestamp));
      exerciseService.setLocalExercises(uniqueExercises);
      setError(null);
    } catch (err: unknown) {
      if (signal.aborted) return;
      logger.error("Fetch and sync error:", err);
      setError(err instanceof Error ? err.message : "Could not load workout history.");
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [signal, saveDefinitionsToCloud, setSyncedExercises, setLogs]);

  // Keep the ref pointing at the current sync for the next failed write.
  fetchDataAndSyncRef.current = fetchDataAndSync;

  useEffect(() => {
    fetchDataAndSync();
  }, [fetchDataAndSync]);

  return {
    logs,
    syncedExercises,
    isLoading,
    hasLoaded,
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
