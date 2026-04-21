import React from 'react';
import { ExerciseDef } from '../types';
import { X, RefreshCw, Trash2, Archive } from 'lucide-react';

interface ArchivedExercisesModalProps {
  exercises: ExerciseDef[];
  onClose: () => void;
  onRestore: (exercise: ExerciseDef) => void;
  onDelete: (exerciseId: string) => void;
}

export const ArchivedExercisesModal: React.FC<ArchivedExercisesModalProps> = ({ 
  exercises, 
  onClose, 
  onRestore, 
  onDelete 
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 flex flex-col max-h-[90vh] shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Archive className="text-amber-500" size={20} />
            Archived Exercises
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {exercises.length === 0 ? (
            <div className="text-center text-slate-500 py-12 flex flex-col items-center">
              <Archive size={48} className="opacity-20 mb-4" />
              <p>No archived exercises.</p>
            </div>
          ) : (
            exercises.map(ex => (
              <div key={ex.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center group">
                <div>
                  <h3 className="font-bold text-slate-300">{ex.name}</h3>
                  <p className="text-xs text-slate-500 uppercase font-bold">{ex.muscleGroup} • {ex.dayType}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onRestore(ex)}
                    className="p-2 bg-blue-900/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg border border-blue-900/50 transition-colors"
                    title="Restore"
                  >
                    <RefreshCw size={18} />
                  </button>
                  <button 
                    onClick={() => onDelete(ex.id)}
                    className="p-2 bg-red-900/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg border border-red-900/30 transition-colors"
                    title="Delete Permanently"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl text-center">
           <p className="text-[10px] text-slate-500">Restoring an exercise brings it back to your daily list.</p>
        </div>
      </div>
    </div>
  );
};