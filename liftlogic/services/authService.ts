import { API_URL } from '../constants';
import { apiFetch } from './apiClient';

export const authService = {
  /**
   * Whether the stored cookie still logs us in. Cheap on purpose: it answers
   * from the auth check alone, without reading the workout table, so opening
   * the app does not download the whole history twice.
   */
  async checkSession(): Promise<boolean> {
    const res = await apiFetch(`${API_URL}/session`);
    // A dev server with no API proxy answers every path with index.html, which
    // would otherwise read as a valid session.
    if ((res.headers.get('content-type') || '').includes('text/html')) return false;
    return res.ok;
  },

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
