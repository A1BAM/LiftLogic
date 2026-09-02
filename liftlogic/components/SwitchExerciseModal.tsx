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
      title={<><ArrowRightLeft className="text-blue-500" size={20} />Swap this lift</>}
    >
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {availableExercises.length === 0 ? (
            <div className="text-center text-slate-500 py-12 flex flex-col items-center">
              <ArrowRightLeft size={48} className="opacity-20 mb-4" />
              <p>No similar exercise set up for this slot.</p>
            </div>
          ) : (
            availableExercises.map(ex => (
              <div
                key={ex.id}
                className="bg-slate-950 rounded-xl border border-slate-800 flex items-center group focus-within:border-blue-500/50 hover:border-blue-500/50 transition-colors"
              >
                <button
                  onClick={() => onSelect(ex)}
                  aria-label={`Swap to ${ex.name}`}
                  className="flex-1 min-w-0 text-left p-4 flex justify-between items-center gap-3"
                >
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-300 group-hover:text-white truncate">{ex.name}</h3>
                    <p className="text-xs text-slate-500 uppercase font-bold">{ex.muscleGroup}</p>
                  </div>
                  <div className="shrink-0 p-2 bg-blue-900/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white rounded-lg border border-blue-900/50 transition-colors">
                    <ArrowRightLeft size={18} />
                  </div>
                </button>
                {onArchive && (
                  <button
                    onClick={() => onArchive(ex)}
                    className="shrink-0 self-stretch px-3 flex items-center text-slate-600 hover:text-amber-500 border-l border-slate-800 rounded-r-xl transition-colors"
                    title={`Archive ${ex.name}`}
                    aria-label={`Archive ${ex.name}`}
                  >
                    <Archive size={18} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl space-y-3">
           {onArchive && (
             <button
               onClick={() => onArchive(currentExercise)}
               className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-800 text-sm font-semibold text-slate-400 hover:text-amber-500 hover:border-amber-900/50 transition-colors"
               aria-label={`Archive ${currentExercise.name}`}
             >
               <Archive size={16} /> Archive {currentExercise.name} instead
             </button>
           )}
           <p className="text-[10px] text-slate-500 text-center">
             Swapping only changes which lift you are doing. {currentExercise.name} stays
             here ready to swap back, with all its history, unless you archive it.
           </p>
        </div>
    </Modal>
  );
};
