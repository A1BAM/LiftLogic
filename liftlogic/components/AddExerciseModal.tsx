import React, { useState } from 'react';
import { DayType, ExerciseDef } from '../types';
import { Save, Dumbbell } from 'lucide-react';
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
    if (!name || !muscleGroup) return;

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
      title={<><Dumbbell size={20} className="text-blue-500" />Add New {dayType} Exercise</>}
    >
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label htmlFor="exercise-name" className="block text-slate-400 text-xs font-bold uppercase mb-2">Exercise Name</label>
            <input 
              id="exercise-name"
              type="text" 
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Incline Bench Press"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 placeholder-slate-700"
            />
          </div>

          <div>
            <label htmlFor="muscle-group" className="block text-slate-400 text-xs font-bold uppercase mb-2">Muscle Group</label>
            <input 
              id="muscle-group"
              type="text" 
              required
              value={muscleGroup}
              onChange={e => setMuscleGroup(e.target.value)}
              placeholder="e.g. Upper Chest"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 placeholder-slate-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-weight" className="block text-slate-400 text-xs font-bold uppercase mb-2">Start Weight (lbs)</label>
              <input 
                id="start-weight"
                type="number" 
                required
                min="0"
                value={defaultWeight}
                onChange={e => setDefaultWeight(Number(e.target.value))}
                onFocus={e => e.target.select()}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="target-reps" className="block text-slate-400 text-xs font-bold uppercase mb-2">Target Reps</label>
              <input 
                id="target-reps"
                type="number" 
                required
                min="1"
                value={targetReps}
                onChange={e => setTargetReps(Number(e.target.value))}
                onFocus={e => e.target.select()}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="progression-increment" className="block text-slate-400 text-xs font-bold uppercase mb-2">Progression Increment (lbs)</label>
            <div className="flex items-center gap-4">
               <input 
                id="progression-increment"
                type="range" 
                min="2.5" 
                max="20" 
                step="2.5"
                value={increment}
                onChange={e => setIncrement(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-white font-mono w-12 text-right">{increment}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Weight to add when you hit your rep goal.</p>
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-400 transition-all mt-6"
          >
            <Save size={20} />
            Create Exercise
          </button>
        </form>
    </Modal>
  );
};