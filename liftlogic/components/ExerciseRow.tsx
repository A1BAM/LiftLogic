import React from 'react';
import { Archive, CheckCircle2, ChevronRight, PersonStanding } from 'lucide-react';
import { ExerciseDef } from '../types';
import { PlanSlot, formatReps, formatRest } from '../workoutPlan';
import { hasAnimation } from '../formviewer/loader';

interface ExerciseRowProps {
  exercise: ExerciseDef;
  slot?: PlanSlot;
  position: number;
  isComplete: boolean;
  onLogClick: (exercise: ExerciseDef) => void;
  onFormClick?: (exercise: ExerciseDef) => void;
  /** Parking a lift should not require promoting it to the top card first. */
  onArchive?: (exercise: ExerciseDef) => void;
}

/**
 * The upcoming exercises, listed under the one you are meant to be doing.
 * Deliberately quiet: the whole point of the screen is that the top card is
 * unmistakable, so these stay small and low-contrast until their turn.
 * They remain tappable, so a missed set can still be logged out of sequence.
 */
export const ExerciseRow: React.FC<ExerciseRowProps> = ({
  exercise, slot, position, isComplete, onLogClick, onFormClick, onArchive
}) => {
  const formReady = hasAnimation(exercise.id);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        isComplete
          ? 'bg-slate-900/30 border-slate-800/70'
          : 'bg-slate-800/40 border-slate-700/50'
      }`}
    >
      <span
        className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold ${
          isComplete ? 'bg-green-500/15 text-green-500' : 'bg-slate-700/70 text-slate-400'
        }`}
        aria-hidden="true"
      >
        {isComplete ? <CheckCircle2 size={14} /> : position}
      </span>

      <button
        onClick={() => onLogClick(exercise)}
        className="flex-1 min-w-0 text-left"
      >
        <p className={`text-sm font-semibold truncate ${isComplete ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
          {exercise.name}
        </p>
        {slot && (
          <p className="text-[11px] text-slate-500 truncate">
            {slot.sets} × {formatReps(slot)} · {formatRest(slot)}
          </p>
        )}
      </button>

      {onFormClick && (
        <button
          onClick={(e) => { e.stopPropagation(); if (formReady) onFormClick(exercise); }}
          disabled={!formReady}
          aria-label={formReady ? `Show ${exercise.name} form` : `${exercise.name}: no model yet`}
          title={formReady ? `Show ${exercise.name} form` : 'No model yet'}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-md border ${
            formReady
              ? 'border-slate-700 text-blue-400/80'
              : 'border-slate-800 text-slate-700 cursor-not-allowed'
          }`}
        >
          <PersonStanding size={15} />
        </button>
      )}

      {onArchive && (
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(exercise); }}
          aria-label={`Archive ${exercise.name}`}
          title={`Archive ${exercise.name}`}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-slate-700 text-slate-500 hover:text-amber-500 hover:border-amber-900/50 transition-colors"
        >
          <Archive size={15} />
        </button>
      )}

      <ChevronRight size={16} className="shrink-0 text-slate-600" />
    </div>
  );
};
