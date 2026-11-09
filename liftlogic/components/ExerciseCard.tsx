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
    <section className="glass relative mt-5 overflow-hidden px-5 pb-5 pt-5">
      {/* A pane of water behind the card's top edge, lit from above. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/70 to-transparent"
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-2xl ${
          isCompletedToday ? 'bg-leaf-300/45' : 'bg-aero-300/45'
        }`}
      />
      <header className="relative flex items-baseline gap-3">
        {position !== undefined && (
          <span className="nums text-sm text-aero-600/70 tabular-nums pt-1">
            {String(position).padStart(2, '0')}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2
            className={`text-[23px] leading-[1.18] font-semibold tracking-[-0.02em] ${
              isCompletedToday ? 'text-aero-600/85' : 'text-aero-900'
            }`}
          >
            {exercise.name}
          </h2>
          <p className="mt-1 text-[13px] text-aero-600/85">
            {slot
              ? `${slot.sets} × ${formatReps(slot)} · ${formatRest(slot)}`
              : exercise.muscleGroup}
          </p>
        </div>
        {isCompletedToday && (
          <span className="shrink-0 flex items-center gap-1 rounded-full border border-leaf-500/40 bg-gradient-to-b from-leaf-200 to-leaf-300 px-2.5 py-1 text-[11px] font-semibold text-aero-900 shadow-bubble">
            <Check size={12} strokeWidth={3} /> Done
          </span>
        )}
      </header>

      {/* What to put on the bar. The one number worth reading from across the
          gym, so it is the only thing set at this size. */}
      <div className="relative mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] text-aero-700/75">{barLabel}</p>
          <p className="nums mt-1 text-aero-900">
            <span className="text-[46px] font-semibold leading-none tracking-[-0.03em] text-transparent bg-clip-text bg-gradient-to-b from-aero-700 to-aero-900">
              {onTheBar}
            </span>
            <span className="ml-1.5 text-base text-aero-600/85">lbs</span>
            <span className="mx-2.5 text-aero-400">×</span>
            <span className="text-[26px] leading-none font-medium">{recommendation.reps}</span>
            <span className="ml-1.5 text-base text-aero-600/85">reps</span>
          </p>
        </div>

        {/* Sets done, as a glance rather than a sentence. */}
        <div
          className="flex items-center gap-1 pb-3"
          aria-label={`${setsToday} of ${targetSetsForSlot} sets done`}
        >
          {setPips.map((done, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border ${
                done
                  ? 'border-leaf-500/50 bg-gradient-to-b from-leaf-300 to-leaf-500 shadow-bubble'
                  : 'border-white/70 bg-white/55'
              }`}
            />
          ))}
        </div>
      </div>

      {/* The advice is for deciding what to load. Once a set is in, that
          decision is made, so it gives the space back. */}
      {!todaySession && (
        <p className="relative mt-3 text-[13px] leading-relaxed text-aero-700/85">
          {recommendation.reason}
        </p>
      )}

      {lastTime && (
        <p className="nums relative mt-3 text-[13px] text-aero-700/85">
          <span className="text-aero-600/75">Last time</span> {lastTime.text}
          <span className="text-aero-600/75"> · {lastTime.when}</span>
        </p>
      )}

      {/* The warm-up belongs to the first lift of the day only, and is never
          logged: it is guidance for right now, not history. */}
      {showWarmup && !isCompletedToday && (
        <div className="relative mt-5 border-t border-white/70 pt-4">
          <p className="mb-2 text-[12px] text-aero-600/70">Warm up first</p>
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
                  warmupDone[item.key]
                    ? 'border-leaf-500/50 bg-gradient-to-b from-leaf-300 to-leaf-500 shadow-bubble'
                    : 'border-white/80 bg-white/60'
                }`}
              >
                {warmupDone[item.key] && <Check size={12} strokeWidth={3} className="text-aero-900" />}
              </span>
              <span className={`text-[13px] ${warmupDone[item.key] ? 'text-aero-600/70 line-through' : 'text-aero-700/80'}`}>
                {item.text}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="relative mt-6 flex items-center gap-1.5">
        <button
          onClick={() => onLogClick(exercise)}
          className={`btn-gel flex-1 py-3.5 text-[15px] ${isCompletedToday ? 'btn-gel-leaf' : ''}`}
        >
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
