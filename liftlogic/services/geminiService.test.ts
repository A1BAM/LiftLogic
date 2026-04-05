import { describe, it, expect, vi } from 'vitest';
import { getWorkoutInsight } from './geminiService';

describe('geminiService', () => {
  it('returns missing API key message when API_KEY is not set', async () => {
    vi.stubEnv('API_KEY', '');

    const result = await getWorkoutInsight([], { id: 'ex1', name: 'Squat', targetReps: 10, bodyPart: 'legs', category: 'barbell' });

    expect(result).toBe("API Key missing. Unable to generate insights.");

    vi.unstubAllEnvs();
  });
});
