import React, { useState } from 'react';
import { WorkoutLog } from '../types';
import { Modal } from './Modal';
import { Stepper } from './LogModal';

interface EditSetModalProps {
  log: WorkoutLog;
  onClose: () => void;
  onSave: (log: WorkoutLog) => void;
}

/**
 * Correcting a logged set, with the same two fields it was logged with. This
 * used to be a pair of system prompts, which took free text and could be
 * refused by the browser without a word.
 */
export const EditSetModal: React.FC<EditSetModalProps> = ({ log, onClose, onSave }) => {
  const [weightInput, setWeightInput] = useState(String(log.weight));
  const [repsInput, setRepsInput] = useState(String(log.reps));

  const weight = Math.min(2000, Math.max(0, Number(weightInput) || 0));
  const reps = Math.min(1000, Math.floor(Number(repsInput) || 0));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...log, weight, reps });
  };

  return (
    <Modal onClose={onClose} variant="sheet" title="Edit set">
      <form onSubmit={submit} noValidate className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.75rem)]">
        <div className="grid grid-cols-2 gap-3">
          <Stepper
            id="edit-weight-input"
            label="Weight (lbs)"
            name="weight"
            value={weightInput}
            onChange={setWeightInput}
            onStep={d => setWeightInput(prev => String(Math.max(0, (Number(prev) || 0) + d)))}
            step={5}
            inputMode="decimal"
          />
          <Stepper
            id="edit-reps-input"
            label="Reps"
            name="reps"
            value={repsInput}
            onChange={setRepsInput}
            onStep={d => setRepsInput(prev => String(Math.max(1, (Number(prev) || 0) + d)))}
            step={1}
            inputMode="numeric"
          />
        </div>
        <button type="submit" disabled={reps < 1} className="btn-primary mt-5 w-full py-4 text-[16px]">
          Save changes
        </button>
      </form>
    </Modal>
  );
};
