import React from 'react';
import { WorkoutLog, ExerciseDef } from '../types';
import { Trash2, Edit2 } from 'lucide-react';
import { Modal } from './Modal';

interface HistoryModalProps {
  exercise: ExerciseDef;
  logs: WorkoutLog[];
  onClose: () => void;
  onDelete: (logId: string) => void;
  onEdit: (log: WorkoutLog) => void;
}

const historyDateCache = new Map<string, string>();
const historyDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric'
});

export const HistoryModal: React.FC<HistoryModalProps> = ({ 
  exercise, 
  logs, // logs are pre-filtered and pre-sorted by the caller
  onClose, 
  onDelete,
  onEdit
}) => {
  return (
    <Modal onClose={onClose} title={`${exercise.name} History`}>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {/* Logs List */}
          {logs.length === 0 ? (
            <p className="py-5 text-[14px] text-aero-700">Nothing logged for this one yet.</p>
          ) : (
            <ul>
              {logs.map(log => {
                const d = new Date(log.timestamp);
                const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                let dateStr = historyDateCache.get(dateKey);
                if (!dateStr) {
                  dateStr = historyDateFormatter.format(log.timestamp);
                  historyDateCache.set(dateKey, dateStr);
                }

                return (
                  <li key={log.id} className="flex items-center gap-3 border-b border-aero-200/70 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="nums text-[15px] text-aero-800">
                        {log.weight}
                        <span className="text-aero-700"> lbs × </span>
                        {log.reps}
                        <span className="text-aero-700"> reps</span>
                        {(log.sets || 1) > 1 && (
                          <span className="text-aero-700"> · {log.sets} sets</span>
                        )}
                      </p>
                      <p className="text-[13px] text-aero-700">{dateStr}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.vibrate?.(10); onEdit(log); }}
                      className="btn-quiet shrink-0 p-2"
                      aria-label="Edit set"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        navigator.vibrate?.(10);
                        if (window.confirm('Delete this log?')) onDelete(log.id);
                      }}
                      className="btn-quiet shrink-0 p-2 active:text-rose-500"
                      aria-label="Delete set"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
    </Modal>
  );
};