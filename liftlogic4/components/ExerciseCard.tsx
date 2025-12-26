import React, { useMemo } from 'react';
import { ExerciseDef, WorkoutLog, ProgressionRecommendation } from '../types';
import {  ChevronRight, TrendingUp, History, Layers } from 'lucide-react';

interface ExerciseCardProps {
  exercise: ExerciseDef;
  lastLog?: WorkoutLog;
  onLogClick: () => void;
  onHistoryClick: () => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({ 
  exercise, 
  lastLog, 
  onLogClick, 
  onHistoryClick 
}) => {
  
  const recommendation: ProgressionRecommendation = useMemo(() => {
    if (!lastLog) {
      return {
        weight: exercise.defaultWeight,
        reps: 8,
        reason: "Start light to build form."
      };
    }

    const lastSets = lastLog.sets || 1;
    const lastReps = lastLog.reps;
    const lastWeight = lastLog.weight;

    // RULE 1: Volume First.
    // PUSH days target 3 sets. PULL days target 4 sets.
    const targetSets = exercise.dayType === 'PULL' ? 4 : 3;

    if (lastSets < targetSets) {
      return {
        weight: lastWeight,
        reps: Math.max(lastReps, exercise.targetReps),
        reason: `Focus on completing ${targetSets} full sets at this weight.`
      };
    }

    // RULE 2: Progressive Overload.
    // If they did the target sets (or more), check if they hit the Rep Target.
    if (lastReps >= exercise.targetReps) {
      // User hit the target reps for target sets -> Increase Weight
      return {
        weight: lastWeight + exercise.increment,
        reps: Math.max(6, exercise.targetReps - 4), // Drop reps slightly when weight goes up
        reason: `You hit ${lastReps} reps for ${lastSets} sets! Increase weight.`
      };
    } else {
      // User did target sets, but hasn't hit the Rep Target yet -> Keep Weight
      return {
        weight: lastWeight,
        reps: Math.min(lastReps + 1, exercise.targetReps),
        reason: `Good volume (${lastSets} sets). Now aim for ${exercise.targetReps} reps.`
      };
    }
  }, [lastLog, exercise]);

  return (
    <div className="bg-slate-800 rounded-xl p-5 mb-4 shadow-lg border border-slate-700">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-xl font-bold text-white">{exercise.name}</h3>
          <span className="text-xs font-medium text-blue-400 uppercase tracking-wider bg-blue-400/10 px-2 py-0.5 rounded">
            {exercise.muscleGroup}
          </span>
        </div>
        <button 
          onClick={onHistoryClick}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="View History"
        >
          <History size={20} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-slate-900/50 p-3 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Last Workout</p>
          {lastLog ? (
            <div className="text-slate-200 font-mono">
              <span className="text-lg font-bold">{lastLog.weight}</span> lbs
              <div className="text-sm flex items-center gap-1">
                {(lastLog.sets || 1) > 1 && <span className="text-slate-400">{lastLog.sets} x</span>}
                {lastLog.reps} reps
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No logs yet</p>
          )}
        </div>

        <div className="bg-blue-600/20 border border-blue-500/30 p-3 rounded-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 opacity-20">
            <TrendingUp size={40} className="text-blue-500" />
          </div>
          <p className="text-xs text-blue-300 mb-1 font-semibold">Goal for Today</p>
          <div className="text-white font-mono z-10 relative">
            <span className="text-xl font-bold text-blue-100">{recommendation.weight}</span> lbs
            <div className="text-sm">x {recommendation.reps} reps</div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-3 italic">
        "{recommendation.reason}"
      </p>

      <button
        onClick={onLogClick}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
      >
        Log Result <ChevronRight size={18} />
      </button>
    </div>
  );
};