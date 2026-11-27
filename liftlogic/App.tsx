import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EXERCISES } from './constants';
import { WorkoutLog, ExerciseDef, DayType } from './types';
import { ExerciseCard } from './components/ExerciseCard';
import { ExerciseRow } from './components/ExerciseRow';
import { planExercisesForDay, isSlotComplete, switchOptionsFor, slotFor, WORKOUT_PLAN } from './workoutPlan';
import { groupSessions, recommendFor } from './progression';
import { LogModal } from './components/LogModal';
import { EditSetModal } from './components/EditSetModal';
import { confirmDialog, notify, DialogHost } from './components/dialogs';
import { HistoryModal } from './components/HistoryModal';
import { GlobalHistoryModal } from './components/GlobalHistoryModal';
import { AddExerciseModal } from './components/AddExerciseModal';
import { ArchivedExercisesModal } from './components/ArchivedExercisesModal';
import { SwitchExerciseModal } from './components/SwitchExerciseModal';
import { RestTimer } from './components/RestTimer';
import { LockScreen } from './components/LockScreen';
import { HomeScreen } from './components/HomeScreen';
import { ChevronLeft, Loader2, AlertCircle, Plus, ClipboardList } from 'lucide-react';
import { useWorkoutData } from './hooks/useWorkoutData';
import { useBackToClose } from './hooks/useBackToClose';
import { exerciseService } from './services/exerciseService';
import { authService } from './services/authService';
import { logger } from './utils/logger';
import { getLocalDateKey, getLocalDayBounds } from './utils/date';
import { ParsedBackup } from './utils/backup';
import { generateId } from './utils/id';
import { loadResume, saveResume } from './utils/resume';

const WorkoutScreens = ({ signal, onLogout }: { signal: AbortSignal; onLogout: () => void }) => {
  // UI State
  const [activeModal, setActiveModal] = useState<'log' | 'history' | 'globalHistory' | 'addExercise' | 'archived' | 'switch' | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDef | null>(null);
  // Read once, on the first render: where the last page load left off.
  const [resumed] = useState(loadResume);
  const [workoutDay, setWorkoutDay] = useState<DayType | null>(resumed.day);
  const [restEndTime, setRestEndTime] = useState<number | null>(resumed.restEndTime);
  const [editingLog, setEditingLog] = useState<WorkoutLog | null>(null);

  // The back gesture walks out the way you walked in: sheet, then workout.
  useBackToClose(workoutDay !== null, () => setWorkoutDay(null));
  useBackToClose(activeModal !== null, () => setActiveModal(null));
  useBackToClose(editingLog !== null, () => setEditingLog(null));

  // Stable identities: the timer keeps these in its effect dependencies, so
  // fresh arrows would tear down and restart the countdown on every render.
  const cancelRest = useCallback(() => setRestEndTime(null), []);
  const addRest = useCallback(
    (seconds: number) => setRestEndTime(prev => (prev ? prev + seconds * 1000 : null)),
    []
  );

  // Hook for data and sync
  const {
    logs,
    syncedExercises,
    isLoading,
    hasLoaded,
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
  } = useWorkoutData(signal);

  useEffect(() => {
    if (!signal.aborted) saveResume({ day: workoutDay, restEndTime, signedIn: true });
  }, [workoutDay, restEndTime, signal]);

  // UI Handlers
  const handleLogClick = useCallback((exercise: ExerciseDef) => {
    setSelectedExercise(exercise);
    setActiveModal('log');
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
      notify("Not saved", "That set did not reach the cloud. Check your connection and log it again.");
    }
  }, [selectedExercise, addLog]);

  const handleDeleteLog = useCallback(async (logId: string) => {
    try {
      await removeLog(logId);
    } catch (err) {
      notify("Not deleted", "The cloud did not accept the delete, so the set is still there.");
    }
  }, [removeLog]);
  
  const handleEditLog = useCallback(async (log: WorkoutLog) => {
    setEditingLog(null);
    try {
      await updateLog(log);
    } catch (err) {
      // The hook has already re-synced, so the list shows what was really
      // saved; this says why the edit is not in it.
      notify("Edit not saved", "The cloud did not accept the change, so the set is as it was.");
    }
  }, [updateLog]);

  const handleSaveNewExercise = useCallback(async (newExercise: ExerciseDef) => {
    setActiveModal(null);
    try {
      await saveExercise(newExercise);
    } catch (e) {
      notify("Saved on this phone", "It could not reach the cloud just now and will sync next time you open the app.");
    }
  }, [saveExercise]);

  /**
   * Archiving is offered wherever an exercise is shown — the card, the rows
   * under it, and the swap picker (for the lift being swapped out as well as
   * for the options) — so the one confirmation lives here rather than in each
   * of them.
   */
  const handleArchiveClick = useCallback(async (exercise: ExerciseDef) => {
    const confirmed = await confirmDialog({
      title: `Archive ${exercise.name}?`,
      message: 'It will be hidden from your daily list. You can bring it back from Exercises.',
      confirmLabel: 'Archive'
    });
    if (!confirmed) return;
    navigator.vibrate?.(10);
    const updatedExercise = { ...exercise, isArchived: true };
    // Archiving an option leaves the picker open so another can be chosen, but
    // archiving the lift the picker is about leaves it with nothing to swap.
    if (selectedExercise?.id === exercise.id) {
      setActiveModal(null);
      setSelectedExercise(null);
    }
    try {
      navigator.vibrate?.(10);
      await saveExercise(updatedExercise);
      navigator.vibrate?.(50);
    } catch (e) {
      logger.error("Failed to sync archive status", e);
    }
  }, [saveExercise, selectedExercise]);

  /**
   * Swapping only changes which variant fills the slot. It deliberately leaves
   * both exercises active: archiving is a separate decision, so the one you
   * swapped away from stays in the picker ready to swap back, instead of
   * having to be dug out of the archive.
   */
  const handleSwitchExercise = useCallback(async (currentExercise: ExerciseDef, replacementExercise: ExerciseDef) => {
    navigator.vibrate?.(10);
    setActiveModal(null);
    setSelectedExercise(null);
    try {
      await saveExercises([
        { ...currentExercise, isSlotChoice: false },
        { ...replacementExercise, isSlotChoice: true, isArchived: false }
      ]);
      navigator.vibrate?.(50);
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
    // Two questions on purpose: this is the one action in the app that
    // cannot be undone, and it takes every logged set with it.
    const first = await confirmDialog({
      title: 'Delete this exercise?',
      message: 'This deletes ALL of its history.',
      confirmLabel: 'Delete',
      destructive: true
    });
    if (!first) return;
    const second = await confirmDialog({
      title: 'This cannot be undone',
      message: 'Every set ever logged for it will be gone for good.',
      confirmLabel: 'Delete everything',
      destructive: true
    });
    if (!second) return;
    try {
      await deleteExercisePermanently(exerciseId);
    } catch (err) {
      logger.error("Failed to delete exercise logs from cloud", err);
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

  /**
   * Restores a backup by adding what is missing, never by overwriting: a set
   * edited since the backup was taken keeps its edit, and an exercise you have
   * since archived stays archived.
   */
  const handleImportBackup = useCallback(async ({ logs: incoming, exercises, originalSetIds }: ParsedBackup) => {
    const knownExercises = new Set(allExercises.map(e => e.id));
    const knownLogs = new Map(logs.map(log => [log.id, log]));
    const newExercises = exercises.filter(e => !knownExercises.has(e.id));
    const newLogs = incoming.filter(log => {
      if (knownLogs.has(log.id)) return false;
      const originalId = originalSetIds?.get(log.id);
      const original = originalId && knownLogs.get(originalId);
      return !original || original.exerciseId !== log.exerciseId || original.timestamp !== log.timestamp;
    });

    if (newExercises.length === 0 && newLogs.length === 0) {
      notify('Nothing new', 'Everything in that backup is already here.');
      return;
    }
    try {
      // Exercises first, so no restored set ever points at one that is missing.
      if (newExercises.length > 0) await saveExercises(newExercises);
      if (newLogs.length > 0) await importLogs(newLogs);
      const parts = [
        newLogs.length > 0 && `${newLogs.length.toLocaleString()} ${newLogs.length === 1 ? 'set' : 'sets'}`,
        newExercises.length > 0 && `${newExercises.length} ${newExercises.length === 1 ? 'exercise' : 'exercises'}`
      ].filter(Boolean);
      notify('Restored', `Added ${parts.join(' and ')}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      notify('Restore failed', message);
    }
  }, [allExercises, logs, saveExercises, importLogs]);


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

  /**
   * When each day was last trained. It is what you are actually choosing on
   * from the home screen — the day you have rested longest is usually the one
   * to do — so it is worth the single pass over the logs.
   */
  const lastTrainedByDay = useMemo(() => {
    const dayOf = new Map(allExercises.map(ex => [ex.id, ex.dayType]));
    const latest: Partial<Record<DayType, number>> = {};
    for (const log of logs) {
      const day = dayOf.get(log.exerciseId);
      if (!day) continue;
      if (!latest[day] || log.timestamp > latest[day]!) latest[day] = log.timestamp;
    }
    return latest;
  }, [logs, allExercises]);

  /** Sets, days and weight moved over the last seven days. */
  const week = useMemo(() => {
    const since = Date.now() - 7 * 86400000;
    const days = new Set<string>();
    let sets = 0;
    let volume = 0;
    for (const log of logs) {
      if (!Number.isFinite(log.timestamp) || log.timestamp < since) continue;
      const n = Math.floor(Number(log.sets));
      const counted = Number.isFinite(n) && n > 0 ? n : 1;
      sets += counted;
      volume += (Number(log.weight) || 0) * (Number(log.reps) || 0) * counted;
      days.add(getLocalDateKey(log.timestamp));
    }
    return { sets, volume, days: days.size };
  }, [logs]);

  // Everything still in circulation, day by day, so the main-menu list can
  // archive any exercise you have — including a slot's unused variant, which
  // never appears on a workout screen.
  const activeExercises = useMemo(
    () => allExercises.filter(ex => !ex.isArchived),
    [allExercises]
  );


  // --- RENDERING ---

  // 2. LOADING STATE
  // Also covers coming back into a workout after a reload: until the history
  // is in, the card would otherwise be drawn from nothing and claim it was
  // your first time on a lift you have done for a year.
  if ((isLoading || !hasLoaded) && logs.length === 0 && syncedExercises.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 text-cream-400">
        <Loader2 className="animate-spin" size={20} />
        <p className="text-[14px]">Syncing…</p>
      </div>
    );
  }

  // 3. ERROR STATE
  if (error && logs.length === 0) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-7">
        <AlertCircle className="mb-4 text-cream-400" size={20} />
        <p className="text-[17px] font-medium text-cream-50">Could not reach your workouts</p>
        <p className="mt-2 text-[14px] leading-relaxed text-cream-400">{error}</p>
        <button onClick={fetchDataAndSync} className="btn-primary mt-6 w-full py-3.5 text-[15px]">
          Try again
        </button>
      </div>
    );
  }

  // 4. DASHBOARD HOME
  if (!workoutDay) {
    return (
      <div className="screen-in">
        <HomeScreen
          lastTrained={lastTrainedByDay}
          week={week}
          onPick={setWorkoutDay}
          onJournal={() => setActiveModal('globalHistory')}
          onExercises={() => setActiveModal('archived')}
          onLogout={onLogout}
        />

        {activeModal === 'globalHistory' && (
          <GlobalHistoryModal
            logs={logs}
            currentDayType={workoutDay}
            onClose={() => setActiveModal(null)}
            onImport={handleImportBackup}
            customExercises={syncedExercises}
          />
        )}

        {activeModal === 'archived' && (
          <ArchivedExercisesModal
            exercises={archivedExercises}
            onClose={() => setActiveModal(null)}
            onRestore={handleRestoreExercise}
            onDelete={handleDeleteExercisePermanently}
            activeExercises={activeExercises}
            onArchive={handleArchiveClick}
          />
        )}
      </div>
    );
  }

  // 5. WORKOUT VIEW
  const doneCount = plannedExercises.filter(({ exercise, slot }) =>
    isSlotComplete(getTodaysLogs(exercise.id), slot)
  ).length;

  return (
    <div className="min-h-[100dvh] selection:bg-ink-700 selection:text-cream-50">
      <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950">
        <div className="mx-auto flex max-w-md items-center gap-1 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <button
            onClick={() => setWorkoutDay(null)}
            className="btn-quiet -ml-2 p-2"
            aria-label="Back to Dashboard"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="display flex-1 text-[20px] capitalize">
            {workoutDay.toLowerCase()}
          </h1>
          {hasPlan && (
            <span className="nums mr-1 text-[14px] font-medium text-cream-400">
              {doneCount}/{plannedExercises.length}
            </span>
          )}
          <button
            onClick={() => setActiveModal('globalHistory')}
            className="btn-quiet p-2"
            title="View Workout Journal"
            aria-label="View Workout Journal"
          >
            <ClipboardList size={19} />
          </button>
        </div>
        {/* How far through the day you are, as one hairline. */}
        {hasPlan && (
          <div className="mx-auto h-0.5 max-w-md bg-ink-700">
            <div
              className="h-0.5 bg-ember transition-[width] duration-500"
              style={{ width: `${(doneCount / plannedExercises.length) * 100}%` }}
            />
          </div>
        )}
      </header>

      <main className="relative mx-auto max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)] screen-in">
        {displayedExercisesWithLogs.map(({ exercise, logs: exerciseLogs }, i) => {
          const { slot, position } = plannedExercises[i];
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
              onSwitch={
                switchOptionsFor(workoutDay, exercise.id, allExercises).length > 0
                  ? handleSwitchInit
                  : undefined
              }
              slot={slot}
              position={hasPlan ? position : undefined}
              showWarmup={hasPlan && i === 0}
            />
          );
        })}

        {hasPlan && (
          <div className="mt-8">
            {currentIndex !== null && (
              <p className="mb-2 px-1 text-[13px] uppercase tracking-[0.14em] text-cream-400">Up next</p>
            )}
            <div className="panel px-4">
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
                  onArchive={handleArchiveClick}
                />
              );
            })}
            </div>
            {currentIndex === null && (
              <p className="display pt-7 text-center text-[19px] text-sage">
                That is the whole day. Well done.
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => setActiveModal('addExercise')}
          className="btn-quiet mt-6 flex w-full items-center justify-center gap-2 border-ink-700 py-4 text-[14px]"
        >
          <Plus size={15} /> Add an exercise
        </button>
      </main>

      {/* Modals */}
      {activeModal === 'log' && selectedExercise && (
        <LogModal
          exercise={selectedExercise}
          todaysLogs={getTodaysLogs(selectedExercise.id)}
          lastSessionLogs={getLastSessionLogs(selectedExercise.id)}
          suggestion={recommendFor(
            selectedExercise,
            groupSessions(getLogsForExercise(selectedExercise.id), selectedExercise.id),
            slotFor(workoutDay, selectedExercise.id),
            getLocalDayBounds().start
          )}
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
          onEdit={setEditingLog}
        />
      )}

      {activeModal === 'globalHistory' && (
        <GlobalHistoryModal
          logs={logs}
          currentDayType={workoutDay}
          onClose={() => setActiveModal(null)}
          onImport={handleImportBackup}
          customExercises={syncedExercises}
        />
      )}


      {editingLog && (
        <EditSetModal log={editingLog} onClose={() => setEditingLog(null)} onSave={handleEditLog} />
      )}

      {activeModal === 'addExercise' && workoutDay && (
        <AddExerciseModal 
          dayType={workoutDay}
          onClose={() => setActiveModal(null)}
          onSave={handleSaveNewExercise}
        />
      )}

      {/* Belongs with the workout view: the switch control lives on the
          exercise cards here, so the picker has to be mounted here too. */}
      {activeModal === 'switch' && selectedExercise && (
        <SwitchExerciseModal
          currentExercise={selectedExercise}
          availableExercises={switchOptionsFor(workoutDay, selectedExercise.id, allExercises)}
          onClose={() => {
            setActiveModal(null);
            setSelectedExercise(null);
          }}
          onSelect={(replacementExercise) => handleSwitchExercise(selectedExercise, replacementExercise)}
          onArchive={handleArchiveClick}
        />
      )}



      {workoutDay && (
        <RestTimer endTime={restEndTime} onCancel={cancelRest} onAdd={addRest} />
      )}
    </div>
  );
};

const LOGOUT_KEY = 'liftlogic_logout';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isResuming, setIsResuming] = useState(() => loadResume().signedIn);
  const [passwordInput, setPasswordInput] = useState('');
  const session = useRef(new AbortController());
  const logoutChannel = useRef<BroadcastChannel | null>(null);
  const lastLogout = useRef<string | null>(null);

  const lock = useCallback((id: string) => {
    if (lastLogout.current === id) return;
    lastLogout.current = id;
    session.current.abort();
    session.current = new AbortController();
    setIsAuthenticated(false);
    setIsResuming(false);
    setPasswordInput('');
    exerciseService.clearLocalExercises();
    saveResume({ day: null, restEndTime: null, signedIn: false });
  }, []);

  useEffect(() => {
    let mounted = true;
    const { signal } = session.current;
    authService.checkSession(signal).then(valid => {
      if (!mounted || signal.aborted) return;
      if (valid) setIsAuthenticated(true);
      else {
        exerciseService.clearLocalExercises();
        saveResume({ day: null, restEndTime: null, signedIn: false });
      }
    }).catch(() => { /* Keep the app locked when the session cannot be checked. */ })
      .finally(() => { if (mounted && !signal.aborted) setIsResuming(false); });

    const onStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_KEY && event.newValue) lock(event.newValue);
    };
    const catchUp = () => {
      try {
        const id = localStorage.getItem(LOGOUT_KEY);
        if (id && id !== lastLogout.current) lock(id);
      } catch { /* BroadcastChannel also works when storage is unavailable. */ }
    };
    try { lastLogout.current = localStorage.getItem(LOGOUT_KEY); } catch { /* Storage may be blocked. */ }
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(LOGOUT_KEY) : null;
    if (channel) channel.onmessage = event => { if (typeof event.data === 'string') lock(event.data); };
    logoutChannel.current = channel;
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', catchUp);
    return () => {
      mounted = false;
      channel?.close();
      logoutChannel.current = null;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', catchUp);
    };
  }, [lock]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    session.current.abort();
    session.current = new AbortController();
    setIsResuming(false);
    const { signal } = session.current;
    try {
      // Logging in is enough; the history download follows from
      // isAuthenticated, so there is no point fetching it here as well.
      await authService.login(passwordInput, signal);
      if (!signal.aborted) setIsAuthenticated(true);
    } catch (err: unknown) {
      if (signal.aborted) return;
      const status = err !== null && typeof err === 'object' && 'status' in err ? (err as { status: unknown }).status : undefined;
      if (status === 401) {
        notify("Wrong password");
      } else if (status === 429) {
        notify("Too many attempts", "Wait a minute, then try again.");
      } else {
        notify("Could not connect", "Check your network and try again.");
      }
    }
    setPasswordInput("");
  };

  const handleLogout = async () => {
    const { signal } = session.current;
    try {
      await authService.logout();
    } catch (err) {
      logger.error("Logout error", err);
      if (!signal.aborted) notify("Sign-out unconfirmed", "Check your connection and tap Lock again.");
      return;
    }
    if (signal.aborted) return;
    const id = generateId();
    lock(id);
    try { localStorage.setItem(LOGOUT_KEY, id); } catch { /* Notify other tabs through the channel. */ }
    logoutChannel.current?.postMessage(id);
  };

  let screen;
  if (isAuthenticated) {
    screen = <WorkoutScreens signal={session.current.signal} onLogout={handleLogout} />;
  } else if (isResuming) {
    screen = (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 text-cream-400">
        <Loader2 className="animate-spin" size={20} />
        <p className="text-[14px]">Picking up where you left off…</p>
      </div>
    );
  } else {
    screen = <LockScreen password={passwordInput} onPasswordChange={setPasswordInput} onSubmit={handleLogin} />;
  }
  return <>{screen}<DialogHost key={isAuthenticated ? 'open' : 'locked'} /></>;
};

export default App;
