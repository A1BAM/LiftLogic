import { ExerciseDef, ProgressionRecommendation, WorkoutLog } from './types';

/**
 * What to put on the bar next, worked out from your own history.
 *
 * Everything here is arithmetic on logged sets — no network, no model. The
 * pieces, in the order they are applied:
 *
 * 1. Strength estimate. Each set is turned into an estimated one-rep max with
 *    Epley's formula, e1RM = weight × (1 + reps / 30), and a session is
 *    summarised by the MEDIAN of its sets. The first set flatters you and the
 *    last one is fatigue; the middle one is what a working set really is.
 *
 * 2. Time off. Strength holds for about two weeks and then drifts down
 *    slowly. The drift is 0.1% a day past day 14, capped at 15%. That rate
 *    comes from the log itself: the six-week gaps in it cost 0–3%, which is
 *    what this predicts.
 *
 * 3. The jump. Epley run backwards says how many reps a strength estimate is
 *    worth at another weight: reps = 30 × (e1RM / weight − 1). You move up
 *    only when the next weight is still worth the bottom of the rep range.
 *    That is why 30 lb curls for 12 do not earn 35s (a 17% step, worth about
 *    6 reps — the log shows 8, 4, 1 the day it was tried) but do earn 32.5s.
 *
 * 4. The next weight is one you can load: the nearest weight you have actually
 *    logged for this lift, or one increment, whichever is closer.
 *
 * 5. Backing off. Two sessions running where even your best set misses the
 *    bottom of the range means the weight is ahead of you. It drops to
 *    whatever the estimate says is worth the middle of the range. A good
 *    first set followed by a slide is fatigue, not a reason to drop.
 *
 * Height and bodyweight are deliberately not inputs. They help guess a
 * stranger's starting point; once a lift has even one logged session, that
 * session predicts the next one far better than any body measurement.
 */

export interface Session {
  /** Local midnight of the day the sets were logged. */
  dayStart: number;
  logs: WorkoutLog[];
}

export interface ProgressionInput {
  /** Sessions strictly before today, newest first. */
  sessions: Session[];
  targetSets: number;
  /** Inclusive rep range, e.g. [8, 10]. */
  repRange: [number, number];
  /** The lift's nominal step, used when the log offers nothing finer. */
  increment: number;
  defaultWeight: number;
  /** Local midnight today. */
  todayStart: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days of no training before strength starts to drift. */
const GRACE_DAYS = 14;
/** Fraction of strength lost per day after the grace period. */
const DECAY_PER_DAY = 0.001;
const MAX_DECAY = 0.15;
/** A gap longer than this is treated as a comeback, not a normal week. */
const LAYOFF_DAYS = 21;
/** A deload never takes more than this off in one go. */
const MAX_DELOAD = 0.2;

export const epley = (weight: number, reps: number) => weight * (1 + reps / 30);

/** Reps a strength estimate is worth at a given weight (Epley, inverted). */
export const repsAt = (e1rm: number, weight: number) => 30 * (e1rm / weight - 1);

/** Share of strength kept after a number of days away from a lift. */
export function retention(daysAway: number): number {
  const lost = Math.max(0, daysAway - GRACE_DAYS) * DECAY_PER_DAY;
  return 1 - Math.min(MAX_DECAY, lost);
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Buckets one exercise's logs by local calendar day, newest day first, with
 * each day's sets newest first. Does not assume any input ordering, and drops
 * rows for other exercises rather than trusting the caller to have filtered.
 */
export function groupSessions(logs: WorkoutLog[], exerciseId: string): Session[] {
  const buckets = new Map<number, Session>();
  for (const log of logs) {
    if (log.exerciseId !== exerciseId) continue;
    if (!Number.isFinite(log.timestamp)) continue; // corrupt row
    const d = new Date(log.timestamp);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let bucket = buckets.get(dayStart);
    if (!bucket) {
      bucket = { dayStart, logs: [] };
      buckets.set(dayStart, bucket);
    }
    bucket.logs.push(log);
  }
  const sessions = Array.from(buckets.values()).sort((a, b) => b.dayStart - a.dayStart);
  for (const s of sessions) s.logs.sort((a, b) => b.timestamp - a.timestamp);
  return sessions;
}

interface SetEntry {
  weight: number;
  reps: number;
}

/** A session as individual sets. A legacy row with sets > 1 is that many. */
function setsOf(session: Session): SetEntry[] {
  const out: SetEntry[] = [];
  for (const log of session.logs) {
    const weight = Number(log.weight);
    const reps = Number(log.reps);
    if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps < 1) continue;
    const n = Math.floor(Number(log.sets));
    const count = Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 1;
    for (let i = 0; i < count; i++) out.push({ weight, reps });
  }
  return out;
}

/**
 * The weight a session was really about: the one most sets were done at,
 * heavier on a tie. A ramp-up set or a drop set does not redefine the day.
 */
function workingWeight(sets: SetEntry[]): number {
  const counts = new Map<number, number>();
  for (const s of sets) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [w, c] of counts) {
    if (c > bestCount || (c === bestCount && w > best)) {
      best = w;
      bestCount = c;
    }
  }
  return best;
}

interface Summary {
  weight: number;
  /** Reps of each set done at the working weight. */
  reps: number[];
  medianReps: number;
  minReps: number;
  bestReps: number;
  setCount: number;
  e1rm: number;
}

function summarise(session: Session): Summary | null {
  const sets = setsOf(session);
  if (sets.length === 0) return null;
  const weight = workingWeight(sets);
  const reps = sets.filter(s => s.weight === weight).map(s => s.reps);
  return {
    weight,
    reps,
    medianReps: Math.floor(median(reps)),
    minReps: Math.min(...reps),
    bestReps: Math.max(...reps),
    setCount: sets.length,
    e1rm: median(sets.map(s => epley(s.weight, s.reps)))
  };
}

/** The weight a past session was done at, for comparing against a target. */
export function sessionWeight(session: Session): number {
  return summarise(session)?.weight ?? 0;
}

const lbs = (n: number) => `${n} lbs`;

export function recommendNext(input: ProgressionInput): ProgressionRecommendation {
  const { sessions, targetSets, increment, defaultWeight, todayStart } = input;
  const [lo, hi] = input.repRange;

  const summaries = sessions
    .map(s => ({ session: s, summary: summarise(s) }))
    .filter((x): x is { session: Session; summary: Summary } => x.summary !== null);

  if (summaries.length === 0) {
    return {
      weight: defaultWeight,
      reps: lo,
      reason: 'First time on this one — start light and keep it clean.'
    };
  }

  const last = summaries[0].summary;
  const W = last.weight;
  const daysAway = Math.round((todayStart - summaries[0].session.dayStart) / DAY_MS);

  // A bodyweight movement has nothing to scale, so it progresses on reps alone.
  if (W <= 0) {
    return {
      weight: 0,
      reps: last.medianReps + 1,
      reason: `One more than last time's ${last.medianReps}.`
    };
  }

  // Weights this lift has actually been done at. A dumbbell rack that goes
  // 30, 32.5, 35 shows up here even though the lift's increment says 5.
  const known = new Set<number>();
  for (const { session } of summaries) for (const s of setsOf(session)) known.add(s.weight);
  const step = increment > 0 ? increment : 5;
  const stepUp = (w: number) => {
    let next = w + step;
    for (const k of known) if (k > w && k < next) next = k;
    return next;
  };
  const stepDown = (w: number) => {
    let next = w - step;
    for (const k of known) if (k < w && k > next) next = k;
    return next;
  };

  // Rounded, not floored: 7.8 predicted reps is an 8, not a 7.
  const wholeReps = (e1rm: number, w: number) => Math.round(repsAt(e1rm, w));
  // The bottom of the range, to the nearest rep.
  const worthIt = (e1rm: number, w: number) => repsAt(e1rm, w) >= lo - 0.5;

  // --- Coming back after time off -----------------------------------------
  if (daysAway > LAYOFF_DAYS) {
    const e = last.e1rm * retention(daysAway);
    let w = W;
    while (!worthIt(e, w) && stepDown(w) > 0 && stepDown(w) >= W * (1 - MAX_DELOAD)) {
      w = stepDown(w);
    }
    const weeks = Math.round(daysAway / 7);
    return {
      weight: w,
      reps: clamp(wholeReps(e, w), lo, hi),
      reason:
        w === W
          ? `${weeks} weeks since this lift — same weight, and a rep short of last time is normal.`
          : `${weeks} weeks since this lift — ease back in at ${lbs(w)}, down from ${W}.`
    };
  }

  // --- Unfinished business ------------------------------------------------
  if (last.setCount < targetSets) {
    return {
      weight: W,
      reps: clamp(last.medianReps, lo, hi),
      reason: `Last time stopped at ${last.setCount} ${last.setCount === 1 ? 'set' : 'sets'} — get all ${targetSets} in.`
    };
  }

  // --- The weight is ahead of you ----------------------------------------
  const prev = summaries[1]?.summary;
  // Judged on the BEST set, not the typical one. A strong first set followed
  // by a slide is fatigue, and the answer to that is holding the weight; only
  // when even the fresh set misses the range is the weight itself too heavy.
  if (prev && last.bestReps < lo && prev.bestReps < lo && prev.weight >= W) {
    const mid = (lo + hi) / 2;
    let w = stepDown(W);
    while (repsAt(last.e1rm, w) < mid && stepDown(w) > 0 && stepDown(w) >= W * (1 - MAX_DELOAD)) {
      w = stepDown(w);
    }
    if (w > 0) {
      return {
        weight: w,
        reps: clamp(wholeReps(last.e1rm, w), lo, hi),
        reason: `Two sessions short of ${lo} reps at ${W} — drop to ${lbs(w)} and build back up.`
      };
    }
  }

  // --- Earning the next weight -------------------------------------------
  const next = stepUp(W);
  if (last.minReps >= lo && worthIt(last.e1rm, next)) {
    // A second step only when there is clearly room for it: a full rep above
    // the bottom of the range, and no more than a fifth heavier in one go.
    const further = stepUp(next);
    const target =
      repsAt(last.e1rm, further) >= lo + 1 && further <= W * 1.2 ? further : next;
    return {
      weight: target,
      reps: clamp(wholeReps(last.e1rm, target), lo, hi),
      reason: `${last.medianReps} reps at ${W} is worth about ${wholeReps(last.e1rm, target)} at ${target} — move up.`
    };
  }

  // --- Same weight, more reps --------------------------------------------
  if (last.medianReps < lo) {
    return {
      weight: W,
      reps: lo,
      reason: `Last time came up short of ${lo} — same weight, get every set there.`
    };
  }
  if (last.minReps < lo) {
    return {
      weight: W,
      reps: clamp(last.medianReps, lo, hi),
      reason: `Your last set fell to ${last.minReps}. Hold ${lbs(W)} until every set clears ${lo}.`
    };
  }
  // Reps at this weight that make the next one worth the bottom of the range.
  const needed = Math.ceil(30 * ((next * (1 + (lo - 0.5) / 30)) / W - 1));
  return {
    weight: W,
    // Past the top of the range on purpose when the next weight is a big step.
    reps: Math.min(needed, last.medianReps + 1),
    reason: `Add a rep. ${needed} at ${W} earns the move to ${lbs(next)}.`
  };
}

/**
 * The recommendation for a lift as the app holds it. Only sessions before
 * today feed the maths: a future-dated row cannot become the reference, and
 * today's sets do not move today's target. A lift outside the plan gets a
 * two-rep range ending on its own target.
 */
export function recommendFor(
  exercise: ExerciseDef,
  sessions: Session[],
  slot: { sets: number; reps: [number, number] } | undefined,
  todayStart: number
): ProgressionRecommendation {
  return recommendNext({
    sessions: sessions.filter(s => s.dayStart < todayStart),
    targetSets: slot?.sets ?? 3,
    repRange: slot?.reps ?? [Math.max(1, exercise.targetReps - 2), exercise.targetReps],
    increment: exercise.increment,
    defaultWeight: exercise.defaultWeight,
    todayStart
  });
}
