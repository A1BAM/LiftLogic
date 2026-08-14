import { WorkoutLog } from './types';

// Legacy session parsing with Date instantiations
export function legacySessions(exerciseLogs: WorkoutLog[]) {
  const sessionsArr: { date: string; logs: WorkoutLog[] }[] = [];
  let currentDayStart = -1;
  let currentSession: { date: string; logs: WorkoutLog[] } | null = null;

  for (const log of exerciseLogs) {
    if (log.timestamp < currentDayStart || !currentSession) {
      const d = new Date(log.timestamp);
      currentSession = { date: d.toDateString(), logs: [] };
      sessionsArr.push(currentSession);

      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      currentDayStart = startOfDay.getTime();
    }
    currentSession.logs.push(log);
  }
  return sessionsArr;
}

const testCache = new Map<number, string>();
export function optimizedSessions(exerciseLogs: WorkoutLog[]) {
  const sessionsArr: { date: string; logs: WorkoutLog[] }[] = [];
  let currentDayStart = -1;
  let currentSession: { date: string; logs: WorkoutLog[] } | null = null;

  for (const log of exerciseLogs) {
    if (log.timestamp < currentDayStart || !currentSession) {
      const d = new Date(log.timestamp);
      const localOffsetMs = d.getTimezoneOffset() * 60000;
      const dayId = Math.floor((log.timestamp - localOffsetMs) / 86400000);
      let dateStr = testCache.get(dayId);
      if (!dateStr) {
        dateStr = d.toDateString();
        testCache.set(dayId, dateStr);
      }

      currentSession = { date: dateStr, logs: [] };
      sessionsArr.push(currentSession);

      currentDayStart = dayId * 86400000 + localOffsetMs;
    }
    currentSession.logs.push(log);
  }
  return sessionsArr;
}

const testCache2 = new Map<number, string>();
export function moreOptimizedSessions(exerciseLogs: WorkoutLog[]) {
  const sessionsArr: { date: string; logs: WorkoutLog[] }[] = [];
  let currentDayStart = -1;
  let currentSession: { date: string; logs: WorkoutLog[] } | null = null;
  const d = new Date(); // instantiate once

  for (const log of exerciseLogs) {
    if (log.timestamp < currentDayStart || !currentSession) {
      d.setTime(log.timestamp);
      const localOffsetMs = d.getTimezoneOffset() * 60000;
      const dayId = Math.floor((log.timestamp - localOffsetMs) / 86400000);
      let dateStr = testCache2.get(dayId);
      if (!dateStr) {
        dateStr = d.toDateString();
        testCache2.set(dayId, dateStr);
      }

      currentSession = { date: dateStr, logs: [] };
      sessionsArr.push(currentSession);

      currentDayStart = dayId * 86400000 + localOffsetMs;
    }
    currentSession.logs.push(log);
  }
  return sessionsArr;
}
