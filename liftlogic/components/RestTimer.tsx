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

  // Keep the screen on while resting. The phone otherwise locks part-way
  // through a two-minute rest, and the timer you were watching is behind a
  // passcode. Released the moment the rest ends; re-taken on return, because
  // Safari drops the lock whenever the tab is hidden.
  useEffect(() => {
    if (!endTime || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) next.release().catch(() => {});
        else lock = next;
      } catch {
        // Low Power Mode or a hidden tab refuses it; the timer still works.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [endTime !== null]);

  if (!endTime || timeLeft <= 0) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="panel screen-in flex w-full max-w-md items-center gap-3 px-4 py-3">
        <Timer size={18} className="shrink-0 text-ember" />

        <div className="flex-1">
          <p className="text-[13px] uppercase tracking-[0.14em] text-cream-400">Rest</p>
          <div className="display nums text-[28px] leading-tight">
            {formatTime(timeLeft)}
          </div>
        </div>

        <button
          onClick={() => { navigator.vibrate?.(10); onAdd(-30); }}
          className="btn-quiet p-2"
          aria-label="Subtract 30 seconds"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => { navigator.vibrate?.(10); onAdd(30); }}
          className="btn-quiet p-2"
          aria-label="Add 30 seconds"
        >
          <Plus size={16} />
        </button>
        <button onClick={onCancel} className="btn-quiet p-2" aria-label="Close Timer">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
