import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LogModal } from './LogModal';
import { ExerciseDef, WorkoutLog } from '../types';

describe('LogModal', () => {
  const mockExercise: ExerciseDef = {
    id: '1',
    name: 'Bench Press',
    defaultWeight: 135,
    targetReps: 10,
  };

  const mockLog: WorkoutLog = {
    id: 'log1',
    exerciseId: '1',
    weight: 150,
    reps: 8,
    sets: 1,
    timestamp: Date.now()
  };

  const defaultProps = {
    exercise: mockExercise,
    todaysLogs: [],
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with default values from exercise when no logs exist', () => {
    render(<LogModal {...defaultProps} />);

    expect(screen.getByLabelText('Weight in lbs')).toHaveValue(135);
    expect(screen.getByLabelText('Number of reps')).toHaveValue(10);
    expect(screen.getByText('No sets logged yet today.')).toBeInTheDocument();
  });

  it('renders with default values from todaysLogs if exists', () => {
    const todaysLogs = [
      { ...mockLog, id: 'log1', weight: 145, reps: 9 },
      { ...mockLog, id: 'log2', weight: 155, reps: 7 }
    ];
    render(<LogModal {...defaultProps} todaysLogs={todaysLogs} />);

    // Should use the last log from today
    expect(screen.getByLabelText('Weight in lbs')).toHaveValue(155);
    expect(screen.getByLabelText('Number of reps')).toHaveValue(7);
  });

  it('renders with default values from lastSessionLogs if todaysLogs is empty', () => {
    const lastSessionLogs = [
      { ...mockLog, id: 'log3', weight: 160, reps: 6 }
    ];
    render(<LogModal {...defaultProps} lastSessionLogs={lastSessionLogs} />);

    expect(screen.getByLabelText('Weight in lbs')).toHaveValue(160);
    expect(screen.getByLabelText('Number of reps')).toHaveValue(6);
  });

  it('allows adjusting weight and reps via buttons', () => {
    render(<LogModal {...defaultProps} />);

    const incWeight = screen.getByLabelText('Increase weight by 5');
    const decWeight = screen.getByLabelText('Decrease weight by 5');
    const incReps = screen.getByLabelText('Increase reps');
    const decReps = screen.getByLabelText('Decrease reps');

    fireEvent.click(incWeight);
    expect(screen.getByLabelText('Weight in lbs')).toHaveValue(140);

    fireEvent.click(decWeight);
    fireEvent.click(decWeight);
    expect(screen.getByLabelText('Weight in lbs')).toHaveValue(130);

    fireEvent.click(incReps);
    expect(screen.getByLabelText('Number of reps')).toHaveValue(11);

    fireEvent.click(decReps);
    fireEvent.click(decReps);
    expect(screen.getByLabelText('Number of reps')).toHaveValue(9);
  });

  it('allows direct input of weight and reps', () => {
    render(<LogModal {...defaultProps} />);

    const weightInput = screen.getByLabelText('Weight in lbs');
    const repsInput = screen.getByLabelText('Number of reps');

    fireEvent.change(weightInput, { target: { value: '200' } });
    expect(weightInput).toHaveValue(200);

    fireEvent.change(repsInput, { target: { value: '5' } });
    expect(repsInput).toHaveValue(5);
  });

  it('calls onSave with correct data when form is submitted', () => {
    render(<LogModal {...defaultProps} />);

    const addSetButton = screen.getByRole('button', { name: /Add Set/i });
    fireEvent.click(addSetButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      weight: 135,
      reps: 10,
      sets: 1
    });
  });

  it('calls onDelete when delete button is clicked and confirmed', () => {
    const todaysLogs = [
      { ...mockLog, id: 'log1' }
    ];
    render(<LogModal {...defaultProps} todaysLogs={todaysLogs} />);

    const deleteButton = screen.getByLabelText('Delete set 1');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Delete this set?');
    expect(defaultProps.onDelete).toHaveBeenCalledWith('log1');
  });

  it('calls onClose when close button is clicked', () => {
    render(<LogModal {...defaultProps} />);

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<LogModal {...defaultProps} />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
