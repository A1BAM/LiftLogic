import React from 'react';
import { ExerciseDef } from '../types';
import { RefreshCw, Trash2, Archive } from 'lucide-react';
import { Modal } from './Modal';

interface ArchivedExercisesModalProps {
  /** The archived ones, which can be restored or deleted outright. */
  exercises: ExerciseDef[];
  onClose: () => void;
  onRestore: (exercise: ExerciseDef) => void;
  onDelete: (exerciseId: string) => void;
  /**
   * Everything still in circulation. Listed so that every exercise you have
   * can be archived from one place, including the variants a day's plan keeps
   * out of sight because another lift is filling their slot.
   */
  activeExercises?: ExerciseDef[];
  onArchive?: (exercise: ExerciseDef) => void;
}

export const ArchivedExercisesModal: React.FC<ArchivedExercisesModalProps> = ({
  exercises,
  onClose,
  onRestore,
  onDelete,
  activeExercises,
  onArchive
}) => {
  return (
    <Modal
      onClose={onClose}
      title={<><Archive className="text-amber-500" size={20} />Your Exercises</>}
    >
        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Archived
          </h3>
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
                    aria-label="Restore Exercise"
                  >
                    <RefreshCw size={18} />
                  </button>
                  <button 
                    onClick={() => onDelete(ex.id)}
                    className="p-2 bg-red-900/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg border border-red-900/30 transition-colors"
                    title="Delete Permanently"
                    aria-label="Delete Exercise Permanently"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}

          {onArchive && (
            <>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pt-4">
                In use
              </h3>
              {(activeExercises ?? []).length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No exercises in use.</p>
              ) : (
                (activeExercises ?? []).map(ex => (
                  <div key={ex.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-300 truncate">{ex.name}</h3>
                      <p className="text-xs text-slate-500 uppercase font-bold">{ex.muscleGroup} • {ex.dayType}</p>
                    </div>
                    <button
                      onClick={() => onArchive(ex)}
                      className="shrink-0 p-2 bg-slate-900 text-slate-500 hover:bg-amber-900/20 hover:text-amber-500 rounded-lg border border-slate-800 transition-colors"
                      title={`Archive ${ex.name}`}
                      aria-label={`Archive ${ex.name}`}
                    >
                      <Archive size={18} />
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl text-center">
           <p className="text-[10px] text-slate-500">
             Archiving hides an exercise everywhere except this list. Restoring brings it back.
           </p>
        </div>
    </Modal>
  );
};