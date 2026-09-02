import React, { useMemo, useState } from 'react';
import { Calendar, Dumbbell, Layers, Copy, Check, Download, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { WorkoutLog, ExerciseDef } from '../types';
import { logger } from '../utils/logger';
import { validateWorkoutLogs } from '../utils/validation';
import { EXERCISES } from '../constants';
import { getLocalDateKey } from '../utils/date';

interface GlobalHistoryModalProps {
  logs: WorkoutLog[];
  currentDayType: string | null;
  onClose: () => void;
  onImport: (logs: WorkoutLog[]) => void;
  customExercises: ExerciseDef[];
}


const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

export function calculateGlobalHistoryStats(
  logs: WorkoutLog[],
  currentDayType: string | null,
  allExercisesMap: Record<string, ExerciseDef>
) {
  const groups: Record<string, { log: WorkoutLog; exercise: ExerciseDef | undefined }[]> = {};
  const todayDateKey = getLocalDateKey(Date.now());
  const uniqueDays = new Set<string>();
  const todayExercises = new Set<string>();

  let totalVolume = 0;
  let todayVolume = 0;

  for (const log of logs) {
    const vol = log.weight * log.reps * (log.sets || 1);
    totalVolume += vol;

    const localDateKey = getLocalDateKey(log.timestamp);
    const displayDate = dateFormatter.format(log.timestamp);
    uniqueDays.add(localDateKey);

    if (!groups[displayDate]) groups[displayDate] = [];

    const exercise = allExercisesMap[log.exerciseId];
    groups[displayDate].push({ log, exercise });

    if (currentDayType && localDateKey === todayDateKey) {
      if (exercise?.dayType === currentDayType) {
        todayVolume += vol;
        todayExercises.add(log.exerciseId);
      }
    }
  }

  return {
    stats: {
      totalWorkouts: logs.length,
      totalVolume,
      totalDays: uniqueDays.size
    },
    todaySummary: currentDayType ? {
      volume: todayVolume,
      exercisesCount: todayExercises.size
    } : null,
    groupedLogs: groups
  };
}



function ImportLogsView({
  importText,
  setImportText,
  error,
  onImportSubmit
}: {
  importText: string;
  setImportText: (t: string) => void;
  error: string | null;
  onImportSubmit: () => void;
}) {
  return (
    <div className="p-6 flex-1 flex flex-col gap-4">
      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg text-sm text-blue-200">
        Paste your previously exported JSON data below to restore your history. This will merge with your current logs.
      </div>
      <textarea
        autoFocus
        aria-label="Workout history JSON"
        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 resize-none min-h-[200px]"
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
        onClick={onImportSubmit}
        className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20"
      >
        Import Logs
      </button>
    </div>
  );
}


function TodaySummaryCard({
  todaySummary,
  currentDayType
}: {
  todaySummary: { volume: number; exercisesCount: number; } | null;
  currentDayType: string | null;
}) {
  if (!todaySummary || !currentDayType) return null;
  return (
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
  );
}


function StatsSummaryRow({
  stats
}: {
  stats: { totalWorkouts: number; totalVolume: number; totalDays: number; }
}) {
  return (
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
  );
}


function ChronologicalLogList({
  groupedLogs
}: {
  groupedLogs: Record<string, { log: WorkoutLog; exercise: ExerciseDef | undefined }[]>
}) {
  return (
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
              {dayLogs.map((item) => {
                const log = item.log;
                const exercise = item.exercise;
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
  );
}


/** The journal's own header controls; the shell supplies the close button. */
function JournalHeaderActions({
  isImporting,
  setIsImporting,
  handleExport,
  copied,
  setError
}: {
  isImporting: boolean;
  setIsImporting: (val: boolean) => void;
  handleExport: () => void;
  copied: boolean;
  setError: (val: string | null) => void;
}) {
  return (
    <>
      {!isImporting ? (
        <>
          <button
            onClick={() => setIsImporting(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
            aria-label="Import Data"
            title="Import Data"
          >
            <Download size={20} />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-blue-400 text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-700 transition-all focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Export'}
          </button>
        </>
      ) : (
        <button
          onClick={() => { setIsImporting(false); setError(null); }}
          className="text-slate-400 hover:text-white text-sm font-medium px-2 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
          aria-label="Cancel import"
        >
          Cancel
        </button>
      )}
    </>
  );
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

  const { stats, todaySummary, groupedLogs } = useMemo(() => {
    // logs are already maintained in descending chronological order (newest first)
    return calculateGlobalHistoryStats(logs, currentDayType, allExercisesMap);
  }, [logs, currentDayType, allExercisesMap]);

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
      const validatedLogs = validateWorkoutLogs(parsed);

      onImport(validatedLogs);
      setIsImporting(false);
      setImportText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid JSON data.");
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={<><Calendar className="text-blue-500" size={20} />{isImporting ? 'Import Data' : 'Workout Journal'}</>}
      headerActions={
        <JournalHeaderActions
          isImporting={isImporting}
          setIsImporting={setIsImporting}
          handleExport={handleExport}
          copied={copied}
          setError={setError}
        />
      }
    >
        {isImporting ? (
          <ImportLogsView
            importText={importText}
            setImportText={setImportText}
            error={error}
            onImportSubmit={handleImportSubmit}
          />
        ) : (
          <>
            <TodaySummaryCard todaySummary={todaySummary} currentDayType={currentDayType} />
            <StatsSummaryRow stats={stats} />
            <ChronologicalLogList groupedLogs={groupedLogs} />
          </>
        )}
    </Modal>
  );
}
