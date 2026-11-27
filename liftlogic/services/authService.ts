import { API_URL } from '../constants';
import { apiFetch } from './apiClient';

export const authService = {
  /**
   * Whether the stored cookie still logs us in. Cheap on purpose: it answers
   * from the auth check alone, without reading the workout table, so opening
   * the app does not download the whole history twice.
   */
  async checkSession(signal?: AbortSignal): Promise<boolean> {
    const res = await apiFetch(`${API_URL}/session`, { signal });
    // A dev server with no API proxy answers every path with index.html, which
    // would otherwise read as a valid session.
    if (res.status === 401) return false;
    if (!res.ok || (res.headers.get('content-type') || '').includes('text/html')) {
      throw new Error('Session could not be checked');
    }
    return true;
  },

  /**
   * Sends the password itself; the server does the hashing. Hashing it here
   * first only turned the hash into the thing you log in with.
   */
  async login(password: string, signal?: AbortSignal) {
    const res = await apiFetch(`${API_URL}/login`, {
      signal,
      method: 'POST',
      body: JSON.stringify({ password })
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
