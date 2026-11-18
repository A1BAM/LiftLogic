import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { workoutService } from './services/workoutService';

/**
 * Restoring a backup adds what is missing and changes nothing that is
 * already there, checked through the whole app rather than one component.
 */

const { rows, CURL } = vi.hoisted(() => {
  const CURL = { id: 'DUMBBELL_CURL', name: 'Dumbbell Bicep Curls', muscleGroup: 'Biceps', defaultWeight: 25, increment: 5, targetReps: 12, dayType: 'PULL' };
  return {
    CURL,
    rows: [
      // Logged, then edited to 32.5 after the backup below was taken.
      { id: 'kept', exerciseId: 'DUMBBELL_CURL', timestamp: Date.UTC(2026, 9, 1), weight: 32.5, reps: 10, sets: 1, notes: null }
    ]
  };
});

vi.mock('./services/authService', () => ({
  authService: {
    login: vi.fn().mockResolvedValue({}),
    logout: vi.fn().mockResolvedValue({}),
    checkSession: vi.fn().mockResolvedValue(false)
  }
}));
vi.mock('./services/exerciseService', () => ({
  exerciseService: { getLocalExercises: () => [], setLocalExercises: vi.fn() }
}));
vi.mock('./services/workoutService', () => ({
  workoutService: {
    fetchWorkouts: vi.fn().mockResolvedValue(rows),
    saveItem: vi.fn().mockResolvedValue({}),
    saveItems: vi.fn().mockResolvedValue({}),
    deleteItem: vi.fn().mockResolvedValue({})
  }
}));

import App from './App';

const backup = {
  app: 'liftlogic',
  version: 2,
  exportedAt: '2026-10-02T00:00:00.000Z',
  exercises: [
    CURL,
    { id: 'custom-9', name: 'Cable Crunch', muscleGroup: 'Abs', defaultWeight: 40, increment: 5, targetReps: 15, dayType: 'PULL', isCustom: true }
  ],
  sets: [
    // The same set as it was before the edit: must not win.
    { id: 'kept', exerciseId: 'DUMBBELL_CURL', at: '2026-10-01T00:00:00.000Z', weight: 30, reps: 10 },
    { id: 'lost', exerciseId: 'custom-9', at: '2026-09-28T00:00:00.000Z', weight: 40, reps: 15 }
  ]
};

describe('restoring a backup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('adds the missing set and exercise, and leaves the edited set alone', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Enter password to unlock'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock app/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Journal' }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: /Paste an older backup/ }));
    fireEvent.change(screen.getByLabelText('Backup text'), { target: { value: JSON.stringify(backup) } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore pasted backup' }));

    expect(await screen.findByText('Added 1 set and 1 exercise.', {}, { timeout: 5000 })).toBeInTheDocument();

    const saved = vi.mocked(workoutService.saveItems).mock.calls.flatMap(([items]) => items as Array<{ id: string; notes?: string }>);
    // The exercise went up as a definition, before the set that needs it.
    expect(saved.map(i => i.id)).toEqual(['def_custom-9', 'lost']);
    // And the edited set was never sent back over itself.
    expect(saved.some(i => i.id === 'kept')).toBe(false);
  });

  it('says so when there is nothing to add', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Enter password to unlock'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock app/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Journal' }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: /Paste an older backup/ }));
    fireEvent.change(screen.getByLabelText('Backup text'), {
      target: { value: JSON.stringify({ ...backup, exercises: [CURL], sets: [backup.sets[0]] }) }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Restore pasted backup' }));

    expect(await screen.findByText('Nothing new')).toBeInTheDocument();
    await waitFor(() => expect(workoutService.saveItems).not.toHaveBeenCalled());
  });
});
