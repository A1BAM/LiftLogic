import { DayType } from '../types';

/**
 * Where you were, kept across a reload.
 *
 * iOS throws a Safari tab away when you switch to another app for a while and
 * loads the page from scratch when you come back. Nothing in the app can stop
 * that. What it can do is come back to the same place: the workout you were
 * in and the rest timer that was running, which is an end time, so it has
 * kept counting while the page was gone.
 */
const KEY = 'liftlogic_resume';

/** A workout left this long ago is over; reopening lands on the home screen. */
const DAY_TTL_MS = 4 * 60 * 60 * 1000;

const DAYS: DayType[] = ['PUSH', 'PULL', 'LEGS'];

export interface ResumeState {
  day: DayType | null;
  restEndTime: number | null;
  /** The cookie was good last time, so skip drawing the lock screen first. */
  signedIn: boolean;
}

const EMPTY: ResumeState = { day: null, restEndTime: null, signedIn: false };

export function loadResume(now = Date.now()): ResumeState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw) as Partial<ResumeState> & { savedAt?: number };
    const fresh = typeof saved.savedAt === 'number' && now - saved.savedAt < DAY_TTL_MS;
    const rest = Number(saved.restEndTime);
    return {
      day: fresh && DAYS.includes(saved.day as DayType) ? (saved.day as DayType) : null,
      // An end time in the past is a rest that finished while you were away.
      restEndTime: Number.isFinite(rest) && rest > now ? rest : null,
      signedIn: saved.signedIn === true
    };
  } catch {
    // Private mode or a corrupt entry: start clean rather than fail to load.
    return EMPTY;
  }
}

export function saveResume(state: ResumeState, now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: now }));
  } catch {
    // Storage full or blocked. Losing your place is the worst that happens.
  }
}
