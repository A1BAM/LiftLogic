import { API_URL } from '../constants';
import { apiFetch } from './apiClient';

export const profileService = {
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
  }
};
