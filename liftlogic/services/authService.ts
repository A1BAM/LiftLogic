import { API_URL } from '../constants';
import { apiFetch } from './apiClient';

export const authService = {
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
  }
};
