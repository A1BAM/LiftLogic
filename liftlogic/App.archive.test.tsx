import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { workoutService } from './services/workoutService';

/**
 * Two rules about archiving, checked against the whole app rather than a
 * single component:
 *
 *  1. Every exercise on the screen can be archived, not just the one holding
 *     the top card.
 *  2. Once archived, the exercise is gone from the workout entirely — the
 *     card, the list underneath, and the swap picker. The archive list in the
 *     main menu is the only place it still appears.
 */

const { PUSH_EXERCISES, workoutRows } = vi.hoisted(() => {
  const defs = [
    ['custom-1784831134576', 'Incline Chest Dumbbells', 'Chest'],
    ['custom-1768314623500', 'Smith Bench', 'Chest'],
    ['custom-1784413338033', 'Overhead Press', 'Shoulders'],
    ['custom-1774374972187', 'Chest Fly', 'Chest'],
    ['custom-1769021252364', 'Lateral Raise', 'Shoulders'],
    ['TRICEP_PUSHDOWN', 'Triceps Pulldown', 'Triceps']
  ].map(([id, name, muscleGroup]) => ({
    id, name, muscleGroup, defaultWeight: 50, increment: 5, targetReps: 10, dayType: 'PUSH'
  }));
  return {
    PUSH_EXERCISES: defs,
    workoutRows: defs.map((def, i) => ({
      id: `def_${i}`, exerciseId: '__DEFINITION__', timestamp: Date.now() - i,
      weight: 0, reps: 0, sets: 0, notes: JSON.stringify(def)
    }))
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
    fetchWorkouts: vi.fn().mockResolvedValue(workoutRows),
    saveItem: vi.fn().mockResolvedValue({}),
    saveItems: vi.fn().mockResolvedValue({}),
    deleteItem: vi.fn().mockResolvedValue({})
  }
}));

import App from './App';

/** The lifts the plan actually shows on Push day; Smith Bench shares slot 1. */
const SHOWN = PUSH_EXERCISES.filter(e => e.id !== 'custom-1768314623500').map(e => e.name);

const openPush = async () => {
  render(<App />);
  fireEvent.change(screen.getByPlaceholderText('Enter password to unlock'), {
    target: { value: 'pw' }
  });
  fireEvent.click(screen.getByRole('button', { name: /unlock app/i }));
  fireEvent.click(await screen.findByText('Push Day', {}, { timeout: 5000 }));
  await screen.findByText('Incline Chest Dumbbells', {}, { timeout: 5000 });
};

describe('archiving from the workout screen', () => {
  beforeEach(() => {
    // jsdom has no SubtleCrypto; the lock screen hashes the password with it.
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      subtle: { digest: async () => new Uint8Array(32).buffer }
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); cleanup(); });

  it('downloads the history once when the app opens, not twice', async () => {
    // The regression: the mount check used to prove it was logged in by
    // fetching the whole workout table and throwing the result away, and the
    // data hook then fetched exactly the same thing again.
    await openPush();
    expect(workoutService.fetchWorkouts).toHaveBeenCalledTimes(1);
  });

  it('offers an archive control for every exercise on the day, not just the top card', async () => {
    await openPush();

    // The lift on the top card archives through the card's own button.
    expect(screen.getByLabelText('Archive Exercise')).toBeInTheDocument();

    // Everything queued underneath archives from its own row.
    for (const name of SHOWN.slice(1)) {
      expect(screen.getByLabelText(`Archive ${name}`)).toBeInTheDocument();
    }
  });

  it('archives a lift the workout screen never shows, from the main menu', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Enter password to unlock'), {
      target: { value: 'pw' }
    });
    fireEvent.click(screen.getByRole('button', { name: /unlock app/i }));
    await screen.findByText('Push Day', {}, { timeout: 5000 });

    // Smith Bench shares slot 1 with the incline press, so it appears on no
    // workout screen while the incline press fills the slot. The main-menu
    // list is what makes it archivable at all.
    fireEvent.click(screen.getByText('Your Exercises'));
    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 });
    fireEvent.click(within(dialog).getByLabelText('Archive Smith Bench'));

    await waitFor(() =>
      expect(within(dialog).queryByLabelText('Archive Smith Bench')).not.toBeInTheDocument()
    );
    // It has moved to the archived half of the same list.
    expect(within(dialog).getByLabelText('Restore Exercise')).toBeInTheDocument();
  });

  it('removes an archived exercise from the day entirely', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openPush();

    fireEvent.click(screen.getByLabelText('Archive Chest Fly'));

    await waitFor(() => expect(screen.queryByText('Chest Fly')).not.toBeInTheDocument());
    // The rest of the day is untouched.
    expect(screen.getByText('Lateral Raise')).toBeInTheDocument();
  });

  it('keeps an archived variant out of the swap picker', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openPush();

    // Smith Bench shares slot 1 with the incline press, so it is the swap on
    // offer until it is archived.
    fireEvent.click(screen.getByLabelText('Switch Exercise'));
    const picker = await screen.findByRole('dialog', {}, { timeout: 5000 });
    expect(within(picker).getByText('Smith Bench')).toBeInTheDocument();

    fireEvent.click(within(picker).getByLabelText('Archive Smith Bench'));
    await waitFor(() => expect(screen.queryByText('Smith Bench')).not.toBeInTheDocument());

    // And it does not come back the next time the picker is opened. The other
    // lifts sharing the slot still do, so the picker itself stays useful.
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Switch Exercise'));
    const reopened = await screen.findByRole('dialog', {}, { timeout: 5000 });
    expect(within(reopened).queryByText('Smith Bench')).not.toBeInTheDocument();
    expect(within(reopened).getByText('Chest Press Machine')).toBeInTheDocument();
  });
});
