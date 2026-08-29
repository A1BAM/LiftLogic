import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

/**
 * Reproduces the reported switch bug end to end.
 *
 * Tapping "Switch Exercise" on a workout day did nothing, and the picker only
 * appeared after going back to the day list, where it then said there was
 * nothing to switch. The cause was structural: the picker was rendered inside
 * the day-selection screen, which is not mounted while a workout is open, so
 * the state changed and nothing appeared. Going back mounted it, by which time
 * the day was null and no slot could be resolved.
 */

// vi.mock factories are hoisted above module-level consts, so the fixtures they
// close over have to be hoisted with them.
const { workoutRows } = vi.hoisted(() => {
  const INCLINE = {
    id: 'custom-1784831134576', name: 'Incline Chest Dumbbells', muscleGroup: 'Chest',
    defaultWeight: 55, increment: 5, targetReps: 10, dayType: 'PUSH'
  };
  const SMITH = {
    id: 'custom-1768314623500', name: 'Smith Bench', muscleGroup: 'Chest',
    defaultWeight: 115, increment: 5, targetReps: 10, dayType: 'PUSH'
  };
  const definitionRow = (def: object, i: number) => ({
    id: `def_${i}`, exerciseId: '__DEFINITION__', timestamp: Date.now() - i,
    weight: 0, reps: 0, sets: 0, notes: JSON.stringify(def)
  });
  return { workoutRows: [definitionRow(INCLINE, 1), definitionRow(SMITH, 2)] };
});

vi.mock('./services/authService', () => ({
  authService: { login: vi.fn().mockResolvedValue({}), logout: vi.fn().mockResolvedValue({}) }
}));
vi.mock('./services/exerciseService', () => ({
  exerciseService: { getLocalExercises: () => [], setLocalExercises: vi.fn() }
}));
vi.mock('./services/workoutService', () => ({
  workoutService: {
    fetchWorkouts: vi.fn().mockResolvedValue(workoutRows),
    saveItem: vi.fn().mockResolvedValue({}),
    saveItems: vi.fn().mockResolvedValue({}),
    deleteItem: vi.fn().mockResolvedValue({})
  }
}));

import App from './App';

const unlockAndOpenPush = async () => {
  render(<App />);
  fireEvent.change(screen.getByPlaceholderText('Enter password to unlock'), {
    target: { value: 'pw' }
  });
  fireEvent.click(screen.getByRole('button', { name: /unlock app/i }));
  const push = await screen.findByText('Push Day', {}, { timeout: 5000 });
  fireEvent.click(push);
  // The incline press is slot 1, so it takes the top card.
  await screen.findByText('Incline Chest Dumbbells', {}, { timeout: 5000 });
};

describe('switching from a workout day', () => {
  beforeEach(() => {
    // jsdom has no SubtleCrypto; the lock screen hashes the password with it.
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      subtle: { digest: async () => new Uint8Array(32).buffer }
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('opens the picker while the workout is still open', async () => {
    await unlockAndOpenPush();

    fireEvent.click(screen.getByLabelText('Switch Exercise'));

    // The regression: this appeared only after navigating back to the day list.
    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 });
    expect(dialog).toBeInTheDocument();
    // Still on the workout day, not bounced back to the day picker.
    expect(screen.queryByText('Select your workout for today')).not.toBeInTheDocument();
  });

  it('offers the similar press rather than reporting nothing to switch', async () => {
    await unlockAndOpenPush();
    fireEvent.click(screen.getByLabelText('Switch Exercise'));
    await screen.findByRole('dialog', {}, { timeout: 5000 });

    expect(screen.getByText('Smith Bench')).toBeInTheDocument();
    expect(screen.queryByText(/No similar exercise set up for this slot/i)).not.toBeInTheDocument();
  });

  it('closes back to the workout, not to the day list', async () => {
    await unlockAndOpenPush();
    fireEvent.click(screen.getByLabelText('Switch Exercise'));
    await screen.findByRole('dialog', {}, { timeout: 5000 });

    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Incline Chest Dumbbells')).toBeInTheDocument();
  });
});
