import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './authService';
import { API_URL } from '../constants';

describe('authService', () => {
  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('checkSession', () => {
    const headers = (contentType: string) => ({ get: () => contentType });

    it('asks the session endpoint rather than downloading the history', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, headers: headers('application/json') });

      await expect(authService.checkSession()).resolves.toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/session`, expect.anything());
    });

    it('reports no session on a 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, headers: headers('application/json') });
      await expect(authService.checkSession()).resolves.toBe(false);
    });

    it('does not mistake a dev server index.html for a session', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, headers: headers('text/html; charset=utf-8') });
      await expect(authService.checkSession()).resolves.toBe(false);
    });
  });

  describe('login', () => {
    it('should send a POST request with the hash and return data on success', async () => {
      const mockHash = 'deadbeef';
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await authService.login(mockHash);

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/login`, expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ hash: mockHash }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should throw "Login failed" with status when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const promise = authService.login('badhash');
      await expect(promise).rejects.toThrow('Login failed');
      await promise.catch(e => expect(e.status).toBe(401));
    });
  });

  describe('logout', () => {
    it('should send a POST request to logout', async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await authService.logout();

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/logout`, expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should throw "Logout failed" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(authService.logout()).rejects.toThrow('Logout failed');
    });
  });
});
