import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseDef } from '../types';

/**
 * The form button must degrade gracefully: an exercise added to the database
 * later has no animation file yet, and that has to grey the button out rather
 * than break the card.
 */

const withModel: ExerciseDef = {
  id: 'TRICEP_PUSHDOWN', name: 'Tricep Pulldown', muscleGroup: 'Triceps',
  defaultWeight: 30, increment: 5, targetReps: 12, dayType: 'PUSH'
};
const withoutModel: ExerciseDef = {
  ...withModel, id: 'custom-9999999999999', name: 'Brand New Machine'
};

const renderCard = (exercise: ExerciseDef, onFormClick?: (e: ExerciseDef) => void) =>
  render(
    <ExerciseCard
      exercise={exercise}
      exerciseLogs={[]}
      onLogClick={() => {}}
      onHistoryClick={() => {}}
      onFormClick={onFormClick}
    />
  );

describe('form guide button', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 7, 20, 12)); });
  afterEach(() => { vi.useRealTimers(); cleanup(); });

  it('is enabled and fires for an exercise that has a model', () => {
    const onFormClick = vi.fn();
    renderCard(withModel, onFormClick);
    const btn = screen.getByRole('button', { name: /show tricep pulldown form/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onFormClick).toHaveBeenCalledWith(withModel);
  });

  it('greys out and does not fire for an exercise with no model yet', () => {
    const onFormClick = vi.fn();
    renderCard(withoutModel, onFormClick);
    const btn = screen.getByRole('button', { name: /brand new machine: no model yet/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onFormClick).not.toHaveBeenCalled();
  });

  it('renders the card normally when no form handler is supplied', () => {
    renderCard(withModel);
    expect(screen.getByText('Tricep Pulldown')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /form/i })).not.toBeInTheDocument();
  });
});
