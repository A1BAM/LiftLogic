import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogModal } from './LogModal';
import { ExerciseDef, WorkoutLog } from '../types';

describe('LogModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockExercise: ExerciseDef = {
    id: 'test-id',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    defaultWeight: 135,
    increment: 5,
    targetReps: 10,
    dayType: 'PUSH'
  };

  const defaultProps = {
    exercise: mockExercise,
    todaysLogs: [],
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
  };

  it('renders correctly with default values when there are no logs', () => {
    render(<LogModal {...defaultProps} />);

    // Check title
    expect(screen.getByRole('heading', { name: 'Bench Press' })).toBeInTheDocument();

    // Check inputs have default values from exercise
    expect(screen.getByDisplayValue('135')).toBeInTheDocument(); // defaultWeight
    expect(screen.getByDisplayValue('10')).toBeInTheDocument(); // targetReps

    // Check empty state text
    expect(screen.getByText('No sets logged yet today.')).toBeInTheDocument();
  });

  it('pre-fills with todays last log if available', () => {
    const todaysLogs: WorkoutLog[] = [
      { id: '1', exerciseId: 'test-id', timestamp: 1000, weight: 140, reps: 8, sets: 1 }
    ];
    render(<LogModal {...defaultProps} todaysLogs={todaysLogs} />);

    // Should use today's last log
    expect(screen.getByDisplayValue('140')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
  });

  it('pre-fills with lastSessionLogs if todaysLogs is empty', () => {
    const lastSessionLogs: WorkoutLog[] = [
      { id: '2', exerciseId: 'test-id', timestamp: 500, weight: 145, reps: 6, sets: 1 }
    ];
    render(<LogModal {...defaultProps} lastSessionLogs={lastSessionLogs} />);

    // Should use last session's log
    expect(screen.getByDisplayValue('145')).toBeInTheDocument();
    expect(screen.getByDisplayValue('6')).toBeInTheDocument();
  });

  it('adjusts weight using +/- buttons', async () => {
    render(<LogModal {...defaultProps} />);
    const user = userEvent.setup();

    const decreaseWeightBtn = screen.getByRole('button', { name: 'Decrease weight by 5' });
    const increaseWeightBtn = screen.getByRole('button', { name: 'Increase weight by 5' });

    // Initial 135
    expect(screen.getByDisplayValue('135')).toBeInTheDocument();

    // Increase by 5
    await user.click(increaseWeightBtn);
    expect(screen.getByDisplayValue('140')).toBeInTheDocument();

    // Decrease by 5 twice
    await user.click(decreaseWeightBtn);
    await user.click(decreaseWeightBtn);
    expect(screen.getByDisplayValue('130')).toBeInTheDocument();
  });

  it('adjusts reps using +/- buttons', async () => {
    render(<LogModal {...defaultProps} />);
    const user = userEvent.setup();

    const decreaseRepsBtn = screen.getByRole('button', { name: 'Decrease reps' });
    const increaseRepsBtn = screen.getByRole('button', { name: 'Increase reps' });

    // Initial 10
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();

    // Increase by 1
    await user.click(increaseRepsBtn);
    expect(screen.getByDisplayValue('11')).toBeInTheDocument();

    // Decrease by 1 twice
    await user.click(decreaseRepsBtn);
    await user.click(decreaseRepsBtn);
    expect(screen.getByDisplayValue('9')).toBeInTheDocument();
  });

  it('calls onSave with correct values when Add Set is clicked', async () => {
    const onSave = vi.fn();
    render(<LogModal {...defaultProps} onSave={onSave} />);
    const user = userEvent.setup();

    const addSetBtn = screen.getByRole('button', { name: /Add Set/i });
    await user.click(addSetBtn);

    expect(onSave).toHaveBeenCalledWith({ weight: 135, reps: 10, sets: 1 });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when trash icon is clicked and confirmed', async () => {
    const onDelete = vi.fn();
    // Mock window.confirm to return true
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    const todaysLogs: WorkoutLog[] = [
      { id: 'log-123', exerciseId: 'test-id', timestamp: 1000, weight: 140, reps: 8, sets: 1 }
    ];

    render(<LogModal {...defaultProps} todaysLogs={todaysLogs} onDelete={onDelete} />);
    const user = userEvent.setup();

    const deleteBtn = screen.getByRole('button', { name: 'Delete set 1' });
    await user.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalledWith('Delete this set?');
    expect(onDelete).toHaveBeenCalledWith('log-123');
  });

  it('does not call onDelete when trash icon is clicked and cancelled', async () => {
    const onDelete = vi.fn();
    // Mock window.confirm to return false
    vi.spyOn(window, 'confirm').mockImplementation(() => false);

    const todaysLogs: WorkoutLog[] = [
      { id: 'log-123', exerciseId: 'test-id', timestamp: 1000, weight: 140, reps: 8, sets: 1 }
    ];

    render(<LogModal {...defaultProps} todaysLogs={todaysLogs} onDelete={onDelete} />);
    const user = userEvent.setup();

    const deleteBtn = screen.getByRole('button', { name: 'Delete set 1' });
    await user.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalledWith('Delete this set?');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onClose when close button, backdrop are clicked or Escape is pressed', async () => {
    const onClose = vi.fn();
    const { container } = render(<LogModal {...defaultProps} onClose={onClose} />);
    const user = userEvent.setup();

    // 1. Close button
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // 2. Backdrop
    const backdrop = container.firstChild as HTMLElement;
    expect(backdrop).toBeTruthy();
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(2);
    }

    // 3. Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
