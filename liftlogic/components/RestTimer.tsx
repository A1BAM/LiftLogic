import React, { useEffect, useState } from 'react';
import { Timer, X, Plus, Minus } from 'lucide-react';

interface RestTimerProps {
  endTime: number | null;
  onCancel: () => void;
  onAdd: (seconds: number) => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({ endTime, onCancel, onAdd }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!endTime) return;

    const interval = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        onCancel(); // Close timer when done
        // Optional: Play sound here
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    // Initial calc
    setTimeLeft(Math.ceil((endTime - Date.now()) / 1000));

    return () => clearInterval(interval);
  }, [endTime, onCancel]);

  if (!endTime || timeLeft <= 0) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center animate-in slide-in-from-bottom-5">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-4 flex items-center gap-4 w-full max-w-sm">
        <div className="bg-blue-600/20 p-3 rounded-full animate-pulse">
           <Timer className="text-blue-500" size={24} />
        </div>
        
        <div className="flex-1">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Rest Timer</p>
          <div className="text-3xl font-mono font-bold text-white tabular-nums">
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="flex flex-col gap-1">
           <button 
             onClick={() => onAdd(30)}
             className="p-1 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
             aria-label="Add 30 seconds"
           >
             <Plus size={14} />
           </button>
           <button 
             onClick={() => onAdd(-30)}
             className="p-1 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
             aria-label="Subtract 30 seconds"
           >
             <Minus size={14} />
           </button>
        </div>

        <button 
          onClick={onCancel}
          className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors ml-2"
          aria-label="Close Timer"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};