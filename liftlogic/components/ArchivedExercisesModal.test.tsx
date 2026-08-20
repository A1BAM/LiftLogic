import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ArchivedExercisesModal } from './ArchivedExercisesModal';
import { ExerciseDef } from '../types';

describe('ArchivedExercisesModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRestore = vi.fn();
  const mockOnDelete = vi.fn();

  const mockExercises: ExerciseDef[] = [
    {
      id: 'ex1',
      name: 'Archived Bench',
      muscleGroup: 'Chest',
      defaultWeight: 135,
      increment: 5,
      targetReps: 10,
      dayType: 'PUSH',
      isArchived: true,
    },
    {
      id: 'ex2',
      name: 'Archived Row',
      muscleGroup: 'Back',
      defaultWeight: 100,
      increment: 5,
      targetReps: 10,
      dayType: 'PULL',
      isArchived: true,
    },
  ];

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders "No archived exercises." when exercises array is empty', () => {
    render(
      <ArchivedExercisesModal
        exercises={[]}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
      />
    );
    expect(screen.getByText('No archived exercises.')).toBeTruthy();
  });

  it('renders exercise names and details when exercises are provided', () => {
    render(
      <ArchivedExercisesModal
        exercises={mockExercises}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
      />
    );
    expect(screen.getByText('Archived Bench')).toBeTruthy();
    expect(screen.getByText('Chest • PUSH')).toBeTruthy();
    expect(screen.getByText('Archived Row')).toBeTruthy();
    expect(screen.getByText('Back • PULL')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <ArchivedExercisesModal
        exercises={mockExercises}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
      />
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <ArchivedExercisesModal
        exercises={mockExercises}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onRestore with correct exercise when Restore button is clicked', () => {
    render(
      <ArchivedExercisesModal
        exercises={mockExercises}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
      />
    );
    const restoreButtons = screen.getAllByLabelText('Restore Exercise');
    fireEvent.click(restoreButtons[0]);
    expect(mockOnRestore).toHaveBeenCalledWith(mockExercises[0]);
    expect(mockOnRestore).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete with correct exercise id when Delete button is clicked', () => {
    render(
      <ArchivedExercisesModal
        exercises={mockExercises}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
      />
    );
    const deleteButtons = screen.getAllByLabelText('Delete Exercise Permanently');
    fireEvent.click(deleteButtons[1]);
    expect(mockOnDelete).toHaveBeenCalledWith('ex2');
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });
});
