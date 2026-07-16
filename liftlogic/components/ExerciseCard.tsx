import React, { useMemo } from 'react';
import { ExerciseDef, WorkoutLog, ProgressionRecommendation } from '../types';
import { ChevronRight, TrendingUp, History, CheckCircle2, ArrowUpCircle, Repeat, Archive, Layers } from 'lucide-react';

interface ExerciseCardProps {
  exercise: ExerciseDef;
  exerciseLogs: WorkoutLog[]; // All logs for this exercise
  onLogClick: (exercise: ExerciseDef) => void;
  onHistoryClick: (exercise: ExerciseDef) => void;
  onArchive?: (exercise: ExerciseDef) => void;
}

export const ExerciseCard = React.memo<ExerciseCardProps>(({
  exercise, 
  exerciseLogs,
  onLogClick, 
  onHistoryClick,
  onArchive
}) => {
  
  // Consolidate all exercise-related statistics and recommendations into a single O(N) pass
  // This reduces re-renders and redundant calculations when adding new sets.
  const stats = useMemo(() => {
    const todayDateStr = new Date().toDateString();

    // 1. Organize logs into sessions (grouped by date)
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

    const todaySession = sessionsArr.length > 0 && sessionsArr[0].date === todayDateStr ? sessionsArr[0] : undefined;
    const referenceSession = todaySession ? sessionsArr[1] : sessionsArr[0];

    // 2. Identify Completion Status (Standard 3 sets)
    const targetSets = 3;
    const totalSetsToday = todaySession ? todaySession.logs.reduce((acc, log) => acc + (log.sets || 1), 0) : 0;
    const isCompletedToday = totalSetsToday >= targetSets;

    // 3. Reference Metrics
    const referenceMaxWeight = referenceSession ? Math.max(...referenceSession.logs.map(l => l.weight)) : 0;

    // 4. Calculate Recommendation
    let recommendation: ProgressionRecommendation;
    if (!referenceSession) {
      recommendation = {
        weight: exercise.defaultWeight,
        reps: exercise.targetReps,
        reason: "Start light to build form."
      };
    } else {
      const logs = referenceSession.logs;
      const totalSetsRef = logs.reduce((acc, log) => acc + (log.sets || 1), 0);
      const usedWeight = referenceMaxWeight;
      const minReps = Math.min(...logs.map(l => l.reps));

      if (totalSetsRef < targetSets) {
        recommendation = {
          weight: usedWeight,
          reps: exercise.targetReps,
          reason: `Build Volume: Complete ${targetSets} sets.`
        };
      } else if (minReps >= exercise.targetReps) {
        recommendation = {
          weight: usedWeight + exercise.increment,
          reps: Math.max(6, exercise.targetReps - 4),
          reason: `Overload: All sets hit ${exercise.targetReps}+ reps!`
        };
      } else {
        recommendation = {
          weight: usedWeight,
          reps: exercise.targetReps,
          reason: `Build Strength: Hit ${exercise.targetReps} reps on all sets.`
        };
      }
    }

    const isWeightIncrease = referenceSession ? recommendation.weight > referenceMaxWeight : false;

    // 5. Formatting display text
    let previousText: React.ReactNode;
    const sessionForText = todaySession || referenceSession;
    if (!sessionForText) {
      previousText = "No logs yet";
    } else {
      const weights = Array.from(new Set(sessionForText.logs.map(l => l.weight)));
      if (weights.length === 1) {
        const w = weights[0];
        const repList = sessionForText.logs.map(l => l.reps).join(', ');
        previousText = (
          <span>
            <span className="font-bold text-lg">{w}</span>
            <span className="text-xs text-slate-500 ml-0.5">lbs</span>
            <span className="mx-2 text-slate-600">•</span>
            <span className="text-slate-300">{repList}</span>
          </span>
        );
      } else {
        previousText = <span className="text-slate-400 italic">Mixed Weights</span>;
      }
    }

    return {
      todaySession,
      referenceSession,
      isCompletedToday,
      recommendation,
      isWeightIncrease,
      previousText
    };
  }, [exerciseLogs, exercise]);

  const { todaySession, referenceSession, isCompletedToday, recommendation, isWeightIncrease, previousText } = stats;

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
          <h3 className={`text-xl font-bold transition-colors ${isCompletedToday ? 'text-slate-400' : 'text-white'}`}>
            {exercise.name}
          </h3>
          <span className="text-xs font-medium text-blue-400 uppercase tracking-wider bg-blue-400/10 px-2 py-0.5 rounded">
            {exercise.muscleGroup}
          </span>
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
        {onArchive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if(window.confirm(`Archive ${exercise.name}? It will be hidden from your daily list.`)) onArchive(exercise);
            }}
            className="p-3 bg-slate-800 hover:bg-amber-900/20 text-slate-500 hover:text-amber-500 rounded-lg border border-slate-700 transition-colors"
            title="Archive Exercise"
            aria-label="Archive Exercise"
          >
            <Archive size={20} />
          </button>
        )}

        <button 
          onClick={() => onHistoryClick(exercise)}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 transition-colors"
          aria-label="View History"
        >
          <History size={20} />
        </button>

        <button
          onClick={() => onLogClick(exercise)}
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
