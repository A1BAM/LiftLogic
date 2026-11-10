import React, { useState } from 'react';
import { DayType, ExerciseDef } from '../types';
import { Save } from 'lucide-react';
import { Modal } from './Modal';

interface AddExerciseModalProps {
  dayType: DayType;
  onClose: () => void;
  onSave: (exercise: ExerciseDef) => void;
}

export const AddExerciseModal: React.FC<AddExerciseModalProps> = ({ 
  dayType, 
  onClose, 
  onSave 
}) => {

  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [defaultWeight, setDefaultWeight] = useState(20);
  const [targetReps, setTargetReps] = useState(10);
  const [increment, setIncrement] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !muscleGroup.trim()) return;
    if (!Number.isFinite(defaultWeight) || defaultWeight < 0) return;
    if (!Number.isInteger(targetReps) || targetReps < 1) return;

    const newExercise: ExerciseDef = {
      id: `custom-${Date.now()}`,
      name,
      muscleGroup,
      defaultWeight,
      increment,
      targetReps,
      dayType,
      isCustom: true
    };

    onSave(newExercise);
  };

  return (
    <Modal
      onClose={onClose}
      title={`New ${dayType.toLowerCase()} exercise`}
    >
        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto px-5 pb-6">
          <div>
            <label htmlFor="exercise-name" className="mb-2 block text-[13px] text-cream-400">Exercise Name</label>
            <input 
              id="exercise-name"
              type="text" 
              required
              autoFocus
              // The definition is stored as JSON in a 500-character column;
              // an unbounded name would save locally and then never sync.
              maxLength={80}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Incline Bench Press"
              className="w-full rounded-xl border border-ink-700 bg-ink-800 p-3.5 text-[16px] text-cream-50 placeholder-cream-600 focus:border-cream-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="muscle-group" className="mb-2 block text-[13px] text-cream-400">Muscle Group</label>
            <input 
              id="muscle-group"
              type="text" 
              required
              maxLength={80}
              value={muscleGroup}
              onChange={e => setMuscleGroup(e.target.value)}
              placeholder="e.g. Upper Chest"
              className="w-full rounded-xl border border-ink-700 bg-ink-800 p-3.5 text-[16px] text-cream-50 placeholder-cream-600 focus:border-cream-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-weight" className="mb-2 block text-[13px] text-cream-400">Start Weight (lbs)</label>
              <input 
                id="start-weight"
                type="number" 
                required
                min="0"
                step="any"
                value={defaultWeight}
                onChange={e => setDefaultWeight(Number(e.target.value))}
                onFocus={e => e.target.select()}
                className="nums w-full rounded-xl border border-ink-700 bg-ink-800 p-3.5 text-[16px] text-cream-50 focus:border-cream-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="target-reps" className="mb-2 block text-[13px] text-cream-400">Target Reps</label>
              <input 
                id="target-reps"
                type="number" 
                required
                min="1"
                value={targetReps}
                onChange={e => setTargetReps(Number(e.target.value))}
                onFocus={e => e.target.select()}
                className="nums w-full rounded-xl border border-ink-700 bg-ink-800 p-3.5 text-[16px] text-cream-50 focus:border-cream-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="progression-increment" className="mb-2 block text-[13px] text-cream-400">Progression Increment (lbs)</label>
            <div className="flex items-center gap-4">
               <input 
                id="progression-increment"
                type="range" 
                min="2.5" 
                max="20" 
                step="2.5"
                value={increment}
                onChange={e => setIncrement(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-ink-700 accent-cream-50"
              />
              <span className="nums w-12 text-right text-[15px] text-cream-50">{increment}</span>
            </div>
            <p className="mt-2 text-[13px] text-cream-400">Weight to add when you hit your rep goal.</p>
          </div>

          <button 
            type="submit" 
            className="btn-primary mt-6 flex w-full items-center justify-center gap-2 py-4 text-[15px]"
          >
            <Save size={20} />
            Create Exercise
          </button>
        </form>
    </Modal>
  );
};