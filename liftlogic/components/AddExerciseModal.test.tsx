import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddExerciseModal } from './AddExerciseModal';

describe('AddExerciseModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const defaultProps = {
    dayType: 'PUSH' as const,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  it('renders the form elements correctly', () => {
    render(<AddExerciseModal {...defaultProps} />);

    // Check title includes dayType
    expect(screen.getByRole('heading', { name: /Add New PUSH Exercise/i })).toBeTruthy();

    // Check form inputs
    expect(screen.getByLabelText(/Exercise Name/i)).toBeTruthy();
    expect(screen.getByLabelText(/Muscle Group/i)).toBeTruthy();
    expect(screen.getByLabelText(/Start Weight \(lbs\)/i)).toBeTruthy();
    expect(screen.getByLabelText(/Target Reps/i)).toBeTruthy();
    expect(screen.getByLabelText(/Progression Increment \(lbs\)/i)).toBeTruthy();

    // Check save button
    expect(screen.getByRole('button', { name: /Create Exercise/i })).toBeTruthy();
  });

  it('calls onSave with the correct form data when submitted', async () => {
    const onSave = vi.fn();
    render(<AddExerciseModal {...defaultProps} onSave={onSave} />);
    const user = userEvent.setup();

    // Fill form
    await user.type(screen.getByLabelText(/Exercise Name/i), 'Incline Bench Press');
    await user.type(screen.getByLabelText(/Muscle Group/i), 'Upper Chest');

    const weightInput = screen.getByLabelText(/Start Weight \(lbs\)/i);
    await user.clear(weightInput);
    await user.type(weightInput, '45');

    const repsInput = screen.getByLabelText(/Target Reps/i);
    await user.clear(repsInput);
    await user.type(repsInput, '8');

    // Submit form
    await user.click(screen.getByRole('button', { name: /Create Exercise/i }));

    expect(onSave).toHaveBeenCalledTimes(1);

    // Check the structure of the passed object
    const savedExercise = onSave.mock.calls[0][0];
    expect(savedExercise.name).toBe('Incline Bench Press');
    expect(savedExercise.muscleGroup).toBe('Upper Chest');
    expect(savedExercise.defaultWeight).toBe(45);
    expect(savedExercise.targetReps).toBe(8);
    expect(savedExercise.dayType).toBe('PUSH');
    expect(savedExercise.isCustom).toBe(true);
    expect(typeof savedExercise.id).toBe('string');
    expect(savedExercise.id.startsWith('custom-')).toBe(true);
  });

  it('does not call onSave if required fields are missing', async () => {
    const onSave = vi.fn();
    render(<AddExerciseModal {...defaultProps} onSave={onSave} />);
    const user = userEvent.setup();

    // Only fill Muscle Group (Name is missing)
    await user.type(screen.getByLabelText(/Muscle Group/i), 'Upper Chest');

    // Attempt to submit
    const submitBtn = screen.getByRole('button', { name: /Create Exercise/i });
    await user.click(submitBtn);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onClose when close button, backdrop are clicked or Escape is pressed', async () => {
    const onClose = vi.fn();
    const { container } = render(<AddExerciseModal {...defaultProps} onClose={onClose} />);
    const user = userEvent.setup();

    // 1. Close button
    const closeBtn = screen.getByLabelText('Close');
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
