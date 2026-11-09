import React, { useState } from 'react';
import { ExerciseDef, WorkoutLog } from '../types';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';

interface LogModalProps {
  exercise: ExerciseDef;
  todaysLogs: WorkoutLog[];
  lastSessionLogs?: WorkoutLog[]; // Logs from the previous session (not today)
  onClose: () => void;
  onSave: (data: { weight: number; reps: number; sets: number }) => void;
  onDelete: (logId: string) => void;
}

/** A number you can either type into or nudge with a thumb. */
const Stepper: React.FC<{
  id: string;
  /** Shown above the field, so it can carry the unit. */
  label: string;
  /** Spoken name, without the unit: "decrease weight by 5". */
  name: string;
  value: string;
  onChange: (next: string) => void;
  onStep: (delta: number) => void;
  step: number;
  min: number;
  inputMode: 'decimal' | 'numeric';
  width: string;
}> = ({ id, label, name, value, onChange, onStep, step, min, inputMode, width }) => (
  <div>
    <label htmlFor={id} className="mb-2 block text-[12px] text-zinc-600">{label}</label>
    <div className="flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-800 p-1">
      <button
        type="button"
        onClick={() => onStep(-step)}
        className="btn-quiet shrink-0 rounded-lg p-3 text-zinc-400"
        aria-label={`Decrease ${name} by ${step}`}
      >
        <Minus size={17} />
      </button>
      <input
        id={id}
        type="number"
        inputMode={inputMode}
        min={min}
        aria-label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        // Typing is the fast path for a big jump; selecting on focus means the
        // first keystroke replaces the number instead of appending to it.
        onFocus={e => e.target.select()}
        className={`nums ${width} min-w-0 flex-1 bg-transparent text-center text-[28px] font-medium text-zinc-50
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 rounded-lg py-1`}
      />
      <button
        type="button"
        onClick={() => onStep(step)}
        className="btn-quiet shrink-0 rounded-lg p-3 text-zinc-400"
        aria-label={`Increase ${name} by ${step}`}
      >
        <Plus size={17} />
      </button>
    </div>
  </div>
);

export const LogModal: React.FC<LogModalProps> = ({
  exercise,
  todaysLogs,
  lastSessionLogs,
  onClose,
  onSave,
  onDelete
}) => {
  // Determine default values for the input form
  // 1. If we just logged a set today, copy that weight/reps for convenience
  // 2. If no logs today, use the LAST session's weight and Target Reps
  // 3. Fallback to defaults
  const getLastLog = () => {
    if (todaysLogs.length > 0) return todaysLogs[todaysLogs.length - 1];
    if (lastSessionLogs && lastSessionLogs.length > 0) return lastSessionLogs[0];
    return null;
  };

  const defaults = getLastLog();

  const [weightInput, setWeightInput] = useState((defaults ? defaults.weight : exercise.defaultWeight).toString());
  const [repsInput, setRepsInput] = useState((defaults ? defaults.reps : exercise.targetReps).toString());

  const weight = Number(weightInput) || 0;
  const reps = Number(repsInput) || 0;

  const adjustWeight = (delta: number) => {
    navigator.vibrate?.(10);
    setWeightInput(prev => Math.max(0, (Number(prev) || 0) + delta).toString());
  };
  const adjustReps = (delta: number) => {
    navigator.vibrate?.(10);
    setRepsInput(prev => Math.max(1, (Number(prev) || 0) + delta).toString());
  };

  const handleAddSet = (e: React.FormEvent) => {
    e.preventDefault();
    navigator.vibrate?.(10);
    // Always save as 1 set when using this granular logger
    onSave({ weight, reps, sets: 1 });
  };

  return (
    <Modal onClose={onClose} variant="sheet" title={exercise.name} subtitle="One set at a time">
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        {todaysLogs.length === 0 ? (
          <p className="py-5 text-[13px] text-zinc-600">Nothing logged yet today.</p>
        ) : (
          <ul className="py-1">
            {todaysLogs.map((log, index) => (
              <li
                key={log.id}
                className="flex items-center gap-3 border-b border-ink-700 py-2.5 last:border-b-0 animate-in fade-in"
              >
                <span className="nums w-5 shrink-0 text-[13px] text-zinc-600">{index + 1}</span>
                <span className="nums flex-1 text-[15px] text-zinc-200">
                  {log.weight}
                  <span className="text-zinc-600"> lbs × </span>
                  {log.reps}
                  <span className="text-zinc-600"> reps</span>
                </span>
                <button
                  onClick={() => {
                    navigator.vibrate?.(10);
                    if (window.confirm('Delete this set?')) onDelete(log.id);
                  }}
                  className="btn-quiet p-2"
                  aria-label={`Delete set ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleAddSet} className="border-t border-ink-700 px-5 pb-6 pt-5">
        <div className="grid grid-cols-2 gap-3">
          <Stepper
            id="weight-input"
            label="Weight (lbs)"
            name="weight"
            value={weightInput}
            onChange={setWeightInput}
            onStep={adjustWeight}
            step={5}
            min={0}
            inputMode="decimal"
            width="w-full"
          />
          <Stepper
            id="reps-input"
            label="Reps"
            name="reps"
            value={repsInput}
            onChange={setRepsInput}
            onStep={adjustReps}
            step={1}
            min={1}
            inputMode="numeric"
            width="w-full"
          />
        </div>

        <button type="submit" disabled={reps < 1} className="btn-primary mt-4 w-full py-4 text-[15px]">
          Add set {todaysLogs.length + 1}
        </button>
      </form>
    </Modal>
  );
};
