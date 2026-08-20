import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileService } from './profileService';
import { API_URL } from '../constants';

describe('profileService API Interactions', () => {
  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('fetchProfile', () => {
    it('should fetch and return profile data on success', async () => {
      const mockData = { heightCm: 180, weightLbs: 160, age: 30 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await profileService.fetchProfile();

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/profile`, expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockData);
    });

    it('should throw "Failed to fetch profile" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(profileService.fetchProfile()).rejects.toThrow('Failed to fetch profile');
    });
  });

  describe('saveProfile', () => {
    it('should send a POST request with the correct body and return data on success', async () => {
      const payload = { heightCm: 180, weightLbs: 160, age: 30 };
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await profileService.saveProfile(payload);

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/profile`, expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should throw "Failed to save profile" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(profileService.saveProfile({ heightCm: 180, weightLbs: 160 })).rejects.toThrow('Failed to save profile');
    });
  });
});
