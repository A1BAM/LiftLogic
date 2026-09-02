import React from 'react';
import { WorkoutLog, ExerciseDef } from '../types';
import { Trash2, Edit2, Layers } from 'lucide-react';
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
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Logs List */}
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="text-center text-slate-500 py-10">No history available yet.</div>
            ) : (
              logs.map((log) => {
                const d = new Date(log.timestamp);
                const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                let dateStr = historyDateCache.get(dateKey);
                if (!dateStr) {
                  dateStr = historyDateFormatter.format(log.timestamp);
                  historyDateCache.set(dateKey, dateStr);
                }

                return (
                  <div key={log.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center border border-slate-700">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">
                        {dateStr}
                      </div>
                      <div className="text-white font-mono font-medium">
                        <span className="text-lg">{log.weight}</span> lbs
                        <div className="text-sm text-slate-400 flex items-center gap-1">
                           <Layers size={12} /> {log.sets || 1} x {log.reps}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                     <button 
                      type="button"
                      onClick={() => {
                        navigator.vibrate?.(10);
                        onEdit(log);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
                      aria-label="Edit set"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.vibrate?.(10);
                        if(window.confirm('Delete this log?')) onDelete(log.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors focus-visible:ring-2 focus-visible:ring-red-500 outline-none"
                      aria-label="Delete set"
                    >
                      <Trash2 size={18} />
                    </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
    </Modal>
  );
};