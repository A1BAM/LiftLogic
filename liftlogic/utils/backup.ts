import { ExerciseDef, WorkoutLog } from '../types';
import { DEFINITION_ID, DEFINITION_ROW_PREFIX } from '../constants';
import { validateWorkoutLogs } from './validation';
import { validateExercise } from './exercise';

export { validateExercise };

/**
 * Backups and spreadsheet exports.
 *
 * The old export copied every logged set to the clipboard as pretty-printed
 * JSON, and nothing else: no exercise definitions, so a restore brought back
 * sets that pointed at exercises it had never heard of, and on a phone the
 * only place to put a few hundred kilobytes of clipboard was a note.
 *
 * A backup is now a file, and a complete one: every set, and every exercise
 * those sets belong to. Compact — no indentation, no fields that are always
 * the same — and with real dates, so it can be read as well as restored.
 */

export interface BackupSet {
  id: string;
  /** Present when a stored set had an ID reserved for exercise definitions. */
  originalSetId?: string;
  exerciseId: string;
  /** ISO 8601, so the file reads as dates rather than milliseconds. */
  at: string;
  weight: number;
  reps: number;
}

export interface Backup {
  app: 'liftlogic';
  version: 2;
  exportedAt: string;
  exercises: ExerciseDef[];
  sets: BackupSet[];
}

/** Older Workers accepted set IDs reserved for exercise definitions. Give
 * those stored sets stable, unused IDs when backing them up. Restoring the
 * same backup on the original device must still recognize the original set.
 */
function legacySetBackupIds(logs: WorkoutLog[]): Map<string, string> {
  const ids = new Set(logs.map(log => log.id));
  const aliases = new Map<string, string>();
  for (const id of [...ids].filter(id => id.startsWith(DEFINITION_ROW_PREFIX)).sort()) {
    const base = 'set_' + id.slice(DEFINITION_ROW_PREFIX.length);
    let alias = base;
    let n = 0;
    while (ids.has(alias)) {
      const suffix = '~' + ++n;
      alias = base.slice(0, 50 - suffix.length) + suffix;
    }
    ids.add(alias);
    aliases.set(id, alias);
  }
  return aliases;
}

export function buildBackup(
  logs: WorkoutLog[],
  exercises: ExerciseDef[],
  now = Date.now()
): Backup {
  const sets: BackupSet[] = [];
  const aliases = legacySetBackupIds(logs);
  // Oldest first: the order you would read a training log in.
  for (const log of [...logs].sort((a, b) => a.timestamp - b.timestamp)) {
    if (log.exerciseId === DEFINITION_ID || !Number.isFinite(log.timestamp)) continue;
    // A legacy row recording "3 sets" in one is written out as three sets, so
    // nothing in a backup depends on a field the app no longer uses.
    const count = Math.max(1, Math.floor(Number(log.sets)) || 1);
    const id = aliases.get(log.id) ?? log.id;
    for (let i = 0; i < count; i++) {
      sets.push({
        id: i === 0 ? id : `${id}~${i}`.slice(0, 50),
        ...(i === 0 && id !== log.id ? { originalSetId: log.id } : {}),
        exerciseId: log.exerciseId,
        at: new Date(log.timestamp).toISOString(),
        weight: log.weight,
        reps: log.reps
      });
    }
  }
  return {
    app: 'liftlogic',
    version: 2,
    exportedAt: new Date(now).toISOString(),
    exercises: [...exercises].sort((a, b) => a.name.localeCompare(b.name)),
    sets
  };
}

export const serializeBackup = (backup: Backup) => JSON.stringify(backup);

/**
 * A spreadsheet of every set, one row each, oldest first. Opens in Numbers,
 * Excel or Sheets as it is.
 */
export function buildCsv(logs: WorkoutLog[], exercises: Record<string, ExerciseDef>): string {
  const rows = [['Date', 'Time', 'Day', 'Exercise', 'Weight (lbs)', 'Reps']];
  const pad = (n: number) => String(n).padStart(2, '0');
  for (const log of [...logs].sort((a, b) => a.timestamp - b.timestamp)) {
    if (log.exerciseId === DEFINITION_ID || !Number.isFinite(log.timestamp)) continue;
    const d = new Date(log.timestamp);
    const ex = exercises[log.exerciseId];
    const day = ex ? ex.dayType.charAt(0) + ex.dayType.slice(1).toLowerCase() : '';
    const count = Math.max(1, Math.floor(Number(log.sets)) || 1);
    for (let i = 0; i < count; i++) {
      rows.push([
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        day,
        ex ? ex.name : 'Deleted exercise',
        String(log.weight),
        String(log.reps)
      ]);
    }
  }
  return rows.map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

function csvField(value: string): string {
  // A cell starting with = + - @ is run as a formula by spreadsheet apps. An
  // exercise is named by whoever typed it, so it is never allowed to be one.
  // Numbers are left alone: they are written by the app, not typed text.
  let v = value;
  if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export interface ParsedBackup {
  originalSetIds?: Map<string, string>;
  logs: WorkoutLog[];
  exercises: ExerciseDef[];
}

/**
 * Reads a backup: the current file format, or the bare array the old
 * clipboard export produced, so a copy saved in Notes years ago still
 * restores. Throws with a sentence a person can act on.
 */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That isn't a LiftLogic backup — the text is not valid JSON.");
  }

  if (Array.isArray(data)) {
    // The old export. Definition rows, if a hand-made file has them, carry an
    // exercise in their notes; everything else is a set.
    const exercises: ExerciseDef[] = [];
    const rows = data.filter(row => {
      const r = row as Record<string, unknown> | null;
      if (r && r.exerciseId === DEFINITION_ID) {
        try {
          const ex = validateExercise(JSON.parse(String(r.notes)));
          if (ex) exercises.push(ex);
        } catch {
          // An unreadable definition is skipped, not fatal.
        }
        return false;
      }
      return true;
    });
    const logs = validateWorkoutLogs(rows).map(l => ({ ...l, sets: 1, notes: undefined }));
    return { logs, exercises };
  }

  const backup = data as Partial<Backup> | null;
  if (!backup || backup.app !== 'liftlogic' || !Array.isArray(backup.sets)) {
    throw new Error("That isn't a LiftLogic backup.");
  }
  if (typeof backup.version !== 'number' || backup.version > 2) {
    throw new Error('This backup was made by a newer version of LiftLogic. Update the app, then try again.');
  }

  const originalSetIds = new Map<string, string>();
  const logs = validateWorkoutLogs(
    backup.sets.map(s => {
      const set = (s ?? {}) as Partial<BackupSet>;
      if (typeof set.id === 'string' && typeof set.originalSetId === 'string' &&
          set.originalSetId.startsWith(DEFINITION_ROW_PREFIX) && set.originalSetId.length <= 50) {
        originalSetIds.set(set.id, set.originalSetId);
      }
      return {
        id: set.id,
        exerciseId: set.exerciseId,
        timestamp: typeof set.at === 'string' ? Date.parse(set.at) : NaN,
        weight: set.weight,
        reps: set.reps,
        sets: 1
      };
    })
  );

  const exercises: ExerciseDef[] = [];
  for (const raw of Array.isArray(backup.exercises) ? backup.exercises : []) {
    const ex = validateExercise(raw);
    if (ex) exercises.push(ex);
  }
  return { logs, exercises, ...(originalSetIds.size > 0 ? { originalSetIds } : {}) };
}

/**
 * Hands a file to the person. On an iPhone that is the share sheet — Save to
 * Files, AirDrop, Mail — and anywhere else a download.
 *
 * Must be called straight from a tap, with nothing awaited first: Safari only
 * opens the share sheet for a user gesture it can still see.
 */
export async function deliverFile(
  name: string,
  type: string,
  contents: string
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([contents], name, { type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      // Refused for another reason: fall back to a plain download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari reads the blob after click() returns; revoking at once can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

/** Human size for the line under the button: "98 KB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
