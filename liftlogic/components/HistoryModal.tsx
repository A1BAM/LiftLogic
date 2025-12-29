import React, { useState, useMemo } from 'react';
import { WorkoutLog, ExerciseDef } from '../types';
import { X, Trash2, Edit2, BrainCircuit, Layers } from 'lucide-react';
import { getWorkoutInsight } from '../services/geminiService';

interface HistoryModalProps {
  exercise: ExerciseDef;
  logs: WorkoutLog[];
  onClose: () => void;
  onDelete: (logId: string) => void;
  onEdit: (log: WorkoutLog) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ 
  exercise, 
  logs, 
  onClose, 
  onDelete,
  onEdit
}) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const filteredLogs = useMemo(() => logs
    .filter(log => log.exerciseId === exercise.id)
    .sort((a, b) => b.timestamp - a.timestamp), [logs, exercise.id]);

  const handleGetInsight = async () => {
    setLoadingInsight(true);
    const result = await getWorkoutInsight(logs, exercise);
    setInsight(result);
    setLoadingInsight(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white">{exercise.name} History</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          
          {/* AI Insight Section */}
          <div className="bg-indigo-900/10 border border-indigo-900/30 rounded-xl p-4">
            {!insight ? (
              <button 
                onClick={handleGetInsight}
                disabled={loadingInsight}
                className="flex items-center gap-2 text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors w-full justify-center py-2 border border-dashed border-indigo-700/50 rounded-lg hover:bg-indigo-900/30"
              >
                <BrainCircuit size={16} />
                {loadingInsight ? "Analyzing..." : "Analyze Progress with AI"}
              </button>
            ) : (
              <div className="text-sm text-indigo-200">
                <div className="flex gap-2 items-center mb-2 text-indigo-400 font-bold uppercase text-xs">
                  <BrainCircuit size={12} /> Coach Insight
                </div>
                {insight}
              </div>
            )}
          </div>

          {/* Logs List */}
          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-slate-500 py-10">No history available yet.</div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center border border-slate-700">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      {new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
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
                      onClick={() => onEdit(log)}
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if(window.confirm('Delete this log?')) onDelete(log.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};