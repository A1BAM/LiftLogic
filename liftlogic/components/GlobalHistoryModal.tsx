import { useMemo, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { WorkoutLog, ExerciseDef } from '../types';
import { logger } from '../utils/logger';
import { EXERCISES } from '../constants';
import { getLocalDateKey } from '../utils/date';
import {
  ParsedBackup,
  buildBackup,
  buildCsv,
  deliverFile,
  formatBytes,
  parseBackup,
  serializeBackup
} from '../utils/backup';

interface GlobalHistoryModalProps {
  logs: WorkoutLog[];
  currentDayType: string | null;
  onClose: () => void;
  /** Restores a backup. Resolves once it is saved; rejects if it was not. */
  onImport: (backup: ParsedBackup) => Promise<void> | void;
  customExercises: ExerciseDef[];
}


/** Days of history the journal renders at a time. */
const DAYS_PER_PAGE = 14;

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
  // The long-form date is formatted once per day, not once per set.
  const displayDates = new Map<string, string>();

  for (const log of logs) {
    const vol = log.weight * log.reps * (log.sets || 1);
    totalVolume += vol;

    const localDateKey = getLocalDateKey(log.timestamp);
    let displayDate = displayDates.get(localDateKey);
    if (displayDate === undefined) {
      displayDate = dateFormatter.format(log.timestamp);
      displayDates.set(localDateKey, displayDate);
    }
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



/** Largest file a restore will read; a decade of daily training is under 2 MB. */
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const today = () => getLocalDateKey(Date.now());

function BackupView({
  logs,
  exercises,
  exercisesById,
  onImport
}: {
  logs: WorkoutLog[];
  exercises: ExerciseDef[];
  exercisesById: Record<string, ExerciseDef>;
  onImport: (backup: ParsedBackup) => Promise<void> | void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Only exercises the sets refer to, plus any you made yourself: the built-in
  // ones you never logged are part of the app, not of your history.
  const backupText = useMemo(() => {
    const used = new Set(logs.map(l => l.exerciseId));
    const wanted = exercises.filter(e => used.has(e.id) || e.isCustom);
    return serializeBackup(buildBackup(logs, wanted));
  }, [logs, exercises]);
  const size = formatBytes(new TextEncoder().encode(backupText).length);

  const save = async (kind: 'backup' | 'csv') => {
    setError(null);
    try {
      if (kind === 'backup') {
        await deliverFile(`liftlogic-backup-${today()}.json`, 'application/json', backupText);
      } else {
        await deliverFile(`liftlogic-sets-${today()}.csv`, 'text/csv', buildCsv(logs, exercisesById));
      }
    } catch (err) {
      logger.error('Export failed:', err);
      setError('The file could not be saved. Try again from Safari.');
    }
  };

  const restore = async (text: string) => {
    setError(null);
    let parsed: ParsedBackup;
    try {
      parsed = parseBackup(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That isn't a LiftLogic backup.");
      return;
    }
    setBusy(true);
    try {
      await onImport(parsed);
      setPasted('');
      setPasting(false);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still fires
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError('That file is too large to be a LiftLogic backup.');
      return;
    }
    await restore(await file.text());
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <p className="text-[13px] uppercase tracking-[0.14em] text-cream-400">Save a copy</p>
      <button
        onClick={() => save('backup')}
        className="btn-primary mt-3 w-full py-3.5 text-[15px]"
      >
        Save backup file
      </button>
      <p className="nums mt-2 text-[14px] leading-relaxed text-cream-400">
        Every set and exercise, in one file you can restore from ·{' '}
        {logs.length.toLocaleString()} sets · {size}
      </p>
      <button
        onClick={() => save('csv')}
        className="btn-quiet mt-3 w-full border-ink-700 py-3 text-[15px]"
      >
        Export for a spreadsheet (CSV)
      </button>

      <p className="mt-8 text-[13px] uppercase tracking-[0.14em] text-cream-400">Restore</p>
      <p className="mt-2 text-[14px] leading-relaxed text-cream-400">
        Adds anything in the backup that is not already here. Nothing you have
        now is changed or removed.
      </p>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json,text/plain"
        onChange={onFile}
        className="hidden"
        aria-label="Backup file"
      />
      <button
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        className="btn-quiet mt-3 w-full border-ink-700 py-3 text-[15px]"
      >
        {busy ? 'Restoring…' : 'Restore from a file'}
      </button>

      {!pasting ? (
        <button
          onClick={() => setPasting(true)}
          className="btn-quiet mt-1 w-full py-3 text-[14px]"
        >
          Paste an older backup instead
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <textarea
            autoFocus
            aria-label="Backup text"
            className="well min-h-[160px] resize-none p-4 font-mono text-[16px] text-cream-200 focus:border-cream-600 focus:outline-none"
            placeholder="Paste the copied backup here"
            value={pasted}
            onChange={e => setPasted(e.target.value)}
          />
          <button
            onClick={() => (pasted.trim() ? restore(pasted) : setError('Paste a backup first.'))}
            disabled={busy}
            className="btn-quiet w-full border-ink-700 py-3 text-[15px]"
          >
            Restore pasted backup
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 text-[14px] text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
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
  // A year of logging is thousands of rows. Building them all just to show
  // the top of the list made the journal the slowest thing in the app to
  // open; the recent weeks are what it is opened for.
  const [shown, setShown] = useState(DAYS_PER_PAGE);
  return (
    <div className="flex-1 overflow-y-auto px-5">
      {days.length === 0 ? (
        <p className="py-6 text-[14px] text-cream-400">
          Nothing recorded yet. Log a set and it shows up here.
        </p>
      ) : (
        days.slice(0, shown).map(([date, dayLogs]) => (
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
      {days.length > shown && (
        <button
          onClick={() => setShown(n => n + DAYS_PER_PAGE)}
          className="btn-quiet my-4 w-full py-3 text-[14px]"
        >
          Show earlier days
        </button>
      )}
    </div>
  );
}


/** The journal's own header control; the shell supplies the close button. */
function JournalHeaderActions({
  inBackup,
  setInBackup
}: {
  inBackup: boolean;
  setInBackup: (val: boolean) => void;
}) {
  return (
    <button onClick={() => setInBackup(!inBackup)} className="btn-quiet px-3 text-[14px]">
      {inBackup ? 'Journal' : 'Backup'}
    </button>
  );
}

export function GlobalHistoryModal({
  onClose, 
  logs,
  currentDayType,
  onImport,
  customExercises
}: GlobalHistoryModalProps) {

  const [inBackup, setInBackup] = useState(false);

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

  return (
    <Modal
      onClose={onClose}
      title={inBackup ? 'Backup' : 'Journal'}
      headerActions={<JournalHeaderActions inBackup={inBackup} setInBackup={setInBackup} />}
    >
        {inBackup ? (
          <BackupView
            logs={logs}
            exercises={Object.values(allExercisesMap)}
            exercisesById={allExercisesMap}
            onImport={onImport}
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
