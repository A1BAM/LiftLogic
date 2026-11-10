import React, { useMemo, useState } from 'react';
import { ExerciseDef, WorkoutLog, ProgressionRecommendation } from '../types';
import { History, Check, ArrowRightLeft, Archive } from 'lucide-react';
import { groupSessions, recommendFor, sessionWeight } from '../progression';
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

  // Sessions by calendar day, newest first.
  const sessions = useMemo(
    () => groupSessions(exerciseLogs, exercise.id),
    [exerciseLogs, exercise.id]
  );

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

  const targetSetsForSlot = slot?.sets ?? 3;
  const setsToday = todaySession ? countSets(todaySession.logs) : 0;
  const isCompletedToday = setsToday >= targetSetsForSlot;

  const recommendation: ProgressionRecommendation = useMemo(
    () => recommendFor(exercise, sessions, slot, todayStart),
    [exercise, sessions, slot, todayStart]
  );

  const referenceWeight = useMemo(
    () => (referenceSession ? sessionWeight(referenceSession) : 0),
    [referenceSession]
  );

  const isWeightIncrease = referenceSession && recommendation.weight > referenceWeight;
  const isWeightDrop = referenceSession && recommendation.weight < referenceWeight;

  // Once a set is in, the number to show is the one already on the bar, not
  // the one the plan suggested before you started.
  const onTheBar = todaySession ? todaySession.logs[0].weight : recommendation.weight;
  const barLabel = isCompletedToday
    ? 'Finished at'
    : todaySession
      ? 'On the bar'
      : isWeightIncrease
        ? 'Move up to'
        : isWeightDrop
          ? 'Ease back to'
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
    <section className="panel mt-5 px-5 py-5">
      <header className="flex items-baseline gap-3">
        {position !== undefined && (
          <span className="nums pt-1 text-[14px] text-cream-400">
            {String(position).padStart(2, '0')}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2
            className={`display text-[25px] leading-[1.16] ${
              isCompletedToday ? 'opacity-55' : ''
            }`}
          >
            {exercise.name}
          </h2>
          <p className="mt-1.5 text-[14px] text-cream-400">
            {slot
              ? `${slot.sets} × ${formatReps(slot)} · ${formatRest(slot)}`
              : exercise.muscleGroup}
          </p>
        </div>
        {isCompletedToday && (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-sage/40 px-2.5 py-1 text-[12px] font-semibold text-sage">
            <Check size={12} strokeWidth={3} /> Done
          </span>
        )}
      </header>

      {/* What to put on the bar. The one number worth reading from across the
          gym, so it is the only thing set at this size. */}
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[13px] uppercase tracking-[0.14em] text-cream-400">{barLabel}</p>
          <p className="nums mt-1 text-cream-50">
            <span className="display nums text-[48px] leading-none">
              {onTheBar}
            </span>
            <span className="ml-1.5 text-base text-cream-400">lbs</span>
            <span className="mx-2.5 text-cream-400">×</span>
            <span className="display nums text-[28px] leading-none">{recommendation.reps}</span>
            <span className="ml-1.5 text-base text-cream-400">reps</span>
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
              className={`h-3 w-3 rounded-full border ${
                done
                  ? isCompletedToday
                    ? 'border-sage bg-sage'
                    : 'border-ember bg-ember'
                  : 'border-ink-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* The advice is for deciding what to load. Once a set is in, that
          decision is made, so it gives the space back. */}
      {!todaySession && (
        <p className="mt-3 text-[14px] leading-relaxed text-cream-400">
          {recommendation.reason}
        </p>
      )}

      {lastTime && (
        <p className="nums mt-3 text-[14px] text-cream-400">
          Last time {lastTime.text} · {lastTime.when}
        </p>
      )}

      {/* The warm-up belongs to the first lift of the day only, and is never
          logged: it is guidance for right now, not history. */}
      {showWarmup && !isCompletedToday && (
        <div className="mt-5 border-t border-ink-700 pt-4">
          <p className="mb-2 text-[13px] uppercase tracking-[0.14em] text-cream-400">Warm up first</p>
          {[
            { key: 'cardio', text: WARMUP.cardioLabel },
            { key: 'set', text: `One set at ${warmupWeight(recommendation.weight)} lbs — not logged` }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => toggleWarmup(item.key)}
              aria-pressed={!!warmupDone[item.key]}
              className="flex min-h-[44px] w-full items-center gap-2.5 py-1.5 text-left"
            >
              <span
                className={`shrink-0 w-[18px] h-[18px] rounded-md border flex items-center justify-center ${
                  warmupDone[item.key] ? 'border-sage bg-sage' : 'border-ink-600'
                }`}
              >
                {warmupDone[item.key] && <Check size={12} strokeWidth={3} className="text-ink-950" />}
              </span>
              <span className={`text-[14px] text-cream-400 ${warmupDone[item.key] ? 'line-through' : ''}`}>
                {item.text}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-1.5">
        <button
          onClick={() => onLogClick(exercise)}
          className="btn-primary flex-1 py-3.5 text-[15px]"
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
