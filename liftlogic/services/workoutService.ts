import { API_URL } from '../constants';
import { ExerciseDef, WorkoutLog } from '../types';

export const workoutService = {
  async fetchWorkouts() {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
  },

  async saveItem(payload: any) {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save item');
    return res.json();
  },

  async deleteItem(payload: any) {
    const res = await fetch(API_URL, {
      method: 'DELETE',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to delete item');
    return res.json();
  },

  getLocalExercises(): ExerciseDef[] {
    const stored = localStorage.getItem('liftlogic_custom_exercises');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parsing local exercises', e);
      return [];
    }
  },

  setLocalExercises(exercises: ExerciseDef[]) {
    localStorage.setItem('liftlogic_custom_exercises', JSON.stringify(exercises));
  }
};
