import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workoutService } from './workoutService';
import { API_URL } from '../constants';

describe('workoutService API Interactions', () => {
  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('fetchWorkouts', () => {
    it('should fetch and return workout data on success', async () => {
      const mockData = [{ id: '1', exerciseId: 'DUMBBELL_CURL', weight: 20 }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: {
          get: () => 'application/json'
        }
      });

      const result = await workoutService.fetchWorkouts();

      expect(mockFetch).toHaveBeenCalledWith(API_URL, expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockData);
    });

    it('should throw when response is HTML', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'text/html'
        }
      });

      await expect(workoutService.fetchWorkouts()).rejects.toThrow('API returned HTML. Missing proxy or backend down.');
    });

    it('should throw "Failed to fetch data" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const promise = workoutService.fetchWorkouts();
      await expect(promise).rejects.toThrow('Failed to fetch data');
      await promise.catch(e => expect(e.status).toBe(500));
    });
  });

  describe('saveItems', () => {
    it('should send a POST request to /bulk with the correct body and return data on success', async () => {
      const payload = [{ exerciseId: 'PUSH_UP', weight: 0 }];
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await workoutService.saveItems(payload);

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/bulk`, expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should throw "Failed to save items in bulk" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(workoutService.saveItems([])).rejects.toThrow('Failed to save items in bulk');
    });
  });

  describe('saveItem', () => {
    it('should send a POST request with the correct body and return data on success', async () => {
      const payload = { exerciseId: 'PUSH_UP', weight: 0 };
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await workoutService.saveItem(payload);

      expect(mockFetch).toHaveBeenCalledWith(API_URL, expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should throw "Failed to save item" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(workoutService.saveItem({})).rejects.toThrow('Failed to save item');
    });
  });

  describe('deleteItem', () => {
    it('should send a DELETE request with the correct body and return data on success', async () => {
      const payload = { id: 'log-123' };
      const mockResponse = { deleted: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await workoutService.deleteItem(payload);

      expect(mockFetch).toHaveBeenCalledWith(API_URL, expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should throw "Failed to delete item" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(workoutService.deleteItem({})).rejects.toThrow('Failed to delete item');
    });
  });
});
