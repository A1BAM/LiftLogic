import React, { useEffect } from 'react';
import { ExerciseDef } from '../types';
import { X, ArrowRightLeft, Archive } from 'lucide-react';

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
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 flex flex-col max-h-[90vh] shadow-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="text-blue-500" size={20} />
            Swap this lift
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

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
             Swaps {currentExercise.name} out of this slot. Both keep all their logged history.
           </p>
        </div>
      </div>
    </div>
  );
};
