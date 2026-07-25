import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwitchExerciseModal } from './SwitchExerciseModal';

describe('SwitchExerciseModal', () => {
  afterEach(() => {
    cleanup(); // Add manual cleanup to prevent multi-render issues when finding by role
  });

  const mockCurrentExercise = {
    id: 'current1',
    name: 'Push-ups',
    muscleGroup: 'Chest',
    dayType: 'Push',
    defaultWeight: 0,
    increment: 0,
    targetReps: 10
  };

  const mockAvailableExercises = [
    {
      id: 'avail1',
      name: 'Bench Press',
      muscleGroup: 'Chest',
      dayType: 'Push',
      defaultWeight: 135,
      increment: 5,
      targetReps: 8
    }
  ];

  it('renders available exercises and footer correctly', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <SwitchExerciseModal
        currentExercise={mockCurrentExercise as any}
        availableExercises={mockAvailableExercises as any}
        onClose={onClose}
        onSelect={onSelect}
      />
    );

    // Check available exercises render
    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.getByText(/Chest • Push/i)).toBeTruthy();

    // Check footer
    expect(screen.getByText(/This will archive Push-ups and unarchive your selection./i)).toBeTruthy();
  });

  it('calls onSelect when an available exercise is clicked', async () => {
    const onSelect = vi.fn();
    render(
      <SwitchExerciseModal
        currentExercise={mockCurrentExercise as any}
        availableExercises={mockAvailableExercises as any}
        onClose={vi.fn()}
        onSelect={onSelect}
      />
    );

    const user = userEvent.setup();
    const btn = screen.getByRole('button', { name: /Bench Press/i });
    await user.click(btn);

    expect(onSelect).toHaveBeenCalledWith(mockAvailableExercises[0]);
  });

  it('renders empty state when no available exercises are passed', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <SwitchExerciseModal
        currentExercise={mockCurrentExercise as any}
        availableExercises={[]}
        onClose={onClose}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('No archived exercises available to switch to.')).toBeTruthy();
  });

  it('calls onClose when close button, backdrop are clicked or Escape is pressed', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <SwitchExerciseModal
        currentExercise={mockCurrentExercise as any}
        availableExercises={mockAvailableExercises as any}
        onClose={onClose}
        onSelect={vi.fn()}
      />
    );

    const user = userEvent.setup();

    // Close button
    const btn = screen.getByLabelText('Close');
    await user.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Backdrop
    const backdrop = container.firstChild as HTMLElement;
    expect(backdrop).toBeTruthy();
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(2);
    }

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
