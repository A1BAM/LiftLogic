import React, { useState } from 'react';
import { ExerciseDef, WorkoutLog } from '../types';
import { X, Save, Minus, Plus, Layers } from 'lucide-react';

interface LogModalProps {
  exercise: ExerciseDef;
  existingLog?: WorkoutLog;
  lastLog?: WorkoutLog;
  onClose: () => void;
  onSave: (data: { weight: number; reps: number; sets: number }) => void;
}

export const LogModal: React.FC<LogModalProps> = ({ 
  exercise, 
  existingLog,
  lastLog,
  onClose, 
  onSave 
}) => {
  // Logic: 
  // 1. If editing, use the existing log values.
  // 2. If new log, try to use the LAST log values (persistence) so user doesn't have to scroll up.
  // 3. If no history, use defaults.
  
  const [weight, setWeight] = useState(
    existingLog ? existingLog.weight : (lastLog?.weight ?? exercise.defaultWeight)
  );
  
  const [reps, setReps] = useState(
    existingLog ? existingLog.reps : (lastLog?.reps ?? exercise.targetReps)
  );

  // Default sets to lastLog.sets if available and > 1, otherwise 1
  const [sets, setSets] = useState(
    existingLog 
      ? existingLog.sets 
      : (lastLog && lastLog.sets > 1 ? lastLog.sets : 1)
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ weight, reps, sets });
  };

  const adjustWeight = (delta: number) => setWeight(Math.max(0, weight + delta));
  const adjustReps = (delta: number) => setReps(Math.max(1, reps + delta));
  const adjustSets = (delta: number) => setSets(Math.max(1, sets + delta));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-md sm:rounded-2xl border-t sm:border border-slate-700 p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200">
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">{exercise.name}</h2>
            <p className="text-sm text-slate-400">{existingLog ? 'Edit Entry' : 'Log Workout'}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Weight Control */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <label className="block text-slate-400 text-xs font-bold uppercase mb-3 text-center">Weight (lbs)</label>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => adjustWeight(-5)} className="w-12 h-12 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-colors">
                <Minus size={20} />
              </button>
              <div className="text-3xl font-bold text-white font-mono w-24 text-center">{weight}</div>
              <button type="button" onClick={() => adjustWeight(5)} className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-xl text-white transition-colors shadow-lg shadow-blue-900/20">
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Reps Control */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <label className="block text-slate-400 text-xs font-bold uppercase mb-3 text-center">Reps</label>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => adjustReps(-1)} className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                  <Minus size={16} />
                </button>
                <div className="text-2xl font-bold text-white font-mono">{reps}</div>
                <button type="button" onClick={() => adjustReps(1)} className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Sets Control */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <label className="block text-slate-400 text-xs font-bold uppercase mb-3 text-center flex items-center justify-center gap-1">
                 <Layers size={12} /> Sets
              </label>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => adjustSets(-1)} className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                  <Minus size={16} />
                </button>
                <div className="text-2xl font-bold text-white font-mono">{sets}</div>
                <button type="button" onClick={() => adjustSets(1)} className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all mt-4"
          >
            <Save size={20} />
            Save Log
          </button>
        </form>
      </div>
    </div>
  );
};