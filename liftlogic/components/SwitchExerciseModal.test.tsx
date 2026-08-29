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
    expect(screen.getByText(/Chest/i)).toBeTruthy();

    // The footer says what actually happens: the slot swaps, nothing is lost.
    expect(
      screen.getByText(/Swaps Push-ups out of this slot\. Both keep all their logged history\./i)
    ).toBeTruthy();
  });

  it('lists an option plainly, with nothing about archiving', () => {
    render(
      <SwitchExerciseModal
        currentExercise={mockCurrentExercise as any}
        availableExercises={mockAvailableExercises as any}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    // Archived lifts never reach this picker any more, so there is no parked
    // state left to label.
    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.queryByText(/parked/i)).toBeNull();
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

  it('archives an option from the picker without swapping to it', async () => {
    const onArchive = vi.fn();
    const onSelect = vi.fn();
    render(
      <SwitchExerciseModal
        currentExercise={mockCurrentExercise as any}
        availableExercises={mockAvailableExercises as any}
        onClose={vi.fn()}
        onSelect={onSelect}
        onArchive={onArchive}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Archive Bench Press'));

    expect(onArchive).toHaveBeenCalledWith(mockAvailableExercises[0]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('archives the lift being swapped out', async () => {
    const onArchive = vi.fn();
    render(
      <SwitchExerciseModal
        currentExercise={mockCurrentExercise as any}
        availableExercises={mockAvailableExercises as any}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onArchive={onArchive}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Archive Push-ups'));

    expect(onArchive).toHaveBeenCalledWith(mockCurrentExercise);
  });

  it('leaves the archive controls off when archiving is not offered', () => {
    render(
      <SwitchExerciseModal
        currentExercise={mockCurrentExercise as any}
        availableExercises={mockAvailableExercises as any}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/^Archive /)).toBeNull();
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

    // Isolation lifts have nothing similar to swap to.
    expect(screen.getByText('No similar exercise set up for this slot.')).toBeTruthy();
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
