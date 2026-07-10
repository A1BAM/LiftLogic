import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('shows error message when importing invalid JSON', () => {
    render(<GlobalHistoryModal {...defaultProps} />);

    // Click Import Data button to enter import mode
    const importDataBtn = screen.getByLabelText('Import Data');
    fireEvent.click(importDataBtn);

    // Find the textarea and enter invalid JSON
    const textarea = screen.getByLabelText('Workout history JSON');
    fireEvent.change(textarea, { target: { value: 'invalid json text' } });

    // Click Import Logs button
    const submitBtn = screen.getByRole('button', { name: 'Import Logs' });
    fireEvent.click(submitBtn);

    // Verify error is displayed (we check by regex since the browser error message is included)
    const errorMessage = screen.getByText(/is not valid JSON|Unexpected token/i);
    expect(errorMessage).toBeTruthy();

    // Verify onImport was not called
    expect(defaultProps.onImport).not.toHaveBeenCalled();
  });
});
