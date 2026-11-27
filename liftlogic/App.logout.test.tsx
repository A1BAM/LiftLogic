import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { exerciseService } from './services/exerciseService';
import { loadResume } from './utils/resume';

const exercise = {
  id: 'custom-1', name: 'Personal rehab', dayType: 'PULL' as const,
  muscleGroup: 'Back', defaultWeight: 25, increment: 5, targetReps: 10
};
const rows = [{ id: 'def_custom-1', exerciseId: '__DEFINITION__', notes: JSON.stringify(exercise) }];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('signing out', () => {
  it('keeps the retry available until logout succeeds, clears data, and stays locked on reload', async () => {
    let signedIn = true;
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/session')) return Response.json({}, { status: signedIn ? 200 : 401 });
      if (url.endsWith('/logout')) {
        if (++attempts === 1) throw new Error('Offline');
        signedIn = false;
        return Response.json({ success: true });
      }
      return Response.json(rows);
    }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lock' }));
    expect(await screen.findByText('Sign-out unconfirmed')).toBeInTheDocument();
    expect(exerciseService.getLocalExercises()).toEqual([exercise]);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    await screen.findByText('Locked for now.');
    expect(localStorage.getItem('liftlogic_custom_exercises')).toBeNull();
    expect(exerciseService.getLocalExercises()).toEqual([]);
    expect(loadResume()).toEqual({ day: null, restEndTime: null, signedIn: false });
    expect(localStorage.getItem('liftlogic_logout')).toBeTruthy();
    cleanup();
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
    expect(screen.getByText('Locked for now.')).toBeInTheDocument();
  });

  it('locks another tab and discards a history read that completes after sign-out', async () => {
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/session') ? Response.json({ authenticated: true }) : pending));
    render(<App />);
    await screen.findByText('Syncing…');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'liftlogic_logout', newValue: 'other-tab' })));
    await screen.findByText('Locked for now.');
    await act(async () => { finish(Response.json(rows)); });
    expect(localStorage.getItem('liftlogic_custom_exercises')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Journal' })).toBeNull();
  });

  it.each([[401, false], [503, true]] as const)('clears old exercise data only on a definitive sign-out (%s)', async (status, keep) => {
    exerciseService.setLocalExercises([exercise]);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status })));
    await act(async () => { render(<App />); });
    expect(exerciseService.getLocalExercises()).toEqual(keep ? [exercise] : []);
  });

  it('cancels a pending login when another tab locks', async () => {
    let attempt: AbortSignal | undefined;
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('/login')) {
        attempt = options.signal!;
        return new Promise<Response>(resolve => { finish = resolve; });
      }
      return Response.json({}, { status: 401 });
    }));
    await act(async () => { render(<App />); });
    fireEvent.change(screen.getByPlaceholderText('Enter password to unlock'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock app/i }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'liftlogic_logout', newValue: 'other-tab' })));
    expect(attempt?.aborted).toBe(true);
    await act(async () => { finish(Response.json({ success: true })); });
    expect(screen.getByText('Locked for now.')).toBeInTheDocument();
  });
});
