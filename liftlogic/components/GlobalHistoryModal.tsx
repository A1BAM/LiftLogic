import React, { useMemo, useState } from 'react';
import { X, Calendar, Dumbbell, Layers, Copy, Check, Download, AlertCircle } from 'lucide-react';
import { WorkoutLog, ExerciseDef } from '../types';
import { logger } from '../utils/logger';
import { EXERCISES } from '../constants';

interface GlobalHistoryModalProps {
  logs: WorkoutLog[];
  currentDayType: string | null;
  onClose: () => void;
  onImport: (logs: WorkoutLog[]) => void;
  customExercises: ExerciseDef[];
}

export function GlobalHistoryModal({
  onClose, 
  logs,
  currentDayType,
  onImport,
  customExercises
}: GlobalHistoryModalProps) {
  const [copied, setCopied] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allExercisesMap = useMemo(() => {
    const combined: Record<string, ExerciseDef> = { ...EXERCISES };
    customExercises.forEach(ex => {
      combined[ex.id] = ex;
    });
    return combined;
  }, [customExercises]);

  const stats = useMemo(() => {
    const totalVolume = logs.reduce((acc, log) => acc + (log.weight * log.reps * (log.sets || 1)), 0);
    const uniqueDays = new Set(logs.map(log => new Date(log.timestamp).toDateString())).size;
    return {
      totalWorkouts: logs.length,
      totalVolume,
      totalDays: uniqueDays
    };
  }, [logs]);

  const todaySummary = useMemo(() => {
    if (!currentDayType) return null;
    const todayStr = new Date().toDateString();
    
    // Filter logs for today AND matching the current day type (Push/Pull)
    const todaysRelevantLogs = logs.filter(l => {
        const isToday = new Date(l.timestamp).toDateString() === todayStr;
        // Use map to check dayType safely
        const exercise = allExercisesMap[l.exerciseId];
        const isCorrectType = exercise?.dayType === currentDayType;
        return isToday && isCorrectType;
    });

    const volume = todaysRelevantLogs.reduce((acc, log) => acc + (log.weight * log.reps * (log.sets || 1)), 0);
    const exercisesCount = new Set(todaysRelevantLogs.map(l => l.exerciseId)).size;

    return { volume, exercisesCount };
  }, [logs, currentDayType, allExercisesMap]);

  const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);

  // Group by date
  const groupedLogs = useMemo(() => {
    const groups: Record<string, WorkoutLog[]> = {};
    const dateCache = new Map();

    sortedLogs.forEach(log => {
      const d = new Date(log.timestamp);
      const dayId = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

      let dateKey = dateCache.get(dayId);
      if (!dateKey) {
        dateKey = d.toLocaleDateString(undefined, {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        dateCache.set(dayId, dateKey);
      }

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return groups;
  }, [sortedLogs]);

  const handleExport = async () => {
    try {
      const dataStr = JSON.stringify(logs, null, 2);
      await navigator.clipboard.writeText(dataStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
      alert('Failed to copy data to clipboard');
    }
  };

  const handleImportSubmit = () => {
    setError(null);
    if (!importText.trim()) {
      setError("Please paste data first.");
      return;
    }

    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) {
        throw new Error("Data must be a list (array) of workouts.");
      }
      
      // Basic validation of first item to ensure it looks like a log
      if (parsed.length > 0) {
        const sample = parsed[0];
        if (!sample.id || !sample.exerciseId || !sample.timestamp) {
           throw new Error("Invalid data format. Missing required fields.");
        }
      }

      onImport(parsed as WorkoutLog[]);
      setIsImporting(false);
      setImportText('');
    } catch (err: any) {
      setError(err.message || "Invalid JSON data.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-blue-500" size={20} />
            {isImporting ? 'Import Data' : 'Workout Journal'}
          </h2>
          <div className="flex items-center gap-2">
            {!isImporting ? (
              <>
                <button 
                  onClick={() => setIsImporting(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                  title="Import Data"
                  aria-label="Import data"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-blue-400 text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Export'}
                </button>
              </>
            ) : (
              <button 
                onClick={() => { setIsImporting(false); setError(null); }}
                className="text-slate-400 hover:text-white text-sm font-medium px-2"
              >
                Cancel
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {isImporting ? (
           <div className="p-6 flex-1 flex flex-col gap-4">
             <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg text-sm text-blue-200">
               Paste your previously exported JSON data below to restore your history. This will merge with your current logs.
             </div>
             <textarea 
               className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500 resize-none min-h-[200px]"
               placeholder='[{"id":"...", "weight": 20, ...}]'
               value={importText}
               onChange={(e) => setImportText(e.target.value)}
             />
             {error && (
               <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-900/50">
                 <AlertCircle size={16} /> {error}
               </div>
             )}
             <button 
               onClick={handleImportSubmit}
               className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20"
             >
               Import Logs
             </button>
           </div>
        ) : (
          <>
            {/* Today's Summary (Conditional) */}
            {todaySummary && (
              <div className="mx-4 mt-4 bg-gradient-to-r from-blue-900/40 to-slate-800 border border-blue-500/30 rounded-xl p-4 flex justify-between items-center shadow-lg">
                <div>
                  <h3 className="text-blue-200 font-bold text-sm uppercase tracking-wider mb-1">Today's {currentDayType} Session</h3>
                  <div className="text-xs text-blue-400/80 font-medium">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white font-mono">{(todaySummary.volume / 1000).toFixed(1)}k <span className="text-sm text-slate-400 font-sans">lbs</span></div>
                  <div className="text-xs text-slate-300">{todaySummary.exercisesCount} Exercises Completed</div>
                </div>
              </div>
            )}

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-2 p-4 bg-slate-800/30 border-b border-slate-800">
              <div className="bg-slate-800 p-3 rounded-lg text-center border border-slate-700">
                <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Workouts</div>
                <div className="text-xl font-bold text-white">{stats.totalWorkouts}</div>
              </div>
              <div className="bg-slate-800 p-3 rounded-lg text-center border border-slate-700">
                 <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Total Volume</div>
                 <div className="text-xl font-bold text-blue-400">{(stats.totalVolume / 1000).toFixed(1)}k</div>
                 <div className="text-[9px] text-slate-500">lbs moved</div>
              </div>
              <div className="bg-slate-800 p-3 rounded-lg text-center border border-slate-700">
                 <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Active Days</div>
                 <div className="text-xl font-bold text-white">{stats.totalDays}</div>
              </div>
            </div>

            {/* Chronological List */}
            <div className="overflow-y-auto flex-1 p-4 space-y-6">
              {Object.entries(groupedLogs).length === 0 ? (
                 <div className="text-center text-slate-500 py-10 flex flex-col items-center">
                   <Dumbbell size={48} className="opacity-20 mb-4" />
                   <p>No workouts recorded yet.</p>
                   <p className="text-xs mt-2">Start lifting to see your history!</p>
                 </div>
              ) : (
                Object.entries(groupedLogs).map(([date, dayLogs]) => (
                  <div key={date}>
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 sticky top-0 bg-slate-900 py-2 z-10 border-b border-slate-800/50 backdrop-blur-sm">
                      {date}
                    </h3>
                    <div className="space-y-2">
                      {(dayLogs as WorkoutLog[]).map(log => {
                        const exercise = allExercisesMap[log.exerciseId];
                        return (
                          <div key={log.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-center hover:border-slate-600 transition-colors">
                            <div>
                              <div className={`font-bold ${exercise ? 'text-slate-200' : 'text-slate-500 italic'}`}>
                                {exercise ? exercise.name : 'Unknown Exercise (Deleted)'}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-1">
                                {exercise?.muscleGroup}
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <div className="text-white font-bold text-lg">
                                {log.weight}<span className="text-sm text-slate-500 ml-1">lbs</span>
                              </div>
                              <div className="text-xs text-slate-400 flex items-center justify-end gap-1">
                                 <Layers size={10} /> {log.sets || 1} x {log.reps}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
