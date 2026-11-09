import React from 'react';
import { ExerciseDef } from '../types';
import { ArrowRightLeft, Archive } from 'lucide-react';
import { Modal } from './Modal';

interface SwitchExerciseModalProps {
  currentExercise: ExerciseDef;
  availableExercises: ExerciseDef[];
  onClose: () => void;
  onSelect: (replacementExercise: ExerciseDef) => void;
  /**
   * Parks a lift without swapping to it. Offered for the lift being swapped
   * out and for each option, so anything visible here can be archived from
   * here rather than only from its card.
   */
  onArchive?: (exercise: ExerciseDef) => void;
}

export const SwitchExerciseModal: React.FC<SwitchExerciseModalProps> = ({
  currentExercise,
  availableExercises,
  onClose,
  onSelect,
  onArchive
}) => {
  return (
    <Modal
      onClose={onClose}
      title="Swap this lift"
    >
        <div className="flex-1 overflow-y-auto px-5">
          {availableExercises.length === 0 ? (
            <p className="py-5 text-[13px] text-zinc-600">No similar exercise set up for this slot.</p>
          ) : (
            <ul>
              {availableExercises.map(ex => (
                <li key={ex.id} className="flex items-center gap-2 border-b border-ink-700 last:border-b-0">
                  <button
                    onClick={() => onSelect(ex)}
                    aria-label={`Swap to ${ex.name}`}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-zinc-200">{ex.name}</span>
                      <span className="block text-[12px] text-zinc-600">{ex.muscleGroup}</span>
                    </span>
                    <ArrowRightLeft size={16} className="shrink-0 text-zinc-500" />
                  </button>
                  {onArchive && (
                    <button
                      onClick={() => onArchive(ex)}
                      className="btn-quiet shrink-0 p-2"
                      title={`Archive ${ex.name}`}
                      aria-label={`Archive ${ex.name}`}
                    >
                      <Archive size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 pb-6 pt-4">
          {onArchive && (
            <button
              onClick={() => onArchive(currentExercise)}
              className="btn-quiet mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-700 py-3 text-[13px]"
              aria-label={`Archive ${currentExercise.name}`}
            >
              <Archive size={15} /> Archive {currentExercise.name} instead
            </button>
          )}
          <p className="text-[12px] leading-relaxed text-zinc-600">
            Swapping only changes which lift you are doing. {currentExercise.name} stays
            here ready to swap back, with all its history, unless you archive it.
          </p>
        </div>
    </Modal>
  );
};
