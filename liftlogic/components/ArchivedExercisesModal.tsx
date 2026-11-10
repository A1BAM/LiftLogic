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
      title="Exercises"
    >
        {/* List */}
        <div className="flex-1 overflow-y-auto px-5">
          <p className="pb-1 text-[13px] text-cream-400">Archived</p>
          {exercises.length === 0 ? (
            <p className="py-4 text-[14px] text-cream-400">Nothing archived.</p>
          ) : (
            <ul>
              {exercises.map(ex => (
                <li key={ex.id} className="flex items-center gap-3 border-b border-ink-700 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-cream-400">{ex.name}</p>
                    <p className="text-[13px] text-cream-400">
                      {ex.muscleGroup} · {ex.dayType.toLowerCase()}
                    </p>
                  </div>
                  <button
                    onClick={() => onRestore(ex)}
                    className="btn-quiet shrink-0 p-2"
                    title="Restore"
                    aria-label="Restore Exercise"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(ex.id)}
                    className="btn-quiet shrink-0 p-2 active:text-red-300"
                    title="Delete Permanently"
                    aria-label="Delete Exercise Permanently"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {onArchive && (
            <>
              <p className="pb-1 pt-6 text-[13px] text-cream-400">In use</p>
              {(activeExercises ?? []).length === 0 ? (
                <p className="py-4 text-[14px] text-cream-400">Nothing in use.</p>
              ) : (
                <ul>
                  {(activeExercises ?? []).map(ex => (
                    <li key={ex.id} className="flex items-center gap-3 border-b border-ink-700 py-3 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-cream-50">{ex.name}</p>
                        <p className="text-[13px] text-cream-400">
                          {ex.muscleGroup} · {ex.dayType.toLowerCase()}
                        </p>
                      </div>
                      <button
                        onClick={() => onArchive(ex)}
                        className="btn-quiet shrink-0 p-2"
                        title={`Archive ${ex.name}`}
                        aria-label={`Archive ${ex.name}`}
                      >
                        <Archive size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="px-5 pb-6 pt-4">
          <p className="text-[13px] leading-relaxed text-cream-400">
            Archiving hides an exercise everywhere except this list. Restoring brings it back.
          </p>
        </div>
    </Modal>
  );
};