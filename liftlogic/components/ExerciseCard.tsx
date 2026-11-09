import React, { useMemo, useState } from 'react';
import { ExerciseDef, WorkoutLog, ProgressionRecommendation } from '../types';
import { History, Check, ArrowRightLeft, Archive } from 'lucide-react';
import { PlanSlot, WARMUP, warmupWeight, formatReps, formatRest } from '../workoutPlan';

interface ExerciseCardProps {
  exercise: ExerciseDef;
  exerciseLogs: WorkoutLog[]; // All logs for this exercise
  onLogClick: (exercise: ExerciseDef) => void;
  onHistoryClick: (exercise: ExerciseDef) => void;
  onArchive?: (exercise: ExerciseDef) => void;
  onSwitch?: (exercise: ExerciseDef) => void;
  /** Prescription for this slot, when the day has a fixed plan. */
  slot?: PlanSlot;
  /** 1-based position in the day, shown so the card matches the list below. */
  position?: number;
  /** The warm-up belongs to the first exercise of the day only. */
  showWarmup?: boolean;
}

/** A log row always counts as at least one set, whatever a legacy row says. */
const countSets = (logs: WorkoutLog[]) =>
  logs.reduce((acc, log) => {
    const n = Math.floor(Number(log.sets));
    return acc + (Number.isFinite(n) && n > 0 ? n : 1);
  }, 0);

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/**
 * The lift you are on. Everything here answers one of three questions: what am
 * I doing, what did I do last time, and what should I put on the bar. Anything
 * that answered none of them has been taken out.
 */
export const ExerciseCard: React.FC<ExerciseCardProps> = React.memo(({
  exercise,
  exerciseLogs,
  onLogClick,
  onHistoryClick,
  onArchive,
  onSwitch,
  slot,
  position,
  showWarmup = false
}) => {
  // Ticked off in the session only. Deliberately not persisted: a warm-up is
  // guidance for right now, not history worth keeping.
  const [warmupDone, setWarmupDone] = useState<Record<string, boolean>>({});
  const toggleWarmup = (key: string) =>
    setWarmupDone(prev => ({ ...prev, [key]: !prev[key] }));

  // 1. Organize logs into sessions (grouped by calendar day)
  // Logs are bucketed by local calendar day and then ordered newest-first. This does
  // not assume any particular input ordering: an out-of-order array would previously
  // collapse a whole history into one "session", which made unrelated days look like
  // a single completed workout.
  const sessions = useMemo(() => {
    const buckets = new Map<number, { dayStart: number; logs: WorkoutLog[] }>();

    for (const log of exerciseLogs) {
      // This prop means "logs for this exercise". Enforce it rather than trust
      // it: a caller passing the unfiltered log list would otherwise sum other
      // exercises' sets into today's total and take the progression target from
      // an unrelated lift's session.
      if (log.exerciseId !== exercise.id) continue;
      if (!Number.isFinite(log.timestamp)) continue; // Ignore corrupt rows
      const d = new Date(log.timestamp);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      let bucket = buckets.get(dayStart);
      if (!bucket) {
        bucket = { dayStart, logs: [] };
        buckets.set(dayStart, bucket);
      }
      bucket.logs.push(log);
    }

    const sessionsArr = Array.from(buckets.values());
    sessionsArr.sort((a, b) => b.dayStart - a.dayStart);
    for (const session of sessionsArr) {
      session.logs.sort((a, b) => b.timestamp - a.timestamp);
    }
    return sessionsArr;
  }, [exerciseLogs, exercise.id]);

  // 2. Identify "Today's Session" and "Reference Session" (for goal calc)
  // Matched on the day boundary rather than by array position, so a future-dated row
  // (clock skew, bad import) can neither masquerade as today nor become the reference.
  const todayStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);
  const todaySession = useMemo(
    () => sessions.find(s => s.dayStart === todayStart),
    [sessions, todayStart]
  );
  // The reference is the most recent session strictly before today.
  const referenceSession = useMemo(
    () => sessions.find(s => s.dayStart < todayStart),
    [sessions, todayStart]
  );

  // The plan drives sets and reps where it applies, so the card and the
  // progression agree with what the day actually prescribes.
  const targetSetsForSlot = slot?.sets ?? 3;
  const targetRepsForSlot = slot ? slot.reps[1] : exercise.targetReps;

  const setsToday = todaySession ? countSets(todaySession.logs) : 0;
  const isCompletedToday = setsToday >= targetSetsForSlot;

  const referenceMaxWeight = useMemo(() => {
    if (!referenceSession) return 0;
    // reduce rather than Math.max(...spread): no -Infinity on an empty session and no
    // stack overflow on a long history.
    return referenceSession.logs.reduce((max, l) => {
      const w = Number(l.weight);
      return Number.isFinite(w) && w > max ? w : max;
    }, 0);
  }, [referenceSession]);

  // 3. Calculate Recommendation based on Reference Session
  const recommendation: ProgressionRecommendation = useMemo(() => {
    if (!referenceSession) {
      return {
        weight: exercise.defaultWeight,
        reps: targetRepsForSlot,
        reason: 'First time on this one — start light and keep it clean.'
      };
    }

    const logs = referenceSession.logs;
    const totalSets = countSets(logs);
    const usedWeight = referenceMaxWeight;
    const minReps = logs.reduce((min, l) => {
      const r = Number(l.reps);
      return Number.isFinite(r) && r < min ? r : min;
    }, Infinity);

    // Rule 1: Volume
    if (totalSets < targetSetsForSlot) {
      return {
        weight: usedWeight,
        reps: targetRepsForSlot,
        reason: `Last time stopped at ${totalSets} ${totalSets === 1 ? 'set' : 'sets'} — get all ${targetSetsForSlot} in.`
      };
    }

    // Rule 2: Overload
    if (Number.isFinite(minReps) && minReps >= targetRepsForSlot) {
      return {
        weight: usedWeight + exercise.increment,
        reps: Math.max(6, targetRepsForSlot - 4),
        reason: `You cleared ${targetRepsForSlot} on every set — move up ${exercise.increment} lbs.`
      };
    }

    return {
      weight: usedWeight,
      reps: targetRepsForSlot,
      reason: `Same weight until all ${targetSetsForSlot} sets reach ${targetRepsForSlot}.`
    };
  }, [referenceSession, exercise, referenceMaxWeight, targetSetsForSlot, targetRepsForSlot]);

  const isWeightIncrease = referenceSession && recommendation.weight > referenceMaxWeight;

  // Once a set is in, the number to show is the one already on the bar, not
  // the one the plan suggested before you started.
  const onTheBar = todaySession ? todaySession.logs[0].weight : recommendation.weight;
  const barLabel = isCompletedToday
    ? 'Finished at'
    : todaySession
      ? 'On the bar'
      : isWeightIncrease
        ? 'Move up to'
        : 'Aim for';

  /** Last time out, as "55 × 8, 8, 8" with the date. */
  const lastTime = useMemo(() => {
    if (!referenceSession || referenceSession.logs.length === 0) return null;
    const logs = [...referenceSession.logs].reverse(); // oldest set first
    const weight = logs[0].weight;
    const sameWeight = logs.every(l => l.weight === weight);
    return {
      when: dayFormatter.format(referenceSession.dayStart),
      text: sameWeight
        ? `${weight} × ${logs.map(l => l.reps).join(', ')}`
        : logs.map(l => `${l.weight}×${l.reps}`).join('  ')
    };
  }, [referenceSession]);

  const setPips = Array.from({ length: targetSetsForSlot }, (_, i) => i < setsToday);

  return (
    <section className="pt-5">
      <header className="flex items-baseline gap-3">
        {position !== undefined && (
          <span className="nums text-sm text-zinc-600 tabular-nums pt-1">
            {String(position).padStart(2, '0')}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2
            className={`text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] ${
              isCompletedToday ? 'text-zinc-500' : 'text-zinc-50'
            }`}
          >
            {exercise.name}
          </h2>
          <p className="mt-1 text-[13px] text-zinc-500">
            {slot
              ? `${slot.sets} × ${formatReps(slot)} · ${formatRest(slot)}`
              : exercise.muscleGroup}
          </p>
        </div>
        {isCompletedToday && (
          <span className="shrink-0 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-zinc-500">
            <Check size={13} /> Done
          </span>
        )}
      </header>

      {/* What to put on the bar. The one number worth reading from across the
          gym, so it is the only thing set at this size. */}
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] text-zinc-600">{barLabel}</p>
          <p className="nums mt-1 text-zinc-50">
            <span className="text-[44px] leading-none font-medium">{onTheBar}</span>
            <span className="ml-1.5 text-base text-zinc-500">lbs</span>
            <span className="mx-2.5 text-zinc-700">×</span>
            <span className="text-[26px] leading-none font-medium">{recommendation.reps}</span>
            <span className="ml-1.5 text-base text-zinc-500">reps</span>
          </p>
        </div>

        {/* Sets done, as a glance rather than a sentence. */}
        <div
          className="flex items-center gap-1 pb-3"
          aria-label={`${setsToday} of ${targetSetsForSlot} sets done`}
        >
          {setPips.map((done, i) => (
            <span key={i} className={`h-1 w-4 rounded-full ${done ? 'bg-ember' : 'bg-ink-700'}`} />
          ))}
        </div>
      </div>

      {/* The advice is for deciding what to load. Once a set is in, that
          decision is made, so it gives the space back. */}
      {!todaySession && (
        <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">{recommendation.reason}</p>
      )}

      {lastTime && (
        <p className="nums mt-3 text-[13px] text-zinc-500">
          <span className="text-zinc-600">Last time</span> {lastTime.text}
          <span className="text-zinc-600"> · {lastTime.when}</span>
        </p>
      )}

      {/* The warm-up belongs to the first lift of the day only, and is never
          logged: it is guidance for right now, not history. */}
      {showWarmup && !isCompletedToday && (
        <div className="mt-5 border-t border-ink-700 pt-4">
          <p className="mb-2 text-[12px] text-zinc-600">Warm up first</p>
          {[
            { key: 'cardio', text: WARMUP.cardioLabel },
            { key: 'set', text: `One set at ${warmupWeight(recommendation.weight)} lbs — not logged` }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => toggleWarmup(item.key)}
              aria-pressed={!!warmupDone[item.key]}
              className="flex items-center gap-2.5 w-full text-left py-1.5"
            >
              <span
                className={`shrink-0 w-[18px] h-[18px] rounded-md border flex items-center justify-center ${
                  warmupDone[item.key] ? 'bg-zinc-200 border-zinc-200' : 'border-ink-700'
                }`}
              >
                {warmupDone[item.key] && <Check size={12} strokeWidth={3} className="text-ink-950" />}
              </span>
              <span className={`text-[13px] ${warmupDone[item.key] ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                {item.text}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        <button onClick={() => onLogClick(exercise)} className="btn-primary flex-1 py-3.5 text-[15px]">
          {isCompletedToday ? "Today's sets" : setsToday > 0 ? `Log set ${setsToday + 1}` : 'Log a set'}
        </button>

        <button
          onClick={() => onHistoryClick(exercise)}
          className="btn-quiet p-3"
          aria-label="View History"
          title="History"
        >
          <History size={19} />
        </button>

        {onSwitch && (
          <button
            onClick={() => onSwitch(exercise)}
            className="btn-quiet p-3"
            aria-label="Switch Exercise"
            title="Swap this lift"
          >
            <ArrowRightLeft size={19} />
          </button>
        )}

        {onArchive && (
          // Confirmation lives with the handler in App, so archiving asks the
          // same question wherever it is triggered from.
          <button
            onClick={() => onArchive(exercise)}
            className="btn-quiet p-3"
            aria-label="Archive Exercise"
            title="Archive"
          >
            <Archive size={19} />
          </button>
        )}
      </div>
    </section>
  );
});

ExerciseCard.displayName = 'ExerciseCard';
