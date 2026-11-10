import React from 'react';
import { Archive, Check } from 'lucide-react';
import { ExerciseDef } from '../types';
import { PlanSlot, formatReps } from '../workoutPlan';

interface ExerciseRowProps {
  exercise: ExerciseDef;
  slot?: PlanSlot;
  position: number;
  isComplete: boolean;
  onLogClick: (exercise: ExerciseDef) => void;
  /** Parking a lift should not require promoting it to the top card first. */
  onArchive?: (exercise: ExerciseDef) => void;
}

/**
 * What is still to come, under the lift you are on. Deliberately quiet — the
 * point of the screen is that the card above is unmistakable — but still
 * tappable, so a set missed earlier can be logged out of order.
 */
export const ExerciseRow: React.FC<ExerciseRowProps> = ({
  exercise, slot, position, isComplete, onLogClick, onArchive
}) => (
  <div className="flex items-center gap-3 border-t border-ink-700 first:border-t-0">
    <button
      onClick={() => onLogClick(exercise)}
      className="flex flex-1 min-w-0 items-center gap-3 py-3.5 text-left"
    >
      <span className="w-6 shrink-0">
        {isComplete ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sage">
            <Check size={11} strokeWidth={3} className="text-ink-950" />
          </span>
        ) : (
          <span className="nums text-[14px] text-cream-400">{String(position).padStart(2, '0')}</span>
        )}
      </span>
      <span className={`flex-1 truncate text-[16px] ${isComplete ? 'text-cream-400 line-through' : 'display'}`}>
        {exercise.name}
      </span>
      {slot && (
        <span className="nums shrink-0 text-[14px] text-cream-400">
          {slot.sets} × {formatReps(slot).replace(' reps', '')}
        </span>
      )}
    </button>

    {onArchive && (
      <button
        onClick={(e) => { e.stopPropagation(); onArchive(exercise); }}
        aria-label={`Archive ${exercise.name}`}
        title={`Archive ${exercise.name}`}
        className="btn-quiet shrink-0 p-2"
      >
        <Archive size={15} />
      </button>
    )}
  </div>
);
