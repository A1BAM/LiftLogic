import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HistoryModal } from './HistoryModal';
import { ExerciseDef, WorkoutLog } from '../types';

describe('HistoryModal', () => {
  const mockExercise: ExerciseDef = {
    id: 'bench-press',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    defaultWeight: 135,
    increment: 5,
    targetReps: 10,
    dayType: 'PUSH'
  };

  const mockLogs: WorkoutLog[] = [
    {
      id: 'log1',
      exerciseId: 'bench-press',
      timestamp: 1672531200000, // Jan 1, 2023
      weight: 135,
      reps: 10,
      sets: 3
    },
    {
      id: 'log2',
      exerciseId: 'bench-press',
      timestamp: 1672617600000, // Jan 2, 2023
      weight: 140,
      reps: 8,
      sets: 3
    }
  ];

  const defaultProps = {
    exercise: mockExercise,
    logs: mockLogs,
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders exercise name in the header', () => {
    render(<HistoryModal {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/Bench Press\s*History/);
  });

  it('says so when the exercise has no history', () => {
    render(<HistoryModal {...defaultProps} logs={[]} />);
    expect(screen.getByText('Nothing logged for this one yet.')).toBeTruthy();
  });

  it('renders a list of logs', () => {
    render(<HistoryModal {...defaultProps} />);

    // Each row reads as one line: the weight, the reps, and the set count
    // when a row stands for more than one set.
    const logsContainer = screen.getByRole('dialog');
    expect(logsContainer.textContent).toContain('135 lbs × 10 reps · 3 sets');
    expect(logsContainer.textContent).toContain('140 lbs × 8 reps · 3 sets');
  });

  it('calls onClose when close button is clicked', () => {
    render(<HistoryModal {...defaultProps} />);
    // Get button using role and name to be more specific
    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onEdit when edit button is clicked', () => {
    render(<HistoryModal {...defaultProps} />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit set' });
    fireEvent.click(editButtons[0]);
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockLogs[0]);
  });

  it('asks on the row itself, and deletes on the second tap', () => {
    render(<HistoryModal {...defaultProps} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete set' })[0]);

    // Nothing is deleted by the first tap, and no system dialog is involved.
    expect(defaultProps.onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete set' }));
    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockLogs[0].id);
  });

  it('keeps the set when the delete is cancelled', () => {
    render(<HistoryModal {...defaultProps} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete set' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Keep set' }));

    expect(defaultProps.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Confirm delete set' })).not.toBeInTheDocument();
  });
});
