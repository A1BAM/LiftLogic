import React, { useMemo } from 'react';
import { ExerciseDef, WorkoutLog, ProgressionRecommendation } from '../types';
import { ChevronRight, TrendingUp, History, CheckCircle2, ArrowUpCircle, Repeat, Archive, Layers, ArrowRightLeft, PersonStanding } from 'lucide-react';
import { hasAnimation } from '../formviewer/loader';

const exerciseDateCache = new Map<number, string>();
const INV_MS_PER_DAY = 1 / 86400000;

interface ExerciseCardProps {
  exercise: ExerciseDef;
  exerciseLogs: WorkoutLog[]; // All logs for this exercise
  onLogClick: (exercise: ExerciseDef) => void;
  onHistoryClick: (exercise: ExerciseDef) => void;
  onArchive?: (exercise: ExerciseDef) => void;
  onSwitch?: (exercise: ExerciseDef) => void;
  /** Opens the 3D form guide. Omitted callers simply get no form button. */
  onFormClick?: (exercise: ExerciseDef) => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = React.memo(({
  exercise, 
  exerciseLogs,
  onLogClick, 
  onHistoryClick,
  onArchive,
  onSwitch,
  onFormClick
}) => {
  const handleLogClick = () => onLogClick(exercise);
  const handleHistoryClick = () => onHistoryClick(exercise);
  const handleArchiveClick = onArchive ? (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Archive ${exercise.name}? It will be hidden from your daily list.`)) {
      onArchive(exercise);
    }
  } : undefined;
  const handleSwitchClick = onSwitch ? (e: React.MouseEvent) => {
    e.stopPropagation();
    onSwitch(exercise);
  } : undefined;

  // An exercise added to the database later simply has no animation file yet,
  // so the button greys out rather than the app breaking.
  const formModelReady = hasAnimation(exercise.id);
  const handleFormClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (formModelReady) onFormClick?.(exercise);
  };

  // A log row always represents at least one set. Guard against corrupt or legacy
  // `sets` values (0, negative, non-numeric) that would otherwise mis-count completion.
  const countSets = (logs: WorkoutLog[]) =>
    logs.reduce((acc, log) => {
      const n = Math.floor(Number(log.sets));
      return acc + (Number.isFinite(n) && n > 0 ? n : 1);
    }, 0);

  // 1. Organize logs into sessions (grouped by calendar day)
  // Logs are bucketed by local calendar day and then ordered newest-first. This does
  // not assume any particular input ordering: an out-of-order array would previously
  // collapse a whole history into one "session", which made unrelated days look like
  // a single completed workout.
  const sessions = useMemo(() => {
    const buckets = new Map<number, { date: string; dayStart: number; logs: WorkoutLog[] }>();

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
        bucket = { date: d.toDateString(), dayStart, logs: [] };
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

  const targetSets = 3;

  const totalSetsToday = useMemo(() => {
    if (!todaySession) return 0;
    let total = 0;
    for (let i = 0; i < todaySession.logs.length; i++) {
      total += todaySession.logs[i].sets || 1;
    }
    return total;
  }, [todaySession]);

  const isCompletedToday = useMemo(() => {
    if (!todaySession) return false;
    // Set Logic: All days now default to 3 sets
    const targetSets = 3;
    return countSets(todaySession.logs) >= targetSets;
  }, [todaySession, exercise]);

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
        reps: exercise.targetReps,
        reason: "Start light to build form."
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
    const targetSets = 3;
    if (totalSets < targetSets) {
       return {
         weight: usedWeight,
         reps: exercise.targetReps,
         reason: `Build Volume: Complete ${targetSets} sets.`
       };
    }

    // Rule 2: Overload
    let nextWeight = usedWeight + exercise.increment;
    let nextReps = Math.max(6, exercise.targetReps - 4);
    let reason = `Overload: All sets hit ${exercise.targetReps}+ reps!`;

    if (Number.isFinite(minReps) && minReps >= exercise.targetReps) {
      return {
        weight: nextWeight,
        reps: nextReps,
        reason: reason
      };
    } else {
      return {
        weight: usedWeight,
        reps: exercise.targetReps,
        reason: `Build Strength: Hit ${exercise.targetReps} reps on all sets.`
      };
    }
  }, [referenceSession, exercise, referenceMaxWeight]);

  const isWeightIncrease = referenceSession ? recommendation.weight > referenceMaxWeight : false;

  const previousText = useMemo(() => {
    const session = todaySession || referenceSession;
    if (!session) return "No logs yet";

    if (session.logs.length === 0) return <span className="text-slate-400 italic">No logs yet</span>;

    let firstWeight = session.logs[0].weight;
    let isSingleWeight = true;
    let repList = String(session.logs[0].reps);

    for (let i = 1; i < session.logs.length; i++) {
      const l = session.logs[i];
      if (l.weight !== firstWeight) {
        isSingleWeight = false;
        break;
      }
      repList += ', ' + l.reps;
    }

    if (isSingleWeight) {
      return (
        <span>
          <span className="font-bold text-lg">{firstWeight}</span>
          <span className="text-xs text-slate-500 ml-0.5">lbs</span>
          <span className="mx-2 text-slate-600">•</span>
          <span className="text-slate-300">{repList}</span>
        </span>
      );
    } else {
      return <span className="text-slate-400 italic">Mixed Weights</span>;
    }
  }, [todaySession, referenceSession]);

  return (
    <div 
      className={`relative rounded-xl p-5 mb-4 shadow-lg border transition-all duration-300 ${
        isCompletedToday
          ? "bg-slate-900/40 border-green-500/50" 
          : "bg-slate-800 border-slate-700"
      }`}
    >
      {isCompletedToday && (
        <div className="absolute top-4 right-4 flex items-center gap-2 text-green-400 font-bold bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20 shadow-sm animate-in fade-in zoom-in">
          <CheckCircle2 size={16} />
          <span className="text-xs uppercase tracking-wider">Done</span>
        </div>
      )}

      <div className="flex justify-between items-start mb-2 pr-20"> 
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`text-xl font-bold transition-colors ${isCompletedToday ? 'text-slate-400' : 'text-white'}`}>
              {exercise.name}
            </h3>
            {onFormClick && (
              <button
                onClick={handleFormClick}
                disabled={!formModelReady}
                title={formModelReady ? `Show ${exercise.name} form` : 'No model yet'}
                aria-label={formModelReady ? `Show ${exercise.name} form` : `${exercise.name}: no model yet`}
                className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
                  formModelReady
                    ? 'bg-slate-700/70 border-slate-600 text-blue-300 active:bg-slate-600'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-600 cursor-not-allowed'
                }`}
              >
                <PersonStanding size={18} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider bg-blue-400/10 px-2 py-0.5 rounded">
              {exercise.muscleGroup}
            </span>
            {todaySession && (
              <div
                className="flex items-center gap-1"
                role="img"
                aria-label={`Progress: ${totalSetsToday} of ${targetSets} sets completed`}
              >
                {[...Array(targetSets)].map((_, i) => (
                  <span
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 ${
                      i < totalSetsToday
                        ? "bg-green-500 border-green-400 shadow-sm shadow-green-500/50"
                        : "bg-slate-700 border-slate-600"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-4 mt-4 transition-opacity ${isCompletedToday ? 'opacity-50 grayscale-[0.5]' : 'opacity-100'}`}>
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">
            {todaySession ? "Today's Lift" : "Previous"}
          </p>
          <div className="text-white font-mono leading-tight">
            {previousText}
          </div>
          {(todaySession || referenceSession) && (
             <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
               <Layers size={10} /> {(todaySession || referenceSession)?.logs.length} Sets
             </div>
          )}
        </div>

        <div className={`p-3 rounded-lg relative overflow-hidden border ${
          isWeightIncrease 
            ? "bg-emerald-500/10 border-emerald-500/30" 
            : "bg-blue-600/20 border-blue-500/30"
        }`}>
          <div className="absolute top-0 right-0 p-1 opacity-20">
            {isWeightIncrease ? (
              <ArrowUpCircle size={40} className="text-emerald-500" />
            ) : (
              <TrendingUp size={40} className="text-blue-500" />
            )}
          </div>
          <p className={`text-[10px] font-bold uppercase mb-1 ${isWeightIncrease ? 'text-emerald-400' : 'text-blue-300'}`}>
            {isWeightIncrease ? 'Increase Weight' : 'Target Goal'}
          </p>
          <div className="text-white font-mono z-10 relative">
            <span className={`text-xl font-bold ${isWeightIncrease ? 'text-emerald-100' : 'text-blue-100'}`}>
              {recommendation.weight}
            </span> <span className="text-xs">lbs</span>
            <div className="text-xs flex items-center gap-1">
              {recommendation.reps} reps
            </div>
          </div>
        </div>
      </div>

      <div className={`flex items-start gap-2 mt-3 p-2 rounded bg-slate-900/30 ${isCompletedToday ? 'hidden' : 'block'}`}>
        <Repeat size={14} className="text-slate-500 mt-0.5 min-w-[14px]" />
        <p className="text-xs text-slate-400 italic leading-tight">
          {recommendation.reason}
        </p>
      </div>

      <div className="flex gap-2 mt-4">
        {handleArchiveClick && (
          <button
            onClick={handleArchiveClick}
            className="p-3 bg-slate-800 hover:bg-amber-900/20 text-slate-500 hover:text-amber-500 rounded-lg border border-slate-700 transition-colors"
            title="Archive Exercise"
            aria-label="Archive Exercise"
          >
            <Archive size={20} />
          </button>
        )}

        {handleSwitchClick && (
          <button
            onClick={handleSwitchClick}
            className="p-3 bg-slate-800 hover:bg-blue-900/20 text-slate-500 hover:text-blue-500 rounded-lg border border-slate-700 transition-colors"
            title="Switch Exercise"
            aria-label="Switch Exercise"
          >
            <ArrowRightLeft size={20} />
          </button>
        )}

        <button 
          onClick={handleHistoryClick}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 transition-colors"
          aria-label="View History"
        >
          <History size={20} />
        </button>

        <button
          onClick={handleLogClick}
          className={`flex-1 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
            isCompletedToday
              ? "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
          }`}
        >
          {isCompletedToday ? "View Today's Log" : (todaySession ? "Add Another Set" : "Start Workout")} 
          {!isCompletedToday && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
});

ExerciseCard.displayName = 'ExerciseCard';