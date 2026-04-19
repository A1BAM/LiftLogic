import React, { useMemo } from 'react';
import { ExerciseDef, WorkoutLog, ProgressionRecommendation } from '../types';
import { ChevronRight, TrendingUp, History, CheckCircle2, ArrowUpCircle, Repeat, Archive, Layers } from 'lucide-react';

interface ExerciseCardProps {
  exercise: ExerciseDef;
  exerciseLogs: WorkoutLog[]; // All logs for this exercise
  onLogClick: () => void;
  onHistoryClick: () => void;
  onArchive?: () => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({ 
  exercise, 
  exerciseLogs, 
  onLogClick, 
  onHistoryClick,
  onArchive
}) => {
  
  // 1. Organize logs into sessions (grouped by date)
  const sessions = useMemo(() => {
    const grouped: Record<string, WorkoutLog[]> = {};
    const dateToTimestamp: Record<string, number> = {};

    exerciseLogs.forEach(log => {
      const dateKey = new Date(log.timestamp).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
        dateToTimestamp[dateKey] = log.timestamp;
      }
      grouped[dateKey].push(log);
    });
    
    // Sort keys descending (newest first)
    const sortedKeys = Object.keys(grouped).sort((a, b) => dateToTimestamp[b] - dateToTimestamp[a]);
    
    return sortedKeys.map(key => ({
      date: key,
      logs: grouped[key]
    }));
  }, [exerciseLogs]);

  // 2. Identify "Today's Session" and "Reference Session" (for goal calc)
  const todayDateStr = new Date().toDateString();
  const todaySession = sessions.find(s => s.date === todayDateStr);
  const referenceSession = todaySession 
    ? sessions.find(s => s.date !== todayDateStr) 
    : sessions[0];

  const isCompletedToday = useMemo(() => {
    if (!todaySession) return false;
    // Set Logic: All days now default to 3 sets
    const targetSets = 3;
    const totalSets = todaySession.logs.reduce((acc, log) => acc + (log.sets || 1), 0);
    return totalSets >= targetSets;
  }, [todaySession, exercise]);

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
    const totalSets = logs.reduce((acc, log) => acc + (log.sets || 1), 0);
    const usedWeight = Math.max(...logs.map(l => l.weight));
    const minReps = Math.min(...logs.map(l => l.reps));
    
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
    if (minReps >= exercise.targetReps) {
      return {
        weight: usedWeight + exercise.increment,
        reps: Math.max(6, exercise.targetReps - 4),
        reason: `Overload: All sets hit ${exercise.targetReps}+ reps!`
      };
    } else {
      return {
        weight: usedWeight,
        reps: exercise.targetReps,
        reason: `Build Strength: Hit ${exercise.targetReps} reps on all sets.`
      };
    }
  }, [referenceSession, exercise]);

  const isWeightIncrease = referenceSession ? recommendation.weight > Math.max(...referenceSession.logs.map(l => l.weight)) : false;

  const previousText = useMemo(() => {
    const session = todaySession || referenceSession;
    if (!session) return "No logs yet";

    const weights = Array.from(new Set(session.logs.map(l => l.weight)));
    if (weights.length === 1) {
      const w = weights[0];
      const repList = session.logs.map(l => l.reps).join(', ');
      return (
        <span>
          <span className="font-bold text-lg">{w}</span>
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
              if(window.confirm(`Archive ${exercise.name}? It will be hidden from your daily list.`)) onArchive();
            }}
            className="p-3 bg-slate-800 hover:bg-amber-900/20 text-slate-500 hover:text-amber-500 rounded-lg border border-slate-700 focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors"
            title="Archive Exercise"
            aria-label="Archive Exercise"
          >
            <Archive size={20} />
          </button>
        )}

        <button 
          onClick={onHistoryClick}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
          aria-label="View History"
        >
          <History size={20} />
        </button>

        <button
          onClick={onLogClick}
          className={`flex-1 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500 transition-all ${
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
};