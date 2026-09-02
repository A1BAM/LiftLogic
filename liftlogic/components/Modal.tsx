import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Closes on Escape. Split out because the full-screen form viewer wants this
 * behaviour without the dialog shell below.
 */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onEscape]);
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

interface ModalProps {
  onClose: () => void;
  /** Heading text, or a heading with its icon. */
  title: React.ReactNode;
  /** Small line under the heading. */
  subtitle?: React.ReactNode;
  /** Controls sitting to the left of the close button. */
  headerActions?: React.ReactNode;
  /**
   * 'sheet' rises from the bottom edge on phones and centres from `sm` up,
   * which puts a thumb-heavy form within reach one-handed.
   */
  variant?: 'center' | 'sheet';
  children: React.ReactNode;
}

/**
 * The shell every dialog in the app shares: backdrop, panel, header with a
 * close button, Escape to dismiss, and the focus handling that goes with
 * `aria-modal` — focus moves into the dialog, Tab cycles inside it, and
 * whatever was focused before is restored on the way out.
 *
 * Children are the body, and any footer, inside the panel.
 */
export const Modal: React.FC<ModalProps> = ({
  onClose,
  title,
  subtitle,
  headerActions,
  variant = 'center',
  children
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEscapeKey(onClose);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // The panel itself takes focus rather than the first control: a modal that
    // grabs a text field on open would fight the fields these dialogs focus
    // deliberately, and would pop the keyboard up on a phone unasked.
    panelRef.current?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus?.();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    // Wrap at both ends so Tab never escapes to the workout behind the dialog.
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const isSheet = variant === 'sheet';

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center backdrop-blur-sm animate-in fade-in duration-200 ${
        isSheet
          ? 'items-end sm:items-center bg-black/90'
          : 'items-center p-4 bg-black/80'
      }`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-slate-900 w-full max-w-md border-slate-700 flex flex-col max-h-[90vh] shadow-2xl outline-none ${
          isSheet ? 'sm:rounded-2xl border-t sm:border' : 'rounded-2xl border'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center gap-2 bg-slate-800/50 rounded-t-2xl">
          <div className="min-w-0">
            {/* A long title wraps; the icon beside it must not be squashed to
                make room, which is what happened when each dialog rolled its
                own header. */}
            <h2 id={titleId} className="text-xl font-bold text-white flex items-center gap-2 [&>svg]:shrink-0">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};
