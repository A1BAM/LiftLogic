import React, { useState, useEffect } from 'react';
import { ExerciseDef, WorkoutLog } from '../types';
import { X, Plus, Minus, Trash2, History } from 'lucide-react';

interface LogModalProps {
  exercise: ExerciseDef;
  todaysLogs: WorkoutLog[];
  lastSessionLogs?: WorkoutLog[]; // Logs from the previous session (not today)
  onClose: () => void;
  onSave: (data: { weight: number; reps: number; sets: number }) => void;
  onDelete: (logId: string) => void;
}

export const LogModal: React.FC<LogModalProps> = ({ 
  exercise, 
  todaysLogs,
  lastSessionLogs,
  onClose, 
  onSave,
  onDelete
}) => {
  // Determine default values for the input form
  // 1. If we just logged a set today, copy that weight/reps for convenience
  // 2. If no logs today, use the LAST session's weight and Target Reps
  // 3. Fallback to defaults
  const getLastLog = () => {
    if (todaysLogs.length > 0) return todaysLogs[todaysLogs.length - 1];
    if (lastSessionLogs && lastSessionLogs.length > 0) return lastSessionLogs[0];
    return null;
  };

  const defaults = getLastLog();

  const [weight, setWeight] = useState(defaults ? defaults.weight : exercise.defaultWeight);
  const [reps, setReps] = useState(defaults ? defaults.reps : exercise.targetReps);

  const adjustWeight = (delta: number) => setWeight(Math.max(0, weight + delta));
  const adjustReps = (delta: number) => setReps(Math.max(1, reps + delta));

  const handleAddSet = (e: React.FormEvent) => {
    e.preventDefault();
    // Always save as 1 set when using this granular logger
    onSave({ weight, reps, sets: 1 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-md sm:rounded-2xl border-t sm:border border-slate-700 flex flex-col max-h-[90vh] shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">{exercise.name}</h2>
            <p className="text-xs text-slate-400">Log each set individually</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Today's Sets List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Today's Sets</h3>
            {todaysLogs.length === 0 ? (
              <div className="text-sm text-slate-600 italic text-center py-4 border border-dashed border-slate-800 rounded-xl">
                No sets logged yet today.
              </div>
            ) : (
              todaysLogs.map((log, index) => (
                <div key={log.id} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700 animate-in slide-in-from-left-2 fade-in">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2 py-1 rounded">
                      Set {index + 1}
                    </span>
                    <div className="text-white font-mono font-medium">
                      <span className="text-lg">{log.weight}</span> <span className="text-xs text-slate-500">lbs</span>
                      <span className="mx-2 text-slate-600">x</span>
                      <span className="text-lg">{log.reps}</span> <span className="text-xs text-slate-500">reps</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDelete(log.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
                    aria-label={`Delete set ${index + 1}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleAddSet} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner">
             <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-4 text-center">New Set</h3>
             
             <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Weight */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <label htmlFor="weight-input" className="block text-slate-500 text-[10px] font-bold uppercase mb-2 text-center">Weight</label>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => adjustWeight(-5)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-label="Decrease weight by 5"
                    >
                      <Minus size={16} />
                    </button>
                    <div id="weight-input" className="text-xl font-bold text-white font-mono" aria-live="polite">{weight}</div>
                    <button
                      type="button"
                      onClick={() => adjustWeight(5)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-label="Increase weight by 5"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Reps */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <label htmlFor="reps-input" className="block text-slate-500 text-[10px] font-bold uppercase mb-2 text-center">Reps</label>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => adjustReps(-1)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-label="Decrease reps"
                    >
                      <Minus size={16} />
                    </button>
                    <div id="reps-input" className="text-xl font-bold text-white font-mono" aria-live="polite">{reps}</div>
                    <button
                      type="button"
                      onClick={() => adjustReps(1)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-label="Increase reps"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
             </div>

             <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-400 transition-all"
            >
              <Plus size={20} />
              Add Set
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};