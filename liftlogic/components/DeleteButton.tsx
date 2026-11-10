import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

/**
 * Delete in two taps, on the row itself: the bin turns into Delete / Cancel,
 * the way a swiped row does in Mail. No system dialog is involved, so it
 * cannot be silently refused the way confirm() can.
 */
export const DeleteButton: React.FC<{
  /** What is being deleted, e.g. "set 2". Read out, not shown. */
  what: string;
  onConfirm: () => void;
}> = ({ what, onConfirm }) => {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="btn-quiet shrink-0 p-2"
        aria-label={`Delete ${what}`}
      >
        <Trash2 size={16} />
      </button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="btn-quiet px-3 text-[14px]"
        aria-label={`Keep ${what}`}
      >
        Cancel
      </button>
      <button
        type="button"
        // Focused on arrival so a keyboard or switch user lands on the
        // question they just raised.
        autoFocus
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        className="inline-flex min-h-[44px] items-center rounded-2xl border border-red-400/60 px-3.5 text-[14px] font-semibold text-red-300 active:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        aria-label={`Confirm delete ${what}`}
      >
        Delete
      </button>
    </span>
  );
};
