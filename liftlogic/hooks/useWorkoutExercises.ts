import { useState, useCallback } from 'react';
import { ExerciseDef } from '../types';
import { DEFINITION_ID } from '../constants';
import { workoutService } from '../services/workoutService';
import { logger } from '../utils/logger';

export const useWorkoutExercises = (setLogs: React.Dispatch<React.SetStateAction<import('../types').WorkoutLog[]>>) => {
  const [syncedExercises, setSyncedExercises] = useState<ExerciseDef[]>([]);

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
  }, [setLogs]);

  return {
    syncedExercises,
    setSyncedExercises,
    saveDefinitionsToCloud,
    saveExercise,
    saveExercises,
    deleteExercisePermanently
  };
};
