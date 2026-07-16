import React, { useEffect } from 'react';
import { ExerciseDef } from '../types';
import { X, ArrowRightLeft } from 'lucide-react';

interface SwitchExerciseModalProps {
  currentExercise: ExerciseDef;
  availableExercises: ExerciseDef[];
  onClose: () => void;
  onSelect: (replacementExercise: ExerciseDef) => void;
}

export const SwitchExerciseModal: React.FC<SwitchExerciseModalProps> = ({
  currentExercise,
  availableExercises,
  onClose,
  onSelect
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
            Switch Exercise
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
              <p>No archived exercises available to switch to.</p>
            </div>
          ) : (
            availableExercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="w-full text-left bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center group hover:border-blue-500/50 transition-colors"
              >
                <div>
                  <h3 className="font-bold text-slate-300 group-hover:text-white">{ex.name}</h3>
                  <p className="text-xs text-slate-500 uppercase font-bold">{ex.muscleGroup} • {ex.dayType}</p>
                </div>
                <div className="p-2 bg-blue-900/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white rounded-lg border border-blue-900/50 transition-colors">
                  <ArrowRightLeft size={18} />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl text-center">
           <p className="text-[10px] text-slate-500">This will archive {currentExercise.name} and unarchive your selection.</p>
        </div>
      </div>
    </div>
  );
};
