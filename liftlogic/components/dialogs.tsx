import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useBackToClose } from '../hooks/useBackToClose';

/**
 * In-app replacements for confirm() and alert().
 *
 * The browser's own dialogs cannot be relied on: opened from the Home Screen,
 * or after Safari has been told to stop a page showing them, confirm() comes
 * straight back false without drawing anything — which is exactly how "delete
 * does nothing" happened. These are ordinary elements on the page, so they
 * always appear, and they look like the rest of the app.
 */
interface DialogRequest {
  kind: 'confirm' | 'notice';
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Styles the confirming button as the dangerous choice. */
  destructive?: boolean;
  resolve: (confirmed: boolean) => void;
}

let enqueue: ((request: DialogRequest) => void) | null = null;

export function confirmDialog(options: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise(resolve => {
    // With no host mounted there is nothing to ask with. Saying no is the
    // safe answer for every caller: each one guards something destructive.
    if (!enqueue) return resolve(false);
    enqueue({ kind: 'confirm', ...options, resolve });
  });
}

/** Tells the user something happened. Resolves once it is dismissed. */
export function notify(title: string, message?: string): Promise<void> {
  return new Promise(resolve => {
    if (!enqueue) return resolve();
    enqueue({ kind: 'notice', title, message, resolve: () => resolve() });
  });
}

/** Mounted once, at the root. Shows queued dialogs one at a time. */
export const DialogHost: React.FC = () => {
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => {
    enqueue = request => setQueue(q => [...q, request]);
    return () => {
      enqueue = null;
    };
  }, []);

  const current = queue[0];
  const settle = (confirmed: boolean) => {
    if (!current) return;
    current.resolve(confirmed);
    setQueue(q => q.slice(1));
  };

  // Swiping back answers "no", the same as tapping outside.
  useBackToClose(!!current, () => settle(false));

  if (!current) return null;

  return (
    <Modal onClose={() => settle(false)} title={current.title} hideClose>
      <div className="px-5 pb-5">
        {current.message && (
          <p className="text-[15px] leading-relaxed text-cream-200">{current.message}</p>
        )}
        <div className="mt-5 flex gap-2.5">
          {current.kind === 'confirm' && (
            <button
              onClick={() => settle(false)}
              className="btn-quiet flex-1 border-ink-700 py-3.5 text-[15px]"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => settle(true)}
            className={
              current.destructive
                ? 'flex-1 rounded-2xl border border-red-400/60 py-3.5 text-[15px] font-semibold text-red-300 active:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300'
                : 'btn-primary flex-1 py-3.5 text-[15px]'
            }
          >
            {current.kind === 'confirm' ? current.confirmLabel ?? 'OK' : 'OK'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
