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

  it('renders "No history available yet." when logs array is empty', () => {
    render(<HistoryModal {...defaultProps} logs={[]} />);
    expect(screen.getByText('No history available yet.')).toBeTruthy();
  });

  it('renders a list of logs', () => {
    render(<HistoryModal {...defaultProps} />);

    // Check for weights
    expect(screen.getByText('135')).toBeTruthy();
    expect(screen.getByText('140')).toBeTruthy();

    // Check for sets and reps using a custom matcher since they are separated by nodes/spaces
    const logsContainer = screen.getByRole('dialog');
    expect(logsContainer.textContent).toContain('3 x 10');
    expect(logsContainer.textContent).toContain('3 x 8');
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

  it('calls onDelete when delete button is clicked and confirmed', () => {
    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<HistoryModal {...defaultProps} />);
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete set' });
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith('Delete this log?');
    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockLogs[0].id);

    confirmSpy.mockRestore();
  });

  it('does not call onDelete when delete button is clicked and cancelled', () => {
    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => false);

    render(<HistoryModal {...defaultProps} />);
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete set' });
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith('Delete this log?');
    expect(defaultProps.onDelete).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
