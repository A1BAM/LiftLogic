import React, { useState, useEffect, useMemo } from 'react';
import { EXERCISES } from './constants';
import { WorkoutLog, ExerciseDef, DayType } from './types';
import { ExerciseCard } from './components/ExerciseCard';
import { LogModal } from './components/LogModal';
import { HistoryModal } from './components/HistoryModal';
import { GlobalHistoryModal } from './components/GlobalHistoryModal';
import { AddExerciseModal } from './components/AddExerciseModal';
import { ArchivedExercisesModal } from './components/ArchivedExercisesModal';
import { RestTimer } from './components/RestTimer';
import { Dumbbell, ClipboardList, ChevronLeft, Loader2, AlertCircle, Lock, LogOut, Plus, Archive } from 'lucide-react';
import { useWorkoutData } from './hooks/useWorkoutData';
import { workoutService } from './services/workoutService';
import { logger } from './utils/logger';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // UI State
  const [activeModal, setActiveModal] = useState<'log' | 'history' | 'globalHistory' | 'addExercise' | 'archived' | null>(null);
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
    deleteExercisePermanently,
    getLogsForExercise,
    getTodaysLogs,
    getLastSessionLogs
  } = useWorkoutData(isAuthenticated);

  // Check Auth on Mount
  useEffect(() => {
    const storedAuth = localStorage.getItem('liftlogic_auth');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const msgBuffer = new TextEncoder().encode(passwordInput);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Temporarily store the hash to attempt an authenticated request
      localStorage.setItem('liftlogic_auth_token', hashHex);

      try {
        // Attempt to fetch workouts as a verification of the password/hash
        await workoutService.fetchWorkouts();
        setIsAuthenticated(true);
        localStorage.setItem('liftlogic_auth', 'true');
        setPasswordInput('');
      } catch (err) {
        // If the request fails (e.g., 401 Unauthorized), the password was wrong
        localStorage.removeItem('liftlogic_auth_token');
        alert("Wrong Password");
        setPasswordInput('');
      }
    } catch (err) {
      logger.error("Crypto error:", err);
      alert("Secure context required for login.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('liftlogic_auth');
    localStorage.removeItem('liftlogic_auth_token');
    setWorkoutDay(null);
  };

  // UI Handlers
  const openLogModal = (exercise: ExerciseDef) => {
    setSelectedExercise(exercise);
    setActiveModal('log');
  };

  const openHistoryModal = (exercise: ExerciseDef) => {
    setSelectedExercise(exercise);
    setActiveModal('history');
  };

  const handleAddSet = async (data: { weight: number; reps: number; sets: number }) => {
    if (!selectedExercise) return;
    try {
      await addLog(selectedExercise.id, data.weight, data.reps);
      // Start 90s rest timer
      setRestEndTime(Date.now() + 90 * 1000);
    } catch (err) {
      alert("Failed to save to cloud.");
    }
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      await removeLog(logId);
    } catch (err) {
      alert("Failed to delete from cloud.");
    }
  };
  
  const handleEditLog = async (log: WorkoutLog) => {
      setActiveModal(null);
      try {
        await updateLog(log);
      } catch (err) {
          // Handled in hook
      }
  };

  const handleEditInit = (log: WorkoutLog) => {
    const newWeight = prompt("Enter new weight:", log.weight.toString());
    const newReps = prompt("Enter new reps:", log.reps.toString());
    if (newWeight && newReps) {
        handleEditLog({
            ...log,
            weight: Number(newWeight),
            reps: Number(newReps)
        });
    }
  };

  const handleImportLogs = async (importedLogs: WorkoutLog[]) => {
    try {
      await importLogs(importedLogs);
      alert("Import successful!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveNewExercise = async (newExercise: ExerciseDef) => {
    setActiveModal(null);
    try {
      await saveExercise(newExercise);
    } catch (e) {
      alert("Saved locally, but failed to sync to cloud. It will sync next time you open the app.");
    }
  };

  const handleArchiveExercise = async (exercise: ExerciseDef) => {
      const updatedExercise = { ...exercise, isArchived: true };
      try {
        await saveExercise(updatedExercise);
      } catch (e) {
        logger.error("Failed to sync archive status", e);
      }
  };

  const handleRestoreExercise = async (exercise: ExerciseDef) => {
    const updatedExercise = { ...exercise, isArchived: false };
    try {
      await saveExercise(updatedExercise);
    } catch (e) {
      logger.error("Failed to sync restore status", e);
    }
};

  const handleDeleteExercisePermanently = async (exerciseId: string) => {
    if (window.confirm("WARNING: This will delete ALL HISTORY for this exercise.")) {
      if (window.confirm("FINAL WARNING: This action cannot be undone. Are you absolutely sure?")) {
         try {
             await deleteExercisePermanently(exerciseId);
         } catch (err) {
             logger.error("Failed to delete exercise logs from cloud", err);
         }
      }
    }
  };

  // Combine Default and Synced Exercises (Synced overrides Default)
  const allExercises = useMemo(() => {
    const combined = { ...EXERCISES }; // Start with defaults
    syncedExercises.forEach(ex => {
      combined[ex.id as any] = ex; // Override if exists in cloud/local
    });
    return Object.values(combined);
  }, [syncedExercises]);

  // Filter exercises based on selected day AND archive status
  const displayedExercises = allExercises.filter(
    ex => {
      if (ex.isArchived) return false; // Hide archived
      if (workoutDay) return ex.dayType === workoutDay;
      return true;
    }
  );

  const archivedExercises = allExercises.filter(ex => ex.isArchived);

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
            <div>
              <input 
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                placeholder="Enter password to unlock"
                autoFocus
                required
              />
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
        <div className="absolute top-4 right-4">
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
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
              title="View Workout Journal"
              aria-label="View Workout Journal"
            >
              <ClipboardList size={24} />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
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
          {displayedExercises.map((exercise) => {
            return (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                exerciseLogs={getLogsForExercise(exercise.id)}
                onLogClick={() => openLogModal(exercise)}
                onHistoryClick={() => openHistoryModal(exercise)}
                onArchive={() => handleArchiveExercise(exercise)}
              />
            );
          })}

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
          logs={logs}
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
