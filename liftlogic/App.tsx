import React, { useState, useEffect, useMemo } from 'react';
import { EXERCISES } from './constants';
import { WorkoutLog, ExerciseDef, ExerciseId, DayType } from './types';
import { ExerciseCard } from './components/ExerciseCard';
import { LogModal } from './components/LogModal';
import { HistoryModal } from './components/HistoryModal';
import { GlobalHistoryModal } from './components/GlobalHistoryModal';
import { AddExerciseModal } from './components/AddExerciseModal';
import { ArchivedExercisesModal } from './components/ArchivedExercisesModal';
import { Dumbbell, ClipboardList, ChevronLeft, Loader2, AlertCircle, Lock, LogOut, Plus, Archive } from 'lucide-react';

const API_URL = '/.netlify/functions/gym-api';
const DEFINITION_ID = '__DEFINITION__'; // Special ID to store exercise definitions in the DB

// Robust ID generator fallback
const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // App State
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [activeModal, setActiveModal] = useState<'log' | 'history' | 'globalHistory' | 'addExercise' | 'archived' | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDef | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [workoutDay, setWorkoutDay] = useState<DayType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Synced Exercises State (Contains Custom Exercises + Overrides for Default Exercises)
  const [syncedExercises, setSyncedExercises] = useState<ExerciseDef[]>([]);

  // Check Auth on Mount
  useEffect(() => {
    const storedAuth = localStorage.getItem('liftlogic_auth');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch Logs & Definitions when Authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDataAndSync();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const msgBuffer = new TextEncoder().encode(passwordInput);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const TARGET_HASH = "3622f482c5a01c2cf2ce0526e40ef7f5075d3811b7e28431dee0bbd86b66b11f";

      if (hashHex === TARGET_HASH) {
        setIsAuthenticated(true);
        localStorage.setItem('liftlogic_auth', 'true');
        setPasswordInput('');
      } else {
        alert("Wrong Password");
        setPasswordInput('');
      }
    } catch (err) {
      console.error("Crypto error:", err);
      // Fallback or alert if crypto isn't available (e.g. non-secure context)
      alert("Secure context required for login.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('liftlogic_auth');
    setWorkoutDay(null);
  };

  const saveDefinitionToCloud = async (exercise: ExerciseDef) => {
    const payload = {
      id: `def_${exercise.id}`,
      exerciseId: DEFINITION_ID, // Use special ID to distinguish from logs
      timestamp: Date.now(),
      weight: 0, 
      reps: 0, 
      sets: 0,
      notes: JSON.stringify(exercise)
    };
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
  };

  const fetchDataAndSync = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch data');
      const allData = await res.json();
      
      // Separate actual workout logs from exercise definitions
      const fetchedLogs = allData.filter((item: any) => item.exerciseId !== DEFINITION_ID);
      const fetchedDefinitions = allData.filter((item: any) => item.exerciseId === DEFINITION_ID);

      // Parse Cloud Definitions
      const cloudExercises: ExerciseDef[] = fetchedDefinitions.map((def: any) => {
        try {
          return JSON.parse(def.notes);
        } catch (e) { return null; }
      }).filter(Boolean);

      // Load Local Storage Definitions
      let localExercises: ExerciseDef[] = [];
      const storedCustom = localStorage.getItem('liftlogic_custom_exercises');
      if (storedCustom) {
        try {
          localExercises = JSON.parse(storedCustom);
        } catch (e) { console.error(e); }
      }

      // SYNC LOGIC:
      const cloudIds = new Set(cloudExercises.map(e => e.id));
      const missingFromCloud = localExercises.filter(e => !cloudIds.has(e.id));
      
      // Upload missing exercises to cloud
      if (missingFromCloud.length > 0) {
        console.log("Syncing up exercises to cloud:", missingFromCloud.length);
        for (const exercise of missingFromCloud) {
          await saveDefinitionToCloud(exercise);
        }
      }

      // Merge lists (Cloud is authoritative)
      const mergedExercises = [...cloudExercises, ...missingFromCloud];
      
      // Deduplicate by ID
      const uniqueExercises = Array.from(new Map(mergedExercises.map(e => [e.id, e])).values());

      // Update State
      setSyncedExercises(uniqueExercises);
      setLogs(fetchedLogs);
      
      // Update LocalStorage
      localStorage.setItem('liftlogic_custom_exercises', JSON.stringify(uniqueExercises));

      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not load workout history.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helpers
  const getLogsForExercise = (id: string) => {
    return logs.filter(l => l.exerciseId === id).sort((a, b) => b.timestamp - a.timestamp);
  };

  const getTodaysLogs = (id: string) => {
    const today = new Date().toDateString();
    return getLogsForExercise(id)
      .filter(l => new Date(l.timestamp).toDateString() === today)
      .reverse();
  };

  const getLastSessionLogs = (id: string) => {
    const all = getLogsForExercise(id);
    const today = new Date().toDateString();
    const lastLogNotToday = all.find(l => new Date(l.timestamp).toDateString() !== today);
    if (!lastLogNotToday) return [];
    const lastDate = new Date(lastLogNotToday.timestamp).toDateString();
    return all.filter(l => new Date(l.timestamp).toDateString() === lastDate);
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

  // Handlers
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
    const logToSave: WorkoutLog = {
      id: generateId(),
      exerciseId: selectedExercise.id,
      timestamp: Date.now(),
      weight: data.weight,
      reps: data.reps,
      sets: 1
    };

    setLogs(prev => [...prev, logToSave]);

    try {
      await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(logToSave)
      });
    } catch (err) {
      console.error("Failed to save log", err);
      alert("Failed to save to cloud.");
      fetchDataAndSync();
    }
  };

  const handleDeleteLog = async (logId: string) => {
    setLogs(prev => prev.filter(l => l.id !== logId));

    try {
      await fetch(API_URL, {
        method: 'DELETE',
        body: JSON.stringify({ id: logId })
      });
    } catch (err) {
      console.error("Failed to delete log", err);
      alert("Failed to delete from cloud.");
      fetchDataAndSync();
    }
  };
  
  const handleEditLog = async (log: WorkoutLog) => {
      setLogs(prev => prev.map(l => l.id === log.id ? log : l));
      setActiveModal(null);
      try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(log)
        });
      } catch (err) {
          fetchDataAndSync();
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
    setLogs(prevLogs => {
      const logMap = new Map(prevLogs.map(l => [l.id, l]));
      importedLogs.forEach(l => logMap.set(l.id, l));
      return Array.from(logMap.values());
    });

    let errorCount = 0;
    for (const log of importedLogs) {
      try {
        await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify(log)
        });
      } catch (e) {
        errorCount++;
      }
    }
    if (errorCount > 0) alert(`Import finished with ${errorCount} errors.`);
    else alert("Import successful!");
  };

  const handleSaveNewExercise = async (newExercise: ExerciseDef) => {
    const updatedSynced = [...syncedExercises, newExercise];
    setSyncedExercises(updatedSynced);
    localStorage.setItem('liftlogic_custom_exercises', JSON.stringify(updatedSynced));
    setActiveModal(null);

    try {
      await saveDefinitionToCloud(newExercise);
    } catch (e) {
      console.error("Failed to sync new exercise to cloud", e);
      alert("Saved locally, but failed to sync to cloud. It will sync next time you open the app.");
    }
  };

  const handleArchiveExercise = async (exercise: ExerciseDef) => {
      const updatedExercise = { ...exercise, isArchived: true };
      
      // Update state: Add to synced list if not already there, or update existing
      const existingIndex = syncedExercises.findIndex(ex => ex.id === exercise.id);
      let updatedSynced;
      if (existingIndex >= 0) {
        updatedSynced = syncedExercises.map(ex => ex.id === exercise.id ? updatedExercise : ex);
      } else {
        updatedSynced = [...syncedExercises, updatedExercise];
      }

      setSyncedExercises(updatedSynced);
      localStorage.setItem('liftlogic_custom_exercises', JSON.stringify(updatedSynced));
      
      try {
        await saveDefinitionToCloud(updatedExercise);
      } catch (e) {
        console.error("Failed to sync archive status", e);
      }
  };

  const handleRestoreExercise = async (exercise: ExerciseDef) => {
    const updatedExercise = { ...exercise, isArchived: false };
    
    const updatedSynced = syncedExercises.map(ex => ex.id === exercise.id ? updatedExercise : ex);
    setSyncedExercises(updatedSynced);
    localStorage.setItem('liftlogic_custom_exercises', JSON.stringify(updatedSynced));
    
    try {
      await saveDefinitionToCloud(updatedExercise);
    } catch (e) {
      console.error("Failed to sync restore status", e);
    }
};

  const handleDeleteExercisePermanently = async (exerciseId: string) => {
    if (window.confirm("WARNING: This will delete ALL HISTORY for this exercise.")) {
      if (window.confirm("FINAL WARNING: This action cannot be undone. Are you absolutely sure?")) {
         
         // 1. Update Synced Exercises List (Remove override/custom def)
         const updatedSynced = syncedExercises.filter(e => e.id !== exerciseId);
         setSyncedExercises(updatedSynced);
         localStorage.setItem('liftlogic_custom_exercises', JSON.stringify(updatedSynced));

         // 2. Remove logs from local state
         setLogs(prev => prev.filter(l => l.exerciseId !== exerciseId));

         // 3. Call API to delete logs and definition from DB
         try {
             // Delete Logs
             await fetch(API_URL, {
                 method: 'DELETE',
                 body: JSON.stringify({ exerciseId })
             });
             
             // Delete Definition
             await fetch(API_URL, {
                method: 'DELETE',
                body: JSON.stringify({ id: `def_${exerciseId}` })
            });

         } catch (err) {
             console.error("Failed to delete exercise logs from cloud", err);
         }
      }
    }
  };

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
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="View Workout Journal"
            >
              <ClipboardList size={24} />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Logout"
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
    </div>
  );
};

export default App;