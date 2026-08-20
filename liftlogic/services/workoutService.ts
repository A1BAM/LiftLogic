import { API_URL } from '../constants';
import { apiFetch } from './apiClient';

export const workoutService = {
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
  }
};
