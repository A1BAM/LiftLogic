import React, { useState } from 'react';
import { UserProfile } from '../types';
import { X, Save, User } from 'lucide-react';

interface ProfileModalProps {
  currentProfile: UserProfile | null;
  onClose: () => void;
  onSave: (profile: { heightCm: number; weightLbs: number }) => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ currentProfile, onClose, onSave }) => {
  const [heightCm, setHeightCm] = useState(currentProfile?.heightCm?.toString() || '');
  const [weightLbs, setWeightLbs] = useState(currentProfile?.weightLbs?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heightCm || !weightLbs) return;

    setIsSaving(true);
    try {
      await onSave({
        heightCm: Number(heightCm),
        weightLbs: Number(weightLbs)
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <User size={20} className="text-blue-500" />
            Your Profile
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-400 mb-4">
            Used to calculate realistic progression limits based on your lean body mass.
          </p>

          <div>
            <label htmlFor="height" className="block text-slate-400 text-xs font-bold uppercase mb-2">Height (cm)</label>
            <input
              id="height"
              type="number"
              required
              min="100"
              max="250"
              value={heightCm}
              onChange={e => setHeightCm(e.target.value)}
              placeholder="e.g. 180"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 placeholder-slate-700"
            />
          </div>

          <div>
            <label htmlFor="weight" className="block text-slate-400 text-xs font-bold uppercase mb-2">Weight (lbs)</label>
            <input
              id="weight"
              type="number"
              required
              min="50"
              max="500"
              value={weightLbs}
              onChange={e => setWeightLbs(e.target.value)}
              placeholder="e.g. 175"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 placeholder-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-400 transition-all mt-6"
          >
            <Save size={20} />
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};
