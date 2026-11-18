import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import { GlobalHistoryModal, calculateGlobalHistoryStats } from './GlobalHistoryModal';

describe('calculateGlobalHistoryStats', () => {
  it('calculates stats correctly', () => {
    const logs = [
      { id: '1', exerciseId: 'ex1', timestamp: Date.now(), weight: 100, reps: 5, sets: 1, notes: '' },
      { id: '2', exerciseId: 'ex1', timestamp: Date.now() - 86400000, weight: 90, reps: 5, sets: 1, notes: '' },
    ];

    const allExercisesMap: Record<string, any> = {
      'ex1': { id: 'ex1', name: 'Bench Press', muscleGroup: 'Chest', dayType: 'Push', defaultWeight: 45, increment: 5, targetReps: 10 }
    };

    const result = calculateGlobalHistoryStats(logs, 'Push', allExercisesMap);

    expect(result.stats.totalWorkouts).toBe(2);
    expect(result.stats.totalVolume).toBe(950);
    expect(result.stats.totalDays).toBe(2);
  });
});

describe('GlobalHistoryModal', () => {
  const defaultProps = {
    logs: [],
    currentDayType: null,
    onClose: vi.fn(),
    onImport: vi.fn(),
    customExercises: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const sets = [
    { id: 'a', exerciseId: 'DUMBBELL_CURL', timestamp: Date.UTC(2026, 10, 1, 17), weight: 30, reps: 12, sets: 1 }
  ];
  const openBackup = (props = {}) => {
    render(<GlobalHistoryModal {...defaultProps} logs={sets} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }));
  };

  it('saves a complete backup as a file, not to the clipboard', async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    let saved: Blob | null = null;
    const createObjectURL = vi.fn((b: Blob) => { saved = b; return 'blob:x'; });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    openBackup();
    expect(screen.getByText(/1 sets ·/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save backup file' }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    const backup = JSON.parse(await saved!.text());
    expect(backup).toMatchObject({ app: 'liftlogic', version: 2 });
    expect(backup.sets).toHaveLength(1);
    // The exercise the set belongs to travels with it.
    expect(backup.exercises.map((e: { id: string }) => e.id)).toEqual(['DUMBBELL_CURL']);
    click.mockRestore();
  });

  it('uses the share sheet where the phone offers one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { canShare: () => true, share });

    openBackup();
    fireEvent.click(screen.getByRole('button', { name: /spreadsheet/i }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    const file: File = share.mock.calls[0][0].files[0];
    expect(file.name).toMatch(/^liftlogic-sets-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(await file.text()).toContain('Dumbbell Bicep Curls,30,12');
    Object.assign(navigator, { canShare: undefined, share: undefined });
  });

  it('restores a pasted old-style backup', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    openBackup({ onImport });
    fireEvent.click(screen.getByRole('button', { name: /Paste an older backup/ }));
    fireEvent.change(screen.getByLabelText('Backup text'), { target: { value: JSON.stringify(sets, null, 2) } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore pasted backup' }));

    await waitFor(() => expect(onImport).toHaveBeenCalled());
    expect(onImport.mock.calls[0][0].logs.map((l: { id: string }) => l.id)).toEqual(['a']);
  });

  it('says what is wrong with a bad backup and imports nothing', () => {
    openBackup();
    fireEvent.click(screen.getByRole('button', { name: /Paste an older backup/ }));
    fireEvent.change(screen.getByLabelText('Backup text'), { target: { value: 'invalid json text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore pasted backup' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/not valid JSON/);
    expect(defaultProps.onImport).not.toHaveBeenCalled();
  });
});
