import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { ArchivedExercisesModal } from './ArchivedExercisesModal';
import { ExerciseDef } from '../types';

describe('ArchivedExercisesModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRestore = vi.fn();
  const mockOnDelete = vi.fn();

  const mockExercises: ExerciseDef[] = [
    {
      id: 'ex1',
      name: 'Bench Press',
      muscleGroup: 'Chest',
      defaultWeight: 135,
      increment: 5,
      targetReps: 10,
      dayType: 'PUSH',
      isArchived: true
    },
    {
      id: 'ex2',
      name: 'Squat',
      muscleGroup: 'Legs',
      defaultWeight: 225,
      increment: 10,
      targetReps: 8,
      dayType: 'LEGS',
      isArchived: true
    }
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly with no exercises', () => {
    render(
      <ArchivedExercisesModal
        exercises={[]}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Archived Exercises')).toBeInTheDocument();
    expect(screen.getByText('No archived exercises.')).toBeInTheDocument();
  });

  it('renders a list of archived exercises', () => {
    render(
      <ArchivedExercisesModal
        exercises={mockExercises}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Chest • PUSH')).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Legs • LEGS')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <ArchivedExercisesModal
        exercises={[]}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getAllByLabelText('Close')[0]);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onRestore with correct exercise when restore button is clicked', () => {
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

    expect(mockOnRestore).toHaveBeenCalledTimes(1);
    expect(mockOnRestore).toHaveBeenCalledWith(mockExercises[0]);
  });

  it('calls onDelete with correct exercise id when delete button is clicked', () => {
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

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(mockExercises[1].id);
  });
});
