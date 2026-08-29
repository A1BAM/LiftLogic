import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { EXERCISES } from './constants';
import { WorkoutLog, ExerciseDef, DayType } from './types';
import { ExerciseCard } from './components/ExerciseCard';
import { ExerciseRow } from './components/ExerciseRow';
import { planExercisesForDay, isSlotComplete, WORKOUT_PLAN } from './workoutPlan';
import { LogModal } from './components/LogModal';
import { HistoryModal } from './components/HistoryModal';
import { GlobalHistoryModal } from './components/GlobalHistoryModal';
import { AddExerciseModal } from './components/AddExerciseModal';
import { ArchivedExercisesModal } from './components/ArchivedExercisesModal';
import { SwitchExerciseModal } from './components/SwitchExerciseModal';
import { RestTimer } from './components/RestTimer';

const FormViewerModal = lazy(() => import('./components/FormViewerModal'));
import { Dumbbell, ClipboardList, ChevronLeft, Loader2, AlertCircle, Lock, LogOut, Plus, Archive, Eye, EyeOff } from 'lucide-react';
import { useWorkoutData } from './hooks/useWorkoutData';
import { workoutService } from './services/workoutService';
import { authService } from './services/authService';
import { logger } from './utils/logger';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI State
  const [activeModal, setActiveModal] = useState<'log' | 'history' | 'globalHistory' | 'addExercise' | 'archived' | 'switch' | 'form' | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDef | null>(null);
  const [workoutDay, setWorkoutDay] = useState<DayType | null>(null);
  const [restEndTime, setRestEndTime] = useState<number | null>(null);

  // Hook for data and sync
  const {
    logs,
    syncedExercises,
    isLoading,
    error,
    fetchDataAndSync,
    addLog,
    removeLog,
    updateLog,
    importLogs,
    saveExercise,
    saveExercises,
    deleteExercisePermanently,
    getLogsForExercise,
    getTodaysLogs,
    getLastSessionLogs,
  } = useWorkoutData(isAuthenticated);

  // Check Auth on Mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await workoutService.fetchWorkouts();
        setIsAuthenticated(true);
      } catch (err) {
        // Not authenticated
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const msgBuffer = new TextEncoder().encode(passwordInput);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      
      try {
        await authService.login(hashHex);
        await workoutService.fetchWorkouts();
        setIsAuthenticated(true);
        setPasswordInput("");
      } catch (err: unknown) {
        const status = err !== null && typeof err === 'object' && 'status' in err ? (err as { status: unknown }).status : undefined;
        const message = err instanceof Error ? err.message : undefined;
        if (status === 401 || message === '401' || String(err).includes('401')) {
          alert("Wrong Password");
        } else {
          alert("Connection Error. Please check your network or server status.");
        }
        setPasswordInput("");
      }
    } catch (err) {
      logger.error("Crypto error:", err);
      alert("Secure context required for login.");
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      logger.error("Logout error", err);
    }
    setIsAuthenticated(false);
    setWorkoutDay(null);
  };

  // UI Handlers
  const handleLogClick = useCallback((exercise: ExerciseDef) => {
    setSelectedExercise(exercise);
    setActiveModal('log');
  }, []);

  const handleFormClick = useCallback((exercise: ExerciseDef) => {
    setSelectedExercise(exercise);
    setActiveModal('form');
  }, []);

  // Closing the viewer drops straight back into the log, mid-workout, with
  // nothing lost: only the modal layer changed, all workout state is untouched.
  const handleFormLogSet = useCallback(() => {
    setActiveModal('log');
    // Wait for the log modal to mount before reaching for its weight field.
    requestAnimationFrame(() => {
      const input = document.getElementById('weight-input') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }, []);

  const handleHistoryClick = useCallback((exercise: ExerciseDef) => {
    setSelectedExercise(exercise);
    setActiveModal('history');
  }, []);

  const handleAddSet = useCallback(async (data: { weight: number; reps: number; sets: number }) => {
    if (!selectedExercise) return;
    try {
      await addLog(selectedExercise.id, data.weight, data.reps);
      navigator.vibrate?.(50);
      // Start 90s rest timer
      // Rest comes from the plan: two minutes on the compounds, less on the
      // isolation work. Falls back to 90s for days without a plan.
      const restSeconds = plannedExercises.find(
        p => p.exercise.id === selectedExercise?.id
      )?.slot?.restSeconds ?? 90;
      setRestEndTime(Date.now() + restSeconds * 1000);
    } catch (err) {
      alert("Failed to save to cloud.");
    }
  }, [selectedExercise, addLog]);

  const handleDeleteLog = useCallback(async (logId: string) => {
    try {
      await removeLog(logId);
    } catch (err) {
      alert("Failed to delete from cloud.");
    }
  }, [removeLog]);
  
  const handleEditLog = useCallback(async (log: WorkoutLog) => {
    setActiveModal(null);
    try {
      await updateLog(log);
    } catch (err) {
      // Handled in hook
    }
  }, [updateLog]);

  const handleEditInit = useCallback((log: WorkoutLog) => {
    const newWeight = prompt("Enter new weight:", log.weight.toString());
    const newReps = prompt("Enter new reps:", log.reps.toString());
    if (newWeight && newReps) {
      handleEditLog({
        ...log,
        weight: Number(newWeight),
        reps: Number(newReps)
      });
    }
  }, [handleEditLog]);

  const handleImportLogs = useCallback(async (importedLogs: WorkoutLog[]) => {
    try {
      await importLogs(importedLogs);
      alert("Import successful!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert(message);
    }
  }, [importLogs]);

  const handleSaveNewExercise = useCallback(async (newExercise: ExerciseDef) => {
    setActiveModal(null);
    try {
      await saveExercise(newExercise);
    } catch (e) {
      alert("Saved locally, but failed to sync to cloud. It will sync next time you open the app.");
    }
  }, [saveExercise]);

  const handleArchiveClick = useCallback(async (exercise: ExerciseDef) => {
    navigator.vibrate?.(10);
    const updatedExercise = { ...exercise, isArchived: true };
    try {
      navigator.vibrate?.(10);
      await saveExercise(updatedExercise);
      navigator.vibrate?.(50);
    } catch (e) {
      logger.error("Failed to sync archive status", e);
    }
  }, [saveExercise]);

  const handleSwitchExercise = useCallback(async (currentExercise: ExerciseDef, replacementExercise: ExerciseDef) => {
    navigator.vibrate?.(10);
    try {
      await saveExercises([
        { ...currentExercise, isArchived: true },
        { ...replacementExercise, isArchived: false }
      ]);
      navigator.vibrate?.(50);
      setActiveModal(null);
    } catch (e) {
      logger.error("Failed to sync switch status", e);
    }
  }, [saveExercises]);

  const handleRestoreExercise = useCallback(async (exercise: ExerciseDef) => {
    navigator.vibrate?.(10);
    const updatedExercise = { ...exercise, isArchived: false };
    try {
      navigator.vibrate?.(10);
      await saveExercise(updatedExercise);
      navigator.vibrate?.(50);
    } catch (e) {
      logger.error("Failed to sync restore status", e);
    }
  }, [saveExercise]);

  const handleDeleteExercisePermanently = useCallback(async (exerciseId: string) => {
    if (window.confirm("WARNING: This will delete ALL HISTORY for this exercise.")) {
      if (window.confirm("FINAL WARNING: This action cannot be undone. Are you absolutely sure?")) {
         try {
             await deleteExercisePermanently(exerciseId);
         } catch (err) {
             logger.error("Failed to delete exercise logs from cloud", err);
         }
      }
    }
  }, [deleteExercisePermanently]);

  const handleSwitchInit = useCallback((exercise: ExerciseDef) => {
    setSelectedExercise(exercise);
    setActiveModal('switch');
  }, []);

  // Combine Default and Synced Exercises (Synced overrides Default)
  const allExercises = useMemo(() => {
    const combined: Record<string, ExerciseDef> = { ...EXERCISES }; // Start with defaults
    syncedExercises.forEach(ex => {
      combined[ex.id] = ex; // Override if exists in cloud/local
    });
    return Object.values(combined);
  }, [syncedExercises]);

  // Filter exercises based on selected day AND archive status
  // Optimization: Memoize filtering to prevent recalculation on every render (e.g., when timer ticks)
  const activeForDay = useMemo(() => allExercises.filter(
    ex => {
      if (ex.isArchived) return false; // Hide archived
      if (workoutDay) return ex.dayType === workoutDay;
      return true;
    }
  ), [allExercises, workoutDay]);

  // Push and Pull run in a fixed order: compounds first while you are fresh,
  // isolation last. planExercisesForDay also keeps a slot's unused alternative
  // out of the list, so "Bench Press or Dumbbell Press" shows as one entry.
  const plannedExercises = useMemo(
    () => planExercisesForDay(workoutDay, activeForDay),
    [workoutDay, activeForDay]
  );
  const displayedExercises = useMemo(
    () => plannedExercises.map(p => p.exercise),
    [plannedExercises]
  );

  // Pre-compute and attach resolved logs directly to displayed exercises to avoid O(1) dictionary lookups inside JSX render loop
  /**
   * The lift to walk to next: the first one in the plan that is not finished.
   * As each is completed the next takes over the top slot. Null once the day
   * is done.
   */
  const currentIndex = useMemo(() => {
    const idx = plannedExercises.findIndex(
      ({ exercise, slot }) => !isSlotComplete(getTodaysLogs(exercise.id), slot)
    );
    return idx === -1 ? null : idx;
  }, [plannedExercises, getTodaysLogs]);

  const hasPlan = !!(workoutDay && WORKOUT_PLAN[workoutDay]);

  const displayedExercisesWithLogs = useMemo(() => {
    return displayedExercises.map(exercise => ({
      exercise,
      logs: getLogsForExercise(exercise.id)
    }));
  }, [displayedExercises, getLogsForExercise]);

  const archivedExercises = useMemo(() => allExercises.filter(ex => ex.isArchived), [allExercises]);


  // --- RENDERING ---

  // 1. LOCK SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="bg-slate-700 p-4 rounded-full shadow-inner">
              <Lock className="text-blue-500" size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-6">LiftLogic Locked</h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative flex items-center w-full">
              <input 
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-600 rounded-xl p-3 pr-12 text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                placeholder="Enter password to unlock"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 p-1 text-slate-400 hover:text-white rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20"
            >
              Unlock App
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. LOADING STATE
  if (isLoading && !workoutDay && logs.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p>Syncing data...</p>
      </div>
    );
  }

  // 3. ERROR STATE
  if (error && logs.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <p className="text-white text-xl font-bold mb-2">Connection Error</p>
        <p className="mb-6">{error}</p>
        <button onClick={fetchDataAndSync} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold mr-4">Retry</button>
      </div>
    );
  }

  // 4. DASHBOARD HOME
  if (!workoutDay) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 animate-in fade-in relative">
        

        {/* Logout Button */}
        <div className="absolute top-4 right-4 flex gap-2">
           <button 
             onClick={handleLogout} 
             className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
           >
             <LogOut size={16} /> Logout
           </button>
        </div>


        <div className="text-center mb-12">
          <div className="bg-blue-600 p-4 rounded-2xl inline-block mb-4 shadow-xl shadow-blue-900/20">
            <Dumbbell className="text-white" size={48} />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">LiftLogic</h1>
          <p className="text-slate-400">Select your workout for today</p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <button 
            onClick={() => setWorkoutDay('PUSH')}
            className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 hover:border-blue-500/50 text-white font-bold text-xl py-6 rounded-2xl transition-all shadow-lg flex flex-col items-center gap-2 group"
          >
            <span>Push Day</span>
            <span className="text-sm font-normal text-slate-500 group-hover:text-slate-400">Chest • Shoulders • Triceps</span>
          </button>

          <button 
            onClick={() => setWorkoutDay('PULL')}
            className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 hover:border-blue-500/50 text-white font-bold text-xl py-6 rounded-2xl transition-all shadow-lg flex flex-col items-center gap-2 group"
          >
            <span>Pull Day</span>
            <span className="text-sm font-normal text-slate-500 group-hover:text-slate-400">Back • Biceps</span>
          </button>

          <button 
            onClick={() => setWorkoutDay('LEGS')}
            className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 hover:border-blue-500/50 text-white font-bold text-xl py-6 rounded-2xl transition-all shadow-lg flex flex-col items-center gap-2 group"
          >
            <span>Leg Day</span>
            <span className="text-sm font-normal text-slate-500 group-hover:text-slate-400">Quads • Hamstrings • Calves</span>
          </button>
        </div>

        <div className="mt-12 flex gap-6">
          <button 
            onClick={() => setActiveModal('globalHistory')}
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm"
          >
            <ClipboardList size={16} /> View Journal
          </button>
          

          <button 
            onClick={() => setActiveModal('archived')}
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm"
          >
            <Archive size={16} /> Archived Exercises
          </button>

        </div>

         {activeModal === 'globalHistory' && (
          <GlobalHistoryModal
            logs={logs}
            currentDayType={workoutDay}
            onClose={() => setActiveModal(null)}
            onImport={handleImportLogs}
            customExercises={syncedExercises}
          />
        )}

        {activeModal === 'switch' && selectedExercise && (
        <SwitchExerciseModal
          currentExercise={selectedExercise}
          availableExercises={archivedExercises}
          onClose={() => {
            setActiveModal(null);
            setSelectedExercise(null);
          }}
          onSelect={(replacementExercise) => handleSwitchExercise(selectedExercise, replacementExercise)}
        />
      )}

      {activeModal === 'archived' && (
          <ArchivedExercisesModal 
            exercises={archivedExercises}
            onClose={() => setActiveModal(null)}
            onRestore={handleRestoreExercise}
            onDelete={handleDeleteExercisePermanently}
          />
        )}
      </div>
    );
  }

  // 5. WORKOUT VIEW
  return (
    <div className="min-h-screen pb-12 font-sans selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setWorkoutDay(null)}
              className="mr-1 p-1 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Back to Dashboard"
            >
              <ChevronLeft size={28} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white leading-none capitalize">
                {workoutDay?.toLowerCase()} Day
              </h1>
              <p className="text-xs text-blue-400 font-medium">LiftLogic</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setActiveModal('globalHistory')}


              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="View Workout Journal"
              aria-label="View Workout Journal"
            >
              <ClipboardList size={24} />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto p-4 animate-in slide-in-from-right-4 fade-in duration-300">
        <div className="space-y-6">
          {displayedExercisesWithLogs.map(({ exercise, logs: exerciseLogs }, i) => {
            const { slot } = plannedExercises[i];
            // On a planned day only the current lift gets a full card; the rest
            // are quiet rows underneath, so opening the app answers "what am I
            // walking to" without reading a list.
            const isCurrent = currentIndex === i;
            if (hasPlan && !isCurrent) return null;

            return (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                exerciseLogs={exerciseLogs}
                onLogClick={handleLogClick}
                onHistoryClick={handleHistoryClick}
                onArchive={handleArchiveClick}
                onSwitch={handleSwitchInit}
                onFormClick={handleFormClick}
                slot={slot}
                isCurrent={isCurrent}
                showWarmup={hasPlan && i === 0}
              />
            );
          })}

          {hasPlan && (
            <div className="space-y-2">
              {currentIndex !== null && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pt-1">
                  Then
                </p>
              )}
              {plannedExercises.map(({ exercise, slot, position }, i) => {
                if (currentIndex === i) return null;
                return (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    slot={slot}
                    position={position}
                    isComplete={isSlotComplete(getTodaysLogs(exercise.id), slot)}
                    onLogClick={handleLogClick}
                    onFormClick={handleFormClick}
                  />
                );
              })}
              {currentIndex === null && (
                <p className="text-center text-sm text-green-400 font-bold py-3">
                  All {plannedExercises.length} exercises done. Nice work.
                </p>
              )}
            </div>
          )}

          {/* Add Exercise Button */}
          <button
            onClick={() => setActiveModal('addExercise')}
            className="w-full border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-xl p-4 flex items-center justify-center gap-2 text-slate-500 hover:text-white hover:bg-slate-800/50 transition-all group"
          >
            <Plus size={20} className="group-hover:text-blue-500 transition-colors" />
            <span className="font-medium">Add New Exercise</span>
          </button>
        </div>
      </main>

      {/* Modals */}
      {activeModal === 'form' && selectedExercise && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
            Loading form model…
          </div>
        }>
          <FormViewerModal
            exercise={selectedExercise}
            onClose={() => setActiveModal(null)}
            onLogSet={handleFormLogSet}
          />
        </Suspense>
      )}

      {activeModal === 'log' && selectedExercise && (
        <LogModal
          exercise={selectedExercise}
          todaysLogs={getTodaysLogs(selectedExercise.id)}
          lastSessionLogs={getLastSessionLogs(selectedExercise.id)}
          onClose={() => setActiveModal(null)}
          onSave={handleAddSet}
          onDelete={handleDeleteLog}
        />
      )}

      {activeModal === 'history' && selectedExercise && (
        <HistoryModal
          exercise={selectedExercise}
          // Pass pre-filtered and pre-sorted logs for the specific exercise
          logs={getLogsForExercise(selectedExercise.id)}
          onClose={() => setActiveModal(null)}
          onDelete={handleDeleteLog}
          onEdit={handleEditInit}
        />
      )}

      {activeModal === 'globalHistory' && (
        <GlobalHistoryModal
          logs={logs}
          currentDayType={workoutDay}
          onClose={() => setActiveModal(null)}
          onImport={handleImportLogs}
          customExercises={syncedExercises}
        />
      )}


      {activeModal === 'addExercise' && workoutDay && (
        <AddExerciseModal 
          dayType={workoutDay}
          onClose={() => setActiveModal(null)}
          onSave={handleSaveNewExercise}
        />
      )}



      {workoutDay && (
        <RestTimer
          endTime={restEndTime}
          onCancel={() => setRestEndTime(null)}
          onAdd={(seconds) => setRestEndTime(prev => prev ? prev + seconds * 1000 : null)}
        />
      )}
    </div>
  );
};

export default App;
