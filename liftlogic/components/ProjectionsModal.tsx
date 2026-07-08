import React, { useMemo, useEffect } from 'react';
import { X, TrendingUp, AlertCircle, User, Info } from 'lucide-react';
import { UserProfile, ExerciseDef, WorkoutLog } from '../types';
import { getProjections, calculate1RM } from '../utils/projections';

interface ProjectionsModalProps {
  logs: WorkoutLog[];
  exercises: ExerciseDef[];
  userProfile: UserProfile | null;
  onClose: () => void;
  onOpenProfile: () => void;
}

export function ProjectionsModal({
  logs,
  exercises,
  userProfile,
  onClose,
  onOpenProfile
}: ProjectionsModalProps) {

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Determine if the profile has enough info
  const hasCompleteProfile = userProfile && userProfile.heightCm && userProfile.weightLbs && userProfile.age;

  const projectionsList = useMemo(() => {
    if (!hasCompleteProfile) return [];

    const activeExercises = exercises.filter(ex => !ex.isArchived);

    return activeExercises.map(ex => {
      const exLogs = logs.filter(l => l.exerciseId === ex.id);
      if (exLogs.length === 0) return null;

      const projs = getProjections(ex, exLogs, userProfile);
      if (!projs) return null;

      return {
        exercise: ex,
        projections: projs
      };
    }).filter(Boolean) as { exercise: ExerciseDef, projections: NonNullable<ReturnType<typeof getProjections>> }[];

  }, [logs, exercises, userProfile, hasCompleteProfile]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-md sm:rounded-2xl border-t sm:border border-slate-700 flex flex-col max-h-[90vh] shadow-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 id="modal-title" className="text-xl font-bold text-white leading-tight">Potential</h2>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Realistic Progression</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasCompleteProfile ? (
             <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl text-center">
               <AlertCircle size={40} className="text-amber-500 mx-auto mb-4" />
               <h3 className="text-lg font-bold text-white mb-2">Incomplete Profile</h3>
               <p className="text-sm text-slate-400 mb-6">
                 To calculate realistic lifetime limits and progression timelines, we need your height, weight, and age.
               </p>
               <button
                 onClick={() => {
                   onClose();
                   onOpenProfile();
                 }}
                 className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
               >
                 <User size={18} /> Update Profile
               </button>
             </div>
          ) : projectionsList.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-500 flex flex-col items-center">
               <TrendingUp size={48} className="mb-4 opacity-50" />
               <p className="mb-2">Log some workouts first.</p>
               <p className="text-sm">We need data to calculate your potential.</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-xl flex items-start gap-2 mb-2">
                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200/80 leading-snug">
                  Projections show estimated 1-Rep Max (1RM) based on your lean mass, age, and current logs. Geared towards natural lifters with full-time jobs.
                </p>
              </div>

              {projectionsList.map(({ exercise, projections }) => {
                const pMax = projections.current1RM / projections.lifetimeMax;
                const p3mo = (projections.goal3Months - projections.current1RM) / projections.lifetimeMax;
                const p1yr = (projections.goal1Year - projections.goal3Months) / projections.lifetimeMax;

                return (
                <div key={exercise.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-md">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white">{exercise.name}</h3>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">1RM Est.</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Current</span>
                      <span className="font-mono font-bold text-white text-lg">{projections.current1RM}</span>
                    </div>
                    <div className="flex flex-col border-l border-slate-700">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">3 Mo</span>
                      <span className="font-mono font-bold text-blue-400 text-lg">{projections.goal3Months}</span>
                    </div>
                    <div className="flex flex-col border-l border-slate-700">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">1 Yr</span>
                      <span className="font-mono font-bold text-emerald-400 text-lg">{projections.goal1Year}</span>
                    </div>
                    <div className="flex flex-col border-l border-slate-700 bg-slate-900/50 rounded-r-lg">
                      <span className="text-[10px] text-amber-500/80 uppercase font-bold">Max</span>
                      <span className="font-mono font-bold text-amber-500 text-lg">{projections.lifetimeMax}</span>
                    </div>
                  </div>

                  {/* Progress Bar representation */}
                  <div className="relative h-2 w-full bg-slate-900 rounded-full overflow-hidden mt-2">
                    <div className="absolute top-0 left-0 h-full bg-slate-500" style={{ width: `${Math.min(100, pMax * 100)}%` }} />
                    <div className="absolute top-0 h-full bg-blue-500/80" style={{ left: `${Math.min(100, pMax * 100)}%`, width: `${Math.min(100, p3mo * 100)}%` }} />
                    <div className="absolute top-0 h-full bg-emerald-500/80" style={{ left: `${Math.min(100, (pMax + p3mo) * 100)}%`, width: `${Math.min(100, p1yr * 100)}%` }} />
                  </div>
                </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
