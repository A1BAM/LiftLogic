import { useMemo, useState } from 'react';
import { Copy, Check, Download, AlertCircle } from 'lucide-react';
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
      <div className="rounded-xl border border-ink-700 bg-ink-800 p-4 text-[14px] leading-relaxed text-cream-400">
        Paste your previously exported JSON data below to restore your history. This will merge with your current logs.
      </div>
      <textarea
        autoFocus
        aria-label="Workout history JSON"
        className="flex-1 bg-ink-800 border border-ink-700 rounded-xl p-4 text-[16px] font-mono text-cream-400 focus:outline-none focus:border-cream-600 focus-visible:ring-2 focus-visible:ring-cream-50 resize-none min-h-[200px]"
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
        className="btn-primary w-full py-3.5 text-[15px]"
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
    <p className="nums px-5 pb-4 text-[14px] text-cream-400">
      Today&rsquo;s {currentDayType.toLowerCase()}:{' '}
      <span className="text-cream-50">
        {todaySummary.exercisesCount} {todaySummary.exercisesCount === 1 ? 'exercise' : 'exercises'}
      </span>{' '}
      ·{' '}
      <span className="text-cream-50">{(todaySummary.volume / 1000).toFixed(1)}k lbs</span> moved
    </p>
  );
}


function StatsSummaryRow({
  stats
}: {
  stats: { totalWorkouts: number; totalVolume: number; totalDays: number; }
}) {
  const figures = [
    { label: 'sets', value: String(stats.totalWorkouts) },
    { label: 'days', value: String(stats.totalDays) },
    { label: 'lbs moved', value: `${(stats.totalVolume / 1000).toFixed(1)}k` }
  ];
  return (
    <div className="flex gap-8 border-y border-ink-700 px-5 py-4">
      {figures.map(f => (
        <div key={f.label}>
          <div className="nums text-[22px] font-medium leading-none text-cream-50">{f.value}</div>
          <div className="mt-1.5 text-[13px] text-cream-400">{f.label}</div>
        </div>
      ))}
    </div>
  );
}


function ChronologicalLogList({
  groupedLogs
}: {
  groupedLogs: Record<string, { log: WorkoutLog; exercise: ExerciseDef | undefined }[]>
}) {
  const days = Object.entries(groupedLogs);
  return (
    <div className="flex-1 overflow-y-auto px-5">
      {days.length === 0 ? (
        <p className="py-6 text-[14px] text-cream-400">
          Nothing recorded yet. Log a set and it shows up here.
        </p>
      ) : (
        days.map(([date, dayLogs]) => (
          <section key={date} className="pt-5">
            <h3 className="sticky top-0 z-10 bg-ink-800 pb-2 text-[13px] text-cream-400">{date}</h3>
            <ul>
              {dayLogs.map(({ log, exercise }) => (
                <li key={log.id} className="flex items-baseline gap-3 border-b border-ink-700 py-2.5 last:border-b-0">
                  <span className={`min-w-0 flex-1 truncate text-[15px] ${exercise ? 'text-cream-50' : 'italic text-cream-400'}`}>
                    {exercise ? exercise.name : 'Deleted exercise'}
                  </span>
                  <span className="nums shrink-0 text-[14px] text-cream-400">
                    {log.weight}
                    <span className="text-cream-400"> × </span>
                    {(log.sets || 1) > 1 ? `${log.sets}×${log.reps}` : log.reps}
                  </span>
                </li>
              ))}
            </ul>
          </section>
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
            className="p-2 text-cream-400 hover:text-cream-50 hover:bg-ink-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-cream-50 outline-none"
            aria-label="Import Data"
            title="Import Data"
          >
            <Download size={20} />
          </button>
          <button
            onClick={handleExport}
            className="btn-quiet flex items-center gap-1.5 px-2 py-1.5 text-[14px]"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Export'}
          </button>
        </>
      ) : (
        <button
          onClick={() => { setIsImporting(false); setError(null); }}
          className="text-cream-400 hover:text-cream-50 text-sm font-medium px-2 rounded-lg focus-visible:ring-2 focus-visible:ring-cream-50 outline-none"
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
      title={isImporting ? 'Import data' : 'Journal'}
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
