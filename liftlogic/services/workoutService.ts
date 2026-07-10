import { API_URL } from '../constants';
import { ExerciseDef } from '../types';
import { logger } from '../utils/logger';

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };

  // 'include' sends cookies even for cross-origin requests
  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  return res;
};

export const workoutService = {
  async login(hashHex: string) {
    const res = await apiFetch(`${API_URL}/login`, {
      method: 'POST',
      body: JSON.stringify({ hash: hashHex })
    });
    if (!res.ok) {
      const err = new Error('Login failed');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  },

  async logout() {
    const res = await apiFetch(`${API_URL}/logout`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Logout failed');
    return res.json();
  },

  async fetchWorkouts() {
    const res = await apiFetch(API_URL);
    if (!res.ok) {
      const err = new Error('Failed to fetch data');
      (err as any).status = res.status;
      throw err;
    }
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      // Missing proxy / Vite server returning index.html
      throw new Error("API returned HTML. Missing proxy or backend down.");
    }
    return res.json();
  },

  async saveItems(payload: any[]) {
    const res = await apiFetch(`${API_URL}/bulk`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save items in bulk');
    return res.json();
  },

  async saveItem(payload: any) {
    const res = await apiFetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save item');
    return res.json();
  },




  async deleteItem(payload: any) {
    const res = await apiFetch(API_URL, {
      method: 'DELETE',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to delete item');
    return res.json();
  },


  async fetchProfile() {
    const res = await apiFetch(`${API_URL}/profile`);
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  async saveProfile(payload: { heightCm: number, weightLbs: number, age?: number }) {
    const res = await apiFetch(`${API_URL}/profile`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save profile');
    return res.json();
  },

  getLocalExercises(): ExerciseDef[] {
    const stored = localStorage.getItem('liftlogic_custom_exercises');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch (e) {
      logger.error('Error parsing local exercises', e);
      return [];
    }
  },

  setLocalExercises(exercises: ExerciseDef[]) {
    localStorage.setItem('liftlogic_custom_exercises', JSON.stringify(exercises));
  }
};
